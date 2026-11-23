# Release process

AriadneBuddy is distributed from GitHub as source and as platform-specific
desktop artifacts. The npm workspaces remain private and are not an npm
release.

## 1. Version bump

Bump `version` in **both** `package.json` files (root and
`engine/apps/ariadne-buddy`) plus `package-lock.json` (the top-level `version`
and the root entry under `packages[""]`), update `CITATION.cff` (`version` +
`date-released`), and add a `## [x.y.z-n] - YYYY-MM-DD` heading to
`CHANGELOG.md`. The repository check verifies all of them agree, including the
adapter's `ADAPTER_VERSION` and the version named in `README.md`,
`README.zh-CN.md`, and `engine/apps/ariadne-buddy/README.md`.

The version must stay a numbered beta SemVer — `scripts/check-repository.mjs`
rejects anything that does not match `\d+\.\d+\.\d+-beta\.\d+` — and the
CHANGELOG heading must carry the `date-released` from `CITATION.cff`, not a
date of its own.

## 2. Full gate

`npm run check` is one chain. It runs, in order:

```text
node --check main.js
node --check scripts/check-packaging.mjs
node --check scripts/patch-packaging-dependencies.mjs
node --check scripts/audit-runtime.mjs
node --check scripts/check-adapter.mjs
node --check scripts/check-repository.mjs
node --check scripts/check-tui.mjs
node --check scripts/generate-checksums.mjs
node --check scripts/generate-sbom.mjs
node --check scripts/generate-third-party-notices.mjs
node --check scripts/smoke-desktop.mjs
node --check engine/apps/ariadne-buddy/scripts/smoke-web.mjs
node --check engine/apps/ariadne-buddy/scripts/smoke-research.mjs
node --check engine/apps/ariadne-buddy/scripts/smoke-mcp.mjs
node --check engine/apps/ariadne-buddy/scripts/check-theme-contract.mjs
node --check engine/apps/ariadne-buddy/scripts/check-desk-contract.mjs
node --check engine/apps/ariadne-buddy/scripts/check-brand-leftovers.mjs
npm run lint               # desktop + worker oxlint, and the engine's type-aware
                           # oxlint over apps/ariadne-buddy, all --deny-warnings
npm run typecheck          # tsc -p tsconfig.json --noEmit
npm test                   # vitest with coverage thresholds
npm run test:adapter       # the Python adapter suite
npm run test:desktop-startup
npm run test:packaging     # asar, glob and packaging-filter checks
npm run check:tui          # the TUI typecheck plus both host regression suites
npm run smoke:mcp          # 21 tools over the built MCP server
npm run smoke:research     # drives the whole loop to a validated handoff
npm run smoke:web          # bearer auth, assets, global search, the Research Desk
                           # AFPK launch/review/cancel/job controls, brand frame
npm run check:licenses     # third-party notices + SPDX SBOM currency
npm run check:repo         # the four contract checks
```

The last step is `npm run check:repo`, which runs four checks in sequence:

```bash
node scripts/check-repository.mjs
node engine/apps/ariadne-buddy/scripts/check-theme-contract.mjs
node engine/apps/ariadne-buddy/scripts/check-desk-contract.mjs
node engine/apps/ariadne-buddy/scripts/check-brand-leftovers.mjs
```

What each one guarantees:

| Check | Guarantees |
| --- | --- |
| `check-repository.mjs` | the root package stays private and named `ariadne-buddy`; the root, harness, `package-lock.json` (top level and root entry), `CITATION.cff`, `ADAPTER_VERSION`, and the three README versions all agree; the Node engine floor is unchanged; the CHANGELOG heading matches the version and the citation date; the required files exist; `.gitignore` still excludes the sensitive runtime paths; every `extraResources` source exists and every packaged license destination is mapped; every Markdown link resolves and every code fence is balanced; the generated Web UI mark matches `build/logo.svg`; skill frontmatter is complete; and no sensitive runtime path is tracked in Git |
| `check-theme-contract.mjs` | the branding pipeline's frozen literals survive in `theme/appearance.css`; every `var()` across `appearance.css`, `ariadne.css`, and `research-desk.css` resolves; every pigment token declares both schemes with `light-dark()` and exactly two hex values; the seven motif primitives are present; `prefers-reduced-motion` and `forced-colors` are guarded; and neither downstream stylesheet hardcodes a hex colour or fetches a remote asset |
| `check-desk-contract.mjs` | exactly the `en` and `zh` string dictionaries exist and are non-empty; every `data-copy`/`data-label` key in the desk document and every `copy.*` reference in the script resolves in both locales; the twenty structural hooks the desk JavaScript relies on exist; the three `role="tab"` buttons, the notice region, the polite live region, the frieze band, the `role="region"` panel, and the `aria-expanded` disclosure are all present; the stylesheet provides the print block, the notice tones, the illustrated empty state, sticky table headers, the visually-hidden utility, and the motion and forced-colour guards; and no user-visible English is hardcoded outside the string tables |
| `check-brand-leftovers.mjs` | the generated `web-ui/` contains none of the ten forbidden patterns — the upstream product name, the upstream theme labels, the upstream brand blues, the upstream positioning lines, or the water-treatment domain language |

For the release candidate, add the dependency audits:

```bash
npm run release:check  # check + npm audit + runtime audit
```

## 3. Icons and brand

Only touch the brand via its sources — never edit generated artifacts:

```bash
python3 scripts/make_ariadne_logo.py    # build/logo.png from the official portrait
python3 scripts/make_icons.py && iconutil -c icns build/icon.iconset -o build/icon.icns
python3 scripts/make_readme_logo.py     # docs/logo.svg, the README lockup
npm run sync:web                        # branded web-ui/ (contract-asserted)
```

`make_readme_logo.py` reads the brand serif from the self-hosted fonts that
`npm run sync:web` installs, so run `sync:web` first if
`web-ui/assets/ariadne-fonts/` is missing. `make_icons.py` needs
`build/logo.png`, which `make_ariadne_logo.py` writes from
`build/logo-official.png`.

The sync script rewrites the prebuilt upstream bundle in place, so it is not a
no-op: it asserts that every declared string and colour replacement matched
something, and `assertBrandContract` then pins the product title, the theme
colours, the shared palette tokens, the logo bytes, the About-page version, the
bright-default colour scheme, and the preserved Kimi provider icon. A failing
contract fails the build.

## 4. Package and publish

```bash
npm run pack           # electron-builder --dir: an unsigned directory build in dist/
npm run dist           # electron-builder → distributables (dmg/zip, AppImage, nsis/zip)
```

`npm run pack` is the fast local check: it lays the app out under `dist/`
without producing an installer and without signing. Use `npm run dist` for the
artifacts that actually ship. Both run `predist`, which cleans `dist/` and
rebuilds the engine dist first.

Tag `vx.y.z-n`, attach the `dist/` artifacts, and publish the GitHub release
with the changelog section as notes. Regenerate `licenses/` artifacts
(`npm run licenses`) whenever dependencies change and commit them; the
`licenses/` set also feeds the desktop About panel.

## 5. What ships

- The Electron app with the branded web UI, engine dist, skills, adapter, and
  license set (`extraResources`).
- Source users: `npm run setup` then `./bin/ariadnebuddy onboard` (needs their
  own ariadne-tps checkout and model key).
