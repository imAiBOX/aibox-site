import type { ReactNode } from 'react';

// 占位下载按钮（React 岛，当前为服务端静态渲染 → 默认零 JS）
//
// TODO：
//   1. 加 client:load 变为真岛，运行时 fetch
//      https://api.github.com/repos/imAiBOX/aibox-app/releases/latest
//      拿最新版本号与安装包直链（匿名限流 60/h/IP，零依赖原则）；
//   2. localStorage 5 分钟缓存，每会话 ≤2 次调用；
//   3. 页面切到中文时按钮文案走 i18n dict（不写死）。
// 现在只渲染静态占位，不发任何请求。
export default function DownloadButton({
  label = 'Download AiBOX',
  hint = 'Windows · macOS · portable',
  version = 'v0.0.x',
}: {
  label?: string;
  hint?: string;
  version?: string;
}): ReactNode {
  return (
    <a className="btn-cta" href="#download-note" data-placeholder="true">
      <span>{label}</span>
      <span className="mono">{version}</span>
      <span className="mono" aria-hidden="true" style={{ opacity: 0.6 }}>
        {hint}
      </span>
    </a>
  );
}
