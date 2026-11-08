#!/usr/bin/env node
// Drive the full AriadneBuddy scientific-discovery loop through the built CLI
// `research` commands against a deterministic stub adapter: literature →
// hypothesis (approve) → pathway → discovery → filtering → nomination (ESM
// waived) → audit (approve) → experiment → validation → conclude.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = path.resolve(process.argv[2] ?? path.join(packageRoot, 'dist', 'cli.mjs'));
const scratch = mkdtempSync(path.join(tmpdir(), 'ariadne-research-smoke-'));
const requestFile = path.join(scratch, 'nomination-request.json');
const backendFile = path.join(scratch, 'adapter-fixture.mjs');

const FIXTURE_SOURCE = `
import fs from "node:fs";
import path from "node:path";
const args = process.argv.slice(2);
const command = args[0];
const value = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
const writeJson = (file, payload) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + "\\n");
};
if (command === "health") {
  process.stdout.write(JSON.stringify({ ok: true, ready_for_pipeline: true }));
} else if (command === "identity") {
  process.stdout.write(JSON.stringify({
    adapter_version: "smoke", backend_revision: "ariadne-smoke", python: "3.13",
    engines: { hmm: { available: true }, semantic: { available: false }, feature_space: { available: true } },
    defaults: { top_k: 5 },
  }));
} else if (args.includes("--version")) {
  process.stdout.write("smoke-backend 1.0.0\\n");
} else if (command === "discover") {
  const stageDir = value("--stage-dir");
  fs.mkdirSync(stageDir, { recursive: true });
  const proteins = path.join(stageDir, "candidates.protein.faa");
  fs.writeFileSync(proteins, ">seq1\\nMKV\\n>seq2\\nMKVL\\n");
  writeJson(value("--output"), {
    ok: true, stage: "discovery",
    artifacts: { proteins },
    summary: { candidate_count: 2, hit_rows: 2, thresholds: { min_score: 0, max_evalue: 0.001 } },
  });
} else if (command === "filter") {
  const stageDir = value("--stage-dir");
  fs.mkdirSync(stageDir, { recursive: true });
  const filtered = path.join(stageDir, "candidates.filtered.faa");
  fs.writeFileSync(filtered, ">seq1\\nMKV\\n>seq2\\nMKVL\\n");
  writeJson(value("--output"), {
    ok: true, stage: "filtering",
    artifacts: { filtered_fasta: filtered },
    summary: { input_count: 2, kept: 2, removed: 0, thresholds: { min_coverage: 10, min_length: 300 } },
  });
} else if (command === "nominate") {
  const stageDir = value("--stage-dir");
  fs.mkdirSync(stageDir, { recursive: true });
  writeJson(value("--output"), {
    ok: true, kind: "ariadne.nomination-report", schema_version: 1, esm_used: false,
    target_class: "cembrene-class TPS (CeeSs)",
    thresholds: { min_score: 0, max_evalue: 0.001, min_length: 300, ceess_threshold: 0.9, top_k: 5 },
    candidates: [{ sequence_id: "seq1", hmm_score: 210.5, hmm_evalue: 1e-40, length: 320,
      predicted_source: "coral", confidence: 0.92, is_coral_like: "yes",
      nearest_reference: "coral_1", nearest_distance: 0.4 }],
    summary: { evaluated: 2, nominated: 1, coral_like: 2, esm_used: false },
    artifacts: { classification: path.join(stageDir, "classification.tsv") },
  });
} else if (command === "audit-nomination") {
  const nominationFile = value("--nomination-file");
  writeJson(value("--output"), {
    ok: true, kind: "ariadne.nomination-audit", schema_version: 1, status: "pass",
    report: nominationFile,
    summary: { candidates: 1, claims: 1, critical_issues: 0, warnings: 0 },
    issues: [],
    claim_ledger: [{ candidate_id: "seq1", claims: [] }],
  });
} else {
  process.stderr.write("unexpected command: " + command + "\\n");
  process.exit(2);
}
`;

const env = { ...process.env };
for (const key of Object.keys(env)) {
  if (/TOKEN|API_KEY|SECRET|PASSWORD|CREDENTIAL|^ARIADNE_|^KIMI_/i.test(key)) delete env[key];
}
Object.assign(env, {
  ARIADNE_HOME: path.join(scratch, 'home'),
  ARIADNE_WORKDIR: scratch,
  ARIADNE_JOBS_DIR: path.join(scratch, 'jobs'),
  ARIADNE_COMMAND: JSON.stringify([process.execPath, backendFile]),
  KIMI_LOG_LEVEL: 'off',
});

writeFileSync(requestFile, JSON.stringify({
  target_class: 'cembrene-class TPS (CeeSs)',
  input_proteins: ['proteins.faa'],
  query_hmm: 'query.hmm',
  reference_dir: 'references',
}));

