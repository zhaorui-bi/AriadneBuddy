# Examples

English | [简体中文](./zh-CN/QUICKSTART.md)

Worked shapes for the artifacts a research task freezes. Two kinds of block appear here,
and each block says which it is:

- **Verbatim** — copied from a file in this repository, byte for byte.
- **Shape** — the field structure a stage or an audit produces. The field names and the
  required/optional distinction are read from the validator and the adapter; the values
  are illustrative and are not measured engine output.

| Block | Source of the shape |
| --- | --- |
| Frozen nomination request | `examples/cases/ceess-coral-transcriptome.json` (verbatim) |
| Literature artifact | `validateStageArtifact('literature')` in `engine/apps/ariadne-buddy/src/ariadne/research.ts` |
| Hypothesis artifact | `validateStageArtifact('hypothesis')` in the same file |
| Nomination evidence row | `_merged_candidate_rows` in `engine/apps/ariadne-buddy/backend/ariadne_cli.py` |
| Audit issue row | `command_audit_nomination` in the same file |
| Published KS scores | `examples/cases/afpk-mollusc-published-ks.json` (verbatim) |
| `research create` input | the `research --help` examples in `engine/apps/ariadne-buddy/src/cli.ts` (verbatim) |
| `research respond` input, stage deposit | the `research --help` examples in the same file (verbatim) |
| `research respond` input, gate decision | the `ariadne_research_respond` schema in `engine/apps/ariadne-buddy/src/ariadne/research-tools.ts` |
| `research cancel` input | the `research --help` examples in `engine/apps/ariadne-buddy/src/cli.ts` (verbatim) |
| `research list` entry | the `ariadne_research_list` mapping in `engine/apps/ariadne-buddy/src/ariadne/research-tools.ts` |
| `run --json` envelope | `TurnEnvelope` in `engine/apps/ariadne-buddy/src/harness.ts` |

The runnable cases live in [`examples/cases/`](../examples/cases/): a standard CeeSs
screen, a relaxed exploratory screen, a pathway-first TPS inventory, and the molluscan KS
case.

## Frozen nomination request

Verbatim from `examples/cases/ceess-coral-transcriptome.json`. This is the file a
`research create` call points at with `requestFile`; once the task accepts it, the request
is frozen and every later engine request is filed under a new request revision.

```json
{
  "target_class": "cembrene-class TPS (CeeSs)",
  "input_proteins": ["input/all_tps.fasta"],
  "query_hmm": "input/query.hmm",
  "reference_dir": "input/references",
  "tps_workbook": "TPS.xlsx",
  "thresholds": {
    "min_score": 0,
    "max_evalue": 0.001,
    "min_length": 300,
    "ceess_threshold": 0.9,
    "top_k": 5
  },
  "context": "Coral transcriptome-derived TPS homologs; nominate cembrene A/B synthase candidates for yeast heterologous expression."
}
```

`input_proteins` must be a non-empty array of FASTA paths, `query_hmm` an HMMER3 profile
path, and `reference_dir` a directory of aligned reference FASTAs. `tps_workbook` is
required only when ESM scoring runs. Field names are snake_case; camelCase keys are
rejected.

## Literature artifact

Shape. `sources` must be a non-empty array of objects, `findings` a non-empty array of
strings, and `gaps` an array of strings. A source may carry `title`, `doi`, and `note`.

```json
{
  "sources": [
    {
      "title": "Identification of Cembrene Synthases Uncovers Polyphyletic Origins of 14-Membered Carbocyclic Cembranoids Biosynthesis in Corals",
      "doi": "10.1021/acs.jnatprod.6c00686",
      "note": "the reference study for the coral CeeSs class"
    }
  ],
  "findings": [
    "Coral cembrene-class synthases are polyphyletic, so a single reference profile cannot stand for the whole class."
  ],
  "gaps": [
    "Whether transcriptome-derived TPS homologs outside the surveyed corals share the same class signature."
  ]
}
```

## Hypothesis artifact

Shape. `hypotheses` must be a non-empty array of objects; each entry must carry a
non-empty `statement` and a non-empty `prediction`. `id` and `rationale` are optional.
Depositing this artifact opens the human gate.

```json
{
  "hypotheses": [
    {
      "id": "H1",
      "statement": "Coral transcriptome TPS homologs above the HMM threshold include cembrene-class synthases.",
      "rationale": "The reference class is polyphyletic but shares a detectable profile signal.",
      "prediction": "At least one retrieved candidate clears the CeeSs probability threshold."
    }
  ]
}
```

## Nomination evidence row

Shape. Every shortlist row carries the merged engine evidence the audit re-checks. Values
below are illustrative.

