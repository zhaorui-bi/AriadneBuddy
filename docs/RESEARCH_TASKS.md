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
  never be waived into `ready`. `validated` denotes a reviewed validation
  record at handoff. Individual experimental outcomes remain in `records[]`
  and can be supported, refuted, or inconclusive.

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
ariadnebuddy research respond --input respond.json
ariadnebuddy research cancel --input cancel.json
```

Artifacts live under `<jobs-root>/research/<id>/artifacts/` (request
revisions, frozen stage artifacts, per-stage outputs, engine side files).
