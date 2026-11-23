import { createReadStream, existsSync, lstatSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { ServerStartOptions } from '@moonshot-ai/kap-server';
import { z } from 'zod';

import { getJob } from './ariadne/jobs';
import {
  advanceResearchTask,
  cancelResearchAssignment,
  cancelResearchTask,
  createAfpkDeskTask,
  createResearchTask,
  getResearchDeskTask,
  getResearchTask,
  listResearchDeskTasks,
  needsAfpkDeskObservation,
  pendingAfpkDeskTasks,
  readAfpkDeskRequest,
  readResearchDeskArtifact,
  respondResearchTask,
  resumeAfpkDeskTask,
  retryResearchAssignment,
  type ResearchContext,
} from './ariadne/research';
import { resolveUserPath } from './paths';

const API = '/api/v1/ariadne/research';
const taskParams = z.object({ id: z.string().regex(/^research_[a-f0-9]{24}$/) });
const artifactParams = taskParams.extend({ artifactId: z.string().regex(/^[a-z0-9_-]{1,128}$/) });
const jobParams = taskParams.extend({ jobId: z.string().regex(/^job_\d{14}_[a-z0-9]{6,16}$/) });
const jobActionInput = z.strictObject({ expectedVersion: z.number().int().positive() });
const taskCancelInput = jobActionInput.extend({ reason: z.string().trim().min(1).max(4_000) });
const reviewInput = z.strictObject({
  attentionId: z.string().min(1).max(256),
  expectedVersion: z.number().int().positive(),
  action: z.enum(['approve', 'revise', 'iterate', 'conclude']),
  reason: z.string().trim().min(1).max(4_000),
});
const inputFile = z.string().trim().min(1).max(8_192);
const afpkStartBase = z.strictObject({
  requestId: z.string().trim().min(1).max(256),
  objective: z.string().trim().min(1).max(8_000),
});
const afpkStart = z.union([
  afpkStartBase.extend({ requestFile: inputFile }),
  afpkStartBase.extend({
    inputProteins: z.array(inputFile).min(1).max(32),
    ksModels: z.strictObject({ fasI: inputFile, fasII: inputFile, pks: inputFile }),
    window: z.strictObject({ min: z.number().finite(), max: z.number().finite() }),
    referenceAnchors: z.array(z.string().trim().min(1).max(512)).max(16).optional(),
    afpkFinderFiles: z.array(inputFile).max(16).optional(),
    publishedKsScoresFile: inputFile.optional(),
    runAfpkFinder: z.boolean().optional(),
  }),
]);
const researchStartBase = z.strictObject({
  requestId: z.string().trim().min(1).max(256),
  objective: z.string().trim().min(1).max(8_000),
  maxJobs: z.number().int().min(1).max(16).optional(),
  topK: z.number().int().min(1).max(10).optional(),
  workflow: z.enum(['nomination']).optional(),
});
const researchStart = z.union([
  researchStartBase.extend({ requestFile: inputFile }),
  researchStartBase.extend({
    targetClass: z.string().trim().min(1).max(512),
    inputProteins: z.array(inputFile).min(1).max(64),
    queryHmm: inputFile,
    referenceDir: inputFile,
  }),
]);

const PARTIAL_MOLLUSC_LABEL = '软体动物 AFPK · 三模型 KS 筛查';
const ORIGINAL_MOLLUSC_LABEL = '软体动物 AFPK · 原版聚类与论文对照';
const PRESET_PATHS = [
  '.ariadne/cases/afpk-mollusc/desk-request.json',
  '.tmp/AFPK/workspace-request.json',
  '.tmp/AFPK/original-comparison-request.json',
];
const PROTEIN_EXTENSIONS = new Set(['.faa', '.fa', '.fasta', '.fas', '.pep']);
const MODEL_EXTENSIONS = new Set(['.hmm', '.hmm3']);
const OMIT_DIRECTORIES = new Set(['node_modules', 'ariadne-jobs', 'dist', 'build']);

export function researchWebRoutes(
  ctx: ResearchContext,
  assetsDir: string,
): NonNullable<ServerStartOptions['registerHostRoutes']> {
  return (app) => {
    const watcher = watchAfpkTasks(ctx);
    app.addHook('onReady', async () => { watcher.recover(); });
    app.addHook('onClose', async () => { watcher.close(); });
    app.get('/research', async (request, reply) => {
      const task = taskParams.safeParse({ id: (request.query as { task?: unknown }).task });
      return reply.header('Cache-Control', 'no-store')
        .redirect(task.success ? `/?researchSession=${task.data.id}` : '/');
    });
    app.get('/research/session', async (_request, reply) => reply
      .type('text/html; charset=utf-8')
      .header('Cache-Control', 'no-cache')
      .header('Referrer-Policy', 'no-referrer')
      .header('Content-Security-Policy', "default-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'self'")
      .send(createReadStream(path.join(assetsDir, 'research-desk.html'))));

    app.register(async (routes) => {
      routes.addHook('onRequest', async (_request, reply) => {
        reply.header('Cache-Control', 'no-store');
      });
      routes.get(API, async () => ({ tasks: listResearchDeskTasks(ctx) }));
      routes.post(API, { bodyLimit: 256_000 }, async (request, reply) => {
        const input = researchStart.safeParse(request.body);
        if (!input.success) {
          return reply.code(400).send({ error: 'Provide a nomination request file or the target class, protein inputs, query profile, and reference directory.' });
        }
        const values = input.data;
        try {
          const task = createDeskResearchTask(ctx, values);
          return getResearchDeskTask(ctx, task.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'The research request could not be accepted.';
          const status = /requestId already|locked by another operation/.test(message) ? 409 : 400;
          return reply.code(status).send({ error: message });
        }
      });
      routes.get(`${API}/afpk/inputs`, async () => afpkInputs(ctx));
      routes.post(`${API}/afpk/start`, { bodyLimit: 256_000 }, async (request, reply) => {
        const input = afpkStart.safeParse(request.body);
        if (!input.success) return reply.code(400).send({ error: 'Provide an AFPK request file or the required workspace files, score window, and task details.' });
        const values = input.data;
        try {
          const query = 'requestFile' in values ? readAfpkDeskRequest(ctx, values.requestFile) : {
            workflow: 'afpk-ks',
            input_proteins: values.inputProteins,
            ks_models: { fas_i: values.ksModels.fasI, fas_ii: values.ksModels.fasII, pks: values.ksModels.pks },
            fas_i_window: values.window,
            reference_anchors: values.referenceAnchors,
            afpk_finder_files: values.afpkFinderFiles,
            published_ks_scores_file: values.publishedKsScoresFile,
            run_afpk_finder: values.runAfpkFinder,
          };
          const task = createAfpkDeskTask(ctx, values, query);
          watcher.watch(task);
          return getResearchDeskTask(ctx, task.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'The AFPK screening request could not be accepted.';
          const status = /requestId already|locked by another operation/.test(message) ? 409 : 400;
          return reply.code(status).send({ error: message });
        }
      });
      routes.post(`${API}/:id/advance`, { bodyLimit: 1024 }, async (request, reply) => {
        const params = taskParams.safeParse(request.params);
        if (!params.success) return reply.code(404).send({ error: 'Research task not found.' });
        const input = jobActionInput.safeParse(request.body);
        if (!input.success) return reply.code(400).send({ error: 'Provide the current research task version.' });
        const taskId = params.data.id;
        if (getResearchDeskTask(ctx, taskId) === undefined) return reply.code(404).send({ error: 'Research task not found.' });
        try {
          watcher.watch(await resumeAfpkDeskTask(ctx, { taskId, ...input.data }));
          return getResearchDeskTask(ctx, taskId);
        } catch (error) {
          return reply.code(409).send({ error: error instanceof Error ? error.message : 'The task could not be resumed.' });
        }
      });
      routes.get(`${API}/:id`, async (request, reply) => {
        const params = taskParams.safeParse(request.params);
        const task = params.success ? getResearchDeskTask(ctx, params.data.id) : undefined;
        if (task === undefined) return reply.code(404).send({ error: 'Research task not found.' });
        return task;
      });
      routes.get(`${API}/:id/artifacts/:artifactId`, async (request, reply) => {
        const params = artifactParams.safeParse(request.params);
        if (!params.success) return reply.code(404).send({ error: 'Research artifact not found.' });
        try {
          const artifact = readResearchDeskArtifact(ctx, params.data.id, params.data.artifactId);
          if (artifact === undefined) return await reply.code(404).send({ error: 'Research artifact not found.' });
          return artifact;
        } catch (error) {
          return reply.code(409).send({ error: error instanceof Error ? error.message : 'Artifact verification failed.' });
        }
      });
      for (const [action, run] of [['cancel', cancelResearchAssignment], ['retry', retryResearchAssignment]] as const) {
        routes.post(`${API}/:id/jobs/:jobId/${action}`, { bodyLimit: 1024 }, async (request, reply) => {
          const params = jobParams.safeParse(request.params);
          if (!params.success) return reply.code(404).send({ error: 'Research job not found.' });
          const input = jobActionInput.safeParse(request.body);
          if (!input.success) return reply.code(400).send({ error: 'Provide the current research task version.' });
          const { id: taskId, jobId } = params.data;
          if (getResearchDeskTask(ctx, taskId) === undefined) return reply.code(404).send({ error: 'Research task not found.' });
          try {
            watcher.watch(await run(ctx, { taskId, jobId, ...input.data }));
          } catch (error) {
            return reply.code(409).send({ error: error instanceof Error ? error.message : 'The job action could not be completed.' });
          }
          return getResearchDeskTask(ctx, taskId);
        });
      }
      routes.post(`${API}/:id/cancel`, { bodyLimit: 32 * 1024 }, async (request, reply) => {
        const params = taskParams.safeParse(request.params);
        if (!params.success) return reply.code(404).send({ error: 'Research task not found.' });
        const input = taskCancelInput.safeParse(request.body);
        if (!input.success) return reply.code(400).send({ error: 'Provide a reason and the current research task version.' });
        const taskId = params.data.id;
        if (getResearchDeskTask(ctx, taskId) === undefined) return reply.code(404).send({ error: 'Research task not found.' });
        try {
          await cancelResearchTask(ctx, { taskId, ...input.data });
        } catch (error) {
          return reply.code(409).send({ error: error instanceof Error ? error.message : 'The research task could not be cancelled.' });
        }
        return getResearchDeskTask(ctx, taskId);
      });
      routes.post(`${API}/:id/respond`, { bodyLimit: 32 * 1024 }, async (request, reply) => {
        const params = taskParams.safeParse(request.params);
        if (!params.success) return reply.code(404).send({ error: 'Research task not found.' });
        const input = reviewInput.safeParse(request.body);
        if (!input.success) return reply.code(400).send({ error: 'Provide a supported decision, a reason, and the current review version.' });
        const taskId = params.data.id;
        if (getResearchDeskTask(ctx, taskId) === undefined) return reply.code(404).send({ error: 'Research task not found.' });
        try {
          await respondResearchTask(ctx, { taskId, ...input.data });
        } catch (error) {
          return reply.code(409).send({ error: error instanceof Error ? error.message : 'The decision could not be recorded.' });
        }
        return getResearchDeskTask(ctx, taskId);
      });
    });
  };
}

type ResearchStartInput = z.infer<typeof researchStart>;

const MAX_DESK_REQUEST_BYTES = 256_000;

function createDeskResearchTask(ctx: ResearchContext, values: ResearchStartInput) {
  const workDir = deskWorkDir(ctx);
  const query = 'requestFile' in values
    ? readDeskRequest(workDir, values.requestFile)
    : {
        target_class: values.targetClass,
        input_proteins: values.inputProteins.map((file) => relativeDeskFile(workDir, file)),
        query_hmm: relativeDeskFile(workDir, values.queryHmm),
        reference_dir: relativeDeskFile(workDir, values.referenceDir),
      };
  const staging = mkdtempSync(path.join(tmpdir(), 'ariadne-desk-request-'));
  try {
    const requestFile = path.join(staging, 'request.json');
    writeFileSync(requestFile, `${JSON.stringify(query, null, 2)}\n`, { mode: 0o600 });
    return createResearchTask(ctx, {
      requestId: values.requestId,
      objective: values.objective,
      requestFile,
      topK: values.topK,
      maxJobs: values.maxJobs,
    });
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

function readDeskRequest(workDir: string, file: string): Record<string, unknown> {
  const absolute = deskProjectFile(workDir, file);
  const size = lstatSync(absolute).size;
  if (size > MAX_DESK_REQUEST_BYTES) throw new Error('The nomination request exceeds 256 KiB.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(absolute, 'utf8')) as unknown;
  } catch (error) {
    throw new Error(`The nomination request is not valid JSON: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('The nomination request must contain a JSON object.');
  }
  return parsed as Record<string, unknown>;
}

function deskWorkDir(ctx: ResearchContext): string {
  return realpathSync(resolveUserPath(ctx.env['ARIADNE_WORKDIR'] ?? process.cwd()));
}

function deskProjectFile(workDir: string, value: string): string {
  const file = value.trim();
  const absolute = path.resolve(workDir, file);
  const relative = path.relative(workDir, absolute);
  if (file === '' || path.isAbsolute(file) || file.startsWith('~') || relative === '' || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('Select a file inside the current Research Desk workspace using a relative path.');
  }
  if (!existsSync(absolute) || !lstatSync(absolute).isFile() || realpathSync(absolute) !== absolute) {
    throw new Error(`Select a regular project file without symbolic links: ${relative}`);
  }
  return absolute;
}

function relativeDeskFile(workDir: string, value: string): string {
  return path.relative(workDir, deskProjectFile(workDir, value));
}

function afpkInputs(ctx: ResearchContext) {
  const workDir = deskWorkDir(ctx);
  const files: { proteins: { path: string; label: string }[]; models: { path: string; label: string }[] } = { proteins: [], models: [] };
  const requests: { path: string; label: string }[] = [];
  const presets: { id: string; label: string; requestFile: string; objective: string }[] = [];
  for (const file of PRESET_PATHS) {
    try {
      const query = readAfpkDeskRequest(ctx, file);
      const id = query.run_afpk_finder === true ? 'mollusc-afpk-original' : 'mollusc-afpk-ks';
      const label = query.run_afpk_finder === true ? ORIGINAL_MOLLUSC_LABEL : PARTIAL_MOLLUSC_LABEL;
      if (!presets.some((entry) => entry.id === id)) presets.push({ id, label, requestFile: file, objective: label });
    } catch {
      continue;
    }
  }

  const directories = [{ dir: workDir, depth: 0 }];
  let visited = 0;
  let manifestChecks = 0;
  for (const { dir, depth } of directories) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); }
    catch { continue; }
    for (const entry of entries) {
      if (++visited > 6_000) return { requests, presets, files };
      if (entry.name.startsWith('.')) continue;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory() && depth < 4 && !OMIT_DIRECTORIES.has(entry.name)) directories.push({ dir: absolute, depth: depth + 1 });
      if (!entry.isFile()) continue;
      const file = path.relative(workDir, absolute).split(path.sep).join('/');
      const option = { path: file, label: file };
      const extension = path.extname(entry.name).toLowerCase();
      if (PROTEIN_EXTENSIONS.has(extension) && files.proteins.length < 300) files.proteins.push(option);
      if (MODEL_EXTENSIONS.has(extension) && files.models.length < 300) files.models.push(option);
      if (extension === '.json' && /afpk|request|screen/i.test(entry.name) && manifestChecks < 80) {
        manifestChecks++;
        try {
          readAfpkDeskRequest(ctx, file);
          requests.push(option);
        } catch {
          continue;
        }
      }
    }
  }
  return { requests, presets, files };
}

function watchAfpkTasks(ctx: ResearchContext) {
  const pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let ticking = false;
  let closed = false;

  function schedule(): void {
    if (closed || timer !== undefined || ticking || pending.size === 0) return;
    timer = setTimeout(() => {
      timer = undefined;
      ticking = true;
      void Promise.all([...pending].map(observe)).finally(() => {
        ticking = false;
        schedule();
      });
    }, 600);
    timer.unref();
  }

  async function observe(id: string): Promise<void> {
    try {
      if (closed) return;
      const task = getResearchTask(ctx, id);
      if (task === undefined || !needsAfpkDeskObservation(task)) {
        pending.delete(id);
        return;
      }
      const active = task.assignments.at(-1);
      if (task.status === 'running' && active !== undefined && getJob(ctx.jobsRoot, active.jobId)?.status === 'running') return;
      const updated = await advanceResearchTask(ctx, { taskId: id, expectedVersion: task.version });
      if (!needsAfpkDeskObservation(updated)) pending.delete(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/version conflict|locked by another operation/i.test(message)) return;
      pending.delete(id);
      process.stderr.write(`[ariadne] AFPK task observation paused: ${message}\n`);
    }
  }

  return {
    recover() {
      try { for (const id of pendingAfpkDeskTasks(ctx)) pending.add(id); }
      catch (error) { process.stderr.write(`[ariadne] Could not recover AFPK task observation: ${String(error)}\n`); }
      schedule();
    },
    watch(task: Parameters<typeof needsAfpkDeskObservation>[0]) {
      if (needsAfpkDeskObservation(task)) pending.add(task.id);
      schedule();
    },
    close() {
      closed = true;
      clearTimeout(timer);
      pending.clear();
    },
  };
}
