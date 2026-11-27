import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../api/github.ts';

const rel = 'repos/imAiBOX/aibox-app/releases/latest';
const req = (url) => onRequest({ request: new Request(url) });
const url = `https://aibox.im/api/github?path=${rel}`;

test('canonical key serves fresh, refreshes expired, and bounds stale fallback', async (t) => {
  let now = 1_800_000_000_000;
  let calls = 0;
  let fail = false;
  const cache = new Map();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'caches');
  Object.defineProperty(globalThis, 'caches', { configurable: true, value: { default: {
    match: async (key) => cache.get(key.url)?.clone(),
    put: async (key, result) => cache.set(key.url, result.clone()),
  } } });
  t.after(() => original ? Object.defineProperty(globalThis, 'caches', original) : delete globalThis.caches);
  t.mock.method(Date, 'now', () => now);
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return fail ? new Response('', { status: 503 }) : Response.json({ tag_name: `v0.0.${calls}` });
  });
  assert.equal((await (await req(url)).json()).tag_name, 'v0.0.1');
  assert.equal((await (await req(`https://aibox.im/api/github?unused=1&path=${encodeURIComponent(rel)}`)).json()).tag_name, 'v0.0.1');
  assert.equal(calls, 1);
  now += 1800 * 1000;
  assert.equal((await (await req(url)).json()).tag_name, 'v0.0.2');
  const refreshed = now;
  now += 1800 * 1000;
  fail = true;
  const stale = await req(url);
  assert.equal(stale.headers.get('x-aibox-cache'), 'stale');
  assert.equal((await stale.json()).tag_name, 'v0.0.2');
  assert.equal(calls, 3);
  now = refreshed + 86400 * 1000;
  const expired = await req(url);
  assert.equal(expired.status, 503); // 502 would be hijacked by CF Pages
  assert.deepEqual(await expired.json(), { ok: false, upstream: 503 });
});