// Workspace inputs referenced by the request: the nomination preflight
// fingerprints them as readable files / complete reference directories.
mkdirSync(path.join(scratch, 'references'), { recursive: true });
writeFileSync(path.join(scratch, 'proteins.faa'), '>seq1\nMKV\n>seq2\nMKVL\n');
writeFileSync(path.join(scratch, 'query.hmm'), 'HMMER3/f [smoke]\n');
writeFileSync(path.join(scratch, 'references', 'coral.afa'), '>coral_1\nMKV\n');

writeFileSync(backendFile, FIXTURE_SOURCE);

const runCli = (action, extraArgs = []) => {
  const result = spawnSync(
    process.execPath,
    [entry, 'research', action, ...extraArgs],
    { cwd: scratch, env, encoding: 'utf8', timeout: 60_000 },
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
  // Advance until the controller reaches a stable resting point: waiting on an
  // attention item, or ready. While a durable job is running, poll with backoff.
  let current = task;
  for (let step = 0; step < 60; step += 1) {
    const input = path.join(scratch, `advance-${current.version}-${step}.json`);
    writeFileSync(input, JSON.stringify({ taskId: current.id }));
    const next = runCli('advance', ['--input', input, '--home', env.ARIADNE_HOME]);
    current = next;
    if (next.status === 'running') {
      await delay(300);
      continue;
    }
    if (next.status === 'waiting' || next.status === 'ready') break;
    await delay(60);
  }
  return current;
}

try {
  const createInput = path.join(scratch, 'create.json');
  writeFileSync(createInput, JSON.stringify({
    requestId: 'smoke-closed-loop',
    objective: 'Nominate and validate CeeSs candidates end to end',
    requestFile,
    maxJobs: 8,
  }));
  let task = runCli('create', ['--input', createInput, '--home', env.ARIADNE_HOME]);
  assert.equal(task.stage, 'readiness');

  task = await settle(task);
  assert.equal(task.stage, 'literature');
  assert.ok(openAttention(task, 'stage_input'));

  task = submitStage(task, 'literature', {
    sources: [{ title: 'Wang et al. 2026' }],
    findings: ['Coral TPSs cluster polyphyletically.'],
    gaps: [],
  });
  assert.equal(task.stage, 'hypothesis');

  task = await settle(task);
  task = submitStage(task, 'hypothesis', {
    hypotheses: [{ statement: 'Coral TPS homologs include CeeSs.', prediction: 'CeeSs probability ≥ 0.9.' }],
  });
  assert.ok(openAttention(task, 'stage_review'));
  task = respond(task, 'approve', {}, 'hypotheses approved');
  assert.equal(task.stage, 'pathway');

  task = await settle(task);
  task = submitStage(task, 'pathway', {
    product: 'cembrene A',
    steps: [{ transformation: 'GGPP cyclization', enzyme_class: 'class-I TPS' }],
  });
  assert.equal(task.stage, 'discovery');

  // The compute stages chain while jobs finish; settle stops at the ESM gate.
  task = await settle(task);
  const esmGate = openAttention(task, 'esm_unavailable');
  assert.ok(esmGate, 'expected the ESM availability gate');
  assert.equal(task.stage, 'nomination');
  task = respond(task, 'proceed_without_esm', {}, 'feature-space evidence suffices');
  assert.equal(task.scientificOutcome.status, 'conditional_nomination');

  task = await settle(task);
  assert.ok(
    openAttention(task, 'nomination_review'),
    `stage=${task.stage} status=${task.status} attention=${task.attention.filter((item) => item.status === 'open').map((item) => `${item.kind}:${item.message}`).join(' | ')} jobs=${task.assignments.map((entry) => `${entry.stage}:${entry.status}:${String(entry.consumed === true)}`).join(',')}`,
  );
  assert.equal(task.scientificOutcome.auditStatus, 'pass');

  task = respond(task, 'approve', {}, 'shortlist approved');
  assert.equal(task.stage, 'experiment');
  task = await settle(task);
  task = submitStage(task, 'experiment', {
    designs: [{ candidate_id: 'seq1', system: 'yeast', construct: 'pYES2', assay: 'GC-MS', controls: ['empty'], decision_criteria: 'cembrene detection' }],
  });
  assert.equal(task.stage, 'validation');
  task = await settle(task);
  task = submitStage(task, 'validation', {
    records: [{ candidate_id: 'seq1', outcome: 'supported', interpretation: 'cembrene A confirmed' }],
  });
  assert.equal(task.stage, 'iteration');

  task = await settle(task);
  assert.ok(openAttention(task, 'iteration_decision'));
  task = respond(task, 'conclude', {}, 'validated; hand off');
  assert.equal(task.status, 'ready');
  assert.equal(task.scientificOutcome.status, 'validated');
  assert.equal(task.assignments.length, 4);

  process.stdout.write('Research smoke: closed loop literature → hypothesis → pathway → nomination → audit → experiment → validation → handoff verified\n');
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
