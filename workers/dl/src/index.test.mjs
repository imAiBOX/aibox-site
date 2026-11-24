// Pure-logic tests for the dl worker routing helpers (no runtime bindings).
// Run: node --test workers/dl/src/index.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assetName,
  assetRedirect,
  isValidObjectName,
  normalizeVersion,
  PLATFORM_SUFFIX,
} from './index.js';
import worker from './index.js';

test('redirects remain functional without counter storage', async () => {
  const ctx = { waitUntil() { assert.fail('redirect scheduled background writes'); } };
  const cases = [
    ['/latest', 'https://github.com/imAiBOX/aibox-app/releases/latest'],
    ['/v0.1.3', 'https://github.com/imAiBOX/aibox-app/releases/tag/v0.1.3'],
    ['/v0.1.3/win', 'https://github.com/imAiBOX/aibox-app/releases/download/v0.1.3/AiBOX-v0.1.3-windows-x64.exe'],
  ];
  for (const [path, location] of cases) {
    const response = await worker.fetch(new Request(`https://dl.aibox.im${path}`), {}, ctx);
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), location);
  }
  const count = await worker.fetch(new Request('https://dl.aibox.im/count'), {}, ctx);
  assert.deepEqual(await count.json(), { enabled: false, note: 'Remote click counting is disabled.' });
});

test('asset name mapping matches release asset naming', () => {
  assert.equal(assetName('v0.1.3', 'win'), 'AiBOX-v0.1.3-windows-x64.exe');
  assert.equal(assetName('v0.1.3', 'mac'), 'AiBOX-v0.1.3-macos-universal.dmg');
  assert.equal(assetName('0.1.3', 'win'), 'AiBOX-0.1.3-windows-x64.exe');
  assert.equal(assetName('v0.1.3', 'linux'), null);
  assert.deepEqual(Object.keys(PLATFORM_SUFFIX).sort(), ['mac', 'win']);
});

test('short link resolves to same-domain mirror when object exists in R2', () => {
  assert.equal(
    assetRedirect('v0.1.3', 'win', true),
    '/file/AiBOX-v0.1.3-windows-x64.exe',
  );
  assert.equal(
    assetRedirect('v0.1.3', 'mac', true),
    '/file/AiBOX-v0.1.3-macos-universal.dmg',
  );
});

test('short link falls back to GitHub release asset when not mirrored', () => {
  assert.equal(
    assetRedirect('v0.1.3', 'win', false),
    'https://github.com/imAiBOX/aibox-app/releases/download/v0.1.3/AiBOX-v0.1.3-windows-x64.exe',
  );
  assert.equal(
    assetRedirect('v0.1.3', 'mac', false),
    'https://github.com/imAiBOX/aibox-app/releases/download/v0.1.3/AiBOX-v0.1.3-macos-universal.dmg',
  );
  assert.equal(assetRedirect('v0.1.3', 'linux', false), null);
});

test('version normalization accepts bare and prefixed tags, rejects junk', () => {
  assert.equal(normalizeVersion('0.1.3'), 'v0.1.3');
  assert.equal(normalizeVersion('v0.1.3'), 'v0.1.3');
  assert.equal(normalizeVersion('v0.1.3-rc.1'), 'v0.1.3-rc.1');
  assert.equal(normalizeVersion('latest'), null);
  assert.equal(normalizeVersion('v0.1.3/../../etc'), null);
  assert.equal(normalizeVersion(''), null);
});

test('object names are single safe path segments (no traversal)', () => {
  assert.ok(isValidObjectName('AiBOX-v0.1.3-windows-x64.exe'));
  assert.ok(isValidObjectName('smoke-test.bin'));
  assert.ok(!isValidObjectName('../secret'));
  assert.ok(!isValidObjectName('a/b.bin'));
  assert.ok(!isValidObjectName('/abs.bin'));
  assert.ok(!isValidObjectName('.hidden'));
  assert.ok(!isValidObjectName(''));
  assert.ok(!isValidObjectName('name with space.bin'));
  assert.ok(!isValidObjectName(`${'x'.repeat(129)}.bin`));
});
