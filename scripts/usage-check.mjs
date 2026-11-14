#!/usr/bin/env node
// Daily Cloudflare free-tier usage check with threshold alert issues.
//
// Env inputs (never printed, never written to disk by this script):
//   CF_API_TOKEN, CF_ACCOUNT_ID   - usage fetch
//   GITHUB_TOKEN / GH_TOKEN       - gh CLI (issue create), only outside --dry-run
//
// Usage:
//   node scripts/usage-check.mjs --dry-run   fetch + print usage, create no issue
//   node scripts/usage-check.mjs             fetch + create one alert issue per day per metric
//
// Exit codes: 0 ok, 2 usage fetch failed, 3 gh issue step failed.
//
// Endpoint fallback chain (probed in order, first success wins):
//   1. graphql-account  - Cloudflare GraphQL Analytics, account datasets
//                         (workersInvocationsAdaptive, pagesFunctionsInvocationsAdaptiveGroups,
//                          kvOperationsAdaptiveGroups, r2OperationsAdaptiveGroups)
//   2. graphql-core     - same, without the R2 dataset (in case R2 dataset is unavailable)
//   3. graphql-zone     - zone-level workersZoneInvocationsAdaptiveGroups (workers only)
//   4. rest-*           - REST probes (account insights, zone analytics); with account-owned
//                         tokens these are expected to fail and the script exits 2 rather
//                         than reporting wrong numbers.

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://api.cloudflare.com/client/v4';

/** Free-tier limits and alert thresholds (alert when used > threshold). */
export const METRICS = Object.freeze([
  { key: 'workers-requests', label: 'Workers requests/day', limit: 100_000, threshold: 70_000 },
  { key: 'kv-reads', label: 'KV reads/day', limit: 100_000, threshold: 70_000 },
  { key: 'kv-writes', label: 'KV writes/day', limit: 1_000, threshold: 700 },
  { key: 'r2-class-a', label: 'R2 Class A ops/day', limit: 1_000_000, threshold: 700_000 },
]);

const CLASS_A = new Set([
  'listbuckets', 'putbucket', 'listobjects', 'putobject', 'copyobject',
  'completemultipartupload', 'createmultipartupload',
  'lifecyclestoragetiertransition', 'listmultipartuploads', 'uploadpart',
  'uploadpartcopy', 'listparts', 'putbucketencryption', 'putbucketcors',
  'putbucketlifecycleconfiguration',
]);
const CLASS_B = new Set([
  'headbucket', 'headobject', 'getobject', 'usagesummary', 'getbucketencryption',
  'getbucketlocation', 'getbucketcors', 'getbucketlifecycleconfiguration',
]);
const CLASS_FREE = new Set(['deleteobject', 'deletebucket', 'abortmultipartupload']);

