#!/usr/bin/env node
// Scans the generated Web UI bundle for upstream strings that the branding
// pipeline is supposed to have removed. A silent no-op in sync-web-ui.mjs leaves
// the shipped product looking like someone else's; this turns that into a hard
// failure. Plain Node, no dependencies.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webUi = path.join(pkgRoot, 'web-ui');

// Product names and upstream-only vocabulary that must never survive branding.
const FORBIDDEN = [
  ['Kimi Code Web', 'the upstream product name'],
  ['Moon bright', 'the upstream theme labels'],
  ['月之亮面', 'the upstream theme labels'],
  ['Kimi 服务器', 'the upstream server label'],
  ['#1783ff', 'the upstream brand blue'],
  ['#1a88ff', 'the upstream brand blue'],
  ['The AI coding workbench', 'the upstream positioning line'],
  ['为专业开发者打造的 AI 编程工作台', 'the upstream positioning line'],
  ['water treatment', 'the water-treatment domain language from a different product'],
  ['WContBench', 'the water-treatment domain language from a different product'],
];

function walk(directory) {
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...walk(absolute));
    else if (entry.isFile()) found.push(absolute);
  }
  return found;
}

if (!statSync(webUi, { throwIfNoEntry: false })) {
  console.error('brand leftovers: web-ui/ is missing; run npm run sync:web first');
  process.exit(1);
}

const problems = [];
let scanned = 0;
for (const file of walk(webUi)) {
  if (!/\.(?:js|css|html|json|svg|map)$/.test(file)) continue;
  if (file.endsWith('.map')) continue; // source maps embed upstream module names
  scanned += 1;
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const lines = text.split('\n');
  for (const [needle, why] of FORBIDDEN) {
    for (let index = 0; index < lines.length; index += 1) {
      if (!lines[index].includes(needle)) continue;
      const relative = path.relative(pkgRoot, file);
      problems.push(`${relative}:${String(index + 1)} still contains "${needle}" (${why})`);
    }
  }
}

if (problems.length) {
  console.error(`brand leftovers: ${String(problems.length)} occurrence(s)`);
  for (const problem of problems.slice(0, 40)) console.error(`  - ${problem}`);
  if (problems.length > 40) console.error(`  ... and ${String(problems.length - 40)} more`);
  process.exit(1);
}

console.log(`brand leftovers: ok (${String(scanned)} generated files scanned, ${String(FORBIDDEN.length)} forbidden patterns)`);
