import process from 'node:process';

import {
  createKimiHarness,
  type Event,
  type KimiHarness,
  type Session,
} from '@moonshot-ai/kimi-code-sdk';

import { MCP_SERVER_NAME, mcpEnvironment, resolveMcpLaunch } from './mcp/register';
import type { PermissionMode } from './cli-args';
import { packageVersion, resolveAriadneHome, resolveUserPath, skillsDir } from './paths';

export { resolveAriadneHome } from './paths';

export const PRODUCT_NAME = 'ariadne-buddy';

export interface SessionOverrides {
  readonly model?: string;
  readonly workDir?: string;
  readonly permission?: PermissionMode;
}

export const RESEARCH_SPECIALIST_GUIDANCE = `For a research task, use the Agent tool with the
explore profile, the primary model and a fresh foreground task when an independent review would
help check literature claims, test a hypothesis against its cited evidence, or inspect the quality
of recorded outputs. Give the reviewer one question, the relevant source references and a request
for findings with their sources, evidence gaps and disagreements. Instruct the reviewer to read
the supplied or cited material, avoid shell commands and leave files and task state untouched.
The coordinator verifies the review against original sources, writes and submits the stage artifact,
and acts on gate decisions explicitly provided by the researcher. The research controller owns stage
jobs. Record who performed each review and mark unresolved issues. When Agent is unavailable or the
delegation fails, continue with the stage role and identify the review as performed by the coordinator.`;

export function createAriadneHarness(homeDir: string = resolveAriadneHome()): KimiHarness {
  return createKimiHarness({
    homeDir,
    identity: {
      productName: PRODUCT_NAME,
      version: packageVersion(),
      platform: 'ariadne_buddy',
    },
    uiMode: PRODUCT_NAME,
  });
}

export async function createDefaultSession(
  harness: KimiHarness,
  overrides: SessionOverrides = {},
): Promise<Session> {
  const config = await harness.getConfig();
  const model = overrides.model ?? config.defaultModel;
  if (model === undefined) {
    throw new Error('No model configured. Run `ariadnebuddy onboard` or set default_model in config.toml.');
  }
  const workDir = resolveUserPath(overrides.workDir ?? process.env['ARIADNE_WORKDIR'] ?? process.cwd());
  return harness.createSession({ workDir, model, permission: overrides.permission ?? 'auto' });
}

export async function attachAriadneTools(session: Session, homeDir: string): Promise<void> {
  const launch = resolveMcpLaunch();
  await session.addMcpServer(
    {
      name: MCP_SERVER_NAME,
      transport: 'stdio',
      command: launch.command,
      args: [...launch.args],
      env: mcpEnvironment(homeDir),
    },
    { persist: false },
  );
}

export async function ensureAriadneSkillDirs(harness: KimiHarness): Promise<void> {
  const dir = skillsDir();
  const config = await harness.getConfig();
  const current = config.extraSkillDirs ?? [];
  if (current.includes(dir)) return;
  await harness.setConfig({ extraSkillDirs: [...current, dir] });
}

const TURN_TIMEOUT_MS = 1_800_000;

export interface TurnOutputOptions {
  readonly quiet?: boolean;
  readonly json?: boolean;
}

export interface TurnRecord {
  readonly turnId: number;
  readonly reason: string;
}

export interface TurnEnvelope {
  readonly status: 'completed' | 'failed';
  readonly text: string;
  readonly turns: readonly TurnRecord[];
  readonly error?: string;
}

function renderTurnEnvelope(envelope: TurnEnvelope): string {
  return `${JSON.stringify(envelope)}\n`;
}

export async function promptTurnToEnd(
  session: Session,
  prompt: string,
  output: TurnOutputOptions = {},
): Promise<TurnEnvelope> {
  let activeTurnId: number | undefined;
  let unsubscribe: (() => void) | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const structured = output.json === true;
  const quiet = output.quiet === true || structured;
  const envelope: { status: TurnEnvelope['status']; text: string; turns: TurnRecord[]; error?: string } = {
    status: 'completed',
    text: '',
    turns: [],
  };

  const done = new Promise<void>((resolve, reject) => {
    timeout = setTimeout(() => {
      reject(new Error('Timed out waiting for turn.ended'));
      void session.cancel().catch(() => undefined);
    }, TURN_TIMEOUT_MS);

    unsubscribe = session.onEvent((event: Event) => {
      if (event.type === 'turn.started') {
        activeTurnId = event.turnId;
        process.stderr.write(`[turn ${String(event.turnId)} started]\n`);
        return;
      }
      if (event.type === 'assistant.delta') {
        if (activeTurnId === undefined || event.turnId === activeTurnId) {
          envelope.text += event.delta;
          if (!structured) process.stdout.write(event.delta);
        }
        return;
      }
      if (event.type === 'thinking.delta') {
        if (activeTurnId === undefined || event.turnId === activeTurnId) {
          process.stderr.write(event.delta);
        }
        return;
      }
      if (event.type === 'tool.call.started') {
        process.stderr.write(`[tool] ${event.name}\n`);
        return;
      }
      if (event.type === 'subagent.spawned') {
        process.stderr.write(`[subagent ${event.subagentId}] ${event.subagentName} spawned\n`);
        return;
      }
      if (event.type === 'subagent.completed' || event.type === 'subagent.failed' || event.type === 'subagent.cancelled') {
        process.stderr.write(`[subagent ${event.subagentId}] ${event.type.slice('subagent.'.length)}\n`);
        return;
      }
      if (event.type === 'error') {
        envelope.status = 'failed';
        envelope.error = `${event.code}: ${event.message}`;
        reject(new Error(envelope.error));
        return;
      }
      if (event.type === 'turn.ended') {
        if (activeTurnId === undefined || event.turnId === activeTurnId) {
          envelope.turns.push({ turnId: event.turnId, reason: event.reason });
          if (quiet) {
            process.stderr.write(`\n[turn ${String(event.turnId)} ended: ${event.reason}]\n`);
          } else {
            process.stdout.write(`\n[turn ${String(event.turnId)} ended: ${event.reason}]\n`);
          }
          resolve();
        }
      }
    });
  });

  try {
    await Promise.all([session.promptWithSkills(prompt, [{ name: 'ariadne' }]), done]);
  } catch (error: unknown) {
    envelope.status = 'failed';
    envelope.error ??= error instanceof Error ? error.message : String(error);
    if (structured) process.stdout.write(renderTurnEnvelope(envelope));
    throw error;
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
    unsubscribe?.();
  }

  if (structured) process.stdout.write(renderTurnEnvelope(envelope));
  return envelope;
}
