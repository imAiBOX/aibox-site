// GET /api/github/<path> — controlled GitHub API proxy with edge caching.
// Root cause this fixes: anonymous GitHub API is 60 req/h/IP; responses here are
// edge-cached (s-maxage) so the whole site/app shares one warm entry instead of
// every visitor burning their own quota. Stale-on-error: if GitHub is down or
// rate-limited, a cached copy (if any) is served instead of failing.
import { isAllowedGithubPath } from '../_lib/stats';

const UPSTREAM = 'https://api.github.com/';
const CACHE_SECONDS = 1800; // 30 min — release metadata rarely changes faster

export const onRequest: PagesFunction = async ({ request, params }) => {
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET' } });
  }

  const segs = params.path;
  const rel = Array.isArray(segs) ? segs.join('/') : String(segs ?? '');
  if (!isAllowedGithubPath(rel)) {
    return new Response(JSON.stringify({ ok: false, error: 'path not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = UPSTREAM + rel;
  const cache = await caches.default.match(request);
  try {
    const upstream = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'aibox-site-build',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (upstream.ok) {
      const body = await upstream.text();
      const res = new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}`,
          'X-Aibox-Cache': 'miss',
        },
      });
      // best-effort edge cache put (ignore failures)
      try {
        await caches.default.put(request, res.clone());
      } catch {
        /* cache put may fail in some runtimes — response still fine */
      }
      return res;
    }
    // upstream 4xx/5xx → fall back to stale copy if we have one
    if (cache) {
      const stale = cache.clone();
      const headers = new Headers(stale.headers);
      headers.set('X-Aibox-Cache', 'stale');
      return new Response(stale.body, { status: stale.status, headers });
    }
    return new Response(JSON.stringify({ ok: false, upstream: upstream.status }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    // network error / timeout → stale if available
    if (cache) {
      const headers = new Headers(cache.headers);
      headers.set('X-Aibox-Cache', 'stale');
      return new Response(cache.clone().body, { status: cache.status, headers });
    }
    return new Response(JSON.stringify({ ok: false, error: String(e).slice(0, 120) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
