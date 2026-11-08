import path from 'node:path';
import process from 'node:process';
import { createInterface, type Interface } from 'node:readline';

import type { KimiHarness, Session } from '@moonshot-ai/kimi-code-sdk';

import { ASCII_LOGO } from './banner';
import { CliArgumentError, parseCliInvocation } from './cli-args';
import { runDoctor, formatDoctorReport } from './doctor';
import {
  attachAriadneTools,
  createDefaultSession,
  createAriadneHarness,
  ensureAriadneSkillDirs,
  promptTurnToEnd,
  resolveAriadneHome,
} from './harness';
import { runOnboard } from './onboard';
import { runResearchCommand } from './ariadne/research-tools';
import {
  defaultWebAssetsDir,
  findPackageRoot,
  packageVersion,
  resolveUserPath,
  skillsDir,
} from './paths';
import { runWeb } from './server';
import { runToolsList } from './toolsCmd';
import { launchTui } from './tui';

const USAGE = `AriadneBuddy — a multi-agent scientific-discovery workbench for natural-product genome mining,
powered by the Ariadne deterministic engines (HMM retrieval · ESM2 semantic scoring · feature-space
structure retrieval) on the Kimi Code engine

Usage:
  ariadnebuddy                     launch the interactive workbench (full TUI)
  ariadnebuddy run "<prompt>"      one-shot mode: create a session, send one prompt,
                                      stream the reply to stdout, exit
  ariadnebuddy chat                interactive REPL with one persistent session;
                                      type "quit" (or press Ctrl+C / stdin EOF) to exit
  ariadnebuddy web [options]       start the AriadneBuddy web server + UI
                                      [--port N] [--host H] [--no-open] [--home DIR]
  ariadnebuddy doctor [options]    check the installation
                                      [--json] [--probe] [--home DIR]
  ariadnebuddy onboard [options]   guided setup: home dir, credentials import,
                                      [--yes] [--home DIR]       backend detection, MCP + skills
                                      [--ariadne-command COMMAND | --ariadne-repo DIR]
                                      [--import-from DIR]
                                      model provider (API key, no login required):
                                      [--provider kimi-coding|zai|deepseek|custom]
                                      [--api-key KEY | --api-key-env ENV] [--model NAME]
                                      [--base-url URL] [--provider-type TYPE]
  ariadnebuddy tools [--json]      list Ariadne engine, retrieval, nomination,
                                      and durable-job tools exposed to the agent
                    [--home DIR]
  ariadnebuddy research <action>   control a durable scientific-discovery task;
                                      actions: create, status, list, advance, respond, cancel
                                      [--input FILE] [--home DIR]
                                      status/advance: --id ID instead of --input
                                      advance: [--expected-version N]
                                      JSON input uses the matching research MCP schema;
                                      no conversational model is needed for task control
  ariadnebuddy info [--home DIR]   version + paths
  ariadnebuddy --version           print version
  ariadnebuddy <command> --help    print this help

Environment:
  ARIADNE_HOME      AriadneBuddy data directory (config.toml, credentials, mcp.json).
                    Defaults to ~/.ariadne.
  ARIADNE_COMMAND   JSON array overriding the adapter-compatible backend command.
  ARIADNE_REPO      Ariadne engine checkout (ariadne-tps) with a Python environment.
  ARIADNE_PYTHON    Optional Python interpreter for that checkout.
  ARIADNE_WORKDIR   Default working directory for research jobs.
  ARIADNE_JOBS_DIR  Where job records + logs live (default: <cwd>/ariadne-jobs
                    of the MCP server process).
  ARIADNE_ESM_MODEL Optional ESM2 model override for semantic scoring.
`;

let activeHarness: KimiHarness | undefined;

// Registered lazily by the run/chat paths — the TUI path must not get its
// wrapper killed by Ctrl+C (the child handles signals itself).
function registerSigintHandler(): void {
  process.once('SIGINT', () => {
    void (async () => {
      await activeHarness?.close().catch(() => undefined);
      process.exit(130);
    })();
  });
}

