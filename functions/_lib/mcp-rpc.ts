// MCP endpoint logic (JSON-RPC 2.0 over HTTP) — transport-agnostic, unit-tested with node --test.
// Read-only server: exposes product/download/apps info to external AI agents (tool: get_aibox_info).

export interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

const SERVER_INFO = { name: 'aibox-im', version: '1.0.0' };
const PROTOCOL_FALLBACK = '2025-03-26';

const PRODUCT_TEXT = [
  'AiBOX (https://aibox.im) — "Installed until it works."',
  'A portable desktop installer and maintenance companion for Windows/macOS that takes popular AI apps from download to a working, verified setup: machine scan -> install plan -> multi-source download with SHA256 verification -> model API-key config -> real test message. No terminal, no admin prompts.',
  'Download: https://github.com/imAiBOX/aibox-app/releases/latest (AiBOX-vX.Y.Z-windows-x64.exe, portable)',
  'Source: https://github.com/imAiBOX/aibox-app · Catalog SSOT: https://github.com/imAiBOX/aibox-registry',
].join('\n');

const DOWNLOAD_TEXT = [
  'Latest AiBOX release: https://github.com/imAiBOX/aibox-app/releases/latest',
  'Asset pattern: AiBOX-vX.Y.Z-windows-x64.exe (single portable file, double-click to run).',
  'SHA256 checksums are published on https://aibox.im/en/download/ and derived from GitHub Release asset digests.',
].join('\n');

const APPS_TEXT = [
  'The live app catalog is always at https://aibox.im/meta/index.json (mirrors github.com/imAiBOX/aibox-registry).',
  'Each app profile (channels, sha256, install/probe, maintenance): https://aibox.im/meta/apps/{id}.json',
  'Example ids: openclaw, ollama, cherry-studio, chatbox, jan.',
].join('\n');

function toolResult(section?: unknown): Record<string, unknown> {
  const s = typeof section === 'string' ? section : 'product';
  const text = s === 'download' ? DOWNLOAD_TEXT : s === 'apps' ? APPS_TEXT : PRODUCT_TEXT;
  return { content: [{ type: 'text', text }] };
}

/** Dispatch one JSON-RPC message. Returns a response object, or null for notifications. */
export function handleRpc(msg: JsonRpcRequest): JsonRpcResponse | null {
  const id = msg && typeof msg.id !== 'undefined' ? msg.id : null;
  const isNotification = msg && typeof msg.id === 'undefined';
  const method = typeof msg?.method === 'string' ? msg.method : '';

  if (method.startsWith('notifications/')) return null;

  if (method === 'initialize') {
    const requested = msg.params?.protocolVersion;
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: typeof requested === 'string' ? requested : PROTOCOL_FALLBACK,
        serverInfo: SERVER_INFO,
        capabilities: { tools: {} },
      },
    };
  }

  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: [
          {
            name: 'get_aibox_info',
            description:
              'Read-only info about the AiBOX product: section=product (overview), download (latest release), or apps (catalog pointers).',
            inputSchema: {
              type: 'object',
              properties: { section: { type: 'string', enum: ['product', 'download', 'apps'] } },
            },
          },
        ],
      },
    };
  }

  if (method === 'tools/call') {
    const args = (msg.params?.arguments ?? msg.params ?? {}) as Record<string, unknown>;
    return { jsonrpc: '2.0', id, result: toolResult(args.section) };
  }

  if (isNotification) return null; // e.g. notifications/initialized without id

  return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method || '(empty)'}` } };
}

/** Parse a request body; malformed JSON → standard parse error response. */
export function handleBody(body: string): JsonRpcResponse | { error: { code: number; message: string } } {
  let parsed: JsonRpcRequest;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { error: { code: -32700, message: 'Parse error' } };
  }
  const res = handleRpc(parsed);
  // notification-only → 202-style empty result handled by caller; return sentinel null via error-less object
  return res ?? { jsonrpc: '2.0', id: null, result: {} };
}
