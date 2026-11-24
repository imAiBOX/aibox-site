// Offline tests for stats/github-proxy helpers (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupeKey, parseTrackRequest, isAllowedGithubPath, KNOWN_APPS } from './stats.ts';
import { onRequest } from '../api/stats.ts';

test('stats endpoint never reads or writes KV and displays disabled counters', async () => {
  const operations = [];
  const env = { stats: {
    async get(...args) { operations.push(['get', ...args]); throw new Error('must not read'); },
    async put(...args) { operations.push(['put', ...args]); throw new Error('must not write'); },
  } };
  const get = await onRequest({ request: new Request('https://aibox.im/api/stats'), env });
  assert.deepEqual(await get.json(), { apps: {}, updatedAt: 0, store: 'disabled' });
  assert.equal(get.headers.get('cache-control'), 'public, max-age=60');

  const post = await onRequest({ request: new Request('https://aibox.im/api/stats', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ appId: 'openclaw', type: 'view', aid: 'abcdef12-3456-7890' }),
  }), env });
  assert.deepEqual(await post.json(), { ok: true, stored: false, disabled: true });
  assert.deepEqual(operations, []);
});

test('dedupe key is per app/type/day (UTC)', () => {
  const a = dedupeKey('ollama', 'view');
  assert.match(a, /^s:\d{8}:ollama:view$/);
  assert.equal(a, dedupeKey('ollama', 'view'));
  assert.notEqual(a, dedupeKey('ollama', 'install'));
  assert.notEqual(a, dedupeKey('jan', 'view'));
});

test('parseTrackRequest accepts known apps only', () => {
  assert.deepEqual(parseTrackRequest({ appId: 'openclaw', type: 'view' }), { appId: 'openclaw', type: 'view' });
  assert.deepEqual(parseTrackRequest({ appId: 'comfyui', type: 'install' }), { appId: 'comfyui', type: 'install' });
  assert.equal(parseTrackRequest({ appId: 'evil-app', type: 'view' }), null);
  assert.equal(parseTrackRequest({ appId: 'openclaw', type: 'delete' }), null);
  assert.equal(parseTrackRequest(null), null);
  assert.equal(parseTrackRequest({}), null);
});

test('whitelist covers every registry app id', () => {
  assert.ok(KNOWN_APPS.has('aidog'));
  assert.ok(KNOWN_APPS.has('hermes-agent'));
  assert.ok(KNOWN_APPS.has('lobechat'));
  assert.ok(KNOWN_APPS.has('continue'));
  assert.ok(KNOWN_APPS.has('moneyprinterturbo'));
  assert.ok(KNOWN_APPS.has('stable-diffusion-webui'));
  assert.ok(KNOWN_APPS.has('fooocus'));
  assert.equal(KNOWN_APPS.has('roo-code'), false);
  assert.equal(KNOWN_APPS.size, 21);
});

test('github proxy allowlist', () => {
  assert.ok(isAllowedGithubPath('repos/imAiBOX/aibox-app/releases/latest'));
  assert.ok(isAllowedGithubPath('/repos/imAiBOX/aibox-registry/contents/index.json'));
  assert.equal(isAllowedGithubPath('repos/evil/repo'), false);
  assert.equal(isAllowedGithubPath('../secrets'), false);
  assert.equal(isAllowedGithubPath(''), false);
  assert.equal(isAllowedGithubPath('user'), false);
});
