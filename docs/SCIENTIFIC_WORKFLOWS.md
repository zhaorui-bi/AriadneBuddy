# Scientific workflow discipline

AriadneBuddy is an execution and interaction layer around the Ariadne
deterministic engines. It helps make natural-product candidate discovery
traceable; it does not turn a screening score into a demonstrated enzyme.

![The closed research loop: a ring of fluted columns for the readiness,
literature, hypothesis, pathway, discovery, filtering, nomination, audit,
experiment and validation stages, laurel branches at the three human gates, a
handoff column, and Ariadne's thread carrying the iterate decision back to
hypothesis](./images/loop.svg)

The stages below are the columns of that loop. Each one freezes an artifact, and
the controller re-verifies a stage output before consuming it.

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
| readiness | controller | no artifact; backend health, identity, and scientific configuration are checked against the frozen mandate |
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
| handoff | controller | no new artifact; lineage re-verified before the task is reported ready |

An `afpk-ks` request replaces the knowledge and compute stages with one
three-profile KS batch screen that opens a shortlist review; the request
contract is in [Research tasks](./RESEARCH_TASKS.md#molluscan-ks-screening).

## The two human gates

Two stages cannot proceed on execution success alone. Each opens an attention
item whose allowed actions are `approve` and one alternative.

### Hypothesis gate

Trigger: a `hypothesis` artifact is deposited (`stage_review`).
Approve: the controller verifies the frozen artifact and moves to `pathway`.
Revise: the hypothesis stage reopens for a new artifact; the round does not
advance. The recorded event reads
`Hypotheses approved (caller-declared); pathway reconstruction may proceed.`

### Nomination gate

Trigger: the audit stage returns `pass` for a shortlist
(`nomination_review`, or `afpk_nomination_review` in an `afpk-ks` task).
Approve: the controller re-verifies the nomination review and moves to
`experiment` (`handoff` for an AFPK shortlist, recorded as acceptance for
computational handoff).
Amend request: a new request revision is frozen, the nomination evidence is
cleared, and the loop restarts at `literature`.

A caller-declared `approve` records who decided and why. It is not independent
human sign-off, and it cannot turn an audit warning or failure into a ready
result.

## Two further decisions

Neither is a stage gate, and both are recorded the same way.

- **Iteration decision** (`iteration_decision`) after the validation artifact:
  `iterate` opens a new hypothesis round carrying the validation learnings, or
  `conclude` freezes the verified handoff.
- **ESM waiver** (`esm_unavailable`) when ESM2 scoring is unavailable at the
  nomination stage: `proceed_without_esm` continues on HMM and feature-space
  evidence alone.

## Iteration budget

The controller allows at most four rounds. `iteration` starts at 1 and `iterate`
increments it; a request to iterate at round 4 is rejected with
`The iteration limit (4) is exhausted; conclude or create a new task.` A new
round restarts at `hypothesis` and clears the previous scientific outcome, so
evidence from an earlier round is never carried into the next one silently. The
budget bounds rounds, not job submissions; the job budget is separate.

## Nomination evidence floor

A candidate is **not** nominated unless, in the declared mode:

- HMM score ≥ `min_score` and E-value ≤ `max_evalue` (always);
- length ≥ `min_length` (warning-level);
- ESM CeeSs probability ≥ `ceess_threshold` when ESM2 runs;
- in waived mode (`proceed_without_esm`), coral-like feature-space context
  carries the nomination and the outcome is `conditional_nomination`.

The deterministic audit re-checks every row (NOM-001…008); a failing audit
blocks experimental design, and warnings always reach the human.

## ESM waiver and `conditional_nomination`

`proceed_without_esm` is the caller's explicit answer to the ESM availability
gate. It sets the nomination's `esmWaived` flag, appends the limitation
`ESM2 semantic scoring was waived by caller decision; nomination relies on HMM
and feature-space evidence only.`, and records the scientific outcome as
`conditional_nomination`.

The waiver does not weaken the audit. The audit stops re-flagging the absent
semantic evidence, but every remaining check still runs, and the outcome stays
`conditional_nomination` through the handoff. An `afpk-ks` shortlist approved
for computational handoff carries the same outcome: putative enzyme-family
assignment, not established function.

## Claims language

- "Nominated candidate X (HMM 566.2, E-value 3e-173, nearest PhoTC-1,
  confidence 1.0)" — engine-backed.
- "CeeSs probability 0.97 ≥ 0.9 threshold" — engine-backed, mode ESM.
- "Heterologous expression should confirm cembrene A formation" — design
  statement, not a result.
- Never: "X is a cembrene synthase" before product confirmation.

A screening score is not activity. HMM scores, ESM probabilities, and
nearest-reference distances are screening signals; a nominated candidate
requires heterologous expression and product confirmation before any claim of
enzyme function. The same limit applies to the AFPK screen: it gives a putative
enzyme-family assignment for pre-extracted domains and does not establish
organismal origin, enzyme function, or product identity.

## Related

- [Research tasks](./RESEARCH_TASKS.md) · [Examples](./EXAMPLES.md)
- [Glossary](./GLOSSARY.md) · [Quick start](./QUICKSTART.md)
- [Molluscan KS case](../examples/cases/AFPK_MOLLUSC.md)
