#!/usr/bin/env node
// Contract check for the Research Desk: every rendered label must resolve in
// both locales, and the structural hooks the desk JavaScript relies on must
// exist. Runs with plain Node — no dependencies, no build.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const themeDir = path.join(pkgRoot, 'theme');
const html = readFileSync(path.join(themeDir, 'research-desk.html'), 'utf8');
const css = readFileSync(path.join(themeDir, 'research-desk.css'), 'utf8');
const script = readFileSync(path.join(themeDir, 'research-desk.js'), 'utf8');

const problems = [];
const fail = (message) => problems.push(message);

function objectLiteral(source, name) {
  const start = source.indexOf(`const ${name} = {`);
  if (start < 0) throw new Error(`could not find ${name} in research-desk.js`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open, index + 1);
    }
  }
  throw new Error(`unbalanced ${name} literal`);
}

const strings = new Function(`return ${objectLiteral(script, 'strings')}`)();
const locales = Object.keys(strings);
if (locales.join(',') !== 'en,zh') fail(`expected exactly the en and zh locales, found ${locales.join(',')}`);

const keys = {};
for (const locale of locales) {
  keys[locale] = new Set(Object.keys(strings[locale]));
  for (const key of keys[locale]) {
    if (typeof strings[locale][key] !== 'string' || strings[locale][key].trim() === '') {
      fail(`${locale}.${key} is empty`);
    }
  }
}

// 1. Every data-copy / data-label key in the document must exist in both locales.
for (const match of html.matchAll(/\bdata-(?:copy|label)="([^"]+)"/g)) {
  const key = match[1];
  for (const locale of locales) {
    if (!keys[locale].has(key)) fail(`data-copy key "${key}" is missing from the ${locale} dictionary`);
  }
}

// 2. Every key referenced from the script through copy[...] must exist too.
for (const match of script.matchAll(/\bcopy\.([A-Za-z_]\w*)\b/g)) {
  const key = match[1];
  for (const locale of locales) {
    if (!keys[locale].has(key)) fail(`copy.${key} is missing from the ${locale} dictionary`);
  }
}
// Keys resolved dynamically from the phase/tab tables; validated explicitly below.
const DYNAMIC_COPY_KEYS = new Set(['knowledge', 'engines', 'validationPhase', 'afpkMethod',
  'compute', 'artifacts', 'trajectory']);
// copy[tab] / copy[phase] index the phase tables by variable; their value set is
// exactly DYNAMIC_COPY_KEYS, which is validated above.
const DYNAMIC_COPY_INDICES = new Set(['tab', 'phase']);
for (const match of script.matchAll(/\bcopy\[(\w+)\]/g)) {
  const key = match[1];
  if (DYNAMIC_COPY_KEYS.has(key) || DYNAMIC_COPY_INDICES.has(key)) continue;
  for (const locale of locales) {
    if (!keys[locale].has(key)) fail(`copy[${key}] is missing from the ${locale} dictionary`);
  }
}
for (const key of DYNAMIC_COPY_KEYS) {
  for (const locale of locales) {
    if (!keys[locale].has(key)) fail(`dynamic copy key "${key}" is missing from the ${locale} dictionary`);
  }
}

// 3. Structural hooks the desk JavaScript depends on.
const requiredIds = ['notice', 'notice-text', 'notice-dismiss', 'state', 'task', 'task-objective',
  'task-metadata', 'session-controls', 'new-afpk-task', 'refresh', 'session-activity',
  'session-activity-meta', 'tabs', 'activity-panel', 'tab-panel', 'announcer',
  'tab-compute', 'tab-artifacts', 'tab-trajectory', 'afpk-create-dialog'];
for (const id of requiredIds) {
  if (!html.includes(`id="${id}"`)) fail(`research-desk.html is missing #${id}`);
}

const tabButtons = [...html.matchAll(/role="tab"/g)].length;
if (tabButtons !== 3) fail(`expected exactly three role="tab" buttons, found ${String(tabButtons)}`);

if (!html.includes('class="notice" role="status"')) fail('#notice must declare role="status"');
if (!html.includes('aria-live="polite"')) fail('the desk must expose a polite live region');
if (!html.includes('class="workspace-frieze"')) fail('the task header must carry the Greek-key frieze band');
if (!html.includes('role="region"')) fail('#tab-panel must declare role="region"');
if (!html.includes('aria-expanded="false"')) fail('#session-activity summary must declare its expanded state');

// 4. Stylesheet contract.
if (!css.includes('@media print')) fail('research-desk.css must provide a print stylesheet');
for (const tone of ['info', 'warning', 'error']) {
  if (!css.includes(`.notice[data-tone="${tone}"]`)) fail(`research-desk.css is missing the ${tone} notice tone`);
}
if (!css.includes('.empty-state-figure')) fail('research-desk.css must style the illustrated empty state');
if (!css.includes('position: sticky')) fail('research-desk.css must pin the wide table headers');
if (!css.includes('.visually-hidden')) fail('research-desk.css must provide a visually-hidden utility');
if (!css.includes('prefers-reduced-motion')) fail('research-desk.css must honour prefers-reduced-motion');
if (!css.includes('forced-colors')) fail('research-desk.css must honour forced-colors');

// 5. Copy parity between the two dictionaries.
const enOnly = [...keys.en].filter((key) => !keys.zh.has(key));
const zhOnly = [...keys.zh].filter((key) => !keys.en.has(key));
if (enOnly.length) fail(`keys only in en: ${enOnly.join(', ')}`);
if (zhOnly.length) fail(`keys only in zh: ${zhOnly.join(', ')}`);

// 6. The desk must not hardcode user-visible English outside the dictionaries.
const hardcoded = [...script.matchAll(/element\(['"][a-z]+['"],\s*['"]([A-Z][^'"]{6,})['"]\)/g)]
  .map((match) => match[1])
  .filter((text) => !/^[A-Z·—–-]+$/.test(text));
for (const text of new Set(hardcoded)) {
  fail(`hardcoded English label "${text}" must go through the strings table`);
}

if (problems.length) {
  console.error(`desk contract: ${String(problems.length)} problem(s)`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`desk contract: ok (${String(keys.en.size)} copy keys in ${locales.length} locales, ${String(requiredIds.length)} hooks, print + a11y styles present)`);
