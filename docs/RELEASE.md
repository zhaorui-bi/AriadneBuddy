# Release process

AriadneBuddy is distributed from GitHub as source and as platform-specific
desktop artifacts. The npm workspaces remain private and are not an npm
release.

## 1. Version bump

Bump `version` in **both** `package.json` files (root and
`engine/apps/ariadne-buddy`) plus `package-lock.json`, update
`CITATION.cff` (`version` + `date-released`), and add a
`## [x.y.z-n] - YYYY-MM-DD` heading to `CHANGELOG.md`. The repository check
verifies all of them agree, including the adapter's `ADAPTER_VERSION`.

## 2. Full gate

```bash
npm run check        # lint, typecheck, coverage tests, adapter tests,
                     # desktop startup, packaging, TUI, smokes, licenses, repo
npm run release:check  # check + npm audit + runtime audit
```

## 3. Icons and brand

Only touch the brand via its sources — never edit generated artifacts:

```bash
python3 scripts/make_ariadne_logo.py    # build/logo.png (canonical mark)
python3 scripts/make_icons.py && iconutil -c icns build/icon.iconset -o build/icon.icns
npm run sync:web                        # branded web-ui/ (contract-asserted)
```

The sync script's `assertBrandContract` pins the product title, theme
colors, palette tokens, logo bytes, and About version — a failing contract
fails the build.

## 4. Package and publish

```bash
npm run dist          # electron-builder → dist/ (dmg/zip, AppImage, nsis/zip)
```

Tag `vx.y.z-n`, attach the `dist/` artifacts, and publish the GitHub release
with the changelog section as notes. Regenerate `licenses/` artifacts
(`npm run licenses`) whenever dependencies change and commit them.

## 5. What ships

- The Electron app with the branded web UI, engine dist, skills, adapter, and
  license set (`extraResources`).
- Source users: `npm run setup` then `./bin/ariadnebuddy onboard` (needs their
  own ariadne-tps checkout and model key).
