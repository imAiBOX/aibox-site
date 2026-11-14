// GET/POST /api/stats — anonymous per-app view/install counters.
// Free-tier design (owner-confirmed): writes are gated client-side (one view per
// session per app) and deduped server-side per date+app+type, keeping KV writes
// at ~hundreds/day vs the 1000/day cap; reads are edge-cached for 60s.
// No IP/UA is stored — anonymous aggregate counts only.
import { KNOWN_APPS, dedupeKey, type StatsStore } from '../_lib/stats';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=60',
};

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } });
}

export const onRequest: PagesFunction<{ stats?: StatsStore }> = async ({ request, env }) => {
  if (request.method === 'GET') {
    const store = env.stats;
    let apps: Record<string, { views: number; installs: number }> = {};
    let updatedAt = 0;
    if (store) {
      try {
        const raw = await store.get('counts', 'json');
        if (raw && typeof raw === 'object') {
          apps = (raw as { apps?: typeof apps }).apps ?? {};
          updatedAt = (raw as { updatedAt?: number }).updatedAt ?? 0;
        }
      } catch {
        // KV read failure → serve zeros; clients render "—"
      }
    }
    return json({ apps, updatedAt, store: store ? 'kv' : 'none' });
  }

  if (request.method === 'POST') {
    let body: { appId?: unknown; type?: unknown };
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'bad json' }, 400);
    }
    const appId = typeof body.appId === 'string' ? body.appId : '';
    const type = body.type === 'view' || body.type === 'install' ? body.type : null;
    if (!type || !KNOWN_APPS.has(appId)) {
      // whitelist: unknown apps are rejected (prevents garbage writes)
      return json({ ok: false, error: 'unknown app' }, 400);
    }

    const store = env.stats;
    if (!store) {
      return json({ ok: true, stored: false }); // graceful: no KV bound yet
    }

    try {
      const key = dedupeKey(appId, type);
      // dedupe: one write per app/type/date — repeats within the day are cheap no-ops
      const seen = await store.get(key);
      if (!seen) {
        const raw = ((await store.get('counts', 'json')) as { apps?: Record<string, { views: number; installs: number }>; updatedAt?: number } | null) ?? {};
        const apps = raw.apps ?? {};
        const slot = (apps[appId] ??= { views: 0, installs: 0 });
        if (type === 'view') slot.views += 1;
        else slot.installs += 1;
        await store.put('counts', JSON.stringify({ apps, updatedAt: Date.now() }));
        await store.put(key, '1');
      }
      return json({ ok: true, stored: true });
    } catch {
      // KV write failure never blocks the caller
      return json({ ok: true, stored: false });
    }
  }

  return json({ ok: false, error: 'method not allowed' }, 405);
};