/** Classify an R2 actionType into 'a' | 'b' | 'free'. Unknown types count as Class A (conservative). */
export function classifyR2Action(actionType) {
  const norm = String(actionType ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (CLASS_B.has(norm)) return 'b';
  if (CLASS_FREE.has(norm)) return 'free';
  return 'a';
}

/** Aggregate kvOperations groups: actionType 'read' -> reads, anything else -> writes (conservative). */
export function kvCounts(groups) {
  let reads = 0;
  let writes = 0;
  for (const g of groups ?? []) {
    const n = Number(g?.sum?.requests ?? 0);
    if (String(g?.dimensions?.actionType ?? '').toLowerCase() === 'read') reads += n;
    else writes += n;
  }
  return { reads, writes };
}

/** Sum R2 groups into Class A op count. */
export function r2ClassACount(groups) {
  let total = 0;
  for (const g of groups ?? []) {
    if (classifyR2Action(g?.dimensions?.actionType) !== 'a') continue;
    total += Number(g?.sum?.requests ?? 0);
  }
  return total;
}

function sumRequests(groups) {
  let total = 0;
  for (const g of groups ?? []) total += Number(g?.sum?.requests ?? 0);
  return total;
}

/**
 * Metrics strictly over their alert threshold.
 * @param {Record<string, number|null>} usage value per metric key; null/undefined = no data
 */
export function evaluateUsage(usage, metrics = METRICS) {
  return metrics
    .filter((m) => typeof usage[m.key] === 'number' && usage[m.key] > m.threshold)
    .map((m) => ({
      ...m,
      value: usage[m.key],
      percent: Math.round((usage[m.key] / m.limit) * 100),
    }));
}

/** Deterministic issue title (also the dedup key via metric key substring match). */
export function buildIssueTitle(alerts, now = new Date()) {
  const date = now.toISOString().slice(0, 10);
  const parts = alerts.map((a) => `${a.key} ${a.value.toLocaleString('en-US')}/${a.limit.toLocaleString('en-US')} (${a.percent}%)`);
  return `Cloudflare free-tier usage ${date}: ${parts.join(', ')}`;
}

/** Alerts not yet covered by an issue created today (UTC). */
export function pendingAlerts(alerts, existingIssues, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const covered = new Set();
  for (const iss of existingIssues ?? []) {
    const created = String(iss?.createdAt ?? '').slice(0, 10);
    if (created !== today) continue;
    for (const a of alerts) {
      if (String(iss?.title ?? '').includes(a.key)) covered.add(a.key);
    }
  }
  return alerts.filter((a) => !covered.has(a.key));
}

export function buildIssueBody(usage, alerts, source, since, now = new Date()) {
  const rows = METRICS.map((m) => {
    const v = usage[m.key];
    const used = typeof v === 'number' ? v.toLocaleString('en-US') : 'n/a (no data)';
    const hit = alerts.some((a) => a.key === m.key) ? 'OVER' : 'ok';
    return `| ${m.key} | ${used} | ${m.threshold.toLocaleString('en-US')} | ${m.limit.toLocaleString('en-US')} | ${hit} |`;
  });
  return [
    'Automated daily check of Cloudflare free-tier usage (UTC day).',
    '',
    '| Metric | Used | Alert threshold | Free limit | Status |',
    '|---|---:|---:|---:|---|',
    ...rows,
    '',
    `Source endpoint: ${source} (Cloudflare Analytics).`,
    `Window: ${since.toISOString()} -> ${now.toISOString()}.`,
    '',
    'Review plan options in the Cloudflare dashboard before the limits are hit.',
  ].join('\n');
}

// ---------------------------------------------------------------- fetch chain

async function gqlRequest(token, query, variables) {
  const res = await fetch(`${API}/graphql`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`graphql HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(`graphql: ${json.errors[0].message}`);
  return json.data;
}

const QUERY_ALL = `
query ($acct: string!, $since: Time!) {
  viewer {
    accounts(filter: { accountTag: $acct }) {
      workers: workersInvocationsAdaptive(filter: { datetime_geq: $since }, limit: 1000) {
        sum { requests }
      }
      pages: pagesFunctionsInvocationsAdaptiveGroups(filter: { datetime_geq: $since }, limit: 1000) {
        sum { requests }
      }
      kv: kvOperationsAdaptiveGroups(filter: { datetime_geq: $since }, limit: 1000) {
        dimensions { actionType }
        sum { requests }
      }
      r2: r2OperationsAdaptiveGroups(filter: { datetime_geq: $since }, limit: 1000) {
        dimensions { actionType }
        sum { requests }
      }
    }
  }
}`;

const QUERY_CORE = `
query ($acct: string!, $since: Time!) {
  viewer {
    accounts(filter: { accountTag: $acct }) {
      workers: workersInvocationsAdaptive(filter: { datetime_geq: $since }, limit: 1000) {
        sum { requests }
      }
      pages: pagesFunctionsInvocationsAdaptiveGroups(filter: { datetime_geq: $since }, limit: 1000) {
        sum { requests }
      }
      kv: kvOperationsAdaptiveGroups(filter: { datetime_geq: $since }, limit: 1000) {
        dimensions { actionType }
        sum { requests }
      }
    }
  }
}`;

const QUERY_ZONE = `
query ($since: Time!) {
  viewer {
    zones {
      zoneTag
      workersZoneInvocationsAdaptiveGroups(filter: { datetime_geq: $since }, limit: 1000) {
        sum { requests }
      }
    }
  }
}`;

function usageFromAccount(data, withR2) {
  const acct = data?.viewer?.accounts?.[0];
  if (!acct) throw new Error('graphql: no account in response');
  const { reads, writes } = kvCounts(acct.kv);
  const usage = {
    'workers-requests': sumRequests(acct.workers) + sumRequests(acct.pages),
    'kv-reads': reads,
    'kv-writes': writes,
    'r2-class-a': null,
  };
  if (withR2) usage['r2-class-a'] = acct.r2?.length ? r2ClassACount(acct.r2) : null;
  return usage;
}

async function fetchGraphQLAccount({ token, accountId, since, attempts }) {
  try {
    const data = await gqlRequest(token, QUERY_ALL, { acct: accountId, since });
    return { usage: usageFromAccount(data, true), source: 'graphql-account' };
  } catch (e) {
    attempts.push(`graphql-account: ${e.message}`);
  }
  try {
    const data = await gqlRequest(token, QUERY_CORE, { acct: accountId, since });
    return { usage: usageFromAccount(data, false), source: 'graphql-core (no R2 dataset)' };
  } catch (e) {
    attempts.push(`graphql-core: ${e.message}`);
  }
  return null;
}

async function fetchGraphQLZone({ token, since, attempts }) {
  try {
    const data = await gqlRequest(token, QUERY_ZONE, { since });
    let workers = 0;
    for (const z of data?.viewer?.zones ?? []) workers += sumRequests(z.workersZoneInvocationsAdaptiveGroups);
    return {
      usage: { 'workers-requests': workers, 'kv-reads': null, 'kv-writes': null, 'r2-class-a': null },
      source: 'graphql-zone',
      notes: ['zone fallback: KV/R2 metrics unavailable'],
    };
  } catch (e) {
    attempts.push(`graphql-zone: ${e.message}`);
    return null;
  }
}

async function fetchRestProbes({ token, accountId, attempts }) {
  // Probe 1: account insights (expected: no route with account-owned tokens).
  try {
    const res = await fetch(
      `${API}/accounts/${accountId}/insights/granularity/daily?since=${encodeURIComponent(
        '-1d',
      )}&fields=threatAction`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    attempts.push(`rest-account-insights: HTTP ${res.status}`);
  } catch (e) {
    attempts.push(`rest-account-insights: ${e.message}`);
  }
  // Probe 2: zone analytics dashboard (expected: account-owned token rejected, code 1016).
  try {
    const zres = await fetch(`${API}/zones?per_page=1`, { headers: { authorization: `Bearer ${token}` } });
    const zjson = await zres.json().catch(() => null);
    const zoneId = zjson?.result?.[0]?.id;
    if (zoneId) {
      const stop = new Date();
      const start = new Date(stop.getTime() - 86400000);
      const res = await fetch(
        `${API}/zones/${zoneId}/analytics/dashboard?since=${start.toISOString()}&stop=${stop.toISOString()}`,
        { headers: { authorization: `Bearer ${token}` } },
      );
      attempts.push(`rest-zone-analytics: HTTP ${res.status}`);
    } else {
      attempts.push('rest-zone-analytics: no zone id');
    }
  } catch (e) {
    attempts.push(`rest-zone-analytics: ${e.message}`);
  }
  return null;
}

/** Run the endpoint chain; throw AggregateError-style Error if every source fails. */
export async function fetchUsageWithFallback({ token, accountId, since }) {
  const attempts = [];
  const ctx = { token, accountId, since, attempts };
  const result =
    (await fetchGraphQLAccount(ctx)) || (await fetchGraphQLZone(ctx)) || (await fetchRestProbes(ctx));
  if (!result) throw new Error(`all usage endpoints failed -> ${attempts.join(' | ')}`);
  return { ...result, attempts };
}

// ---------------------------------------------------------------- issue via gh

function gh(args, tokenHint) {
  const r = spawnSync('gh', args, { encoding: 'utf8', env: process.env });
  if (r.error) throw new Error(`gh not runnable: ${r.error.message}`);
  if (r.status !== 0) {
    const tail = String(r.stderr || r.stdout || '').trim().split('\n').slice(-3).join(' / ');
    throw new Error(`gh ${args[0]} ${args[1] ?? ''} failed (${r.status}): ${tail}${tokenHint ? ` [${tokenHint}]` : ''}`);
  }
  return String(r.stdout || '').trim();
}

function ensureLabel() {
  // Idempotent: --force updates the label if it already exists.
  try {
    gh(['label', 'create', 'usage-alert', '--color', 'd73a4a', '--description', 'Automated free-tier usage alerts', '--force']);
  } catch {
    // Non-fatal here; issue create will fail loudly if the label cannot be resolved.
  }
}

function listAlertIssues() {
  const out = gh(['issue', 'list', '--label', 'usage-alert', '--state', 'all', '--json', 'number,title,createdAt', '--limit', '200']);
  try {
    return JSON.parse(out);
  } catch {
    throw new Error('gh issue list returned non-JSON output');
  }
}

// ---------------------------------------------------------------- main

function fmt(n) {
  return typeof n === 'number' ? n.toLocaleString('en-US') : 'n/a';
}

function printUsage(usage, source, since, notes = []) {
  console.log(`source: ${source}`);
  console.log(`window: ${since.toISOString()} -> ${new Date().toISOString()} (UTC day so far)`);
  console.log('metric              used          threshold   limit        status');
  for (const m of METRICS) {
    const v = usage[m.key];
    const status = typeof v !== 'number' ? 'no data' : v > m.threshold ? 'OVER' : 'ok';
    console.log(
      `${m.key.padEnd(19)} ${fmt(v).padEnd(13)} ${fmt(m.threshold).padEnd(11)} ${fmt(m.limit).padEnd(12)} ${status}`,
    );
  }
  for (const n of notes) console.log(`note: ${n}`);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const token = process.env.CF_API_TOKEN;
  const accountId = process.env.CF_ACCOUNT_ID;
  if (!token || !accountId) {
    console.error('[usage-check] missing CF_API_TOKEN or CF_ACCOUNT_ID env');
    process.exit(2);
  }
  const since = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));

  let result;
  try {
    result = await fetchUsageWithFallback({ token, accountId, since });
  } catch (e) {
    console.error(`[usage-check] usage fetch failed: ${e.message}`);
    process.exit(2);
  }

  printUsage(result.usage, result.source, since, result.notes);
  const alerts = evaluateUsage(result.usage);
  if (!alerts.length) {
    console.log('[usage-check] no metric over alert threshold');
    return;
  }
  console.log(`[usage-check] over threshold: ${alerts.map((a) => a.key).join(', ')}`);

  if (dryRun) {
    console.log(`[usage-check] dry-run, would create issue: "${buildIssueTitle(alerts)}"`);
    return;
  }

  let pending;
  try {
    ensureLabel();
    pending = pendingAlerts(alerts, listAlertIssues());
  } catch (e) {
    console.error(`[usage-check] issue step failed: ${e.message}`);
    process.exit(3);
  }
  if (!pending.length) {
    console.log('[usage-check] alert issue already created today for these metrics, leaving as-is');
    return;
  }
  const title = buildIssueTitle(pending);
  const body = buildIssueBody(result.usage, pending, result.source, since);
  try {
    const url = gh(['issue', 'create', '--label', 'usage-alert', '--title', title, '--body', body]);
    console.log(`[usage-check] created: ${url}`);
  } catch (e) {
    console.error(`[usage-check] issue create failed: ${e.message}`);
    process.exit(3);
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((e) => {
    console.error(`[usage-check] fatal: ${e.message}`);
    process.exit(2);
  });
}
