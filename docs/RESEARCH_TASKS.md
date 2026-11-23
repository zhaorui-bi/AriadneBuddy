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

Stages: `readiness`, `literature`, `hypothesis`, `pathway`, `discovery`,
`filtering`, `nomination`, `audit`, `experiment`, `validation`, `iteration`,
`handoff`.

Statuses: `open`, `running`, `waiting`, `ready`, `cancelled`.

An `afpk-ks` request runs a different path: `readiness` → one three-profile KS
screen → shortlist review → `handoff`.

## State machine

| Status | Meaning |
| --- | --- |
| `open` | the task is registered and waiting for the next `advance`, artifact, or decision |
| `running` | a durable engine job is in flight |
| `waiting` | an attention item is open; the controller will not advance past it |
| `ready` | the handoff was verified and frozen |
| `cancelled` | cancellation was confirmed; the task retains its records and cannot resume |

Every mutating call carries `expectedVersion` (optimistic concurrency) and
every transition is appended to a bounded event log. `advance` performs one
step: it reconciles the current durable assignment, then either opens a
stage-input attention item, launches the next engine job, or stops at an open
attention item. A closed task (`ready` or `cancelled`) accepts no responses.

## Attention items and the waitingReason vocabulary

An attention item is an explicit request for a decision. It carries an `id`, a
`kind`, the `stage` it belongs to, a `message`, and the `allowedActions` that
can resolve it. `waitingReason` is the `kind` of the first open item, and the
Research Desk renders it with these labels:

| `waitingReason` | Desk label | Raised when | Allowed responses |
| --- | --- | --- | --- |
| `stage_input` | Stage input pending | a knowledge stage needs its artifact | `submit_stage`, `amend_request` |
| `stage_review` | Hypothesis review pending | a hypothesis artifact was deposited | `approve`, `revise` |
| `nomination_review` | Shortlist review pending | the audit passed for a nominated shortlist | `approve`, `amend_request` |
| `afpk_nomination_review` | Shortlist review pending | an `afpk-ks` screen produced a putative shortlist | `approve`, `revise`, `amend_request` |
| `afpk_empty_shortlist` | No AFPK nominations | an `afpk-ks` screen produced no candidates | `amend_request` |
| `afpk_revision` | Request revision pending | an AFPK shortlist review was revised | `amend_request` |
| `iteration_decision` | Iteration decision pending | validation records are frozen | `iterate` (before round 4), `conclude` |
| `esm_unavailable` | ESM scoring decision pending | ESM2 scoring is unavailable at nomination | `proceed_without_esm`, `amend_request` |
| `scientific_review` | Scientific review pending | the audit returned `warn` or `fail` | `amend_request` |
| `environment_readiness` | Runtime setup pending | backend health or identity could not be confirmed | `retry` |
| `configuration_drift` | Configuration changed | the backend command, revision, or scientific settings changed after the mandate froze | none |
| `preflight_failure` | Input check failed | the input preflight failed before any launch | `amend_request` |
| `execution_failure` | Job failed | an engine job failed | `retry`, `amend_request` |
| `execution_cancelled` | Job stopped | an engine job was cancelled | `retry`, `amend_request` |
| `execution_unknown` | Job state unconfirmed | a job's terminal state or its cancellation could not be confirmed | none |
| `malformed_result` | Result review pending | a job result could not be verified | `amend_request` |
| `integrity` | Integrity check pending | a frozen artifact no longer matches the verified run | `amend_request`, or none when a dependency check failed |
| `budget_exhausted` | Job budget exhausted | the frozen job budget is used | none |

An attention item with no allowed response cannot be cleared from inside the
task: read its message, preserve the run, and start a new task for the changed
configuration or expanded scope.

## Responses

`ariadne_research_respond` records one caller-declared decision against one
attention item. The action must be in that item's `allowedActions`.

| Action | Applies to | Effect |
| --- | --- | --- |
| `submit_stage` | `stage_input` | freezes the stage artifact (schema-validated) and advances |
| `approve` | `stage_review`, `nomination_review`, `afpk_nomination_review` | passes a human gate |
| `revise` | `stage_review`, `afpk_nomination_review` | reopens the hypothesis stage, or opens `afpk_revision` |
| `amend_request` | most gates | freezes a new request revision; the loop restarts at `literature` (`readiness` for AFPK) |
| `proceed_without_esm` | `esm_unavailable` | explicit waiver; outcome becomes `conditional_nomination` |
| `iterate` | `iteration_decision` | new hypothesis round with validation learnings (≤ 4) |
| `conclude` | `iteration_decision` | verifies lineage and freezes the validated handoff |
| `retry` | `execution_failure`, `execution_cancelled`, `environment_readiness` | re-runs the stage within budget |

Every response requires a `reason` and is written to the event log as
`<action>: <reason> (caller-declared; no independent human approval is
asserted)`.

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
- **Caller-declared decisions**: a response records who decided and why. It is
  not trusted human sign-off, and it cannot turn an audit warning or failure
  into a ready result.
- **Audit failures block handoff**: readiness requires `auditStatus` of `pass`
  over the verified nomination output, a completed discovery → filtering →
  nomination → audit lineage for the current revision, and frozen `experiment`
  and `validation` artifacts. A `warn` or `fail` audit opens
  `scientific_review`, whose only response is `amend_request`. Re-verification
  of a ready task that no longer matches moves it to `review_required`.
