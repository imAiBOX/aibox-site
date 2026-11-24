// GET/POST /mcp and /.well-known/mcp (JSON-RPC responses, application/json).
import { handleBody } from './_lib/mcp-rpc.ts';

interface McpContext {
  request: Request;
  env: { ASSETS: { fetch(request: Request): Promise<Response> } };
}

export async function onRequest({ request, env }: McpContext): Promise<Response> {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, MCP-Protocol-Version',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (request.method === 'GET') {
    if (request.headers.get('Accept')?.split(',').some((type) => type.split(';')[0].trim().toLowerCase() === 'text/event-stream')) {
      return new Response('Event streams are not supported', { status: 405, headers: { ...cors, Allow: 'POST, OPTIONS' } });
    }
    return Response.json(
      {
        name: 'aibox-im',
        version: '1.0.0',
        protocol: 'MCP Streamable HTTP',
        endpoint: 'https://aibox.im/.well-known/mcp',
        methods: ['initialize', 'tools/list', 'tools/call'],
        tools: ['get_aibox_info'],
      },
      { headers: cors },
    );
  }
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: { ...cors, Allow: 'GET, POST, OPTIONS' } });
  }

  const out = await handleBody(await request.text(), async (appId) => {
    // Read the existing Pages asset directly, with no network request to the public site.
    const asset = new URL(`/meta/apps/${appId}/app.json`, request.url);
    const response = await env.ASSETS.fetch(new Request(asset));
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('App catalog asset unavailable');
    return response.json();
  });
  if (!out) return new Response(null, { status: 202, headers: cors });
  const status = out.error?.code === -32700 ? 400 : 200;
  return Response.json(out, { status, headers: cors });
}
