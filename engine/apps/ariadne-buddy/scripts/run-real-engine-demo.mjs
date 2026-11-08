#!/usr/bin/env node
// Drive the full AriadneBuddy scientific-discovery loop through the real
// ariadne-tps engines (pyhmmer HMM retrieval + feature-space structure
// retrieval; ESM2 semantic scoring when torch is installed). Unlike
// smoke-research.mjs this is an interactive demo, not a CI gate: it points
// ARIADNE_REPO at a real checkout and prints the nominated candidates.
//
// Usage: node scripts/run-real-engine-demo.mjs [/path/to/Ariadne]
// Env:   ARIADNE_REPO (defaults to the argument, then ~/Desktop/Ariadne)

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = path.resolve(process.argv[2] ?? path.join(packageRoot, 'dist', 'cli.mjs'));
const repoArg = process.argv[3] ?? process.env.ARIADNE_REPO ?? path.join(homedir(), 'Desktop', 'Ariadne');
const repo = path.resolve(repoArg);

for (const [label, target] of [
  ['built CLI', entry],
  ['ariadne-tps checkout', repo],
  ['query HMM', path.join(repo, 'input', 'query.hmm')],
  ['reference alignments', path.join(repo, 'input', 'references')],
  ['protein inputs', path.join(repo, 'input', 'all_tps.fasta')],
]) {
  assert.ok(existsSync(target), `${label} not found: ${target}`);
}

const scratch = mkdtempSync(path.join(path.join(path.tmpdir ??= '/tmp'), 'ariadne-real-demo-'));
const requestFile = path.join(scratch, 'nomination-request.json');

const env = { ...process.env };
for (const key of Object.keys(env)) {
  if (/TOKEN|API_KEY|SECRET|PASSWORD|CREDENTIAL|^KIMI_/i.test(key)) delete env[key];
}
Object.assign(env, {
  ARIADNE_HOME: path.join(scratch, 'home'),
  ARIADNE_WORKDIR: scratch,
  ARIADNE_JOBS_DIR: path.join(scratch, 'jobs'),
  ARIADNE_REPO: repo,
  KIMI_LOG_LEVEL: 'off',
});

writeFileSync(requestFile, JSON.stringify({
  target_class: 'cembrene-class TPS (CeeSs)',
  input_proteins: [path.join(repo, 'input', 'all_tps.fasta')],
  query_hmm: path.join(repo, 'input', 'query.hmm'),
  reference_dir: path.join(repo, 'input', 'references'),
  tps_workbook: path.join(repo, 'TPS.xlsx'),
  thresholds: { min_score: 0, max_evalue: 0.001, min_length: 300, ceess_threshold: 0.9, top_k: 5 },
  context: 'Real-engine demo over the ariadne-tps tutorial inputs.',
}));

const runCli = (action, extraArgs = []) => {
  const result = spawnSync(
    process.execPath,
    [entry, 'research', action, ...extraArgs],
    { cwd: scratch, env, encoding: 'utf8', timeout: 300_000 },
  );
  assert.equal(result.status, 0, `research ${action} failed:\n${result.stderr}\n${result.stdout}`);
  const start = result.stdout.indexOf('{');
  assert.ok(start >= 0, `research ${action} printed no JSON:\n${result.stdout}`);
  return JSON.parse(result.stdout.slice(start));
};

const submitStage = (task, stage, artifact) => {
  const file = path.join(scratch, `${stage}-artifact.json`);
  writeFileSync(file, JSON.stringify(artifact));
  return respond(task, 'submit_stage', { artifactFile: file }, `deposit ${stage}`);
};

const respond = (task, action, extra, reason) => {
  const input = path.join(scratch, `respond-${action}-${String(task.version)}.json`);
  writeFileSync(input, JSON.stringify({
    taskId: task.id,
    expectedVersion: task.version,
    attentionId: task.attention.find((item) => item.status === 'open')?.id,
    action,
    reason,
    ...extra,
  }));
  return runCli('respond', ['--input', input, '--home', env.ARIADNE_HOME]);
};

const openAttention = (task, kind) =>
  task.attention.find((item) => item.status === 'open' && item.kind === kind);

async function settle(task) {
  let current = task;
  for (let step = 0; step < 600; step += 1) {
    const input = path.join(scratch, `advance-${current.version}-${step}.json`);
    writeFileSync(input, JSON.stringify({ taskId: current.id }));
    const next = runCli('advance', ['--input', input, '--home', env.ARIADNE_HOME]);
    current = next;
    if (next.status === 'running') {
      await delay(1_000);
      continue;
    }
    if (next.status === 'waiting' || next.status === 'ready') break;
    await delay(100);
  }
  return current;
}

