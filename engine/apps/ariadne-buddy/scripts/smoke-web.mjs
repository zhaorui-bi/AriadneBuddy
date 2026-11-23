#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = path.resolve(process.argv[2] ?? path.join(packageRoot, 'dist', 'cli.mjs'));
const webAssetsDir = path.resolve(
  process.argv[3] ?? path.join(path.dirname(path.dirname(cliPath)), 'web-ui'),
);
const workerPath = path.join(path.dirname(cliPath), 'search-worker.mjs');

assertFile(cliPath, 'built CLI');
assertFile(workerPath, 'global-search worker');
assertFile(path.join(webAssetsDir, 'index.html'), 'Web UI entry point');

const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'ariadne-web-smoke-'));
const homeDir = path.join(temporaryRoot, 'home');
const adapterPath = path.join(temporaryRoot, 'adapter.mjs');
const afpkFixturePath = path.join(temporaryRoot, 'afpk-fixture.mjs');
const env = {
  ...process.env,
  KIMI_LOG_LEVEL: 'off',
  ARIADNE_HOME: homeDir,
  ARIADNE_WORKDIR: temporaryRoot,
  ARIADNE_JOBS_DIR: path.join(temporaryRoot, 'jobs'),
  ARIADNE_COMMAND: JSON.stringify([process.execPath, adapterPath]),
  ARIADNE_AFPK_PYTHON: afpkFixturePath,
  ARIADNE_WEB_ASSETS_DIR: webAssetsDir,
};
const output = [];
let child;

