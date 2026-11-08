# Durable scientific-discovery research tasks

Research tasks connect a nomination request, its knowledge artifacts, the
deterministic engine stages, audits, and validation records across sessions.
The six `ariadne_research_*` tools (and the `ariadnebuddy research` CLI) drive
one shared, file-locked state machine — no conversational model is required
for task control.

## Lifecycle

```
readiness → literature → hypothesis → (approve|revise) → pathway
  → discovery → filtering → nomination → audit
  → (approve shortlist | amend request | retry)
  → experiment → validation → (iterate ≤ 4 | conclude) → handoff (ready)
```

Statuses: `open`, `running`, `waiting`, `ready`, `cancelled`. Every mutating
call carries `expectedVersion` (optimistic concurrency); every transition is
appended to a bounded event log.

## Responses to attention items

| Action | Applies to | Effect |
| --- | --- | --- |
| `submit_stage` | `stage_input` | freezes the stage artifact (schema-validated) and advances |
| `approve` | `stage_review`, `nomination_review` | passes a human gate |
| `revise` | `stage_review` | reopens the hypothesis stage for a new artifact |
| `amend_request` | most gates | freezes a new request revision; knowledge loop restarts at literature |
| `proceed_without_esm` | `esm_unavailable` | explicit waiver; outcome becomes `conditional_nomination` |
| `iterate` | `iteration_decision` | new hypothesis round with validation learnings (≤ 4) |
| `conclude` | `iteration_decision` | verifies lineage and freezes the validated handoff |
| `retry` | `execution_failure`, `environment_readiness` | re-runs the stage within budget |

## Guarantees

- **Frozen mandate**: requestId, objective, request revision hashes, job
  budget, backend identity + non-secret scientific configuration are
  fingerprinted; drift stops the task with `configuration_drift`.
- **Verified consumption**: a stage output is consumed only when its durable
  `run-manifest.json` (job id, tool, assignment id, revision, configured
  output, sha256) matches byte-for-byte at completion time and still matches on
  re-read.
- **Budget**: default 6 engine jobs (max 16); the loop needs 4 (discovery,
  filtering, nomination, audit) — retries draw from the same pool.
- **Honest outcomes**: `scientificOutcome.status` ∈ pending / blocked /
  conditional_nomination / review_required / validated / cancelled, kept
  strictly separate from execution success. Audit warnings and failures can
  never be waived into `ready`.

## CLI

```bash
ariadnebuddy research create  --input create.json          # freeze the mandate
ariadnebuddy research status  --id research_<hash>          # read state
ariadnebuddy research list                                  # recent tasks
ariadnebuddy research advance --id research_<hash>          # reconcile + advance one step
ariadnebuddy research respond --input respond.json --id research_<hash>
ariadnebuddy research cancel --id research_<hash> --input cancel.json
```

Artifacts live under `<jobs-root>/research/<id>/artifacts/` (request
revisions, frozen stage artifacts, per-stage outputs, engine side files).
