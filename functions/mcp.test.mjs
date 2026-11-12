// Offline unit tests for the MCP JSON-RPC dispatcher (node --test, Node 22 type stripping).
import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRpc, handleBody } from './_lib/mcp-rpc.ts';

test('initialize echoes protocolVersion and returns serverInfo', () => {
  const res = handleRpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-18' } });
  assert.equal(res?.result?.protocolVersion, '2025-03-18');
  assert.deepEqual(res?.result?.serverInfo, { name: 'aibox-im', version: '1.0.0' });
  assert.ok(res?.result?.capabilities?.tools);
});

test('initialize without version uses fallback', () => {
  const res = handleRpc({ jsonrpc: '2.0', id: 2, method: 'initialize' });
  assert.equal(res?.result?.protocolVersion, '2025-03-26');
});

test('tools/list returns get_aibox_info with enum schema', () => {
  const res = handleRpc({ jsonrpc: '2.0', id: 3, method: 'tools/list' });
  const tools = res?.result?.tools;
  assert.ok(Array.isArray(tools) && tools.length === 1);
  assert.equal(tools[0].name, 'get_aibox_info');
  assert.deepEqual(tools[0].inputSchema.properties.section.enum, ['product', 'download', 'apps']);
});

test('tools/call sections return distinct text payloads', () => {
  const product = handleRpc({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { arguments: { section: 'product' } } });
  const download = handleRpc({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { arguments: { section: 'download' } } });
  const apps = handleRpc({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { arguments: { section: 'apps' } } });
  const text = (r) => r?.result?.content?.[0]?.text ?? '';
  assert.match(text(product), /Installed until it works/);
  assert.match(text(download), /releases\/latest/);
  assert.match(text(apps), /meta\/index\.json/);
  assert.notEqual(text(product), text(download));
});

test('unknown method returns -32601 with id preserved', () => {
  const res = handleRpc({ jsonrpc: '2.0', id: 9, method: 'resources/list' });
  assert.equal(res?.error?.code, -32601);
  assert.equal(res?.id, 9);
});

test('notifications return null (no response)', () => {
  assert.equal(handleRpc({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  assert.equal(handleRpc({ jsonrpc: '2.0', method: 'notifications/cancelled' }), null);
});

test('handleBody rejects malformed JSON with parse error', () => {
  const res = handleBody('{not json');
  assert.equal(res.error.code, -32700);
});