try {
  child = spawn(
    process.execPath,
    [cliPath, 'web', '--no-open', '--host', '127.0.0.1', '--port', '0', '--home', homeDir],
    {
      cwd: temporaryRoot,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  child.stdout.on('data', (chunk) => output.push(chunk.toString()));
  child.stderr.on('data', (chunk) => output.push(chunk.toString()));

  const localUrl = await waitForServerUrl(child, output, 30_000);
  const url = new URL(localUrl);
  const token = decodeURIComponent(url.hash.slice('#token='.length));
  if (token === '') throw new Error('server URL did not contain a bearer token');

  const assetResponse = await fetch(`${url.origin}/`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!assetResponse.ok) {
    throw new Error(`Web UI entry point returned HTTP ${String(assetResponse.status)}`);
  }
  const assetHtml = await assetResponse.text();
  if (!assetHtml.includes('<title>AriadneBuddy</title>')) {
    throw new Error('Web UI entry point is not the branded AriadneBuddy document');
  }

  const unauthorized = await fetch(`${url.origin}/api/v1/search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'Ariadne' }),
    signal: AbortSignal.timeout(10_000),
  });
  if (unauthorized.status !== 401) {
    throw new Error(
      `search endpoint accepted a request without its bearer token (HTTP ${String(unauthorized.status)})`,
    );
  }

  const response = await fetch(`${url.origin}/api/v1/search`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ query: 'Ariadne' }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`search endpoint returned HTTP ${String(response.status)}`);
  }
  const envelope = await response.json();
  if (envelope?.code !== 0) {
    throw new Error(`search endpoint returned code ${String(envelope?.code)}`);
  }
  const indexState = envelope?.data?.index_state;
  if (indexState === undefined || indexState === null) {
    throw new Error('search endpoint omitted index_state');
  }
  if (typeof indexState.degraded === 'string' && indexState.degraded !== '') {
    throw new Error(`global search is degraded: ${indexState.degraded}`);
  }

  await verifyResearchDesk(url.origin, token);
  if (process.platform !== 'win32') await verifyAfpkStart(url.origin, token);
  process.stdout.write(
    `Web smoke: bearer auth, assets, global search (${String(indexState.state)}), and Research Desk AFPK launch, review, task cancellation, job controls, and classical brand frame verified\n`,
  );
} catch (error) {
  const diagnostic = redact(output.join('')).slice(-8_000);
  if (diagnostic !== '') process.stderr.write(`\n--- server output ---\n${diagnostic}\n`);
  throw error;
} finally {
  if (child !== undefined) await stopChild(child);
  await rm(temporaryRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

// The Research Desk is the product's primary work surface. Assert that the
// served document and stylesheet carry the classical frame, the notice tone
// system, the print path and the cache-bust stamps — a regression in any of
// these ships a generic grey page under the Ariadne brand.
async function verifyDeskBrand(origin, deskHtml) {
  for (const [needle, what] of [
    ['class="workspace-frieze"', 'Greek-key frieze band'],
    ['id="task-objective"', 'objective heading'],
    ['id="notice-dismiss"', 'notice dismiss control'],
    ['id="new-afpk-task"', 'in-desk task creation entry'],
    ['rel="icon"', 'favicon link'],
    ['name="theme-color"', 'theme-color meta'],
    ['aria-live="polite"', 'live region'],
    ['role="region"', 'task record region'],
  ]) {
    if (!deskHtml.includes(needle)) {
      throw new Error(`served Research Desk document lost the ${what} (${needle})`);
    }
  }

  const css = await (await fetch(`${origin}/research-desk.css`, {
    signal: AbortSignal.timeout(10_000),
  })).text();
  for (const [needle, what] of [
    ['@media print', 'print stylesheet'],
    ['.notice[data-tone="info"]', 'info notice tone'],
    ['.notice[data-tone="warning"]', 'warning notice tone'],
    ['.empty-state-figure', 'illustrated empty state'],
    ['position: sticky', 'pinned table headers'],
    ['--workspace-rule', 'classical double rule'],
  ]) {
    if (!css.includes(needle)) {
      throw new Error(`served Research Desk stylesheet lost the ${what} (${needle})`);
    }
  }

  for (const asset of ['research-desk.css', 'research-desk.js']) {
    const stamped = new RegExp(`(?:src|href)="/${asset.replace('.', '\\.')}\\?v=`).test(deskHtml);
    if (!stamped) throw new Error(`/${asset} is served without a cache-bust stamp`);
  }
}

async function verifyResearchDesk(origin, token) {
  const api = '/api/v1/ariadne/research';
  const request = (url, init) => fetch(`${origin}${url}`, { signal: AbortSignal.timeout(10_000), ...init });
  const auth = { authorization: `Bearer ${token}` };
  const legacy = await request('/research?task=research_0123456789abcdef01234567', { redirect: 'manual' });
  assert.equal(legacy.status, 302);
  assert.equal(legacy.headers.get('location'), '/?researchSession=research_0123456789abcdef01234567');
  const page = await request('/research/session');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'self'/);
  const deskHtml = await page.text();
  assert.match(deskHtml, /research-desk\.js/);
  assert.equal((await request('/research-desk.js')).status, 200);
  assert.equal((await request('/research-launcher.js')).status, 200);
  await verifyDeskBrand(origin, deskHtml);
  assert.equal((await request(api)).status, 401);
  assert.deepEqual(await (await request(api, { headers: auth })).json(), { tasks: [] });

  await writeFile(adapterPath, `
const command = process.argv[2];
if (command === '--version') console.log('fixture 1');
else if (command === 'health') console.log(JSON.stringify({ ok: true, ready_for_pipeline: true }));
else if (command === 'identity') console.log('{}');
else if (command === 'discover') {
  const stage = process.argv[process.argv.indexOf('--stage-dir') + 1];
  if (stage.endsWith('2-discovery-artifacts')) process.exit(7);
  setInterval(() => {}, 1000);
}
else process.exit(1);
`);
  const writeJson = async (name, data) => {
    const file = path.join(temporaryRoot, name);
    await writeFile(file, JSON.stringify(data));
    return file;
  };
  const cli = async (action, data) => {
    const input = await writeJson('research-input.json', data);
    return JSON.parse(execFileSync(process.execPath, [cliPath, 'research', action, '--input', input], {
      cwd: temporaryRoot, env, encoding: 'utf8', timeout: 15_000, stdio: ['ignore', 'pipe', 'pipe'],
    }));
  };
  const requestFile = await writeJson('request.json', {
    target_class: 'Synthetic workflow fixture', input_proteins: ['fixture.faa'], query_hmm: 'fixture.hmm', reference_dir: 'fixtures',
  });
  const submit = async (task, artifact) => cli('respond', {
    taskId: task.id, expectedVersion: task.version,
    attentionId: task.attention.find((item) => item.status === 'open').id,
    action: 'submit_stage', reason: 'Test fixture', artifactFile: await writeJson('stage.json', artifact),
  });
  let task = await cli('create', { requestId: 'web-smoke', objective: 'Review a staged hypothesis', requestFile, maxJobs: 3 });
  task = await cli('advance', { taskId: task.id });
  task = await submit(task, { sources: [{ title: 'Fixture source' }], findings: ['Fixture observation'], gaps: [] });
  task = await cli('advance', { taskId: task.id });
  task = await submit(task, { hypotheses: [{ statement: 'Fixture', rationale: 'Fixture source', prediction: 'Fixture output' }] });

  const listed = await (await request(api, { headers: auth })).json();
  assert.equal(listed.tasks[0].id, task.id);
  assert.equal(listed.tasks[0].waitingReason, 'stage_review');
  const detailUrl = `${api}/${task.id}`;
  const detail = await (await request(detailUrl, { headers: auth })).json();
  const hypothesis = detail.artifacts.find((item) => item.stage === 'hypothesis');
  const artifact = await (await request(`${detailUrl}/artifacts/${hypothesis.id}`, { headers: auth })).json();
  assert.equal(artifact.content.hypotheses[0].statement, 'Fixture');
  const review = {
    attentionId: detail.attention.find((item) => item.status === 'open').id,
    expectedVersion: detail.version,
    action: 'approve', reason: 'Fixture reviewed in the Research Desk',
  };
  const post = { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify(review) };
  assert.equal((await request(`${detailUrl}/respond`, { ...post, headers: { 'content-type': 'application/json' } })).status, 401);
  const approval = await request(`${detailUrl}/respond`, post);
  assert.equal(approval.status, 200);
  assert.equal((await approval.json()).stage, 'pathway');
  assert.equal((await request(`${detailUrl}/respond`, post)).status, 409);

  task = await cli('advance', { taskId: task.id });
  task = await submit(task, { product: 'Fixture', steps: [{ transformation: 'Fixture step', enzyme_class: 'Fixture class' }] });
  task = await cli('advance', { taskId: task.id });
  try {
    const job = task.assignments.at(-1);
    assert.equal(task.status, 'running');
    const running = await (await request(detailUrl, { headers: auth })).json();
    assert.equal(running.assignments.at(-1).canCancel, true);
    const cancelUrl = `${detailUrl}/jobs/${job.jobId}/cancel`;
    const stop = { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ expectedVersion: running.version }) };
    assert.equal((await request(cancelUrl, { ...stop, headers: { 'content-type': 'application/json' } })).status, 401);
    assert.equal((await request(`${detailUrl}/jobs/job_20200101000000_unknown0/cancel`, stop)).status, 409);
    const cancellation = await request(cancelUrl, stop);
    assert.equal(cancellation.status, 200);
    const cancelled = await cancellation.json();
    assert.equal(cancelled.status, 'waiting');
    assert.equal(cancelled.waitingReason, 'execution_cancelled');
    assert.equal(cancelled.stage, 'discovery');
    assert.equal(cancelled.assignments.length, 1);
    assert.equal(cancelled.assignments[0].status, 'cancelled');
    assert.equal(cancelled.assignments[0].canCancel, false);
    assert.equal(cancelled.assignments[0].canRetry, true);
    assert.equal(cancelled.artifacts.some((entry) => entry.stage === 'hypothesis'), true);
    const retry = cancelled.attention.find((entry) => entry.status === 'open' && entry.kind === 'execution_cancelled');
    assert.ok(retry?.allowedActions.includes('retry'));
    assert.equal((await request(cancelUrl, stop)).status, 409);

    const retryUrl = `${detailUrl}/jobs/${job.jobId}/retry`;
    const retryPost = (version) => ({ ...stop, body: JSON.stringify({ expectedVersion: version }) });
    const retryStopped = retryPost(cancelled.version);
    assert.equal((await request(retryUrl, { ...retryStopped, headers: { 'content-type': 'application/json' } })).status, 401);
    const attempts = await Promise.all([request(retryUrl, retryStopped), request(retryUrl, retryStopped)]);
    assert.deepEqual(attempts.map((entry) => entry.status).sort(), [200, 409]);
    const restarted = await attempts.find((entry) => entry.ok).json();
    assert.equal(restarted.assignments.length, 2);
    assert.equal(restarted.assignments[0].status, 'cancelled');
    const replacement = restarted.assignments.at(-1);
    assert.notEqual(replacement.jobId, job.jobId);
    assert.equal(replacement.retryOf, job.id);
    assert.equal(replacement.queryRevision, job.queryRevision);

    // Check a failed engine job before the controller has observed it.
    let failed;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      failed = await (await request(detailUrl, { headers: auth })).json();
      if (failed.assignments.at(-1).status === 'failed') break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal(failed.assignments.at(-1).status, 'failed');
    assert.equal(failed.assignments.at(-1).canRetry, true);
    assert.equal((await request(retryUrl, retryPost(failed.version))).status, 409);
    const retryFailed = await request(`${detailUrl}/jobs/${replacement.jobId}/retry`, retryPost(failed.version));
    assert.equal(retryFailed.status, 200);
    const third = await retryFailed.json();
    assert.equal(third.assignments.length, 3);
    assert.equal(third.assignments[1].status, 'failed');
    const current = third.assignments.at(-1);
    assert.equal(current.retryOf, replacement.id);
    const stopThird = await request(`${detailUrl}/jobs/${current.jobId}/cancel`, retryPost(third.version));
    assert.equal(stopThird.status, 200);
    const exhausted = await stopThird.json();
    assert.equal(exhausted.assignments.at(-1).status, 'cancelled');
    assert.equal(exhausted.assignments.at(-1).canRetry, false);
    assert.equal(exhausted.assignments.at(-1).retryUnavailable, 'budget_exhausted');
    assert.equal((await request(`${detailUrl}/jobs/${current.jobId}/retry`, retryPost(exhausted.version))).status, 409);
    assert.equal(exhausted.canCancelTask, true);
    const cancelTaskUrl = `${detailUrl}/cancel`;
    const close = (version) => ({ ...stop, body: JSON.stringify({ expectedVersion: version, reason: 'End the waiting test task.' }) });
    assert.equal((await request(cancelTaskUrl, { ...close(exhausted.version), headers: { 'content-type': 'application/json' } })).status, 401);
    assert.equal((await request(cancelTaskUrl, close(exhausted.version - 1))).status, 409);
    const closedResponse = await request(cancelTaskUrl, close(exhausted.version));
    assert.equal(closedResponse.status, 200);
    const closed = await closedResponse.json();
    assert.equal(closed.status, 'cancelled');
    assert.equal(closed.canCancelTask, false);
    assert.deepEqual(closed.assignments.map((entry) => entry.jobId), exhausted.assignments.map((entry) => entry.jobId));
    assert.equal(closed.attention.some((entry) => entry.status === 'open'), false);
    assert.deepEqual(closed.artifacts, exhausted.artifacts);
  } finally {
    await cli('cancel', { taskId: task.id, reason: 'Clean up fixture' });
  }
}

