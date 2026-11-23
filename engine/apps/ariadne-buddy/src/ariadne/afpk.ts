import { readFileSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import { findPackageRoot, resolveUserPath } from '../paths';
import { findOnPath, type AriadneBackend } from './backend';

export const AFPK_WORKFLOW = 'afpk-ks';
export const AFPK_OPERATION = 'afpk-ks-screen';
export const AFPK_TOOL = 'ariadne_research_afpk_ks';

const input = z.string().trim().min(1).max(8_192);
const sequenceId = z.string().min(1).max(512).regex(/^\S+$/);
const models = ['fas_i', 'fas_ii', 'pks'] as const;
const window = z.strictObject({ min: z.number().finite(), max: z.number().finite() })
  .refine((value) => value.min <= value.max, 'FAS I window min must be at most max.');
export const afpkRequest = z.strictObject({
  workflow: z.literal(AFPK_WORKFLOW),
  input_proteins: z.array(input).min(1).max(32),
  ks_models: z.strictObject({ fas_i: input, fas_ii: input, pks: input }),
  fas_i_window: window,
  reference_anchors: z.array(sequenceId).max(16)
    .refine((ids) => new Set(ids).size === ids.length, 'Anchor IDs must be unique.').optional(),
  afpk_finder_files: z.array(input).max(16).optional(),
  run_afpk_finder: z.boolean().optional(),
  published_ks_scores_file: input.optional(),
  context: z.string().max(8_000).optional(),
});

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const bitScore = z.number().finite().nullable();
const bitScores = z.strictObject({ fas_i: bitScore, fas_ii: bitScore, pks: bitScore });
export const finderIdentity = z.object({
  release: z.literal('v1.0'),
  installation_sha256: sha256,
  runner_sha256: sha256,
  seed: z.number().int(),
  environment: z.object({
    bash: z.string().min(1), hmmer: z.string().min(1), prodigal: z.string().min(1), r: z.string().min(1),
    r_packages: z.object({ Rtsne: z.string().min(1), dbscan: z.string().min(1), ggplot2: z.string().min(1), getopt: z.string().min(1) }),
  }),
});
const perplexity = z.number().int().positive();
const tally = z.number().int().nonnegative();
const finderRun = finderIdentity.extend({
  prepared_input_sha256: sha256,
  runs: z.array(z.object({
    perplexity, table_sha256: sha256, summary_sha256: sha256, matched: tally, clustered: tally, noise: tally, missing: tally,
  })).min(1).max(16),
});
const report = z.object({
  kind: z.literal('ariadne.afpk-ks-report'),
  schema_version: z.literal(1),
  method: z.literal('three-profile-ks'),
  window,
  rows: z.array(z.object({
    sequence_id: sequenceId,
    scores: bitScores,
    published_ks_scores: bitScores.optional(),
    classification: z.enum(['putative_afpk', 'fas_i', 'fas_ii', 'pks', 'unresolved']),
    role: z.enum(['candidate', 'anchor']),
    reason: z.string().min(1),
    afpk_finder: z.array(z.object({
      source: z.string().regex(/^afpk-finder-output\[\d+\]$/),
      cluster: z.number().int().nonnegative(),
      clade: z.string().min(1),
      x: z.number().finite().optional(),
      y: z.number().finite().optional(),
      membership: z.string().optional(),
    })).max(16).optional(),
    afpk_finder_run: z.array(z.object({
      perplexity,
      status: z.enum(['clustered', 'noise', 'missing']),
      cluster: tally.optional(), x: z.number().finite().optional(), y: z.number().finite().optional(),
      clade: z.string().optional(), length: z.number().int().positive().optional(),
      memberships: z.array(z.object({
        clade: z.string().min(1), in_cluster: tally, training_total: z.number().int().positive(), percentage: z.number().min(0).max(100),
      })).optional(),
    })).max(16).optional(),
  })).min(1).max(2_000),
  candidates: z.array(sequenceId).max(2_000),
  summary: z.object({ screened: z.number().int().positive(), nominated: z.number().int().nonnegative() }),
  inputs: z.record(z.string(), sha256),
  software: z.object({ adapter: z.string().min(1), pyhmmer: z.string().min(1) }),
  published_ks_source: z.object({ doi: z.string().min(1), figure: z.string().min(1) }).optional(),
  original_afpk_finder: finderRun.optional(),
});

export function validateAfpkReport(value: Record<string, unknown>, inputValue: unknown) {
  const parsed = report.parse(value);
  const request = afpkRequest.parse(inputValue);
  if (parsed.window.min !== request.fas_i_window.min || parsed.window.max !== request.fas_i_window.max) {
    throw new Error('AFPK score window differs from the frozen request.');
  }
  const anchors = new Set(request.reference_anchors);
  const seen = new Set<string>();
  const nominated = new Set<string>();
  for (const row of parsed.rows) {
    if (seen.has(row.sequence_id)) throw new Error('AFPK report contains duplicate sequence IDs.');
    seen.add(row.sequence_id);
    const anchor = anchors.delete(row.sequence_id);
    if ((row.role === 'anchor') !== anchor) throw new Error('AFPK report does not match the declared anchor IDs.');
    const { fas_i: fasI } = row.scores;
    const winner = models.find((model) => {
      const score = row.scores[model];
      return score !== null && models.every((other) => {
        const comparison = row.scores[other];
        return model === other || (comparison !== null && score > comparison);
      });
    });
    const inWindow = fasI !== null && fasI >= parsed.window.min && fasI <= parsed.window.max;
    const classification = winner === 'fas_i' && inWindow ? 'putative_afpk' : (winner ?? 'unresolved');
    if (row.classification !== classification) throw new Error('AFPK classification differs from the reported KS scores.');
    const externalSources = row.afpk_finder?.map((entry) => entry.source) ?? [];
    if (new Set(externalSources).size !== externalSources.length || externalSources.some((source) => !Object.hasOwn(parsed.inputs, source))) {
      throw new Error('AFPK-finder evidence does not match the declared external input files.');
    }
    if (!anchor && classification === 'putative_afpk') nominated.add(row.sequence_id);
  }
  if (anchors.size > 0 || !parsed.candidates.every((id) => nominated.delete(id)) || nominated.size > 0 ||
      parsed.summary.nominated !== parsed.candidates.length || parsed.summary.screened !== parsed.rows.length) {
    throw new Error('AFPK report anchor, shortlist, or summary counts are inconsistent.');
  }
  if ((request.run_afpk_finder === true) !== (parsed.original_afpk_finder !== undefined)) {
    throw new Error('The report does not match the frozen original AFPK-finder run request.');
  }
  if ((request.published_ks_scores_file !== undefined) !== (parsed.published_ks_source !== undefined) ||
      (parsed.published_ks_source !== undefined) !== parsed.rows.some((row) => row.published_ks_scores !== undefined)) {
    throw new Error('Published KS scores do not match the comparison request.');
  }
  const runs = parsed.original_afpk_finder?.runs;
  if (runs !== undefined) {
    const runIds = new Set(runs.map((run) => run.perplexity));
    if (runIds.size !== runs.length || parsed.rows.some((row) => {
      const annotations = row.afpk_finder_run;
      return annotations?.length !== runs.length || new Set(annotations.map((entry) => entry.perplexity)).size !== runs.length ||
        annotations.some((entry) => !runIds.has(entry.perplexity) ||
          (entry.status === 'missing' ? entry.cluster !== undefined : entry.cluster === undefined || (entry.cluster === 0) !== (entry.status === 'noise')));
    })) throw new Error('The original AFPK-finder evidence does not cover every input and perplexity.');
    for (const run of runs) {
      const observed = { clustered: 0, noise: 0, missing: 0 };
      for (const row of parsed.rows) observed[row.afpk_finder_run!.find((entry) => entry.perplexity === run.perplexity)!.status]++;
      if (observed.clustered !== run.clustered || observed.noise !== run.noise || observed.missing !== run.missing ||
          observed.clustered + observed.noise !== run.matched) throw new Error('Original AFPK-finder evidence counts are inconsistent.');
    }
  } else if (parsed.rows.some((row) => row.afpk_finder_run !== undefined)) {
    throw new Error('Fresh AFPK-finder row evidence requires its original run record.');
  }
  return parsed;
}

const finderConfig = z.strictObject({ python: input.optional(), repo: input.optional(), bin: input.optional() });

export function resolveAfpkRuntime(env: NodeJS.ProcessEnv, homeDir?: string) {
  let config: z.infer<typeof finderConfig> = {};
  if (homeDir !== undefined) {
    try {
      config = finderConfig.parse(JSON.parse(readFileSync(path.join(homeDir, 'afpk-finder.json'), 'utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Could not read the local afpk-finder.json settings.', { cause: error });
    }
  }
  const setting = (key: string, fallback: string | undefined): string | undefined => {
    const value = env[key]?.trim();
    return value === undefined || value === '' ? fallback : value;
  };
  const explicit = setting('ARIADNE_AFPK_PYTHON', config.python);
  const python = explicit
    ? findOnPath(explicit.startsWith('~') ? resolveUserPath(explicit) : explicit, env)
    : (findOnPath('python3', env) ?? findOnPath('python', env));
  const backend: AriadneBackend | undefined = python === undefined ? undefined : {
    command: [python, path.join(findPackageRoot(), 'backend', 'afpk_ks.py')],
    source: explicit ? 'configured AFPK Python' : 'local Python',
  };
  const repo = setting('ARIADNE_AFPK_FINDER_REPO', config.repo);
  const bin = setting('ARIADNE_AFPK_FINDER_BIN', config.bin);
  return { backend, finderArgs: repo ? ['--afpk-finder-repo', resolveUserPath(repo), ...(bin ? ['--afpk-finder-bin', resolveUserPath(bin)] : [])] : [] };
}
