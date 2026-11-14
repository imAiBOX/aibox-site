// Stats helpers (offline unit-tested).

/** Apps known to the registry — the only ids we accept writes for. */
export const KNOWN_APPS: Set<string> = new Set([
  'openclaw',
  'ollama',
  'cherry-studio',
  'chatbox',
  'jan',
  'aidog',
  'hermes-agent',
  'nanobot',
  'cowagent',
  'cline',
  'llamafile',
  'anything-llm',
  'gpt4all',
  'aider',
  'lobechat',
  'comfyui',
  'roo-code',
]);

/** Dedupe key: one KV flag write per app/type/day (keeps writes ≪ 1000/day). */
export function dedupeKey(appId: string, type: 'view' | 'install'): string {
  const d = new Date();
  const day = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  return `s:${day}:${appId}:${type}`;
}

/** Accept a POST body only for known apps and valid types. */
export function parseTrackRequest(body: unknown): { appId: string; type: 'view' | 'install' } | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as { appId?: unknown; type?: unknown };
  const appId = typeof o.appId === 'string' ? o.appId : '';
  const type = o.type === 'view' || o.type === 'install' ? o.type : null;
  if (!type || !KNOWN_APPS.has(appId)) return null;
  return { appId, type };
}

/** GitHub proxy allowlist (path prefixes we forward to api.github.com). */
export const GITHUB_ALLOW_PREFIX: string[] = ['repos/imAiBOX/'];

export function isAllowedGithubPath(path: string): boolean {
  const clean = path.replace(/^\/+/, '');
  if (!clean || clean.includes('..')) return false;
  return GITHUB_ALLOW_PREFIX.some((p) => clean.startsWith(p));
}