```json
{
  "sequence_id": "coral_TPS_0042",
  "hmm_score": 566.2,
  "hmm_evalue": 3e-173,
  "length": 431,
  "predicted_source": "coral",
  "confidence": 1.0,
  "is_coral_like": "yes",
  "nearest_reference": "PhoTC-1",
  "nearest_distance": 0.0,
  "esm_type_prediction": "cembrene-class",
  "esm_ceess_probability": 0.97,
  "is_nominated": true
}
```

The row is nominated when ESM runs and `esm_ceess_probability` is at or above
`ceess_threshold`, or, when ESM is waived, when `is_coral_like` is `yes`.

## Audit issue row

Shape. The deterministic audit walks every candidate row and appends one issue object per
failed check. A critical issue blocks experimental design; a warning always reaches the
human. The `NOM-006` row below is the warning raised when ESM scoring was not used and was
not explicitly waived.

```json
{
  "severity": "warning",
  "code": "NOM-006",
  "candidate_id": "coral_TPS_0042",
  "message": "no semantic evidence (ESM scoring not used and not explicitly waived)"
}
```

The same audit emits the claim ledger, one entry per candidate, carrying the support for
each claim it records:

```json
{
  "candidate_id": "coral_TPS_0042",
  "claims": [
    { "claim": "hmm_hit", "support": { "score": 566.2, "evalue": 3e-173 } },
    {
      "claim": "feature_space_context",
      "support": { "predicted_source": "coral", "nearest_reference": "PhoTC-1", "confidence": 1.0 }
    },
    { "claim": "semantic_score_waived", "support": { "esm_ceess_probability": null } }
  ]
}
```

When the caller waives ESM with `proceed_without_esm`, the audit does not re-flag the
absent semantic evidence, and the task's scientific outcome is recorded as
`conditional_nomination`.

## Published KS scores

Verbatim from `examples/cases/afpk-mollusc-published-ks.json`. This is the comparator
file the molluscan KS screen reads with `published_ks_scores_file`; the desk shows these
published scores beside the scores the run recomputes.

```json
{
  "doi": "10.1038/s41467-023-44497-0",
  "figure": "Fig. 2A",
  "scores": {
    "EcPKS1_E._chlorotica__extraction": { "fas_i": 587.7, "fas_ii": 123.1, "pks": 274.6 },
    "EcPKS2_E._chlorotica__extraction": { "fas_i": 581.7, "fas_ii": 133.5, "pks": 285.2 },
    "XP_041363356.1:1-468": { "fas_i": 775.6, "fas_ii": 151.1, "pks": 338.4 },
    "XP_041375027.1:1-432": { "fas_i": 447.5, "fas_ii": 127.8, "pks": 267.0 }
  }
}
```

A putative AFPK nomination requires a unique FAS I lead inside the requested bit-score
band. Approving the shortlist records acceptance for computational handoff with
`conditional_nomination`; taxonomic QC, domain architecture, and phylogenetic support
remain downstream evidence for the researcher to assess.

## Model-free CLI path

The `research` subcommand controls a durable task without a conversational model. Every
action reads or writes JSON validated against the matching MCP tool schema, so the CLI
and the agent tools cannot drift apart. Run from the directory that owns the task — the
default `ARIADNE_WORKDIR` — or pass `--home DIR` to point at another Ariadne home.

```bash
./bin/ariadnebuddy research create  --input request.json
./bin/ariadnebuddy research status  --id research_0123456789abcdef01234567
./bin/ariadnebuddy research list
./bin/ariadnebuddy research advance --id research_0123456789abcdef01234567
./bin/ariadnebuddy research respond --input respond.json
./bin/ariadnebuddy research cancel  --input cancel.json
```

Every command also takes `--help`; `ariadnebuddy research --help` prints the flag table
and one example per action. Exit codes are the CLI's: `0` completed, `1` arguments
rejected / a required check failed / setup incomplete, `130` interrupted with Ctrl+C.

`--input` files resolve relative to `ARIADNE_WORKDIR`, must be regular files (no
symbolic links) of at most 64 KiB, and must contain a JSON object. Creation starts no
backend work: it freezes the request and the objective into a task.

### Create

Verbatim from the `research --help` examples in
`engine/apps/ariadne-buddy/src/cli.ts`:

```json
{"requestId":"case-1","objective":"Nominate cembrene-class TPS","requestFile":"nomination-request.json","maxJobs":4}
```

`requestFile` is the snake_case nomination request frozen by the task — the block at the
top of this page. `maxJobs` is the total backend-job budget including retries (default
6, maximum 16); `topK` is the nearest-reference top-k for structure retrieval (default
5). A task id looks like `research_` plus 24 lowercase hex characters.

