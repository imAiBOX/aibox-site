// download short links: R2 mirror first (streamed by this Worker — zero egress),
// GitHub Releases fallback. Redirects remain available; remote counting is disabled.
const REPO = 'imAiBOX/aibox-app';
const RELEASES = `https://github.com/${REPO}/releases`;
const VERSION_RE = /^v?\d+\.\d+\.\d+(?:[-.][0-9A-Za-z.-]+)?$/;
// object names: one safe path segment (no traversal / no leading dot), bounded
const OBJECT_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const FILE_ROUTE = '/file/';
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

const PLATFORM_SUFFIX = {
  win: 'windows-x64.exe',
  mac: 'macos-universal.dmg',
};

// pure: platform short-link → asset name (version is part of the name, so a
// stored object is immutable and cacheable forever)
function assetName(tag, platform) {
  const suffix = PLATFORM_SUFFIX[platform];
  if (!suffix) return null;
  return `AiBOX-${tag}-${suffix}`;
}

// pure: where a platform short link points — same-domain /file/ when the object
// is mirrored in R2, otherwise the GitHub release asset URL (fallback)
function assetRedirect(tag, platform, mirrored) {
  const name = assetName(tag, platform);
  if (!name) return null;
  return mirrored ? `${FILE_ROUTE}${name}` : `${RELEASES}/download/${tag}/${name}`;
}

function isValidObjectName(name) {
  return typeof name === 'string' && OBJECT_NAME_RE.test(name);
}

function redirect(location) {
  return new Response(null, {
    status: 302,
    headers: { Location: location, 'Cache-Control': 'no-store' },
  });
}

function notFound() {
  return new Response('Not Found — see / for available short links', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
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
GET /file/&lt;name&gt;    → 200 direct download of a mirrored release asset
GET /count           → counters disabled (JSON)</pre>
<p>Mirrored assets stream from R2 through this Worker (no third-party
redirect); links fall back to <a href="${RELEASES}">${REPO}</a> when a
release is not mirrored yet.</p>
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


// R2 existence probe for the mirror-first redirect: one cheap HEAD (Class B),
// fails open to the GitHub fallback if the binding is missing or errors.
async function isMirrored(env, name) {
  try {
    if (!env.BUCKET) return false;
    return (await env.BUCKET.head(name)) !== null;
  } catch {
    return false;
  }
}

// Stream an object straight out of R2 through this Worker. Deliberately NOT a
// 302 to a presigned URL: presigned downloads bill as R2 egress, while a
// Worker binding read + response streaming costs nothing (zero-egress red line).
async function serveObject(request, env, rawName) {
  let name;
  try { name = decodeURIComponent(rawName); } catch { return notFound(); }
  if (!isValidObjectName(name)) return notFound();

  const base = {
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${name}"`,
    'Cache-Control': IMMUTABLE_CACHE,
  };
  try {
    if (request.method === 'HEAD') {
      const obj = env.BUCKET ? await env.BUCKET.head(name) : null;
      if (!obj) return notFound();
      return new Response(null, { status: 200, headers: { ...base, 'Content-Length': String(obj.size) } });
    }
    const obj = env.BUCKET ? await env.BUCKET.get(name) : null;
    if (!obj) return notFound();
    return new Response(obj.body, {
      status: 200,
      headers: { ...base, 'Content-Length': String(obj.size) },
    });
  } catch {
    return notFound();
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
      return new Response(JSON.stringify({ enabled: false, note: 'Remote click counting is disabled.' }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    if (path.startsWith(FILE_ROUTE)) {
      return serveObject(request, env, path.slice(FILE_ROUTE.length));
    }

    if (path === '/latest') {
      return redirect(`${RELEASES}/latest`);
    }

    const seg = path.slice(1).split('/'); // strip leading '/'
    if (seg.length === 1) {
      const tag = normalizeVersion(seg[0]);
      if (tag) {
        return redirect(`${RELEASES}/tag/${tag}`);
      }
    } else if (seg.length === 2) {
      const tag = normalizeVersion(seg[0]);
      const platform = PLATFORM_SUFFIX[seg[1]] ? seg[1] : null;
      if (tag && platform) {
        const name = assetName(tag, platform);
        const mirrored = await isMirrored(env, name);
        return redirect(assetRedirect(tag, platform, mirrored));
      }
    }

    return notFound();
  },
};

export { assetName, assetRedirect, isValidObjectName, normalizeVersion, PLATFORM_SUFFIX };
