# ariadne-buddy package

`ariadne-buddy` (v0.1.0-beta.1) is the product host for AriadneBuddy. It starts the Kimi Code
agent engine through `@moonshot-ai/kimi-code-sdk` and `@moonshot-ai/kap-server`,
then exposes the external ariadne-tps engine checkout (HMM retrieval, ESM2
semantic scoring, feature-space structure retrieval) as an MCP stdio server and
drives the gated scientific-discovery research controller.

The package provides onboarding, diagnostics, a bundled Python adapter
(`backend/ariadne_cli.py`), durable jobs, request provenance, session-level tool
registration, a branded Web UI, and the executables used by the desktop
application.

## Commands

Every command accepts `--help`, which prints its own flags, examples, and the
exit-code table. The bare `ariadnebuddy` and `ariadnebuddy tui` are the same
full terminal workbench.

| Command | Behavior |
| --- | --- |
| `ariadnebuddy tui` | Launch the interactive workbench (same as the bare command). |
| `ariadnebuddy run "<prompt>"` | Create a session, attach Ariadne tools, stream one response, and exit. `--quiet` puts assistant text alone on stdout with progress on stderr; `--json` emits one structured envelope. |
| `ariadnebuddy chat` | Lightweight persistent REPL. |
| `ariadnebuddy web [options]` | Start kap-server and the branded local Web UI. `--port N` (0 picks a free port, default 58627), `--host H` (default 127.0.0.1), `--no-open`. |
| `ariadnebuddy doctor [options]` | Check Node, storage, model configuration, provider transport, backend health, MCP, Web assets, skills, and private permissions. `--json` adds passed/failed/warned counts and a per-check fix string; `--probe` runs `health --json` against the backend; `--probe-model` makes a minimal provider round-trip. |
| `ariadnebuddy onboard [options]` | Configure the home directory, API model provider, Ariadne repository/command, MCP, and skills. Six numbered steps; finishes non-zero with the corrective command when no default model is configured. |
| `ariadnebuddy tools [--json]` | List all 21 tool schemas and annotations. |
| `ariadnebuddy research <action>` | Model-free control of durable research tasks (create, status, list, advance, respond, cancel). |
| `ariadnebuddy config show [--json]` | Print the effective provider, default model, backend, skill directories, and MCP registration without running the full doctor. |
| `ariadnebuddy reset [--home DIR] [--keep-jobs] [--yes]` | Print the deletion plan, and only with `--yes` remove the home directory, strip the `ariadne` server from the engine home's `mcp.json`, clear the Ariadne skills directory, and delete research job storage. |
| `ariadnebuddy info` / `ariadnebuddy version` | Print version and resolved paths. |

`run`, `chat`, and `web` also accept `--home`, `--model`, `--workdir`, and
`--permission auto|manual|yolo`; `run` and `chat` additionally honour the global
`--no-telemetry`, which sets `KIMI_DISABLE_TELEMETRY=1`.

Exit codes: `0` the command completed; `1` arguments were rejected, a required
check failed, or setup is incomplete; `130` interrupted with Ctrl+C during
`run`/`chat`.

## Development

| Path | Purpose |
| --- | --- |
| `src/cli-args.ts` | Per-command argument parsing and per-command usage text. |
| `src/cli.ts` | Command dispatch, exit codes, and the top-level usage. |
| `src/harness.ts` | Kimi harness assembly, skill activation, chat turns. |
| `src/onboard.ts` | Guided setup, backend validation, reset planning, and the first-run gate. |
| `src/doctor.ts` | The installation checks and the report formatter. |
| `src/server.ts` | kap-server startup and the agent reply-style guide. |
| `src/research-web.ts` | The Research Desk's authenticated HTTP routes and the Web asset server. |
| `src/ariadne/backend.ts` | Backend discovery and bounded subprocess execution. |
| `src/ariadne/tools.ts` | The 21-tool MCP catalog (engines, jobs, research controller). |
| `src/ariadne/research.ts` | The gated closed-loop state machine (literature → … → handoff). |
| `src/ariadne/provenance.ts` | Engineering run manifests with content fingerprints. |
| `src/ariadne/jobs.ts` | Durable job store and detached runner. |
| `src/ariadne/afpk.ts` | The `afpk-ks` molluscan KS screening workflow. |
| `backend/ariadne_cli.py` | Stable JSON adapter over the ariadne-tps engines. |
| `theme/appearance.css` | Shared appearance layer: the parchment and ink scale, the four pigments, and the motif primitives (stele, meander, medallion, amphora, cartouche, fluted columns) every branded surface draws from. |
| `theme/ariadne.css` | Conversation, project rail, and settings styling over that shared layer. |
| `theme/research-desk.html` | The Research Desk document. |
| `theme/research-desk.css` | Research Desk styling: notice tones, sticky and print-ready tables, accessibility guards. |
| `theme/research-desk.js` | Research Desk rendering, illustrated empty states, and the keyboard contract. |
| `theme/research-launcher.js` | The chat shell's research-session pane and task list. |
| `skills/` | `ariadne` and `ariadne-campaign` agent skills. |

### Web UI generation

`scripts/sync-web-ui.mjs` copies the prebuilt upstream bundle from
`../kimi-code/dist-web` into `web-ui/`, rewrites the user-visible product
strings, repaints the palette, and appends `theme/ariadne.css` plus the shared
appearance layer. A declared replacement that matches nothing fails the sync,
so a silently skipped brand change can never ship. Four contract checks guard
the result:

| Script | Guarantees |
| --- | --- |
| `scripts/check-theme-contract.mjs` | The frozen brand literals survive, every `var()` in the theme resolves, and every pigment declares both schemes. |
| `scripts/check-desk-contract.mjs` | Every `data-copy` key exists in both the English and Chinese dictionaries, and the desk's structural hooks are present. |
| `scripts/check-brand-leftovers.mjs` | No upstream product string survives in the generated bundle. |
| `../../scripts/check-repository.mjs` | Version consistency, packaging resources, Markdown links, and tracked-file hygiene. |

Run `npm run sync:web` after any change under `theme/`, then
`npm run check:repo` from the repository root.

Environment: `ARIADNE_HOME` (default `~/.ariadne`), `ARIADNE_REPO`,
`ARIADNE_COMMAND`, `ARIADNE_PYTHON`, `ARIADNE_WORKDIR`, `ARIADNE_JOBS_DIR`,
`ARIADNE_ESM_MODEL`, `ARIADNE_ESM_DEVICE`, `ARIADNE_CEESS_THRESHOLD`,
`ARIADNE_TOP_K`.

Tests: `pnpm vitest run` (TypeScript) and
`python3 -m unittest discover -s test-python -p 'test_*.py'` (adapter).
Smokes: `scripts/smoke-mcp.mjs`, `scripts/smoke-research.mjs`,
`scripts/smoke-web.mjs` against the built `dist/`.
