import { createHash, randomBytes } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readSync,
  readdirSync,
  realpathSync,
} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { DatabaseSync } from 'node:sqlite';

import { atomicWriteJson } from '../fs-utils';
import { resolveUserPath } from '../paths';
import { AFPK_OPERATION, AFPK_TOOL, AFPK_WORKFLOW, afpkRequest, finderIdentity, resolveAfpkRuntime, validateAfpkReport } from './afpk';
import { resolveAriadneBackend, runBackend, type AriadneBackend } from './backend';
import { cancelJob, getJob, readJobRunManifest, startJob, type JobSnapshot } from './jobs';
import { createEngineeringJobRequest, type JsonValue } from './provenance';

export interface ResearchContext {
  readonly homeDir?: string;
  readonly jobsRoot: string;
  readonly env: NodeJS.ProcessEnv;
}

export type ResearchStatus = 'open' | 'running' | 'waiting' | 'ready' | 'cancelled';
export type ResearchStage =
  | 'readiness'
  | 'literature'
  | 'hypothesis'
  | 'pathway'
  | 'discovery'
  | 'filtering'
  | 'nomination'
  | 'audit'
  | 'experiment'
  | 'validation'
  | 'iteration'
  | 'handoff';
type JobStage = 'discovery' | 'filtering' | 'nomination' | 'audit';
type AgentStage = 'literature' | 'hypothesis' | 'pathway' | 'experiment' | 'validation';
type ResearchResponse =
  | 'amend_request'
  | 'submit_stage'
  | 'approve'
  | 'revise'
  | 'iterate'
  | 'conclude'
  | 'retry'
  | 'proceed_without_esm';

export interface ResearchAttention {
  id: string;
  kind: string;
  stage: ResearchStage;
  status: 'open' | 'resolved';
  message: string;
  allowedActions: ResearchResponse[];
  createdAt: string;
  details?: Record<string, JsonValue>;
  resolvedAt?: string;
  resolution?: { action: ResearchResponse | 'cancel'; reason: string; authority: 'caller-declared' };
  reconciliation?: { jobId: string; status: string; authority: 'system-observed' };
}

export interface ResearchAssignment {
  id: string;
  stage: JobStage;
  jobId: string;
  status: 'launching' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'unknown';
  queryRevision: number;
  output: string;
  createdAt: string;
  finishedAt?: string;
  retryOf?: string;
  requestSha256?: string;
  resultSha256?: string;
  outputSha256?: string;
  consumed?: boolean;
  error?: string;
  notStarted?: boolean;
}

export interface ResearchQueryRevision {
  revision: number;
  path: string;
  sha256: string;
  createdAt: string;
  reason: string;
}

export interface StageArtifact {
  stage: AgentStage;
  iteration: number;
  path: string;
  sha256: string;
  createdAt: string;
}

export interface ResearchTask {
  schemaVersion: 1;
  kind: 'ariadne.research-task';
  id: string;
  workflow?: typeof AFPK_WORKFLOW;
  deskLaunch?: true;
  requestId: string;
  requestSha256: string;
  objective: string;
  version: number;
  status: ResearchStatus;
  stage: ResearchStage;
  nextAction: string;
  createdAt: string;
  updatedAt: string;
  iteration: number;
  mandate: {
    workDir: string;
    jobsRoot: string;
    outputDir: string;
    allowedOperations: string[];
    topK: number;
    maxJobs: number;
    initialQuerySha256: string;
    backend?: {
      command: string[];
      source: string;
      version: string;
      esmAvailable: boolean;
      scientificConfiguration: Record<string, JsonValue>;
      sha256: string;
    };
  };
  queryRevisions: ResearchQueryRevision[];
  stageArtifacts: StageArtifact[];
  nomination: {
    candidatesFasta?: string;
    candidatesSha256?: string;
    filteredFasta?: string;
    filteredSha256?: string;
    esmWaived?: boolean;
    esmUsed?: boolean;
    nominatedCount?: number;
    summary?: Record<string, JsonValue>;
  };
  assignments: ResearchAssignment[];
  attention: ResearchAttention[];
  events: { sequence: number; at: string; type: string; stage: ResearchStage; detail: string }[];
  eventCount: number;
  eventsTruncated: boolean;
  scientificOutcome: {
    status: 'pending' | 'blocked' | 'conditional_nomination' | 'review_required' | 'validated' | 'cancelled';
    auditStatus?: 'pass' | 'warn' | 'fail';
    limitations: string[];
    reportFile?: string;
    auditFile?: string;
    validationFile?: string;
  };
}

interface TaskPaths {
  root: string;
  dir: string;
  record: string;
  artifacts: string;
}

const TASK_ID = /^research_[a-f0-9]{24}$/;
const JOB_ID = /^job_\d{14}_[a-z0-9]{6,16}$/;
const MAX_JSON_BYTES = 2_000_000;
const MAX_QUERY_BYTES = 256_000;
const MAX_EVENTS = 128;
const MAX_REVISIONS = 16;
const MAX_ITERATIONS = 4;
const OPERATIONS = ['discover', 'filter', 'nominate', 'audit-nomination'];
const STAGE_OPERATION: Record<JobStage, string> = {
  discovery: 'discover', filtering: 'filter', nomination: 'nominate', audit: 'audit-nomination',
};
const STAGE_TOOL: Record<JobStage, string> = {
  discovery: 'ariadne_research_discovery', filtering: 'ariadne_research_filtering',
  nomination: 'ariadne_research_nomination', audit: 'ariadne_research_audit',
};
const AGENT_STAGE_NEXT: Record<AgentStage, ResearchStage> = {
  literature: 'hypothesis',
  hypothesis: 'hypothesis',
  pathway: 'discovery',
  experiment: 'validation',
  validation: 'iteration',
};
const AGENT_STAGE_PROMPT: Record<AgentStage, string> = {
  literature: 'Deposit a literature-review JSON artifact (sources, findings, gaps) for the nomination objective.',
  hypothesis: 'Deposit a hypothesis JSON artifact (hypotheses with statement, rationale, testable prediction, literature refs).',
  pathway: 'Deposit a pathway-reconstruction JSON artifact (substrate, product, steps, enzyme slots linked to the target class).',
  experiment: 'Deposit an experimental-design JSON artifact (designs per nominated candidate: system, construct, assay, controls, decision criteria).',
  validation: 'Deposit a validation-record JSON artifact (records with outcome supported/refuted/inconclusive, measurements, interpretation).',
};
const DESK_STAGE_ROLES: Record<AgentStage | JobStage, string> = {
  literature: 'Literature Surveyor',
  hypothesis: 'Hypothesis Architect',
  pathway: 'Pathway Reconstructor',
  discovery: 'Nomination Steward',
  filtering: 'Nomination Steward',
  nomination: 'Nomination Steward',
  audit: 'Nomination Steward',
  experiment: 'Experimental Designer',
  validation: 'Validation Interpreter',
};
const LIMITATIONS = [
  'This workflow supports computational candidate nomination with auditable evidence, not experimental proof of function or product formation.',
  'HMM scores, ESM probabilities, and nearest-reference distances are screening signals; heterologous expression and product confirmation remain necessary.',
  'Request and output fingerprints do not freeze remote model behavior, ESM checkpoint provenance, or reference-database completeness.',
  'The mandate limits backend job submissions, not remote API tokens, monetary cost, or elapsed time.',
];
const AFPK_LIMITATIONS = [
  'The KS screen gives a putative enzyme-family assignment for pre-extracted KS domains. It does not establish organismal origin, enzyme function, or product identity.',
  'The FAS I score window is tied to the selected profiles and dataset. Domain architecture, taxonomic QC, and phylogenetic evidence require independent assessment.',
  'New and published AFPK-finder clusters are separate evidence. Cluster numbers are specific to a run, and the three-profile comparison supplies the shortlist.',
];

function researchLimitations(workflow: ResearchTask['workflow']): string[] {
  return [...(workflow === AFPK_WORKFLOW ? AFPK_LIMITATIONS : LIMITATIONS)];
}

export function createResearchTask(ctx: ResearchContext, input: {
  requestId: string; objective: string; requestFile: string; topK?: number; maxJobs?: number;
}): ResearchTask {
  const workDir = currentWorkDir(ctx);
  const query = readJson(resolveInput(input.requestFile, workDir), MAX_QUERY_BYTES);
  return registerResearchTask(ctx, input, workDir, query);
}

export function createAfpkDeskTask(ctx: ResearchContext, input: { requestId: string; objective: string }, query: unknown): ResearchTask {
  const workDir = currentWorkDir(ctx);
  return registerResearchTask(ctx, input, workDir, deskAfpkRequest(workDir, query), true);
}

export function readAfpkDeskRequest(ctx: ResearchContext, file: string) {
  const workDir = currentWorkDir(ctx);
  return deskAfpkRequest(workDir, readJson(deskProjectFile(workDir, file), MAX_QUERY_BYTES));
}

function registerResearchTask(ctx: ResearchContext, input: {
  requestId: string; objective: string; topK?: number; maxJobs?: number;
}, workDir: string, query: Record<string, unknown>, deskLaunch?: true): ResearchTask {
  const requestId = text(input.requestId, 'requestId', 256);
  const objective = text(input.objective, 'objective', 8_000);
  const topK = integer(input.topK ?? 5, 'topK', 1, 10);
  const maxJobs = integer(input.maxJobs ?? 6, 'maxJobs', 1, 16);
  validateRequest(query);
  const workflow = query['workflow'] === AFPK_WORKFLOW ? AFPK_WORKFLOW : undefined;
  const queryText = `${JSON.stringify(query, null, 2)}\n`;
  const id = `research_${hash(canonical({ requestId, workDir })).slice(0, 24)}`;
  const initialQuerySha256 = hash(canonical(query));
  const requestSha256 = hash(canonical({ requestId, objective, workDir, topK, maxJobs, initialQuerySha256, deskLaunch }));
  const paths = taskPaths(ctx, id, true);
  const registered = (): ResearchTask | undefined => {
    const previous = readTask(paths, ctx);
    if (previous !== undefined) {
      if (previous.requestSha256 !== requestSha256) {
        throw new Error('requestId already identifies a different research mandate or request; use a new requestId.');
      }
      verifyRevision(previous, paths);
    }
    return previous;
  };
  if (deskLaunch === true) {
    const previous = registered();
    if (previous !== undefined) return previous;
  }
  const release = acquireLock(paths, id);
  try {
    const previous = registered();
    if (previous !== undefined) return previous;
    privateDirectory(paths.dir);
    privateDirectory(paths.artifacts);
    const queryPath = path.join(paths.artifacts, 'request-1.json');
    atomicWriteJson(queryPath, query);
    const now = new Date().toISOString();
    const task: ResearchTask = {
      schemaVersion: 1, kind: 'ariadne.research-task', id, requestId, requestSha256, objective, workflow, deskLaunch,
      version: 1, status: 'open', stage: 'readiness', nextAction: 'Call advance to check runtime readiness.',
      createdAt: now, updatedAt: now, iteration: 1,
      mandate: { workDir, jobsRoot: path.resolve(ctx.jobsRoot), outputDir: paths.artifacts,
        allowedOperations: workflow === AFPK_WORKFLOW ? [AFPK_OPERATION] : [...OPERATIONS], topK, maxJobs, initialQuerySha256 },
      queryRevisions: [{ revision: 1, path: queryPath, sha256: hash(queryText), createdAt: now, reason: 'Initial caller-supplied nomination request.' }],
      stageArtifacts: [], nomination: {}, assignments: [], attention: [], events: [], eventCount: 0, eventsTruncated: false,
      scientificOutcome: { status: 'pending', limitations: researchLimitations(workflow) },
    };
    event(task, 'created', deskLaunch
      ? 'The caller requested a bounded AFPK screen from the Research Desk. No backend operation has run.'
      : 'Registered a bounded scientific-discovery mandate; no backend operation has run.');
    atomicWriteJson(paths.record, task);
    return task;
  } finally { release(); }
}

