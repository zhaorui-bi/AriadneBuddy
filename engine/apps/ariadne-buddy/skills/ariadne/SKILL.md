---
name: ariadne
description: Create or resume a persistent, gated scientific-discovery research task that walks the closed loop from literature review, hypothesis generation, and pathway reconstruction to deterministic computational nomination (HMM retrieval, ESM2 semantic scoring, feature-space structure retrieval), nomination audit, experimental design, and validation interpretation. Also use for any single Ariadne engine operation (HMM search, filtering, scoring, classification, pipeline run). Do not use for reproducible benchmark/campaign suites; use ariadne-campaign instead.
---

# AriadneBuddy scientific-discovery operations

AriadneBuddy couples **expert agent roles** with the **Ariadne deterministic engines** to
discover natural-product biosynthetic enzymes — today, coral terpene synthases (TPS) and
cembrene-class (CeeSs) candidates. Expert roles divide every task:

- **Literature Surveyor (文献调研)** — ground the objective in citable sources; expose gaps.
- **Hypothesis Architect (假说生成)** — testable hypotheses tied to the target class.
- **Pathway Reconstructor (途径重构)** — substrate → product steps with enzyme slots.
- **Nomination Steward (候选提名)** — drives the deterministic engines; reads only engine outputs.
- **Experimental Designer (实验设计)** — expression/assay designs per nominated candidate.
- **Validation Interpreter (验证解读)** — separates outcome from interpretation; feeds iteration.

Say which role is speaking. Keep engine evidence, rules, and your synthesis separate.
This is discovery support: a nominated candidate is not a demonstrated enzyme.

The harness exposes the workflow through `ariadne_*` MCP tools and durable research
tasks with provenance manifests. Long engine operations run as durable jobs — never
busy-poll; use job status/manifest/bounded logs.

## Operating contract

1. Status first: run `ariadne_status` before engine work on a new machine or when
   readiness is unknown. If ESM2 is unavailable, say so — semantic scoring will be
   gated behind an explicit `proceed_without_esm` decision.
2. Preserve numbers exactly: HMM scores, E-values, probabilities, and distances come
   from engine artifacts. Never round into different thresholds or invent values.
3. Structure over prose: report candidates from `classification.tsv` /
   nomination-report fields, not from memory.
4. Distinguish engine outputs (deterministic evidence), adapter rules (audit codes),
   and model synthesis (your reasoning). Label each.
5. State gaps; recommend expert review before experimental claims.
6. Confirm before expensive or destructive operations (overwriting outputs, re-running
   large searches, ESM model downloads).
7. The research controller owns stage jobs for a research task — inspect its artifacts
   instead of re-running its stages independently.

## Nomination-request checklist

Research requests are snake_case JSON with at least:

```json
{
  "target_class": "cembrene-class TPS (CeeSs)",
  "input_proteins": ["proteins.faa"],
  "query_hmm": "query.hmm",
  "reference_dir": "references/",
  "tps_workbook": "TPS.xlsx",
  "thresholds": {"min_score": 0, "max_evalue": 0.001, "min_length": 300,
                  "ceess_threshold": 0.9, "top_k": 5},
  "context": "optional provenance and literature notes"
}
```

Relative paths resolve from `ARIADNE_WORKDIR`. Check reference clades and TPS type
labels with `ariadne_catalog` before first use.

## Closed-loop workflow (case → handoff)

1. Run `ariadne_status`; confirm engines, reference data, and ESM availability.
2. Call `ariadne_research_create` with `requestFile`, a concrete `objective`, and a
   bounded `maxJobs` (default 6). Creation starts no engine work.
3. Call `ariadne_research_advance` repeatedly. For knowledge stages
   (`literature`, `hypothesis`, `pathway`, `experiment`, `validation`) it opens a
   stage-input attention: author the artifact JSON in the expert role, save it under
   the workspace, and respond with `submit_stage` + `artifactFile`.
   - literature artifact: `{sources: [{title, doi?, year?, note}], findings: [..], gaps: [..]}`
   - hypothesis artifact: `{hypotheses: [{id?, statement, rationale, prediction, literature_refs?}]}`
   - pathway artifact: `{substrate?, product, steps: [{order?, transformation, enzyme_class, evidence?}], enzyme_slots?}`
   - experiment artifact: `{designs: [{candidate_id, system, construct, assay, controls: [..], decision_criteria}]}`
   - validation artifact: `{records: [{design_ref?, candidate_id?, outcome: supported|refuted|inconclusive, measurements?, interpretation}]}`
4. Gates: after the hypothesis artifact, `approve` (or `revise`) before compute is
   spent. After a passing nomination audit, `approve` the shortlist before
   experimental design. After validation, `iterate` (new hypothesis round, bounded
   to 4 iterations) or `conclude` (verified handoff).
5. Compute stages run deterministically: discovery (HMM retrieval) → filtering →
   nomination (ESM2 semantic scoring + feature-space structure retrieval) → audit.
   Inspect each stage's verified artifacts; do not re-run them ad hoc.
6. `amend_request` (with a new `requestFile`) restarts the knowledge loop under a new
   frozen revision. `retry` re-runs a failed stage within budget.
7. Recover tasks with `ariadne_research_list`/`status`. Surface attention items to the
   human; caller-declared responses are not verified human approval.

## Choosing the right tool

- `ariadne_status` — readiness, engines, ESM availability, data.
- `ariadne_catalog` — reference clades + labeled TPS types.
- `ariadne_build_hmm` — alignment (MSA) → HMMER3 profile.
- `ariadne_discover` — standalone HMM retrieval over protein FASTAs.
- `ariadne_filter` — coverage/length/near-duplicate filtering.
- `ariadne_score_candidates` — standalone ESM2 semantic scoring (needs torch/transformers).
- `ariadne_classify` — feature-space structure retrieval with nearest references.
- `ariadne_pipeline_run` — full deterministic run from a nomination request.
- `ariadne_audit_nomination` — claim-evidence ledger over a nomination report.
- `ariadne_job_*` — durable-job list/status/manifest/log/artifacts/cancel.
- `ariadne_research_*` — the gated closed-loop controller.

## Interpreting results

- Report each nominated candidate with its evidence: HMM score/E-value, length,
  ESM type prediction and CeeSs probability (when ESM ran), predicted source,
  nearest references and confidence. Say explicitly when ESM evidence is absent.
- An audit `warn` (e.g. NOM-006 semantic evidence waived) must reach the human.
- Heterologous expression and product confirmation remain necessary before any
  functional claim; a screening score is not activity.
