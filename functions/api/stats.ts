// GET/POST /api/stats — anonymous per-app view/install counters.
// Free-tier design (owner-confirmed): writes are gated client-side (one view per
// session per app) and deduped server-side per date+app+type, keeping KV writes
// at ~hundreds/day vs the 1000/day cap; reads are edge-cached for 60s.
// No IP/UA is stored — anonymous aggregate counts only.
import { KNOWN_APPS, dedupeKeyWithAid, isValidAid, type StatsStore } from '../_lib/stats';

// Aggregated write buffer: batches counts into KV at most once per flush window
// per isolate, cutting KV writes from per-event to ~per-isolate-per-5min.
let pending: Record<string, { views: number; installs: number }> = {};
let pendingAt = Date.now();
const FLUSH_MS = 5 * 60 * 1000;

async function flushCounts(store: StatsStore): Promise<void> {
  const keys = Object.keys(pending);
  if (!keys.length) return;
  const batch = pending;
  pending = {};
  pendingAt = Date.now();
  try {
    const raw = ((await store.get('counts', 'json')) as { apps?: Record<string, { views: number; installs: number }>; updatedAt?: number } | null) ?? {};
    const apps = raw.apps ?? {};
    for (const [id, delta] of Object.entries(batch)) {
      const slot = (apps[id] ??= { views: 0, installs: 0 });
      slot.views += delta.views;
      slot.installs += delta.installs;
    }
    await store.put('counts', JSON.stringify({ apps, updatedAt: Date.now() }));
  } catch {
    // keep nothing on failure — approximate counts, never block callers
  }
}

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
    if (store) await flushCounts(store);
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

    const body2 = body as { appId?: unknown; type?: unknown; aid?: unknown };
    const aid = isValidAid(body2.aid) ? body2.aid : undefined;
    try {
      const key = dedupeKeyWithAid(appId, type, aid);
      const seen = await store.get(key);
      if (!seen) {
        const slot = (pending[appId] ??= { views: 0, installs: 0 });
        if (type === 'view') slot.views += 1;
        else slot.installs += 1;
        await store.put(key, '1'); // per-device dedupe flag (small, per day/type/device)
      }
      if (Date.now() - pendingAt >= FLUSH_MS) await flushCounts(store);
      return json({ ok: true, stored: true });
    } catch {
      return json({ ok: true, stored: false });
    }
  }

  return json({ ok: false, error: 'method not allowed' }, 405);
};
