import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';

import type { Event, KimiHarness, Session } from '@moonshot-ai/kimi-code-sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CliArgumentError, parseCliInvocation } from '../src/cli-args';
import { runDoctor, formatDoctorReport } from '../src/doctor';
import { atomicWriteText } from '../src/fs-utils';
import { createDefaultSession, promptTurnToEnd } from '../src/harness';
import { ensureAriadneMcpJson, mcpEnvironment } from '../src/mcp/register';
import { runOnboard } from '../src/onboard';
import { resolveAriadneHome, resolveUserPath } from '../src/paths';
import { validateProviderBaseUrl } from '../src/providers';
import { ariadneTuiEnvironment } from '../src/tui';
import {
  findOnPath,
  parseCommand,
  readBackendConfig,
  runCommand,
  AriadneBackendConfigError,
} from '../src/ariadne/backend';
import {
  cancelJob,
  configuredJobOutput,
  getJob,
  jobLog,
  listJobArtifacts,
  listJobs,
  readJobLog,
  readJobRunManifest,
  startJob,
  waitForJob,
} from '../src/ariadne/jobs';
import { ariadneToolAnnotations, ARIADNE_TOOLS } from '../src/ariadne/tools';
import { readEngineeringRunManifest } from '../src/ariadne/provenance';
import { runResearchCommand } from '../src/ariadne/research-tools';

