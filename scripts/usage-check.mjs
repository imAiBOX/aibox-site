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
//   2. graphql-zone     - zone-level workersZoneInvocationsAdaptiveGroups (workers only)

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://api.cloudflare.com/client/v4';

/** Free-tier limits and alert thresholds (alert when used > threshold). */
export const METRICS = Object.freeze([
  { key: 'workers-requests', label: 'Workers requests/day', limit: 100_000, threshold: 70_000 },
  { key: 'kv-reads', label: 'KV reads/day', limit: 100_000, threshold: 70_000 },
  { key: 'kv-writes', label: 'KV writes/day', limit: 1_000, threshold: 700 },
]);

/** Aggregate kvOperations groups: actionType 'read' -> reads, anything else -> writes (conservative). */
export function kvCounts(groups) {
  if (!Array.isArray(groups) || groups.length === 0) return { reads: null, writes: null };
  let reads = 0;
  let writes = 0;
  for (const g of groups) {
    const n = g?.sum?.requests;
    const action = String(g?.dimensions?.actionType ?? '').toLowerCase();
    if (!Number.isFinite(n) || n < 0 || !['read', 'write', 'delete', 'list'].includes(action)) {
      return { reads: null, writes: null };
    }
    if (action === 'read') reads += n;
    else writes += n;
  }
  return { reads, writes };
}

function sumRequests(groups) {
  if (!Array.isArray(groups) || groups.length === 0) return null;
  let total = 0;
  for (const g of groups) {
    const n = g?.sum?.requests;
    if (!Number.isFinite(n) || n < 0) return null;
    total += n;
  }
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
export function usageWindows(now = new Date()) {
  const end = new Date(now);
  const today = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return {
    yesterday: { since: yesterday, end: today },
    today: { since: today, end },
  };
}

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
    'Automated daily check of Cloudflare free-tier usage for the bounded previous UTC day.',
    '',
    '| Metric | Used | Alert threshold | Free limit | Status |',
    '|---|---:|---:|---:|---|',
    ...rows,
    '',
    `Source endpoint: ${source} (Cloudflare Analytics).`,
    `Window: ${since.toISOString()} -> ${now.toISOString()} (end exclusive).`,
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

const QUERY_ACCOUNT = `
query ($acct: string!, $since: Time!, $until: Time!) {
  viewer {
    accounts(filter: { accountTag: $acct }) {
      workers: workersInvocationsAdaptive(filter: { datetime_geq: $since, datetime_lt: $until }, limit: 1000) { sum { requests } }
      pages: pagesFunctionsInvocationsAdaptiveGroups(filter: { datetime_geq: $since, datetime_lt: $until }, limit: 1000) { sum { requests } }
      kv: kvOperationsAdaptiveGroups(filter: { datetime_geq: $since, datetime_lt: $until }, limit: 1000) {
        dimensions { actionType }
        sum { requests }
      }
    }
  }
}`;

const QUERY_ZONE = `
query ($since: Time!, $until: Time!) {
  viewer { zones { workersZoneInvocationsAdaptiveGroups(filter: { datetime_geq: $since, datetime_lt: $until }, limit: 1000) { sum { requests } } } }
}`;

function sumComplete(...values) {
  return values.every(Number.isFinite) ? values.reduce((sum, value) => sum + value, 0) : null;
}

function usageFromAccount(data) {
  const acct = data?.viewer?.accounts?.[0];
  if (!acct) throw new Error('graphql: no account in response');
  const { reads, writes } = kvCounts(acct.kv);
  return {
    'workers-requests': sumComplete(sumRequests(acct.workers), sumRequests(acct.pages)),
    'kv-reads': reads,
    'kv-writes': writes,
  };
}

async function fetchGraphQLAccount({ token, accountId, window, attempts }) {
  try {
    const data = await gqlRequest(token, QUERY_ACCOUNT, {
      acct: accountId,
      since: window.since.toISOString(),
      until: window.end.toISOString(),
    });
    return { usage: usageFromAccount(data), source: 'graphql-account' };
  } catch (e) {
    attempts.push(`graphql-account: ${e.message}`);
    return null;
  }
}

async function fetchGraphQLZone({ token, window, attempts }) {
  try {
    const data = await gqlRequest(token, QUERY_ZONE, {
      since: window.since.toISOString(),
      until: window.end.toISOString(),
    });
    const groups = (data?.viewer?.zones ?? []).flatMap((zone) => zone.workersZoneInvocationsAdaptiveGroups ?? []);
    return {
      usage: { 'workers-requests': sumRequests(groups), 'kv-reads': null, 'kv-writes': null },
      source: 'graphql-zone',
      notes: ['zone fallback: KV metrics unavailable'],
    };
  } catch (e) {
    attempts.push(`graphql-zone: ${e.message}`);
    return null;
  }
}

/** Fetch bounded yesterday and today windows. Empty metrics remain null as missing data. */
export async function fetchUsageWithFallback({ token, accountId, now = new Date() }) {
  const windows = usageWindows(now);
  const attempts = [];
  const results = {};
  for (const period of ['yesterday', 'today']) {
    const ctx = { token, accountId, window: windows[period], attempts };
    const result = await fetchGraphQLAccount(ctx) || await fetchGraphQLZone(ctx);
    if (!result) throw new Error(`all usage endpoints failed for ${period} -> ${attempts.join(' | ')}`);
    results[period] = result;
  }
  return { yesterday: results.yesterday, today: results.today, attempts, windows };
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

function printUsage(period, result, notes = []) {
  const { usage, source } = result;
  const { since, end } = result.window;
  console.log(`${period} source: ${source}`);
  console.log(`${period} window: ${since.toISOString()} -> ${end.toISOString()} (end exclusive)`);
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
  let result;
  try {
    result = await fetchUsageWithFallback({ token, accountId });
  } catch (e) {
    console.error(`[usage-check] usage fetch failed: ${e.message}`);
    process.exit(2);
  }

  for (const period of ['yesterday', 'today']) {
    result[period].window = result.windows[period];
    printUsage(period, result[period], result[period].notes);
  }
  const missing = ['yesterday', 'today'].flatMap((period) =>
    METRICS.filter(({ key }) => !Number.isFinite(result[period].usage[key])).map(({ key }) => `${period}/${key}`),
  );
  if (missing.length) {
    console.warn(`[usage-check] monitoring incomplete: ${missing.join(', ')}`);
  }
  const earlyWarnings = evaluateUsage(result.today.usage);
  if (earlyWarnings.length) {
    console.warn(`[usage-check] current UTC day already exceeds threshold: ${earlyWarnings.map(({ key }) => key).join(', ')}`);
  }
  if (missing.some((metric) => metric.startsWith('yesterday/'))) {
    console.error('[usage-check] previous UTC day is incomplete; no complete daily report can be issued');
    process.exitCode = 2;
    return;
  }
  const alerts = evaluateUsage(result.yesterday.usage);
  if (!alerts.length) {
    console.log('[usage-check] no previous-day metric over alert threshold');
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
  const body = buildIssueBody(result.yesterday.usage, pending, result.yesterday.source, result.windows.yesterday.since, result.windows.yesterday.end);
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
