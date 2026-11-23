import path from 'node:path';
import process from 'node:process';
import { createInterface, type Interface } from 'node:readline';

import type { KimiHarness, Session } from '@moonshot-ai/kimi-code-sdk';

import { ASCII_LOGO } from './banner';
import { CliArgumentError, TELEMETRY_DISABLE_FLAG, parseCliInvocation } from './cli-args';
import { formatDoctorReport, runConfigShow, runDoctor } from './doctor';
import {
  attachAriadneTools,
  createDefaultSession,
  createAriadneHarness,
  ensureAriadneSkillDirs,
  promptTurnToEnd,
  resolveAriadneHome,
} from './harness';
import { runOnboard, runReset } from './onboard';
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

const EXIT_CODES = `Exit codes:
  0  the command completed
  1  arguments were rejected, a required check failed, or setup is incomplete
  130  interrupted with Ctrl+C during run/chat
`;

const COMMAND_USAGE: Readonly<Record<string, string>> = {
  run: `ariadnebuddy run [options] "<prompt>"
  One-shot mode: create a session, send one prompt, stream the reply, exit.

  Flags:
    --home DIR            AriadneBuddy home directory (config.toml, mcp.json)
    --model NAME          override the configured default model alias
    --workdir DIR         working directory for the session and research jobs
    --permission MODE     session permission mode: auto | manual | yolo
    --quiet               assistant text only on stdout; progress on stderr
    --json                one structured JSON envelope on stdout
    --help                print this help

  Examples:
    ariadnebuddy run "summarize the arsenic case"
    ariadnebuddy run --quiet --json "nominate cembrene-class TPS candidates"
    ariadnebuddy run --model zai/glm-4.6 --workdir ~/aqua-work "review this draft"

${EXIT_CODES}`,
  chat: `ariadnebuddy chat [options]
  Interactive REPL with one persistent session; type "quit" (or Ctrl+C / stdin EOF) to exit.

  Flags:
    --home DIR            AriadneBuddy home directory (config.toml, mcp.json)
    --model NAME          override the configured default model alias
    --workdir DIR         working directory for the session and research jobs
    --permission MODE     session permission mode: auto | manual | yolo
    --help                print this help

  Examples:
    ariadnebuddy chat
    ariadnebuddy chat --home ~/.ariadne --workdir ~/aqua-work

${EXIT_CODES}`,
  tui: `ariadnebuddy tui
  Launch the interactive workbench (full TUI). Same as running ariadnebuddy with no command.

  Flags:
    --help                print this help

  Examples:
    ariadnebuddy tui

${EXIT_CODES}`,
  web: `ariadnebuddy web [options]
  Start the AriadneBuddy web server plus the branded Web UI.

  Flags:
    --port N              listen port (0 picks a free port; default 58627)
    --host H              bind address (default 127.0.0.1)
    --no-open             do not open a browser
    --home DIR            AriadneBuddy home directory (config.toml, mcp.json)
    --help                print this help

  Examples:
    ariadnebuddy web --no-open --port 0
    ariadnebuddy web --host 0.0.0.0 --no-open

${EXIT_CODES}`,
  doctor: `ariadnebuddy doctor [options]
  Check Node, storage, model configuration, provider transport, backend health,
  MCP, Web assets, skills, and private permissions.

  Flags:
    --json                emit the report as JSON (checks plus passed/failed/warned counts)
    --probe               run \`health --json\` against the configured Ariadne backend
    --probe-model         make a minimal round-trip against the configured model provider
    --home DIR            AriadneBuddy home directory to inspect
    --help                print this help

  Examples:
    ariadnebuddy doctor
    ariadnebuddy doctor --probe --probe-model
    ariadnebuddy doctor --json --home ~/.ariadne

${EXIT_CODES}`,
  onboard: `ariadnebuddy onboard [options]
  Guided first-run setup: home directory, credential import, model provider
  (API key, no login required), backend detection, MCP and skills.

  Flags:
    --yes                 non-interactive; accept defaults without prompting
    --home DIR            AriadneBuddy home directory to create or reuse
    --ariadne-command C   adapter-compatible backend command (JSON array or quoted string)
    --ariadne-repo DIR    Ariadne engine checkout with a Python environment
    --import-from DIR     copy config + credentials from another home
    --provider ID         kimi-coding | zai | deepseek | custom
    --api-key KEY         API key written into config.toml (visible; prefer --api-key-env)
    --api-key-env VAR     environment variable holding the API key
    --model NAME          model id for a custom provider
    --base-url URL        base URL for a custom provider (https, or loopback http)
    --provider-type TYPE  anthropic | openai | kimi | google-genai | openai_responses | vertexai
    --help                print this help

  Examples:
    ariadnebuddy onboard --yes --home ~/.ariadne
    ariadnebuddy onboard --provider deepseek --api-key-env DEEPSEEK_API_KEY
    ariadnebuddy onboard --provider custom --base-url https://host/v1 --model my-model --api-key-env LAB_API_KEY
    ariadnebuddy onboard --ariadne-repo ~/Ariadne

${EXIT_CODES}`,
  tools: `ariadnebuddy tools [options]
  List the Ariadne engine, retrieval, nomination, and durable-job tools exposed to the agent.

  Flags:
    --json                emit the tool catalog as JSON
    --home DIR            AriadneBuddy home directory
    --help                print this help

  Examples:
    ariadnebuddy tools
    ariadnebuddy tools --json

${EXIT_CODES}`,
  research: `ariadnebuddy research <action> [options]
  Model-free control of a durable scientific-discovery task. Every action reads
  or writes JSON validated against the matching research MCP tool schema.

  Actions and flags:
    create    --input FILE                 schema: ariadne_research_create
    status    --id ID                      schema: ariadne_research_status
    list                                    schema: ariadne_research_list
    advance   --id ID [--expected-version N]  schema: ariadne_research_advance
    respond   --input FILE                 schema: ariadne_research_respond
    cancel    --input FILE                 schema: ariadne_research_cancel
    --home DIR                            AriadneBuddy home directory
    --help                                print this help

  Examples (one per action; JSON validated against the named schema):
    ariadnebuddy research create --input request.json
      {"requestId":"case-1","objective":"Nominate cembrene-class TPS","requestFile":"nomination-request.json","maxJobs":4}
    ariadnebuddy research status --id research_0123456789abcdef01234567
    ariadnebuddy research list
    ariadnebuddy research advance --id research_0123456789abcdef01234567
    ariadnebuddy research respond --input respond.json
      {"taskId":"research_0123456789abcdef01234567","attentionId":"attention-1","expectedVersion":3,"action":"submit_stage","artifactFile":"stage.json","reason":"Literature deposited"}
    ariadnebuddy research cancel --input cancel.json
      {"taskId":"research_0123456789abcdef01234567","expectedVersion":4,"reason":"Scope changed"}

  JSON input files: relative paths resolve from ARIADNE_WORKDIR, must be regular
  files (no symbolic links) of at most 64 KiB. Creation starts no backend work.

${EXIT_CODES}`,
  info: `ariadnebuddy info [options]
  Print version and resolved paths.

  Flags:
    --home DIR            AriadneBuddy home directory
    --help                print this help

  Examples:
    ariadnebuddy info
    ariadnebuddy info --home ~/.ariadne

${EXIT_CODES}`,
  config: `ariadnebuddy config show [options]
  Print the effective provider, default model, backend, skill directories, and
  MCP registration without running the full doctor.

  Flags:
    --json                emit the configuration as JSON
    --home DIR            AriadneBuddy home directory
    --help                print this help

  Examples:
    ariadnebuddy config show
    ariadnebuddy config show --json --home ~/.ariadne

${EXIT_CODES}`,
  reset: `ariadnebuddy reset [options]
  Remove the AriadneBuddy home directory, strip the ariadne server entry from
  mcp.json, clear the Ariadne skills directory from the engine's extraSkillDirs,
  and delete research job storage unless --keep-jobs is given.

  Flags:
    --home DIR            AriadneBuddy home directory to remove
    --keep-jobs           keep the research job storage directory
    --yes                 confirm the destructive removal (required)
    --help                print this help

  Without --yes nothing is removed: the command prints the deletion plan and exits 1.

  Examples:
    ariadnebuddy reset --home ~/.ariadne --yes
    ariadnebuddy reset --home ~/.ariadne --keep-jobs --yes

${EXIT_CODES}`,
};

