# Changelog

All notable user-facing changes are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and semantic
versioning.

## [Unreleased]

### Added

- A classical parchment-and-aegean appearance layer shared by the chat shell, the
  Research Desk, the desktop splash, and the desktop About panel, built from four
  pigments and engraved ornament.
- A Research Desk frame with notice tones, illustrated empty states, sticky and
  print-ready tables, a keyboard and screen-reader contract, and in-desk creation of
  AFPK screening tasks.
- A desktop About panel, persisted window bounds, an engine log, and startup failure
  recovery.
- Theme, desk, and brand contract checks that run inside `npm run check:repo`.
- Documentation for the design language, the keyboard contract, the vocabulary, and
  worked artifact examples.
- `ariadnebuddy tui` as a first-class command, `ariadnebuddy reset` with a printed plan
  that removes nothing until `--yes`, and `ariadnebuddy config show` for the effective
  provider, model, backend, skill directories, and MCP registration.
- `ariadnebuddy doctor --probe-model` for provider connectivity, `--quiet` and `--json`
  on `run` for script-friendly output, and a global `--no-telemetry`.
- `POST /api/v1/ariadne/research` so a generic (non-AFPK) research task can be started
  from the Research Desk.

### Changed

- The chat shell now carries a meander entablature, serif conversation typography, and
  a dedicated AFPK task group in the session list.
- Onboarding now reports numbered progress and fails with the exact corrective command
  when it finishes without a configured model provider; the backend command is validated
  before it is recorded.

## [0.1.0-beta.1] - 2026-11-08

### Added

- AriadneBuddy: a multi-agent scientific-discovery workbench rebuilt on the
  OpenAqua-Harness template around the ariadne-tps deterministic engines
  (HMM retrieval, ESM2 semantic scoring, feature-space structure retrieval).
- Gated closed-loop research controller: literature → hypothesis → pathway →
  discovery → filtering → nomination → audit → experiment → validation →
  iteration → handoff, with human decision gates and ESM availability waivers.
- 21 MCP tools, durable jobs with provenance manifests, a deterministic
  nomination audit, branded Greek/Roman Web UI, skills, and desktop app.

[Unreleased]: https://github.com/zhaorui-bi/AriadneBuddy/compare/6acc5252aff11946f6be8eca23882662ba4e8cb8...main
[0.1.0-beta.1]: https://github.com/zhaorui-bi/AriadneBuddy/tree/6acc5252aff11946f6be8eca23882662ba4e8cb8
