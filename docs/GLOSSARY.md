# Glossary

English | [简体中文](./zh-CN/GLOSSARY.md)

Terms are grouped by where they come from. Where a term is a literal identifier, the
identifier is given exactly as the code spells it.

## Mythology to product

| Term | Meaning in AriadneBuddy |
| --- | --- |
| Ariadne's thread | the auditable loop. Every stage output is frozen, fingerprinted, and re-verified before the controller consumes it, so the path from question to nomination can be walked back |
| the labyrinth | the gated stage graph. Eleven stages, three of them human gates, one permitted path at a time |
| the loop | readiness → literature → hypothesis → pathway → discovery → filtering → nomination → audit → experiment → validation → iteration → handoff |
| stele | an upright slab carrying an inscription; in the interface, a surface that states a human decision or a frozen artifact |
| meander | the Greek key band used as a continuous divider, never a single dash |

## Target classes and enzymes

| Term | Meaning |
| --- | --- |
| CeeSs | cembrene-class terpene synthases, the target class of the coral study the product wraps |
| TPS | terpene synthase, the broader enzyme class searched when the target class is `terpene synthase (TPS, broad)` |
| HMM | profile hidden Markov model; retrieval runs through pyhmmer |
| ESM2 | the protein language model used for semantic CeeSs scoring |
| KS | ketosynthase domain; the molluscan workflow screens pre-extracted KS domains |
| AFPK | the KS phenotype the `afpk-ks` workflow screens for, called from three HMM profiles rather than a single one |
| FAS I | fatty-acid synthase type I profile; one of the three compared in the KS screen |
| FAS II | mitochondrial fatty-acid synthase type II profile; one of the three compared |
| PKS | polyketide synthase profile; one of the three compared |
| AFPK-finder | the original external v1.0 tool the adapter can run for t-SNE/HDBSCAN cluster evidence |

## Research task vocabulary

| Term | Meaning |
| --- | --- |
| round | one pass of the loop from hypothesis to validation. The controller opens a new round only when you choose to iterate |
| version | the task version. Every decision advances it; if another surface records a decision first, the server answers 409 and the desk reloads instead of overwriting |
| request revision | one engine request. Artifacts and jobs are filed under the revision that produced them |
| gate | a point where the loop stops until a human decision is recorded |
| caller-declared | the contract of a decision recorded through an interface: it is attributed to the caller, not verified as human approval |
| conditional nomination | the scientific outcome when ESM scoring is waived and coral-like feature-space evidence carries the nomination |
| proceed_without_esm | the explicit ESM-availability waiver. The audit does not re-flag a waived mode |
| waitingReason | the machine-readable reason a task is blocked, shown in the desk as the task status |
| run-manifest.json | the per-job provenance record: sha256 of the request, inputs, non-secret scientific configuration, and configured outputs |
| scientific outcome | the recorded status, audit status, and limitations of a task |

### waitingReason values

The desk resolves a waiting reason from the task's open attention item, falling back to the
task's own `waitingReason`. Each value has a defined English and Chinese label.

| Value | English label | Chinese label |
| --- | --- | --- |
| `nomination_review` | Shortlist review pending | 待候选审核 |
| `afpk_nomination_review` | Shortlist review pending | 待候选审核 |
| `stage_review` | Hypothesis review pending | 待假说审核 |
| `stage_input` | Stage input pending | 待阶段材料 |
| `iteration_decision` | Iteration decision pending | 待迭代决策 |
| `scientific_review` | Scientific review pending | 待科学复核 |
| `afpk_empty_shortlist` | No AFPK nominations | 暂无 AFPK 提名 |
| `afpk_revision` | Request revision pending | 待修订筛选请求 |
| `environment_readiness` | Runtime setup pending | 待配置运行环境 |
| `configuration_drift` | Configuration changed | 待处理配置变更 |

### Task and job status values

| Value | Meaning |
| --- | --- |
| `open` | the task is open and no engine job is running |
| `running` | an engine job is assigned |
| `waiting` | the task is blocked; read the waiting reason |
| `ready` | handoff is ready |
| `cancelled` | the task is closed and available under archived tasks |
| `not_started` | an assignment has not launched |
| `queued` | an assignment is waiting to launch |
| `launching` | an assignment is starting |
| `succeeded` | the job finished |
| `failed` | the job failed |

## Audit codes

The deterministic nomination audit re-checks every candidate row and emits
`NOM-001` through `NOM-008`. A critical issue blocks experimental design; a warning always
reaches the human.

| Code | Severity | Condition |
| --- | --- | --- |
| `NOM-000` | critical | a candidate row is not an object |
| `NOM-001` | critical | HMM score missing or below `min_score` |
| `NOM-002` | critical | HMM E-value missing or above `max_evalue` |
| `NOM-003` | warning | protein length below `min_length` |
| `NOM-004` | critical | ESM CeeSs probability missing while ESM ran |
| `NOM-005` | critical | ESM CeeSs probability below `ceess_threshold` |
| `NOM-006` | warning | no semantic evidence — ESM scoring was not used and was not explicitly waived |
| `NOM-007` | warning | nearest reference missing |
| `NOM-008` | critical | the nomination report has no candidates |

## Command-line vocabulary

| Term | Meaning |
| --- | --- |
| `--quiet` | `run` output mode: assistant text alone on stdout, progress on stderr |
| `--json` | `run` output mode: one structured JSON envelope on stdout |
| `--probe` | `doctor` runs `health --json` against the configured Ariadne backend |
| `--probe-model` | `doctor` makes a minimal round-trip against the model provider; reports as skipped when absent |
| `--no-telemetry` | global flag setting `KIMI_DISABLE_TELEMETRY=1` for `run`, `chat`, and `web` |
| `config show` | prints the effective provider, model, backend, skill directories, and MCP registration |
| `reset` | prints a deletion plan; removes nothing until `--yes` is passed |
| `--keep-jobs` | `reset` preserves the research job storage directory |
| `caller-declared` | a decision recorded with a written reason and no independent human approval asserted |
| `conditional_nomination` | nomination carried by HMM and feature-space evidence alone, after an explicit `proceed_without_esm` waiver |
| `proceed_without_esm` | the response that waives ESM2 semantic scoring and opens the loop to run without torch/transformers |

## Related

- [Scientific workflow discipline](./SCIENTIFIC_WORKFLOWS.md) · [Examples](./EXAMPLES.md)
- [Research tasks](./RESEARCH_TASKS.md) · [Keyboard](./KEYBOARD.md) · [FAQ](./FAQ.md)
