# Architecture

AriadneBuddy combines four layers:

1. **Product layer** (repository root) — the Electron desktop shell
   (`main.js`), the `bin/ariadnebuddy` launcher, the labyrinth brand mark,
   packaging, and release tooling.
2. **Engine layer** (`engine/`) — the vendored Kimi Code monorepo (pnpm
   workspace) that provides the conversational agent engine, plus the
   `engine/apps/ariadne-buddy` application that turns it into a scientific
   discovery workbench.
3. **Deterministic science layer** (`engine/apps/ariadne-buddy/backend/ariadne_cli.py`)
   — a stable, versioned JSON adapter over an external
   [ariadne-tps](https://github.com/zhaorui-bi/Ariadne) checkout: HMM retrieval
   (`ariadne.search`, pyhmmer), ESM2 semantic scoring (`ariadne.model`), and
   feature-space structure retrieval (`ariadne.embed`). Every scientific number
   in the product comes from this layer as engine artifacts — never from the
   conversational model.
4. **Interaction layer** — CLI, chat REPL, full TUI, a branded local Web UI
   (Greek/Roman visual system), and the desktop app, all speaking to one
   durable research controller with provenance manifests.

## The ariadne-buddy application

```
engine/apps/ariadne-buddy/
├── src/cli.ts               command dispatch (bare = TUI, tui/run/chat/web/doctor/
│                            onboard/research/reset/config/tools/info, --version, --help)
├── src/cli-args.ts          per-command flag schemas and the research actions
├── src/banner.ts            the ASCII mark printed at CLI startup
├── src/paths.ts             home, work, jobs and skills directory resolution
├── src/harness.ts           Kimi harness assembly + per-turn skill activation
├── src/providers.ts         provider presets and base-URL validation
├── src/tui.ts               launch of the terminal workbench
├── src/doctor.ts            the ordered installation checks
├── src/onboard.ts           the six-step guided setup
├── src/toolsCmd.ts          `tools` / `config show` rendering
├── src/server.ts            kap-server startup, bearer URL, research-route wiring
├── src/research-web.ts      the Research Desk HTTP routes
├── src/mcp/register.ts      mcp.json registration of the `ariadne` server
├── src/mcp/server.ts        the stdio MCP server over the tool catalog
├── src/ariadne/backend.ts   backend discovery + interpreter resolution + bounded exec
├── src/ariadne/tools.ts     15 ARIADNE_TOOLS (engines, jobs) with MCP annotations
├── src/ariadne/research-tools.ts 6 RESEARCH_TOOLS + the `research` CLI boundary
├── src/ariadne/research.ts  gated closed-loop state machine
├── src/ariadne/jobs.ts      durable job store + detached runner supervision
├── src/ariadne/job-runner.ts the detached child that runs one job
├── src/ariadne/afpk.ts      the afpk-ks workflow and its report shape
├── src/ariadne/provenance.ts engineering run manifests (sha256 fingerprints)
├── backend/ariadne_cli.py   the deterministic science boundary
├── theme/appearance.css     shared token + motif layer: parchment × aegean palette,
│                            the four pigments, and the meander fret and fluted
│                            columns every branded surface draws from
├── theme/ariadne.css        conversation, project rail, and settings styling over
│                            that shared layer
├── theme/research-desk.html the Research Desk document
├── theme/research-desk.css  Research Desk styling: notice tones, sticky tables, print
├── theme/research-desk.js   Research Desk rendering, empty states, keyboard contract
├── theme/research-launcher.js the session rail injected into the chat shell
├── skills/ariadne*.md       expert-role operating contracts
└── scripts/sync-web-ui.mjs  web-UI branding pipeline with a hard brand contract
```

The meander fret and the fluted columns live in `theme/appearance.css`, not in
`theme/ariadne.css`: `appearance.css` declares the tokens and the motif primitives, and
`ariadne.css` consumes them. The desktop splash and the About panel inline the same
tokens from `appearance.css`. See [Design](./DESIGN.md) for the token reference.

## The command line and the harness

`engine/apps/ariadne-buddy/dist/cli.mjs` is the only entry point. `bin/ariadnebuddy`
resolves a suitable Node and execs it; `engine/apps/ariadne-buddy/package.json`
declares the `ariadnebuddy` bin, though both workspaces stay private and are not an
npm release. Every command takes `--help`.

| Command | What it does |
| --- | --- |
| *(none)* / `tui` | launches the interactive workbench (the full TUI). Bare `ariadnebuddy` and `ariadnebuddy tui` are the same path |
| `run "<prompt>"` | one-shot: create a session, send one prompt, stream the reply, exit |
| `chat` | interactive REPL over one persistent session |
| `web` | starts kap-server and the branded local Web UI |
| `doctor` | runs the ordered installation checks |
| `onboard` | the six-step guided setup |
| `research <action>` | model-free control of durable research tasks |
| `reset` | removes the home, the MCP entry, the skill registration, and job storage |
| `config show` | prints the effective provider, model, backend, skill dirs, and MCP registration |
| `tools` | lists the tool catalog |
| `info` / `--version` | version and resolved paths |

`run` and `chat` accept `--home`, `--model`, `--workdir`, and `--permission
auto|manual|yolo`; `run` additionally accepts `--quiet` (assistant text only on
stdout, progress on stderr) and `--json` (one structured JSON envelope on stdout).
`web` accepts `--port`, `--host`, `--no-open`, and `--home`. The global
`--no-telemetry` flag sets `KIMI_DISABLE_TELEMETRY=1` for `run`, `chat`, and `web`.

Exit codes are uniform: `0` completed, `1` arguments rejected / a required check
failed / setup incomplete, `130` interrupted with Ctrl+C during `run` or `chat`.

Onboarding (`src/onboard.ts`) prints six numbered steps — home directory, existing
configuration, model provider, ariadne backend, MCP registration, skills — and a
`probing backend... (Ns)` elapsed line for the backend probe. The home is created
`0700`; the backend command is validated before `ariadne.json` is written; and
finishing with no default model prints the exact corrective command and exits
non-zero. `--import-from` copies `config.toml`, `credentials`, `oauth`, and
`tui.toml` from another home, but the provider step still runs.

Backend interpreter resolution (`src/ariadne/backend.ts`) tries, in order:
`ARIADNE_PYTHON`, a checkout-local `.venv` or `venv`, then `python3` or `python` on
`PATH` (`py -3` on Windows). The resolved command is `<python> backend/ariadne_cli.py
--repo <checkout>`; `ARIADNE_COMMAND` overrides the whole array.

## The MCP server and the tool groups

The `ariadne` MCP server runs over stdio from `dist/mcp-server.mjs`. It is registered
non-persistently for the CLI prompt command; the Web and desktop hosts load `mcp.json`
from their active Ariadne data directory. Startup updates the built-in `ariadne`
entry and preserves other configured MCP servers for Chat.

`ariadnebuddy tools` lists 21 tools: 15 `ARIADNE_TOOLS` plus 6 `RESEARCH_TOOLS`.

| Group | Tools |
| --- | --- |
| engines (9) | `ariadne_status`, `ariadne_catalog`, `ariadne_build_hmm`, `ariadne_discover`, `ariadne_filter`, `ariadne_score_candidates`, `ariadne_classify`, `ariadne_pipeline_run`, `ariadne_audit_nomination` |
| durable jobs (6) | `ariadne_job_list`, `ariadne_job_status`, `ariadne_job_manifest`, `ariadne_job_log`, `ariadne_job_artifacts`, `ariadne_job_cancel` |
| research controller (6) | `ariadne_research_create`, `ariadne_research_status`, `ariadne_research_list`, `ariadne_research_advance`, `ariadne_research_respond`, `ariadne_research_cancel` |

## The research controller

`src/ariadne/research.ts` is the gated closed-loop state machine: readiness →
literature → hypothesis → pathway → discovery → filtering → nomination → audit →
experiment → validation → iteration → handoff. Knowledge stages are authored by the
expert agent roles as JSON artifacts and hash-frozen into the task; compute stages
launch the deterministic engines as durable jobs. Every decision advances the task
version, and a decision recorded against a stale version is refused with `409`.
Iteration is bounded by `MAX_ITERATIONS` (4).

## The durable job runner

Job runners are detached processes (`src/ariadne/job-runner.ts`); jobs survive session
exit and carry `run-manifest.json` fingerprints (request, inputs, scientific
configuration, configured-output sha256) that the research controller re-verifies
before consuming any stage output.

## The Python adapter

`backend/ariadne_cli.py` speaks exactly one JSON document on stdout per invocation;
progress goes to stderr; failures are `{"ok": false, ...}` plus a non-zero exit. Its
`ADAPTER_VERSION` is pinned to the product version by `npm run check:repo`.

## The local server and its routes

`src/server.ts` starts kap-server with the branded assets directory, then registers the
Research Desk routes from `src/research-web.ts`. The default bind is `127.0.0.1` on
port `58627`; the browser URL carries a bearer token, and a non-loopback `--host`
prints an explicit warning.

| Route | Purpose |
| --- | --- |
| `GET /research` | redirect to the chat shell with `?researchSession=<id>` |
| `GET /research/session` | the Research Desk document |
| `GET /api/v1/ariadne/research` | the task list shown in the session rail |
| `POST /api/v1/ariadne/research` | generic (non-AFPK) research task creation |
| `GET /api/v1/ariadne/research/afpk/inputs` | project input suggestions for the desk dialog |
| `POST /api/v1/ariadne/research/afpk/start` | create and start an AFPK screening task |
| `GET /api/v1/ariadne/research/:id` | one desk task |
| `GET /api/v1/ariadne/research/:id/artifacts/:artifactId` | one verified artifact |
| `POST /api/v1/ariadne/research/:id/advance` | resume an AFPK desk task |
| `POST /api/v1/ariadne/research/:id/jobs/:jobId/:action` | `cancel` or `retry` one job |
| `POST /api/v1/ariadne/research/:id/respond` | record a gate decision |
| `POST /api/v1/ariadne/research/:id/cancel` | cancel a task |

## The branded Web UI

`scripts/sync-web-ui.mjs` generates `web-ui/`. It copies the prebuilt upstream bundle
(`engine/apps/kimi-code/dist-web`) into `web-ui/`, rewrites user-visible product-name
strings and brand SVGs, installs the two self-hosted theme font families, appends the
shared appearance layer plus `theme/ariadne.css` to the themed stylesheets, replaces
`favicon.ico` with `build/icon.ico`, copies `build/logo.svg` to
`web-ui/ariadne-logo.svg`, copies `research-desk.{html,css,js}` and
`research-launcher.js`, applies a cache-bust `?v=` stamp to the asset URLs, and
finally asserts the brand contract. The script is idempotent: it wipes `web-ui/`
before copying, so the generated tree is never edited by hand.

## The Research Desk

`theme/research-desk.html` is the desk document; `research-desk.css` carries its
styling; `research-desk.js` renders the task, its jobs, artifacts, trajectory, and
the AFPK comparison, and owns the desk keyboard contract. `research-launcher.js`
renders the session rail inside the chat shell and the "Awaiting decision" pill.
The desk is a plain document: it talks to the routes above over `fetch`, resolves
every label from the `en`/`zh` string tables, and reloads itself when the page
becomes visible again. See [Keyboard](./KEYBOARD.md) for its bindings.

## The shared appearance layer

`theme/appearance.css` is the single source of colour, geometry, and ornament. It
declares:

- **Parchment and ink scales** — `--tb-paper`, `--tb-paper-raised`,
  `--tb-paper-soft`, `--tb-paper-deep`, `--tb-marble`, `--tb-marble-vein`, and the
  `--tb-ink*` steps, each as a `light-dark()` pair.
- **Four pigments** — aegean (`--tb-aegean` `#1f5688` / `#7fb2d9`, the brand
  accent), terracotta (`--tb-terracotta`, warning and anything awaiting a human
  decision), olive (`--tb-olive`, success and verified evidence), and marble
  (`--tb-marble` `#f4f1ea` / `#232323`, the slab an inscription is carved into).
- **Semantic aliases** — `--color-*` names that map onto those tokens so the
  downstream stylesheets never hardcode a colour.
- **Motif primitives** — `.stele`, `.rule-double`, `.divider-meander`,
  `.medallion`, `.progress-amphora`, `.cartouche`, `.rail-divider--column`,
  `.workspace-column`, `.workspace-frieze`, `.workspace-mark`.
- **Typography** — a serif display face (`Cormorant Garamond Variable` +
  `Noto Serif SC Variable`) over a sans body, with `--font-editorial` for
  blockquotes.

Headings are serif and body text is sans; at most one chromatic accent appears per
surface, washes stay at or below roughly 13%, and ornament is engraved ink rather
than chromatic.

## The desktop shell

`main.js` owns the Electron window. It keeps the title exactly `AriadneBuddy`,
persists window bounds, maximized state, and zoom, sets the Windows app user model id
`com.ariadne.buddy`, writes a size-capped, redacted engine log to
`app.getPath('logs')/engine.log`, and offers File-menu items to reveal the logs
directory and the workspace directory. The About panel and the branded About window
link the packaged `THIRD_PARTY_NOTICES.md`, `SBOM.spdx.json`, and `LICENSE`. A
startup failure opens a dialog with Retry / Choose another workspace / Open logs /
Quit. The tray offers Show / Restart engine / Quit, and a notification fires when a
listed task reaches a waiting gate or a job fails. `CmdOrCtrl+O` chooses a workspace
and `CmdOrCtrl+Shift+R` restarts the engine; View → Appearance offers System / Light
/ Dark. The startup splash and the About window inline the `appearance.css` tokens.

## The brand asset pipeline

```
build/logo.svg  ──┬──▶ web-ui/ariadne-logo.svg   (sync-web-ui.mjs, byte-identical)
                  ├──▶ the favicon, via build/icon.ico  (make_icons.py)
                  └──▶ docs/logo.svg                    (make_readme_logo.py)
```

- `build/logo.svg` is the canonical mark: a single path. `scripts/make_icons.py`
  places it on a marble plaque with an engraved double hairline rule and emits
  `build/icon.png`, `build/icon.ico`, and `build/icon.iconset`
  (`iconutil -c icns build/icon.iconset -o build/icon.icns`).
- `scripts/make_readme_logo.py` composes the README lockup: the mark from
  `build/logo.svg` plus the wordmark and tagline as exact Cormorant Garamond glyph
  outlines, with light and dark inks.
- `scripts/make_ariadne_logo.py` installs the official portrait as
  `build/logo.png` so `make_icons.py` has a raster source.

`docs/images/loop.svg` is the closed loop inside a Greek-key border, its stages drawn
as fluted columns and its human gates as laurel. `npm run check:repo` fails if the
generated `web-ui/ariadne-logo.svg` no longer matches `build/logo.svg`.

## The four contract checks

`npm run check:repo` runs four checks after `scripts/check-repository.mjs`:

| Check | What it guarantees |
| --- | --- |
| `scripts/check-repository.mjs` | version consistency across the two `package.json` files, `package-lock.json`, `CITATION.cff`, the CHANGELOG heading, `ADAPTER_VERSION`, and the three READMEs; required files exist; `.gitignore` still excludes the sensitive runtime paths; every packaged resource source exists; every Markdown link resolves and every code fence is balanced; no sensitive runtime path is tracked |
| `scripts/check-theme-contract.mjs` | the branding pipeline's frozen literals survive in `appearance.css`, every `var()` in the three theme files resolves, every pigment token declares both schemes with `light-dark()`, the seven motif primitives are present, and neither downstream stylesheet hardcodes a hex colour |
| `scripts/check-desk-contract.mjs` | every `data-copy`/`data-label` key in the desk document and every `copy.*` reference in the script resolves in both locales, the structural hooks the desk JavaScript relies on exist, the stylesheet provides the print block and the notice tones, and no user-visible English is hardcoded outside the string tables |
| `scripts/check-brand-leftovers.mjs` | the generated `web-ui/` contains no upstream product name, theme label, brand blue, positioning line, or water-treatment domain language |

## The closed scientific loop

```
readiness → literature → hypothesis ──approve──→ pathway
                ↑                                   │
                │            discovery (HMM retrieval)
            iterate           filtering (QC + dedupe)
                │            nomination (ESM2 scoring + structure retrieval)
        validation ←─ experiment ←──approve── audit (claim-evidence ledger)
                └────────── conclude → handoff
```

- **Knowledge stages** (literature, hypothesis, pathway, experiment,
  validation) are authored by the expert agent roles as JSON artifacts,
  hash-frozen into the task, and gated by explicit human decisions.
- **Compute stages** (discovery, filtering, nomination, audit) launch the
  deterministic engines as durable jobs with verified outputs.
- ESM2 unavailability is an explicit gate (`proceed_without_esm`); the audit
  does not re-flag a waived mode, and the outcome stays `conditional_nomination`.

## Process boundaries

- The adapter speaks exactly one JSON document on stdout per invocation;
  progress goes to stderr; failures are `{"ok": false, ...}` + non-zero exit.
- The MCP server exposes `ariadne_*` tools over stdio, registered
  non-persistently for the CLI prompt command. The Web and desktop hosts load
  `mcp.json` from their active Ariadne data directory. Startup updates the built-in
  `ariadne` entry and preserves other configured MCP servers for Chat.
- Job runners are detached processes; jobs survive session exit and carry
  `run-manifest.json` fingerprints (request, inputs, scientific configuration,
  configured-output sha256) that the research controller re-verifies before
  consuming any stage output.

## Security posture

- Credentials only via environment variables or the Kimi credential store;
  manifests record whitelisted, non-secret scientific settings only.
- Atomic writes with 0600/0700 permissions; symbolic links rejected on all
  research inputs; task stores live under a private directory tree.
- The web server binds loopback by default and authenticates with a bearer
  token; non-loopback binding prints an explicit warning.
