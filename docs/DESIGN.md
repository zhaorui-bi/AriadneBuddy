# Design language

English | [简体中文](./zh-CN/DESIGN.md)

The AriadneBuddy interface is built from one shared appearance layer,
[`engine/apps/ariadne-buddy/theme/appearance.css`](../engine/apps/ariadne-buddy/theme/appearance.css).
That file is the single source of colour, geometry, and ornament for the chat shell, the
Research Desk, the desktop splash, and the desktop About panel. This document names every
token and primitive it declares and states where each one may appear.

The loop figure used across the documentation is [`images/loop.svg`](./images/loop.svg).

## The idea

The product is a record of a scientific investigation, so the interface is a stone
surface: parchment carries the work, ink carries the words, and colour appears only
where a surface must state something. Four pigments carry the whole palette.

## Surfaces: the parchment and ink scale

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--tb-paper` | `#fbfbfa` | `#171717` | the workspace canvas |
| `--tb-paper-raised` | `#ffffff` | `#202020` | raised cards, the composer, menus |
| `--tb-paper-soft` | `#f2f2f1` | `#242424` | content panels, wells, the sidebar base |
| `--tb-paper-deep` | `#ebebea` | `#111111` | sunken surfaces, column capitals and bases |
| `--tb-marble` | `#f4f1ea` | `#232323` | the slab an inscription is carved into |
| `--tb-marble-vein` | `rgb(0 0 0 / 0.05)` | `rgb(255 255 255 / 0.05)` | the vein wash over marble |
| `--tb-ink` | `#242424` | `#e8e8e8` | body text |
| `--tb-ink-strong` | `#151515` | `#f5f5f5` | headings and emphasised text |
| `--tb-ink-muted` | `#595959` | `#bdbdbd` | secondary text |
| `--tb-ink-faint` | `#707070` | `#a3a3a3` | tertiary text |

Every token above declares both schemes with `light-dark()`, so dark mode can never fall
back to a light-only value. `--tb-line` and `--tb-line-strong` carry the same pair at
13% and 32% opacity, and `--tb-shadow-color` carries the elevation tint.

### Swatch strip

<table>
  <thead>
    <tr><th>Token</th><th>Light</th><th>Dark</th></tr>
  </thead>
  <tbody>
    <tr><td>--tb-paper</td><td style="background:#fbfbfa;width:96px;height:22px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#171717;width:96px;height:22px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
    <tr><td>--tb-paper-raised</td><td style="background:#ffffff;width:96px;height:22px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#202020;width:96px;height:22px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
    <tr><td>--tb-paper-soft</td><td style="background:#f2f2f1;width:96px;height:22px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#242424;width:96px;height:22px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
    <tr><td>--tb-paper-deep</td><td style="background:#ebebea;width:96px;height:22px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#111111;width:96px;height:22px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
    <tr><td>--tb-marble</td><td style="background:#f4f1ea;width:96px;height:22px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#232323;width:96px;height:22px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
    <tr><td>--tb-ink</td><td style="background:#242424;width:96px;height:22px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#e8e8e8;width:96px;height:22px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
    <tr><td>--tb-ink-strong</td><td style="background:#151515;width:96px;height:22px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#f5f5f5;width:96px;height:22px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
    <tr><td>--tb-ink-muted</td><td style="background:#595959;width:96px;height:22px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#bdbdbd;width:96px;height:22px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
    <tr><td>--tb-ink-faint</td><td style="background:#707070;width:96px;height:22px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#a3a3a3;width:96px;height:22px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
    <tr><td>--tb-aegean</td><td style="background:#1f5688;width:96px;height:22px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#7fb2d9;width:96px;height:22px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
    <tr><td>--tb-aegean-deep</td><td style="background:#173f66;width:96px;height:22px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#a8cbe6;width:96px;height:22px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
    <tr><td>--tb-terracotta</td><td style="background:#a8452c;width:96px;height:22px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#e08a63;width:96px;height:22px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
    <tr><td>--tb-olive</td><td style="background:#4f6021;width:96px;height:22px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#a3b86a;width:96px;height:22px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
    <tr><td>--tb-danger</td><td style="background:#8f2d1f;width:96px;height:22px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#e08070;width:96px;height:22px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
    <tr><td>--tb-done</td><td style="background:#64734a;width:96px;height:22px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#8d9c74;width:96px;height:22px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
  </tbody>
</table>

## The four pigments

