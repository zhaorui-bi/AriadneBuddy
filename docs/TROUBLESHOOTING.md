# Troubleshooting

English | [简体中文](./zh-CN/TROUBLESHOOTING.md)

Start with `./bin/ariadnebuddy doctor --probe` — it checks Node, storage,
model configuration, engine backend health, MCP wiring, web assets, and
skills in one pass.

## Engine backend

**`ariadne_backend: not found`**
Set `ARIADNE_REPO` to your ariadne-tps checkout, or run
`ariadnebuddy onboard --ariadne-repo /path/to/Ariadne`. The checkout needs
`ariadne/__init__.py`, `input/query.hmm`, `input/references/*.afa`, and a
Python environment with `pyhmmer, pyrodigal, scikit-learn, openpyxl`
(a checkout-local `.venv` is preferred). Override the interpreter with
`ARIADNE_PYTHON` or the whole command with `ARIADNE_COMMAND`.

**`ready_for_pipeline: false`**
The adapter's `health --json` explains which dependency or reference input is
missing. Fix the environment, then `retry` the environment-readiness
attention item — indexes/HMM libraries are never rebuilt silently.

**ESM2 errors on first use**
The ESM2 checkpoint downloads from Hugging Face on first scoring (~GBs).
Set `HF_HOME` to control the cache, or waive semantic scoring.

## Research tasks

**`Research version conflict`**
Another call advanced the task. Re-read with `research status` and respond
against the current `version`.

**`stage_input` never opens**
Attention items open on `advance`. After `submit_stage`/`approve`, call
`research advance` once more.

**`execution_failure`**
Inspect the bounded log: `ariadne_job_log(jobId=…, view='errors')`. Fix the
cause, then `retry` within the frozen budget.

**`configuration_drift`**
The backend command or its scientific identity changed mid-task. Preserve the
run and create a new task for the changed configuration.

**`budget_exhausted`**
The job budget (default 6) is spent. Create a separately authorized task.

## Web / desktop

**Web UI assets missing** — run `npm run sync:web` (or the full build).
**Bearer-token URL lost** — restart `ariadnebuddy web`; it prints a fresh
`#token=…` URL. Never bind a non-loopback host casually.
**Desktop engine errors** — see the in-app error screen; it embeds the last
engine log lines.

## Development

```bash
npm run typecheck && npm test && npm run test:adapter
node engine/apps/ariadne-buddy/scripts/smoke-mcp.mjs
node engine/apps/ariadne-buddy/scripts/smoke-research.mjs
node engine/apps/ariadne-buddy/scripts/smoke-web.mjs
```
