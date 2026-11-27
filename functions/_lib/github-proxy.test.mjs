// Offline tests for the GitHub edge proxy helpers (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decideProxyResponse,
  isAllowedGithubPath,
  proxyResponseHeaders,
  resolveProxyPath,
} from './github-proxy.ts';

test('only own repos are proxied', () => {
  assert.ok(isAllowedGithubPath('repos/imAiBOX/aibox-app/releases/latest'));
  assert.ok(isAllowedGithubPath('/repos/imAiBOX/aibox-registry/contents/index.json'));
  assert.equal(isAllowedGithubPath('repos/evil/repo'), false);
  assert.equal(isAllowedGithubPath('../secrets'), false);
  assert.equal(isAllowedGithubPath(''), false);
});

test('the route is query-param only', () => {
  const ok = resolveProxyPath('https://aibox.im/api/github?path=repos/imAiBOX/aibox-app/releases/latest');
  assert.deepEqual(ok, { ok: true, rel: 'repos/imAiBOX/aibox-app/releases/latest' });

  // The path form is a 404 on Pages (no wildcard file names) → must be rejected loudly.
  const pathForm = resolveProxyPath('https://aibox.im/api/github/repos/imAiBOX/aibox-app/releases/latest');
  assert.equal(pathForm.ok, false);
  assert.match(pathForm.ok ? '' : pathForm.reason, /missing path parameter/);

  const evil = resolveProxyPath('https://aibox.im/api/github?path=repos/other/repo');
  assert.equal(evil.ok, false);
  assert.match(evil.ok ? '' : evil.reason, /not allowed/);
});

test('a healthy upstream answers fresh', () => {
  const d = decideProxyResponse({ upstreamOk: true, upstreamStatus: 200, upstreamBody: '{"a":1}' });
  assert.equal(d.status, 200);
  assert.equal(d.body, '{"a":1}');
  assert.equal(d.cacheState, 'fresh');
});

test('an upstream failure falls back to the cached copy', () => {
  const d = decideProxyResponse({
    upstreamOk: false,
    upstreamStatus: 403,
    cached: { status: 200, body: '{"cached":true}' },
  });
  assert.equal(d.status, 200);
  assert.equal(d.body, '{"cached":true}');
  assert.equal(d.cacheState, 'stale');
});

test('an upstream failure without a cache answers 503 JSON (502/504 are hijacked by CF Pages)', () => {
  const d = decideProxyResponse({ upstreamOk: false, upstreamStatus: 502 });
  assert.equal(d.status, 503); // NOT 502: Cloudflare overwrites a Function's 502/504
  assert.equal(d.cacheState, 'none');
  assert.deepEqual(JSON.parse(d.body), { ok: false, upstream: 502 });

  const netErr = decideProxyResponse({ upstreamOk: false, upstreamStatus: 0, networkError: 'timeout' });
  assert.equal(netErr.status, 503);
  assert.deepEqual(JSON.parse(netErr.body), { ok: false, error: 'timeout' });
});

test('fresh responses are cacheable, stale ones are not', () => {
  assert.match(proxyResponseHeaders('fresh')['Cache-Control'], /s-maxage=1800/);
  assert.equal(proxyResponseHeaders('stale')['Cache-Control'], 'public, max-age=60, s-maxage=60');
  assert.equal(proxyResponseHeaders('none')['Cache-Control'], undefined);
});
