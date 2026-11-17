// Canonical MCP discovery alias (thin handler sharing the same JSON-RPC core).
import { handleBody } from '../_lib/mcp-rpc';

export const onRequest: PagesFunction = ({ request }): Response => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
  };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') {
    return Response.json(
      { name: 'aibox-im', version: '1.0.0', transport: 'streamable-http', endpoint: 'POST /.well-known/mcp' },
      { status: 405, headers: { ...cors, Allow: 'POST, OPTIONS' } },
    );
  }
  return request.text().then((body) => {
    const out = handleBody(body);
    if ('error' in out && !('jsonrpc' in out)) return Response.json(out, { status: 400, headers: cors });
    return Response.json(out, { headers: cors });
  });
};
