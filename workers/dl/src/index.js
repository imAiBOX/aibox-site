// download short links: 302 to GitHub Releases + best-effort daily click count
const REPO = 'imAiBOX/aibox-app';
const RELEASES = `https://github.com/${REPO}/releases`;
// KV free tier: 1,000 writes/day (account-wide). Stop writing before the cap so
// the counter degrades to read-only instead of failing writes all day.
const DAILY_WRITE_CAP = 950;

const VERSION_RE = /^v?\d+\.\d+\.\d+(?:[-.][0-9A-Za-z.-]+)?$/;

function redirect(location) {
  return new Response(null, {
    status: 302,
    headers: { Location: location, 'Cache-Control': 'no-store' },
  });
}

function indexPage() {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>AiBOX download short links</title>
<style>body{font:16px/1.6 ui-monospace,Menlo,Consolas,monospace;background:#0A0A0A;color:#FBF6E2;margin:0;padding:2rem}a{color:#B6FB50}pre{white-space:pre-wrap}</style>
</head><body>
<h1>AiBOX download short links</h1>
<pre>GET /latest          → latest release page (pick your platform)
GET /v0.1.3          → release page for tag v0.1.3
GET /v0.1.3/win      → Windows installer (.exe) direct download
GET /v0.1.3/mac      → macOS disk image (.dmg) direct download
GET /count           → today's redirect count (JSON)</pre>
<p>Source: <a href="${RELEASES}">${REPO}</a></p>
</body></html>`;
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  });
}

function normalizeVersion(raw) {
  const v = decodeURIComponent(raw);
  if (!VERSION_RE.test(v)) return null;
  return v.startsWith('v') ? v : `v${v}`;
}

// Best-effort counter: never throws, never blocks the redirect (runs in
// waitUntil). Keyed per UTC day; KV writes are capped to stay inside the
// free-tier daily write limit — beyond the cap the redirect still works and
// counting silently stops for that day. KV is eventually consistent, so the
// number is approximate under concurrency.
async function countRedirect(env, kind) {
  const day = new Date().toISOString().slice(0, 10);
  const key = `count:${day}`;
  try {
    const raw = await env.HITS.get(key);
    let tally = { total: 0, latest: 0, version: 0, asset: 0 };
    if (raw) {
      try { tally = { ...tally, ...JSON.parse(raw) }; } catch { /* keep zeros */ }
    }
    if (tally.total >= DAILY_WRITE_CAP) return;
    tally.total += 1;
    if (kind in tally) tally[kind] += 1;
    await env.HITS.put(key, JSON.stringify(tally));
  } catch {
    /* counting is best-effort; a KV error must not affect the redirect */
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (path === '/') return indexPage();

    if (path === '/count') {
      const day = new Date().toISOString().slice(0, 10);
      let body = { date: day, note: 'approximate; best-effort counter' };
      try {
        const raw = await env.HITS.get(`count:${day}`);
        if (raw) body = { ...body, ...JSON.parse(raw) };
      } catch { /* serve zeros */ }
      return new Response(JSON.stringify(body, null, 2), {
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    if (path === '/latest') {
      ctx.waitUntil(countRedirect(env, 'latest'));
      return redirect(`${RELEASES}/latest`);
    }

    const seg = path.slice(1).split('/'); // strip leading '/'
    if (seg.length === 1) {
      const tag = normalizeVersion(seg[0]);
      if (tag) {
        ctx.waitUntil(countRedirect(env, 'version'));
        return redirect(`${RELEASES}/tag/${tag}`);
      }
    } else if (seg.length === 2) {
      const tag = normalizeVersion(seg[0]);
      const asset = seg[1] === 'win' ? 'windows-x64.exe'
        : seg[1] === 'mac' ? 'macos-universal.dmg'
        : null;
      if (tag && asset) {
        ctx.waitUntil(countRedirect(env, 'asset'));
        return redirect(`${RELEASES}/download/${tag}/AiBOX-${tag}-${asset}`);
      }
    }

    return new Response('Not Found — see / for available short links', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  },
};
