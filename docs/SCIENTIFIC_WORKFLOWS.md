# Scientific workflow discipline

AriadneBuddy is an execution and interaction layer around the Ariadne
deterministic engines. It helps make natural-product candidate discovery
traceable; it does not turn a screening score into a demonstrated enzyme.

## Operating rules

1. **Role-first**: every reply names the expert role that produced it
   (Literature Surveyor / Hypothesis Architect / Pathway Reconstructor /
   Nomination Steward / Experimental Designer / Validation Interpreter).
2. **Engine numbers are sacred**: HMM scores, E-values, CeeSs probabilities,
   nearest references, and confidences come only from engine artifacts.
   Rounding into different thresholds or inventing values is forbidden.
3. **Three evidence classes, always labeled**:
   - *engine* — deterministic outputs (TSV/JSON artifacts, fingerprints);
   - *rules* — adapter audit codes (NOM-001…008) and controller gates;
   - *synthesis* — the conversational model's reasoning, clearly marked.
4. **Gates are decisions**: hypothesis approval, nomination approval,
   iterate/conclude, and the ESM waiver are explicit attention items. A
   caller-declared response is not verified human approval.
5. **No silent re-runs**: the controller owns stage jobs; inspect its verified
   artifacts instead of re-launching stages ad hoc. Retries are explicit and
   budgeted.

## Stage contracts

| Stage | Owner | Artifact contract |
| --- | --- | --- |
| literature | agent | `{sources: [{title, doi?, note}], findings: [..], gaps: [..]}` |
| hypothesis | agent | `{hypotheses: [{id?, statement, rationale, prediction}]}` → human gate |
| pathway | agent | `{substrate?, product, steps: [{transformation, enzyme_class}], enzyme_slots?}` |
| discovery | engine | pyhmmer best-hit search; `artifacts.proteins` (candidates FASTA) + hits table |
| filtering | engine | coverage/length/near-duplicate QC; `artifacts.filtered_fasta` |
| nomination | engine | ESM2 scoring (when available) + feature-space structure retrieval → shortlist with full evidence rows |
| audit | engine | claim-evidence ledger; `pass` required before experimental design |
| experiment | agent | `{designs: [{candidate_id, system, construct, assay, controls, decision_criteria}]}` |
| validation | agent | `{records: [{candidate_id?, outcome: supported|refuted|inconclusive, measurements?, interpretation}]}` |
| iteration | human | iterate (≤ 4 rounds, back to hypothesis) or conclude (verified handoff) |

## Nomination evidence floor

A candidate is **not** nominated unless, in the declared mode:

- HMM score ≥ `min_score` and E-value ≤ `max_evalue` (always);
- length ≥ `min_length` (warning-level);
- ESM CeeSs probability ≥ `ceess_threshold` when ESM2 runs;
- in waived mode (`proceed_without_esm`), coral-like feature-space context
  carries the nomination and the outcome is `conditional_nomination`.

The deterministic audit re-checks every row (NOM-001…008); a failing audit
blocks experimental design, and warnings always reach the human.

## Claims language

- "Nominated candidate X (HMM 566.2, E-value 3e-173, nearest PhoTC-1,
  confidence 1.0)" — engine-backed.
- "CeeSs probability 0.97 ≥ 0.9 threshold" — engine-backed, mode ESM.
- "Heterologous expression should confirm cembrene A formation" — design
  statement, not a result.
- Never: "X is a cembrene synthase" before product confirmation.
