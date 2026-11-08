#!/usr/bin/env node

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = path.resolve(process.argv[2] ?? path.join(packageRoot, 'dist', 'mcp-server.mjs'));
const scratch = mkdtempSync(path.join(tmpdir(), 'ariadne-mcp-smoke-'));
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [entry],
  env: {
    ...process.env,
    ARIADNE_HOME: path.join(scratch, 'home'),
    ARIADNE_JOBS_DIR: path.join(scratch, 'jobs'),
    ARIADNE_WORKDIR: scratch,
    ARIADNE_COMMAND: '',
    ARIADNE_REPO: '',
  },
});
const client = new Client({ name: 'ariadne-mcp-smoke', version: '1.0.0' });

try {
  await client.connect(transport);
  const catalog = await client.listTools();
  assert(catalog.tools.length === 21, `expected 21 tools, found ${String(catalog.tools.length)}`);
  assert(
    new Set(catalog.tools.map((tool) => tool.name)).size === catalog.tools.length,
    'tool names are not unique',
  );
  const status = catalog.tools.find((tool) => tool.name === 'ariadne_status');
  assert(status?.annotations?.readOnlyHint === true, 'status tool lacks read-only annotation');
  const audit = catalog.tools.find((tool) => tool.name === 'ariadne_audit_nomination');
  assert(audit?.annotations?.idempotentHint === true, 'nomination audit lacks idempotent annotation');
  const cancel = catalog.tools.find((tool) => tool.name === 'ariadne_job_cancel');
  assert(cancel?.annotations?.destructiveHint === true, 'cancel tool lacks destructive annotation');
  const manifest = catalog.tools.find((tool) => tool.name === 'ariadne_job_manifest');
  assert(manifest?.annotations?.readOnlyHint === true, 'manifest tool lacks read-only annotation');
  for (const name of ['status', 'list']) {
    const tool = catalog.tools.find((item) => item.name === `ariadne_research_${name}`);
    assert(tool?.annotations?.readOnlyHint === true, `research ${name} lacks read-only annotation`);
  }
  for (const name of ['create', 'advance', 'respond', 'cancel']) {
    const tool = catalog.tools.find((item) => item.name === `ariadne_research_${name}`);
    assert(tool?.annotations?.readOnlyHint === false, `research ${name} must declare writes`);
  }

  const jobs = await client.callTool({ name: 'ariadne_job_list', arguments: {} });
  const jobsText = jobs.content.find((item) => item.type === 'text')?.text ?? '';
  assert(jobsText.includes('"total": 0'), `unexpected empty job list: ${jobsText}`);

  const engineStatus = await client.callTool({ name: 'ariadne_status', arguments: {} });
  assert(engineStatus.content.some((item) => item.type === 'text'), 'status tool returned no text content');

  const requestTarget = path.join(scratch, 'nomination-request.json');
  writeFileSync(requestTarget, JSON.stringify({
    target_class: 'cembrene-class TPS (CeeSs)',
    input_proteins: ['proteins.faa'],
    query_hmm: 'query.hmm',
    reference_dir: 'references',
  }));
  const request = {
    requestId: 'mcp-smoke-ceess-nomination',
    objective: 'Nominate CeeSs candidates from coral transcriptomes',
    requestFile: requestTarget,
  };
  const created = payload(await client.callTool({ name: 'ariadne_research_create', arguments: request }));
  assert(/^research_[a-f0-9]{24}$/.test(created.id), 'research task id is invalid');
  assert(created.version === 1 && created.status === 'open', 'creation unexpectedly advanced research');
  assert(created.assignments.length === 0, 'creation launched an assignment without advance');
  const duplicate = payload(await client.callTool({ name: 'ariadne_research_create', arguments: request }));
  assert(duplicate.id === created.id && duplicate.version === created.version, 'repeated request is not idempotent');
  const recovered = payload(await client.callTool({
    name: 'ariadne_research_status', arguments: { taskId: created.id },
  }));
  assert(recovered.id === created.id && recovered.version === created.version, 'status did not recover the same research task');
  const listed = payload(await client.callTool({ name: 'ariadne_research_list', arguments: {} }));
  assert(listed.returned === 1 && listed.tasks[0]?.id === created.id, 'research list did not recover the registered task');
  writeFileSync(requestTarget, JSON.stringify({
    target_class: 'insect TPS',
    input_proteins: ['proteins.faa'],
    query_hmm: 'query.hmm',
    reference_dir: 'references',
  }));
  const conflict = await client.callTool({ name: 'ariadne_research_create', arguments: request });
  assert(conflict.isError === true, 'a changed input reused the original request id');
  let unknownRejected = false;
  try {
    const invalid = await client.callTool({
      name: 'ariadne_research_create',
      arguments: { ...request, requestId: 'mcp-smoke-unknown-parameter', maxJbos: 1 },
    });
    unknownRejected = invalid.isError === true;
  } catch {
    unknownRejected = true;
  }
  assert(unknownRejected, 'research creation silently discarded an unknown budget parameter');
  const unchanged = payload(await client.callTool({ name: 'ariadne_research_list', arguments: {} }));
  assert(unchanged.returned === 1, 'rejected research input nevertheless registered a task');
  const after = payload(await client.callTool({ name: 'ariadne_job_list', arguments: {} }));
  assert(after.total === 0, 'research registration or status unexpectedly launched a backend job');

  process.stdout.write('MCP smoke: 21 tools, annotations, research registration/recovery/idempotence, and job dispatch verified\n');
} finally {
  await client.close().catch(() => undefined);
  rmSync(scratch, { recursive: true, force: true });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function payload(result) {
  assert(result.isError !== true, `MCP tool failed: ${JSON.stringify(result.content)}`);
  const text = result.content.find((item) => item.type === 'text')?.text;
  assert(typeof text === 'string', 'MCP tool returned no JSON text');
  return JSON.parse(text);
}