async function verifyAfpkStart(origin, token) {
  const api = `${origin}/api/v1/ariadne/research`;
  const auth = { authorization: `Bearer ${token}` };
  const request = (route, init = {}) => fetch(api + route, { signal: AbortSignal.timeout(45_000), ...init });
  const post = (route, body, headers = auth) => request(route, {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  await writeFile(afpkFixturePath, `#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const [operation, ...args] = process.argv.slice(3);
if (operation === '--version') {
  console.log('ariadne-afpk-ks fixture (pyhmmer fixture)');
  process.exit(0);
}
if (operation !== 'screen') process.exit(1);
const option = (flag) => args[args.indexOf(flag) + 1];
const query = JSON.parse(readFileSync(option('--request-file'), 'utf8'));
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const scores = { fas_i: 500, fas_ii: 100, pks: 250 };
await new Promise((resolve) => setTimeout(resolve, 850));
writeFileSync(option('--output'), JSON.stringify({
  kind: 'ariadne.afpk-ks-report', schema_version: 1, method: 'three-profile-ks', window: query.fas_i_window,
  rows: [{ sequence_id: 'fixture', role: 'candidate', classification: 'putative_afpk', reason: 'Fixture scores', scores }],
  candidates: ['fixture'], summary: { screened: 1, nominated: 1 },
  software: { adapter: 'fixture', pyhmmer: 'fixture' },
  inputs: {
    'protein-input[0]': sha256(query.input_proteins[0]), 'ks-fas-i': sha256(query.ks_models.fas_i),
    'ks-fas-ii': sha256(query.ks_models.fas_ii), 'ks-pks': sha256(query.ks_models.pks),
  },
}));
`, { mode: 0o700 });

  await mkdir(path.join(temporaryRoot, 'afpk-inputs'));
  const inputProteins = ['afpk-inputs/fixture.faa'];
  const ksModels = { fasI: 'afpk-inputs/fas-i.hmm', fasII: 'afpk-inputs/fas-ii.hmm', pks: 'afpk-inputs/pks.hmm' };
  const window = { min: 400, max: 600 };
  const requestFile = 'afpk-inputs/request.json';
  await Promise.all([
    writeFile(path.join(temporaryRoot, inputProteins[0]), '>fixture\nMKV\n'),
    ...Object.values(ksModels).map((file) => writeFile(path.join(temporaryRoot, file), 'model fixture')),
    writeFile(path.join(temporaryRoot, requestFile), JSON.stringify({
      workflow: 'afpk-ks', input_proteins: inputProteins, fas_i_window: window,
      ks_models: { fas_i: ksModels.fasI, fas_ii: ksModels.fasII, pks: ksModels.pks },
    })),
    symlink(fileURLToPath(import.meta.url), path.join(temporaryRoot, 'afpk-inputs', 'linked.faa')),
  ]);
  const catalog = await request('/afpk/inputs', { headers: auth });
  assert.equal(catalog.status, 200);
  const { files, requests } = await catalog.json();
  assert.ok(requests.some((file) => file.path === requestFile));
  assert.ok(files.proteins.some((file) => file.path === inputProteins[0]));
  assert.ok(!files.proteins.some((file) => file.path.endsWith('linked.faa')));
  for (const target of Object.values(ksModels)) assert.ok(files.models.some((file) => file.path === target));

  const registration = { requestId: 'web-afpk-smoke', objective: 'Review a local AFPK fixture' };
  const body = { ...registration, inputProteins, ksModels, window };
  assert.equal((await post('/afpk/start', body, {})).status, 401);
  const invalid = await post('/afpk/start', { ...body, inputProteins: ['../outside.faa'] });
  assert.ok(!invalid.ok);
  const escaped = await post('/afpk/start', { ...body, inputProteins: ['afpk-inputs/linked.faa'] });
  assert.ok(!escaped.ok);
  const started = await post('/afpk/start', body);
  assert.ok(started.ok, await started.clone().text());
  const created = await started.json();
  assert.equal(created.workflow, 'afpk-ks');
  const repeat = await post('/afpk/start', { ...registration, requestFile });
  assert.ok(repeat.ok, await repeat.clone().text());
  assert.equal((await repeat.json()).id, created.id);

  const taskRoute = `/${created.id}`;
  let detail;
  let observedProgress = ['open', 'running'].includes(created.status);
  for (let attempt = 0; attempt < 120; attempt += 1) {
    detail = await (await request(taskRoute, { headers: auth })).json();
    if (['open', 'running'].includes(detail.status)) observedProgress = true;
    else break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(observedProgress, 'AFPK launch exposes progress before review');
  assert.equal(detail.status, 'waiting', JSON.stringify(detail.attention));
  assert.equal(detail.waitingReason, 'afpk_nomination_review');
  assert.deepEqual(detail.assignments.map((job) => job.status), ['succeeded']);
  const artifact = await request(`${taskRoute}/artifacts/${detail.afpkEvidence.artifactId}`, { headers: auth });
  assert.equal(artifact.status, 200);
  assert.equal((await artifact.json()).content.rows[0].scores.fas_i, 500);
  const approval = await post(`${taskRoute}/respond`, {
    expectedVersion: detail.version, attentionId: detail.afpkEvidence.attentionId,
    action: 'approve', reason: 'Reviewed within the fixture Desk',
  });
  assert.equal(approval.status, 200);
  assert.equal((await approval.json()).status, 'ready');
}

function assertFile(filePath, label) {
  if (!existsSync(filePath)) throw new Error(`${label} is missing: ${filePath}`);
}

async function waitForServerUrl(server, chunks, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const text = chunks.join('');
    const match = /Local:\s+(http:\/\/\S+)/.exec(text);
    if (match?.[1] !== undefined) return match[1];
    if (server.exitCode !== null || server.signalCode !== null) {
      throw new Error(
        `web server exited before startup (code=${String(server.exitCode)}, signal=${String(server.signalCode)})`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`web server did not become ready within ${String(timeoutMs)}ms`);
}

async function stopChild(server) {
  if (server.exitCode !== null || server.signalCode !== null) return;
  server.kill('SIGTERM');
  const exited = await Promise.race([
    new Promise((resolve) => server.once('exit', () => resolve(true))),
    new Promise((resolve) => setTimeout(() => resolve(false), 5_000)),
  ]);
  if (!exited && server.exitCode === null && server.signalCode === null) {
    server.kill('SIGKILL');
    await Promise.race([
      new Promise((resolve) => server.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
  }
}

function redact(text) {
  return text.replace(/(#token=)[^\s]+/g, '$1<redacted>');
}
