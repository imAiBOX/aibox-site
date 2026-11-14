import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { ReleaseSnapshot } from '../data/release';

// 下载页版本/SHA256 展示区（React 岛，client:load）
// 零依赖原则：客户端 fetch GitHub API releases/latest（匿名 60/h/IP），
// localStorage 5 分钟缓存（每用户会话 ≤2 次调用）；失败回落构建时快照（构建绝不炸）。

type ReleaseAsset = { name: string; size: number; url: string; sha256?: string };
type Release = { tag: string; publishedAt?: string; htmlUrl: string; assets: ReleaseAsset[] };

const API_PROXY = '/api/github?path=' + encodeURIComponent('repos/imAiBOX/aibox-app/releases/latest'); // 同源边缘缓存（免 60/h 限流）
const API_DIRECT = 'https://api.github.com/repos/imAiBOX/aibox-app/releases/latest'; // 兜底直连
const fetchRelease = async (): Promise<Response> => {
  try {
    const r = await fetch(API_PROXY, { headers: { accept: 'application/vnd.github+json' } });
    if (r.ok) return r;
  } catch { /* 代理不可达 → 直连兜底 */ }
  return fetch(API_DIRECT, { headers: { accept: 'application/vnd.github+json' } });
};
const CACHE_KEY = 'aibox.release.v1';
const TTL_MS = 5 * 60 * 1000;

type Labels = {
  heading: string;
  version: string;
  file: string;
  size: string;
  sha: string;
  published: string;
  copy: string;
  copied: string;
  checking: string;
  live: string;
  cached: string;
  snapshot: string;
  unavailable: string;
  allReleases: string;
  shaNote: string;
};

function fmtSize(bytes: number): string {
  if (!bytes) return '—';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

function readCache(): { at: number; data: Release } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; data?: Release };
    if (typeof parsed.at !== 'number' || !parsed.data?.tag) return null;
    return { at: parsed.at, data: parsed.data };
  } catch {
    return null;
  }
}

function writeCache(data: Release): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // 隐私模式/配额满：缓存失败不影响展示
  }
}

export default function ReleaseInfo({
  snapshot,
  labels,
}: {
  snapshot: ReleaseSnapshot | null;
  labels: Labels;
}): ReactNode {
  const [release, setRelease] = useState<Release | null>(snapshot);
  const [source, setSource] = useState<'live' | 'cached' | 'snapshot'>(snapshot ? 'snapshot' : 'live');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const cached = readCache();
    if (cached && Date.now() - cached.at < TTL_MS) {
      setRelease(cached.data);
      setSource('cached');
      return;
    }

    fetchRelease()
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((raw: unknown) => {
        const o = raw as Record<string, unknown>;
        if (typeof o.tag_name !== 'string' || typeof o.html_url !== 'string') throw new Error('bad shape');
        const assets: ReleaseAsset[] = Array.isArray(o.assets)
          ? o.assets
              .map((a): ReleaseAsset | null => {
                const rec = a as Record<string, unknown>;
                if (typeof rec.name !== 'string' || typeof rec.browser_download_url !== 'string') return null;
                const digest = typeof rec.digest === 'string' ? rec.digest : undefined;
                return {
                  name: rec.name,
                  size: typeof rec.size === 'number' ? rec.size : 0,
                  url: rec.browser_download_url,
                  sha256: digest?.startsWith('sha256:') ? digest.slice(7) : undefined,
                };
              })
              .filter((x): x is ReleaseAsset => x !== null)
          : [];
        const data: Release = {
          tag: o.tag_name,
          publishedAt: typeof o.published_at === 'string' ? o.published_at : undefined,
          htmlUrl: o.html_url,
          assets,
        };
        if (cancelled) return;
        setRelease(data);
        setSource('live');
        writeCache(data);
      })
      .catch(() => {
        // fetch 失败：保留构建时快照（state 初始值），或显示 unavailable
        if (!cancelled && !snapshot) setRelease(null);
      });

    return () => {
      cancelled = true;
    };
  }, [snapshot]);

  const winAsset = release?.assets.find((a) => /\.exe$/i.test(a.name)) ?? release?.assets[0];
  const macAsset = release?.assets.find((a) => /\.dmg$/i.test(a.name));
  const sourceLabel = source === 'live' ? labels.live : source === 'cached' ? labels.cached : labels.snapshot;

  const copySha = (sha: string) => {
    navigator.clipboard?.writeText(sha).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      },
      () => undefined,
    );
  };

  return (
    <section className="panel" aria-live="polite">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 font-[family-name:var(--font-display)] text-2xl font-semibold text-aibox-cream">
          {labels.heading}
        </h2>
        <span className="badge badge-green">
          <span className="sq" style={{ background: 'var(--aibox-green)' }} aria-hidden="true" />
          {release ? sourceLabel : labels.checking}
        </span>
      </div>

      {!release && <p className="mono-block m-0 text-aibox-text2">{labels.unavailable}</p>}

      {release && (
        <dl className="m-0 grid gap-3 text-sm">
          <div className="flex items-baseline justify-between gap-4 border-b border-aibox-line pb-3">
            <dt className="text-aibox-text2">{labels.version}</dt>
            <dd className="mono-block m-0 text-aibox-cream">{release.tag}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-b border-aibox-line pb-3">
            <dt className="text-aibox-text2">{labels.published}</dt>
            <dd className="mono-block m-0">{fmtDate(release.publishedAt)}</dd>
          </div>
          {winAsset && (
            <div className="flex items-baseline justify-between gap-4 border-b border-aibox-line pb-3">
              <dt className="text-aibox-text2">Windows</dt>
              <dd className="mono-block m-0">
                <a href={winAsset.url} rel="noopener noreferrer" className="text-aibox-info hover:text-aibox-green">
                  {winAsset.name}
                </a>
                <span className="ml-2 text-aibox-text2">{fmtSize(winAsset.size)}</span>
              </dd>
            </div>
          )}
          {macAsset && (
            <div className="flex items-baseline justify-between gap-4 border-b border-aibox-line pb-3">
              <dt className="text-aibox-text2">macOS</dt>
              <dd className="mono-block m-0">
                <a href={macAsset.url} rel="noopener noreferrer" className="text-aibox-info hover:text-aibox-green">
                  {macAsset.name}
                </a>
                <span className="ml-2 text-aibox-text2">{fmtSize(macAsset.size)}</span>
              </dd>
            </div>
          )}
          {winAsset?.sha256 && (
            <div className="grid gap-2">
              <dt className="text-aibox-text2">{labels.sha}</dt>
              <dd className="m-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <code className="mono-block">{winAsset.sha256}</code>
                  <button
                    type="button"
                    className="badge cursor-pointer"
                    onClick={() => copySha(winAsset.sha256!)}
                    aria-label={labels.copy}
                  >
                    {copied ? labels.copied : labels.copy}
                  </button>
                </div>
                <p className="mt-2 mb-0 text-xs text-aibox-text2">{labels.shaNote}</p>
              </dd>
            </div>
          )}
        </dl>
      )}

      <p className="mt-4 mb-0 text-sm">
        <a
          href={release?.htmlUrl ?? 'https://github.com/imAiBOX/aibox-app/releases/latest'}
          rel="noopener noreferrer"
          target="_blank"
          className="text-aibox-info hover:text-aibox-green"
        >
          {labels.allReleases} ↗
        </a>
      </p>
    </section>
  );
}