export function getResearchTask(ctx: ResearchContext, taskId: string): ResearchTask | undefined {
  return readTask(taskPaths(ctx, taskId, false), ctx);
}

export function listResearchTasks(ctx: ResearchContext, options: {
  limit?: number; status?: ResearchStatus;
} = {}): ResearchTask[] {
  const limit = integer(options.limit ?? 20, 'limit', 1, 100);
  if (options.status !== undefined && !['open', 'running', 'waiting', 'ready', 'cancelled'].includes(options.status)) {
    throw new Error('Invalid research status filter.');
  }
  return researchTaskInventory(ctx).filter((task) => options.status === undefined || task.status === options.status).slice(0, limit);
}

function researchTaskInventory(ctx: ResearchContext): ResearchTask[] {
  const root = path.join(path.resolve(ctx.jobsRoot), 'research');
  if (!existsSync(root)) return [];
  regularDirectory(root);
  const tasks: ResearchTask[] = [];
  const entries = readdirSync(root);
  if (entries.length > 10_000) throw new Error('Research task inventory exceeds 10000 entries.');
  for (const id of entries.filter((entry) => TASK_ID.test(entry))) {
    const task = readTask(taskPaths(ctx, id, false), ctx, true);
    if (task !== undefined) tasks.push(task);
  }
  return tasks.toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export interface ResearchDeskArtifact {
  id: string;
  label: string;
  kind: 'request' | 'stage' | 'engine';
  stage?: ResearchStage;
  role?: string;
  iteration?: number;
  queryRevision?: number;
  sha256: string;
}

export function listResearchDeskTasks(ctx: ResearchContext) {
  return researchTaskInventory(ctx).map((task) => deskTaskSummary(task, task.objective.slice(0, 512)));
}

export function pendingAfpkDeskTasks(ctx: ResearchContext): string[] {
  return researchTaskInventory(ctx).filter(needsAfpkDeskObservation).map((task) => task.id);
}

export function needsAfpkDeskObservation(task: ResearchTask): boolean {
  return task.workflow === AFPK_WORKFLOW && (task.status === 'running' ||
    (task.deskLaunch === true && task.status === 'open' && task.assignments.length === 0 &&
      task.queryRevisions.length === 1 && (task.stage === 'readiness' || task.stage === 'discovery')));
}

export async function resumeAfpkDeskTask(ctx: ResearchContext, input: { taskId: string; expectedVersion: number }): Promise<ResearchTask> {
  return mutateTask(ctx, input.taskId, input.expectedVersion, async (task, paths) => {
    if (task.workflow !== AFPK_WORKFLOW || task.deskLaunch !== true) throw new Error('This AFPK task was created outside the Research Desk.');
    const gate = deskReadinessRetry(task);
    if (gate === undefined) {
      if (!needsAfpkDeskObservation(task)) throw new Error('This research task has no computation ready to resume.');
      return task;
    }
    resolveAttention(gate, 'retry', 'The caller requested another runtime check in Research Desk.');
    task.status = 'open';
    event(task, 'response', 'The caller requested another AFPK runtime check in Research Desk.');
    return saveTask(task, paths);
  });
}

function deskReadinessRetry(task: ResearchTask): ResearchAttention | undefined {
  if (task.deskLaunch !== true || task.status !== 'waiting' || task.stage !== 'readiness' || task.assignments.length > 0) return undefined;
  return task.attention.find((item) => item.status === 'open' && item.kind === 'environment_readiness' && item.allowedActions.includes('retry'));
}

export function getResearchDeskTask(ctx: ResearchContext, taskId: string) {
  const task = readTask(taskPaths(ctx, taskId, false), ctx, true);
  if (task === undefined) return undefined;
  const active = currentUnconsumedAssignment(task);
  const observed = active === undefined ? undefined : getJob(ctx.jobsRoot, active.jobId);
  const verified = active !== undefined && observed !== undefined && matchesResearchAssignment(ctx, task, active, observed);
  const canCancel = verified && observed.status === 'running' && canCancelAssignment(task);
  const canRetry = verified && isRetryableJob(observed) && canRetryAssignment(task);
  const budgetAvailable = task.assignments.length < task.mandate.maxJobs;
  const artifacts = deskArtifacts(task);
  const afpkReport = task.workflow === AFPK_WORKFLOW ? artifacts.findLast(({ record }) =>
    'jobId' in record && record.queryRevision === currentRevision(task).revision) : undefined;
  const afpkReview = afpkReport && 'jobId' in afpkReport.record && afpkReport.record.output === task.scientificOutcome.reportFile
    ? task.attention.findLast((item) => item.kind === 'afpk_nomination_review') : undefined;

  return {
    ...deskTaskSummary(task, task.objective),
    canCancelTask: task.status !== 'cancelled',
    canResume: deskReadinessRetry(task) !== undefined,
    autoProgress: task.deskLaunch === true && needsAfpkDeskObservation(task),
    afpkEvidence: afpkReport ? { artifactId: afpkReport.artifact.id, attentionId: afpkReview?.id } : undefined,
    version: task.version,
    nextAction: task.nextAction,
    scientificOutcome: {
      status: task.scientificOutcome.status,
      auditStatus: task.scientificOutcome.auditStatus,
      limitations: task.scientificOutcome.limitations,
    },
    jobsUsed: task.assignments.length,
    maxJobs: task.mandate.maxJobs,
    attention: task.attention.map((item) => ({
      id: item.id,
      kind: item.kind,
      stage: item.stage,
      status: item.status,
      message: item.message,
      allowedActions: task.status === 'cancelled' ? [] : item.allowedActions,
      createdAt: item.createdAt,
      resolvedAt: item.resolvedAt,
      resolution: item.resolution === undefined ? undefined : {
        action: item.resolution.action,
        reason: item.resolution.reason,
        authority: item.resolution.authority,
      },
    })),
    assignments: task.assignments.map((entry) => ({
      id: entry.id,
      stage: entry.stage,
      role: DESK_STAGE_ROLES[entry.stage],
      jobId: entry.jobId,
      status: entry === active ? (observed?.status ?? entry.status) : entry.status,
      canCancel: entry === active && canCancel,
      canRetry: entry === active && canRetry && budgetAvailable,
      retryUnavailable: entry === active && canRetry && !budgetAvailable ? 'budget_exhausted' as const : undefined,
      queryRevision: entry.queryRevision,
      createdAt: entry.createdAt,
      finishedAt: entry === active ? (observed?.finishedAt ?? entry.finishedAt) : entry.finishedAt,
      retryOf: entry.retryOf,
      requestSha256: entry.requestSha256,
      resultSha256: entry.resultSha256,
      outputSha256: entry.outputSha256,
      consumed: entry.consumed,
      notStarted: entry.notStarted,
    })),
    artifacts: artifacts.map(({ artifact }) => artifact),
    events: task.events.map(({ sequence, at, type, stage, detail }) => ({ sequence, at, type, stage, detail })),
    eventsTruncated: task.eventsTruncated,
  };
}

export function cancelResearchAssignment(ctx: ResearchContext, input: {
  taskId: string; jobId: string; expectedVersion: number;
}): Promise<ResearchTask> {
  return mutateTask(ctx, input.taskId, input.expectedVersion, async (task, paths) => {
    const assignment = currentUnconsumedAssignment(task);
    if (assignment === undefined || assignment.jobId !== input.jobId || !canCancelAssignment(task)) {
      throw new Error('This job is no longer the active assignment for the research task.');
    }
    const job = getJob(ctx.jobsRoot, assignment.jobId);
    if (job?.status === 'running') {
      if (!matchesResearchAssignment(ctx, task, assignment, job)) {
        throw new Error('The running job could not be verified against this research task.');
      }
      await cancelJob(ctx.jobsRoot, assignment.jobId);
    }
    observeAssignment(ctx, task, paths, assignment);
    return task;
  });
}

export function retryResearchAssignment(ctx: ResearchContext, input: {
  taskId: string; jobId: string; expectedVersion: number;
}): Promise<ResearchTask> {
  return mutateTask(ctx, input.taskId, input.expectedVersion, async (task, paths) => {
    const assignment = currentUnconsumedAssignment(task);
    if (assignment === undefined || assignment.jobId !== input.jobId || !canRetryAssignment(task)) {
      throw new Error('This job is no longer the current attempt eligible for retry.');
    }
    if (task.assignments.length >= task.mandate.maxJobs) throw new Error('The research task has used its job budget.');
    const job = getJob(ctx.jobsRoot, assignment.jobId);
    if (job === undefined || !isRetryableJob(job) || !matchesResearchAssignment(ctx, task, assignment, job)) {
      throw new Error('Retry requires a verified failed or cancelled engine job.');
    }
    verifyRevision(task, paths);
    if (needsEsmDecision(task)) throw new Error('An explicit ESM scoring decision is required before nomination.');

    // A job can finish between Desk refreshes, before the controller records its failure.
    if (!task.attention.some((item) => isExecutionRetry(item, assignment.stage))) {
      observeAssignment(ctx, task, paths, assignment);
    }
    const gates = task.attention.filter((item) => item.status === 'open');
    const gate = gates[0];
    if (gates.length !== 1 || gate === undefined || !isExecutionRetry(gate, assignment.stage)) {
      throw new Error('The research task no longer has a single retry decision for this job.');
    }
    assignment.consumed = true;
    resolveAttention(gate, 'retry', 'Retry requested from the Research Desk.');
    event(task, 'response', `Retry requested for ${assignment.jobId} from the Research Desk.`);
    // launchAssignment persists the retry decision together with the new reserved job ID.
    await launchAssignment(ctx, task, paths, assignment.stage);
    return task;
  });
}

export function readResearchDeskArtifact(ctx: ResearchContext, taskId: string, artifactId: string) {
  const paths = taskPaths(ctx, taskId, false);
  const task = readTask(paths, ctx, true);
  if (task === undefined) return undefined;
  const selected = deskArtifacts(task).find(({ artifact }) => artifact.id === artifactId);
  if (selected === undefined) return undefined;

  const { artifact, record } = selected;
  const content = 'jobId' in record
    ? readVerifiedAssignment(ctx, task, paths, record)
    : readFrozenArtifact(paths, record);
  return { artifact, content };
}

function deskTaskSummary(task: ResearchTask, objective: string) {
  return {
    id: task.id,
    workflow: task.workflow,
    objective,
    status: task.status,
    waitingReason: task.status === 'waiting' || task.status === 'open'
      ? task.attention.find((item) => item.status === 'open')?.kind
      : undefined,
    stage: task.stage,
    iteration: task.iteration,
    updatedAt: task.updatedAt,
    scientificStatus: task.scientificOutcome.status,
  };
}

function deskArtifacts(task: ResearchTask): {
  artifact: ResearchDeskArtifact;
  record: ResearchQueryRevision | StageArtifact | ResearchAssignment;
}[] {
  return [
    ...task.queryRevisions.map((record) => ({
      record,
      artifact: {
        id: `request-${String(record.revision)}`,
        label: 'Research request',
        kind: 'request' as const,
        queryRevision: record.revision,
        sha256: record.sha256,
      },
    })),
    ...task.stageArtifacts.map((record) => ({
      record,
      artifact: {
        id: `stage-${String(record.iteration)}-${record.stage}-${record.sha256.slice(0, 16)}`,
        label: `${record.stage[0]!.toUpperCase()}${record.stage.slice(1)} record`,
        kind: 'stage' as const,
        stage: record.stage,
        role: DESK_STAGE_ROLES[record.stage],
        iteration: record.iteration,
        sha256: record.sha256,
      },
    })),
    ...task.assignments.flatMap((record) => {
      if (record.status !== 'succeeded' || !record.consumed || record.outputSha256 === undefined) return [];
      return [{
        record,
        artifact: {
          id: `engine-${record.id}`,
          label: task.workflow === AFPK_WORKFLOW ? 'AFPK KS screening and nomination' : `${record.stage[0]!.toUpperCase()}${record.stage.slice(1)} result`,
          kind: 'engine' as const,
          stage: record.stage,
          role: DESK_STAGE_ROLES[record.stage],
          queryRevision: record.queryRevision,
          sha256: record.outputSha256,
        },
      }];
    }),
  ];
}

export async function advanceResearchTask(ctx: ResearchContext, input: {
  taskId: string; expectedVersion?: number;
}): Promise<ResearchTask> {
  return mutateTask(ctx, input.taskId, input.expectedVersion, async (task, paths) => {
    if (task.status === 'cancelled') return task;
    if (task.status === 'ready') {
      try { verifyHandoff(ctx, task, paths); }
      catch (error) {
        task.scientificOutcome.status = 'review_required';
        attention(task, 'integrity', `Research handoff artifacts no longer match the verified run: ${errorMessage(error)}`, ['amend_request']);
        saveTask(task, paths);
      }
      return task;
    }
    if (task.attention.some((item) => item.status === 'open' && item.kind !== 'execution_unknown')) return task;
    const active = latestAssignment(task);
    if (active !== undefined && !active.consumed) {
      const outcome = observeAssignment(ctx, task, paths, active);
      if (outcome === 'running' || outcome === 'waiting') return task;
      if (task.stage === 'handoff' || task.attention.some((item) => item.status === 'open')) return task;
    }
    if (task.attention.some((item) => item.status === 'open')) return task;
    try {
      verifyRevision(task, paths);
      verifyDependencies(ctx, task, paths);
    }
    catch (error) {
      attention(task, 'integrity', errorMessage(error), []);
      return saveTask(task, paths);
    }
    if (task.stage === 'readiness') {
      if (task.workflow === AFPK_WORKFLOW) {
        if (!(await ensureAfpkReady(ctx, task, paths))) return task;
        task.stage = 'discovery';
      } else {
        if (!(await ensureReady(ctx, task, paths))) return task;
        task.stage = 'literature';
        requestAgentArtifact(task, 'literature');
      }
      return saveTask(task, paths);
    }
    if (task.stage === 'handoff' || task.stage === 'iteration') {
      if (task.stage === 'iteration') openIterationDecision(task);
      return saveTask(task, paths);
    }
    if (isAgentStage(task.stage)) {
      requestAgentArtifact(task, task.stage);
      return saveTask(task, paths);
    }
    if (task.assignments.length >= task.mandate.maxJobs) {
      attention(task, 'budget_exhausted', 'The frozen job budget is exhausted. Create a separately authorized research task to expand scope.', []);
      return saveTask(task, paths);
    }
    if (needsEsmDecision(task)) {
      attention(task, 'esm_unavailable',
        'ESM2 semantic scoring is unavailable in the frozen backend (torch/transformers missing). Waive it explicitly to nominate with HMM + feature-space evidence only, or amend the request.',
        ['proceed_without_esm', 'amend_request']);
      return saveTask(task, paths);
    }
    try { await launchAssignment(ctx, task, paths, task.stage as JobStage); }
    catch (error) {
      attention(task, 'integrity', errorMessage(error), ['amend_request']);
      saveTask(task, paths);
    }
    return task;
  });
}

export async function respondResearchTask(ctx: ResearchContext, input: {
  taskId: string; attentionId: string; expectedVersion: number; action: ResearchResponse;
  artifactFile?: string; requestFile?: string; reason: string;
}): Promise<ResearchTask> {
  const reason = text(input.reason, 'reason', 4_000);
  integer(input.expectedVersion, 'expectedVersion', 1, Number.MAX_SAFE_INTEGER);
  return mutateTask(ctx, input.taskId, input.expectedVersion, async (task, paths) => {
    if (task.status === 'ready' || task.status === 'cancelled') throw new Error('A closed research task cannot accept responses.');
    const item = task.attention.find((entry) => entry.id === input.attentionId && entry.status === 'open');
    if (item === undefined) throw new Error('Unknown or resolved research attention id.');
    if (!item.allowedActions.includes(input.action)) throw new Error(`Action ${input.action} is not allowed for this attention item.`);
    const latest = latestAssignment(task);
    const job = latest === undefined ? undefined : getJob(ctx.jobsRoot, latest.jobId);
    if (job?.status === 'running' || job?.status === 'unknown' || (latest !== undefined && !latest.consumed && !latest.notStarted && job === undefined)) {
      throw new Error('The original job is active or its terminal state is unknown; do not revise or resubmit it.');
    }
    if (input.action !== 'amend_request') verifyRevision(task, paths);
    if (input.action === 'amend_request') {
      if (input.requestFile === undefined) throw new Error('amend_request requires requestFile.');
      if (task.queryRevisions.length >= MAX_REVISIONS) throw new Error('The research request revision limit is exhausted.');
      const query = readJson(resolveInput(input.requestFile, task.mandate.workDir), MAX_QUERY_BYTES);
      validateRequest(query);
      if ((query['workflow'] === AFPK_WORKFLOW) !== (task.workflow === AFPK_WORKFLOW)) {
        throw new Error('A request amendment must keep the original research workflow.');
      }
      const revision = task.queryRevisions.length + 1;
      const queryPath = path.join(paths.artifacts, `request-${String(revision)}.json`);
      atomicWriteJson(queryPath, query);
      task.queryRevisions.push({ revision, path: queryPath, sha256: fileHash(queryPath, MAX_QUERY_BYTES), createdAt: new Date().toISOString(), reason });
      if (latest !== undefined) latest.consumed = true;
      task.nomination = {};
      task.stage = task.workflow === AFPK_WORKFLOW ? 'readiness' : 'literature';
      task.scientificOutcome = { status: 'pending', limitations: researchLimitations(task.workflow) };
      for (const open of task.attention.filter((entry) => entry.status === 'open')) resolveAttention(open, input.action, reason);
    } else if (input.action === 'submit_stage') {
      if (!isAgentStage(task.stage)) throw new Error('submit_stage requires a knowledge stage (literature, hypothesis, pathway, experiment, validation).');
      if (input.artifactFile === undefined) throw new Error('submit_stage requires artifactFile.');
      const artifact = readJson(resolveInput(input.artifactFile, task.mandate.workDir), MAX_QUERY_BYTES);
      validateStageArtifact(task.stage, artifact);
      const frozenPath = path.join(paths.artifacts, `iter${String(task.iteration)}-${task.stage}.json`);
      atomicWriteJson(frozenPath, artifact);
      task.stageArtifacts = task.stageArtifacts.filter((entry) => !(entry.stage === task.stage && entry.iteration === task.iteration));
      task.stageArtifacts.push({ stage: task.stage, iteration: task.iteration, path: frozenPath, sha256: fileHash(frozenPath, MAX_QUERY_BYTES), createdAt: new Date().toISOString() });
      event(task, 'artifact_submitted', `Froze ${task.stage} artifact for iteration ${String(task.iteration)}.`);
      resolveAttention(item, input.action, reason);
      if (task.stage === 'hypothesis') {
        attention(task, 'stage_review', 'Hypotheses must be reviewed and approved before computational nomination is launched.', ['approve', 'revise']);
      } else {
        task.stage = AGENT_STAGE_NEXT[task.stage as AgentStage];
      }
    } else if (input.action === 'approve') {
      if (task.workflow === AFPK_WORKFLOW && item.kind === 'afpk_nomination_review') {
        verifyAfpkReview(ctx, task, paths);
        task.stage = 'handoff';
        task.status = 'ready';
        task.scientificOutcome.status = 'conditional_nomination';
        event(task, 'handoff_ready', 'The caller accepted the putative AFPK shortlist for computational handoff.');
      } else if (item.kind === 'stage_review') {
        verifyStageArtifact(task, paths, 'hypothesis');
        task.stage = 'pathway';
        event(task, 'gate_passed', 'Hypotheses approved (caller-declared); pathway reconstruction may proceed.');
      } else if (item.kind === 'nomination_review') {
        verifyNominationReview(ctx, task, paths);
        task.stage = 'experiment';
        event(task, 'gate_passed', 'Nominated candidates approved (caller-declared); experimental design may proceed.');
      } else throw new Error('approve applies to a review gate.');
      resolveAttention(item, input.action, reason);
    } else if (input.action === 'revise') {
      resolveAttention(item, input.action, reason);
      if (task.workflow === AFPK_WORKFLOW && item.kind === 'afpk_nomination_review') {
        attention(task, 'afpk_revision', 'Record an amended KS request before screening a replacement shortlist.', ['amend_request']);
      } else if (item.kind === 'stage_review') {
        requestAgentArtifact(task, 'hypothesis');
      } else throw new Error('revise applies to a hypothesis or AFPK shortlist review gate.');
    } else if (input.action === 'iterate') {
      if (item.kind !== 'iteration_decision') throw new Error('iterate applies to the iteration decision.');
      if (task.iteration >= MAX_ITERATIONS) throw new Error(`The iteration limit (${String(MAX_ITERATIONS)}) is exhausted; conclude or create a new task.`);
      task.iteration += 1;
      task.stage = 'hypothesis';
      task.scientificOutcome.status = 'pending';
      requestAgentArtifact(task, 'hypothesis');
      resolveAttention(item, input.action, reason);
      event(task, 'iteration_opened', `Iteration ${String(task.iteration)} started from revised hypotheses informed by validation records.`);
    } else if (input.action === 'conclude') {
      if (item.kind !== 'iteration_decision') throw new Error('conclude applies to the iteration decision.');
      verifyConcludeLineage(ctx, task, paths);
      resolveAttention(item, input.action, reason);
      task.stage = 'handoff';
      task.status = 'ready';
      task.scientificOutcome.status = 'validated';
      task.scientificOutcome.validationFile = stageArtifactFor(task, 'validation')?.path;
      event(task, 'handoff_ready', 'Verified nomination, experimental design, and validation lineage is ready for handoff; this is not proof of natural-product formation.');
    } else if (input.action === 'proceed_without_esm') {
      if (item.kind !== 'esm_unavailable') throw new Error('proceed_without_esm applies to the ESM availability gate.');
      task.nomination.esmWaived = true;
      task.scientificOutcome.status = 'conditional_nomination';
      task.scientificOutcome.limitations.push('ESM2 semantic scoring was waived by caller decision; nomination relies on HMM and feature-space evidence only.');
      resolveAttention(item, input.action, reason);
    } else {
      if (item.kind !== 'environment_readiness' && (latest === undefined || job === undefined || !['failed', 'cancelled'].includes(job.status))) {
        throw new Error('Retry requires a confirmed failed/cancelled job or a restored runtime-readiness gate.');
      }
      if (item.kind !== 'environment_readiness' && latest !== undefined) latest.consumed = true;
      resolveAttention(item, input.action, reason);
    }
    if (task.status !== 'ready' && !(task.workflow === AFPK_WORKFLOW && input.action === 'revise')) task.status = 'open';
    event(task, 'response', `${input.action}: ${reason} (caller-declared; no independent human approval is asserted).`);
    return saveTask(task, paths);
  });
}

export async function cancelResearchTask(ctx: ResearchContext, input: {
  taskId: string; expectedVersion?: number; reason: string;
}): Promise<ResearchTask> {
  const reason = text(input.reason, 'reason', 4_000);
  return mutateTask(ctx, input.taskId, input.expectedVersion, async (task, paths) => {
    if (task.status === 'cancelled') return task;
    const atHandoff = task.status === 'ready';
    const unconsumed = atHandoff ? [] : task.assignments.filter((entry) => !entry.consumed);
    for (const assignment of unconsumed) {
      if (assignment.notStarted) { assignment.consumed = true; continue; }
      let job = getJob(ctx.jobsRoot, assignment.jobId);
      if (job?.status === 'running') {
        try {
          if (!matchesResearchAssignment(ctx, task, assignment, job)) {
            throw new Error('The running job could not be verified against this research task.');
          }
          job = await cancelJob(ctx.jobsRoot, assignment.jobId);
        }
        catch (error) {
          attention(task, 'execution_unknown', `Cancellation was not confirmed: ${errorMessage(error)}`, []);
          return saveTask(task, paths);
        }
      }
      if (job === undefined || job.status === 'unknown' || job.status === 'running') {
        assignment.status = 'unknown';
        attention(task, 'execution_unknown', 'Cancellation cannot be confirmed for the original job. Its id is preserved; no replacement was launched.', []);
        return saveTask(task, paths);
      }
      assignment.status = job.status;
      assignment.finishedAt = job.finishedAt;
      if (job.status === 'succeeded') {
        try { verifiedOutput(ctx, task, paths, job, assignment, {}); }
        catch (error) { assignment.error = errorMessage(error); }
      }
      assignment.consumed = true;
    }
    for (const item of task.attention.filter((entry) => entry.status === 'open')) {
      resolveAttention(item, 'cancel', reason);
    }
    if (!atHandoff) task.scientificOutcome.status = 'cancelled';
    task.status = 'cancelled';
    event(task, 'cancelled', reason);
    return saveTask(task, paths);
  });
}

async function mutateTask(ctx: ResearchContext, id: string, expectedVersion: number | undefined,
  mutate: (task: ResearchTask, paths: TaskPaths) => Promise<ResearchTask>): Promise<ResearchTask> {
  if (expectedVersion !== undefined) integer(expectedVersion, 'expectedVersion', 1, Number.MAX_SAFE_INTEGER);
  const paths = taskPaths(ctx, id, false);
  if (!existsSync(paths.record)) throw new Error(`Unknown research task: ${id}`);
  const release = acquireLock(paths, id);
  try {
    const task = readTask(paths, ctx);
    if (task === undefined) throw new Error(`Unknown research task: ${id}`);
    if (expectedVersion !== undefined && task.version !== expectedVersion) {
      throw new Error(`Research version conflict: expected ${String(expectedVersion)}, current ${String(task.version)}. Read the task before retrying.`);
    }
    return await mutate(task, paths);
  } finally { release(); }
}

async function ensureReady(ctx: ResearchContext, task: ResearchTask, paths: TaskPaths): Promise<boolean> {
  try {
    const backend = resolveAriadneBackend(ctx.env, ctx.homeDir);
    if (backend === undefined) throw new Error('No Ariadne backend is configured.');
    if (task.mandate.backend !== undefined && canonical(backend.command) !== canonical(task.mandate.backend.command)) {
      attention(task, 'configuration_drift', 'The backend command changed after the research mandate was frozen. Create a new task for a different backend.', []);
      saveTask(task, paths); return false;
    }
    const result = await runBackend(backend, ['health', '--json'], { cwd: task.mandate.workDir, env: ctx.env, timeoutMs: 30_000, maxOutputBytes: MAX_QUERY_BYTES });
    const health = parseObject(result.stdout);
    if (result.code !== 0 || result.timedOut || result.stdoutTruncated || health?.['ready_for_pipeline'] !== true || health['ok'] === false) {
      throw new Error('The backend has not confirmed engines, dependencies, and reference data ready for the nomination pipeline. Restore the environment and explicitly retry.');
    }
    const [versionResult, identityResult] = await Promise.all([
      runBackend(backend, ['--version'], { cwd: task.mandate.workDir, env: ctx.env, timeoutMs: 30_000, maxOutputBytes: 4_000 }),
      runBackend(backend, ['identity'], { cwd: task.mandate.workDir, env: ctx.env, timeoutMs: 30_000, maxOutputBytes: MAX_QUERY_BYTES }),
    ]);
    if (versionResult.code !== 0 || identityResult.code !== 0 || versionResult.timedOut || identityResult.timedOut || versionResult.stdoutTruncated || identityResult.stdoutTruncated || versionResult.stdout.trim() === '') throw new Error('Backend version and scientific identity could not be confirmed.');
    const identity = parseObject(identityResult.stdout);
    if (identity === undefined) throw new Error('Backend identity is not a JSON object.');
    const configuration = scientificConfiguration(identity, ctx.env);
    const enginesIdentity = isRecord(identity['engines']) ? identity['engines'] : undefined;
    const semanticIdentity = enginesIdentity !== undefined && isRecord(enginesIdentity['semantic'])
      ? enginesIdentity['semantic']
      : undefined;
    const esmAvailable = semanticIdentity?.['available'] === true;
    const version = versionResult.stdout.trim().slice(0, 1_000);
    const sha256 = hash(canonical({ command: backend.command, version, configuration }));
    if (task.mandate.backend !== undefined && task.mandate.backend.sha256 !== sha256) {
      attention(task, 'configuration_drift', 'The backend revision or non-secret scientific settings changed between stages. Preserve this run and create a new task for the changed configuration.', []);
      saveTask(task, paths); return false;
    }
    if (task.mandate.backend === undefined) {
      task.mandate.backend = { command: [...backend.command], source: backend.source, version, esmAvailable, scientificConfiguration: configuration, sha256 };
      event(task, 'readiness', 'Confirmed runtime readiness and froze backend/scientific configuration identity.');
      saveTask(task, paths);
    }
    return true;
  } catch (error) {
    attention(task, 'environment_readiness', errorMessage(error), ['retry']);
    saveTask(task, paths); return false;
  }
}

async function ensureAfpkReady(ctx: ResearchContext, task: ResearchTask, paths: TaskPaths): Promise<boolean> {
  try {
    const { backend, finderArgs } = resolveAfpkRuntime(ctx.env, ctx.homeDir);
    if (backend === undefined) throw new Error('Set ARIADNE_AFPK_PYTHON to a Python interpreter with pyhmmer installed.');
    const result = await runBackend(backend, ['--version'], {
      cwd: task.mandate.workDir, env: ctx.env, timeoutMs: 10_000, maxOutputBytes: 4_000,
    });
    const version = result.stdout.trim();
    if (result.code !== 0 || result.timedOut || result.stdoutTruncated || version === '') {
      throw new Error(`AFPK KS backend is unavailable. Check the Python interpreter and pyhmmer. ${result.stderr.trim()}`);
    }
    const scientificConfiguration: Record<string, JsonValue> = {
      method: 'three-profile-ks', adapter_sha256: largeFileHash(backend.command[1]!),
    };
    const request = afpkRequest.parse(readFrozenArtifact(paths, currentRevision(task)));
    if (request.run_afpk_finder === true) {
      if (finderArgs.length === 0) throw new Error('Configure the original AFPK-finder v1.0 checkout in afpk-finder.json or ARIADNE_AFPK_FINDER_REPO.');
      const probe = await runBackend(backend, ['finder-identity', ...finderArgs], {
        cwd: task.mandate.workDir, env: ctx.env, timeoutMs: 30_000, maxOutputBytes: 8_000,
      });
      if (probe.code !== 0 || probe.timedOut || probe.stdoutTruncated) {
        throw new Error(`The original AFPK-finder runtime is unavailable. ${probe.stderr.trim()}`);
      }
      scientificConfiguration['afpk_finder_identity'] = finderIdentity.parse(parseObject(probe.stdout));
      scientificConfiguration['afpk_finder_arguments'] = finderArgs;
    }
    const command = [...backend.command];
    const sha256 = hash(canonical({ command, version, configuration: scientificConfiguration }));
    if (task.mandate.backend !== undefined && task.mandate.backend.sha256 !== sha256) {
      attention(task, 'configuration_drift', 'The AFPK KS adapter or Python environment changed. Create a task under the new backend identity.', []);
      saveTask(task, paths);
      return false;
    }
    if (task.mandate.backend === undefined) {
      task.mandate.backend = { command, source: backend.source, version, esmAvailable: false, scientificConfiguration, sha256 };
      event(task, 'readiness', request.run_afpk_finder === true
        ? 'Confirmed the KS backend and the original AFPK-finder v1.0 runtime and release fingerprints.'
        : 'Confirmed the AFPK KS backend and froze the adapter fingerprint.');
    }
    return true;
  } catch (error) {
    attention(task, 'environment_readiness', errorMessage(error), ['retry']);
    saveTask(task, paths);
    return false;
  }
}

function assignmentTool(task: ResearchTask, stage: JobStage): string {
  return task.workflow === AFPK_WORKFLOW ? AFPK_TOOL : STAGE_TOOL[stage];
}

async function launchAssignment(ctx: ResearchContext, task: ResearchTask, paths: TaskPaths, stage: JobStage): Promise<void> {
  const frozen = task.mandate.backend;
  if (frozen === undefined) throw new Error('Research backend identity is missing.');
  verifyDependencies(ctx, task, paths);
  const revision = currentRevision(task);
  const afpk = task.workflow === AFPK_WORKFLOW;
  const operation = afpk && stage === 'discovery' ? AFPK_OPERATION : STAGE_OPERATION[stage];
  if (!task.mandate.allowedOperations.includes(operation)) throw new Error('Operation is outside the frozen research mandate.');
  const jobId = `job_${new Date().toISOString().replaceAll(/[-:.TZ]/g, '').slice(0, 14)}_${randomBytes(6).toString('hex')}`;
  const output = path.join(paths.artifacts, `${String(task.assignments.length + 1)}-${stage}.json`);
  const stageDir = path.join(paths.artifacts, `${String(task.assignments.length + 1)}-${stage}-artifacts`);
  const request = readJson(revision.path, MAX_QUERY_BYTES);
  const argv: string[] = [];
  const requestArgs: Record<string, unknown> = { researchTaskId: task.id, assignmentId: `assignment_${String(task.assignments.length + 1)}`, queryRevision: revision.revision, output };
  let expectedRole = 'nomination-request';
  let expectedHash: string | undefined;
  if (afpk) {
    if (frozen.scientificConfiguration['adapter_sha256'] !== largeFileHash(frozen.command[1]!)) {
      throw new Error('The AFPK KS adapter differs from the frozen backend fingerprint.');
    }
    const input = task.deskLaunch === true ? deskAfpkRequest(task.mandate.workDir, request) : afpkRequest.parse(request);
    expectedHash = revision.sha256;
    argv.push('screen', '--request-file', revision.path, '--output', output);
    if (input.run_afpk_finder === true) {
      const { finderArgs } = resolveAfpkRuntime(ctx.env, ctx.homeDir);
      if (canonical(frozen.scientificConfiguration['afpk_finder_arguments'] ?? null) !== canonical(finderArgs)) {
        throw new Error('The original AFPK-finder configuration changed after readiness. Restore the frozen installation settings.');
      }
      argv.push(...finderArgs);
    }
    Object.assign(requestArgs, {
      requestFile: revision.path,
      proteins: input.input_proteins,
      fasI: input.ks_models.fas_i,
      fasII: input.ks_models.fas_ii,
      pks: input.ks_models.pks,
      clusterOutputs: input.afpk_finder_files,
      publishedKsScores: input.published_ks_scores_file,
    });
  } else if (stage === 'discovery') {
    expectedHash = revision.sha256;
    argv.push('discover', '--request-file', revision.path, '--output', output, '--stage-dir', stageDir);
    Object.assign(requestArgs, { requestFile: revision.path, stageDir });
  } else if (stage === 'filtering') {
    expectedRole = 'candidates';
    expectedHash = task.nomination.candidatesSha256;
    if (task.nomination.candidatesFasta === undefined || expectedHash === undefined) throw new Error('Filtering requires a verified discovery candidates FASTA.');
    argv.push('filter', '--candidates', task.nomination.candidatesFasta, '--output', output, '--stage-dir', stageDir);
    Object.assign(requestArgs, { candidates: task.nomination.candidatesFasta, stageDir });
  } else if (stage === 'nomination') {
    expectedRole = 'candidates';
    expectedHash = task.nomination.filteredSha256;
    if (task.nomination.filteredFasta === undefined || expectedHash === undefined) throw new Error('Nomination requires a verified filtered candidates FASTA.');
    argv.push('nominate', '--candidates', task.nomination.filteredFasta, '--request-file', revision.path, '--output', output, '--stage-dir', stageDir, '--top-k', String(task.mandate.topK));
    if (!frozen.esmAvailable || task.nomination.esmWaived === true) argv.push('--no-esm');
    Object.assign(requestArgs, { candidates: task.nomination.filteredFasta, requestFile: revision.path, stageDir, referenceDir: request['reference_dir'], workbook: request['tps_workbook'] });
  } else {
    expectedRole = 'nomination-report';
    const nomination = nominationAssignment(task);
    expectedHash = nomination.outputSha256;
    argv.push('audit-nomination', '--nomination-file', nomination.output, '--output', output);
    Object.assign(requestArgs, { nominationFile: nomination.output });
  }
  const previous = task.assignments.findLast((entry) => entry.stage === stage && entry.queryRevision === revision.revision);
  const assignment: ResearchAssignment = { id: `assignment_${String(task.assignments.length + 1)}`, stage, jobId, status: 'launching', queryRevision: revision.revision, output, createdAt: new Date().toISOString(), retryOf: previous?.id };
  task.assignments.push(assignment);
  task.status = 'running';
  event(task, 'launch_intent', `Persisted ${stage} assignment ${assignment.id} with reserved job ${jobId}.`);
  saveTask(task, paths);
  let spawnAttempted = false;
  try {
    const backend: AriadneBackend = { command: frozen.command, source: frozen.source };
    const provenance = createEngineeringJobRequest({ toolName: assignmentTool(task, stage), operation, backend, backendVersion: frozen.version, args: requestArgs, workDir: task.mandate.workDir, scientificConfiguration: frozen.scientificConfiguration });
    if (provenance.inputs.some((entry) => entry.kind !== 'file' && !(entry.kind === 'directory' && entry.role === 'reference-library' && entry.integrityComplete === true))) {
      throw new Error('Research input is no longer a readable regular file (or complete reference directory).');
    }
    const expectedInput = provenance.inputs.find((entry) => entry.role === expectedRole || entry.role.startsWith(`${expectedRole}[`));
    if (expectedHash === undefined || expectedInput?.sha256 !== expectedHash) throw new Error('The staged job input differs from its verified research dependency.');
    spawnAttempted = true;
    const job = startJob(ctx.jobsRoot, [...backend.command, ...argv], { workDir: task.mandate.workDir, env: ctx.env, label: `research:${task.id}:${stage}`, provenance, jobId });
    assignment.status = job.status;
    assignment.requestSha256 = readJobRunManifest(ctx.jobsRoot, jobId)?.manifest?.requestSha256;
    event(task, 'submitted', `Started ${stage} as ${jobId}.`);
  } catch (error) {
    assignment.error = errorMessage(error);
    if (!spawnAttempted) {
      assignment.status = 'failed'; assignment.notStarted = true; assignment.finishedAt = new Date().toISOString();
      attention(task, 'preflight_failure', `The input preflight failed before any process launch: ${errorMessage(error)}. Correct the nomination request using a new revision.`, ['amend_request']);
    } else {
      assignment.status = 'unknown';
      attention(task, 'execution_unknown', `The launch could not be confirmed: ${errorMessage(error)}. Observe the reserved job; no automatic resubmission is allowed.`, []);
    }
  }
  saveTask(task, paths);
}

function observeAssignment(ctx: ResearchContext, task: ResearchTask, paths: TaskPaths, assignment: ResearchAssignment): 'running' | 'waiting' | 'consumed' {
  if (assignment.notStarted) return 'waiting';
  const job = getJob(ctx.jobsRoot, assignment.jobId);
  if (job === undefined || job.status === 'unknown') {
    if (assignment.status === 'unknown' && task.status === 'waiting' && task.attention.some((item) => item.status === 'open' && item.kind === 'execution_unknown' && item.stage === assignment.stage)) return 'waiting';
    assignment.status = 'unknown';
    attention(task, 'execution_unknown', 'The original job has no verified terminal result. Its reserved id is preserved; this observation does not authorize a replacement job.', []);
    saveTask(task, paths); return 'waiting';
  }
  let reconciled = false;
  for (const item of task.attention.filter((entry) => entry.status === 'open' && entry.kind === 'execution_unknown' && entry.stage === assignment.stage)) {
    item.status = 'resolved'; item.resolvedAt = new Date().toISOString();
    item.reconciliation = { jobId: assignment.jobId, status: job.status, authority: 'system-observed' };
    event(task, 'observation_recovered', `Verified the original reserved job ${assignment.jobId} reached ${job.status}.`);
    reconciled = true;
  }
  if (job.status === 'running') {
    if (assignment.status !== 'running' || task.status !== 'running' || reconciled) {
      assignment.status = 'running'; task.status = 'running'; saveTask(task, paths);
    }
    return 'running';
  }
  assignment.status = job.status;
  assignment.finishedAt = job.finishedAt;
  if (job.status === 'cancelled') {
    event(task, 'job_cancelled', `Stopped ${assignment.stage} job ${assignment.jobId}.`);
    attention(task, 'execution_cancelled', 'The engine job is cancelled. Decide whether to retry this stage or amend the request.', ['retry', 'amend_request']);
    saveTask(task, paths); return 'waiting';
  }
  if (job.status !== 'succeeded') {
    attention(task, 'execution_failure', `${assignment.stage} job ${job.status}; inspect its bounded log before an explicit retry.`, ['retry', 'amend_request']);
    saveTask(task, paths); return 'waiting';
  }
  try {
    verifyRevision(task, paths);
    verifyDependencies(ctx, task, paths);
    const payload = verifiedOutput(ctx, task, paths, job, assignment);
    assignment.consumed = true;
    if (task.workflow === AFPK_WORKFLOW) consumeAfpkScreen(task, assignment, payload);
    else if (assignment.stage === 'discovery') consumeDiscovery(task, payload);
    else if (assignment.stage === 'filtering') consumeFiltering(task, payload);
    else if (assignment.stage === 'nomination') consumeNomination(task, assignment, payload);
    else consumeAudit(task, assignment, payload);
    event(task, 'stage_completed', `Consumed verified ${assignment.stage} output from ${assignment.jobId}.`);
    if (task.status !== 'waiting' && task.status !== 'ready') task.status = 'open';
    saveTask(task, paths); return task.status === 'waiting' ? 'waiting' : 'consumed';
  } catch (error) {
    assignment.consumed = false;
    attention(task, 'malformed_result', errorMessage(error), ['amend_request']);
    saveTask(task, paths); return 'waiting';
  }
}

function consumeAfpkScreen(task: ResearchTask, assignment: ResearchAssignment, payload: Record<string, unknown>): void {
  const candidates = payload['candidates'];
  if (!Array.isArray(candidates)) throw new Error('AFPK shortlist is missing.');
  task.stage = 'nomination';
  task.nomination.nominatedCount = candidates.length;
  task.scientificOutcome.reportFile = assignment.output;
  task.scientificOutcome.status = candidates.length > 0 ? 'review_required' : 'blocked';
  if (candidates.length > 0) {
    attention(task, 'afpk_nomination_review', payload['original_afpk_finder'] === undefined
      ? 'Review the putative AFPK shortlist against the three KS scores, anchor controls, and any published AFPK-finder evidence.'
      : 'Review the KS scores, fresh original AFPK-finder clusters, and published evidence before deciding on the putative shortlist.', ['approve', 'revise', 'amend_request']);
  } else {
    attention(task, 'afpk_empty_shortlist', 'The batch produced no putative AFPK candidates. Inspect the scores and amend the request if warranted.', ['amend_request']);
  }
}

function consumeDiscovery(task: ResearchTask, payload: Record<string, unknown>): void {
  const artifacts = payload['artifacts'];
  if (!isRecord(artifacts) || typeof artifacts['proteins'] !== 'string' || artifacts['proteins'].trim() === '') throw new Error('Discovery output must expose artifacts.proteins (the candidate protein FASTA path).');
  const summary = payload['summary'];
  if (!isRecord(summary) || !Number.isSafeInteger(summary['candidate_count']) || (summary['candidate_count'] as number) < 0) throw new Error('Discovery output must expose summary.candidate_count.');
  if ((summary['candidate_count'] as number) === 0) {
    throw new Error('HMM retrieval produced no candidates above thresholds; amend the request (HMM, thresholds, or inputs) before retrying.');
  }
  task.nomination.candidatesFasta = artifacts['proteins'];
  task.nomination.candidatesSha256 = largeFileHash(artifacts['proteins']);
  task.stage = 'filtering';
}

function consumeFiltering(task: ResearchTask, payload: Record<string, unknown>): void {
  const artifacts = payload['artifacts'];
  if (!isRecord(artifacts) || typeof artifacts['filtered_fasta'] !== 'string' || artifacts['filtered_fasta'].trim() === '') throw new Error('Filtering output must expose artifacts.filtered_fasta.');
  const summary = payload['summary'];
  if (!isRecord(summary) || !Number.isSafeInteger(summary['kept']) || (summary['kept'] as number) < 0) throw new Error('Filtering output must expose summary.kept.');
  if ((summary['kept'] as number) === 0) {
    throw new Error('Quality filtering removed every candidate; amend the request or thresholds before retrying.');
  }
  task.nomination.filteredFasta = artifacts['filtered_fasta'];
  task.nomination.filteredSha256 = largeFileHash(artifacts['filtered_fasta']);
  task.stage = 'nomination';
}

function consumeNomination(task: ResearchTask, assignment: ResearchAssignment, payload: Record<string, unknown>): void {
  if (payload['kind'] !== 'ariadne.nomination-report' || payload['schema_version'] !== 1 || !Array.isArray(payload['candidates'])) throw new Error('Nomination output does not match the nomination-report contract.');
  for (const candidate of payload['candidates']) {
    if (!isRecord(candidate) || typeof candidate['sequence_id'] !== 'string' || candidate['sequence_id'].trim() === '') throw new Error('Nomination candidates must carry sequence_id.');
  }
  const esmUsed = payload['esm_used'] === true;
  task.nomination.esmUsed = esmUsed;
  task.nomination.nominatedCount = payload['candidates'].length;
  task.nomination.summary = isRecord(payload['summary']) ? payload['summary'] as Record<string, JsonValue> : undefined;
  if (payload['candidates'].length === 0) throw new Error('Nomination produced an empty candidate shortlist; amend the request or thresholds.');
  task.scientificOutcome.reportFile = assignment.output;
  task.stage = 'audit';
}

function consumeAudit(task: ResearchTask, assignment: ResearchAssignment, payload: Record<string, unknown>): void {
  const status = payload['status'];
  if (!['pass', 'warn', 'fail'].includes(String(status)) || payload['kind'] !== 'ariadne.nomination-audit' || payload['schema_version'] !== 1 || !isRecord(payload['summary']) || !Array.isArray(payload['issues']) || !Array.isArray(payload['claim_ledger'])) throw new Error('Scientific audit output does not match the nomination-audit contract.');
  const summary = payload['summary'];
  const nomination = nominationAssignment(task);
  if (!Number.isSafeInteger(summary['candidates']) || (summary['candidates'] as number) <= 0 || summary['candidates'] !== nominationCount(task) || payload['report'] !== undefined && payload['report'] !== nomination.output) throw new Error('Scientific audit candidate count or report identity is inconsistent.');
  const issues = payload['issues'];
  if (!issues.every((issue: unknown) => isRecord(issue) && ['critical', 'warning'].includes(String(issue['severity'])) && typeof issue['candidate_id'] === 'string')) throw new Error('Scientific audit issues have an unknown severity or candidate.');
  const critical = issues.filter((issue: unknown) => isRecord(issue) && issue['severity'] === 'critical').length;
  const warnings = issues.filter((issue: unknown) => isRecord(issue) && issue['severity'] === 'warning').length;
  const expectedStatus = critical > 0 ? 'fail' : warnings > 0 ? 'warn' : 'pass';
  if (summary['critical_issues'] !== critical || summary['warnings'] !== warnings || status !== expectedStatus || (status === 'pass' && (payload['claim_ledger'].length === 0 || summary['claims'] !== payload['claim_ledger'].length))) throw new Error('Scientific audit status, issue counts, or claim ledger are inconsistent.');
  task.scientificOutcome.auditStatus = status as 'pass' | 'warn' | 'fail';
  task.scientificOutcome.auditFile = assignment.output;
  if (status !== 'pass' || issues.length > 0) {
    task.scientificOutcome.status = 'review_required';
    attention(task, 'scientific_review', 'The nomination audit requires scientific review. Successful process execution does not establish a supported nomination.', ['amend_request'], { auditStatus: String(status), issues: boundedJson(payload['issues']) });
  } else {
    attention(task, 'nomination_review', 'Nominated candidates passed the deterministic audit. Approve them to proceed to experimental design, or amend the request.', ['approve', 'amend_request'], { auditStatus: 'pass', nominated: nominationCount(task) });
  }
}

function scientificConfiguration(identity: Record<string, unknown>, env: NodeJS.ProcessEnv): Record<string, JsonValue> {
  const result: Record<string, JsonValue> = {};
  for (const name of ['adapter_version', 'backend_revision', 'python']) {
    const value = identity[name];
    if (typeof value === 'string' || typeof value === 'number') result[name] = value;
  }
  const enginesIdentity = isRecord(identity['engines']) ? identity['engines'] : undefined;
  if (enginesIdentity !== undefined) {
    // Whitelisted, non-secret engine facts only — never pass nested objects
    // through wholesale so credentials cannot ride into the frozen mandate.
    const enginesReported: Record<string, JsonValue> = {};
    for (const [engine, keys] of [
      ['hmm', ['available', 'pyhmmer']],
      ['semantic', ['available', 'model']],
      ['feature_space', ['available', 'scikit_learn']],
    ] as const) {
      const source = isRecord(enginesIdentity[engine]) ? enginesIdentity[engine] : undefined;
      if (source === undefined) continue;
      const selected: Record<string, JsonValue> = {};
      for (const key of keys) {
        const value = source[key];
        if (value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) selected[key] = value;
      }
      if (Object.keys(selected).length > 0) enginesReported[engine] = selected;
    }
    result['engines'] = enginesReported;
  }
  const defaultsIdentity = isRecord(identity['defaults']) ? identity['defaults'] : undefined;
  if (defaultsIdentity !== undefined) {
    const selected: Record<string, JsonValue> = {};
    for (const key of ['min_score', 'max_evalue', 'min_coverage', 'min_length', 'identity_threshold', 'ceess_threshold', 'top_k', 'esm_model']) {
      const value = defaultsIdentity[key];
      if (value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) selected[key] = value;
    }
    if (Object.keys(selected).length > 0) result['defaults'] = selected;
  }
  const overrides: Record<string, JsonValue> = {};
  for (const key of ['ARIADNE_ESM_MODEL', 'ARIADNE_ESM_DEVICE', 'ARIADNE_CEESS_THRESHOLD', 'ARIADNE_TOP_K']) {
    const value = env[key];
    if (value !== undefined) overrides[key] = value.slice(0, 4_000);
  }
  result['environment_overrides'] = overrides;
  return result;
}

function requestAgentArtifact(task: ResearchTask, stage: AgentStage): void {
  attention(task, 'stage_input', AGENT_STAGE_PROMPT[stage] ?? `Deposit the ${stage} artifact.`, ['submit_stage', 'amend_request']);
}

function openIterationDecision(task: ResearchTask): void {
  attention(task, 'iteration_decision',
    `Validation records are frozen for iteration ${String(task.iteration)}. Iterate on revised hypotheses (bounded to ${String(MAX_ITERATIONS)} iterations) or conclude with a verified handoff.`,
    task.iteration >= MAX_ITERATIONS ? ['conclude'] : ['iterate', 'conclude']);
}

function nominationAssignment(task: ResearchTask): ResearchAssignment {
  const revision = currentRevision(task).revision;
  const assignment = task.assignments.findLast((entry) => entry.stage === 'nomination' && entry.queryRevision === revision && entry.status === 'succeeded' && entry.consumed);
  if (assignment === undefined) throw new Error('No verified nomination output exists for the current request revision.');
  return assignment;
}

function nominationCount(task: ResearchTask): number {
  if (task.nomination.nominatedCount === undefined) throw new Error('No nomination summary is recorded.');
  return task.nomination.nominatedCount;
}

function stageArtifactFor(task: ResearchTask, stage: AgentStage): StageArtifact | undefined {
  return task.stageArtifacts.findLast((entry) => entry.stage === stage && entry.iteration === task.iteration);
}

function verifyStageArtifact(task: ResearchTask, paths: TaskPaths, stage: AgentStage): void {
  const artifact = stageArtifactFor(task, stage);
  if (artifact === undefined) throw new Error(`Research review requires a frozen ${stage} artifact for the current iteration.`);
  validateStageArtifact(stage, readFrozenArtifact(paths, artifact));
}

function readFrozenArtifact(paths: TaskPaths, record: ResearchQueryRevision | StageArtifact): Record<string, unknown> {
  contained(paths.artifacts, record.path);
  const bytes = readRegular(record.path, MAX_QUERY_BYTES);
  if (hash(bytes) !== record.sha256) throw new Error('The frozen research artifact differs from its recorded fingerprint.');
  return jsonObject(bytes);
}

function verifyNominationReview(ctx: ResearchContext, task: ResearchTask, paths: TaskPaths): void {
  const nomination = nominationAssignment(task);
  const audit = task.assignments.findLast((entry) => entry.stage === 'audit' && entry.queryRevision === nomination.queryRevision && entry.status === 'succeeded' && entry.consumed);
  if (audit === undefined || task.scientificOutcome.auditStatus !== 'pass' || task.scientificOutcome.reportFile !== nomination.output || task.scientificOutcome.auditFile !== audit.output) {
    throw new Error('Research review requires a verified nomination and a passing nomination audit.');
  }
  readVerifiedAssignment(ctx, task, paths, nomination);
  const result = readVerifiedAssignment(ctx, task, paths, audit, nomination);
  if (result['status'] !== 'pass' || (result['report'] !== undefined && result['report'] !== nomination.output)) {
    throw new Error('The verified audit does not pass for the current nomination.');
  }
}

function verifyConcludeLineage(ctx: ResearchContext, task: ResearchTask, paths: TaskPaths): void {
  verifyStageArtifact(task, paths, 'experiment');
  verifyStageArtifact(task, paths, 'validation');
  verifyNominationReview(ctx, task, paths);
}

function verifyAfpkReview(ctx: ResearchContext, task: ResearchTask, paths: TaskPaths): void {
  const revision = currentRevision(task).revision;
  const screened = task.assignments.findLast((entry) => entry.stage === 'discovery' && entry.queryRevision === revision && entry.consumed && entry.status === 'succeeded');
  if (screened === undefined || screened.output !== task.scientificOutcome.reportFile) {
    throw new Error('AFPK review requires the verified screen for the current request revision.');
  }
  const result = readVerifiedAssignment(ctx, task, paths, screened);
  if (!Array.isArray(result['candidates']) || result['candidates'].length === 0 || result['candidates'].length !== task.nomination.nominatedCount) {
    throw new Error('The verified AFPK shortlist is empty or differs from the task record.');
  }
}

function taskPaths(ctx: ResearchContext, id: string, create: boolean): TaskPaths {
  if (!TASK_ID.test(id)) throw new Error('Invalid research task id.');
  const jobs = path.resolve(ctx.jobsRoot);
  const root = path.join(jobs, 'research');
  if (create) { mkdirSync(jobs, { recursive: true, mode: 0o700 }); regularDirectory(jobs); privateDirectory(root); }
  if (existsSync(jobs)) regularDirectory(jobs);
  if (existsSync(root)) regularDirectory(root);
  const dir = path.join(root, id);
  if (existsSync(dir)) regularDirectory(dir);
  return { root, dir, record: path.join(dir, 'task.json'), artifacts: path.join(dir, 'artifacts') };
}

function acquireLock(paths: TaskPaths, id: string): () => void {
  const locks = path.join(paths.root, '.locks');
  privateDirectory(locks);
  const file = path.join(locks, `${id}.sqlite`);
  if (existsSync(file)) {
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Research lock is not a regular file.');
  }
  const database = new DatabaseSync(file);
  try {
    chmodSync(file, 0o600);
    database.exec('PRAGMA busy_timeout = 0; BEGIN IMMEDIATE');
  } catch (error) {
    database.close();
    throw new Error(`Research task is locked by another operation; read its state and retry after that operation finishes. ${errorMessage(error)}`, { cause: error });
  }
  return () => { try { database.exec('ROLLBACK'); } finally { database.close(); } };
}

function readTask(paths: TaskPaths, ctx: ResearchContext, allowForeignWorkspace = false): ResearchTask | undefined {
  if (!existsSync(paths.record)) return undefined;
  const value = readJson(paths.record, MAX_JSON_BYTES);
  if (value['kind'] !== 'ariadne.research-task' || value['schemaVersion'] !== 1 || value['id'] !== path.basename(paths.dir) || !Number.isSafeInteger(value['version']) || (value['version'] as number) < 1 || !isRecord(value['mandate']) || !Array.isArray(value['queryRevisions']) || !Array.isArray(value['stageArtifacts']) || !Array.isArray(value['assignments']) || !Array.isArray(value['attention']) || !Array.isArray(value['events']) || !isRecord(value['nomination'])) throw new Error('Research task does not match its versioned storage contract.');
  const task = value as unknown as ResearchTask;
  const stages = ['readiness', 'literature', 'hypothesis', 'pathway', 'discovery', 'filtering', 'nomination', 'audit', 'experiment', 'validation', 'iteration', 'handoff'];
  if (!['open', 'running', 'waiting', 'ready', 'cancelled'].includes(task.status) || !stages.includes(task.stage) || !Number.isSafeInteger(task.eventCount) || task.eventCount < task.events.length || !isRecord(task.scientificOutcome)) throw new Error('Research lifecycle or event history is malformed.');
  if (task.mandate.jobsRoot !== path.resolve(ctx.jobsRoot)) throw new Error('Research task belongs to a different frozen job store.');
  if (task.mandate.workDir !== currentWorkDir(ctx)) {
    if (allowForeignWorkspace) return undefined;
    throw new Error('Research task belongs to a different frozen workspace.');
  }
  if (task.workflow !== undefined && task.workflow !== AFPK_WORKFLOW) throw new Error('Unknown research workflow.');
  const deskLaunch = value['deskLaunch'];
  if (deskLaunch !== undefined && (deskLaunch !== true || task.workflow !== AFPK_WORKFLOW)) throw new Error('Invalid Research Desk launch origin.');
  const operations = task.workflow === AFPK_WORKFLOW ? [AFPK_OPERATION] : OPERATIONS;
  if (task.mandate.outputDir !== paths.artifacts || canonical(task.mandate.allowedOperations) !== canonical(operations)) throw new Error('Research mandate paths or allowed operations were modified.');
  integer(task.mandate.maxJobs, 'stored maxJobs', 1, 16);
  integer(task.mandate.topK, 'stored topK', 1, 10);
  integer(task.iteration, 'stored iteration', 1, MAX_ITERATIONS);
  if (task.requestSha256 !== hash(canonical({ requestId: task.requestId, objective: task.objective, workDir: task.mandate.workDir, topK: task.mandate.topK, maxJobs: task.mandate.maxJobs, initialQuerySha256: task.mandate.initialQuerySha256, deskLaunch: task.deskLaunch }))) throw new Error('The frozen research mandate fingerprint does not match its contents.');
  if (task.mandate.backend !== undefined) {
    const backend = task.mandate.backend;
    if (!Array.isArray(backend.command) || backend.command.length === 0 || !backend.command.every((part) => typeof part === 'string' && part !== '') || typeof backend.version !== 'string' || typeof backend.esmAvailable !== 'boolean' || !isRecord(backend.scientificConfiguration) || backend.sha256 !== hash(canonical({ command: backend.command, version: backend.version, configuration: backend.scientificConfiguration }))) throw new Error('The frozen backend configuration identity was modified.');
  }
  if (task.queryRevisions.length === 0 || task.queryRevisions.length > MAX_REVISIONS || task.assignments.length > task.mandate.maxJobs || task.events.length > MAX_EVENTS || task.attention.length > 64 || task.stageArtifacts.length > 32) throw new Error('Research record exceeds its frozen bounds.');
  for (const assignment of task.assignments) {
    if (!JOB_ID.test(assignment.jobId) || !['discovery', 'filtering', 'nomination', 'audit'].includes(assignment.stage)) throw new Error('Invalid stored research assignment.');
    contained(paths.artifacts, assignment.output);
  }
  for (const artifact of task.stageArtifacts) {
    if (!['literature', 'hypothesis', 'pathway', 'experiment', 'validation'].includes(artifact.stage)) throw new Error('Invalid stored stage artifact.');
    contained(paths.artifacts, artifact.path);
  }
  const first = task.queryRevisions[0]!;
  const original = readFrozenArtifact(paths, first);
  if (hash(canonical(original)) !== task.mandate.initialQuerySha256 ||
      (original['workflow'] === AFPK_WORKFLOW) !== (task.workflow === AFPK_WORKFLOW)) {
    throw new Error('The original research request no longer matches the frozen mandate.');
  }
  return task;
}

function verifiedOutput(ctx: ResearchContext, task: ResearchTask, paths: TaskPaths, job: JobSnapshot, assignment: ResearchAssignment, review?: {
  nomination?: Pick<ResearchAssignment, 'output' | 'outputSha256'>;
}): Record<string, unknown> {
  contained(paths.artifacts, assignment.output);
  const result = readJobRunManifest(ctx.jobsRoot, job.id);
  const manifest = result?.manifest;
  if (result?.error !== undefined || manifest === undefined || manifest.result === undefined) throw new Error('A valid completion-time engineering manifest is required before consuming stage output.');
  if ((review !== undefined || task.workflow === AFPK_WORKFLOW) && manifest.parameters.values['researchTaskId'] !== task.id) throw new Error('The engine manifest belongs to a different research task.');
  const nomination = review?.nomination;
  if (nomination !== undefined && !manifest.inputs.some((input) =>
    input.role === 'nomination-report' && input.kind === 'file' && input.path === nomination.output && input.sha256 === nomination.outputSha256,
  )) throw new Error('The audit manifest does not identify the current nomination artifact.');
  if (manifest.jobId !== assignment.jobId || manifest.toolName !== assignmentTool(task, assignment.stage) || manifest.parameters.values['assignmentId'] !== assignment.id || manifest.parameters.values['queryRevision'] !== assignment.queryRevision || manifest.configuredOutput !== assignment.output || manifest.result.output.path !== assignment.output || manifest.result.output.kind !== 'file' || manifest.result.output.sha256 === undefined) throw new Error('Stage output identity does not match its durable engineering manifest.');
  if (assignment.requestSha256 !== undefined && assignment.requestSha256 !== manifest.requestSha256) throw new Error('Stage request identity changed after submission.');
  const bytes = readRegular(assignment.output, MAX_JSON_BYTES);
  if (hash(bytes) !== manifest.result.output.sha256) throw new Error('Stage output differs from its completion-time fingerprint.');
  const payload = jsonObject(bytes);
  if (task.workflow === AFPK_WORKFLOW) {
    const request = task.queryRevisions.find((entry) => entry.revision === assignment.queryRevision);
    const requestInput = manifest.inputs.find((entry) => entry.role === 'nomination-request');
    if (request === undefined || requestInput?.sha256 !== request.sha256 || requestInput.path !== request.path) {
      throw new Error('The AFPK job manifest does not identify the frozen screening request.');
    }
    const report = validateAfpkReport(payload, readFrozenArtifact(paths, request));
    const reportedVersion = `ariadne-afpk-ks ${report.software.adapter} (pyhmmer ${report.software.pyhmmer})`;
    if (manifest.backend.version !== reportedVersion || task.mandate.backend?.version !== reportedVersion) {
      throw new Error('The AFPK runtime version differs from the frozen backend identity.');
    }
    if (report.original_afpk_finder !== undefined) {
      const observed = canonical(finderIdentity.parse(report.original_afpk_finder));
      if (observed !== canonical(task.mandate.backend.scientificConfiguration['afpk_finder_identity'] ?? null) ||
        observed !== canonical(manifest.scientificConfiguration?.values['afpk_finder_identity'] ?? null)) {
        throw new Error('The original AFPK-finder release or dependency identity differs from the frozen run.');
      }
    }
    const inputHashes = Object.fromEntries(manifest.inputs.filter((entry) => entry !== requestInput).map((entry) => [entry.role, entry.sha256]));
    if (canonical(report.inputs) !== canonical(inputHashes)) {
      throw new Error('The AFPK backend read inputs that differ from the launch-time fingerprints.');
    }
  }
  assignment.requestSha256 = manifest.requestSha256;
  assignment.outputSha256 = manifest.result.output.sha256;
  assignment.resultSha256 = manifest.result.resultSha256;
  return payload;
}

function readVerifiedAssignment(ctx: ResearchContext, task: ResearchTask, paths: TaskPaths, assignment: ResearchAssignment, nomination?: ResearchAssignment): Record<string, unknown> {
  const job = getJob(ctx.jobsRoot, assignment.jobId);
  if (job?.status !== 'succeeded') throw new Error('The recorded engine job no longer has a successful result.');
  const checked = { ...assignment };
  const content = verifiedOutput(ctx, task, paths, job, checked, { nomination });
  if (checked.outputSha256 !== assignment.outputSha256 || checked.resultSha256 !== assignment.resultSha256) {
    throw new Error('The engine result differs from the persisted research artifact fingerprint.');
  }
  return content;
}

function verifyDependencies(ctx: ResearchContext, task: ResearchTask, paths: TaskPaths): void {
  for (const previous of task.assignments.filter((entry) => entry.consumed && entry.status === 'succeeded' && entry.queryRevision === currentRevision(task).revision)) {
    const job = getJob(ctx.jobsRoot, previous.jobId);
    if (job === undefined || job.status !== 'succeeded') throw new Error('A previously consumed stage no longer has a verified successful job.');
    verifiedOutput(ctx, task, paths, job, previous);
  }
}

function verifyReadyTask(task: ResearchTask): void {
  const revision = currentRevision(task).revision;
  const completed = task.assignments.filter((entry) => entry.queryRevision === revision && entry.status === 'succeeded' && entry.consumed);
  const nomination = completed.findLast((entry) => entry.stage === 'nomination');
  if (task.stage !== 'handoff' || task.scientificOutcome.auditStatus !== 'pass' || task.scientificOutcome.reportFile !== nomination?.output || !['discovery', 'filtering', 'nomination', 'audit'].every((stage) => completed.some((entry) => entry.stage === stage)) || stageArtifactFor(task, 'experiment') === undefined || stageArtifactFor(task, 'validation') === undefined) throw new Error('Research readiness has no complete verified nomination lineage with experimental design and validation.');
}

function verifyHandoff(ctx: ResearchContext, task: ResearchTask, paths: TaskPaths): void {
  verifyRevision(task, paths);
  if (task.workflow === AFPK_WORKFLOW) {
    if (task.stage !== 'handoff' || !task.attention.some((item) =>
      item.kind === 'afpk_nomination_review' && item.resolution?.action === 'approve')) {
      throw new Error('AFPK computational handoff is missing its recorded shortlist decision.');
    }
    verifyAfpkReview(ctx, task, paths);
    return;
  }
  verifyReadyTask(task);
  verifyConcludeLineage(ctx, task, paths);
  verifyDependencies(ctx, task, paths);
}

function saveTask(task: ResearchTask, paths: TaskPaths): ResearchTask {
  task.version++;
  task.updatedAt = new Date().toISOString();
  const open = task.attention.filter((item) => item.status === 'open');
  task.nextAction = task.status === 'ready' ? (task.workflow === AFPK_WORKFLOW
    ? 'Review the accepted KS shortlist and supporting evidence before computational handoff.'
    : 'Review the nomination report, scientific audit, provenance, and limitations before research handoff.')
    : task.status === 'cancelled' ? 'Execution is cancelled; retained artifacts remain available.'
    : open.length > 0 ? `${open[0]!.message} Allowed responses: ${open[0]!.allowedActions.join(', ') || 'none; preserve this task for inspection'}.`
    : task.status === 'running' ? 'Call advance to observe the original job; do not submit a replacement while it is active.'
    : `Call advance to continue ${task.stage}.`;
  const rendered = JSON.stringify(task);
  if (Buffer.byteLength(rendered) > MAX_JSON_BYTES) throw new Error('Research state exceeds its bounded storage limit.');
  atomicWriteJson(paths.record, task);
  return task;
}

function attention(task: ResearchTask, kind: string, message: string, allowedActions: ResearchResponse[], details?: Record<string, JsonValue>): void {
  task.status = 'waiting';
  if (task.attention.some((item) => item.status === 'open' && item.kind === kind && item.stage === task.stage)) return;
  if (task.attention.length >= 64) throw new Error('Research attention history limit is exhausted.');
  task.attention.push({ id: `attention_${randomBytes(8).toString('hex')}`, kind, stage: task.stage, status: 'open', message: message.slice(0, 4_000), allowedActions, createdAt: new Date().toISOString(), details });
  event(task, 'attention', `${kind}: ${message}`);
}

function resolveAttention(item: ResearchAttention, action: ResearchResponse | 'cancel', reason: string): void {
  item.status = 'resolved'; item.resolvedAt = new Date().toISOString();
  item.resolution = { action, reason, authority: 'caller-declared' };
}

function event(task: ResearchTask, type: string, detail: string): void {
  task.eventCount++;
  task.events.push({ sequence: task.eventCount, at: new Date().toISOString(), type, stage: task.stage, detail: detail.slice(0, 4_000) });
  if (task.events.length > MAX_EVENTS) { task.events = task.events.slice(-MAX_EVENTS); task.eventsTruncated = true; }
}

function verifyRevision(task: ResearchTask, paths: TaskPaths): void {
  const revision = currentRevision(task);
  contained(paths.artifacts, revision.path);
  if (fileHash(revision.path, MAX_QUERY_BYTES) !== revision.sha256) throw new Error('The frozen research request snapshot was modified.');
}

function currentRevision(task: ResearchTask): ResearchQueryRevision {
  const revision = task.queryRevisions.at(-1);
  if (revision === undefined) throw new Error('Research request revision is missing.');
  return revision;
}

function latestAssignment(task: ResearchTask): ResearchAssignment | undefined {
  return task.assignments.at(-1);
}

function currentUnconsumedAssignment(task: ResearchTask): ResearchAssignment | undefined {
  const assignment = latestAssignment(task);
  if (assignment === undefined || assignment.consumed === true || assignment.notStarted === true ||
    task.stage !== assignment.stage || currentRevision(task).revision !== assignment.queryRevision ||
    task.status === 'cancelled' || task.status === 'ready') return undefined;
  return assignment;
}

function canCancelAssignment(task: ResearchTask): boolean {
  return task.attention.every((item) => item.status !== 'open' || item.kind === 'execution_unknown');
}

function isRetryableJob(job: Pick<JobSnapshot, 'status'>): boolean {
  return job.status === 'failed' || job.status === 'cancelled';
}

function isExecutionRetry(item: ResearchAttention, stage: ResearchStage): boolean {
  return item.status === 'open' && item.stage === stage &&
    (item.kind === 'execution_failure' || item.kind === 'execution_cancelled') && item.allowedActions.includes('retry');
}

function canRetryAssignment(task: ResearchTask): boolean {
  const gates = task.attention.filter((item) => item.status === 'open');
  return gates.length === 0 || (gates.length === 1 &&
    (isExecutionRetry(gates[0]!, task.stage) || (gates[0]!.kind === 'execution_unknown' && gates[0]!.stage === task.stage)));
}

function needsEsmDecision(task: ResearchTask): boolean {
  return task.workflow !== AFPK_WORKFLOW && task.stage === 'nomination' &&
    task.mandate.backend?.esmAvailable === false && task.nomination.esmWaived !== true;
}

function matchesResearchAssignment(ctx: ResearchContext, task: ResearchTask, assignment: ResearchAssignment, job: JobSnapshot): boolean {
  const manifest = readJobRunManifest(ctx.jobsRoot, job.id)?.manifest;
  return manifest !== undefined && manifest.workDir === task.mandate.workDir &&
    job.workDir === manifest.workDir && canonical(job.command) === canonical(manifest.command) &&
    manifest.toolName === assignmentTool(task, assignment.stage) && manifest.configuredOutput === assignment.output &&
    manifest.parameters.values['researchTaskId'] === task.id &&
    manifest.parameters.values['assignmentId'] === assignment.id &&
    manifest.parameters.values['queryRevision'] === assignment.queryRevision &&
    (assignment.requestSha256 === undefined || assignment.requestSha256 === manifest.requestSha256);
}

function isAgentStage(stage: ResearchStage): stage is AgentStage {
  return ['literature', 'hypothesis', 'pathway', 'experiment', 'validation'].includes(stage);
}

function readJson(file: string, maxBytes: number): Record<string, unknown> {
  return jsonObject(readRegular(file, maxBytes));
}

function jsonObject(buffer: Buffer): Record<string, unknown> {
  let value: unknown;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer)); }
  catch { throw new Error('Research input or output is not valid JSON.'); }
  if (!isRecord(value)) throw new Error('Research input or output must be a JSON object.');
  canonical(value);
  return value;
}

