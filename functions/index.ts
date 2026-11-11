// CF Pages Function —— 根路径 `/` 语言分流（轻量实现，不引框架）
// 国际版产品策略：默认英文（一律 302 到 /en/）；中文可选，由页面内语言切换按钮进入 /zh/。
// 静态兜底：src/pages/index.astro（meta refresh → /en/），Function 失效也不 404。

export const onRequest: PagesFunction = (): Response => {
  return Response.redirect(new URL('/en/', 'https://aibox.im'), 302);
};