const USAGE = `AriadneBuddy — a multi-agent scientific-discovery workbench for natural-product genome mining,
powered by the Ariadne deterministic engines (HMM retrieval · ESM2 semantic scoring · feature-space
structure retrieval) on the Kimi Code engine

Usage:
  ariadnebuddy                     launch the interactive workbench (full TUI)
  ariadnebuddy run "<prompt>"      one-shot mode: create a session, send one prompt,
                                      stream the reply to stdout, exit
  ariadnebuddy chat                interactive REPL with one persistent session;
                                      type "quit" (or press Ctrl+C / stdin EOF) to exit
  ariadnebuddy tui                 launch the interactive workbench explicitly
  ariadnebuddy web [options]       start the AriadneBuddy web server + UI
                                      [--port N] [--host H] [--no-open] [--home DIR]
  ariadnebuddy doctor [options]    check the installation
                                      [--json] [--probe] [--probe-model] [--home DIR]
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
  ariadnebuddy config show         print the effective provider, model, backend,
                    [--json]       skill dirs, and MCP registration
                    [--home DIR]
  ariadnebuddy reset               remove the home directory, MCP entry, skill
                    [--home DIR]   registration, and job storage
                    [--keep-jobs]  (--yes is required before anything is deleted)
                    [--yes]
  ariadnebuddy info [--home DIR]   version + paths
  ariadnebuddy --version           print version
  ariadnebuddy <command> --help    print that command's help

Global flags:
  --no-telemetry                  set KIMI_DISABLE_TELEMETRY=1 for the run/chat/web harness

Environment:
  ARIADNE_HOME      AriadneBuddy data directory (config.toml, credentials, mcp.json).
                    Defaults to ~/.ariadne.
  ARIADNE_COMMAND   JSON array overriding the adapter-compatible backend command.
  ARIADNE_REPO      Ariadne engine checkout (ariadne-tps) with a Python environment.
  ARIADNE_PYTHON    Optional Python interpreter for that checkout.
  ARIADNE_WORKDIR   Default working directory for research jobs.
  ARIADNE_JOBS_DIR  Where job records + logs live (default: <workdir>/ariadne-jobs).
  ARIADNE_AFPK_PYTHON  Python interpreter with pyhmmer for workflow afpk-ks.
  ARIADNE_AFPK_FINDER_REPO  Original AFPK-finder v1.0 checkout for direct runs.
  ARIADNE_AFPK_FINDER_BIN   Optional bin directory with the original tool dependencies.
  ARIADNE_ESM_MODEL Optional ESM2 model override for semantic scoring.
  KIMI_DISABLE_TELEMETRY  Set to 1 to disable engine telemetry (also enabled by --no-telemetry).

${EXIT_CODES}`;

