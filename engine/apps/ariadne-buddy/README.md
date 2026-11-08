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

| Command | Behavior |
| --- | --- |
| `ariadnebuddy run "<prompt>"` | Create a session, attach Ariadne tools, stream one response, and exit. |
| `ariadnebuddy chat` | Lightweight persistent REPL. |
| `ariadnebuddy web [options]` | Start kap-server and the branded local Web UI. |
| `ariadnebuddy doctor [--json] [--probe]` | Check Node, storage, model configuration, backend health, MCP, Web assets, and skills. |
| `ariadnebuddy onboard [options]` | Configure the home directory, API model provider, Ariadne repository/command, MCP, and skills. |
| `ariadnebuddy tools [--json]` | List all 21 tool schemas and annotations. |
| `ariadnebuddy research <action>` | Model-free control of durable research tasks (create, status, list, advance, respond, cancel). |
| `ariadnebuddy info` / `--version` | Print version and resolved paths. |

## Development

| Path | Purpose |
| --- | --- |
| `src/cli.ts` | Command dispatch and usage. |
| `src/harness.ts` | Kimi harness assembly, skill activation, chat turns. |
| `src/server.ts` | Web server startup and the agent reply-style guide. |
| `src/ariadne/backend.ts` | Backend discovery and bounded subprocess execution. |
| `src/ariadne/tools.ts` | The 21-tool MCP catalog (engines, jobs, research controller). |
| `src/ariadne/research.ts` | The gated closed-loop state machine (literature → … → handoff). |
| `src/ariadne/provenance.ts` | Engineering run manifests with content fingerprints. |
| `src/ariadne/jobs.ts` | Durable job store and detached runner. |
| `backend/ariadne_cli.py` | Stable JSON adapter over the ariadne-tps engines. |
| `theme/ariadne.css` | Ancient Greek/Roman visual system (parchment × aegean, meander fret). |
| `skills/` | `ariadne` and `ariadne-campaign` agent skills. |
| `scripts/sync-web-ui.mjs` | Web-UI branding pipeline with a hard brand contract. |

Environment: `ARIADNE_HOME` (default `~/.ariadne`), `ARIADNE_REPO`,
`ARIADNE_COMMAND`, `ARIADNE_PYTHON`, `ARIADNE_WORKDIR`, `ARIADNE_JOBS_DIR`,
`ARIADNE_ESM_MODEL`, `ARIADNE_ESM_DEVICE`, `ARIADNE_CEESS_THRESHOLD`,
`ARIADNE_TOP_K`.

Tests: `pnpm vitest run` (TypeScript) and
`python3 -m unittest discover -s test-python -p 'test_*.py'` (adapter).
Smokes: `scripts/smoke-mcp.mjs`, `scripts/smoke-research.mjs`,
`scripts/smoke-web.mjs` against the built `dist/`.
