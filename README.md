<p align="center">
  <img src="./build/logo-256.png" width="132" alt="AriadneBuddy — the official Ariadne mark">
</p>

<h1 align="center">AriadneBuddy</h1>

<p align="center"><strong>Beta · v0.1.0-beta.1</strong></p>

<p align="center"><em>Follow the thread: from literature to validated natural-product candidates.</em></p>

<p align="center">
  中文介绍 · <a href="./README.zh-CN.md">English</a> ·
  <a href="./docs/QUICKSTART.md">Quick start</a> ·
  <a href="./docs/ARCHITECTURE.md">Architecture</a>
</p>

---

## Why this exists

Finding new biosynthetic enzymes is slow: a domain expert reads the literature,
forms hypotheses about a biosynthetic pathway, mines genomes for candidate
enzymes, nominates a shortlist, designs expression experiments, interprets the
results — and iterates. Each step produces evidence that the next step depends
on, and none of it is usually reproducible.

**AriadneBuddy** turns that expert workflow into agent-executable form. It is
built around the published
[Ariadne](https://github.com/zhaorui-bi/Ariadne) engine for coral terpene
synthase (TPS) discovery — cembranoid biosynthesis and cembrene-class (CeeSs)
candidate nomination (Wang et al., *J. Nat. Prod.* 2026,
[10.1021/acs.jnatprod.6c00686](https://doi.org/10.1021/acs.jnatprod.6c00686)) —
and generalizes it into a durable, gated research loop that any agent can walk
and any human can audit.

Three ideas make it work:

1. **Expert roles as agents.** Six expert personas — Literature Surveyor
   (文献调研), Hypothesis Architect (假说生成), Pathway Reconstructor (途径重构),
   Nomination Steward (候选提名), Experimental Designer (实验设计), Validation
   Interpreter (验证解读) — author the *knowledge* stages. Every reply names
   the role that produced it.
2. **Deterministic engines as tools.** The science never comes from the
   conversational model. HMM retrieval (pyhmmer), ESM2 semantic scoring, and
   feature-space structure retrieval (nearest-reference classification) run as
   bounded subprocesses whose artifacts — scores, E-values, probabilities,
   nearest references — are the only source of evidence.
3. **Human gates, not human-in-name-only.** Hypothesis approval, nomination
   approval, and the iterate/conclude decision are explicit attention items.
   A caller-declared response is never treated as verified human approval, and
   an audit failure can never be waived into success.

The result closes the loop — **computational nomination → experimental design →
validation interpretation → iterative optimization** — through a CLI, a full
terminal TUI, a local Web workbench, and an Electron desktop app, styled in the
Ariadne visual language: parchment, aegean blue, verdigris, gold, terracotta,
and a single Greek-key meander fret.

## The closed scientific loop

```
readiness → literature → hypothesis ──approve──→ pathway
                ↑                                   │
                │            discovery (HMM retrieval)
            iterate           filtering (QC + dedupe)
                │            nomination (ESM2 scoring + structure retrieval)
        validation ←─ experiment ←──approve── audit (claim-evidence ledger)
                └────────── conclude → handoff (verified)
```

| Stage | Owner | What happens | Frozen artifact |
| --- | --- | --- | --- |
| readiness | system | backend health, engine identity, reference data | frozen mandate + backend fingerprint |
| literature | agent | citable sources, findings, gaps | `sources / findings / gaps` JSON |
| hypothesis | agent | testable statements tied to the target class | `hypotheses[{statement, prediction}]` |
| **gate** | **human** | approve before any compute is spent | — |
| pathway | agent | substrate → product steps + enzyme slots | `product / steps / enzyme_slots` |
| discovery | engine | pyhmmer best-hit search, threshold filters | candidates FASTA + hits table |
| filtering | engine | coverage / length / near-duplicate QC | filtered FASTA + filter report |
| nomination | engine | ESM2 CeeSs scoring + nearest-reference retrieval | shortlist with full evidence rows |
| audit | engine | claim-evidence ledger, NOM-001…008 codes | pass / warn / fail per candidate |
| **gate** | **human** | approve the shortlist before experiments | — |
| experiment | agent | expression system, assay, controls, decision criteria | `designs[]` |
| validation | agent | outcome (supported / refuted / inconclusive) + interpretation | `records[]` |
| **gate** | **human** | iterate (≤ 4 rounds, back to hypothesis) or conclude | — |
| handoff | system | lineage-verified release: `scientificOutcome = validated` | task record + manifests |

Without torch/transformers the loop still runs: the controller opens an
`esm_unavailable` gate, you waive it explicitly (`proceed_without_esm`), and
nominations carry HMM + feature-space evidence with a `conditional_nomination`
outcome and a recorded limitation.

## The 21 agent tools

| Group | Tools |
| --- | --- |
| Engines | `ariadne_status` · `ariadne_catalog` · `ariadne_build_hmm` · `ariadne_discover` · `ariadne_filter` · `ariadne_score_candidates` · `ariadne_classify` · `ariadne_pipeline_run` · `ariadne_audit_nomination` |
| Durable jobs | `ariadne_job_list` · `ariadne_job_status` · `ariadne_job_manifest` · `ariadne_job_log` · `ariadne_job_artifacts` · `ariadne_job_cancel` |
| Research controller | `ariadne_research_create` · `ariadne_research_status` · `ariadne_research_list` · `ariadne_research_advance` · `ariadne_research_respond` · `ariadne_research_cancel` |

Every engine job carries a `run-manifest.json` with sha256 fingerprints of the
request, inputs, non-secret scientific configuration, and the configured
output; the controller re-verifies each stage output before consuming it.

## A nomination request

```json
{
  "target_class": "cembrene-class TPS (CeeSs)",
  "input_proteins": ["proteins.faa"],
  "query_hmm": "input/query.hmm",
  "reference_dir": "input/references",
  "tps_workbook": "TPS.xlsx",
  "thresholds": { "min_score": 0, "max_evalue": 0.001,
                  "min_length": 300, "ceess_threshold": 0.9, "top_k": 5 }
}
```

Complete, runnable cases live in [`examples/cases/`](./examples/cases/):
standard CeeSs screen, a relaxed exploratory screen, and a pathway-first TPS
inventory.

## Install

**Prerequisites**

- Node.js ≥ 24.15, npm, pnpm 12
- Python 3.10+ with an [ariadne-tps](https://github.com/zhaorui-bi/Ariadne)
  checkout and `pyhmmer, pyrodigal, scikit-learn, openpyxl` installed — a
  checkout-local `.venv` is detected automatically
- Optional: `pip install ariadne-tps[esm]` for ESM2 semantic scoring
- Any OpenAI-compatible model API key (Z.AI / Kimi Coding / DeepSeek / custom) —
  no login flows

```bash
git clone https://github.com/zhaorui-bi/AriadneBuddy && cd AriadneBuddy
npm run setup                                          # install + build + branded web UI
./bin/ariadnebuddy onboard --ariadne-repo /path/to/Ariadne \
                           --provider zai --api-key-env ZAI_API_KEY
./bin/ariadnebuddy doctor --probe                      # one-shot health check
```

## Use

```bash
./bin/ariadnebuddy web        # Greek/Roman Web workbench → http://127.0.0.1:58627
./bin/ariadnebuddy            # full terminal TUI (AriadneBuddy welcome art)
./bin/ariadnebuddy chat       # lightweight REPL
npm start                     # Electron desktop app
```

Then just ask, e.g. *“用 Ariadne 引擎对 input/all_tps.fasta 做 cembranoid CeeSs
提名，走完整闭环”* — the agent loads the `ariadne` skill, freezes the request,
and walks the loop; you approve the gates.

Model-free task control also works:

```bash
ariadnebuddy research create  --input create.json     # freeze the mandate
ariadnebuddy research advance --id research_<hash>    # reconcile + advance one step
ariadnebuddy research respond --input respond.json --id research_<hash>
ariadnebuddy research cancel  --id research_<hash> --input cancel.json
```

To see the whole loop run against the real pyhmmer/sklearn engines with the
nominated candidates and their evidence printed:

```bash
node engine/apps/ariadne-buddy/scripts/run-real-engine-demo.mjs /path/to/Ariadne
```

## Documentation

| Doc | Contents |
| --- | --- |
| [Quick start](./docs/QUICKSTART.md) | install, onboard, verify, first run |
| [Architecture](./docs/ARCHITECTURE.md) | the four layers, boundaries, security posture |
| [Scientific workflow discipline](./docs/SCIENTIFIC_WORKFLOWS.md) | evidence classes, stage contracts, claims language |
| [Research tasks](./docs/RESEARCH_TASKS.md) | the state machine, responses, guarantees |
| [FAQ](./docs/FAQ.md) · [Troubleshooting](./docs/TROUBLESHOOTING.md) · [Release](./docs/RELEASE.md) | answers, fixes, shipping |
| 中文文档 | [快速上手](./docs/zh-CN/QUICKSTART.md) · [常见问题](./docs/zh-CN/FAQ.md) · [故障排查](./docs/zh-CN/TROUBLESHOOTING.md) · [工作流](./docs/zh-CN/DOMAIN_WORKFLOW.md) |

## Verification

Everything above is gated locally by `npm run check` — lint, typecheck,
coverage-threshold tests (32), the Python adapter suite (10), packaging,
desktop startup, TUI regression (188), and the MCP / research / web smokes;
the research smoke drives the entire loop to a validated handoff.

## Citation

If AriadneBuddy contributes to your research, cite this software and the
Ariadne paper (Wang et al., *J. Nat. Prod.* 2026,
[10.1021/acs.jnatprod.6c00686](https://doi.org/10.1021/acs.jnatprod.6c00686)),
reporting the engine revision, reference snapshot, HMM libraries, and ESM model
used. See [CITATION.cff](./CITATION.cff).

## License & acknowledgements

MIT. Built on the [OpenAqua-Harness](https://github.com/zhaorui-bi/OpenAqua-Harness)
template, powered by the vendored
[Kimi Code](https://github.com/MoonshotAI/kimi-code) agent engine (own license
under `engine/`), bridging the MIT [ariadne-tps](https://github.com/zhaorui-bi/Ariadne)
engines as an external checkout. Nominated candidates still require
heterologous expression and product confirmation before any claim of function —
a screening score is not activity.