try {
  process.stdout.write(`Real-engine demo — repo: ${repo}\n`);
  const createInput = path.join(scratch, 'create.json');
  writeFileSync(createInput, JSON.stringify({
    requestId: `real-demo-${Date.now()}`,
    objective: 'Nominate CeeSs candidates from the ariadne-tps tutorial inputs with the real engines',
    requestFile,
    maxJobs: 8,
  }));
  let task = runCli('create', ['--input', createInput, '--home', env.ARIADNE_HOME]);
  process.stdout.write(`task ${task.id} created (stage ${task.stage})\n`);

  task = await settle(task);
  assert.equal(task.stage, 'literature');
  task = submitStage(task, 'literature', {
    sources: [{ title: 'Wang et al. 2026', doi: '10.1021/acs.jnatprod.6c00686' }],
    findings: ['Coral TPSs are polyphyletic; cembrene-class synthases recur across clades.'],
    gaps: ['Low-similarity coral homologs remain uncharacterized.'],
  });

  task = await settle(task);
  task = submitStage(task, 'hypothesis', {
    hypotheses: [{
      id: 'H1',
      statement: 'Uncharacterized coral TPS homologs include cembrene-class (CeeSs) synthases.',
      rationale: 'Feature-space embedding places several homologs near validated cembrene synthases.',
      prediction: 'Coral-like feature-space context with HMM evidence above thresholds.',
    }],
  });
  const review = openAttention(task, 'stage_review');
  assert.ok(review, 'hypothesis review gate missing');
  task = respond(task, 'approve', {}, 'hypotheses approved');
  process.stdout.write('hypotheses approved — entering pathway reconstruction\n');

  task = await settle(task);
  task = submitStage(task, 'pathway', {
    substrate: 'GGPP',
    product: 'cembrene A',
    steps: [
      { order: 1, transformation: 'ionization-dependent cyclization of GGPP', enzyme_class: 'class-I TPS' },
      { order: 2, transformation: 'dephosphorylation and product release', enzyme_class: 'class-I TPS' },
    ],
    enzyme_slots: [{ slot_id: 'cee-synthase', description: 'cembrene-class carbocyclase' }],
  });
  process.stdout.write('pathway frozen — launching deterministic discovery (real pyhmmer)\n');

  // Compute stages run against the real engines; settle stops at the next gate.
  task = await settle(task);
  if (openAttention(task, 'esm_unavailable')) {
    process.stdout.write('ESM2 unavailable in this checkout — waiving semantic scoring explicitly\n');
    task = respond(task, 'proceed_without_esm', {}, 'HMM + feature-space evidence suffices for the demo');
    task = await settle(task);
  }
  assert.equal(task.stage, 'audit', `unexpected stage: ${task.stage}`);
  process.stdout.write(`nomination done — evaluated=${String(task.nomination.summary?.evaluated ?? '?')} nominated=${String(task.nomination.nominatedCount ?? '?')}\n`);

  task = await settle(task);
  const nominationReview = openAttention(task, 'nomination_review') ?? openAttention(task, 'scientific_review');
  assert.ok(nominationReview, `expected a nomination review gate; stage=${task.stage} attention=${task.attention.filter((item) => item.status === 'open').map((item) => item.kind).join(',')}`);
  process.stdout.write(`audit status: ${String(task.scientificOutcome.auditStatus)}\n`);

  if (openAttention(task, 'scientific_review')) {
    // Honest stop: the deterministic audit flagged the shortlist for review.
    process.stdout.write('audit requires scientific review — demo stops here by design\n');
    process.stdout.write(`attention: ${nominationReview.message}\n`);
  } else {
    task = respond(task, 'approve', {}, 'shortlist approved');
    task = await settle(task);
    task = submitStage(task, 'experiment', {
      designs: [{ candidate_id: '(first nominated candidate)', system: 'yeast heterologous expression',
        construct: 'pYES2-ADH1', assay: 'GC-MS product profile',
        controls: ['empty vector', 'validated CeeSs'], decision_criteria: 'cembrene A/B detection' }],
    });
    task = await settle(task);
    task = submitStage(task, 'validation', {
      records: [{ outcome: 'inconclusive', measurements: ['pending wet-lab confirmation'],
        interpretation: 'Demo record: computational nomination awaits experimental validation.' }],
    });
    task = await settle(task);
    task = respond(task, 'conclude', {}, 'demo concluded');
    assert.equal(task.status, 'ready');
    assert.equal(task.scientificOutcome.status, 'validated');
    process.stdout.write('closed loop complete: literature → hypothesis → pathway → nomination → audit → experiment → validation → handoff\n');
  }

  const artifacts = path.join(env.ARIADNE_JOBS_DIR, 'research', task.id, 'artifacts');
  process.stdout.write(`\nTask artifacts: ${artifacts}\n`);
  const reportFile = task.scientificOutcome.reportFile;
  if (reportFile !== undefined && existsSync(reportFile)) {
    const report = JSON.parse(spawnSync('cat', [reportFile], { encoding: 'utf8' }).stdout ?? '{}');
    process.stdout.write(`\nNominated candidates (${String(report.candidates?.length ?? 0)}):\n`);
    for (const candidate of (report.candidates ?? []).slice(0, 10)) {
      process.stdout.write(
        `  ${String(candidate.sequence_id)} — HMM score ${String(candidate.hmm_score)}, ` +
        `E-value ${String(candidate.hmm_evalue)}, source ${String(candidate.predicted_source)}, ` +
        `nearest ${String(candidate.nearest_reference)} (confidence ${String(candidate.confidence)})\n`,
      );
    }
  }
} finally {
  // Keep the scratch directory for inspection; print it so the user can clean up.
  process.stdout.write(`\nWorkspace retained for inspection: ${scratch}\n`);
}