function readRegular(file: string, maxBytes: number): Buffer {
  const metadata = lstatSync(file);
  if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error('Research file must be a regular file, not a symbolic link.');
  const descriptor = openSync(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    const stat = fstatSync(descriptor);
    if (!stat.isFile() || stat.dev !== metadata.dev || stat.ino !== metadata.ino || stat.size > maxBytes) throw new Error(`Research file must be an unchanged regular file of at most ${String(maxBytes)} bytes.`);
    const bytes = Buffer.alloc(maxBytes + 1);
    let count = 0;
    while (count < bytes.length) {
      const read = readSync(descriptor, bytes, count, bytes.length - count, null);
      if (read === 0) break;
      count += read;
    }
    if (count > maxBytes) throw new Error('Research file grew beyond the supported byte limit.');
    return bytes.subarray(0, count);
  } finally { closeSync(descriptor); }
}

function fileHash(file: string, maxBytes: number): string { return hash(readRegular(file, maxBytes)); }
function largeFileHash(file: string): string {
  const metadata = lstatSync(file);
  if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error('Research artifact must be a regular file, not a symbolic link.');
  const descriptor = openSync(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const stat = fstatSync(descriptor);
    if (!stat.isFile() || stat.dev !== metadata.dev || stat.ino !== metadata.ino) throw new Error('Research artifact changed while being read.');
    const digest = createHash('sha256');
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    for (;;) {
      const read = readSync(descriptor, buffer, 0, buffer.length, null);
      if (read === 0) break;
      digest.update(buffer.subarray(0, read));
    }
    return digest.digest('hex');
  } finally { closeSync(descriptor); }
}
function hash(value: string | Buffer): string { return createHash('sha256').update(value).digest('hex'); }
function canonical(value: unknown, depth = 0): string {
  if (depth > 32) throw new Error('Research JSON exceeds the supported nesting depth.');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item, depth + 1)).join(',')}]`;
  if (isRecord(value)) return `{${Object.entries(value).filter(([, item]) => item !== undefined).toSorted(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item, depth + 1)}`).join(',')}}`;
  throw new Error('Research JSON contains an unsupported value.');
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function parseObject(value: string): Record<string, unknown> | undefined { try { const parsed: unknown = JSON.parse(value); return isRecord(parsed) ? parsed : undefined; } catch { return undefined; } }
function boundedJson(value: unknown): JsonValue { const rendered = canonical(value); return Buffer.byteLength(rendered) <= 32_000 ? JSON.parse(rendered) as JsonValue : { truncated: true, note: 'Inspect the verified stage output for the complete issue list.' }; }
function validateRequest(query: Record<string, unknown>): void {
  if (query['workflow'] === AFPK_WORKFLOW) {
    afpkRequest.parse(query);
    return;
  }
  if (typeof query['target_class'] !== 'string' || query['target_class'].trim() === '') throw new Error('Nomination request must declare target_class (e.g. cembrene-class TPS / CeeSs).');
  if (!Array.isArray(query['input_proteins']) || query['input_proteins'].length === 0 || !query['input_proteins'].every((value: unknown) => typeof value === 'string' && value.trim() !== '')) throw new Error('Nomination request must declare input_proteins as a non-empty array of FASTA paths.');
  if (typeof query['query_hmm'] !== 'string' || query['query_hmm'].trim() === '') throw new Error('Nomination request must declare query_hmm (an HMMER3 profile path).');
  if (typeof query['reference_dir'] !== 'string' || query['reference_dir'].trim() === '') throw new Error('Nomination request must declare reference_dir (aligned reference FASTAs).');
  if (query['thresholds'] !== undefined && !isRecord(query['thresholds'])) throw new Error('Request thresholds must be a JSON object.');
  if (query['context'] !== undefined && typeof query['context'] !== 'string') throw new Error('Request context must be a string.');
  for (const key of ['targetClass', 'inputProteins', 'queryHmm', 'referenceDir', 'tpsWorkbook']) if (query[key] !== undefined) throw new Error('Nomination request files use snake_case fields.');
}

function validateStageArtifact(stage: ResearchStage, artifact: Record<string, unknown>): void {
  const requireStringArray = (key: string): void => {
    if (!Array.isArray(artifact[key]) || (artifact[key] as unknown[]).length === 0 || !(artifact[key] as unknown[]).every((entry) => isRecord(entry))) throw new Error(`${stage} artifact must declare a non-empty ${key} array of objects.`);
  };
  if (stage === 'literature') {
    requireStringArray('sources');
    if (!Array.isArray(artifact['findings']) || (artifact['findings'] as unknown[]).length === 0 || !(artifact['findings'] as unknown[]).every((entry) => typeof entry === 'string')) throw new Error('literature artifact must declare a non-empty findings string array.');
    if (!Array.isArray(artifact['gaps']) || !(artifact['gaps'] as unknown[]).every((entry) => typeof entry === 'string')) throw new Error('literature artifact must declare a gaps string array.');
  } else if (stage === 'hypothesis') {
    requireStringArray('hypotheses');
    for (const entry of artifact['hypotheses'] as unknown[]) {
      if (!isRecord(entry) || typeof entry['statement'] !== 'string' || entry['statement'].trim() === '' || typeof entry['prediction'] !== 'string' || entry['prediction'].trim() === '') throw new Error('Each hypothesis must carry a statement and a testable prediction.');
    }
  } else if (stage === 'pathway') {
    if (typeof artifact['product'] !== 'string' || artifact['product'].trim() === '') throw new Error('pathway artifact must declare the target product.');
    requireStringArray('steps');
    for (const entry of artifact['steps'] as unknown[]) {
      if (!isRecord(entry) || typeof entry['transformation'] !== 'string' || typeof entry['enzyme_class'] !== 'string') throw new Error('Each pathway step must carry a transformation and enzyme_class.');
    }
  } else if (stage === 'experiment') {
    requireStringArray('designs');
    for (const entry of artifact['designs'] as unknown[]) {
      if (!isRecord(entry) || typeof entry['candidate_id'] !== 'string' || typeof entry['assay'] !== 'string' || !Array.isArray(entry['controls'])) throw new Error('Each experimental design must carry candidate_id, assay, and controls.');
    }
  } else if (stage === 'validation') {
    requireStringArray('records');
    for (const entry of artifact['records'] as unknown[]) {
      if (!isRecord(entry) || !['supported', 'refuted', 'inconclusive'].includes(String(entry['outcome'])) || typeof entry['interpretation'] !== 'string') throw new Error('Each validation record must carry an outcome (supported/refuted/inconclusive) and an interpretation.');
    }
  }
}
function text(value: unknown, name: string, maxLength: number): string { if (typeof value !== 'string' || value.trim() === '' || value.length > maxLength) throw new Error(`${name} must be nonempty text of at most ${String(maxLength)} characters.`); return value.trim(); }
function integer(value: number, name: string, min: number, max: number): number { if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer from ${String(min)} to ${String(max)}.`); return value; }
function currentWorkDir(ctx: ResearchContext): string { const dir = resolveUserPath(ctx.env['ARIADNE_WORKDIR'] ?? process.cwd()); if (!lstatSync(dir).isDirectory()) throw new Error('Research workspace must be a regular directory.'); return realpathSync(dir); }
function deskProjectFile(workDir: string, value: string): string {
  const file = text(value, 'project file', 8_192);
  const absolute = path.resolve(workDir, file);
  const relative = path.relative(workDir, absolute);
  if (path.isAbsolute(file) || file.startsWith('~') || relative === '' || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('Select a file inside the current Research Desk workspace using a relative path.');
  }
  try {
    if (lstatSync(absolute).isFile() && realpathSync(absolute) === absolute) return absolute;
  } catch {
    throw new Error(`The project file is unavailable: ${relative}`);
  }
  throw new Error(`Select a regular project file without symbolic links: ${relative}`);
}

function deskAfpkRequest(workDir: string, query: unknown) {
  const parsed = afpkRequest.parse(query);
  const check = (file: string): string => path.relative(workDir, deskProjectFile(workDir, file));
  const models = parsed.ks_models;
  return {
    ...parsed,
    input_proteins: parsed.input_proteins.map(check),
    ks_models: { fas_i: check(models.fas_i), fas_ii: check(models.fas_ii), pks: check(models.pks) },
    afpk_finder_files: parsed.afpk_finder_files?.map(check),
    published_ks_scores_file: parsed.published_ks_scores_file === undefined ? undefined : check(parsed.published_ks_scores_file),
  };
}
function resolveInput(value: string, workDir: string): string { const input = text(value, 'artifact or request file', 8_192); return input === '~' || input.startsWith('~/') || input.startsWith('~\\') ? resolveUserPath(input) : path.resolve(workDir, input); }
function privateDirectory(dir: string): void { if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 }); regularDirectory(dir); chmodSync(dir, 0o700); }
function regularDirectory(dir: string): void { const stat = lstatSync(dir); if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Research storage directory must not be a symbolic link or non-directory.'); }
function contained(root: string, file: string): void { const relative = path.relative(root, file); if (relative === '' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('Research artifact path escapes its frozen output directory.'); regularDirectory(root); const parent = path.dirname(file); if (realpathSync(parent) !== realpathSync(root)) throw new Error('Research artifact parent must be the frozen regular output directory.'); }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
