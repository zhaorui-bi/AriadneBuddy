# Contributing

Thank you for improving AriadneBuddy.

## Development setup

Requirements:

- Node.js 24.15.0+
- npm 12
- Python 3.10+ for real-backend testing

```bash
npm ci
npm run setup
npm run check
```

Use `npm start` for Electron and `./bin/ariadnebuddy web` for the browser interface.
Most product tests use fake adapter-compatible commands; an Ariadne checkout
and downloaded data are required only for real pipeline integration tests.

## Change boundaries

- Keep product work under `engine/apps/ariadne-buddy`, the root Electron
  shell, packaging, scripts, or documentation whenever possible.
- Avoid changing upstream Kimi Code behavior unless the change is independently
  suitable for upstream; branded behavior must remain gated by the Ariadne
  host identity.
- Do not edit generated `dist/` or `web-ui/` files directly.
- Keep the original portrait in `build/logo-official.png` and its theme-aware
  vector trace in `build/logo.svg`. Regenerate platform icons with
  `scripts/make_ariadne_logo.py` and `scripts/make_icons.py`.
- Preserve strict path, process, output-bound, configuration, and same-origin
  security boundaries.
- Keep the Python adapter compatible with the public Ariadne project rather
  than maintaining a private fork silently.

## Packaging dependency compatibility

The packaging overrides use current `@electron/asar`, `@electron/universal`,
`glob`, and `minimatch` releases. Minimatch 11 uses a different internal
matcher representation, so retaining the old glob 7 consumer would break
file matching even if the dependency audit passed.

The remaining `electron-winstaller` dependency still includes `temp` 0.9.4,
whose cleanup calls use the old rimraf callback API. The postinstall step in
`scripts/patch-packaging-dependencies.mjs` adapts only those calls to the
supported rimraf API, retaining callback completion, synchronous cleanup,
and retry settings. Exact version and source hashes guard the patch; an
unexpected source fails installation, while an already patched source is
accepted without another change. The Electron installation step is retained.

Run `npm run test:packaging` to exercise archive roundtrips and unpacking,
resource filters, glob cancellation, temporary-directory cleanup, and template
consumers. This check also runs in `npm run check`. Remove the compatibility
patch and its rimraf override together when the upstream installer/temp chain
supports current rimraf directly or no longer depends on temp.

## Engineering claims

Describe outputs as evidence-grounded early-stage screening results, not demonstrated
enzyme function. Preserve units, evidence provenance, constraint failures, assumptions,
uncertainty, and attempted-case denominators. A nomination score is not activity: a
candidate still requires heterologous expression and product confirmation before any
claim of function. Do not claim field performance, clinical or regulatory suitability,
or scientific effectiveness without direct, applicable evidence. See
[`docs/SCIENTIFIC_WORKFLOWS.md`](./docs/SCIENTIFIC_WORKFLOWS.md).

## Validation

Before opening a pull request:

```bash
npm run check
npm run build
npm audit --audit-level=low
npm run audit:runtime
python3 -m py_compile engine/apps/ariadne-buddy/backend/ariadne_cli.py
```

For adapter changes, test at least `--version`, `health --json`, and the affected
commands against a pinned Ariadne checkout. For desktop changes, also run
`npm run pack` and `npm run smoke:desktop` on the target platform.

## Pull requests

Keep each pull request focused, explain behavior and risk, add tests, and update
documentation/changelog when appropriate. Never commit credentials, `.env`
files, private sequence or structure data, unpublished knowledge records, user homes,
job logs, generated Web bundles, caches, or packaged applications.
