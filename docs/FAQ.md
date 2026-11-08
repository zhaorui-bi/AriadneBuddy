# Frequently asked questions

English | [简体中文](./zh-CN/FAQ.md)

**Do I need to install the Ariadne engines separately?**
Yes. AriadneBuddy bridges an external
[ariadne-tps](https://github.com/zhaorui-bi/Ariadne) checkout (its `.venv` is
auto-detected). Point `ARIADNE_REPO` at it or accept the detected repository
during `ariadnebuddy onboard`.

**What happens without torch/transformers?**
ESM2 semantic scoring is unavailable. The loop still runs: the controller
opens an `esm_unavailable` gate, you respond `proceed_without_esm`, and
nomination proceeds on HMM + feature-space evidence with a
`conditional_nomination` outcome and an explicit limitation note. Install
`ariadne-tps[esm]` to enable semantic scoring.

**Does the model ever fabricate scores?**
It must not. Every scientific number is read from engine artifacts; the skill,
the reply-style guide, and the deterministic audit enforce this. Engine
outputs are the only source of truth for evidence rows.

**Is a nominated candidate a demonstrated enzyme?**
No. A nomination is a screened hypothesis with deterministic evidence
(thresholds, nearest references, probabilities). Heterologous expression and
product confirmation (GC-MS etc.) remain necessary — that is exactly what the
experiment/validation stages record.

**Why did my task stop at `nomination_review` / `scientific_review`?**
A passing audit opens `nomination_review` (approve to design experiments); a
warn/failing audit opens `scientific_review` (amend the request or fix the
environment). Both are deliberate human decision points.

**Where do credentials live?**
`~/.ariadne` with 0600/0700 permissions. API keys come from environment
variables or the credential store; they are never written into manifests or
research artifacts.

**Can I run studies in batches?**
Yes — see the `ariadne-campaign` skill for frozen question matrices, fair
one-factor comparisons, and per-run fingerprints.

**How is this different from running the `ariadne` Python CLI directly?**
The engines are identical. AriadneBuddy adds the agent layer (expert roles,
knowledge stages, gates), durable jobs with provenance manifests, the
deterministic nomination audit, and the interactive Greek/Roman workbench.
