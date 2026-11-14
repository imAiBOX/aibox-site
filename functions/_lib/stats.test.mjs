// Offline tests for stats/github-proxy helpers (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupeKey, parseTrackRequest, isAllowedGithubPath, KNOWN_APPS } from './stats.ts';

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
  assert.ok(KNOWN_APPS.has('roo-code'));
  assert.equal(KNOWN_APPS.size, 17);
});

test('github proxy allowlist', () => {
  assert.ok(isAllowedGithubPath('repos/imAiBOX/aibox-app/releases/latest'));
  assert.ok(isAllowedGithubPath('/repos/imAiBOX/aibox-registry/contents/index.json'));
  assert.equal(isAllowedGithubPath('repos/evil/repo'), false);
  assert.equal(isAllowedGithubPath('../secrets'), false);
  assert.equal(isAllowedGithubPath(''), false);
  assert.equal(isAllowedGithubPath('user'), false);
});
