// CF Pages Function —— 根路径 `/` 分流：
//   * Host=www.aibox.im → 301 到 https://aibox.im/（www→apex 规范跳转，SEO 防重复收录）
//   * 其余 Host → 默认英文 302 到 /en/（国际版策略；中文经页头切换进入 /zh/）
// 静态兜底：src/pages/index.astro（meta refresh → /en/），Function 失效也不 404。

export const onRequest: PagesFunction = ({ request }): Response => {
  const url = new URL(request.url);
  const host = (request.headers.get('host') ?? url.hostname).toLowerCase();
  if (host.startsWith('www.')) {
    return Response.redirect(`https://aibox.im${url.pathname === '/' ? '/' : url.pathname}`, 301);
  }
  return Response.redirect(new URL('/en/', 'https://aibox.im'), 302);
};