async function main(argv: readonly string[]): Promise<void> {
  const invocation = parseCliInvocation(argv);

  switch (invocation.kind) {
    case 'run':
      await runOnce(invocation.prompt);
      return;
    case 'chat':
      await chatRepl();
      return;
    case 'web':
      await runWeb({
        host: invocation.host,
        port: invocation.port,
        noOpen: invocation.noOpen,
        homeDir: invocation.homeDir,
      });
      return;
    case 'doctor': {
      const report = await runDoctor({
        probe: invocation.probe,
        homeDir: invocation.homeDir,
      });
      if (invocation.json) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      } else {
        process.stdout.write(`${formatDoctorReport(report)}\n`);
      }
      if (!report.healthy) process.exitCode = 1;
      return;
    }
    case 'onboard':
      await runOnboard({
        yes: invocation.yes,
        homeDir: invocation.homeDir,
        ariadneCommand: invocation.ariadneCommand,
        ariadneRepo: invocation.ariadneRepo,
        importFrom: invocation.importFrom,
        provider: invocation.provider,
        apiKey: invocation.apiKey,
        apiKeyEnv: invocation.apiKeyEnv,
        model: invocation.model,
        baseUrl: invocation.baseUrl,
        providerType: invocation.providerType,
      });
      return;
    case 'tools':
      runToolsList(invocation.json, invocation.homeDir);
      return;
    case 'research': {
      const env = invocation.homeDir === undefined
        ? process.env
        : { ...process.env, ARIADNE_HOME: invocation.homeDir };
      const homeDir = resolveAriadneHome(env);
      const workDir = resolveUserPath(env['ARIADNE_WORKDIR'] ?? process.cwd());
      const jobsRoot = resolveUserPath(env['ARIADNE_JOBS_DIR'] ?? path.join(workDir, 'ariadne-jobs'));
      const result = await runResearchCommand(invocation.action, {
        inputFile: invocation.inputFile,
        taskId: invocation.taskId,
        expectedVersion: invocation.expectedVersion,
      }, { homeDir, jobsRoot, env });
      for (const item of result.content) process.stdout.write(`${item.text}\n`);
      if (result.isError === true) process.exitCode = 1;
      return;
    }
    case 'info': {
      const env =
        invocation.homeDir === undefined
          ? process.env
          : { ...process.env, ARIADNE_HOME: invocation.homeDir };
      const homeDir = resolveAriadneHome(env);
      const workDir = resolveUserPath(env['ARIADNE_WORKDIR'] ?? process.cwd());
      const jobsDir = resolveUserPath(
        env['ARIADNE_JOBS_DIR'] ?? path.join(workDir, 'ariadne-jobs'),
      );
      process.stdout.write(
        [
          `ariadne-buddy ${packageVersion()}`,
          `package: ${findPackageRoot()}`,
          `home: ${homeDir}`,
          `workdir: ${workDir}`,
          `jobs: ${jobsDir}`,
          `skills: ${skillsDir()}`,
          `web-ui: ${defaultWebAssetsDir()}`,
          '',
        ].join('\n'),
      );
      return;
    }
    case 'version':
      process.stdout.write(`${packageVersion()}\n`);
      return;
    case 'help':
      process.stdout.write(USAGE);
      return;
    case 'tui': {
      const code = await launchTui();
      if (code < 0) {
        process.stderr.write(
          'TUI bundle not built yet — run `npm run build:tui` in the AriadneBuddy repo once. Falling back to plain REPL chat.\n\n',
        );
        await chatRepl();
      } else {
        process.exitCode = code;
      }
    }
  }
}

async function openHarness(): Promise<{ harness: KimiHarness; session: Session }> {
  registerSigintHandler();
  const homeDir = resolveAriadneHome();
  const harness = createAriadneHarness(homeDir);
  activeHarness = harness;
  process.stderr.write(ASCII_LOGO);
  await ensureAriadneSkillDirs(harness);
  const session = await createDefaultSession(harness);
  try {
    await attachAriadneTools(session, homeDir);
  } catch (error: unknown) {
    process.stderr.write(`warning: could not attach Ariadne MCP tools: ${String(error)}\n`);
  }
  return { harness, session };
}

async function runOnce(promptText: string): Promise<void> {
  const { harness, session } = await openHarness();
  try {
    process.stderr.write(`session: ${session.id}\n`);
    await promptTurnToEnd(session, promptText);
  } finally {
    await closeHarness(harness);
  }
}

async function chatRepl(): Promise<void> {
  const { harness, session } = await openHarness();
  let rl: Interface | undefined;
  try {
    process.stderr.write(`chat session: ${session.id} (workDir: ${session.workDir})\n`);

    rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> ',
      terminal: process.stdin.isTTY,
    });
    const promptAgain = (): void => {
      if (rl !== undefined) {
        rl.prompt();
      }
    };
    promptAgain();

    for await (const line of rl) {
      const input = line.trim();
      if (input.length === 0) {
        promptAgain();
        continue;
      }
      if (input === 'quit' || input === 'exit') {
        break;
      }
      try {
        await promptTurnToEnd(session, input);
      } catch (error: unknown) {
        process.stderr.write(`turn failed: ${String(error)}\n`);
      }
      promptAgain();
    }
  } finally {
    rl?.close();
    await closeHarness(harness);
  }
}

async function closeHarness(harness: KimiHarness): Promise<void> {
  await harness.close();
  if (activeHarness === harness) {
    activeHarness = undefined;
  }
}

try {
  await main(process.argv.slice(2));
} catch (error: unknown) {
  process.stderr.write(`error: ${error instanceof Error ? error.message : String(error)}\n`);
  if (error instanceof CliArgumentError) {
    process.stderr.write(`\n${USAGE}`);
  } else if (
    process.env['ARIADNE_DEBUG'] === '1' &&
    error instanceof Error &&
    error.stack !== undefined
  ) {
    process.stderr.write(`${error.stack}\n`);
  }
  process.exitCode = 1;
}
