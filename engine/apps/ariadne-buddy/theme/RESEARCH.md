# AriadneBuddy visual-research synthesis

## Status

The visual direction is derived from the published Ariadne style language
(`docs/stylesheets/extra.css` of the ariadne-tps repository): warm paper
neutrals with one aegean-blue hue, serif display type, and scholarly restraint.
AriadneBuddy extends it into the interactive workbench with an explicit ancient
Greek/Roman reading: **marble parchment, aegean blue, verdigris, gold, and
terracotta**, plus the meander (Greek key) fret as the single ornament — the
thread through the labyrinth that names both the engine and the product.

## Audience and task model

AriadneBuddy hosts long, high-attention natural-product discovery sessions
involving sequences, HMM scores, probabilities, pathways, candidates, evidence
tables, and status signals. The interface therefore needs to optimize for:

1. fast scanning and reliable hierarchy;
2. low fatigue during long reading sessions;
3. unambiguous action and status colors;
4. clear Latin, Chinese, numerical and monospace text;
5. visual credibility without imitating a journal page or a museum.

Aesthetic preference alone is not sufficient evidence; the direction should be
validated with representative bench scientists and bioinformaticians.

## Palette (design tokens)

| Role | Light | Dark | Source |
| --- | --- | --- | --- |
| Paper / canvas | `#f4f2f0` | `#161d27` | `--ariadne-paper` |
| Surface soft / deep | `#eae6e1` / `#e2dcd2` | `#212730` / `#10161f` | derived paper ramp |
| Ink / strong | `#252f3d` / `#1a222e` | `#ebe7e4` / `#f8f5f2` | `--ariadne-ink` |
| Aegean blue (accent) | `#4b607c` | `#6a9fcc` | `--ariadne-blue` |
| Verdigris (success / teal) | `#3f7f78` | `#a5d8d1` | `--ariadne-teal` |
| Gold (warning) | `#8a6d1d` | `#e4bf77` | `--ariadne-gold` family |
| Terracotta (danger) | `#8f3222` | `#dc9c94` | `--ariadne-red` |
| Lines | `rgba(37,47,61,.14)` | `rgba(235,231,228,.16)` | `--ariadne-line` |

The tokens are exposed as `--tb-*` custom properties in `theme/ariadne.css` and
mapped onto the upstream bundle's `--color-*` contract, so both light and dark
schemes stay consistent across every bundled component.

## Typography

- UI: system sans stack (`Schibsted Grotesk Variable` → `Helvetica Neue` →
  PingFang/Noto Sans SC) for navigation, controls, tables, and dense content.
- Display: `Cormorant Garamond Variable` + `Noto Serif SC` — reserved for the
  brand wordmark, hero, and wizard titles; the classical serif carries the
  Greek/Roman register without touching reading surfaces.
- Numerals: tabular figures for scores, E-values, probabilities.

## Ornament budget

Exactly one ornament: the continuous meander fret beneath the sidebar brand
block (single-line Greek key, 16px tile, aegean in light / verdigris in dark).
Header datum lines, corner ticks on the first-run wizard, and the 32px
instrument-paper grid carry structure; no ornament appears inside tables, code,
plots, or message text.

## Validation plan

1. WCAG 2.2 AA contrast for text pairs on paper and dark surfaces.
2. Long-session reading on representative transcripts (mixed Latin + CJK).
3. Status-color discrimination (verdigris/gold/terracotta) under common
   color-vision deficiencies.
4. Screenshot diff of light/dark surfaces after each `sync-web-ui.mjs` run —
   the branding contract already pins the palette tokens.
