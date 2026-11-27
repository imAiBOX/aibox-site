// GET /api/diag — targeted diagnostics for the GitHub proxy's fetch path.
//
// Why: cache-hit and path-rejection responses work, but every cache-miss that
// reaches `fetch(GITHUB_UPSTREAM ...)` dies with Cloudflare's bare 16-byte
// "error code: 502" page — the exception never surfaces as our JSON, so the
// failure happens where the JS catch blocks cannot see it. This endpoint
// records per-step timings and the exact error (if any) so the next failure
// can be attributed to a specific stage instead of guessed at.
//
// Safety: the target is a fixed constant (no user-controlled URL — not an
// SSRF springboard), it is read-only, and it returns no secrets.

export const onRequest: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const kase = url.searchParams.get('case') ?? 'zen';
  // Fixed targets only (no user-controlled URL — not an SSRF springboard).
  const targets: Record<string, { url: string; headers: Record<string, string>; replicate?: boolean; fullTail?: boolean }> = {
    zen: { url: 'https://api.github.com/zen', headers: { 'User-Agent': 'aibox-site-diag', Accept: 'text/plain' } },
    // Same headers github.ts sends, tiny endpoint — isolates the headers factor.
    'zen-via-proxy-headers': {
      url: 'https://api.github.com/zen',
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'aibox-site-build', 'X-GitHub-Api-Version': '2022-11-28' },
    },
    // Exact URL + headers of the failing cache-miss path (nonexistent tag → 404).
    'proxy-tags': {
      url: 'https://api.github.com/repos/imAiBOX/aibox-app/releases/tags/definitely-not-a-tag-xyz',
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'aibox-site-build', 'X-GitHub-Api-Version': '2022-11-28' },
    },
    // Real releases/latest with proxy headers (may hit GitHub rate limit → 403).
    'proxy-latest': {
      url: 'https://api.github.com/repos/imAiBOX/aibox-app/releases/latest',
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'aibox-site-build', 'X-GitHub-Api-Version': '2022-11-28' },
    },
    // Full replica of github.ts's cache-miss tail: decide + a 502 JSON response.
    full: {
      url: 'https://api.github.com/repos/imAiBOX/aibox-app/releases/tags/definitely-not-a-tag-xyz',
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'aibox-site-build', 'X-GitHub-Api-Version': '2022-11-28' },
      replicate: true,
      fullTail: true,
    },
    // Replica of github.ts's cache-key + readCache stage (never throws there).
    readcache: {
      url: 'https://api.github.com/repos/imAiBOX/aibox-app/releases/tags/definitely-not-a-tag-xyz',
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'aibox-site-build', 'X-GitHub-Api-Version': '2022-11-28' },
      replicate: true,
    },
  };
  const target = targets[kase] ?? targets.zen;
  const steps: Array<{ step: string; ms: number; detail?: string }> = [];
  const t0 = Date.now();
  try {
    // --- replicate github.ts stage A: cache key + readCache ---
    if (target.replicate) {
      const tA = Date.now();
      try {
        const cacheKey = new Request(`https://aibox.im/api/github?path=${encodeURIComponent('repos/imAiBOX/aibox-app/releases/tags/definitely-not-a-tag-xyz')}`, { method: 'GET' });
        const hit = await caches.default.match(cacheKey);
        steps.push({ step: 'A.cacheKey+match', ms: Date.now() - tA, detail: hit ? `hit status=${hit.status}` : 'miss' });
      } catch (e) {
        steps.push({ step: 'A.cacheKey+match', ms: Date.now() - tA, detail: `ERROR ${String(e).slice(0, 200)}` });
      }
    }

    const tFetch0 = Date.now();
    try {
      const res = await fetch(target.url, {
        headers: target.headers,
        signal: AbortSignal.timeout(6000),
      });
      if (target.replicate) {
        // github.ts reads the body only on 2xx; 403/404 body is left unread.
        if (res.ok) {
          const text = await res.text();
          steps.push({ step: 'B.fetch+read(2xx)', ms: Date.now() - tFetch0, detail: `status=${res.status} bytes=${text.length}` });
        } else {
          steps.push({ step: 'B.fetch(no body read)', ms: Date.now() - tFetch0, detail: `status=${res.status}` });
        }
      } else {
        const text = await res.text();
        steps.push({ step: `fetch+read(${kase})`, ms: Date.now() - tFetch0, detail: `status=${res.status} bytes=${text.length}` });
      }
    } catch (e) {
      steps.push({ step: `fetch+read(${kase})`, ms: Date.now() - tFetch0, detail: `ERROR ${String(e).slice(0, 200)}` });
    }

    // --- replicate github.ts stage C: decide + respond with a 502 JSON ---
    if (target.fullTail) {
      const tC = Date.now();
      const decisionBody = JSON.stringify({ ok: false, upstream: 403 });
      steps.push({ step: 'C.decide', ms: Date.now() - tC, detail: `status=502 bytes=${decisionBody.length}` });
      return new Response(decisionBody, {
        status: 502,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Aibox-Cache': 'none', 'Cache-Control': 'no-store' },
      });
    }

    // --- status-code probe: which Response statuses does CF Pages replace? ---
    const wantStatus = url.searchParams.get('status');
    if (wantStatus) {
      const st = Number(wantStatus);
      return new Response(JSON.stringify({ ok: true, returnedStatus: st }), {
        status: st,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    const tCache0 = Date.now();
    let cacheDetail = 'ok';
    try {
      const hit = await caches.default.match(new Request('https://aibox.im/api/diag'));
      cacheDetail = hit ? 'hit' : 'miss';
    } catch (e) {
      cacheDetail = `ERROR ${String(e).slice(0, 120)}`;
    }
    steps.push({ step: 'caches.default', ms: Date.now() - tCache0, detail: cacheDetail });

    return new Response(JSON.stringify({ ok: true, totalMs: Date.now() - t0, steps }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, totalMs: Date.now() - t0, steps, fatal: String(e).slice(0, 200) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
};
