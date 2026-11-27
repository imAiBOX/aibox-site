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

export const onRequest: PagesFunction = async () => {
  const steps: Array<{ step: string; ms: number; detail?: string }> = [];
  const t0 = Date.now();
  try {
    const tFetch0 = Date.now();
    let upstreamStatus = 0;
    let bodyBytes = 0;
    try {
      const res = await fetch('https://api.github.com/zen', {
        headers: { 'User-Agent': 'aibox-site-diag', Accept: 'text/plain' },
        signal: AbortSignal.timeout(6000),
      });
      upstreamStatus = res.status;
      const text = await res.text();
      bodyBytes = text.length;
      steps.push({ step: 'fetch+read', ms: Date.now() - tFetch0, detail: `status=${upstreamStatus} bytes=${bodyBytes}` });
    } catch (e) {
      steps.push({ step: 'fetch+read', ms: Date.now() - tFetch0, detail: `ERROR ${String(e).slice(0, 200)}` });
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
