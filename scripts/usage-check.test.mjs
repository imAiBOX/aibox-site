// Offline unit tests for scripts/usage-check.mjs pure functions (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  METRICS,
  classifyR2Action,
  kvCounts,
  r2ClassACount,
  evaluateUsage,
  buildIssueTitle,
  buildIssueBody,
  pendingAlerts,
} from './usage-check.mjs';

test('METRICS covers required free-tier limits', () => {
  const keys = METRICS.map((m) => m.key);
  assert.deepEqual(keys, ['workers-requests', 'kv-reads', 'kv-writes', 'r2-class-a']);
  const byKey = Object.fromEntries(METRICS.map((m) => [m.key, m]));
  assert.equal(byKey['workers-requests'].limit, 100_000);
  assert.equal(byKey['workers-requests'].threshold, 70_000);
  assert.equal(byKey['kv-reads'].threshold, 70_000);
  assert.equal(byKey['kv-writes'].limit, 1_000);
  assert.equal(byKey['kv-writes'].threshold, 700);
  assert.equal(byKey['r2-class-a'].threshold, 700_000);
});

test('evaluateUsage: below and at threshold do not alert, above does', () => {
  const usage = {
    'workers-requests': 70_000, // exactly at threshold -> no alert (strict >)
    'kv-reads': 70_001,
    'kv-writes': 700,
    'r2-class-a': null, // no data -> never alerts
  };
  const alerts = evaluateUsage(usage);
  assert.deepEqual(alerts.map((a) => a.key), ['kv-reads']);
  assert.equal(alerts[0].percent, 70);
});

test('evaluateUsage: missing metric key treated as no data', () => {
  assert.deepEqual(evaluateUsage({}), []);
});

test('buildIssueTitle is deterministic and includes date + metric keys', () => {
  const now = new Date('2026-11-15T04:00:00Z');
  const alerts = evaluateUsage({ 'kv-writes': 812 });
  const title = buildIssueTitle(alerts, now);
  assert.equal(title, 'Cloudflare free-tier usage 2026-11-15: kv-writes 812/1,000 (81%)');
});

test('pendingAlerts: same metric already covered by an issue created today is skipped', () => {
  const now = new Date('2026-11-15T04:00:00Z');
  const alerts = evaluateUsage({ 'kv-writes': 812, 'kv-reads': 80_000 });
  const existing = [{ title: 'Cloudflare free-tier usage 2026-11-15: kv-writes 812/1,000 (81%)', createdAt: '2026-11-15T03:10:00Z' }];
  const pending = pendingAlerts(alerts, existing, now);
  assert.deepEqual(pending.map((a) => a.key), ['kv-reads']);
});

test('pendingAlerts: yesterday issue does not block today', () => {
  const now = new Date('2026-11-15T04:00:00Z');
  const alerts = evaluateUsage({ 'kv-writes': 812 });
  const existing = [{ title: 'Cloudflare free-tier usage 2026-11-14: kv-writes 900/1,000 (90%)', createdAt: '2026-11-14T03:10:00Z' }];
  assert.equal(pendingAlerts(alerts, existing, now).length, 1);
});

test('pendingAlerts: no existing issues -> all pending', () => {
  const alerts = evaluateUsage({ 'kv-writes': 812 });
  assert.equal(pendingAlerts(alerts, [], new Date('2026-11-15T04:00:00Z')).length, 1);
  assert.equal(pendingAlerts(alerts, null).length, 1);
});

test('kvCounts splits read vs everything else', () => {
  const { reads, writes } = kvCounts([
    { dimensions: { actionType: 'read' }, sum: { requests: 10 } },
    { dimensions: { actionType: 'write' }, sum: { requests: 3 } },
    { dimensions: { actionType: 'delete' }, sum: { requests: 2 } },
  ]);
  assert.equal(reads, 10);
  assert.equal(writes, 5); // write + delete both count as writes (conservative)
});

test('classifyR2Action: known Class A / B / free, unknown defaults to Class A', () => {
  assert.equal(classifyR2Action('PutObject'), 'a');
  assert.equal(classifyR2Action('put_object'), 'a');
  assert.equal(classifyR2Action('GetObject'), 'b');
  assert.equal(classifyR2Action('HeadObject'), 'b');
  assert.equal(classifyR2Action('DeleteObject'), 'free');
  assert.equal(classifyR2Action('SomeNewOp'), 'a'); // conservative
  assert.equal(classifyR2Action(undefined), 'a');
});

test('r2ClassACount only sums Class A ops', () => {
  const total = r2ClassACount([
    { dimensions: { actionType: 'PutObject' }, sum: { requests: 5 } },
    { dimensions: { actionType: 'GetObject' }, sum: { requests: 100 } },
    { dimensions: { actionType: 'DeleteObject' }, sum: { requests: 50 } },
    { dimensions: { actionType: 'ListObjects' }, sum: { requests: 7 } },
  ]);
  assert.equal(total, 12);
});

test('buildIssueBody contains metric table, source and no secrets', () => {
  const usage = { 'workers-requests': 90_000, 'kv-reads': 10, 'kv-writes': null, 'r2-class-a': null };
  const alerts = evaluateUsage(usage);
  const body = buildIssueBody(usage, alerts, 'graphql-account', new Date('2026-11-15T00:00:00Z'));
  assert.match(body, /\| workers-requests \| 90,000 \|/);
  assert.match(body, /Source endpoint: graphql-account/);
  assert.match(body, /OVER/);
  assert.doesNotMatch(body, /cfat_|github_pat_/i);
});