| Token | Light | Dark | Meaning |
| --- | --- | --- | --- |
| `--tb-aegean` | `#1f5688` | `#7fb2d9` | the sea Ariadne's thread crosses — the single brand accent |
| `--tb-aegean-deep` | `#173f66` | `#a8cbe6` | the accent under hover and pressure |
| `--tb-terracotta` | `#a8452c` | `#e08a63` | the vessel the story is written on — warning, caution, anything awaiting a human decision |
| `--tb-olive` | `#4f6021` | `#a3b86a` | the branch of victory — success, completion, verified evidence |
| `--tb-marble` | `#f4f1ea` | `#232323` | the slab an inscription is carved into — the raised card surface and the ornament bands |

`--tb-aegean` carries interactive state, links, and the active rail. `--tb-terracotta`
carries anything awaiting a human decision. `--tb-olive` carries success and verified
evidence. Two further pigments extend the set without adding a hue:
`--tb-danger` (`#8f2d1f` / `#e08070`) for failure and `--tb-done` (`#64734a` / `#8d9c74`)
for completed work.

`--tb-blue`, `--tb-blue-hover`, `--tb-cyan`, `--tb-success`, and `--tb-warning` are
compatibility aliases that point at the pigments above, so upstream selectors that still
ask for a blue or a cyan resolve to the brand palette instead of an unpigmented default.

## Semantic aliases

Components never name a pigment directly. They name the role.

| Alias | Resolves to | Used for |
| --- | --- | --- |
| `--color-accent` | `--tb-blue` → `--tb-aegean` | interactive state, links, the active rail |
| `--color-success` | `--tb-success` → `--tb-olive` | success, completion, verified evidence |
| `--color-warning` | `--tb-warning` → `--tb-terracotta` | warning, anything awaiting a human decision |
| `--color-danger` | `--tb-danger` | failure, blocking states |
| `--color-done` | `--tb-done` | completed work |
| `--color-marble` | `--tb-marble` | the raised card surface and ornament bands |
| `--color-marble-vein` | `--tb-marble-vein` | the vein wash |
| `--color-rule-frieze` | `--workspace-frieze-ink` | the ink of every moulding |

Each chromatic alias ships a wash and a border companion at or below the restraint
ceiling: `--color-accent-soft` / `--color-accent-bd`, `--color-success-soft` /
`--color-success-bd`, `--color-warning-soft` / `--color-warning-bd`, `--color-danger-soft`
/ `--color-danger-bd`, `--color-done-soft` / `--color-done-bd`, `--color-terracotta-soft` /
`--color-terracotta-bd`, and `--color-olive-soft` / `--color-olive-bd`. The soft washes are
11–13% of the pigment; the borders are 29–32%.

The classical layer also exposes `--color-aegean`, `--color-aegean-deep`,
`--color-terracotta`, and `--color-olive` for surfaces that must name the pigment itself.

## Geometry and mouldings

| Token | Value | Meaning |
| --- | --- | --- |
| `--radius-stele` | `2px` | the cut corner of a slab |
| `--radius-pill` | `999px` | true circles only |
| `--shadow-stele` | `0 1px 0 …30%, 0 10px 26px -18px …` | a slab resting on the surface |
| `--shadow-medallion` | inset ring + inset top highlight | a struck medallion |
| `--rule-hairline` | `1px solid var(--color-line)` | the engraved hairline |
| `--rule-egg-and-dart` | three layered gradients, 9px period | the egg-and-dart band |
| `--workspace-rule` | `3px double var(--color-line-strong)` | the double rule |
| `--workspace-frieze-ink` | `color-mix(in srgb, var(--color-accent) 62%, transparent)` | the ink of the frieze and the meander |

The source states the geometry rule directly:

> Stone geometry: everything is cut, never pill-shaped, except true circles (avatars,
> swatches, the medallion).

## Typography

Headings are serif, body is sans.

| Token | Stack | Used for |
| --- | --- | --- |
| `--font-display` | `"Cormorant Garamond Variable", "Noto Serif SC Variable", "Songti SC", STSong, "Source Han Serif SC", Georgia, serif` | headings and the product name |
| `--font-editorial` | `"Noto Serif SC Variable", "Songti SC", STSong, "Source Han Serif SC", Georgia, serif` | inscriptions and long-form text |
| `--font-ui` / `--sans` | `system-ui, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif` | body, tables, controls |
| `--workspace-heading-font` | `var(--font-display)` | the heading face every layer derives from |

Cormorant Garamond Variable and Noto Serif SC Variable ship with the product and are
served from `assets/ariadne-fonts/`. The Research Desk derives its own display face from
the shared token rather than naming a family a second time.

## The restraint rule

The rule is stated verbatim in `appearance.css`:

> The Ariadne identity is built from four pigments and one restraint rule: parchment
> carries the work, ink carries the words, and colour appears only where a surface must
> state something. Never let two chromatic accents share one surface, and keep every wash
> at or below ~13% of its pigment.

In practice:

- At most one chromatic accent per surface. A surface is either aegean, terracotta, or
  olive — never two.
