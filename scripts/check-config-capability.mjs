// Usage: node scripts/check-config-capability.mjs /path/to/aibox-app-checkout
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const app = process.argv[2];
if (!app) throw new Error('Pass the path to an aibox-app checkout');
for (const file of ['config-capability-v1.ts', 'config-capability-v1.fixtures.json']) {
  const site = readFileSync(new URL(`../functions/_lib/${file}`, import.meta.url));
  const desktop = readFileSync(resolve(app, 'src/config', file));
  assert.ok(site.equals(desktop), `${file} differs between aibox-site and aibox-app`);
}
console.log('App and site config-capability-v1 classifiers and fixtures are identical.');
