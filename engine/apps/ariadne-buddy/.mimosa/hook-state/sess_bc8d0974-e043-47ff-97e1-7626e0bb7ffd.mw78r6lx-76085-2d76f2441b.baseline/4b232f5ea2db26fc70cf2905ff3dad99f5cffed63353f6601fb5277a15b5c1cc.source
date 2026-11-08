import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { listJobs, waitForJob } from '../src/ariadne/jobs';
import {
  advanceResearchTask, cancelResearchTask, createResearchTask, getResearchTask, listResearchTasks,
  respondResearchTask, type ResearchContext, type ResearchTask,
} from '../src/ariadne/research';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

// A deterministic stub backend implementing the adapter contract the research
// controller drives: readiness probes, the four compute stages, and audit.
const STUB_BACKEND = `
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
    adapter_version: "stub", backend_revision: "ariadne 1.1.0-stub", python: "3.13",
    engines: { hmm: { available: true }, semantic: { available: false }, feature_space: { available: true } },
    defaults: { top_k: 5, ceess_threshold: 0.9 },
  }));
} else if (args.includes("--version")) {
  process.stdout.write("stub-backend 1.0.0\\n");
} else if (command === "discover") {
  const stageDir = value("--stage-dir");
  fs.mkdirSync(stageDir, { recursive: true });
  const proteins = path.join(stageDir, "candidates.protein.faa");
  fs.writeFileSync(proteins, ">seq1\\nMKV\\n>seq2\\nMKVL\\n");
  writeJson(value("--output"), {
    ok: true, stage: "discovery",
    artifacts: { proteins, hits: path.join(stageDir, "candidates.hits.tsv") },
    summary: { candidate_count: 2, hit_rows: 2, thresholds: { min_score: 0, max_evalue: 0.001 } },
  });
} else if (command === "filter") {
  const stageDir = value("--stage-dir");
  fs.mkdirSync(stageDir, { recursive: true });
  const filtered = path.join(stageDir, "candidates.filtered.faa");
  fs.writeFileSync(filtered, ">seq1\\nMKV\\n>seq2\\nMKVL\\n");
  writeJson(value("--output"), {
    ok: true, stage: "filtering",
    artifacts: { filtered_fasta: filtered, filter_report: path.join(stageDir, "filter_report.tsv") },
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
      nearest_reference: "ref_coral_1", nearest_distance: 0.4 }],
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

interface Fixture {
  ctx: ResearchContext;
  root: string;
  backend: string;
  requestFile: string;
}

async function makeFixture(): Promise<Fixture> {
  const root = makeTempDir();
  const backend = path.join(root, 'stub-backend.mjs');
  writeFileSync(backend, STUB_BACKEND);
  mkdirSync(path.join(root, 'references'), { recursive: true });
  writeFileSync(path.join(root, 'proteins.faa'), '>seq1\nMKV\n>seq2\nMKVL\n');
  writeFileSync(path.join(root, 'query.hmm'), 'HMMER3/f [stub]\n');
  writeFileSync(path.join(root, 'references', 'coral.afa'), '>ref_coral_1\nMKV\n');
  const requestFile = path.join(root, 'nomination-request.json');
  writeFileSync(requestFile, JSON.stringify({
    target_class: 'cembrene-class TPS (CeeSs)',
    input_proteins: ['proteins.faa'],
    query_hmm: 'query.hmm',
    reference_dir: 'references',
  }));
  const ctx: ResearchContext = {
    jobsRoot: path.join(root, 'jobs'),
    env: { ...process.env, ARIADNE_WORKDIR: root, ARIADNE_COMMAND: JSON.stringify([process.execPath, backend]) },
  };
  return { ctx, root, backend, requestFile };
}

async function settle(ctx: ResearchContext, task: ResearchTask): Promise<ResearchTask> {
  let current = task;
  for (let step = 0; step < 20; step += 1) {
    const active = current.assignments.at(-1);
    if (active !== undefined && !active.consumed && !active.notStarted) {
      await waitForJob(ctx.jobsRoot, active.jobId, 30_000, 100);
    }
    const next = await advanceResearchTask(ctx, { taskId: current.id, expectedVersion: undefined });
    if (next.stage === current.stage && next.status === current.status
      && next.assignments.length === current.assignments.length
      && next.attention.filter((item) => item.status === 'open').length
        === current.attention.filter((item) => item.status === 'open').length) {
      return next;
    }
    current = next;
  }
  return current;
}

function openAttention(task: ResearchTask, kind: string) {
  return task.attention.find((item) => item.status === 'open' && item.kind === kind);
}

function submitArtifact(root: string, stage: string, artifact: Record<string, unknown>): string {
  const file = path.join(root, `${stage}-artifact.json`);
  writeFileSync(file, JSON.stringify(artifact));
  return file;
}

describe('scientific-discovery research loop', () => {
  it('walks the closed loop from literature to a validated handoff', async () => {
    const { ctx, root, requestFile } = await makeFixture();
    let task = createResearchTask(ctx, {
      requestId: 'loop-happy-path',
      objective: 'Nominate and validate CeeSs candidates',
      requestFile,
      maxJobs: 8,
    });

    task = await settle(ctx, task);
    expect(task.mandate.backend?.esmAvailable).toBe(false);
    expect(task.stage).toBe('literature');
    let attention = openAttention(task, 'stage_input');
    expect(attention).toBeDefined();

    task = await respondResearchTask(ctx, {
      taskId: task.id, attentionId: attention!.id, expectedVersion: task.version,
      action: 'submit_stage',
      artifactFile: submitArtifact(root, 'literature', {
        sources: [{ title: 'Wang et al. 2026', doi: '10.1021/acs.jnatprod.6c00686' }],
        findings: ['Coral TPSs are polyphyletic.'],
        gaps: ['Low-similarity enzymes remain unexplored.'],
      }),
      reason: 'Literature survey complete.',
    });
    expect(task.stage).toBe('hypothesis');
    task = await settle(ctx, task);
    attention = openAttention(task, 'stage_input');
    expect(attention).toBeDefined();

    task = await respondResearchTask(ctx, {
      taskId: task.id, attentionId: attention!.id, expectedVersion: task.version,
      action: 'submit_stage',
      artifactFile: submitArtifact(root, 'hypothesis', {
        hypotheses: [{ id: 'H1', statement: 'Uncharacterized coral TPS homologs include CeeSs.',
          rationale: 'Embedding clustering places them near validated cembrene synthases.',
          prediction: 'CeeSs probability ≥ 0.9 with coral-like feature-space context.' }],
      }),
      reason: 'Hypotheses drafted.',
    });
    const review = openAttention(task, 'stage_review');
    expect(review).toBeDefined();
    expect(task.stage).toBe('hypothesis');

    task = await respondResearchTask(ctx, {
      taskId: task.id, attentionId: review!.id, expectedVersion: task.version,
      action: 'approve', reason: 'Hypotheses approved for computation.',
    });
    expect(task.stage).toBe('pathway');
    task = await settle(ctx, task);
    attention = openAttention(task, 'stage_input');
    expect(attention).toBeDefined();

    task = await respondResearchTask(ctx, {
      taskId: task.id, attentionId: attention!.id, expectedVersion: task.version,
      action: 'submit_stage',
      artifactFile: submitArtifact(root, 'pathway', {
        product: 'cembrene A',
        steps: [
          { order: 1, transformation: 'GGPP cyclization', enzyme_class: 'class-I TPS' },
          { order: 2, transformation: 'dephosphorylation', enzyme_class: 'class-I TPS' },
        ],
        enzyme_slots: [{ slot_id: 'cee-synthase', description: 'cembrene-class synthase' }],
      }),
      reason: 'Pathway reconstructed.',
    });
    expect(task.stage).toBe('discovery');

    // The compute stages chain automatically while jobs complete; settle stops
    // exactly at the ESM availability gate before nomination launches.
    task = await settle(ctx, task);
    const esmGate = openAttention(task, 'esm_unavailable');
    expect(esmGate).toBeDefined();
    expect(task.stage).toBe('nomination');
    expect(task.nomination.candidatesFasta).toBeDefined();
    expect(task.nomination.filteredFasta).toBeDefined();
    task = await respondResearchTask(ctx, {
      taskId: task.id, attentionId: esmGate!.id, expectedVersion: task.version,
      action: 'proceed_without_esm', reason: 'HMM + feature-space evidence is sufficient for this screen.',
    });
    expect(task.scientificOutcome.status).toBe('conditional_nomination');

    task = await settle(ctx, task);
    const nominationReview = openAttention(task, 'nomination_review');
    expect(nominationReview, `stage=${task.stage} status=${task.status}`).toBeDefined();
    expect(task.scientificOutcome.auditStatus).toBe('pass');
    expect(task.scientificOutcome.reportFile).toBeDefined();

    task = await respondResearchTask(ctx, {
      taskId: task.id, attentionId: nominationReview!.id, expectedVersion: task.version,
      action: 'approve', reason: 'Shortlist approved for experimental design.',
    });
    expect(task.stage).toBe('experiment');
    task = await settle(ctx, task);
    attention = openAttention(task, 'stage_input');
    expect(attention).toBeDefined();

    task = await respondResearchTask(ctx, {
      taskId: task.id, attentionId: attention!.id, expectedVersion: task.version,
      action: 'submit_stage',
      artifactFile: submitArtifact(root, 'experiment', {
        designs: [{ candidate_id: 'seq1', system: 'yeast heterologous expression',
          construct: 'pYES2-ADH1', assay: 'GC-MS product profile',
          controls: ['empty vector', 'known CeeSs'], decision_criteria: 'cembrene A/B detection' }],
      }),
      reason: 'Experimental designs drafted.',
    });
    expect(task.stage).toBe('validation');
    task = await settle(ctx, task);
    attention = openAttention(task, 'stage_input');
    expect(attention).toBeDefined();

    task = await respondResearchTask(ctx, {
      taskId: task.id, attentionId: attention!.id, expectedVersion: task.version,
      action: 'submit_stage',
      artifactFile: submitArtifact(root, 'validation', {
        records: [{ candidate_id: 'seq1', outcome: 'supported',
          measurements: ['cembrene A detected at 48 h'],
          interpretation: 'Product profile matches the cembranoid hypothesis.' }],
      }),
      reason: 'Validation recorded.',
    });
    expect(task.stage).toBe('iteration');
    task = await settle(ctx, task);
    const decision = openAttention(task, 'iteration_decision');
    expect(decision).toBeDefined();

    task = await respondResearchTask(ctx, {
      taskId: task.id, attentionId: decision!.id, expectedVersion: task.version,
      action: 'conclude', reason: 'Hypothesis supported; handoff.',
    });

    expect(task.status).toBe('ready');
    expect(task.stage).toBe('handoff');
    expect(task.scientificOutcome.status).toBe('validated');
    expect(task.scientificOutcome.auditStatus).toBe('pass');
    expect(task.assignments).toHaveLength(4);
    expect(task.stageArtifacts).toHaveLength(5);
    expect(task.iteration).toBe(1);
    expect(task.scientificOutcome.limitations.some((entry) => entry.includes('ESM2'))).toBe(true);

    const reread = getResearchTask(ctx, task.id);
    expect(reread?.status).toBe('ready');
    expect(listJobs(ctx.jobsRoot)).toHaveLength(4);
    expect(listResearchTasks(ctx, { status: 'ready' }).map((entry) => entry.id)).toContain(task.id);
  }, 120_000);

  it('rejects malformed requests and wrong responses without consuming budget', async () => {
    const { ctx, root, requestFile } = await makeFixture();
    for (const [label, payload] of [
      ['camelCase fields', { targetClass: 'x', inputProteins: ['a'], queryHmm: 'h', referenceDir: 'r' }],
      ['missing proteins', { target_class: 'x', query_hmm: 'h', reference_dir: 'r' }],
      ['missing hmm', { target_class: 'x', input_proteins: ['a'], reference_dir: 'r' }],
      ['missing references', { target_class: 'x', input_proteins: ['a'], query_hmm: 'h' }],
      ['bad thresholds', { target_class: 'x', input_proteins: ['a'], query_hmm: 'h', reference_dir: 'r', thresholds: 5 }],
    ] as const) {
      const bad = path.join(root, `bad-${label.replaceAll(/\s+/g, '-')}.json`);
      writeFileSync(bad, JSON.stringify(payload));
      expect(() => createResearchTask(ctx, {
        requestId: `bad-${label}`, objective: 'invalid', requestFile: bad,
      }), label).toThrow();
    }

    const task = createResearchTask(ctx, {
      requestId: 'response-errors', objective: 'Check response guards', requestFile,
    });
    await expect(respondResearchTask(ctx, {
      taskId: task.id, attentionId: 'attention_0000000000000000', expectedVersion: task.version,
      action: 'approve', reason: 'no such item',
    })).rejects.toThrow(/Unknown or resolved/);

    const advanced = await settle(ctx, task);
    const attention = openAttention(advanced, 'stage_input');
    expect(attention).toBeDefined();
    await expect(respondResearchTask(ctx, {
      taskId: advanced.id, attentionId: attention!.id, expectedVersion: advanced.version,
      action: 'approve', reason: 'wrong action for a stage input',
    })).rejects.toThrow(/not allowed/);
    await expect(respondResearchTask(ctx, {
      taskId: advanced.id, attentionId: attention!.id, expectedVersion: advanced.version + 5,
      action: 'submit_stage',
      artifactFile: submitArtifact(root, 'literature', {
        sources: [{ title: 'x' }], findings: ['y'], gaps: [],
      }),
      reason: 'stale version',
    })).rejects.toThrow(/version conflict/);
    await expect(respondResearchTask(ctx, {
      taskId: advanced.id, attentionId: attention!.id, expectedVersion: advanced.version,
      action: 'submit_stage',
      artifactFile: submitArtifact(root, 'literature', { findings: ['no sources'] }),
      reason: 'invalid artifact',
    })).rejects.toThrow(/literature artifact/);

    const unchanged = getResearchTask(ctx, advanced.id);
    expect(unchanged?.stage).toBe('literature');
    expect(unchanged?.assignments).toEqual([]);
  }, 30_000);

  it('amends the request back to the knowledge loop and cancels cleanly', async () => {
    const { ctx, root, requestFile } = await makeFixture();
    let task = createResearchTask(ctx, {
      requestId: 'amend-and-cancel', objective: 'Amend then cancel', requestFile, maxJobs: 8,
    });
    task = await settle(ctx, task);
    const attention = openAttention(task, 'stage_input');
    expect(attention).toBeDefined();

    task = await respondResearchTask(ctx, {
      taskId: task.id, attentionId: attention!.id, expectedVersion: task.version,
      action: 'submit_stage',
      artifactFile: submitArtifact(root, 'literature', {
        sources: [{ title: 'initial' }], findings: ['initial'], gaps: [],
      }),
      reason: 'Initial survey.',
    });
    expect(task.stage).toBe('hypothesis');
    expect(task.queryRevisions).toHaveLength(1);

    task = await settle(ctx, task);
    const amendedRequest = path.join(root, 'nomination-request-v2.json');
    writeFileSync(amendedRequest, JSON.stringify({
      target_class: 'cembrene-class TPS (CeeSs)',
      input_proteins: ['proteins.faa'],
      query_hmm: 'query.hmm',
      reference_dir: 'references',
      thresholds: { min_length: 280 },
    }));
    const gate = openAttention(task, 'stage_input');
    expect(gate).toBeDefined();
    task = await respondResearchTask(ctx, {
      taskId: task.id, attentionId: gate!.id, expectedVersion: task.version,
      action: 'amend_request', requestFile: amendedRequest, reason: 'Tightened thresholds.',
    });
    expect(task.stage).toBe('literature');
    expect(task.queryRevisions).toHaveLength(2);
    expect(task.stageArtifacts.filter((entry) => entry.stage === 'literature')).toHaveLength(1);

    task = await cancelResearchTask(ctx, { taskId: task.id, reason: 'Study deprioritized.' });
    expect(task.status).toBe('cancelled');
    expect(task.scientificOutcome.status).toBe('cancelled');
    expect(listJobs(ctx.jobsRoot)).toEqual([]);
  }, 30_000);
});

function makeTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'ariadne-research-test-'));
  tempDirs.push(dir);
  return dir;
}
