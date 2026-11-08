# Quick start

English | [简体中文](./zh-CN/QUICKSTART.md)

## 1. Prerequisites

- Node.js ≥ 24.15 (Node 26 recommended), npm, and pnpm 12.
- Python 3.10+ with an [ariadne-tps](https://github.com/zhaorui-bi/Ariadne)
  checkout and its environment (`pyhmmer`, `pyrodigal`, `scikit-learn`,
  `openpyxl`, `numpy`). A checkout-local `.venv` is detected automatically.
- Optional for ESM2 semantic scoring: `pip install ariadne-tps[esm]`
  (`torch`, `transformers`). Without it, the loop runs with an explicit
  `proceed_without_esm` waiver.
- A conversational model provider: an API key works — no login required
  (Kimi Coding Plan / Z.AI / DeepSeek / any OpenAI-compatible endpoint).

## 2. Build

```bash
cd AriadneBuddy
npm run setup        # pnpm install + build the engine app + branded web UI
```

## 3. Onboard

```bash
./bin/ariadnebuddy onboard \
  --ariadne-repo /path/to/Ariadne \
  --provider zai --api-key-env ZAI_API_KEY --model glm-4.6
```

Onboard configures `~/.ariadne` (config, credentials, `mcp.json`, skills),
records the engine backend, and probes it.

## 4. Verify

```bash
./bin/ariadnebuddy doctor --probe
./bin/ariadnebuddy tools            # the 21 ariadne_* tools
```

## 5. Use

```bash
./bin/ariadnebuddy web              # branded workbench → http://127.0.0.1:58627
./bin/ariadnebuddy                  # full TUI workbench
./bin/ariadnebuddy chat             # lightweight REPL
npm start                           # Electron desktop app
```

In the Web UI, ask for a complete discovery study, e.g. *“用 Ariadne 引擎对
input/all_tps.fasta 做 cembranoid CeeSs 提名，走完整闭环”*. The agent loads the
`ariadne` skill, freezes a nomination request, and walks the gated loop — you
approve hypotheses, the nominated shortlist, and the iterate/conclude decision.

## 6. Model-free task control

```bash
./bin/ariadnebuddy research create  --input request.json
./bin/ariadnebuddy research advance --id research_xxxx
./bin/ariadnebuddy research respond --input respond.json --id research_xxxx
```

`request.json`:

```json
{ "requestId": "quickstart-1", "objective": "Nominate CeeSs candidates",
  "requestFile": "examples/cases/ceess-coral-transcriptome.json", "maxJobs": 8 }
```

## 7. Real-engine demo

```bash
node engine/apps/ariadne-buddy/scripts/run-real-engine-demo.mjs /path/to/Ariadne
```

Drives the entire closed loop against the real pyhmmer/sklearn engines and
prints the nominated candidates with their evidence.
