# Frequently asked questions

English | [简体中文](./zh-CN/FAQ.md)

## Install & setup

**Do I need to install the Ariadne engines separately?**
Yes. AriadneBuddy bridges an external
[ariadne-tps](https://github.com/zhaorui-bi/Ariadne) checkout. Point
`ARIADNE_REPO` at it or pass `--ariadne-repo` during `ariadnebuddy onboard`.
The checkout needs `ariadne/__init__.py`, `input/query.hmm`,
`input/references/*.afa`, and a Python environment with `pyhmmer, pyrodigal,
scikit-learn, openpyxl`. The interpreter resolves from `ARIADNE_PYTHON` first,
then a checkout-local `.venv` or `venv`, then `python3`/`python` on `PATH`.

**What are the prerequisites?**
Node.js ≥ 24.15 (`engines.node`), npm (declared as `packageManager`:
npm@12.0.2), and pnpm 12 (a devDependency). Python 3.10+ for the engines,
`pip install ariadne-tps[esm]` for ESM2 scoring, and any OpenAI-compatible
model API key — there are no login flows.

**Which interface should I use?**
`ariadnebuddy web` for the branded browser workbench, the bare `ariadnebuddy`
(or `ariadnebuddy tui`) for the full terminal workbench, `ariadnebuddy chat`
for a lightweight REPL, `ariadnebuddy run "<prompt>"` for one-shot scripted
use, and `npm start` for the Electron desktop app.

## Onboarding & model provider

**Onboarding exits 1 with "No default model is configured".**
That is deliberate: finishing setup without a model would only fail later, at
session creation. The command prints the exact corrective form —
`ariadnebuddy onboard --provider <id> --api-key-env <VAR>` — and exits
non-zero. Run it with `--provider kimi-coding|zai|deepseek|custom`; for a
custom provider add `--base-url`, `--model`, and optionally
`--provider-type`.

**Can I reuse an existing configuration?**
`ariadnebuddy onboard --import-from DIR` copies `config.toml`, credentials,
`oauth`, and `tui.toml` from another home. The provider step still runs, so if
that home has no default model you still configure one.

**Where do credentials live?**
In the AriadneBuddy home (default `~/.ariadne`) with 0600/0700 permissions.
API keys come from environment variables or the credential store; they are
never written into manifests or research artifacts.

**How do I see what is configured without running the full doctor?**
`ariadnebuddy config show` prints the effective provider, default model,
backend, skill directories, and MCP registration. Add `--json` for machine
consumption.

## Doctor & diagnostics

**What does `doctor` check?**
In order: `home_dir`, `home_writable`, `work_dir`, `job_storage`,
`default_model`, `config_diagnostics`, `provider_transport`, `model_probe`,
`ariadne_backend`, `mcp_server_entry`, `web_ui_assets`, `skills`, and
`private_permissions`. A plain run ends with `All required checks passed.`

**What do `--probe` and `--probe-model` add?**
`--probe` runs `health --json` against the configured Ariadne backend.
`--probe-model` makes a minimal round-trip against the configured model
provider and reports auth, base-URL, and transport failures as a named check
with a fix hint. Without `--probe-model` that check reports as skipped, so the
default report still ends with `All required checks passed.`

**Can I consume the report programmatically?**
`ariadnebuddy doctor --json` emits the checks plus `passed`, `failed`, and
`warned` counts and a per-check fix string.

## The three interfaces

**Is the CLI surface script-friendly?**
`ariadnebuddy run "<prompt>"` accepts `--quiet` (assistant text alone on
stdout, progress on stderr) and `--json` (one structured envelope on stdout),
plus `--model`, `--workdir`, and `--permission auto|manual|yolo`. A global
`--no-telemetry` disables telemetry for `run`, `chat`, and `web`.

**What do the exit codes mean?**
`0` the command completed; `1` arguments were rejected, a required check
failed, or setup is incomplete; `130` interrupted with Ctrl+C during
`run`/`chat`.

**How do I see the tools the agent can call?**
`ariadnebuddy tools` lists all 21 — nine engine tools, six durable-job tools,
and six research-controller tools. `--json` emits the catalog.

## Research Desk

**The desk does not update when I act in Chat.**
It reloads itself when the page becomes visible again, so a decision recorded
elsewhere is picked up without a manual Refresh. `r` reloads immediately.

**How do I print the audit record?**
The desk ships a full print stylesheet: controls are hidden, collapsed
disclosures print open, and the page margin is 18 mm. Use the browser's print
dialog on the task page.

**Where do I start a new screening from?**
The **New AFPK task** button in the task header opens the creation dialog
without leaving the desk. In the chat shell's session list, the **New AFPK
screening** action does the same.

**What do the keyboard shortcuts do?**
`Arrow`/`Home`/`End` move across the Compute, Artifacts, and Trajectory tabs;
`/` focuses the sequence search (or Refresh when the page has none); `r`
reloads the task. They are ignored while a modifier is held, inside an input,
or while a dialog is open.

## Research tasks & gates

**Why did my task stop at `nomination_review` / `scientific_review`?**
A passing audit opens `nomination_review` (approve to design experiments); a
warn or failing audit opens `scientific_review` (amend the request or fix the
environment). Both are deliberate human decision points.

**`Research version conflict` on respond.**
Another surface advanced the task first. The desk reloads instead of
overwriting; re-read with `research status` and respond against the current
`version`.

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

**Can I run studies in batches?**
Yes — see the `ariadne-campaign` skill for frozen question matrices, fair
one-factor comparisons, and per-run fingerprints.

## Desktop

**Where are the engine logs?**
`app.getPath('logs')/engine.log`, size-capped and redacted. The File menu has
**打开日志目录** to reveal it and **在文件管理器中显示工作目录** to reveal the
workspace.

**Startup failed — what now?**
The failure dialog offers Retry, Choose another workspace, Open logs, and
Quit, so a bad workspace or a missing backend never leaves a dead window.

**Can I control the appearance?**
View → 外观 offers System, Light, and Dark, and the choice persists with the
window bounds and zoom factor.

## Uninstall & reset

**How do I remove everything?**
`ariadnebuddy reset --home DIR` prints exactly what it would delete and
removes nothing until you pass `--yes`. It removes the home directory, strips
the `ariadne` server entry from the engine home's `mcp.json`
(`KIMI_CODE_HOME`, default `~/.kimi/mcp.json`), clears the Ariadne skills
directory from the engine's `extraSkillDirs`, and deletes research job
storage. `--keep-jobs` preserves the job storage.
