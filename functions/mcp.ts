// GET/POST /mcp — minimal MCP Streamable HTTP endpoint (JSON-RPC responses, application/json).
import { handleBody } from './_lib/mcp-rpc';

export const onRequest: PagesFunction = ({ request }): Response => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (request.method === 'GET') {
    return Response.json(
      { name: 'aibox-im', version: '1.0.0', transport: 'streamable-http', endpoint: 'POST /mcp' },
      { status: 405, headers: { ...cors, Allow: 'POST, OPTIONS' } },
    );
  }

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: { ...cors, Allow: 'POST, OPTIONS' } });
  }

  return request.text().then((body) => {
    const out = handleBody(body);
    if ('error' in out && !('jsonrpc' in out)) {
      return Response.json(out, { status: 400, headers: cors });
    }
    return Response.json(out, { headers: cors });
  });
};