const tempDirs: string[] = [];
const harnessVersion = (
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('CLI arguments', () => {
  it('parses command-specific flags without consuming positionals as boolean values', () => {
    expect(parseCliInvocation(['web', '--port', '0', '--host=127.0.0.1', '--no-open'])).toEqual({
      kind: 'web',
      host: '127.0.0.1',
      port: 0,
      noOpen: true,
      homeDir: undefined,
    });
    expect(parseCliInvocation(['run', '--', '--design', 'a treatment train'])).toEqual({
      kind: 'run',
      prompt: '--design a treatment train',
    });
    expect(() => parseCliInvocation(['doctor', '--probe', 'unexpected'])).toThrow(
      CliArgumentError,
    );
  });

  it('rejects invalid ports, unknown flags and conflicting credentials', () => {
    expect(() => parseCliInvocation(['web', '--port', '70000'])).toThrow(/0 to 65535/);
    expect(() => parseCliInvocation(['doctor', '--unknown'])).toThrow(CliArgumentError);
    expect(() =>
      parseCliInvocation([
        'onboard',
        '--api-key',
        'secret',
        '--api-key-env',
        'API_KEY',
      ]),
    ).toThrow(/cannot be used together/);
    expect(() =>
      parseCliInvocation([
        'onboard',
        '--ariadne-command',
        '["python","adapter.py"]',
        '--ariadne-repo',
        '/tmp/Ariadne',
      ]),
    ).toThrow(/cannot be used together/);
  });

  it('parses research JSON actions and direct status or versioned advance controls', () => {
    expect(parseCliInvocation(['research', 'create', '--input', 'request.json', '--home', 'home'])).toEqual({
      kind: 'research', action: 'create', inputFile: 'request.json', taskId: undefined,
      expectedVersion: undefined, homeDir: 'home',
    });
    expect(parseCliInvocation(['research', 'advance', '--id', 'research_0123456789abcdef01234567', '--expected-version', '2'])).toEqual({
      kind: 'research', action: 'advance', inputFile: undefined, taskId: 'research_0123456789abcdef01234567',
      expectedVersion: 2, homeDir: undefined,
    });
    expect(parseCliInvocation(['research', 'list'])).toMatchObject({ kind: 'research', action: 'list' });
    expect(parseCliInvocation(['research', 'respond', '--help'])).toEqual({ kind: 'help' });
    for (const args of [
      ['research'],
      ['research', 'unknown'],
      ['research', 'status'],
      ['research', 'create', '--id', 'research_0123456789abcdef01234567'],
      ['research', 'advance', '--id', 'research_0123456789abcdef01234567', '--input', 'request.json'],
      ['research', 'status', '--id', 'research_0123456789abcdef01234567', '--expected-version', '2'],
      ['research', 'advance', '--id', 'research_0123456789abcdef01234567', '--expected-version', '0'],
      ['research', 'advance', '--id', 'research_0123456789abcdef01234567', '--expected-version', '1.5'],
    ]) {
      expect(() => parseCliInvocation(args)).toThrow(CliArgumentError);
    }
  });
});

describe('research CLI command boundary', () => {
  it('uses bounded JSON and shared schemas without creating research on malformed input', async () => {
    const root = makeTempDir();
    const ctx = { jobsRoot: path.join(root, 'jobs'), env: { ARIADNE_WORKDIR: root } };
    const inputFile = path.join(root, 'request.json');
    for (const content of ['[]', 'null', '{', ' '.repeat(65_537)]) {
      writeFileSync(inputFile, content);
      expect((await runResearchCommand('list', { inputFile }, ctx)).isError).toBe(true);
    }
    writeFileSync(inputFile, JSON.stringify({ limit: 101 }));
    expect((await runResearchCommand('list', { inputFile }, ctx)).isError).toBe(true);
    writeFileSync(inputFile, JSON.stringify({ humanApproved: true }));
    expect((await runResearchCommand('list', { inputFile }, ctx)).isError).toBe(true);
    if (process.platform !== 'win32') {
      const link = path.join(root, 'linked-request.json');
      writeFileSync(inputFile, '{}');
      symlinkSync(inputFile, link);
      expect((await runResearchCommand('list', { inputFile: link }, ctx)).isError).toBe(true);
    }
    expect((await runResearchCommand('list', { inputFile: root }, ctx)).isError).toBe(true);
    expect((await runResearchCommand('advance', { inputFile, taskId: 'research_0123456789abcdef01234567' }, ctx)).isError).toBe(true);
    expect(existsSync(ctx.jobsRoot)).toBe(false);
    const empty = await runResearchCommand('list', {}, ctx);
    expect(empty.isError).toBeUndefined();
    expect(JSON.parse(empty.content[0]?.text ?? '')).toEqual({ tasks: [], returned: 0 });
    expect(existsSync(ctx.jobsRoot)).toBe(false);
  });

  it('shares creation, recovery, request conflicts and read-only listing across CLI and MCP handlers', async () => {
    const root = makeTempDir();
    const ctx = { jobsRoot: path.join(root, 'jobs'), env: { ARIADNE_WORKDIR: root } };
    const requestTarget = path.join(root, 'nomination-request.json');
    const inputFile = path.join(root, 'request.json');
    writeFileSync(requestTarget, JSON.stringify({
      target_class: 'cembrene-class TPS (CeeSs)',
      input_proteins: ['proteins.faa'],
      query_hmm: 'query.hmm',
      reference_dir: 'references',
    }));
    const request = { requestId: 'runtime-research-case', objective: 'Nominate CeeSs candidates from coral transcriptomes', requestFile: requestTarget };
    writeFileSync(inputFile, JSON.stringify(request));
    const createdResult = await runResearchCommand('create', { inputFile }, ctx);
    expect(createdResult.isError).toBeUndefined();
    const created = JSON.parse(createdResult.content[0]?.text ?? '') as { id: string; version: number; assignments: unknown[] };
    expect(created).toMatchObject({ id: expect.stringMatching(/^research_[a-f0-9]{24}$/), version: 1, assignments: [] });
    const statusTool = ARIADNE_TOOLS.find((tool) => tool.name === 'ariadne_research_status');
    if (statusTool === undefined) throw new Error('research status tool is missing');
    const status = await statusTool.run({ taskId: created.id }, ctx);
    expect(JSON.parse(status.content[0]?.text ?? '')).toMatchObject({ id: created.id, version: created.version, assignments: [] });
    const list = await runResearchCommand('list', {}, ctx);
    expect(JSON.parse(list.content[0]?.text ?? '')).toMatchObject({ returned: 1, tasks: [{ id: created.id }] });
    const summary = (JSON.parse(list.content[0]?.text ?? '') as { tasks: Record<string, unknown>[] }).tasks[0];
    expect(summary).toMatchObject({ jobsUsed: 0, maxJobs: 6, openAttention: [], objectiveTruncated: false });
    expect(summary).not.toHaveProperty('events');
    expect(summary).not.toHaveProperty('queryRevisions');
    expect(listJobs(ctx.jobsRoot)).toEqual([]);
    const duplicate = await runResearchCommand('create', { inputFile }, ctx);
    expect(JSON.parse(duplicate.content[0]?.text ?? '')).toMatchObject({ id: created.id, version: created.version });
    writeFileSync(inputFile, JSON.stringify({ ...request, objective: 'A different study' }));
    expect((await runResearchCommand('create', { inputFile }, ctx)).isError).toBe(true);
    writeFileSync(inputFile, JSON.stringify({ ...request, maxJobs: 17 }));
    expect((await runResearchCommand('create', { inputFile }, ctx)).isError).toBe(true);
    expect(listJobs(ctx.jobsRoot)).toEqual([]);
  });
});

describe('runtime paths and private persistence', () => {
  it('expands user paths without inheriting the upstream Kimi home', () => {
    expect(resolveUserPath('~/aqua-work')).toBe(path.join(homedir(), 'aqua-work'));
    expect(resolveAriadneHome({ ARIADNE_HOME: '~/aqua-home' })).toBe(
      path.join(homedir(), 'aqua-home'),
    );
    expect(resolveAriadneHome({ KIMI_CODE_HOME: '/tmp/upstream-home' })).toBe(
      path.join(homedir(), '.ariadne'),
    );
  });

  it('launches the upstream engine under the isolated Ariadne TUI identity', () => {
    expect(ariadneTuiEnvironment('/tmp/aqua-home', { PATH: '/usr/bin' })).toMatchObject({
      PATH: '/usr/bin',
      KIMI_CODE_HOME: '/tmp/aqua-home',
      KIMI_CODE_NO_AUTO_UPDATE: '1',
      KIMI_DISABLE_TELEMETRY: '1',
      ARIADNE_HOME: '/tmp/aqua-home',
      ARIADNE_TUI: '1',
      ARIADNE_VERSION: harnessVersion,
    });
  });

  it('creates the conversational session in the same declared research workspace as MCP', async () => {
    const workDir = makeTempDir();
    const createSession = vi.fn().mockResolvedValue({ id: 'workspace-session' });
    const harness = {
      getConfig: vi.fn().mockResolvedValue({ defaultModel: 'fixture/model' }),
      createSession,
    } as unknown as KimiHarness;
    vi.stubEnv('ARIADNE_WORKDIR', path.relative(process.cwd(), workDir));
    try {
      await createDefaultSession(harness);
      expect(createSession).toHaveBeenCalledWith({
        workDir,
        model: 'fixture/model',
        permission: 'auto',
      });
      vi.stubEnv('ARIADNE_WORKDIR', undefined);
      await createDefaultSession(harness);
      expect(createSession).toHaveBeenLastCalledWith({
        workDir: process.cwd(),
        model: 'fixture/model',
        permission: 'auto',
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('tightens an existing atomic-write target instead of preserving broad permissions', () => {
    if (process.platform === 'win32') return;
    const filePath = path.join(makeTempDir(), 'private.json');
    writeFileSync(filePath, 'old', { mode: 0o666 });
    chmodSync(filePath, 0o666);

    atomicWriteText(filePath, 'new');

    expect(readFileSync(filePath, 'utf8')).toBe('new');
    expect(lstatSync(filePath).mode & 0o077).toBe(0);
  });

  it('allows local HTTP model endpoints but requires HTTPS off-machine', () => {
    expect(validateProviderBaseUrl('http://127.0.0.1:8000/v1/')).toBe(
      'http://127.0.0.1:8000/v1',
    );
    expect(validateProviderBaseUrl('https://models.example.org/v1///')).toBe(
      'https://models.example.org/v1',
    );
    expect(() => validateProviderBaseUrl('http://models.example.org/v1')).toThrow(
      /must use https/,
    );
    expect(() => validateProviderBaseUrl('http://127.evil.example/v1')).toThrow(
      /must use https/,
    );
    expect(() => validateProviderBaseUrl('https://user:secret@example.org/v1')).toThrow(
      /embedded credentials/,
    );
  });

  it('onboards a clean home and passes a probed doctor report', async () => {
    const root = makeTempDir();
    const homeDir = path.join(root, 'home');
    const backendScript = path.join(root, 'fake-backend.mjs');
    writeFileSync(
      backendScript,
      "if (process.argv.includes('--version')) console.log('ariadne 0.test'); else console.log('{}');\n",
    );
    const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      await runOnboard({
        yes: true,
        homeDir,
        ariadneCommand: JSON.stringify([process.execPath, backendScript]),
        provider: 'custom',
        providerType: 'openai',
        baseUrl: 'http://127.0.0.1:9999/v1',
        model: 'acceptance-model',
        apiKeyEnv: 'ARIADNE_TEST_API_KEY',
      });
      const report = await runDoctor({ homeDir, probe: true });
      expect(report.healthy).toBe(true);
      expect(report.checks.find((check) => check.name === 'default_model')).toMatchObject({
        ok: true,
        detail: 'custom-api/acceptance-model',
      });
      expect(report.checks.find((check) => check.name === 'ariadne_backend')).toMatchObject({
        ok: true,
      });
      expect(formatDoctorReport(report)).toContain('All required checks passed.');
      if (process.platform !== 'win32') {
        for (const fileName of ['config.toml', 'mcp.json', 'ariadne.json']) {
          expect(lstatSync(path.join(homeDir, fileName)).mode & 0o077).toBe(0);
        }
      }
    } finally {
      output.mockRestore();
    }
  });
});

describe('scientific chat turns', () => {
  it('activates the Ariadne skill and cleans up after the active turn ends', async () => {
    vi.useFakeTimers();
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const unsubscribe = vi.fn();
    let emit: ((event: Event) => void) | undefined;
    const promptWithSkills = vi.fn(async () => {
      const identity = { agentId: 'main', sessionId: 'scientific-session' };
      emit?.({ ...identity, type: 'turn.started', turnId: 1, origin: { kind: 'user' } });
      emit?.({ ...identity, type: 'assistant.delta', turnId: 1, delta: 'Assessing the case.' });
      emit?.({ ...identity, type: 'turn.ended', turnId: 2, reason: 'completed' });
    });
    const session = {
      onEvent: (listener: (event: Event) => void) => {
        emit = listener;
        return unsubscribe;
      },
      promptWithSkills,
      cancel: vi.fn(),
    } as unknown as Session;
    try {
      const pending = promptTurnToEnd(session, 'Assess arsenic-bearing groundwater.');
      await Promise.resolve();
      expect(promptWithSkills).toHaveBeenCalledWith(
        'Assess arsenic-bearing groundwater.',
        [{ name: 'ariadne' }],
      );
      expect(unsubscribe).not.toHaveBeenCalled();
      expect(stdout).toHaveBeenCalledWith('Assessing the case.');
      emit?.({ agentId: 'main', sessionId: 'scientific-session', type: 'turn.ended', turnId: 1, reason: 'completed' });
      await pending;
      expect(unsubscribe).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      stdout.mockRestore();
      stderr.mockRestore();
      vi.useRealTimers();
    }
  });

  it('cleans up when skill activation fails before the turn starts', async () => {
    vi.useFakeTimers();
    const unsubscribe = vi.fn();
    const session = {
      onEvent: () => unsubscribe,
      promptWithSkills: vi.fn().mockRejectedValue(new Error('Ariadne skill is unavailable')),
    } as unknown as Session;
    try {
      await expect(promptTurnToEnd(session, 'Assess a case.')).rejects.toThrow(
        'Ariadne skill is unavailable',
      );
      expect(unsubscribe).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Ariadne backend process handling', () => {
  it('parses JSON and quoted command forms and rejects malformed configuration', () => {
    expect(parseCommand('["uv","run","ariadne"]')).toEqual(['uv', 'run', 'ariadne']);
    expect(parseCommand('uv run --project "/tmp/repo with spaces" ariadne')).toEqual([
      'uv',
      'run',
      '--project',
      '/tmp/repo with spaces',
      'ariadne',
    ]);
    expect(() => parseCommand('[not-json]')).toThrow(AriadneBackendConfigError);

    const dir = makeTempDir();
    const configPath = path.join(dir, 'ariadne.json');
    writeFileSync(configPath, '{broken');
    expect(() => readBackendConfig(configPath)).toThrow(/left unchanged/);
  });

  it('resolves executables directly from PATH without invoking a shell', () => {
    const dir = makeTempDir();
    const executable = path.join(dir, 'ariadne-test');
    writeFileSync(executable, '#!/bin/sh\nexit 0\n');
    chmodSync(executable, 0o755);
    expect(findOnPath('ariadne-test', { PATH: dir })).toBe(executable);
  });

  it('bounds captured output and reports spawn errors as results', async () => {
    const output = await runCommand(
      process.execPath,
      ['-e', 'process.stdout.write("abcdefghijklmnop")'],
      { maxOutputBytes: 8 },
    );
    expect(output.code).toBe(0);
    expect(output.stdoutTruncated).toBe(true);
    expect(output.stdout).toMatch(/ijklmnop$/);

    const missing = await runCommand(path.join(makeTempDir(), 'missing-command'), []);
    expect(missing.code).toBeNull();
    expect(missing.spawnError).toBeTruthy();
  });
});

describe('MCP configuration persistence', () => {
  it('preserves existing servers and writes the Ariadne server atomically', () => {
    const homeDir = makeTempDir();
    const filePath = path.join(homeDir, 'mcp.json');
    writeFileSync(
      filePath,
      `${JSON.stringify({ mcpServers: { existing: { command: 'example' } }, custom: true })}\n`,
    );

    expect(ensureAriadneMcpJson(homeDir)).toBe(filePath);
    const config = JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, any>;
    expect(config['custom']).toBe(true);
    expect(config['mcpServers']['existing']).toEqual({ command: 'example' });
    expect(config['mcpServers']['ariadne']['env']['ARIADNE_HOME']).toBe(homeDir);
  });

  it('never overwrites malformed user configuration', () => {
    const homeDir = makeTempDir();
    const filePath = path.join(homeDir, 'mcp.json');
    writeFileSync(filePath, '{ malformed');

    expect(() => ensureAriadneMcpJson(homeDir)).toThrow(/left unchanged/);
    expect(readFileSync(filePath, 'utf8')).toBe('{ malformed');
  });

  it('forwards only the runtime overrides needed by the MCP server', () => {
    expect(
      mcpEnvironment('/tmp/home', {
        ARIADNE_REPO: '/tmp/repo',
        ARIADNE_WORKDIR: '/tmp/work',
        ARIADNE_ESM_MODEL: 'facebook/esm2_t6_8M_UR50D',
        UNRELATED_SECRET: 'do-not-copy',
      }),
    ).toEqual({
      ARIADNE_HOME: '/tmp/home',
      ARIADNE_REPO: '/tmp/repo',
      ARIADNE_WORKDIR: '/tmp/work',
      ARIADNE_ESM_MODEL: 'facebook/esm2_t6_8M_UR50D',
    });
  });
});

describe('Ariadne tool catalog', () => {
  it('publishes bounded nomination schemas and MCP safety annotations', () => {
    expect(ARIADNE_TOOLS).toHaveLength(21);
    expect(new Set(ARIADNE_TOOLS.map((tool) => tool.name)).size).toBe(21);

    const discover = ARIADNE_TOOLS.find((tool) => tool.name === 'ariadne_discover');
    const audit = ARIADNE_TOOLS.find((tool) => tool.name === 'ariadne_audit_nomination');
    const score = ARIADNE_TOOLS.find((tool) => tool.name === 'ariadne_score_candidates');
    const classify = ARIADNE_TOOLS.find((tool) => tool.name === 'ariadne_classify');
    const pipeline = ARIADNE_TOOLS.find((tool) => tool.name === 'ariadne_pipeline_run');
    expect(discover?.inputSchema['proteins']).toBeDefined();
    expect(audit?.inputSchema['nominationFile']).toBeDefined();
    expect(score?.inputSchema['ceessThreshold']?.safeParse(1.5).success).toBe(false);
    expect(classify?.inputSchema['topK']?.safeParse(21).success).toBe(false);
    expect(pipeline?.inputSchema['requestFile']).toBeDefined();
    expect(ariadneToolAnnotations('ariadne_catalog')).toMatchObject({
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    });
    expect(ariadneToolAnnotations('ariadne_status')).toMatchObject({
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    });
    expect(ariadneToolAnnotations('ariadne_build_hmm')).toMatchObject({
      readOnlyHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
    expect(ariadneToolAnnotations('ariadne_audit_nomination')).toMatchObject({
      readOnlyHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
    expect(ariadneToolAnnotations('ariadne_job_manifest').readOnlyHint).toBe(true);
    expect(ariadneToolAnnotations('ariadne_job_cancel').destructiveHint).toBe(true);
    expect(ariadneToolAnnotations('ariadne_discover').idempotentHint).toBe(false);
    expect(ariadneToolAnnotations('ariadne_research_status')).toMatchObject({
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    });
    expect(ariadneToolAnnotations('ariadne_research_list').readOnlyHint).toBe(true);
    expect(discover?.strictInput).toBeUndefined();
    expect(ARIADNE_TOOLS.filter((tool) => tool.name.startsWith('ariadne_research_'))).toHaveLength(6);
    for (const tool of ARIADNE_TOOLS.filter((item) => item.name.startsWith('ariadne_research_'))) {
      expect(tool.strictInput).toBe(true);
    }
    for (const name of ['create', 'advance', 'respond', 'cancel']) {
      expect(ariadneToolAnnotations(`ariadne_research_${name}`).readOnlyHint).toBe(false);
    }
  });

  it('fails input preflight before launching a job with a missing request file', async () => {
    const root = makeTempDir();
    const workDir = path.join(root, 'work');
    const jobsRoot = path.join(root, 'jobs');
    mkdirSync(workDir);
    const pipeline = ARIADNE_TOOLS.find((tool) => tool.name === 'ariadne_pipeline_run');
    if (pipeline === undefined) throw new Error('pipeline tool is missing');

    const result = await pipeline.run(
      { requestFile: 'missing-request.json' },
      {
        jobsRoot,
        env: {
          ARIADNE_COMMAND: JSON.stringify([process.execPath, '-e', 'process.exit(0)']),
          ARIADNE_WORKDIR: workDir,
        },
      },
    );

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Input preflight failed');
    expect(listJobs(jobsRoot)).toEqual([]);
  });

  it('preserves separate results and manifests for simultaneous comparison branches', async () => {
    const root = makeTempDir();
    const jobsRoot = path.join(root, 'jobs');
    const backendScript = path.join(root, 'comparison-backend.mjs');
    writeFileSync(
      backendScript,
      [
        'import fs from "node:fs";',
        'import path from "node:path";',
        'const args = process.argv.slice(2);',
        'const outputIndex = args.indexOf("--output");',
        'if (outputIndex >= 0) {',
        '  fs.mkdirSync(path.dirname(args[outputIndex + 1]), { recursive: true });',
        '  fs.writeFileSync(args[outputIndex + 1], JSON.stringify({ ok: true }));',
        '} else console.log(args.includes("--version") ? "fixture-backend" : "{}");',
      ].join('\n'),
    );
    const pipeline = ARIADNE_TOOLS.find((tool) => tool.name === 'ariadne_pipeline_run');
    if (pipeline === undefined) throw new Error('pipeline tool is missing');
    mkdirSync(path.join(root, 'references'), { recursive: true });
    writeFileSync(path.join(root, 'proteins.faa'), '>seq\nMKV\n');
    writeFileSync(path.join(root, 'query.hmm'), 'HMMER3/f\n');
    writeFileSync(path.join(root, 'references', 'coral.afa'), '>ref\nMKV\n');
    for (const branch of ['baseline-class', 'comparison-class']) {
      writeFileSync(path.join(root, `${branch}.json`), JSON.stringify({
        target_class: branch,
        input_proteins: ['proteins.faa'],
        query_hmm: 'query.hmm',
        reference_dir: 'references',
      }));
    }
    const clock = vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-11-02T00:00:00.000Z');
    try {
      const results = await Promise.all(
        ['baseline-class', 'comparison-class'].map((branch) =>
          pipeline.run(
            { requestFile: `${branch}.json`, wait: true, waitTimeoutMs: 10_000 },
            {
              jobsRoot,
              env: {
                ARIADNE_COMMAND: JSON.stringify([process.execPath, backendScript]),
                ARIADNE_WORKDIR: root,
              },
            },
          ),
        ),
      );
      const jobs = results.map((result) => {
        expect(result.isError, JSON.stringify(result.content[0]?.text ?? '').slice(0, 500)).not.toBe(true);
        return (JSON.parse(result.content[0].text) as {
          job: { jobId: string; status: string; configuredOutput: string };
        }).job;
      });
      expect(jobs[0]?.configuredOutput).not.toBe(jobs[1]?.configuredOutput);
      for (const job of jobs) {
        expect(job.status).toBe('succeeded');
        const outputText = readFileSync(job.configuredOutput, 'utf8');
        expect(JSON.parse(outputText)).toEqual({ ok: true });
        const manifest = readJobRunManifest(jobsRoot, job.jobId)?.manifest;
        expect(manifest?.configuredOutput).toBe(job.configuredOutput);
        expect(manifest?.result?.output.sha256).toBe(
          createHash('sha256').update(outputText).digest('hex'),
        );
      }
    } finally {
      clock.mockRestore();
    }
  }, 15_000);
});

describe('background jobs', () => {
  it('continues to read schema-version-1 engineering manifests', () => {
    const root = makeTempDir();
    const workDir = path.join(root, 'work');
    const filePath = path.join(root, 'run-manifest.json');
    const fingerprintPayload = {
      schemaVersion: 1,
      toolName: 'ariadne_discover',
      operation: 'discover',
      backend: { source: 'configured-command', command: ['ariadne'] },
      command: ['ariadne', 'discover'],
      workDir,
      configuredOutput: null,
      requestedParameters: {},
      inputs: [],
      payloads: [],
    };
    const manifest = {
      schemaVersion: 1,
      kind: 'ariadne.engineering-run',
      jobId: 'job_20200101000000_abcdef',
      createdAt: '2020-01-01T00:00:00.000Z',
      toolName: 'ariadne_discover',
      operation: 'discover',
      workDir,
      command: ['ariadne', 'discover'],
      backend: { source: 'configured-command', command: ['ariadne'] },
      runtime: {
        harnessVersion: '0.1.0',
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
      },
      parameters: {
        resolution: 'requested-only',
        values: {},
        note: 'legacy manifest fixture',
      },
      inputs: [],
      payloads: [],
      inputIntegrityComplete: true,
      requestSha256: createHash('sha256')
        .update(canonicalJsonForTest(fingerprintPayload))
        .digest('hex'),
    };
    writeFileSync(filePath, JSON.stringify(manifest));

    expect(readEngineeringRunManifest(filePath)).toMatchObject({
      manifest: { schemaVersion: 1, requestSha256: manifest.requestSha256 },
    });
  });

  it('persists engineering request provenance with content fingerprints', async () => {
    const root = makeTempDir();
    const workDir = path.join(root, 'work');
    const jobsRoot = path.join(root, 'jobs');
    const proteinsPath = path.join(workDir, 'proteins.faa');
    const hmmPath = path.join(workDir, 'query.hmm');
    mkdirSync(workDir);
    writeFileSync(proteinsPath, '>seq\nMKV\n');
    writeFileSync(hmmPath, 'HMMER3/f\n');
    const discover = ARIADNE_TOOLS.find((tool) => tool.name === 'ariadne_discover');
    if (discover === undefined) throw new Error('discover tool is missing');

    const launched = await discover.run(
      {
        proteins: ['proteins.faa'],
        hmm: 'query.hmm',
        output: 'discovery.json',
        wait: false,
      },
      {
        jobsRoot,
        env: {
          ARIADNE_COMMAND: JSON.stringify([
            process.execPath,
            '-e',
            [
              'const fs = require("node:fs")',
              'const index = process.argv.indexOf("--output")',
              'if (index >= 0) fs.writeFileSync(process.argv[index + 1], "{\\"ok\\":true}\\n")',
              'else if (process.argv.includes("identity")) process.stdout.write(JSON.stringify({ adapter_version: "1.0.0", engines: { hmm: { available: true, api_key: "must-not-persist" } }, defaults: { top_k: 5 } }))',
              'else process.stdout.write(process.version)',
            ].join(';'),
          ]),
          ARIADNE_WORKDIR: workDir,
          ARIADNE_ESM_MODEL: 'environment/esm',
        },
      },
    );
    const content = launched.content[0];
    if (content === undefined) throw new Error('discover tool returned no content');
    const payload = JSON.parse(content.text) as { job: { jobId: string } };
    const jobId = payload.job.jobId;
    const finished = await waitForJob(jobsRoot, jobId, 10_000, 20);
    expect(finished?.status).toBe('succeeded');

    const engineering = readJobRunManifest(jobsRoot, jobId);
    expect(engineering?.error).toBeUndefined();
    expect(engineering?.manifest).toMatchObject({
      schemaVersion: 2,
      kind: 'ariadne.engineering-run',
      jobId,
      toolName: 'ariadne_discover',
      operation: 'discover',
      configuredOutput: path.join(workDir, 'discovery.json'),
      inputIntegrityComplete: true,
    });
    expect(engineering?.manifest?.backend.version).toBe(process.version);
    expect(engineering?.manifest?.parameters.resolution).toBe('requested-only');
    expect(engineering?.manifest?.parameters.values['wait']).toBeUndefined();
    expect(engineering?.manifest?.scientificConfiguration?.values).toMatchObject({
      adapterReported: {
        adapter_version: '1.0.0',
        engines: { hmm: { available: true } },
        defaults: { top_k: 5 },
      },
      environmentOverrides: {
        ARIADNE_ESM_MODEL: 'environment/esm',
      },
    });
    expect(JSON.stringify(engineering?.manifest?.scientificConfiguration)).not.toContain(
      'must-not-persist',
    );
    const proteinInput = engineering?.manifest?.inputs.find(
      (input) => input.role === 'protein-input[0]',
    );
    expect(proteinInput).toMatchObject({
      path: proteinsPath,
      kind: 'file',
      sizeBytes: Buffer.byteLength('>seq\nMKV\n'),
    });
    expect(proteinInput?.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(
      engineering?.manifest?.inputs.find((input) => input.role === 'query-hmm')?.path,
    ).toBe(hmmPath);
    expect(engineering?.manifest?.requestSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(engineering?.manifest?.result).toMatchObject({
      output: {
        role: 'configured-output',
        path: path.join(workDir, 'discovery.json'),
        kind: 'file',
      },
    });
    expect(engineering?.manifest?.result?.output.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(engineering?.manifest?.result?.resultSha256).toMatch(/^[a-f0-9]{64}$/);

    const manifestTool = ARIADNE_TOOLS.find(
      (tool) => tool.name === 'ariadne_job_manifest',
    );
    if (manifestTool === undefined) throw new Error('job manifest tool is missing');
    const inspected = await manifestTool.run({ jobId }, { jobsRoot, env: {} });
    const inspectedContent = inspected.content[0];
    if (inspectedContent === undefined) throw new Error('manifest tool returned no content');
    expect(JSON.parse(inspectedContent.text)).toMatchObject({
      engineeringRun: {
        jobId,
        inputIntegrityComplete: true,
        result: { output: { kind: 'file' } },
      },
      artifacts: { exists: true },
    });

    const manifestPath = path.join(finished!.dir, 'run-manifest.json');
    if (process.platform !== 'win32') {
      expect(lstatSync(manifestPath).mode & 0o077).toBe(0);
    }
    const original = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
    const configurationTampered = structuredClone(original);
    const scientificConfiguration = configurationTampered[
      'scientificConfiguration'
    ] as Record<string, unknown>;
    const scientificValues = scientificConfiguration['values'] as Record<string, unknown>;
    scientificValues['environmentOverrides'] = { ARIADNE_PLANNER_MODEL: 'tampered' };
    writeFileSync(manifestPath, JSON.stringify(configurationTampered));
    expect(readJobRunManifest(jobsRoot, jobId)?.error).toMatch(/fingerprint/);

    const resultTampered = structuredClone(original);
    const result = resultTampered['result'] as Record<string, unknown>;
    const resultOutput = result['output'] as Record<string, unknown>;
    resultOutput['sha256'] = '0'.repeat(64);
    writeFileSync(manifestPath, JSON.stringify(resultTampered));
    expect(readJobRunManifest(jobsRoot, jobId)?.error).toMatch(/schema/);

    const tampered = structuredClone(original);
    tampered['operation'] = 'tampered';
    writeFileSync(manifestPath, JSON.stringify(tampered));
    expect(readJobRunManifest(jobsRoot, jobId)?.error).toMatch(/fingerprint/);
    expect((await manifestTool.run({ jobId }, { jobsRoot, env: {} })).isError).toBe(true);
  }, 15_000);

  it('recursively fingerprints reference directories for comparable classifications', async () => {
    const root = makeTempDir();
    const workDir = path.join(root, 'work');
    const jobsRoot = path.join(root, 'jobs');
    const referenceDir = path.join(workDir, 'references');
    const coralDir = path.join(referenceDir, 'coral');
    const candidates = path.join(workDir, 'candidates.faa');
    mkdirSync(coralDir, { recursive: true });
    writeFileSync(path.join(coralDir, 'coral.afa'), '>ref\nMKV\n');
    writeFileSync(candidates, '>seq\nMKV\n');
    const classify = ARIADNE_TOOLS.find(
      (tool) => tool.name === 'ariadne_classify',
    );
    if (classify === undefined) throw new Error('classify tool is missing');
    const ctx = {
      jobsRoot,
      env: {
        ARIADNE_COMMAND: JSON.stringify([
          process.execPath,
          '-e',
          'process.stdout.write("{}")',
        ]),
        ARIADNE_WORKDIR: workDir,
      },
    };

    const firstLaunch = await classify.run(
      {
        candidates: 'candidates.faa',
        referenceDir: 'references',
        output: 'first.json',
      },
      ctx,
    );
    const firstContent = firstLaunch.content[0];
    if (firstContent === undefined) throw new Error('first classification returned no content');
    const firstPayload = JSON.parse(firstContent.text) as { job: { jobId: string } };
    await waitForJob(jobsRoot, firstPayload.job.jobId, 10_000, 20);
    const first = readJobRunManifest(jobsRoot, firstPayload.job.jobId)?.manifest;
    const firstReference = first?.inputs.find((input) => input.role === 'reference-library');
    expect(first?.inputIntegrityComplete).toBe(true);
    expect(firstReference).toMatchObject({
      kind: 'directory',
      entryCount: 2,
      fileCount: 1,
      integrityComplete: true,
      truncated: false,
    });
    expect(firstReference?.sha256).toMatch(/^[a-f0-9]{64}$/);

    writeFileSync(path.join(coralDir, 'coral.afa'), '>ref\nMKVL\n');
    const secondLaunch = await classify.run(
      {
        candidates: 'candidates.faa',
        referenceDir: 'references',
        output: 'second.json',
      },
      ctx,
    );
    const secondContent = secondLaunch.content[0];
    if (secondContent === undefined) throw new Error('second classification returned no content');
    const secondPayload = JSON.parse(secondContent.text) as { job: { jobId: string } };
    await waitForJob(jobsRoot, secondPayload.job.jobId, 10_000, 20);
    const second = readJobRunManifest(jobsRoot, secondPayload.job.jobId)?.manifest;
    const secondReference = second?.inputs.find((input) => input.role === 'reference-library');
    expect(secondReference?.sha256).not.toBe(firstReference?.sha256);
    expect(second?.requestSha256).not.toBe(first?.requestSha256);
  }, 15_000);

  it('runs through the detached runner and exposes bounded, cursor-based log views', async () => {
    const root = makeTempDir();
    const workDir = path.join(root, 'work');
    const jobsRoot = path.join(root, 'jobs');
    const output = 'started\nnoise\nERROR exploded\ncompleted\n';
    mkdirSync(workDir);

    const started = startJob(
      jobsRoot,
      [process.execPath, '-e', `process.stdout.write(${JSON.stringify(output)})`],
      { workDir, label: 'test-run' },
    );
    const finished = await waitForJob(jobsRoot, started.id, 10_000, 20);

    expect(finished?.status).toBe('succeeded');
    expect(finished?.finishedAt).toBeTruthy();
    expect(finished?.durationMs).toBeGreaterThanOrEqual(0);
    expect(jobLog(jobsRoot, started.id, 10)).toMatch(/completed\n$/);

    const first = readJobLog(jobsRoot, started.id, {
      cursor: 0,
      maxBytes: 1_000,
      maxLines: 2,
    });
    expect(first?.text).toBe('started\nnoise\n');
    expect(first?.nextCursor).toBe(Buffer.byteLength('started\nnoise\n'));

    const second = readJobLog(jobsRoot, started.id, {
      cursor: first?.nextCursor,
      maxBytes: 1_000,
      maxLines: 2,
    });
    expect(second?.text).toBe('ERROR exploded\ncompleted\n');
    expect(second?.nextCursor).toBeUndefined();

    const errors = readJobLog(jobsRoot, started.id, {
      cursor: 0,
      maxBytes: 1_000,
      view: 'errors',
    });
    expect(errors?.text).toBe('ERROR exploded\n');
    expect(errors?.matchedLines).toBe(1);

    // Negative security checks: the job store must reject ids that escape its
    // root (built with path.join so the traversal intent stays auditable).
    expect(getJob(jobsRoot, path.join('..', 'job_20200101000000_abcdef'))).toBeUndefined();
    expect(readJobLog(jobsRoot, path.join('..', '..', 'etc', 'passwd'))).toBeUndefined();
    if (process.platform !== 'win32') {
      if (finished === undefined) throw new Error('job snapshot missing after completion');
      expect(lstatSync(finished.dir).mode & 0o077).toBe(0);
      const outside = path.join(root, 'outside');
      const symlinkId = 'job_20200101000000_abcdef';
      mkdirSync(outside);
      writeFileSync(
        path.join(outside, 'job.json'),
        JSON.stringify({
          id: symlinkId,
          command: ['echo', 'unsafe'],
          workDir,
          pid: -1,
          startedAt: new Date().toISOString(),
        }),
      );
      symlinkSync(outside, path.join(jobsRoot, symlinkId), 'dir');
      expect(getJob(jobsRoot, symlinkId)).toBeUndefined();
    }
  }, 15_000);

  it('recovers recent jobs and lists bounded output metadata without following links', async () => {
    const root = makeTempDir();
    const workDir = path.join(root, 'work');
    const jobsRoot = path.join(root, 'jobs');
    const outputDir = path.join(workDir, 'results');
    mkdirSync(workDir);
    const script = [
      'const fs = require("node:fs")',
      `fs.mkdirSync(${JSON.stringify(outputDir)}, { recursive: true })`,
      `fs.writeFileSync(${JSON.stringify(path.join(outputDir, 'result.txt'))}, "result")`,
    ].join(';');

    const started = startJob(
      jobsRoot,
      [process.execPath, '-e', script, '--', '--output', outputDir],
      { workDir, label: 'artifacts' },
    );
    const finished = await waitForJob(jobsRoot, started.id, 10_000, 20);
    expect(finished?.status).toBe('succeeded');
    expect(listJobs(jobsRoot)[0]?.id).toBe(started.id);

    if (process.platform !== 'win32') {
      const external = path.join(root, 'external-secret.txt');
      writeFileSync(external, 'do not read');
      symlinkSync(external, path.join(outputDir, 'external-link'));
    }
    const listing = listJobArtifacts(jobsRoot, started.id, { maxEntries: 10 });
    expect(listing?.root).toBe(outputDir);
    expect(
      configuredJobOutput({
        ...started,
        command: ['ariadne', '--output', 'first', '--output=last'],
      }),
    ).toBe(path.join(workDir, 'last'));
    expect(listing?.entries.some((entry) => entry.relativePath === 'result.txt')).toBe(true);
    if (process.platform !== 'win32') {
      expect(
        listing?.entries.find((entry) => entry.relativePath === 'external-link')?.type,
      ).toBe('symlink');
    }
    expect(listJobArtifacts(jobsRoot, started.id, { maxEntries: 1 })?.truncated).toBe(
      process.platform !== 'win32',
    );
  }, 15_000);

  it('refuses to cancel an unrelated process referenced by a stale job record', async () => {
    const root = makeTempDir();
    const jobsRoot = path.join(root, 'jobs');
    const jobId = 'job_20200101000000_deadbeef';
    const jobDir = path.join(jobsRoot, jobId);
    mkdirSync(jobDir, { recursive: true });
    writeFileSync(
      path.join(jobDir, 'job.json'),
      JSON.stringify({
        id: jobId,
        command: ['ariadne', 'discover'],
        workDir: root,
        pid: process.pid,
        startedAt: new Date().toISOString(),
      }),
    );

    await expect(cancelJob(jobsRoot, jobId)).rejects.toThrow(/no longer matches this job/);
  });

  it('cancels a process tree with a bounded graceful-to-forceful shutdown', async () => {
    const root = makeTempDir();
    const workDir = path.join(root, 'work');
    const jobsRoot = path.join(root, 'jobs');
    mkdirSync(workDir);
    const started = startJob(
      jobsRoot,
      [process.execPath, '-e', 'setInterval(() => {}, 1000)'],
      { workDir, label: 'cancel-test' },
    );

    const cancelled = await cancelJob(jobsRoot, started.id);
    expect(cancelled?.status).toBe('cancelled');
    expect(getJob(jobsRoot, started.id)?.status).toBe('cancelled');
  }, 15_000);
});

function canonicalJsonForTest(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJsonForTest(entry)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .toSorted(([left], [right]) => left.localeCompare(right));
  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJsonForTest(entry)}`)
    .join(',')}}`;
}

function makeTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'ariadne-harness-test-'));
  tempDirs.push(dir);
  return dir;
}
