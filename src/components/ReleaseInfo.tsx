import { useState } from 'react';
import type { ReactNode } from 'react';
import type { ReleaseSnapshot } from '../data/release';

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

export default function ReleaseInfo({
  snapshot: release,
  labels,
}: {
  snapshot: ReleaseSnapshot;
  labels: Labels;
}): ReactNode {
  const [copied, setCopied] = useState<string | null>(null);
  const winAsset = release.assets.find((asset) => asset.name.endsWith('.exe'));
  const macAsset = release.assets.find((asset) => asset.name.endsWith('.dmg'));

  const copySha = (sha: string) => {
    navigator.clipboard?.writeText(sha).then(
      () => {
        setCopied(sha);
        setTimeout(() => setCopied(null), 1600);
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
          {labels.snapshot}
        </span>
      </div>

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
          {[winAsset, macAsset].map((asset) => asset && (
            <div key={asset.name} className="grid gap-2">
              <dt className="text-aibox-text2">{asset.name} · {labels.sha}</dt>
              <dd className="m-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <code className="mono-block break-all">{asset.sha256}</code>
                  <button type="button" className="badge cursor-pointer" onClick={() => copySha(asset.sha256)}>
                    {copied === asset.sha256 ? labels.copied : labels.copy}
                  </button>
                </div>
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 mb-0 text-xs text-aibox-text2">{labels.shaNote}</p>

      <p className="mt-4 mb-0 text-sm">
        <a
          href={release.htmlUrl}
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
