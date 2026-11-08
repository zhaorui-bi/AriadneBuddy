import { randomBytes } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';

import { z } from 'zod';

import { resolveUserPath } from '../paths';
import {
  describeBackend,
  resolveAriadneBackend,
  runBackend,
  type AriadneBackend,
  type RunResult,
} from './backend';
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
  type JobSnapshot,
  type JobStatus,
} from './jobs';
import { createEngineeringJobRequest } from './provenance';
import { RESEARCH_TOOLS } from './research-tools';

export interface ToolContext {
  readonly homeDir?: string;
  readonly jobsRoot: string;
  readonly env: NodeJS.ProcessEnv;
}

export interface ToolResult {
  [key: string]: unknown;
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

export interface AriadneTool {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: Record<string, z.ZodType>;
  readonly strictInput?: boolean;
  run(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

export interface AriadneToolAnnotations {
  readonly readOnlyHint: boolean;
  readonly destructiveHint: boolean;
  readonly idempotentHint: boolean;
  readonly openWorldHint: boolean;
}

const READ_ONLY_IDEMPOTENT = new Set([
  'ariadne_status',
  'ariadne_catalog',
  'ariadne_job_list',
  'ariadne_job_status',
  'ariadne_job_manifest',
  'ariadne_job_log',
  'ariadne_job_artifacts',
  'ariadne_research_status',
  'ariadne_research_list',
]);
const IDEMPOTENT_WRITES = new Set([
  'ariadne_build_hmm',
  'ariadne_audit_nomination',
]);

export function ariadneToolAnnotations(name: string): AriadneToolAnnotations {
  if (READ_ONLY_IDEMPOTENT.has(name)) {
    return { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
  }
  if (name === 'ariadne_job_cancel') {
    return { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false };
  }
  if (name === 'ariadne_research_create' || name === 'ariadne_research_cancel') {
    return { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false };
  }
  if (IDEMPOTENT_WRITES.has(name)) {
    return { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false };
  }
  return { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true };
}

const PATH_NOTE =
  'File paths may be absolute or relative to ARIADNE_WORKDIR (the agent workspace).';

function ok(payload: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

function fail(message: string, extra?: Record<string, unknown>): ToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text: JSON.stringify({ error: message, ...extra }, null, 2) }],
  };
}

function backendOrError(ctx: ToolContext): AriadneBackend | ToolResult {
  let backend: AriadneBackend | undefined;
  try {
    backend = resolveAriadneBackend(ctx.env, ctx.homeDir);
  } catch (error) {
    return fail('Ariadne backend configuration is invalid.', {
      detail: error instanceof Error ? error.message : String(error),
    });
  }
  if (backend === undefined) {
    return fail('Ariadne engine checkout or adapter-compatible backend was not found.', {
      how_to_fix: [
        'Point ARIADNE_REPO at the ariadne-tps checkout (a Python env with pyhmmer/pyrodigal/scikit-learn installed, e.g. its .venv).',
        'Or run `ariadnebuddy onboard --ariadne-repo /path/to/Ariadne` and accept the detected repository.',
        'Alternatively set ARIADNE_COMMAND to an adapter-compatible command as a JSON string array.',
      ],
    });
  }
  return backend;
}

function isToolResult(value: AriadneBackend | ToolResult): value is ToolResult {
  return Array.isArray((value as ToolResult).content);
}

const nonEmptyPath = z.string().trim().min(1).max(8_192);
const waitShape = {
  wait: z
    .boolean()
    .optional()
    .describe('Wait for bounded completion. Default false returns a durable job id immediately.'),
  waitTimeoutMs: z
    .number()
    .int()
    .min(1)
    .max(3_600_000)
    .optional()
    .describe('Maximum wait when wait=true (default 600000 ms; max 3600000 ms).'),
};

const jobIdSchema = z.string().regex(/^job_\d{14}_[a-z0-9]{6,16}$/);

async function immediateBackendCall(
  ctx: ToolContext,
  args: readonly string[],
  timeoutMs = 120_000,
): Promise<ToolResult> {
  const backend = backendOrError(ctx);
  if (isToolResult(backend)) return backend;
  const result = await runBackend(backend, args, {
    timeoutMs,
    cwd: jobWorkDir(ctx),
    env: ctx.env,
  });
  const report = commandReport(result);
  return result.code === 0 ? ok(report) : fail('Ariadne backend command failed.', report);
}

async function launchJob(
  ctx: ToolContext,
  argv: readonly string[],
  toolName: string,
  label: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const backend = backendOrError(ctx);
  if (isToolResult(backend)) return backend;
  const workDir = jobWorkDir(ctx);
  const command = [...backend.command, ...argv];
  const [versionProbe, identityProbe] = await Promise.all([
    runBackend(backend, ['--version'], {
      timeoutMs: 30_000,
      cwd: workDir,
      env: ctx.env,
    }),
    runBackend(backend, ['identity'], {
      timeoutMs: 30_000,
      cwd: workDir,
      env: ctx.env,
    }),
  ]);
  const backendVersion =
    versionProbe.code === 0 ? firstOutputLine(versionProbe.stdout, 1_000) : undefined;
  const scientificConfiguration = scientificConfigurationForRun(
    identityProbe.code === 0 ? parseJson(identityProbe.stdout) : undefined,
    ctx.env,
  );
  let provenance: ReturnType<typeof createEngineeringJobRequest>;
  try {
    provenance = createEngineeringJobRequest({
      toolName,
      operation: label,
      backend,
      backendVersion,
      args,
      workDir,
      scientificConfiguration,
    });
  } catch (error) {
    return fail('Could not record the engineering request.', {
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  const unusableInputs = provenance.inputs.filter((input) => {
    if (input.kind === 'file') return false;
    if (input.kind === 'directory') {
      return !(input.role === 'reference-library' || input.role === 'hmm-library') || input.integrityComplete !== true;
    }
    return true;
  });
  if (unusableInputs.length > 0) {
    return fail('Input preflight failed; no job was launched.', {
      inputs: unusableInputs,
      how_to_fix:
        'Use readable regular files for FASTA/HMM/workbook inputs. Reference and HMM directories must be readable, complete directories. Symbolic links are rejected.',
    });
  }

  let job: JobSnapshot;
  try {
    job = startJob(ctx.jobsRoot, command, {
      workDir,
      env: ctx.env,
      label,
      provenance,
    });
  } catch (error) {
    return fail('Could not start the Ariadne background job.', {
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  if (args['wait'] !== true) {
    return ok({
      status: 'started',
      job: publicJob(job),
      next: `Use ariadne_job_status(jobId="${job.id}"), ariadne_job_manifest(jobId="${job.id}"), and bounded ariadne_job_log reads. Recover it later with ariadne_job_list.`,
    });
  }

  const timeoutMs = typeof args['waitTimeoutMs'] === 'number' ? args['waitTimeoutMs'] : 600_000;
  const finished = await waitForJob(ctx.jobsRoot, job.id, timeoutMs);
  const finalJob = finished ?? job;
  const payload = { job: publicJob(finalJob), log_tail: jobLog(ctx.jobsRoot, job.id) ?? '' };
  if (finalJob.status === 'failed' || finalJob.status === 'cancelled') {
    return fail(`Ariadne job ${finalJob.status}.`, payload);
  }
  return ok(payload);
}

function publicJob(job: JobSnapshot): Record<string, unknown> {
  return {
    jobId: job.id,
    status: job.status,
    command: job.command.join(' '),
    commandArgv: job.command,
    workDir: job.workDir,
    label: job.label,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    durationMs: job.durationMs,
    exitCode: job.exitCode,
    signal: job.signal,
    logPath: job.logPath,
    jobDir: job.dir,
    configuredOutput: configuredJobOutput(job),
  };
}

function jobWorkDir(ctx: ToolContext): string {
  return resolveUserPath(ctx.env['ARIADNE_WORKDIR'] ?? process.cwd());
}

function resolveJobPath(value: string, workDir: string): string {
  const trimmed = value.trim();
  if (trimmed === '~' || trimmed.startsWith('~/') || trimmed.startsWith('~\\')) {
    return resolveUserPath(trimmed);
  }
  return path.isAbsolute(trimmed) ? path.normalize(trimmed) : path.resolve(workDir, trimmed);
}

function outputPath(args: Record<string, unknown>, workDir: string, label: string): string {
  if (typeof args['output'] === 'string') return resolveJobPath(args['output'], workDir);
  const stamp = new Date().toISOString().replaceAll(/[-:.TZ]/g, '').slice(0, 14);
  const nonce = randomBytes(6).toString('hex');
  return path.join(workDir, 'ariadne-output', `${label}_${stamp}_${nonce}.json`);
}

function stageDirPath(args: Record<string, unknown>, workDir: string, label: string): string {
  if (typeof args['stageDir'] === 'string') return resolveJobPath(args['stageDir'], workDir);
  const stamp = new Date().toISOString().replaceAll(/[-:.TZ]/g, '').slice(0, 14);
  const nonce = randomBytes(4).toString('hex');
  return path.join(workDir, 'ariadne-output', `${label}-artifacts_${stamp}_${nonce}`);
}

export const ARIADNE_TOOLS: readonly AriadneTool[] = [
  {
    name: 'ariadne_status',
    title: 'Ariadne engine status',
    description:
      'Inspect the configured Ariadne engine checkout, Python runtime, deterministic engines (HMM retrieval, ESM2 semantic scoring, feature-space structure retrieval), reference data readiness, and ESM availability. Run this before using the pipeline on a new machine.',
    inputSchema: {},
    async run(_args, ctx) {
      const backend = backendOrError(ctx);
      if (isToolResult(backend)) return backend;
      const [version, health] = await Promise.all([
        runBackend(backend, ['--version'], { timeoutMs: 30_000, cwd: jobWorkDir(ctx), env: ctx.env }),
        runBackend(backend, ['health', '--json'], {
          timeoutMs: 60_000,
          cwd: jobWorkDir(ctx),
          env: ctx.env,
        }),
      ]);
      const healthPayload = parseJson(health.stdout);
      return ok({
        available: version.code === 0 && health.code === 0,
        readyForPipeline:
          isRecord(healthPayload) && healthPayload['ready_for_pipeline'] === true,
        backend: describeBackend(backend),
        version: commandReport(version),
        health: commandReport(health),
      });
    },
  },
  {
    name: 'ariadne_catalog',
    title: 'Browse Ariadne reference data',
    description:
      'List or search reference clades (coral, insect, bacteria, fungi, plant), their sequence counts, and TPS type labels from the labeled workbook. Use this before constructing nomination requests or interpreting type predictions.',
    inputSchema: {
      kind: z.enum(['all', 'clades', 'tps-types']).optional(),
      search: z.string().trim().max(256).optional(),
      limit: z.number().int().min(1).max(1_000).optional(),
    },
    async run(args, ctx) {
      const argv = ['catalog'];
      if (typeof args['kind'] === 'string') argv.push('--kind', args['kind']);
      if (typeof args['search'] === 'string') argv.push('--search', args['search']);
      if (typeof args['limit'] === 'number') argv.push('--limit', String(args['limit']));
      return immediateBackendCall(ctx, argv, 60_000);
    },
  },
  {
    name: 'ariadne_build_hmm',
    title: 'Build a profile HMM',
    description:
      `Build an HMMER3 profile HMM from an aligned reference FASTA (MSA) with pyhmmer. This is the deterministic Stage-0 engine behind HMM retrieval. ${PATH_NOTE}`,
    inputSchema: {
      alignment: nonEmptyPath.describe('Aligned FASTA (MSA) input path.'),
      output: nonEmptyPath.describe('HMMER3 text HMM output path (overwrites).'),
      name: z.string().trim().min(1).max(256).optional().describe('Profile name written into the HMM.'),
    },
    async run(args, ctx) {
      const workDir = jobWorkDir(ctx);
      const argv = ['build-hmm', '--alignment', resolveJobPath(String(args['alignment']), workDir), '--output', resolveJobPath(String(args['output']), workDir)];
      if (typeof args['name'] === 'string') argv.push('--name', args['name']);
      return immediateBackendCall(ctx, argv, 120_000);
    },
  },
  {
    name: 'ariadne_discover',
    title: 'HMM retrieval over protein sets',
    description:
      `Deterministic Stage-I discovery engine: search protein FASTA(s) with an HMMER3 profile (pyhmmer), best hit per sequence, score/E-value thresholds. Returns candidate protein/ORF FASTAs and a hits table. ${PATH_NOTE}`,
    inputSchema: {
      proteins: z.array(nonEmptyPath).min(1).max(64).describe('Protein FASTA input paths.'),
      hmm: nonEmptyPath.describe('HMMER3 profile HMM path.'),
      stageDir: nonEmptyPath.optional().describe('Directory for candidate FASTA/TSV artifacts (default: timestamped workspace path).'),
      minScore: z.number().finite().optional().describe('Minimum HMM score (default 0).'),
      maxEvalue: z.number().finite().positive().optional().describe('Maximum E-value (default 1e-3).'),
      output: nonEmptyPath.optional().describe('Result JSON path.'),
      ...waitShape,
    },
    async run(args, ctx) {
      const workDir = jobWorkDir(ctx);
      const proteins = (args['proteins'] as string[]).map((value) => resolveJobPath(value, workDir));
      const stageDir = stageDirPath(args, workDir, 'discovery');
      const output = outputPath(args, workDir, 'discovery');
      const argv = ['discover', '--proteins', proteins.join(','), '--hmm', resolveJobPath(String(args['hmm']), workDir), '--stage-dir', stageDir, '--output', output];
      if (typeof args['minScore'] === 'number') argv.push('--min-score', String(args['minScore']));
      if (typeof args['maxEvalue'] === 'number') argv.push('--max-evalue', String(args['maxEvalue']));
      return launchJob(ctx, argv, 'ariadne_discover', 'discover', { ...args, proteins, stageDir, output });
    },
  },
  {
    name: 'ariadne_filter',
    title: 'Filter candidate proteins',
    description:
      `Deterministic Stage-II filtering engine: coverage, length, and near-duplicate filtering over discovered candidates with a filter report. ${PATH_NOTE}`,
    inputSchema: {
      candidates: nonEmptyPath.describe('Candidate protein FASTA from discovery.'),
      stageDir: nonEmptyPath.optional().describe('Directory for filtered FASTA/TSV artifacts.'),
      minCoverage: z.number().int().min(0).optional().describe('Minimum HMM coverage (default 10).'),
      minLength: z.number().int().min(0).optional().describe('Minimum protein length in aa (default 300).'),
      output: nonEmptyPath.optional().describe('Result JSON path.'),
      ...waitShape,
    },
    async run(args, ctx) {
      const workDir = jobWorkDir(ctx);
      const candidates = resolveJobPath(String(args['candidates']), workDir);
      const stageDir = stageDirPath(args, workDir, 'filtering');
      const output = outputPath(args, workDir, 'filtering');
      const argv = ['filter', '--candidates', candidates, '--stage-dir', stageDir, '--output', output];
      if (typeof args['minCoverage'] === 'number') argv.push('--min-coverage', String(args['minCoverage']));
      if (typeof args['minLength'] === 'number') argv.push('--min-length', String(args['minLength']));
      return launchJob(ctx, argv, 'ariadne_filter', 'filter', { ...args, candidates, stageDir, output });
    },
  },
  {
    name: 'ariadne_score_candidates',
    title: 'ESM2 semantic scoring',
    description:
      `Deterministic semantic-scoring engine: frozen ESM2 embeddings + trained classifier score candidates against labeled TPS types and produce the CeeSs candidate shortlist (esm_ceess_probability ≥ threshold, default 0.9). Requires torch/transformers and downloads ESM2 weights on first use. ${PATH_NOTE}`,
    inputSchema: {
      candidates: nonEmptyPath.describe('Candidate protein FASTA.'),
      workbook: nonEmptyPath.describe('Labeled TPS workbook (xlsx with Name/Protein/Type/Species).'),
      esmModel: z.string().trim().min(1).max(256).optional().describe('ESM2 model id (default facebook/esm2_t33_650M_UR50D or ARIADNE_ESM_MODEL).'),
      ceessThreshold: z.number().finite().min(0).max(1).optional().describe('CeeSs nomination probability threshold (default 0.9).'),
      device: z.enum(['cpu', 'cuda', 'mps']).optional(),
      stageDir: nonEmptyPath.optional().describe('Directory for scoring artifacts.'),
      output: nonEmptyPath.optional().describe('Result JSON path.'),
      ...waitShape,
    },
    async run(args, ctx) {
      const workDir = jobWorkDir(ctx);
      const candidates = resolveJobPath(String(args['candidates']), workDir);
      const workbook = resolveJobPath(String(args['workbook']), workDir);
      const stageDir = stageDirPath(args, workDir, 'scoring');
      const output = outputPath(args, workDir, 'scoring');
      const argv = ['score', '--candidates', candidates, '--workbook', workbook, '--stage-dir', stageDir, '--output', output];
      if (typeof args['esmModel'] === 'string') argv.push('--model', args['esmModel']);
      if (typeof args['ceessThreshold'] === 'number') argv.push('--ceess-threshold', String(args['ceessThreshold']));
      if (typeof args['device'] === 'string') argv.push('--device', args['device']);
      return launchJob(ctx, argv, 'ariadne_score_candidates', 'score', { ...args, candidates, workbook, stageDir, output });
    },
  },
  {
    name: 'ariadne_classify',
    title: 'Feature-space structure retrieval',
    description:
      `Deterministic structure-retrieval engine: score candidates against every reference HMM profile into a feature space, embed with LDA-first coordinates, and retrieve nearest references (predicted source clade, confidence, is_coral_like, nearest_reference). ${PATH_NOTE}`,
    inputSchema: {
      candidates: nonEmptyPath.describe('Candidate protein FASTA.'),
      referenceDir: nonEmptyPath.describe('Directory of aligned reference FASTAs per clade.'),
      hmmDir: nonEmptyPath.optional().describe('Directory of per-clade profile HMMs (auto-built into stageDir when omitted).'),
      topK: z.number().int().min(1).max(20).optional().describe('Nearest-reference top-k (default 5).'),
      stageDir: nonEmptyPath.optional().describe('Directory for classification artifacts (TSV tables + embedding SVGs).'),
      output: nonEmptyPath.optional().describe('Result JSON path.'),
      ...waitShape,
    },
    async run(args, ctx) {
      const workDir = jobWorkDir(ctx);
      const candidates = resolveJobPath(String(args['candidates']), workDir);
      const referenceDir = resolveJobPath(String(args['referenceDir']), workDir);
      const stageDir = stageDirPath(args, workDir, 'classification');
      const output = outputPath(args, workDir, 'classification');
      const argv = ['classify', '--candidates', candidates, '--reference-dir', referenceDir, '--stage-dir', stageDir, '--output', output];
      if (typeof args['hmmDir'] === 'string') argv.push('--hmm-dir', resolveJobPath(args['hmmDir'], workDir));
      if (typeof args['topK'] === 'number') argv.push('--top-k', String(args['topK']));
      return launchJob(ctx, argv, 'ariadne_classify', 'classify', { ...args, candidates, referenceDir, stageDir, output });
    },
  },
  {
    name: 'ariadne_pipeline_run',
    title: 'Run the full deterministic pipeline',
    description:
      `Run discovery → filtering → classification end to end from a nomination-request JSON (target class, input proteins, query HMM, references, thresholds). Produces the 01_discovery/02_filtering/03_classification artifact tree plus pipeline_summary.tsv. ${PATH_NOTE}`,
    inputSchema: {
      requestFile: nonEmptyPath.describe('Nomination-request JSON (snake_case fields).'),
      stageDir: nonEmptyPath.optional().describe('Pipeline output root (default: timestamped workspace path).'),
      output: nonEmptyPath.optional().describe('Result JSON path.'),
      ...waitShape,
    },
    async run(args, ctx) {
      const workDir = jobWorkDir(ctx);
      const requestFile = resolveJobPath(String(args['requestFile']), workDir);
      const stageDir = stageDirPath(args, workDir, 'pipeline');
      const output = outputPath(args, workDir, 'pipeline');
      return launchJob(
        ctx,
        ['pipeline', '--request-file', requestFile, '--stage-dir', stageDir, '--output', output],
        'ariadne_pipeline_run',
        'pipeline',
        { ...args, requestFile, stageDir, output },
      );
    },
  },
  {
    name: 'ariadne_audit_nomination',
    title: 'Audit a nomination report',
    description:
      `Build a machine-readable claim-evidence ledger over a nomination report and structurally verify that every nominated candidate carries complete deterministic evidence (HMM score/E-value thresholds, length, ESM probability when used, nearest-reference context). This does not establish enzymatic activity or product formation. ${PATH_NOTE}`,
    inputSchema: {
      nominationFile: nonEmptyPath.describe('Nomination-report JSON to audit.'),
      output: nonEmptyPath.optional().describe('Audit JSON path. A timestamped workspace path is used by default.'),
      ...waitShape,
    },
    async run(args, ctx) {
      const workDir = jobWorkDir(ctx);
      const nominationFile = resolveJobPath(String(args['nominationFile']), workDir);
      const output = outputPath(args, workDir, 'nomination-audit');
      return launchJob(
        ctx,
        ['audit-nomination', '--nomination-file', nominationFile, '--output', output],
        'ariadne_audit_nomination',
        'audit-nomination',
        { ...args, nominationFile, output },
      );
    },
  },
  {
    name: 'ariadne_job_list',
    title: 'List Ariadne jobs',
    description: 'Recover recent durable Ariadne jobs after a CLI, Web, or desktop session closes.',
    inputSchema: {
      status: z.enum(['running', 'succeeded', 'failed', 'cancelled', 'unknown']).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    async run(args, ctx) {
      const status = args['status'] as JobStatus | undefined;
      const limit = typeof args['limit'] === 'number' ? args['limit'] : 20;
      const matching = listJobs(ctx.jobsRoot).filter(
        (job) => status === undefined || job.status === status,
      );
      return ok({
        jobsRoot: ctx.jobsRoot,
        total: matching.length,
        returned: Math.min(limit, matching.length),
        jobs: matching.slice(0, limit).map(publicJob),
      });
    },
  },
  {
    name: 'ariadne_job_status',
    title: 'Ariadne job status',
    description: 'Read lifecycle state, timestamps, duration, exit state, and output location for a job.',
    inputSchema: { jobId: jobIdSchema },
    async run(args, ctx) {
      const job = getJob(ctx.jobsRoot, String(args['jobId']));
      return job === undefined ? fail(`unknown job id: ${String(args['jobId'])}`) : ok(publicJob(job));
    },
  },
  {
    name: 'ariadne_job_manifest',
    title: 'Inspect Ariadne run manifest',
    description:
      'Read validated parameters, backend/runtime identity, non-secret scientific model settings, input and payload fingerprints, lifecycle state, a completion-time configured-output fingerprint, and a bounded artifact inventory. Request and result identities are verified separately; neither freezes remote model behavior.',
    inputSchema: {
      jobId: jobIdSchema,
      maxEntries: z.number().int().min(1).max(1_000).optional(),
      maxDepth: z.number().int().min(0).max(8).optional(),
    },
    async run(args, ctx) {
      const jobId = String(args['jobId']);
      const job = getJob(ctx.jobsRoot, jobId);
      if (job === undefined) return fail(`unknown job id: ${jobId}`);
      const provenance = readJobRunManifest(ctx.jobsRoot, jobId);
      if (provenance?.error !== undefined) {
        return fail('Ariadne run manifest is malformed.', {
          job: publicJob(job),
          detail: provenance.error,
        });
      }
      const artifacts = listJobArtifacts(ctx.jobsRoot, jobId, {
        maxEntries: typeof args['maxEntries'] === 'number' ? args['maxEntries'] : undefined,
        maxDepth: typeof args['maxDepth'] === 'number' ? args['maxDepth'] : undefined,
      });
      return ok({
        job: publicJob(job),
        engineeringRun: provenance?.manifest ?? null,
        artifacts,
        note:
          provenance?.manifest === undefined
            ? 'No run manifest is available for this legacy or non-engineering job.'
            : 'requestSha256 identifies the requested operation; result.resultSha256 identifies the captured configured output when present. Preserve the Ariadne engine revision, reference snapshot, HMM libraries, ESM model configuration, and result files for a reproducible comparison.',
      });
    },
  },
  {
    name: 'ariadne_job_log',
    title: 'Read Ariadne job log',
    description:
      'Read a bounded log excerpt. Omit cursor for the latest tail, use errors/events views to reduce noise, or start at cursor=0 and follow nextCursor.',
    inputSchema: {
      jobId: jobIdSchema,
      view: z.enum(['raw', 'errors', 'events']).optional(),
      cursor: z.number().int().nonnegative().optional(),
      maxBytes: z.number().int().min(1).max(1_000_000).optional(),
      maxLines: z.number().int().min(1).max(2_000).optional(),
      tailBytes: z.number().int().min(1).max(1_000_000).optional(),
    },
    async run(args, ctx) {
      const job = getJob(ctx.jobsRoot, String(args['jobId']));
      if (job === undefined) return fail(`unknown job id: ${String(args['jobId'])}`);
      if (args['maxBytes'] !== undefined && args['tailBytes'] !== undefined) {
        return fail('Use maxBytes or tailBytes, not both.');
      }
      const excerpt = readJobLog(ctx.jobsRoot, job.id, {
        view: args['view'] === 'errors' || args['view'] === 'events' ? args['view'] : 'raw',
        cursor: typeof args['cursor'] === 'number' ? args['cursor'] : undefined,
        maxBytes:
          typeof args['maxBytes'] === 'number'
            ? args['maxBytes']
            : typeof args['tailBytes'] === 'number'
              ? args['tailBytes']
              : undefined,
        maxLines: typeof args['maxLines'] === 'number' ? args['maxLines'] : undefined,
      });
      if (excerpt === undefined) return ok({ job: publicJob(job), log: '(no log yet)' });
      const { text, ...metadata } = excerpt;
      return ok({
        job: publicJob(job),
        log: text || '(no matching log lines in this excerpt)',
        excerpt: metadata,
        next:
          excerpt.nextCursor === undefined
            ? undefined
            : `Continue with ariadne_job_log(jobId="${job.id}", cursor=${String(excerpt.nextCursor)}).`,
      });
    },
  },
  {
    name: 'ariadne_job_artifacts',
    title: 'List Ariadne job artifacts',
    description:
      'List bounded metadata below a job’s explicit output path. Symbolic links are reported but not followed; contents are not read.',
    inputSchema: {
      jobId: jobIdSchema,
      maxEntries: z.number().int().min(1).max(1_000).optional(),
      maxDepth: z.number().int().min(0).max(8).optional(),
    },
    async run(args, ctx) {
      const listing = listJobArtifacts(ctx.jobsRoot, String(args['jobId']), {
        maxEntries: typeof args['maxEntries'] === 'number' ? args['maxEntries'] : undefined,
        maxDepth: typeof args['maxDepth'] === 'number' ? args['maxDepth'] : undefined,
      });
      if (listing === undefined) return fail(`unknown job id: ${String(args['jobId'])}`);
      return ok({
        ...listing,
        note:
          listing.root === undefined
            ? 'This job did not declare --output; inspect its bounded log for backend-reported paths.'
            : undefined,
      });
    },
  },
  {
    name: 'ariadne_job_cancel',
    title: 'Cancel Ariadne job',
    description:
      'Cancel a running job gracefully, then terminate its process tree forcefully after a bounded grace period if needed.',
    inputSchema: { jobId: jobIdSchema },
    async run(args, ctx) {
      try {
        const job = await cancelJob(ctx.jobsRoot, String(args['jobId']));
        return job === undefined ? fail(`unknown job id: ${String(args['jobId'])}`) : ok(publicJob(job));
      } catch (error) {
        return fail('Could not cancel the Ariadne job.', {
          jobId: String(args['jobId']),
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    },
  },
  ...RESEARCH_TOOLS,
];

const SCIENTIFIC_ENVIRONMENT_KEYS = [
  'ARIADNE_ESM_MODEL',
  'ARIADNE_ESM_DEVICE',
  'ARIADNE_CEESS_THRESHOLD',
  'ARIADNE_TOP_K',
] as const;

function scientificConfigurationForRun(
  adapterIdentity: unknown,
  env: NodeJS.ProcessEnv,
): Record<string, unknown> | undefined {
  const configuration: Record<string, unknown> = {};
  if (isRecord(adapterIdentity)) {
    const adapterReported: Record<string, unknown> = {};
    copyConfigurationValues(adapterIdentity, adapterReported, [
      'adapter_version',
      'backend_revision',
      'python',
    ]);
    // Whitelisted, non-secret engine facts only — nested objects are never
    // passed through wholesale so credentials cannot ride along.
    const engines = isRecord(adapterIdentity['engines']) ? adapterIdentity['engines'] : undefined;
    if (engines !== undefined) {
      const enginesReported: Record<string, unknown> = {};
      for (const [engine, keys] of [
        ['hmm', ['available', 'pyhmmer']],
        ['semantic', ['available', 'model']],
        ['feature_space', ['available', 'scikit_learn']],
      ] as const) {
        const source = isRecord(engines[engine]) ? engines[engine] : undefined;
        if (source === undefined) continue;
        const selected: Record<string, unknown> = {};
        copyConfigurationValues(source, selected, keys);
        if (Object.keys(selected).length > 0) enginesReported[engine] = selected;
      }
      if (Object.keys(enginesReported).length > 0) adapterReported['engines'] = enginesReported;
    }
    const defaults = isRecord(adapterIdentity['defaults']) ? adapterIdentity['defaults'] : undefined;
    if (defaults !== undefined) {
      const selected: Record<string, unknown> = {};
      copyConfigurationValues(defaults, selected, [
        'min_score',
        'max_evalue',
        'min_coverage',
        'min_length',
        'identity_threshold',
        'ceess_threshold',
        'top_k',
        'esm_model',
      ]);
      if (Object.keys(selected).length > 0) adapterReported['defaults'] = selected;
    }
    if (Object.keys(adapterReported).length > 0) {
      configuration['adapterReported'] = adapterReported;
    }
  }

  const environmentOverrides: Record<string, string> = {};
  for (const key of SCIENTIFIC_ENVIRONMENT_KEYS) {
    const value = env[key]?.trim();
    if (value !== undefined && value !== '') environmentOverrides[key] = value;
  }
  if (Object.keys(environmentOverrides).length > 0) {
    configuration['environmentOverrides'] = environmentOverrides;
  }
  return Object.keys(configuration).length > 0 ? configuration : undefined;
}

function copyConfigurationValues(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  keys: readonly string[],
): void {
  for (const key of keys) {
    const value = source[key];
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))
    ) {
      target[key] = value;
    }
  }
}

function commandReport(result: RunResult): Record<string, unknown> {
  const parsed = parseJson(result.stdout);
  return {
    ok: result.code === 0,
    exitCode: result.code,
    timedOut: result.timedOut,
    truncated: result.stdoutTruncated || result.stderrTruncated,
    error: result.spawnError,
    result: parsed ?? (result.stdout.trim() || result.stderr.trim()),
    stderr: result.code === 0 ? undefined : result.stderr.trim() || undefined,
  };
}

function firstOutputLine(text: string, maxLength: number): string | undefined {
  const line = text
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find((value) => value !== '');
  return line === undefined ? undefined : line.slice(0, maxLength);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