- Washes sit at or below ~13% of their pigment (11–13% in the token set); the border
  companions sit at 29–32%.
- Ornament is engraved ink, never chromatic. Every moulding resolves to
  `--color-rule-frieze` or `--color-line`.
- Headings are serif; body, tables, and controls are sans.

## Motif primitives

Each primitive is declared in `appearance.css` with the comment that states its meaning.

| Class | What it is |
| --- | --- |
| `.stele` | "an upright marble slab carrying an inscription" — hairline border, `--radius-stele`, `--shadow-stele`, and a 10px egg-and-dart band over the marble highlight |
| `.rule-double` | the `--workspace-rule` double rule, used as a section divider |
| `.divider-meander` | "the Greek key (meander). A continuous band, never a single dash." — 11px tall, 28px period |
| `.medallion` | "a struck medallion: the seal on a verified record" — a 2.25rem circle of marble highlight with the inset medallion shadow |
| `.progress-amphora` | "an amphora filling: progress that reads as a vessel, not a bar" — 1.5rem × 2.5rem, filled to `--amphora-fill` in aegean |
| `.cartouche` | "a framed name plate for the product mark" — marble highlight, `--radius-stele`, `--shadow-stele` |
| `.rail-divider--column` | "a fluted column used as a rail divider" — 1.5rem × 5.75rem of repeating flutes |
| `.workspace-column` | the fluted column with capital and base drawn by `::before` and `::after`, sized by `--column-width` and `--column-height` |
| `.workspace-frieze` | the 11px Greek-key band under a header |
| `.workspace-mark` | the 34px brand mark, masked from `ariadne-logo.svg` and tinted with `currentColor` |

## Where each motif may appear

| Motif | Where it appears today | Source |
| --- | --- | --- |
| `.workspace-frieze` | the Research Desk task header, under the metadata row | `theme/research-desk.html` |
| `.workspace-mark` | the Research Desk no-script card; the chat sidebar brand | `theme/research-desk.html`, `theme/ariadne.css` |
| `.workspace-column` + `.medallion` | the illustrated empty-state ornament | `theme/research-desk.js` (`emptyState`) |
| `.workspace-column` | the desktop splash brand emblem and the About panel emblem | `main.js` |
| `.divider-meander` | the desktop splash and the About panel | `main.js` |
| `--rule-egg-and-dart` | the desktop splash brand rule | `main.js` (`.brand-rule`) |
| `--shadow-medallion`, `--marble-highlight`, `--radius-pill` | the desktop splash and About panel mark | `main.js` (`.mark`) |
| `.stele` | reserved for the surfaces that state a human decision or a frozen artifact | `theme/appearance.css` |
| `.cartouche`, `.cartouche__mark` | reserved for the framed product name plate | `theme/appearance.css` |
| `.progress-amphora` | reserved for progress that must read as a vessel | `theme/appearance.css` |
| `.rail-divider--column` | reserved for a rail divider | `theme/appearance.css` |
| `.rule-double` | reserved for section rules | `theme/appearance.css` |

The reserved primitives ship in the packaged `brand/appearance.css` and are available to
every branded surface; they are declared in the shared layer rather than re-derived per
screen.

## Accessibility guards

`appearance.css` guards the motif layer three ways, and the theme contract check fails
the build if either of the first two is removed.

`prefers-reduced-motion: reduce` removes every transition and animation from `.stele`,
`.medallion`, `.progress-amphora`, and `.cartouche`.

`forced-colors: active` strips the ornament back to system colours: `.stele`,
`.cartouche`, `.medallion`, and `.rail-divider--column` take a `1px solid CanvasText`
border and a `Canvas` background with no shadow; `.stele::before`, `.divider-meander`, and
`.workspace-frieze` lose their backgrounds and keep a `CanvasText` bottom border; the
amphora fill becomes `CanvasText`.

Print is handled one layer down, in `research-desk.css`: the print block sets paper to
white and ink to black by definition, regardless of the screen scheme, which is why the
theme contract check exempts the print block from its no-hardcoded-colour rule. The desk
print stylesheet drops the interactive controls, prints every collapsed disclosure open,
repeats the table header on each page, and drops the Greek-key frieze.

## Verification

`npm run check:repo` runs three contract checks over this layer:

- `check-theme-contract.mjs` — frozen literals, every `var()` reference resolves, every
  pigment declares both schemes, the motif primitives exist, and `ariadne.css` and
  `research-desk.css` carry no unthemed colour.
- `check-desk-contract.mjs` — every rendered desk label resolves in both locales, the
  structural hooks exist, and the print, `prefers-reduced-motion`, and `forced-colors`
  blocks are present.
- `check-brand-leftovers.mjs` — no upstream product name, theme label, or brand blue
  survives branding.
