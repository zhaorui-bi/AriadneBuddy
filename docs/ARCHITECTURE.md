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
├── src/cli.ts               command dispatch (run/chat/web/doctor/onboard/tools/research/info)
├── src/harness.ts           Kimi harness assembly + per-turn skill activation
├── src/server.ts            web server startup + expert-agent reply-style guide
├── src/ariadne/backend.ts   backend discovery (ARIADNE_REPO/.venv) + bounded subprocess exec
├── src/ariadne/tools.ts     21-tool MCP catalog (engines, jobs, research controller)
├── src/ariadne/research.ts  gated closed-loop state machine
├── src/ariadne/jobs.ts      durable job store + detached runner
├── src/ariadne/provenance.ts engineering run manifests (sha256 fingerprints)
├── backend/ariadne_cli.py   the deterministic science boundary
├── theme/ariadne.css        parchment × aegean visual system (+ meander fret)
├── skills/ariadne*.md       expert-role operating contracts
└── scripts/sync-web-ui.mjs  web-UI branding pipeline with a hard brand contract
```

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
  non-persistently per session and wired through `~/.ariadne/mcp.json` for the
  web/desktop hosts.
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
