// 构建时拉取 aibox-app 最新 Release 快照（下载页展示区的兜底数据）
// 容错红线：GitHub 匿名 API 限流/超时/格式不符 → 返回 null，**构建绝不允许炸**。
// 运行时主路径是客户端岛（ReleaseInfo.tsx，5 分钟缓存），本快照仅作失败回落。

export type ReleaseAsset = {
  name: string;
  size: number;
  url: string;
  sha256?: string;
};

export type ReleaseSnapshot = {
  tag: string;
  publishedAt?: string;
  htmlUrl: string;
  assets: ReleaseAsset[];
};

const API = 'https://api.github.com/repos/imAiBOX/aibox-app/releases/latest';

function parse(data: unknown): ReleaseSnapshot | null {
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  const tag = typeof o.tag_name === 'string' ? o.tag_name : null;
  const htmlUrl = typeof o.html_url === 'string' ? o.html_url : null;
  if (!tag || !htmlUrl) return null;

  const assets: ReleaseAsset[] = Array.isArray(o.assets)
    ? o.assets
        .map((raw): ReleaseAsset | null => {
          if (!raw || typeof raw !== 'object') return null;
          const a = raw as Record<string, unknown>;
          const name = typeof a.name === 'string' ? a.name : null;
          const url = typeof a.browser_download_url === 'string' ? a.browser_download_url : null;
          if (!name || !url) return null;
          const digest = typeof a.digest === 'string' ? a.digest : undefined; // "sha256:…"
          return {
            name,
            size: typeof a.size === 'number' ? a.size : 0,
            url,
            sha256: digest?.startsWith('sha256:') ? digest.slice(7) : undefined,
          };
        })
        .filter((x): x is ReleaseAsset => x !== null)
    : [];

  return {
    tag,
    publishedAt: typeof o.published_at === 'string' ? o.published_at : undefined,
    htmlUrl,
    assets,
  };
}

let pending: Promise<ReleaseSnapshot | null> | null = null;

export function fetchReleaseSnapshot(): Promise<ReleaseSnapshot | null> {
  pending ??= (async () => {
    try {
      const res = await fetch(API, {
        headers: { accept: 'application/vnd.github+json', 'user-agent': 'aibox-site-build' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      return parse(await res.json());
    } catch {
      return null; // 降级：下载页回落到「无版本详情」态，按钮仍可用
    }
  })();
  return pending;
}
