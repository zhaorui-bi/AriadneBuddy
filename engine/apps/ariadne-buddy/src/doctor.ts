import { accessSync, constants, existsSync, lstatSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import type { KimiConfig } from '@moonshot-ai/kimi-code-sdk';

import { ASCII_LOGO } from './banner';
import { createAriadneHarness, resolveAriadneHome } from './harness';
import { resolveMcpLaunch } from './mcp/register';
import { defaultWebAssetsDir, packageVersion, resolveUserPath, skillsDir } from './paths';
import { validateProviderBaseUrl } from './providers';
import {
  backendPipelineReady,
  describeBackend,
  probeBackend,
  resolveAriadneBackend,
  summarizeBackendHealth,
} from './ariadne/backend';

export interface DoctorCheck {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
  readonly required: boolean;
  readonly skipped?: boolean;
  readonly fix?: string;
}

export interface DoctorReport {
  readonly version: string;
  readonly homeDir: string;
  readonly checks: readonly DoctorCheck[];
  readonly healthy: boolean;
  readonly counts: {
    readonly passed: number;
    readonly failed: number;
    readonly warned: number;
  };
}

export interface DoctorOptions {
  readonly probe?: boolean;
  readonly probeModel?: boolean;
  readonly homeDir?: string;
}

const MODEL_PROBE_TIMEOUT_MS = 15_000;

interface ResolvedModelProvider {
  readonly name: string;
  readonly baseUrl: string;
  readonly apiKey?: string;
  readonly apiKeyEnv?: string;
}

interface ModelProbeOutcome {
  readonly ok: boolean;
  readonly detail: string;
  readonly fix?: string;
}

export async function runDoctor(options: DoctorOptions): Promise<DoctorReport> {
  const homeDir = resolveUserPath(options.homeDir ?? resolveAriadneHome());
  const checks: DoctorCheck[] = [];

  const nodeOk = nodeVersionAtLeast(24, 15);
  checks.push({
    name: 'node',
    ok: nodeOk,
    detail: `${process.version} (requires >= 24.15)`,
    required: true,
    fix: nodeOk ? undefined : 'install Node.js 24.15 or newer from https://nodejs.org',
  });

  const homeExists = isDirectory(homeDir);
  checks.push({
    name: 'home_dir',
    ok: homeExists,
    detail: homeExists ? homeDir : `${homeDir} (missing — run \`ariadnebuddy onboard\`)`,
    required: true,
    fix: homeExists ? undefined : 'run `ariadnebuddy onboard` to create the AriadneBuddy home',
  });
  checks.push({
    name: 'home_writable',
    ok: homeExists && isReadableAndWritable(homeDir),
    detail: homeExists ? homeDir : 'home directory is missing',
    required: true,
    fix: homeExists ? undefined : 'run `ariadnebuddy onboard` to create the AriadneBuddy home',
  });

  const workDir = resolveUserPath(process.env['ARIADNE_WORKDIR'] ?? process.cwd());
  const workDirOk = isDirectory(workDir) && isReadableAndWritable(workDir);
  checks.push({
    name: 'work_dir',
    ok: workDirOk,
    detail: workDirOk ? workDir : `${workDir} (missing, unreadable, or not writable)`,
    required: true,
    fix: workDirOk ? undefined : 'set ARIADNE_WORKDIR to an existing writable directory',
  });

  const jobsDir = resolveUserPath(
    process.env['ARIADNE_JOBS_DIR'] ?? path.join(workDir, 'ariadne-jobs'),
  );
  const jobsDirOk = writableDirectoryOrParent(jobsDir);
  checks.push({
    name: 'job_storage',
    ok: jobsDirOk,
    detail: jobsDirOk ? jobsDir : `${jobsDir} (no writable parent directory)`,
    required: true,
    fix: jobsDirOk ? undefined : 'point ARIADNE_JOBS_DIR at a writable directory',
  });

  let modelDetail = 'not configured';
  let modelOk = false;
  let configWarnings: readonly string[] = [];
  const providerTransportIssues: string[] = [];
  let modelConfig: ModelConfiguration | undefined;
  if (homeExists) {
    const harness = createAriadneHarness(homeDir);
    try {
      const [config, diagnostics] = await Promise.all([
        harness.getConfig(),
        harness.getConfigDiagnostics(),
      ]);
      if (config.defaultModel !== undefined) {
        modelOk = true;
        modelDetail = config.defaultModel;
      }
      modelConfig = config;
      configWarnings = diagnostics.warnings;
      for (const [name, provider] of Object.entries(config.providers ?? {})) {
        if (provider.baseUrl === undefined) continue;
        try {
          validateProviderBaseUrl(provider.baseUrl);
        } catch (error) {
          providerTransportIssues.push(
            `${name}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    } catch (error: unknown) {
      modelDetail = `failed to read config: ${String(error)}`;
    } finally {
      await harness.close();
    }
  }
  checks.push({
    name: 'default_model',
    ok: modelOk,
    detail: modelDetail,
    required: true,
    fix: modelOk ? undefined : 'run `ariadnebuddy onboard --provider <id> --api-key-env <VAR>`',
  });
  checks.push({
    name: 'config_diagnostics',
    ok: configWarnings.length === 0,
    detail: configWarnings.length === 0 ? 'no warnings' : configWarnings.join('; '),
    required: false,
    fix: configWarnings.length === 0 ? undefined : 'open config.toml and resolve each reported warning',
  });
  checks.push({
    name: 'provider_transport',
    ok: providerTransportIssues.length === 0,
    detail:
      providerTransportIssues.length === 0
        ? 'HTTPS or loopback HTTP'
        : providerTransportIssues.join('; '),
    required: true,
    fix: providerTransportIssues.length === 0
      ? undefined
      : 'use https for remote providers, or a loopback http URL for a local endpoint',
  });

  checks.push(await probeModelCheck(modelConfig, options.probeModel === true));

  let backendDetail = 'not found';
  let backendOk = false;
  try {
    const backend = resolveAriadneBackend(process.env, homeDir);
    backendDetail = describeBackend(backend);
    backendOk = backend !== undefined;
    if (backend !== undefined && options.probe === true) {
      const probe = await probeBackend(backend);
      const ready = backendPipelineReady(probe);
      backendOk = probe.code === 0 && ready !== false;
      const summary = summarizeBackendHealth(probe);
      backendDetail += backendOk
        ? ` — ${summary}`
        : ` — probe failed: ${summary}`;
      if (probe.timedOut) backendDetail += ' (timed out)';
    }
  } catch (error) {
    backendDetail = `invalid backend configuration: ${error instanceof Error ? error.message : String(error)}`;
  }
  checks.push({
    name: 'ariadne_backend',
    ok: backendOk,
    detail:
      backendDetail === 'not found'
        ? 'not found (set ARIADNE_COMMAND / ARIADNE_REPO, or run `ariadnebuddy onboard --ariadne-repo /path/to/Ariadne`)'
        : backendDetail,
    required: true,
    fix: backendOk
      ? undefined
      : backendDetail === 'not found'
        ? 'run `ariadnebuddy onboard --ariadne-repo /path/to/Ariadne` or set ARIADNE_COMMAND'
        : 'fix the backend command, then re-run `ariadnebuddy doctor --probe`',
  });

  let mcpOk = true;
  let mcpDetail = '';
  try {
    const launch = resolveMcpLaunch();
    mcpDetail = `${launch.command} ${launch.args.join(' ')}`;
  } catch (error: unknown) {
    mcpOk = false;
    mcpDetail = String(error);
  }
  checks.push({
    name: 'mcp_server_entry',
    ok: mcpOk,
    detail: mcpDetail,
    required: true,
    fix: mcpOk ? undefined : 'run `npm run build:engine` in the AriadneBuddy repo to build dist/mcp-server.mjs',
  });

  const webAssetsDir = resolveUserPath(
    process.env['ARIADNE_WEB_ASSETS_DIR'] ?? defaultWebAssetsDir(),
  );
  const webOk = existsSync(path.join(webAssetsDir, 'index.html'));
  checks.push({
    name: 'web_ui_assets',
    ok: webOk,
    detail: webOk ? webAssetsDir : `${webAssetsDir} (missing — build/sync apps/kimi-code/dist-web)`,
    required: false,
    fix: webOk ? undefined : 'run `npm run build:engine` or set ARIADNE_WEB_ASSETS_DIR',
  });

  const requiredSkills = ['ariadne/SKILL.md', 'ariadne-campaign/SKILL.md'];
  const missingSkills = requiredSkills.filter(
    (relativePath) => !isRegularFile(path.join(skillsDir(), relativePath)),
  );
  checks.push({
    name: 'skills',
    ok: missingSkills.length === 0,
    detail:
      missingSkills.length === 0
        ? `${skillsDir()} (${String(requiredSkills.length)} skills)`
        : `${skillsDir()} (missing: ${missingSkills.join(', ')})`,
    required: true,
    fix: missingSkills.length === 0
      ? undefined
      : 'reinstall or rebuild the ariadne-buddy package so the skills directory ships with it',
  });

  const insecurePaths = insecurePrivatePaths(homeDir);
  checks.push({
    name: 'private_permissions',
    ok: homeExists && insecurePaths.length === 0,
    detail: !homeExists
      ? `${homeDir} (missing — cannot verify permissions)`
      : insecurePaths.length === 0
        ? 'private home/config permissions'
        : `group/world-accessible: ${insecurePaths.join(', ')}`,
    required: false,
    skipped: !homeExists,
    fix: homeExists && insecurePaths.length === 0
      ? undefined
      : homeExists
        ? 'run `chmod 700 ~/.ariadne && chmod 600 ~/.ariadne/config.toml` (or re-run `ariadnebuddy onboard`)'
        : 'run `ariadnebuddy onboard` to create a private home directory',
  });

  return {
    version: packageVersion(),
    homeDir,
    checks,
    healthy: checks.every((check) => check.skipped === true || check.ok || !check.required),
    counts: {
      passed: checks.filter((check) => check.skipped !== true && check.ok).length,
      failed: checks.filter((check) => check.skipped !== true && !check.ok && check.required).length,
      warned: checks.filter((check) => check.skipped !== true && !check.ok && !check.required).length,
    },
  };
}

type ModelConfiguration = KimiConfig;

async function probeModelCheck(
  config: ModelConfiguration | undefined,
  requested: boolean,
): Promise<DoctorCheck> {
  if (!requested) {
    return {
      name: 'model_probe',
      ok: false,
      detail: 'skipped — pass --probe-model to verify provider connectivity',
      required: false,
      skipped: true,
    };
  }

  const resolved = resolveModelProvider(config);
  if (resolved === undefined) {
    return {
      name: 'model_probe',
      ok: false,
      detail: config?.defaultModel === undefined
        ? 'no default model is configured'
        : `default model ${config.defaultModel} has no provider with a base URL`,
      required: true,
      fix: 'run `ariadnebuddy onboard --provider <id> --api-key-env <VAR>`',
    };
  }

  let baseUrl: string;
  try {
    baseUrl = validateProviderBaseUrl(resolved.baseUrl);
  } catch (error) {
    return {
      name: 'model_probe',
      ok: false,
      detail: `base URL rejected: ${error instanceof Error ? error.message : String(error)}`,
      required: true,
      fix: 'set a https base URL (loopback http is allowed for local endpoints)',
    };
  }

  const key = resolved.apiKey ?? (resolved.apiKeyEnv === undefined
    ? undefined
    : process.env[resolved.apiKeyEnv]);
  if (key === undefined || key === '') {
    return {
      name: 'model_probe',
      ok: false,
      detail: resolved.apiKeyEnv === undefined
        ? `provider ${resolved.name} has no API key configured`
        : `API key environment variable ${resolved.apiKeyEnv} is not set`,
      required: true,
      fix: resolved.apiKeyEnv === undefined
        ? 'run `ariadnebuddy onboard --api-key-env <VAR>` to point at a key variable'
        : `export ${resolved.apiKeyEnv}="..." and re-run \`ariadnebuddy doctor --probe-model\``,
    };
  }

  const outcome = await requestModelRoundTrip(baseUrl, key, config?.defaultModel);
  return {
    name: 'model_probe',
    ok: outcome.ok,
    detail: `${resolved.name} ${baseUrl} — ${outcome.detail}`,
    required: true,
    fix: outcome.fix,
  };
}

function resolveModelProvider(
  config: ModelConfiguration | undefined,
): ResolvedModelProvider | undefined {
  const defaultModel = config?.defaultModel;
  if (defaultModel === undefined) return undefined;
  const alias = config?.models?.[defaultModel];
  const providerName = alias?.provider ?? config?.defaultProvider;
  if (providerName === undefined) return undefined;
  const provider = config?.providers?.[providerName];
  if (provider?.baseUrl === undefined) return undefined;
  return {
    name: providerName,
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    apiKeyEnv: provider.apiKeyEnv,
  };
}

async function requestModelRoundTrip(
  baseUrl: string,
  apiKey: string,
  model: string | undefined,
): Promise<ModelProbeOutcome> {
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/models`;
  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { authorization: `Bearer ${apiKey}`, accept: 'application/json' },
      signal: AbortSignal.timeout(MODEL_PROBE_TIMEOUT_MS),
    });
    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        detail: `authentication rejected (HTTP ${String(response.status)})`,
        fix: 'the provider rejected the configured key — re-run `ariadnebuddy onboard --api-key-env <VAR>`',
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        detail: `unexpected HTTP ${String(response.status)} from ${endpoint}`,
        fix: 'confirm the base URL serves an OpenAI-compatible /models route',
      };
    }
    await response.arrayBuffer();
    return { ok: true, detail: `reachable (HTTP ${String(response.status)})` };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      detail: `unreachable: ${reason}`,
      fix: model === undefined
        ? 'check the base URL, network, and TLS setup, then re-run `ariadnebuddy doctor --probe-model`'
        : `check the base URL and network for ${model}, then re-run \`ariadnebuddy doctor --probe-model\``,
    };
  }
}

export async function runConfigShow(json: boolean, homeDirOption?: string): Promise<void> {
  const homeDir = resolveUserPath(homeDirOption ?? resolveAriadneHome());
  const view = await readConfigView(homeDir);
  if (json) {
    process.stdout.write(`${JSON.stringify(view, null, 2)}\n`);
    return;
  }
  process.stdout.write(
    [
      '',
      `AriadneBuddy ${view.version} — effective configuration`,
      `  home:            ${view.homeDir}`,
      `  default model:   ${view.defaultModel ?? 'not configured'}`,
      `  provider:        ${view.provider ?? 'not configured'}`,
      `  base URL:        ${view.baseUrl ?? 'not configured'}`,
      `  API key:         ${view.apiKeySource}`,
      `  backend:         ${view.backend}`,
      `  skill dirs:      ${view.skillDirs.length === 0 ? 'none' : view.skillDirs.join(', ')}`,
      `  MCP server:      ${view.mcpServer}`,
      `  MCP registered:  ${view.mcpRegistered}`,
      '',
    ].join('\n'),
  );
}

interface ConfigView {
  readonly version: string;
  readonly homeDir: string;
  readonly defaultModel?: string;
  readonly provider?: string;
  readonly baseUrl?: string;
  readonly apiKeySource: string;
  readonly backend: string;
  readonly skillDirs: readonly string[];
  readonly mcpServer: string;
  readonly mcpRegistered: string;
}

async function readConfigView(homeDir: string): Promise<ConfigView> {
  let defaultModel: string | undefined;
  let provider: string | undefined;
  let baseUrl: string | undefined;
  let apiKeySource = 'not configured';
  const skillDirs: string[] = [];
  if (existsSync(homeDir)) {
    const harness = createAriadneHarness(homeDir);
    try {
      const config = await harness.getConfig();
      defaultModel = config.defaultModel;
      const alias = defaultModel === undefined ? undefined : config.models?.[defaultModel];
      const providerName = alias?.provider ?? config.defaultProvider;
      if (providerName !== undefined) {
        provider = providerName;
        baseUrl = config.providers?.[providerName]?.baseUrl;
        const entry = config.providers?.[providerName];
        apiKeySource = entry?.apiKeyEnv !== undefined
          ? `environment variable ${entry.apiKeyEnv}${process.env[entry.apiKeyEnv] === undefined ? ' (not set)' : ' (set)'}`
          : entry?.apiKey !== undefined
            ? 'stored in config.toml'
            : 'not configured';
      }
      skillDirs.push(...(config.extraSkillDirs ?? []));
    } catch (error: unknown) {
      apiKeySource = `config unreadable: ${String(error)}`;
    } finally {
      await harness.close();
    }
  }

  let backend = 'not found';
  try {
    backend = describeBackend(resolveAriadneBackend(process.env, homeDir));
  } catch (error) {
    backend = `invalid backend configuration: ${error instanceof Error ? error.message : String(error)}`;
  }

  let mcpServer = 'not built (run `npm run build:engine`)';
  try {
    const launch = resolveMcpLaunch();
    mcpServer = `${launch.command} ${launch.args.join(' ')}`;
  } catch {
    mcpServer = 'not built (run `npm run build:engine`)';
  }
  const mcpPath = path.join(homeDir, 'mcp.json');
  const mcpRegistered = existsSync(mcpPath) ? mcpPath : 'not registered (run `ariadnebuddy onboard`)';

  return {
    version: packageVersion(),
    homeDir,
    defaultModel,
    provider,
    baseUrl,
    apiKeySource,
    backend,
    skillDirs,
    mcpServer,
    mcpRegistered,
  };
}

function nodeVersionAtLeast(requiredMajor: number, requiredMinor: number): boolean {
  const [major = 0, minor = 0] = process.versions.node
    .split('.')
    .map((part) => Number.parseInt(part, 10));
  return major > requiredMajor || (major === requiredMajor && minor >= requiredMinor);
}

function isDirectory(dir: string): boolean {
  try {
    return statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

function isReadableAndWritable(dir: string): boolean {
  try {
    accessSync(dir, constants.R_OK | constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function isRegularFile(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function writableDirectoryOrParent(directory: string): boolean {
  let candidate = path.resolve(directory);
  for (;;) {
    if (existsSync(candidate)) {
      return isDirectory(candidate) && isReadableAndWritable(candidate);
    }
    const parent = path.dirname(candidate);
    if (parent === candidate) return false;
    candidate = parent;
  }
}

function insecurePrivatePaths(homeDir: string): string[] {
  if (process.platform === 'win32' || !existsSync(homeDir)) return [];
  const candidates = [
    homeDir,
    path.join(homeDir, 'config.toml'),
    path.join(homeDir, 'mcp.json'),
    path.join(homeDir, 'ariadne.json'),
    path.join(homeDir, 'credentials'),
    path.join(homeDir, 'oauth'),
  ];
  return candidates
    .filter((candidate) => {
      try {
        const metadata = lstatSync(candidate);
        return metadata.isSymbolicLink() || (metadata.mode & 0o077) !== 0;
      } catch {
        return false;
      }
    })
    .map((candidate) => path.relative(homeDir, candidate) || '.');
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines = [
    ASCII_LOGO,
    `  AriadneBuddy ${report.version} — doctor`,
    `  home: ${report.homeDir}`,
    '',
  ];
  for (const check of report.checks) {
    const icon = check.skipped === true ? '-' : check.ok ? '✓' : check.required ? '✗' : '⚠';
    lines.push(`  ${icon} ${check.name.padEnd(20)} ${check.detail}`);
    if (!check.ok && check.fix !== undefined) lines.push(`      fix: ${check.fix}`);
  }
  lines.push(
    '',
    `  ${String(report.counts.passed)} passed, ${String(report.counts.failed)} failed, ${String(report.counts.warned)} warned`,
    '',
    report.healthy ? 'All required checks passed.' : 'Some required checks FAILED — see above.',
  );
  return lines.join('\n');
}
