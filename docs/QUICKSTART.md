# Quick start

English | [简体中文](./zh-CN/QUICKSTART.md)

This page is a first-run path: from an empty machine to a reviewed research
task. Every command below is one the binary accepts; `./bin/ariadnebuddy
<command> --help` prints the same text, including the exit-code table.

## 1. Prerequisites

- Node.js ≥ 24.15 (`engines.node`), npm (declared as `packageManager`: npm@12.0.2), and pnpm 12 (a devDependency).
- Python 3.10+ with an [ariadne-tps](https://github.com/zhaorui-bi/Ariadne)
  checkout and its environment (`pyhmmer`, `pyrodigal`, `scikit-learn`,
  `openpyxl`, `numpy`). A checkout-local `.venv` is detected automatically.
- Optional, for ESM2 semantic scoring: `pip install ariadne-tps[esm]`
  (`torch`, `transformers`). Without it the loop still runs behind an explicit
  `proceed_without_esm` waiver.
- A conversational model provider. An API key is enough — there is no login
  flow. Presets are `kimi-coding`, `zai`, and `deepseek`; anything
  OpenAI-compatible is configured as `custom`.

The engines stay external: AriadneBuddy bridges a checkout, it does not vendor
one.

## 2. Install and build

```bash
git clone https://github.com/zhaorui-bi/AriadneBuddy && cd AriadneBuddy
npm run setup        # pnpm workspace install, then build
```

`npm run setup` runs `pnpm -C engine install --frozen-lockfile` and then
`npm run build`: the engine app (CLI, MCP server, search worker), the branded
Web UI assets, and the TUI bundle.

## 3. Onboard

```bash
export ZAI_API_KEY="..."
./bin/ariadnebuddy onboard --yes --home ~/.ariadne \
  --ariadne-repo /path/to/Ariadne \
  --provider zai --api-key-env ZAI_API_KEY
```

Onboard runs six numbered steps: home directory, existing configuration, model
provider, ariadne backend, MCP registration, skills. It creates the home with
`0700` permissions, registers the `ariadne` server in `mcp.json`, and registers
the Ariadne skills. `--import-from DIR` copies `config.toml`, credentials,
`oauth`, and `tui.toml` from another home. If that home already sets a default model, the
   provider step only confirms it; otherwise you still configure one.

**Model provider.** `--api-key KEY` writes the key into `config.toml` in the
clear; prefer `--api-key-env VAR` and export the variable. The two flags are
mutually exclusive.

```bash
./bin/ariadnebuddy onboard --provider kimi-coding --api-key-env KIMI_CODING_API_KEY
./bin/ariadnebuddy onboard --provider deepseek    --api-key-env DEEPSEEK_API_KEY
./bin/ariadnebuddy onboard --provider zai         --api-key-env ZAI_API_KEY
./bin/ariadnebuddy onboard --provider custom --base-url https://host/v1 \
  --model my-model --api-key-env LAB_API_KEY --provider-type openai
```

`--provider-type` accepts `anthropic`, `openai`, `kimi`, `google-genai`,
`openai_responses`, and `vertexai`. The environment variable name that ships
with each preset is the preset id upper-cased with `_API_KEY` appended.

**Backend.** Point at a checkout, or name an adapter-compatible command. The
two flags are mutually exclusive.

```bash
./bin/ariadnebuddy onboard --ariadne-repo /path/to/Ariadne
./bin/ariadnebuddy onboard --ariadne-command '["uv","run","ariadne"]'
```

A checkout must contain `ariadne/__init__.py` and `pyproject.toml`; the
interpreter is resolved from `ARIADNE_PYTHON` first, then a checkout-local `.venv` or
`venv`, then `python3`/`python` on `PATH`. A command from `--ariadne-command` or
`--ariadne-repo` must resolve to an executable on `PATH`.

**Onboard fails loudly.** It prints `probing backend...` and then
`probe: … (Ns)`. If the probe fails, `ariadne.json` is not written and the run
ends non-zero with the three commands to retry. If onboarding finishes with no
default model configured it prints the exact corrective command and exits
non-zero:

```text
No default model is configured, so run, chat, and web have no model to call.
  ariadnebuddy onboard --provider kimi-coding --api-key-env KIMI_CODING_API_KEY
```

A probe that is incomplete rather than failed records the backend anyway; stage
the reference data, then re-run `ariadnebuddy doctor --probe`.

## 4. Verify

```bash
./bin/ariadnebuddy doctor --probe --probe-model
./bin/ariadnebuddy tools            # the 21 ariadne_* tools
```

`doctor` reports one line per check: `node`, `home_dir`, `home_writable`,
`work_dir`, `job_storage`, `default_model`, `config_diagnostics`,
`provider_transport`, `model_probe`, `ariadne_backend`, `mcp_server_entry`,
`web_ui_assets`, `skills`, and `private_permissions`.

- `--probe` runs `health --json` against the configured backend.
- `--probe-model` makes a minimal round-trip against the configured provider.
  Without the flag that check reports as skipped, so a plain `doctor` still
  ends with `All required checks passed.`
- `--json` emits the report as JSON with passed/failed/warned counts and a
  `fix` string on every failing check.
- A failing required check exits 1.

## 5. Read the effective configuration

```bash
./bin/ariadnebuddy config show
./bin/ariadnebuddy config show --json --home ~/.ariadne
```

`config show` prints the home directory, default model, provider, base URL,
API key source (an environment variable, marked set or not set, or `stored in
config.toml`), backend, skill directories, MCP server command, and whether
`mcp.json` is registered — without running the full doctor.

## 6. Three ways to work

```bash
./bin/ariadnebuddy web              # branded workbench → http://127.0.0.1:58627
./bin/ariadnebuddy                  # full TUI workbench (same as `ariadnebuddy tui`)
./bin/ariadnebuddy chat             # interactive REPL, one persistent session
```

**Web.** `--port N` (0 picks a free port; default 58627), `--host H` (default
127.0.0.1), `--no-open`, `--home DIR`. The server prints a URL carrying a
bearer token — keep it private, and never bind a non-loopback host casually.

**Terminal TUI.** No flags. If the TUI bundle has not been built the launcher
says so and falls back to the plain REPL; build it once with
`npm run build:tui`.

**Chat.** Type `quit` or `exit`, or press `Ctrl`+`C`, or close stdin to leave.
`Ctrl`+`C` closes the harness first and exits 130.

Ask a research question and approve the gates. For a complete discovery study:

> 用 Ariadne 引擎对 input/all_tps.fasta 做 cembranoid CeeSs 提名，走完整闭环

The agent loads the `ariadne` skill, freezes a nomination request, and walks the
gated loop — you approve the hypothesis gate, the nominated shortlist, and the
iterate/conclude decision.

**One-shot run.** `run` creates a session, sends one prompt, streams, and exits.

```bash
./bin/ariadnebuddy run "summarize the coral cembrene literature"
./bin/ariadnebuddy run --quiet --json "nominate cembrene-class TPS candidates"
```

`--quiet` puts assistant text on stdout and progress on stderr; `--json` puts
one structured JSON envelope on stdout. `run` and `chat` also take `--home
DIR`, `--model NAME`, `--workdir DIR`, and `--permission auto|manual|yolo`.

## 7. Research Desk walkthrough

1. Start `./bin/ariadnebuddy web` from the project that owns the task, then
   select the task in the sidebar session list. The list groups ordinary tasks,
   archived tasks, and a separate AFPK screening group with its own archive;
   open gates carry an **Awaiting decision** pill, and AFPK sessions open
   through their direct links.
2. Read the thread. The task header carries the status pill, the round (TPS and
   CeeSs tasks; the AFPK screen suppresses it), an absolute `Updated` timestamp,
   a bare relative stamp such as `4 minutes ago`, and the task id. The
   **How this desk works** disclosure explains Round, Version, Request
   revision, and Gates.
3. Approve a gate. A pending human decision renders as a review card; on an
   AFPK shortlist review it is a terracotta-edged panel whose label reads
   `Awaiting decision` uppercased in CSS, inside a polite live region. Record
   the decision with a reason and the current task version.
4. Inspect artifacts and the trajectory. The three tabs — Compute, Artifacts,
   Trajectory — hold the job list, the frozen artifacts with their SHA-256
   fingerprints, and the event log. Audit tables keep a sticky header, a
   visually-hidden caption, tabular numerals, and a double rule separating this
   run's classification from imported or published evidence columns.
5. Print. The desk ships a full print stylesheet: controls are hidden,
   disclosures print open, and the page margin is 18 mm.

Loading states use an ink shimmer skeleton with `aria-busy`. Keyboard:
`Arrow`/`Home`/`End` move across the three tabs, `/` focuses the sequence
search (or Refresh when the page has none), and `r` reloads the task. The desk
also reloads itself when the page becomes visible again, so a decision recorded
in Chat is picked up without a manual refresh. See [Keyboard](./KEYBOARD.md).

For stopping or retrying a job, cancelling a task, and the AFPK evidence
comparison, see [Research tasks](./RESEARCH_TASKS.md).

## 8. Model-free research control

The `research` command drives the same state machine the agent uses, with no
conversational model in the loop.

```bash
./bin/ariadnebuddy research create  --input request.json
./bin/ariadnebuddy research status  --id research_0123456789abcdef01234567
./bin/ariadnebuddy research list
./bin/ariadnebuddy research advance --id research_0123456789abcdef01234567
./bin/ariadnebuddy research respond --input respond.json
./bin/ariadnebuddy research cancel  --input cancel.json
```

`create` freezes the mandate; `advance` reconciles state and moves one step;
`respond` answers an open attention item; `cancel` ends the task with a reason.
Every action validates its JSON against the matching `ariadne_research_*` MCP
schema. `request.json`:

```json
{ "requestId": "quickstart-1", "objective": "Nominate CeeSs candidates",
  "requestFile": "examples/cases/ceess-coral-transcriptome.json", "maxJobs": 8 }
```

`respond.json` carries the task id, the attention id, the `expectedVersion` you
read from `status`, and the action — `submit_stage`, `approve`, `revise`,
`amend_request`, `proceed_without_esm`, `iterate`, `conclude`, or `retry`. Input
files are regular files (no symbolic links) of at most 64 KiB, and relative
paths resolve from `ARIADNE_WORKDIR`. Every action also takes `--home DIR`, and
`advance` takes `--expected-version N` to make the concurrency check explicit.
See [Research tasks](./RESEARCH_TASKS.md) for the full response table.

## 9. Reset

```bash
./bin/ariadnebuddy reset --home ~/.ariadne            # prints the plan, exits 1
./bin/ariadnebuddy reset --home ~/.ariadne --yes      # applies it
```

Reset removes the home directory, strips the `ariadne` server entry from the
engine home's `mcp.json` (`KIMI_CODE_HOME`, default `~/.kimi/mcp.json`), clears
the Ariadne skills directory from the engine's `extraSkillDirs`, and deletes
research job storage. `--keep-jobs` keeps the job storage directory. Without
`--yes` nothing is removed: the command prints the deletion plan and exits 1.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | the command completed |
| 1 | arguments were rejected, a required check failed, or setup is incomplete |
| 130 | interrupted with `Ctrl`+`C` during `run` or `chat` |

## Related

- [FAQ](./FAQ.md) · [Troubleshooting](./TROUBLESHOOTING.md) · [Glossary](./GLOSSARY.md)
- [Research tasks](./RESEARCH_TASKS.md) · [Scientific workflow discipline](./SCIENTIFIC_WORKFLOWS.md) · [Design](./DESIGN.md)
- [Keyboard](./KEYBOARD.md) · [Examples](./EXAMPLES.md) · [Architecture](./ARCHITECTURE.md)
- 简体中文入口：[快速上手](./zh-CN/QUICKSTART.md)
