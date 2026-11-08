---
name: ariadne-campaign
description: Plan, pilot, compare, and report a reproducible AriadneBuddy nomination study across multiple protein sets, query HMMs, thresholds, reference snapshots, or ESM models. Use for batch comparisons, ablations (threshold sweeps, HMM choice, ESM model choice), and repeated discovery studies. Do not use for one routine nomination task or a job lookup.
---

# Reproducible Ariadne discovery campaigns

Use this skill when the unit of work is a **study** rather than one research task.
Ariadne engine tools execute deterministic stages; ordinary workspace tools maintain
the study manifest, request files, and summary tables.

## 1. Freeze the question first

Write down, before any launch:

- objectives and hypotheses under comparison (e.g. "does ceess_threshold 0.8 vs 0.9
  change the shortlist on the same discovery set?");
- the exact request matrix (inputs, query HMM, references, workbook, thresholds);
- metrics you will read from engine artifacts (nominated count, audit status,
  nearest-reference composition);
- the budget (number of pipeline runs, ESM downloads avoided by reusing caches).

Do not revise the question mid-campaign; start a new campaign instead.

## 2. Create a manifest before launching jobs

Maintain `campaign-manifest.json` in the study directory:

```json
{
  "schema_version": 1,
  "campaign_id": "ceess-threshold-sweep-2026-11",
  "engine_revision": "<ariadne_status backend version>",
  "request_matrix": [
    {"run_id": "t08", "request_file": "requests/t08.json"},
    {"run_id": "t09", "request_file": "requests/t09.json"}
  ],
  "frozen_artifacts": {"references_sha256": "...", "query_hmm_sha256": "...", "workbook_sha256": "..."},
  "metrics": ["nominated", "audit_status", "coral_like"],
  "status": "planned"
}
```

Record input fingerprints from `ariadne_job_manifest` before comparisons.

## 3. Advance through gates

1. **Readiness** — `ariadne_status` (engines + data + ESM availability recorded).
2. **Smoke** — one `ariadne_pipeline_run` on the smallest request; inspect artifacts.
3. **Pilot** — one cell per distinct factor level; verify audit outcomes.
4. **Campaign** — remaining matrix cells as durable jobs.
5. **Reduction** — collect per-run summaries into one table (workspace tools only).
6. **Report** — the deliverable below.

## 4. Keep comparisons fair

- One factor changes per cell; everything else frozen by fingerprint.
- ESM availability must be identical across compared cells (or explicitly split into
  separate esm/no-esm cohorts — never mix silently).
- Report denominators exactly: nominated/evaluated, audit pass/warn/fail counts.
- No threshold tuning on the same data used for the final claim.

## 5. Observe without flooding context

Use `ariadne_job_status`/`manifest` and bounded `ariadne_job_log` reads. Poll with
backoff; never loop tightly. Cancel stray jobs explicitly.

## 6. Report the complete study

The final report must include: the frozen question, the request matrix with
fingerprints, per-run summaries (nominated, audit status, warnings), deviations
(cancelled jobs, ESM waivers), honest denominators, negative results, and the
identity chain (engine version, adapter version, ESM model, reference snapshot)
with each run's `requestSha256`.
