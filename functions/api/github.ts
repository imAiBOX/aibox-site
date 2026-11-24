// GET /api/github?path=<repo path> — controlled GitHub API proxy with edge caching.
//
// Root cause this fixes: the anonymous GitHub API is 60 req/h/IP; responses here are
// edge-cached (s-maxage) so the whole site/app shares one warm entry instead of every
// visitor burning their own quota. Stale-on-error: if GitHub is down or rate-limited, a
// cached copy (if any) is served instead of failing.
//
// Route: **query-param only** (`?path=`). Cloudflare Pages file names cannot express a
// `[...path]` wildcard, so `/api/github/<path>` is a 404 — the desktop app used that form
// for a while and therefore never actually reached this proxy.
//
// Robustness: this function must never throw (an unhandled exception surfaces as
// Cloudflare's bare "error code: 502" page). Every path returns a JSON body.
// The decision rules live in `_lib/github-proxy.ts` so they can be unit-tested offline.

import {
  GITHUB_UPSTREAM,
  PROXY_CACHE_SECONDS,
  PROXY_STALE_SECONDS,
  UPSTREAM_TIMEOUT_MS,
  decideProxyResponse,
  proxyResponseHeaders,
  resolveProxyPath,
  type ProxyDecision,
} from '../_lib/github-proxy.ts';

type CachedCopy = { status: number; body: string; fresh: boolean } | null;

/** Read the edge cache. Never throws (a cache hiccup must not kill the request). */
async function readCache(request: Request): Promise<CachedCopy> {
  try {
    const hit = await caches.default.match(request);
    if (!hit) return null;
    const rawUntil = hit.headers.get('X-Aibox-Fresh-Until');
    const until = Number(rawUntil);
    const now = Date.now();
    if (!hit.ok || rawUntil === null || !Number.isFinite(until) ||
        now >= until + (PROXY_STALE_SECONDS - PROXY_CACHE_SECONDS) * 1000) return null;
    return { status: hit.status, body: await hit.text(), fresh: now < until };
  } catch {
    return null;
  }
}

/** Write to the edge cache. Never throws. */
async function writeCache(request: Request, decision: ProxyDecision): Promise<void> {
  if (decision.cacheState !== 'fresh') return;
  try {
    const res = new Response(decision.body, {
      status: decision.status,
      headers: { ...proxyResponseHeaders('fresh'), 'X-Aibox-Fresh-Until': String(Date.now() + PROXY_CACHE_SECONDS * 1000), 'Cache-Control': `public, max-age=${PROXY_STALE_SECONDS}, s-maxage=${PROXY_STALE_SECONDS}` },
    });
    await caches.default.put(request, res);
  } catch {
    /* cache put may fail in some runtimes — the response is still fine */
  }
}

export const onRequest: PagesFunction = async ({ request }) => {
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET' } });
  }

  try {
    const resolved = resolveProxyPath(request.url);
    if (!resolved.ok) {
      return new Response(JSON.stringify({ ok: false, error: resolved.reason }), {
        status: 403,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    // Canonical key: equivalent query encodings/order map to one cache entry.
    const cacheKey = new Request(`https://aibox.im/api/github?path=${encodeURIComponent(resolved.rel)}`, { method: 'GET' });
    const cached = await readCache(cacheKey);

    let decision: ProxyDecision;
    if (cached?.fresh) {
      decision = { status: cached.status, body: cached.body, cacheState: 'fresh' };
      return new Response(decision.body, { status: decision.status, headers: proxyResponseHeaders(decision.cacheState) });
    }
    try {
      const upstream = await fetch(GITHUB_UPSTREAM + resolved.rel, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'aibox-site-build',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      const upstreamOk = upstream.ok;
      const upstreamStatus = upstream.status;
      const upstreamBody = upstreamOk ? await upstream.text() : undefined;
      decision = decideProxyResponse({ upstreamOk, upstreamStatus, upstreamBody, cached });
    } catch (e) {
      // Network error / timeout → stale copy if we have one, otherwise a JSON 502.
      decision = decideProxyResponse({
        upstreamOk: false,
        upstreamStatus: 0,
        networkError: String(e),
        cached,
      });
    }

    await writeCache(cacheKey, decision);

    return new Response(decision.body, {
      status: decision.status,
      headers: proxyResponseHeaders(decision.cacheState),
    });
  } catch (e) {
    // Last resort: never let the function throw (Cloudflare would answer with a bare
    // "error code: 502" page that says nothing about what went wrong).
    return new Response(JSON.stringify({ ok: false, error: String(e).slice(0, 120) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
};

export { PROXY_CACHE_SECONDS, PROXY_STALE_SECONDS };
