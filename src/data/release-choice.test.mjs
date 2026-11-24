import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseRelease } from './release-choice.mjs';
import { readFileSync } from 'node:fs';

const verified = JSON.parse(readFileSync(new URL('./verified-release.json', import.meta.url), 'utf8'));
test('verified download snapshot contains both platform assets and checksums', () => {
  assert.match(verified.tag, /^v\d+\.\d+\.\d+$/);
  const releaseBase = 'https://github.com/imAiBOX/aibox-app/releases';
  assert.equal(verified.htmlUrl, `${releaseBase}/tag/${verified.tag}`);
  assert.equal(verified.assets.length, 2);
  for (const suffix of ['windows-x64.exe', 'macos-universal.dmg']) {
    const name = `AiBOX-${verified.tag}-${suffix}`;
    const asset = verified.assets.find((entry) => entry.name === name);
    assert.ok(asset);
    assert.equal(asset.url, `${releaseBase}/download/${verified.tag}/${name}`);
    assert.match(asset.sha256, /^[0-9a-f]{64}$/);
    assert.ok(Number.isSafeInteger(asset.size) && asset.size > 0);
  }
});
const release = (tag) => ({ tag, assets: [{name:'app.exe'}, {name:'app.dmg'}] });
test('old v0.1.9 browser/API data cannot overwrite v0.1.17 snapshot', () => {
 const snapshot = release('v0.1.17');
 assert.equal(chooseRelease(snapshot,release('v0.1.9')),snapshot);
});
test('newer metadata wins and versions compare numerically', () => {
 const newer = release('v0.1.18');
 assert.equal(chooseRelease(release('v0.1.17'), newer),newer);
});
test('same-tag partial publication cannot remove a platform download', () => {
 const snapshot = release('v0.1.17');
 assert.equal(chooseRelease(snapshot,{tag:snapshot.tag,assets:[{name:'app.exe'}]}),snapshot);
});
