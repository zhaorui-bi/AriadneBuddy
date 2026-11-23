import {
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { createInterface, type Interface } from 'node:readline';

import { atomicWriteJson } from './fs-utils';
import { createAriadneHarness, ensureAriadneSkillDirs, resolveAriadneHome } from './harness';
import { MCP_SERVER_NAME, ensureAriadneMcpJson } from './mcp/register';
import { resolveUserPath, skillsDir } from './paths';
import { applyApiProvider, PROVIDER_PRESETS } from './providers';
import {
  backendPipelineReady,
  describeBackend,
  findOnPath,
  parseCommand,
  probeBackend,
  repoCommand,
  resolveAriadneBackend,
  summarizeBackendHealth,
  type AriadneBackend,
  type AriadneBackendFileConfig,
} from './ariadne/backend';

export interface OnboardOptions {
  readonly yes?: boolean;
  readonly homeDir?: string;
  readonly ariadneCommand?: string;
  readonly ariadneRepo?: string;
  readonly importFrom?: string;
  readonly provider?: string;
  readonly apiKey?: string;
  readonly apiKeyEnv?: string;
  readonly model?: string;
  readonly baseUrl?: string;
  readonly providerType?: 'anthropic' | 'openai' | 'kimi' | 'google-genai' | 'openai_responses' | 'vertexai';
}

interface BackendSelection {
  readonly backend: AriadneBackend;
  readonly config?: AriadneBackendFileConfig;
}

interface StepReport {
  readonly configured: string[];
  readonly skipped: string[];
  readonly failures: string[];
}

const IMPORT_FILES = ['config.toml', 'credentials', 'oauth', 'tui.toml'];
const ONBOARD_STEPS = 6;

export interface ResetOptions {
  readonly homeDir?: string;
  readonly keepJobs?: boolean;
  readonly yes?: boolean;
}

interface ResetRemoval {
  readonly path: string;
  readonly label: string;
}

interface ResetPlan {
  readonly removals: readonly ResetRemoval[];
  readonly engineHome?: string;
  readonly stripMcpServer: boolean;
  readonly clearSkillDirs: boolean;
}

export async function runOnboard(options: OnboardOptions): Promise<void> {
  const interactive = options.yes !== true && process.stdin.isTTY;
  const rl = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : undefined;
  const report: StepReport = { configured: [], skipped: [], failures: [] };
  try {
    const homeDir = resolveUserPath(
      options.homeDir ?? (await ask(rl, 'Ariadne home directory', resolveAriadneHome())),
    );
    mkdirSync(homeDir, { recursive: true, mode: 0o700 });
    if (process.platform !== 'win32') chmodSync(homeDir, 0o700);
    step(1, 'home directory');
    process.stdout.write(`home: ${homeDir}\n`);
    report.configured.push(`home directory ${homeDir}`);

    step(2, 'existing configuration');
    if (!existsSync(path.join(homeDir, 'config.toml'))) {
      const imported = await maybeImportCredentials(homeDir, options.importFrom, rl);
      if (!imported) {
        process.stdout.write(
          'no existing config imported — configure a model provider below (API key, no login required).\n',
        );
        report.skipped.push('credential import');
      } else {
        report.configured.push('imported configuration');
      }
    } else {
      process.stdout.write('config.toml: present\n');
      report.configured.push('existing config.toml');
    }

    step(3, 'model provider');
    const modelConfigured = await setupModel(homeDir, options, rl, report);

    step(4, 'ariadne backend');
    await setupBackend(homeDir, options, rl, report);

    step(5, 'MCP registration');
    const mcpJson = ensureAriadneMcpJson(homeDir);
    process.stdout.write(`mcp.json: ariadne server registered (${mcpJson})\n`);
    report.configured.push(`MCP registration in ${mcpJson}`);

    step(6, 'skills');
    const harness = createAriadneHarness(homeDir);
    try {
      await ensureAriadneSkillDirs(harness);
    } finally {
      await harness.close();
    }
    process.stdout.write('skills: Ariadne operation and campaign skills registered\n');
    report.configured.push(`skills directory ${skillsDir()}`);
    restrictAriadneHomePermissions(homeDir);

    await closeOnboard(report, modelConfigured);
  } finally {
    rl?.close();
  }
}

function step(index: number, label: string): void {
  process.stdout.write(`\n[${String(index)}/${String(ONBOARD_STEPS)}] ${label}\n`);
}

async function closeOnboard(report: StepReport, modelConfigured: boolean): Promise<void> {
  const lines: string[] = [
    '',
    'Onboarding summary',
    `  configured: ${report.configured.length === 0 ? 'nothing' : report.configured.join(', ')}`,
    `  skipped:    ${report.skipped.length === 0 ? 'nothing' : report.skipped.join(', ')}`,
  ];
  process.stdout.write(`${lines.join('\n')}\n`);

  if (!modelConfigured) {
    const preset = PROVIDER_PRESETS[0];
    if (preset === undefined) throw new Error('no provider preset is available to complete setup');
    process.stdout.write(
      [
        '',
        'No default model is configured, so run, chat, and web have no model to call.',
        `  ariadnebuddy onboard --provider ${preset.id} --api-key-env ${defaultEnvName(preset.id)}`,
        '',
      ].join('\n'),
    );
    process.exitCode = 1;
    return;
  }

  if (report.failures.length > 0) {
    process.stdout.write(
      [
        '',
        `Setup is incomplete: ${report.failures.join(', ')}.`,
        '  ariadnebuddy doctor --probe',
        '  ariadnebuddy onboard --ariadne-repo /path/to/Ariadne',
        '',
      ].join('\n'),
    );
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    ['', 'Done. Next:', '  ariadnebuddy doctor --probe', '  ariadnebuddy chat', '  ariadnebuddy web', ''].join('\n'),
  );
}

async function readDefaultModel(homeDir: string): Promise<string | undefined> {
  const harness = createAriadneHarness(homeDir);
  try {
    return (await harness.getConfig()).defaultModel;
  } finally {
    await harness.close();
  }
}

async function setupModel(
  homeDir: string,
  options: OnboardOptions,
  rl: Interface | undefined,
  report: StepReport,
): Promise<boolean> {
  const existing = await readDefaultModel(homeDir);
  if (existing !== undefined && options.provider === undefined) {
    process.stdout.write(`default model: ${existing} (already configured — no login required)\n`);
    report.configured.push(`default model ${existing}`);
    return true;
  }

  if (options.provider !== undefined) {
    await applyProviderFlag(homeDir, options);
    const applied = await readDefaultModel(homeDir);
    if (applied === undefined) {
      report.skipped.push('model provider');
      return false;
    }
    report.configured.push(`default model ${applied}`);
    return true;
  }

  if (rl !== undefined) {
    const choice = await ask(
      rl,
      [
        'No default model configured. Choose how to set one up:',
        ...PROVIDER_PRESETS.map((p, i) => `  ${i + 1}) ${p.label} — ${p.hint}`),
        `  ${PROVIDER_PRESETS.length + 1}) custom OpenAI/Anthropic-compatible endpoint`,
        `  ${PROVIDER_PRESETS.length + 2}) skip (configure later)`,
        'choice',
      ].join('\n'),
      '1',
    );
    const idx = Number.parseInt(choice, 10);
    if (idx >= 1 && idx <= PROVIDER_PRESETS.length) {
      const preset = PROVIDER_PRESETS[idx - 1]!;
      const keyMode = await ask(
        rl,
        'API key source: 1) environment variable (recommended)  2) paste into config.toml',
        '1',
      );
      const useEnvironment = keyMode !== '2';
      const apiKeyEnv = useEnvironment
        ? await ask(rl, 'env var name holding the key', defaultEnvName(preset.id))
        : undefined;
      const apiKey = useEnvironment
        ? undefined
        : await ask(rl, `${preset.label} API key (input is visible and stored plaintext)`, '');
      await applyAndReport(homeDir, { presetId: preset.id, apiKey, apiKeyEnv });
    } else if (idx === PROVIDER_PRESETS.length + 1) {
      const baseUrl = await ask(rl, 'base URL (e.g. https://host/v1)', '');
      const providerType = (await ask(rl, 'provider type (openai|anthropic|kimi)', 'openai')) as OnboardOptions['providerType'];
      const model = await ask(rl, 'model name (required — the default model follows the provider)', '');
      if (baseUrl === '' || model === '') {
        process.stdout.write('base URL and model name are required for a custom provider — skipped.\n');
      } else {
        const apiKeyEnv = await ask(
          rl,
          'API key env var (recommended; enter "none" for an endpoint without authentication)',
          'CUSTOM_API_KEY',
        );
        await applyAndReport(homeDir, {
          presetId: 'custom',
          providerType,
          baseUrl,
          model,
          apiKeyEnv: apiKeyEnv.toLowerCase() === 'none' ? undefined : apiKeyEnv,
        });
      }
    } else {
      process.stdout.write('skipped model setup.\n');
    }
    const applied = await readDefaultModel(homeDir);
    if (applied === undefined) {
      report.skipped.push('model provider');
      return false;
    }
    report.configured.push(`default model ${applied}`);
    return true;
  }

  process.stdout.write(
    [
      'no default model configured. Set one without login; environment-variable keys are recommended:',
      '  export DEEPSEEK_API_KEY="..."',
      '  ariadnebuddy onboard --provider deepseek --api-key-env DEEPSEEK_API_KEY',
      '  export KIMI_CODING_API_KEY="..."',
      '  ariadnebuddy onboard --provider kimi-coding --api-key-env KIMI_CODING_API_KEY',
      '  ariadnebuddy onboard --provider custom --base-url https://host/v1 --model my-model --api-key-env LAB_API_KEY',
      '',
    ].join('\n'),
  );
  report.skipped.push('model provider');
  return false;
}

function defaultEnvName(presetId: string): string {
  return `${presetId.toUpperCase().replaceAll(/[^A-Z0-9]/g, '_')}_API_KEY`;
}

async function applyProviderFlag(homeDir: string, options: OnboardOptions): Promise<void> {
  await applyAndReport(homeDir, {
    presetId: options.provider,
    providerName: undefined,
    providerType: options.providerType,
    baseUrl: options.baseUrl,
    apiKey: options.apiKey,
    apiKeyEnv: options.apiKeyEnv,
    model: options.model,
  });
}

async function applyAndReport(
  homeDir: string,
  options: Parameters<typeof applyApiProvider>[1],
): Promise<void> {
  const harness = createAriadneHarness(homeDir);
  try {
    const applied = await applyApiProvider(harness, options);
    process.stdout.write(
      `provider: ${applied.providerName} configured (models: ${applied.aliases.join(', ')})\n`,
    );
    if (applied.defaultAlias !== undefined) {
      process.stdout.write(`default model: ${applied.defaultAlias} — works without any login\n`);
    }
  } finally {
    await harness.close();
  }
}

async function setupBackend(
  homeDir: string,
  options: OnboardOptions,
  rl: Interface | undefined,
  report: StepReport,
): Promise<void> {
  const selection = await pickBackend(homeDir, options, rl);

  if (selection === undefined) {
    process.stdout.write(
      'ariadne backend: NOT FOUND — research tools will report guidance until you set ARIADNE_REPO, run `ariadnebuddy onboard --ariadne-repo /path/to/Ariadne`, or provide an adapter-compatible ARIADNE_COMMAND.\n',
    );
    report.skipped.push('ariadne backend');
    return;
  }

  const { backend, config } = selection;
  process.stdout.write(`ariadne backend: ${describeBackend(backend)}\n`);
  const startedAt = Date.now();
  process.stdout.write('probing backend...\n');
  const probe = await probeBackend(backend);
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  const summary = summarizeBackendHealth(probe);
  const ready = backendPipelineReady(probe);
  if (probe.code !== 0 || ready === false) {
    process.stdout.write(
      [
        `probe failed after ${elapsed}s (${summary}); ariadne.json was not written.`,
        '  fix the backend command, then re-run one of:',
        '    ariadnebuddy onboard --ariadne-command \'["uv","run","ariadne"]\'',
        '    ariadnebuddy onboard --ariadne-repo /path/to/Ariadne',
        '    ariadnebuddy doctor --probe',
        '',
      ].join('\n'),
    );
    report.skipped.push('ariadne backend (probe failed)');
    report.failures.push('ariadne backend');
    process.exitCode = 1;
    return;
  }

  if (config !== undefined) atomicWriteJson(path.join(homeDir, 'ariadne.json'), config);
  if (ready === true) {
    process.stdout.write(`probe: ${summary} (${elapsed}s)\n`);
  } else {
    process.stdout.write(
      `probe incomplete (${summary}) after ${elapsed}s; the backend is recorded anyway — stage reference data and re-run \`ariadnebuddy doctor --probe\`.\n`,
    );
  }
  report.configured.push(`ariadne backend (${backend.source})`);
}

async function maybeImportCredentials(
  homeDir: string,
  importFrom: string | undefined,
  rl: Interface | undefined,
): Promise<boolean> {
  const candidates = [
    importFrom,
    ...(rl === undefined ? [] : [process.env['KIMI_CODE_HOME']]),
  ]
    .filter((candidate): candidate is string => candidate !== undefined)
    .map((candidate) => resolveUserPath(candidate))
    .filter((candidate) => candidate !== path.resolve(homeDir));
  for (const candidate of candidates) {
    if (!existsSync(path.join(candidate, 'config.toml'))) continue;
    const answer =
      rl === undefined
        ? 'y'
        : await ask(rl, `Import config + credentials from ${candidate}?`, 'y');
    if (!answer.toLowerCase().startsWith('y')) continue;
    copyKimiHome(candidate, homeDir);
    process.stdout.write(`imported config + credentials from ${candidate}\n`);
    return true;
  }
  return false;
}

function copyKimiHome(from: string, to: string): void {
  for (const entry of IMPORT_FILES) {
    const src = path.join(from, entry);
    const dst = path.join(to, entry);
    if (!existsSync(src) || existsSync(dst)) continue;
    if (!isSafeImportTree(src)) {
      process.stderr.write(
        `warning: skipped ${entry} because its import tree contains a symbolic link or unreadable entry\n`,
      );
      continue;
    }
    cpSync(src, dst, { recursive: true, filter: isSafeImportEntry });
    restrictImportedPermissions(dst);
  }
}

function isSafeImportTree(filePath: string): boolean {
  try {
    const metadata = lstatSync(filePath);
    if (metadata.isSymbolicLink()) return false;
    return !metadata.isDirectory() || readdirSync(filePath).every((entry) =>
      isSafeImportTree(path.join(filePath, entry)),
    );
  } catch {
    return false;
  }
}

function isSafeImportEntry(filePath: string): boolean {
  try {
    return !lstatSync(filePath).isSymbolicLink();
  } catch {
    return false;
  }
}

function restrictImportedPermissions(filePath: string): void {
  const metadata = lstatSync(filePath);
  if (metadata.isDirectory()) {
    chmodSync(filePath, 0o700);
    for (const entry of readdirSync(filePath)) {
      restrictImportedPermissions(path.join(filePath, entry));
    }
  } else if (metadata.isFile()) {
    chmodSync(filePath, 0o600);
  }
}

function restrictAriadneHomePermissions(homeDir: string): void {
  if (process.platform === 'win32') return;
  chmodSync(homeDir, 0o700);
  for (const entry of [
    'config.toml',
    'mcp.json',
    'ariadne.json',
    'credentials',
    'oauth',
    'tui.toml',
  ]) {
    const filePath = path.join(homeDir, entry);
    if (existsSync(filePath)) restrictImportedPermissions(filePath);
  }
}

async function pickBackend(
  homeDir: string,
  options: OnboardOptions,
  rl: Interface | undefined,
): Promise<BackendSelection | undefined> {
  if (options.ariadneCommand !== undefined) {
    const command = parseCommand(options.ariadneCommand);
    if (command === undefined) throw new Error('--ariadne-command cannot be empty');
    assertExecutable(command[0] ?? '', '--ariadne-command');
    return { backend: { command, source: 'cli flag' }, config: { command } };
  }
  if (options.ariadneRepo !== undefined) {
    const repo = resolveUserPath(options.ariadneRepo);
    const command = repoCommand(repo);
    if (command === undefined) {
      throw new Error(
        `--ariadne-repo is not a usable Ariadne checkout or no Python interpreter is available: ${repo}`,
      );
    }
    assertExecutable(command[0] ?? '', `--ariadne-repo (${repo})`);
    return { backend: { command, source: `repo:${repo}` }, config: { repo } };
  }
  const existing = resolveAriadneBackend(process.env, homeDir);
  if (existing !== undefined) return { backend: existing };

  const repoCandidates = uniquePaths([
    process.env['ARIADNE_REPO'],
    process.cwd(),
    path.join(process.cwd(), '..', 'Ariadne'),
    path.join(homedir(), 'Ariadne'),
    path.join(homedir(), 'Desktop', 'Ariadne'),
    path.join(homedir(), 'Documents', 'Ariadne'),
  ]).filter((repo) => repoCommand(repo) !== undefined);
  for (const repo of repoCandidates) {
    const command = repoCommand(repo);
    if (command === undefined) continue;
    const use = await ask(
      rl,
      `Ariadne repo found at ${repo}. Use it via \`${command.join(' ')}\`?`,
      'y',
    );
    if (use.toLowerCase().startsWith('y')) {
      assertExecutable(command[0] ?? '', `repo ${repo}`);
      return { backend: { command, source: `repo:${repo}` }, config: { repo } };
    }
  }
  return undefined;
}

function assertExecutable(command: string, source: string): void {
  if (command === '') throw new Error(`${source} must name an executable`);
  if (findOnPath(command) === undefined) {
    throw new Error(
      `${source}: the executable ${command} was not found on PATH and is not an executable file`,
    );
  }
}

async function ask(rl: Interface | undefined, question: string, fallback = ''): Promise<string> {
  if (rl === undefined) return fallback;
  const suffix = fallback === '' ? ': ' : ` [${fallback}]: `;
  return new Promise((resolve) => {
    rl.question(`${question}${suffix}`, (answer) => {
      resolve(answer.trim() !== '' ? answer.trim() : fallback);
    });
  });
}

function uniquePaths(candidates: readonly (string | undefined)[]): string[] {
  return [
    ...new Set(
      candidates
        .filter((candidate): candidate is string => candidate !== undefined && candidate.trim() !== '')
        .map((candidate) => resolveUserPath(candidate)),
    ),
  ];
}

export async function runReset(options: ResetOptions): Promise<void> {
  const homeDir = resolveUserPath(options.homeDir ?? resolveAriadneHome());
  const workDir = resolveUserPath(process.env['ARIADNE_WORKDIR'] ?? process.cwd());
  const jobsDir = resolveUserPath(
    process.env['ARIADNE_JOBS_DIR'] ?? path.join(workDir, 'ariadne-jobs'),
  );
  const plan = await planReset(homeDir, jobsDir, options.keepJobs === true);
  const registrations = resetRegistrations(plan);

  const lines: string[] = ['', 'AriadneBuddy reset', `  home: ${homeDir}`];
  if (plan.removals.length === 0 && registrations.length === 0) {
    process.stdout.write(`${lines.concat(['  nothing to remove', '']).join('\n')}\n`);
    return;
  }

  if (plan.removals.length > 0) {
    lines.push('  will remove:');
    for (const removal of plan.removals) lines.push(`    ${removal.label}`);
  }
  if (registrations.length > 0) {
    lines.push('  will deregister:');
    for (const registration of registrations) lines.push(`    ${registration}`);
  }
  if (options.yes !== true) {
    lines.push('', '  nothing was removed — re-run with --yes to apply this plan.', '');
    process.stdout.write(`${lines.join('\n')}\n`);
    process.exitCode = 1;
    return;
  }

  for (const removal of plan.removals) rmSync(removal.path, { recursive: true, force: true });
  await deregisterEngineHome(plan);
  for (const removal of plan.removals) process.stdout.write(`removed ${removal.label}\n`);
  for (const registration of registrations) process.stdout.write(`deregistered ${registration}\n`);
  process.stdout.write('\nAriadneBuddy reset complete.\n');
}

function resetRegistrations(plan: ResetPlan): readonly string[] {
  if (plan.engineHome === undefined) return [];
  const registrations: string[] = [];
  if (plan.stripMcpServer) {
    registrations.push(`${MCP_SERVER_NAME} server in ${path.join(plan.engineHome, 'mcp.json')}`);
  }
  if (plan.clearSkillDirs) {
    registrations.push(
      `${skillsDir()} in extraSkillDirs of ${path.join(plan.engineHome, 'config.toml')}`,
    );
  }
  return registrations;
}

async function planReset(
  homeDir: string,
  jobsDir: string,
  keepJobs: boolean,
): Promise<ResetPlan> {
  const removals: ResetRemoval[] = [];
  if (existsSync(homeDir)) {
    const entries = readdirSync(homeDir);
    removals.push({
      path: homeDir,
      label: entries.length === 0
        ? `${homeDir} (empty home directory)`
        : `${homeDir} (${entries.join(', ')})`,
    });
  }
  if (!keepJobs && existsSync(jobsDir) && !isInside(jobsDir, homeDir)) {
    removals.push({ path: jobsDir, label: `${jobsDir} (research job storage)` });
  }

  const engineHome = resolveUserPath(
    process.env['KIMI_CODE_HOME'] ?? path.join(homedir(), '.kimi'),
  );
  if (engineHome === homeDir) return { removals, stripMcpServer: false, clearSkillDirs: false };
  return {
    removals,
    engineHome,
    stripMcpServer: existsSync(path.join(engineHome, 'mcp.json'))
      && hasAriadneServer(path.join(engineHome, 'mcp.json')),
    clearSkillDirs: await listsAriadneSkillDir(engineHome),
  };
}

function isInside(candidate: string, parent: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function hasAriadneServer(mcpPath: string): boolean {
  try {
    const parsed = JSON.parse(readFileSync(mcpPath, 'utf8')) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return false;
    const servers = (parsed as Record<string, unknown>)['mcpServers'];
    return typeof servers === 'object'
      && servers !== null
      && MCP_SERVER_NAME in (servers as Record<string, unknown>);
  } catch {
    return false;
  }
}

async function listsAriadneSkillDir(engineHome: string): Promise<boolean> {
  if (!existsSync(path.join(engineHome, 'config.toml'))) return false;
  const harness = createAriadneHarness(engineHome);
  try {
    const config = await harness.getConfig();
    return (config.extraSkillDirs ?? []).includes(skillsDir());
  } catch {
    return false;
  } finally {
    await harness.close();
  }
}

async function deregisterEngineHome(plan: ResetPlan): Promise<void> {
  if (plan.engineHome === undefined) return;
  if (plan.stripMcpServer) {
    const mcpPath = path.join(plan.engineHome, 'mcp.json');
    const parsed = JSON.parse(readFileSync(mcpPath, 'utf8')) as Record<string, unknown>;
    const servers = parsed['mcpServers'] as Record<string, unknown>;
    delete servers[MCP_SERVER_NAME];
    atomicWriteJson(mcpPath, { ...parsed, mcpServers: servers });
  }
  if (plan.clearSkillDirs) {
    const harness = createAriadneHarness(plan.engineHome);
    try {
      const config = await harness.getConfig();
      await harness.setConfig({
        extraSkillDirs: (config.extraSkillDirs ?? []).filter((dir) => dir !== skillsDir()),
      });
    } finally {
      await harness.close();
    }
  }
}
