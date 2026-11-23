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

## Related

- [Scientific workflow discipline](./SCIENTIFIC_WORKFLOWS.md) · [Glossary](./GLOSSARY.md)
- [Research tasks](./RESEARCH_TASKS.md) · [Quick start](./QUICKSTART.md)
- [Molluscan KS case](../examples/cases/AFPK_MOLLUSC.md)
