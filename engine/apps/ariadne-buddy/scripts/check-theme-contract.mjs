#!/usr/bin/env node
// Contract check for the shared Ariadne appearance layer. Verifies that the
// branding pipeline's frozen literals survive, that every var() reference in
// the theme resolves, that every pigment token declares both schemes, and that
// the downstream stylesheets carry no unthemed colour. Plain Node, no deps.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'ariadne-buddy');
const themeDir = path.join(pkgRoot, 'theme');
const FILES = ['appearance.css', 'ariadne.css', 'research-desk.css'];
const sources = Object.fromEntries(
  FILES.map((name) => [name, readFileSync(path.join(themeDir, name), 'utf8')]),
);

const problems = [];
const fail = (message) => problems.push(message);

// 1. Frozen literals. sync-web-ui.mjs asserts the first three, smoke-desktop.mjs
//    asserts the first and the palette block, and the desktop splash inlines the
//    palette. A change here breaks the build, packaging and startup gates.
const FROZEN = [
  ['appearance.css', '--tb-paper: light-dark(#fbfbfa, #171717)'],
  ['appearance.css', '--tb-sidebar: light-dark('],
  ['appearance.css', '--workspace-panel-radius:'],
  ['appearance.css', '.workspace-frieze'],
  ['appearance.css', '--color-bg: var(--tb-paper)'],
];
for (const [file, literal] of FROZEN) {
  if (!sources[file].includes(literal)) fail(`${file} lost the frozen literal: ${literal}`);
}

// 2. Every var() must resolve inside the theme file set.
const defined = new Set();
for (const text of Object.values(sources)) {
  for (const match of text.matchAll(/(--[a-z0-9-]+)\s*:/g)) defined.add(match[1]);
}
// Values supplied by the consuming page or provided as var() fallbacks.
const EXTERNAL = new Set(['--medallion-mask', '--amphora-fill', '--column-width', '--column-height']);
for (const [name, text] of Object.entries(sources)) {
  for (const match of text.matchAll(/var\((--[a-z0-9-]+)/g)) {
    const token = match[1];
    if (EXTERNAL.has(token)) continue;
    if (!defined.has(token)) fail(`${name} references undefined custom property ${token}`);
  }
}

// 3. Every pigment token must declare both schemes, so dark mode can never fall
//    back to a light-only value.
const PIGMENTS = [
  '--tb-paper', '--tb-paper-raised', '--tb-paper-soft', '--tb-paper-deep', '--tb-marble',
  '--tb-ink', '--tb-ink-strong', '--tb-ink-muted', '--tb-ink-faint',
  '--tb-aegean', '--tb-aegean-deep', '--tb-terracotta', '--tb-olive',
  '--tb-action', '--tb-action-hover', '--tb-danger', '--tb-done',
];
for (const token of PIGMENTS) {
  const declaration = new RegExp(`${token}\\s*:\\s*([^;]+);`).exec(sources['appearance.css']);
  if (!declaration) {
    fail(`appearance.css is missing the pigment token ${token}`);
    continue;
  }
  if (!declaration[1].includes('light-dark(')) {
    fail(`${token} must declare light and dark values with light-dark()`);
  }
  const hexes = declaration[1].match(/#[0-9a-fA-F]{3,8}/g) ?? [];
  if (hexes.length !== 2) fail(`${token} must declare exactly two hex values, found ${String(hexes.length)}`);
}

// 4. The classical motif primitives must exist and stay dependency-free.
const MOTIFS = ['.stele', '.rule-double', '.divider-meander', '.medallion', '.progress-amphora',
  '.cartouche', '.rail-divider--column'];
for (const motif of MOTIFS) {
  if (!sources['appearance.css'].includes(motif)) fail(`appearance.css lost the motif primitive ${motif}`);
}
for (const guard of ['prefers-reduced-motion', 'forced-colors']) {
  if (!sources['appearance.css'].includes(guard)) fail(`appearance.css must guard ${guard}`);
}

// 5. Downstream stylesheets carry no unthemed colour. Allow the transparent and
//    currentcolor keywords plus rgb()/hsl() mixes over tokens, but never a bare
//    hex literal. The print block is exempt: paper is white and ink is black
//    there by definition, regardless of the screen scheme.
for (const name of ['ariadne.css', 'research-desk.css']) {
  const withoutPrint = sources[name].replace(/@media print\s*\{[\s\S]*?\n\}\n/g, '\n');
  const stripped = withoutPrint.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of stripped.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    fail(`${name} hardcodes colour ${match[0]}; use a token from appearance.css`);
  }
  if (/@import|url\((['"]?)(?:https?:)?\/\//i.test(stripped)) {
    fail(`${name} must not import or fetch remote assets`);
  }
}

// 6. The desk palette must stay legible: ink on parchment is the only pairing the
//    restraint rule allows for body text.
if (!sources['research-desk.css'].includes('--serif: var(--workspace-heading-font')) {
  fail('research-desk.css must derive its display face from the shared heading token');
}

if (problems.length) {
  console.error(`theme contract: ${String(problems.length)} problem(s)`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(
  `theme contract: ok (${String(FROZEN.length)} frozen literals, ${String(defined.size)} tokens resolved, ` +
  `${String(PIGMENTS.length)} pigments in both schemes, ${String(MOTIFS.length)} motifs, ` +
  `${String(FILES.length)} stylesheets unthemed-colour free)`,
);
