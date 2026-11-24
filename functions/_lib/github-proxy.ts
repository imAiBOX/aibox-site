// Pure decision logic for the GitHub API edge proxy (`/api/github?path=...`).
//
// Why this file exists: the Pages function itself can only be exercised on Cloudflare,
// so the rules that decide "fresh / stale / error" live here as plain functions and
// are unit-tested offline (`node --test`). The function file stays thin glue.
//
// Two failures this code must prevent (both seen in production):
//   1. The route is **query-param only** (`?path=`). Cloudflare Pages file names cannot
//      express a `[...path]` wildcard, so the path form `/api/github/<path>` is a 404.
//      The desktop app used the path form for months → the proxy was never actually used.
//   2. The function must **never** throw. An unhandled exception inside a Pages Function
//      surfaces as Cloudflare's bare "error code: 502" page (not our JSON), which told
//      nobody anything. Every failure path returns a JSON body instead.

export const GITHUB_UPSTREAM = 'https://api.github.com/';
export const PROXY_CACHE_SECONDS = 1800; // 30 min — release metadata rarely changes faster
export const PROXY_STALE_SECONDS = 86400; // retain last successful copy for one day
export const UPSTREAM_TIMEOUT_MS = 6000;

/** Allowed upstream path prefixes (own repos only). */
export const GITHUB_ALLOW_PREFIX: readonly string[] = ['repos/imAiBOX/'];

/** Is this upstream path allowed to be proxied? */
export function isAllowedGithubPath(path: string): boolean {
  const clean = path.replace(/^\/+/, '');
  if (!clean || clean.includes('..')) return false;
  return GITHUB_ALLOW_PREFIX.some((p) => clean.startsWith(p));
}

/**
 * Extract the upstream path from a request URL.
 * Only the query-param form is supported (`?path=...`).
 */
export function resolveProxyPath(requestUrl: string): { ok: true; rel: string } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return { ok: false, reason: 'bad url' };
  }
  const rel = url.searchParams.get('path') ?? '';
  if (!rel) return { ok: false, reason: 'missing path parameter (use /api/github?path=...)' };
  if (!isAllowedGithubPath(rel) || !/^repos\/imAiBOX\/[A-Za-z0-9_.-]+\/(?:releases\/latest|releases\/tags\/[A-Za-z0-9_.-]+|contents\/[A-Za-z0-9_./-]+)$/.test(rel)) return { ok: false, reason: 'path not allowed' };
  return { ok: true, rel };
}

export type ProxyCacheState = 'fresh' | 'stale' | 'none';

export type ProxyDecision = {
  status: number;
  body: string;
  cacheState: ProxyCacheState;
};

export type ProxyInput = {
  /** Upstream answered with 2xx. */
  upstreamOk: boolean;
  /** Upstream HTTP status (for the error body). */
  upstreamStatus: number;
  /** Upstream body (only meaningful when upstreamOk). */
  upstreamBody?: string;
  /** Network error / timeout message (only when the request never completed). */
  networkError?: string;
  /** Cached copy of a previous successful response, if any. */
  cached?: { status: number; body: string } | null;
};

/**
 * Decide what to answer.
 * - upstream ok → 200 + upstream body (fresh)
 * - upstream failed but we have a cached copy → serve the stale copy (same status as cached)
 * - upstream failed and no cached copy → 502 + a JSON body that says why
 */
export function decideProxyResponse(input: ProxyInput): ProxyDecision {
  if (input.upstreamOk) {
    return { status: 200, body: input.upstreamBody ?? '', cacheState: 'fresh' };
  }
  if (input.cached) {
    return { status: input.cached.status, body: input.cached.body, cacheState: 'stale' };
  }
  const detail =
    input.networkError !== undefined
      ? { ok: false, error: input.networkError.slice(0, 120) }
      : { ok: false, upstream: input.upstreamStatus };
  return { status: 502, body: JSON.stringify(detail), cacheState: 'none' };
}

/** Response headers for a decision (cache state is visible to the caller). */
export function proxyResponseHeaders(cacheState: ProxyCacheState): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Aibox-Cache': cacheState,
  };
  if (cacheState === 'fresh') {
    headers['Cache-Control'] = `public, max-age=${PROXY_CACHE_SECONDS}, s-maxage=${PROXY_CACHE_SECONDS}`;
  } else if (cacheState === 'stale') {
    // A stale copy must not be cached again for long; keep it available but revalidate.
    headers['Cache-Control'] = `public, max-age=60, s-maxage=60`;
  }
  return headers;
}
