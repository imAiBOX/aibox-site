// GET /api/stats serves legacy aggregate data if present. Writes are disabled
// until an account-wide hard quota and retention policy are implemented.
import type { StatsStore } from '../_lib/stats';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=60',
};

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } });
}

export const onRequest: PagesFunction<{ stats?: StatsStore }> = async ({ request, env }) => {
  if (request.method === 'GET') {
    // Do not read pre-existing counters: they are historical and potentially stale.
    return json({ apps: {}, updatedAt: 0, store: 'disabled' });
  }

  if (request.method === 'POST') {
    // Preserve a successful no-op response for older clients; never inspect a
    // tracking payload or touch KV while collection is disabled.
    return json({ ok: true, stored: false, disabled: true });
  }

  return json({ ok: false, error: 'method not allowed' }, 405);
};
