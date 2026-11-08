import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { startServer } from '@moonshot-ai/kap-server';

import { ASCII_LOGO } from './banner';
import { createAriadneHarness, ensureAriadneSkillDirs, resolveAriadneHome } from './harness';
import { ensureAriadneMcpJson } from './mcp/register';
import { defaultWebAssetsDir, packageVersion, resolveUserPath } from './paths';

export interface WebOptions {
  readonly host?: string;
  readonly port?: number;
  readonly noOpen?: boolean;
  readonly homeDir?: string;
}

const REPLY_STYLE_GUIDE = `You are the AriadneBuddy agent: an AI copilot for multi-agent scientific discovery in
natural-product genome mining, guiding the closed loop of computational nomination, experimental
design, validation interpretation, and iterative optimization. Expert-agent roles divide the work:
a Literature Surveyor (文献调研), a Hypothesis Architect (假说生成), a Pathway Reconstructor
(途径重构), a Nomination Steward (候选提名), an Experimental Designer (实验设计), and a
Validation Interpreter (验证解读). Adopt the role each stage requires, say which role is speaking,
and keep engine evidence separate from your synthesis.
Prefer the ariadne_* MCP tools for HMM retrieval, candidate filtering, ESM2 semantic scoring,
feature-space structure retrieval, full pipeline runs, nomination audits, and durable-job
supervision. The engines are deterministic: never fabricate scores, E-values, probabilities,
nearest references, or artifact paths — read them from engine outputs.
For a complete discovery request, use the ariadne skill and the durable research controller.
Write the nomination request to a snake_case JSON file (target_class, input_proteins, query_hmm,
reference_dir, optional thresholds), then call ariadne_research_create with a stable requestId,
the research objective, and a bounded job budget. Creation starts no backend work.
Use ariadne_research_advance to reconcile and progress the same task. Knowledge stages (literature,
hypothesis, pathway, experiment, validation) open a stage-input attention: author the artifact JSON
yourself in the expert role, deposit it, and respond with submit_stage. Compute stages launch the
deterministic engines; inspect the controller's artifacts instead of repeating its stage jobs.
Hypotheses require explicit approve before compute is spent; nominated candidates require approve
before experimental design; after validation, decide iterate or conclude. A caller-declared
response is not verified human approval; audit warnings and failures cannot be waived into success.
Use the following scientific checks in both modes:
1. Check runtime/engine readiness with ariadne_status when unknown (engines, reference data, ESM
   availability). Use ariadne_catalog to verify reference clades and TPS type labels.
2. Ground the literature stage in citable sources the user provided or you can attribute; mark
   unverified knowledge as such. State gaps explicitly; do not invent mechanisms or sequences.
3. Formulate hypotheses as testable predictions tied to the nomination target class; link pathway
   reconstruction steps to enzyme slots the engines can fill.
4. For nomination, rely on the controller's discovery → filtering → nomination (semantic scoring +
   structure retrieval) → audit chain. A candidate without HMM evidence above thresholds, and ESM
   CeeSs probability above threshold when ESM is available, is not nominated. An empty or failed
   audit cannot substantiate a shortlist.
5. Experimental designs must name the nominated candidate, expression system, assay, controls, and
   decision criteria. Validation records must separate outcome (supported/refuted/inconclusive)
   from interpretation, and feed iteration decisions honestly.
Long operations run as durable jobs: use list/status, manifests, bounded log views, and artifacts
without busy-polling. ESM scoring downloads model weights on first use — say so before launching.
Ask for confirmation before overwriting explicit outputs or launching expensive work; an existing
explicit authorization covers its stated scope. Never invent evidence, engine results, artifacts,
completion states, or metrics. State that nominated candidates require heterologous expression and
product confirmation before any claim of function.`;

export async function runWeb(options: WebOptions): Promise<void> {
  const homeDir = resolveUserPath(options.homeDir ?? resolveAriadneHome());
  const host = validateHost(options.host ?? '127.0.0.1');
  const port = validatePort(options.port ?? 58_627);
  const webAssetsDir = resolveUserPath(
    process.env['ARIADNE_WEB_ASSETS_DIR'] ?? defaultWebAssetsDir(),
  );
  if (!existsSync(path.join(webAssetsDir, 'index.html'))) {
    throw new Error(
      `Web UI assets not found at ${webAssetsDir}. Build or sync apps/kimi-code/dist-web in the kimi-code monorepo, or set ARIADNE_WEB_ASSETS_DIR.`,
    );
  }

  const mcpJsonPath = ensureAriadneMcpJson(homeDir);
  const harness = createAriadneHarness(homeDir);
  try {
    await ensureAriadneSkillDirs(harness);
  } finally {
    await harness.close();
  }

  const version = packageVersion();
  const server = await startServer({
    host,
    port,
    homeDir,
    logLevel: 'silent',
    webTitle: 'AriadneBuddy',
    webAssetsDir,
    serverVersion: version,
    telemetry: false,
    hostIdentity: {
      productName: 'ariadne-harness',
      version,
      platform: 'ariadne_harness',
      displayName: 'AriadneBuddy',
      replyStyleGuide: REPLY_STYLE_GUIDE,
    },
  });

  const token = server.authTokenService.getToken();
  const url = localServerUrl(server.host, server.port, token);
  if (!isLoopbackHost(host)) {
    process.stderr.write(
      `warning: the server is listening on non-loopback host ${host}; keep the bearer URL private and use a firewall.\n`,
    );
  }
  process.stdout.write(
    [
      ASCII_LOGO,
      `  AriadneBuddy server ready ${version}`,
      ``,
      `  Local:    ${url}`,
      ``,
      `  Home:     ${homeDir}`,
      `  MCP:      ariadne registered in ${mcpJsonPath}`,
      `  Stop:     Ctrl+C`,
      ``,
    ].join('\n'),
  );

  if (options.noOpen !== true) {
    openUrl(url);
  }

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    void server.close().finally(() => {
      process.exit(signal === 'SIGINT' ? 130 : 143);
    });
  };
  process.once('SIGINT', () => {
    shutdown('SIGINT');
  });
  process.once('SIGTERM', () => {
    shutdown('SIGTERM');
  });
}

function openUrl(url: string): void {
  const opener =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'explorer.exe'
        : 'xdg-open';
  const args = [url];
  const child = spawn(opener, args, { detached: true, stdio: 'ignore' });
  child.once('error', (error) => {
    process.stderr.write(`warning: could not open a browser: ${error.message}\n`);
  });
  child.unref();
}

function validateHost(host: string): string {
  const trimmed = host.trim();
  if (trimmed === '' || /[\s/?#]/.test(trimmed)) {
    throw new Error(`Invalid web server host: ${host}`);
  }
  return trimmed;
}

function validatePort(port: number): number {
  if (!Number.isSafeInteger(port) || port < 0 || port > 65_535) {
    throw new Error(`Invalid web server port: ${String(port)} (expected 0-65535)`);
  }
  return port;
}

function localServerUrl(host: string, port: number, token: string): string {
  let browserHost = host;
  if (host === '0.0.0.0') browserHost = '127.0.0.1';
  if (host === '::' || host === '[::]') browserHost = '::1';
  const authority = browserHost.includes(':') ? `[${withoutBrackets(browserHost)}]` : browserHost;
  return `http://${authority}:${String(port)}/#token=${encodeURIComponent(token)}`;
}

function isLoopbackHost(host: string): boolean {
  const normalized = withoutBrackets(host).toLowerCase();
  return normalized === '127.0.0.1' || normalized === '::1' || normalized === 'localhost';
}

function withoutBrackets(host: string): string {
  return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
}