### Advance

`advance` reconciles the current durable assignment and moves the task one stage when its
gate allows. Knowledge stages open a stage-input attention; compute stages launch
deterministic jobs; a job already running is reused rather than relaunched.

```bash
./bin/ariadnebuddy research advance --id research_0123456789abcdef01234567
./bin/ariadnebuddy research advance --id research_0123456789abcdef01234567 --expected-version 3
```

`--expected-version` is optional and refuses the advance when the task has moved on.
Repeating `advance` until the task rests at `waiting` or `ready` is the normal loop.

### Respond, stage deposit

Verbatim from the `research --help` examples in
`engine/apps/ariadne-buddy/src/cli.ts`:

```json
{"taskId":"research_0123456789abcdef01234567","attentionId":"attention-1","expectedVersion":3,"action":"submit_stage","artifactFile":"stage.json","reason":"Literature deposited"}
```

`attentionId` names the open attention item the response answers — read it from the task
status. `artifactFile` is a stage-artifact JSON under the snake_case contract for that
stage, so the literature and hypothesis blocks above are what `submit_stage` points at.

### Respond, gate decision

Shape, from the `ariadne_research_respond` schema in
`engine/apps/ariadne-buddy/src/ariadne/research-tools.ts`. The `action` values are
`amend_request`, `submit_stage`, `approve`, `revise`, `iterate`, `conclude`, `retry`,
and `proceed_without_esm`; which ones are legal depends on the open attention item.

```json
{"taskId":"research_0123456789abcdef01234567","attentionId":"attention-1","expectedVersion":3,"action":"approve","reason":"Hypotheses are testable and the literature supports them"}
```

A `revise` answers a gate with a written reason and no artifact; an `amend_request`
carries `requestFile`; a `proceed_without_esm` answers only the ESM availability gate.
`expectedVersion` is required: a response recorded against a stale version is refused
with `409`, and the desk reloads instead of overwriting. Every decision is recorded as
caller-declared — attributed to the caller, not verified human approval.

### List

Shape, from the `ariadne_research_list` mapping in
`engine/apps/ariadne-buddy/src/ariadne/research-tools.ts`. The command prints the tool's
JSON result; `returned` is the number of entries in this bounded response, not a total
task count.

```json
{
  "tasks": [
    {
      "id": "research_0123456789abcdef01234567",
      "workflow": "nomination",
      "version": 3,
      "status": "waiting",
      "stage": "literature",
      "iteration": 1,
      "updatedAt": "2026-11-08T00:00:00.000Z",
      "objective": "Nominate cembrene-class TPS",
      "objectiveTruncated": false,
      "nextAction": "Deposit the literature artifact.",
      "nextActionTruncated": false,
      "jobsUsed": 0,
      "maxJobs": 4,
      "openAttention": [{ "id": "attention-1", "kind": "stage_input", "stage": "literature" }],
      "scientificOutcome": { "status": "pending" }
    }
  ],
  "returned": 1
}
```

Use `research status --id` for the full task, its event history, assignments, and stage
artifacts.

### Cancel

Verbatim from the `research --help` examples in
`engine/apps/ariadne-buddy/src/cli.ts`:

```json
{"taskId":"research_0123456789abcdef01234567","expectedVersion":4,"reason":"Scope changed"}
```

Cancellation stops any active job and retains the inputs, assignments, artifacts, and
decisions, including the recorded scientific outcome at handoff. A cancelled task cannot
resume through `advance`; it is available under archived tasks.

### run --quiet and run --json

`run` is the one-shot agent path. Both flags are script-friendly: `--quiet` puts only
assistant text on stdout and progress on stderr, and `--json` prints one structured JSON
envelope on stdout and implies `--quiet`.

```bash
./bin/ariadnebuddy run --quiet "summarize the coral cembrene literature"
./bin/ariadnebuddy run --json "nominate cembrene-class TPS candidates"
```

Shape, from `TurnEnvelope` in `engine/apps/ariadne-buddy/src/harness.ts`:

```json
{
  "status": "completed",
  "text": "…assistant text…",
  "turns": [{ "turnId": 1, "reason": "…" }]
}
```

`status` is `completed` or `failed`; on failure the envelope carries an `error` string
and the command exits non-zero. `turns` records one entry per completed turn, with the
end reason the engine reported for it.

## Related

- [Scientific workflow discipline](./SCIENTIFIC_WORKFLOWS.md) · [Glossary](./GLOSSARY.md)
- [Research tasks](./RESEARCH_TASKS.md) · [Quick start](./QUICKSTART.md)
- [Molluscan KS case](../examples/cases/AFPK_MOLLUSC.md)