function usageFor(argv: readonly string[]): string {
  const [command, subcommand] = argv;
  if (command === undefined || command.startsWith('-')) return USAGE;
  const topic = subcommand !== undefined && !subcommand.startsWith('-')
    ? `${command} ${subcommand}`
    : command;
  return COMMAND_USAGE[topic] ?? COMMAND_USAGE[command] ?? USAGE;
}

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
  if (argv.includes(TELEMETRY_DISABLE_FLAG)) {
    process.env['KIMI_DISABLE_TELEMETRY'] = '1';
  }
  const invocation = parseCliInvocation(argv);

  switch (invocation.kind) {
    case 'run':
      await runOnce(invocation.prompt, invocation);
      return;
    case 'chat':
      await chatRepl(invocation);
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
      return;
    }
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
        probeModel: invocation.probeModel,
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
    case 'config':
      await runConfigShow(invocation.json, invocation.homeDir);
      return;
    case 'reset':
      await runReset(invocation);
      return;
    case 'version':
      process.stdout.write(`${packageVersion()}\n`);
      return;
    case 'help':
      process.stdout.write(usageFor(argv));
      return;
  }
}

interface HarnessLaunchOptions {
  readonly homeDir?: string;
  readonly model?: string;
  readonly workDir?: string;
  readonly permission?: 'auto' | 'manual' | 'yolo';
}

interface RunLaunchOptions extends HarnessLaunchOptions {
  readonly quiet?: boolean;
  readonly json?: boolean;
}

async function openHarness(options: HarnessLaunchOptions = {}): Promise<{ harness: KimiHarness; session: Session }> {
  registerSigintHandler();
  const homeDir = options.homeDir === undefined
    ? resolveAriadneHome()
    : resolveUserPath(options.homeDir);
  const harness = createAriadneHarness(homeDir);
  activeHarness = harness;
  process.stderr.write(ASCII_LOGO);
  await ensureAriadneSkillDirs(harness);
  const session = await createDefaultSession(harness, {
    model: options.model,
    workDir: options.workDir,
    permission: options.permission,
  });
  try {
    await attachAriadneTools(session, homeDir);
  } catch (error: unknown) {
    process.stderr.write(`warning: could not attach Ariadne MCP tools: ${String(error)}\n`);
  }
  return { harness, session };
}

async function runOnce(promptText: string, options: RunLaunchOptions): Promise<void> {
  const { harness, session } = await openHarness(options);
  try {
    process.stderr.write(`session: ${session.id}\n`);
    await promptTurnToEnd(session, promptText, { quiet: options.quiet, json: options.json });
  } finally {
    await closeHarness(harness);
  }
}

async function chatRepl(options: HarnessLaunchOptions = {}): Promise<void> {
  const { harness, session } = await openHarness(options);
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
    process.stderr.write(`\n${usageFor(process.argv.slice(2))}`);
  } else if (
    process.env['ARIADNE_DEBUG'] === '1' &&
    error instanceof Error &&
    error.stack !== undefined
  ) {
    process.stderr.write(`${error.stack}\n`);
  }
  process.exitCode = 1;
}
