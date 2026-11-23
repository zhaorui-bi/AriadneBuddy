# Troubleshooting

English | [简体中文](./zh-CN/TROUBLESHOOTING.md)

Start with `./bin/ariadnebuddy doctor --probe --probe-model` — it checks
Node, storage, model configuration, provider transport, engine backend
health, MCP wiring, web assets, skills, and private permissions in one pass.
Add `--json` for the machine-readable report with `passed` / `failed` /
`warned` counts and a per-check fix string. `config show` prints the effective
configuration without running the full doctor.

## Install & setup

| Symptom | Cause | Fix |
| --- | --- | --- |
| `pnpm install` fails on the Node version | `engine-strict` in `.npmrc` pins the floor | use Node ≥ 24.15 (`.nvmrc` is 24.15.0) |
| `Web UI assets missing` from doctor | `web-ui/` was never generated | `npm run sync:web`, or the full `npm run setup` |
| onboarding exits 1 with "No default model is configured" | setup finished without a provider | run the printed `ariadnebuddy onboard --provider <id> --api-key-env <VAR>` |
| `--api-key` rejected together with `--api-key-env` | the two forms are mutually exclusive | pick one; `--api-key-env` keeps the key out of `config.toml` |
| `--ariadne-command` rejected together with `--ariadne-repo` | the two backend forms are mutually exclusive | pick one |

## Engine backend

| Symptom | Cause | Fix |
| --- | --- | --- |
| `ariadne_backend: not found` | no checkout detected | set `ARIADNE_REPO`, or `ariadnebuddy onboard --ariadne-repo /path/to/Ariadne`. The checkout needs `ariadne/__init__.py`, `input/query.hmm`, `input/references/*.afa`, and `pyhmmer, pyrodigal, scikit-learn, openpyxl` |
| wrong interpreter is used | resolution order misunderstood | `ARIADNE_PYTHON` wins first, then a checkout-local `.venv` or `venv`, then `python3`/`python` on `PATH` (`py -3` on Windows). Override the whole command with `ARIADNE_COMMAND` |
| `ready_for_pipeline: false` | a dependency or reference input is missing | read the adapter's `health --json`, fix the environment, then `retry` the environment-readiness attention item — indexes and HMM libraries are never rebuilt silently |
| `provider_transport` fails | auth, base URL, or transport | `doctor --probe-model` names the failing check and its fix; for a custom provider verify `--base-url` and `--provider-type` |
| ESM2 errors on first use | the checkpoint downloads from Hugging Face (~GBs) | set `HF_HOME` to control the cache, or waive semantic scoring with `proceed_without_esm` |

## Research tasks

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Research version conflict` | another surface advanced the task first | re-read with `ariadnebuddy research status --id ID` and respond against the current `version` |
| `stage_input` never opens | attention items open on `advance` | after `submit_stage` / `approve`, call `research advance` once more |
| `execution_failure` | the engine job failed | inspect the bounded log with `ariadne_job_log(jobId=…, view='errors')`, fix the cause, then `retry` within the frozen budget |
| `configuration_drift` | the backend command or its scientific identity changed mid-task | preserve the run and create a new task for the changed configuration |
| `budget_exhausted` | the job budget (default 6) is spent | create a separately authorized task |
| `The iteration limit (4) is exhausted` | four rounds used | conclude the task or create a new one |

## Research Desk

| Symptom | Cause | Fix |
| --- | --- | --- |
| the desk shows stale data | it only reloads on demand | press `r`, or switch tabs; the desk also reloads when the page becomes visible again |
| the sequence search does not focus with `/` | focus is in an input, or a dialog is open | click the page first; the shortcut is ignored in both cases |
| a gate renders as a plain card, not a highlighted panel | only the AFPK shortlist review uses the terracotta panel | other gates render as review cards by design |
| the audit table's evidence columns run together | the boundary rule needs the comparison layout | it appears on the comparison table; open the AFPK evidence comparison |

## Web & desktop

| Symptom | Cause | Fix |
| --- | --- | --- |
| bearer-token URL lost | the server prints a fresh one per start | restart `ariadnebuddy web` and use the new `#token=…` URL; never bind a non-loopback host casually |
| the desktop app shows a dead window on startup | the engine failed to start | the dialog offers Retry / Choose another workspace / Open logs / Quit |
| no engine log visible | the log lives outside the app bundle | File → 打开日志目录 reveals `app.getPath('logs')/engine.log` |
| the window opens at the wrong size | bounds are restored per display | resize once; bounds, maximized state, and zoom persist |

## Packaging

| Symptom | Cause | Fix |
| --- | --- | --- |
| `npm run dist` fails on a missing resource | an `extraResources` source is absent | run `npm run build:engine` and `npm run sync:web` first |
| the packaged About window cannot open a license | the resource was not included | the packaged `licenses/` directory carries them; re-run `npm run licenses` if stale |

## Development

```bash
npm run typecheck && npm test && npm run test:adapter
node engine/apps/ariadne-buddy/scripts/smoke-mcp.mjs
node engine/apps/ariadne-buddy/scripts/smoke-research.mjs
node engine/apps/ariadne-buddy/scripts/smoke-web.mjs
npm run check:repo      # repository, theme, desk, and brand-leftover contracts
```
