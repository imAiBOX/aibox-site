import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseRelease } from './release-choice.mjs';
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