- **Version conflict**: a mutation whose `expectedVersion` does not match the
  stored version is rejected. The Research Desk answers 409; the CLI reports
  `Research version conflict: expected N, current M. Read the task before
  retrying.` and exits 1. Job records, artifacts, and decisions are unchanged.
- **Bounded history**: the event log keeps the most recent 128 events and
  reports `eventsTruncated`; request revisions are capped at 16.

## Research sessions

Select a research task from the session list in the Web or desktop sidebar. A
session shows the current stage, results, and review actions. Expand
**Activity and files** for compute assignments, frozen JSON artifacts, and the
task timeline in the server's launch workspace. Opening an artifact rechecks
its fingerprint and, for engine output, its job manifest. Record hypothesis
approval or revision, nomination approval, and iteration or conclusion with
a reason and the current task version. These responses use the same
caller-declared decision contract as the CLI.

Cancelled tasks listed in the sidebar stay available under **Archived tasks**.
Open AFPK sessions, including cancelled ones, through their direct links for
job, artifact, and review records.

Under **Activity and files → Compute**, select **Stop job** for the current running assignment and
confirm the cancellation. The task retains its request, prior evidence and job
history. Use **Retry job** on the latest failed or stopped job to launch another
attempt for the same stage and request revision within the job budget. The new
attempt links to the original job. Finished jobs retain their observed outcome.

## Molluscan KS screening

Set `workflow` to `afpk-ks` in the request file. Supply pre-extracted KS amino-acid
FASTA files, one profile each in `ks_models.fas_i`, `ks_models.fas_ii`, and
`ks_models.pks`, and the inclusive FAS I bit-score band as `fas_i_window.min`
and `fas_i_window.max`. Set `ARIADNE_AFPK_PYTHON` to a Python interpreter with
PyHMMER installed. Paths resolve against the research workspace.

The screen runs as a single durable job. It retains all three full-sequence bit
scores as reported by HMMER and leaves missing or tied comparisons unresolved.
Putative AFPK nominations require a unique FAS I lead inside the requested band.
Optional `reference_anchors` must appear in the input batch and are excluded from
the shortlist. The run manifest records input, profile, and optional evidence
file fingerprints, which are compared to the hashes of the bytes read by the
backend before accepting its results.

`afpk_finder_files` can attach existing AFPK-finder t-SNE/HDBSCAN TSV exports or
the published four-column mollusc cluster table. Use `published_ks_scores_file`
for published comparator scores by sequence ID. Set `run_afpk_finder` to `true`
to run the configured official AFPK-finder v1.0 scripts. The adapter verifies
release files and captures the dependencies, seed, and each t-SNE setting. Set
`ARIADNE_AFPK_FINDER_REPO` to the source directory and, for isolated dependencies,
`ARIADNE_AFPK_FINDER_BIN` to their executable directory. The app can also read the
corresponding `repo`, `bin`, and `python` paths from `afpk-finder.json` in its home
directory. The session displays fresh clustering alongside the calculated
and published evidence. Approving a shortlist records
acceptance for computational handoff with `conditional_nomination`. Taxonomic
QC, domain architecture, and phylogenetic support are downstream evidence for
the researcher to assess. The case is based on [Lin et al.](https://www.nature.com/articles/s41467-023-44497-0)
and the [AFPK-finder public release](https://github.com/linzhenjian/AFPK_finder/tree/v1.0).

See the [molluscan case](../examples/cases/AFPK_MOLLUSC.md) for download verification,
example commands, and published versus recomputed scores.

## CLI

```bash
ariadnebuddy research create  --input create.json          # freeze the mandate
ariadnebuddy research status  --id research_<hash>          # read state
ariadnebuddy research list                                  # recent tasks
ariadnebuddy research advance --id research_<hash>          # reconcile + advance one step
ariadnebuddy research advance --id research_<hash> --expected-version 3
ariadnebuddy research respond --input respond.json
ariadnebuddy research cancel  --input cancel.json
```

`create`, `respond`, and `cancel` read a JSON object validated against the
matching `ariadne_research_*` schema; `status` and `advance` take `--id ID`
(and `advance` optionally `--expected-version N`) instead. Every command also
accepts `--home DIR`. A relative `--input` path resolves from
`ARIADNE_WORKDIR`, must be a regular file (no symbolic links), and may be at
most 64 KiB. Creating a task starts no backend work. See
[Examples](./EXAMPLES.md) for the frozen artifact shapes and [Quick start](./QUICKSTART.md) for the worked commands.

Artifacts live under `<jobs-root>/research/<id>/artifacts/` (request
revisions, frozen stage artifacts, per-stage outputs, engine side files). Job
records and logs live under `ARIADNE_JOBS_DIR` (default
`<workdir>/ariadne-jobs`).

## Related

- [Scientific workflow discipline](./SCIENTIFIC_WORKFLOWS.md) · [Examples](./EXAMPLES.md)
- [Glossary](./GLOSSARY.md) · [Quick start](./QUICKSTART.md)
- [Molluscan KS case](../examples/cases/AFPK_MOLLUSC.md)
