// Offline MCP tests. Registry assets are served by an in-memory Pages binding.
import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRpc, handleBody } from './_lib/mcp-rpc.ts';
import { onRequest } from './mcp.ts';
import { onRequest as onCanonicalRequest } from './.well-known/mcp.ts';
import fixture from './_lib/config-capability-v1.fixtures.json' with { type: 'json' };

const call = (args, name = 'get_aibox_info') => ({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name, arguments: args } });
const text = (r) => r?.result?.content?.[0]?.text ?? '';

const profiles = Object.fromEntries(Object.entries(fixture.profiles).map(([id, profile]) => [`/meta/apps/${id}/app.json`, profile]));

function endpointRequest(msg, pathname = '/mcp') {
  return new Request(`https://aibox.im${pathname}`, { method: 'POST', body: JSON.stringify(msg) });
}

const assets = {
  async fetch(request) {
    assert.equal(request.method, 'GET');
    const url = new URL(request.url);
    assert.equal(url.origin, 'https://aibox.im');
    const profile = profiles[url.pathname];
    return profile ? Response.json(profile) : new Response(null, { status: 404 });
  },
};

test('initialize returns serverInfo and negotiated protocolVersion', async () => {
  const res = await handleRpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } });
  assert.equal(res?.result?.protocolVersion, '2025-03-26');
  assert.deepEqual(res?.result?.serverInfo, { name: 'aibox-im', version: '1.0.0' });
  assert.ok(res?.result?.capabilities?.tools);
});

test('initialize without version uses fallback', async () => {
  const res = await handleRpc({ jsonrpc: '2.0', id: 2, method: 'initialize' });
  assert.equal(res?.result?.protocolVersion, '2025-03-26');
});

test('initialize does not echo an unsupported protocol version', async () => {
  const res = await handleRpc({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '2099-01-01' } });
  assert.equal(res?.result?.protocolVersion, '2025-03-26');
});

test('both MCP paths decline unsupported SSE streams', async () => {
  for (const [path, handler] of [['/mcp', onRequest], ['/.well-known/mcp', onCanonicalRequest]]) {
    const request = new Request(`https://aibox.im${path}`, { headers: { Accept: 'text/event-stream' } });
    assert.equal((await handler({ request, env: { ASSETS: assets } })).status, 405);
  }
});

test('tools/list describes the read-only tool and accepted arguments', async () => {
  const res = await handleRpc({ jsonrpc: '2.0', id: 3, method: 'tools/list' });
  const tools = res?.result?.tools;
  assert.ok(Array.isArray(tools) && tools.length === 1);
  assert.equal(tools[0].name, 'get_aibox_info');
  assert.equal(tools[0].annotations.readOnlyHint, true);
  assert.equal(tools[0].inputSchema.additionalProperties, false);
  assert.deepEqual(tools[0].inputSchema.properties.section.enum, ['product', 'download', 'apps', 'guidance']);
});

test('download guidance points to the localized download page and requested file type', async () => {
  const mac = text(await handleRpc(call({ section: 'download', lang: 'zh', platform: 'macos' })));
  const win = text(await handleRpc(call({ section: 'download', platform: 'windows' })));
  const both = text(await handleRpc(call({ section: 'download' })));
  assert.match(mac, /官方下载页 https:\/\/aibox\.im\/zh\/download\/.*macOS.*\.dmg/);
  assert.doesNotMatch(mac, /\.exe|releases\/latest/);
  assert.match(win, /https:\/\/aibox\.im\/en\/download\/.*Windows x64 \(\.exe\)/);
  assert.doesNotMatch(win, /\.dmg|releases\/latest/);
  assert.match(both, /\.exe.*\.dmg/);
});

test('overview defaults to product and the apps section points to the static catalog', async () => {
  assert.match(text(await handleRpc(call())), /Installed until it works/);
  const apps = text(await handleRpc(call({ section: 'apps' })));
  assert.match(apps, /meta\/index\.json/);
  assert.match(apps, /meta\/apps\/\{id\}\/app\.json/);
});

test('tool names and arguments are validated before reading a profile', async () => {
  for (const msg of [
    call({}, 'install'),
    { ...call(), params: { section: 'download' } },
    { ...call(), params: { name: 'get_aibox_info', unknown: true } },
    { ...call(), params: { name: 'get_aibox_info', _meta: null } },
    call(null),
    call([]),
    call({ section: 'unknown' }),
    call({ section: 'download', lang: 'fr' }),
    call({ section: 'download', platform: 'linux' }),
    call({ section: 'apps', platform: 'macos' }),
    call({ section: 'download', apiKey: 'test' }),
    call({ section: 'guidance', appId: 'chatbox' }),
    call({ section: 'guidance', appId: '../chatbox', provider: 'openai', platform: 'windows' }),
  ]) {
    let reads = 0;
    const res = await handleRpc(msg, async () => { reads += 1; });
    assert.equal(res?.error?.code, -32602, JSON.stringify(msg));
    assert.equal(res?.id, 4);
    assert.equal(res?.result, undefined);
    assert.equal(reads, 0);
  }
});

