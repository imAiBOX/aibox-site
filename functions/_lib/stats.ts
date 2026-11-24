// Stats helpers (offline unit-tested).

/** Apps known to the registry — the only ids we accept writes for. */
export const KNOWN_APPS: Set<string> = new Set([
  'aider',
  'aidog',
  'anything-llm',
  'chatbox',
  'cherry-studio',
  'cline',
  'comfyui',
  'continue',
  'cowagent',
  'fooocus',
  'gpt4all',
  'hermes-agent',
  'jan',
  'llamafile',
  'lobechat',
  'moneyprinterturbo',
  'nanobot',
  'ollama',
  'openclaw',
  'sillytavern',
  'stable-diffusion-webui',
]);

/** Legacy key format retained for inventory and retirement tooling only. */
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

// 允许列表的**单一真源**在 `_lib/github-proxy.ts`（GitHub 边缘代理专用）；
// 这里保留导出只为兼容既有引用（`stats.test.mjs` 与旧调用点）。
export { isAllowedGithubPath } from './github-proxy.ts';

/** Legacy aid validator; no active collection endpoint accepts or persists aids. */
export function isValidAid(aid: unknown): aid is string {
  return typeof aid === 'string' && /^[0-9a-f-]{8,64}$/.test(aid);
}

/** Legacy key format retained for inventory and retirement tooling only. */
export function dedupeKeyWithAid(appId: string, type: 'view' | 'install', aid?: string): string {
  const base = dedupeKey(appId, type);
  return isValidAid(aid) ? `${base}:${aid}` : base;
}