test('both routes use the local catalog for app, provider and platform guidance', async () => {
  const query = { section: 'guidance', platform: 'windows', appId: 'chatbox', provider: 'openai' };
  const windows = await onRequest({ request: endpointRequest(call(query)), env: { ASSETS: assets } });
  const zed = await onCanonicalRequest({ request: endpointRequest(call({ ...query, appId: 'zed' }), '/.well-known/mcp'), env: { ASSETS: assets } });
  const macQuery = { ...query, appId: 'aider', platform: 'macos' };
  const mac = await onRequest({ request: endpointRequest(call({ ...macQuery, lang: 'zh' })), env: { ASSETS: assets } });
  const macEn = await onCanonicalRequest({ request: endpointRequest(call(macQuery), '/.well-known/mcp'), env: { ASSETS: assets } });
  const chatboxText = text(await windows.json());
  const zedText = text(await zed.json());
  const macText = text(await mac.json());
  assert.match(chatboxText, /Chatbox.*openai.*Windows.*\nConfigure the provider manually/);
  assert.match(chatboxText, /released AiBOX v0\.1\.21/);
  assert.match(chatboxText, /test message/);
  assert.match(zedText, /Zed.*openai.*Windows.*\nConfigure the provider manually/);
  assert.match(zedText, /https:\/\/aibox\.im\/en\/apps\/zed\//);
  assert.match(macText, /Aider.*macOS.*\n如果你的 AiBOX 版本提供辅助配置向导.*手动配置/);
  assert.match(macText, /已发布的 AiBOX v0\.1\.21/);
  assert.match(macText, /https:\/\/aibox\.im\/zh\/apps\/aider\//);
  assert.match(text(await macEn.json()), /If your AiBOX version offers the setup wizard.*configure it manually/);
});

test('both HTTP handlers apply the versioned configuration fixtures', async () => {
  for (const [path, handler] of [['/mcp', onRequest], ['/.well-known/mcp', onCanonicalRequest]]) {
    for (const { expected, ...args } of fixture.cases) {
      const response = await handler({ request: endpointRequest(call({ section: 'guidance', ...args }), path), env: { ASSETS: assets } });
      const res = await response.json();
      if (expected === 'unavailable') assert.equal(res.error?.code, -32602);
      else assert.deepEqual(res.result?._meta?.['aibox.im/config-capability'], { version: fixture.version, capability: expected });
    }
  }
});

test('unknown catalog app, provider and unavailable snapshots receive explicit errors', async () => {
  const query = { section: 'guidance', platform: 'windows', appId: 'chatbox', provider: 'openai' };
  for (const [args, message] of [
    [{ ...query, appId: 'unknown' }, /No catalog entry/],
    [{ ...query, provider: 'unknown' }, /Provider is not listed/],
  ]) {
    const response = await onRequest({ request: endpointRequest(call(args)), env: { ASSETS: assets } });
    const res = await response.json();
    assert.equal(res.error.code, -32602);
    assert.match(res.error.message, message);
  }
  const windowsOnly = await handleRpc(call({ ...query, platform: 'macos' }), async () => ({
    ...profiles['/meta/apps/chatbox/app.json'],
    packages: [{ kind: 'app', platforms: ['windows'] }, { kind: 'runtime', platforms: ['macos'] }],
  }));
  assert.equal(windowsOnly?.error?.code, -32602);
  assert.match(windowsOnly?.error?.message, /No app package listed for this platform/);
  const failure = await handleRpc(call(query), async () => { throw new Error('asset failure'); });
  assert.equal(failure?.error?.code, -32603);
});

test('unknown method returns -32601 with id preserved', async () => {
  const res = await handleRpc({ jsonrpc: '2.0', id: 9, method: 'resources/list' });
  assert.equal(res?.error?.code, -32601);
  assert.equal(res?.id, 9);
});

test('notifications return an empty 202 response', async () => {
  const notification = { jsonrpc: '2.0', method: 'notifications/initialized' };
  assert.equal(await handleRpc(notification), null);
  const res = await onRequest({ request: endpointRequest(notification), env: { ASSETS: assets } });
  assert.equal(res.status, 202);
  assert.equal(await res.text(), '');
});

test('handleBody distinguishes malformed JSON from invalid requests', async () => {
  assert.equal((await handleBody('{not json')).error.code, -32700);
  assert.equal((await handleBody('null')).error.code, -32600);
});
