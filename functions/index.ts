// CF Pages Function —— 根路径 `/` 语言分流（轻量实现，不引框架）
// 读 Accept-Language → 302 到 /zh/ 或 /en/（en 兜底 = 默认语言）。
// 静态兜底：src/pages/index.astro（meta refresh → /en/），Function 失效也不 404。
// 绑 aibox.im 后可细化（多语言扩展、缓存头、跳转参数记忆）。

function pickLocale(header: string | null): 'zh' | 'en' {
  if (!header) return 'en';
  const ranked = header
    .split(',')
    .map((part) => {
      const [tag = '', qPart] = part.trim().split(';q=');
      const q = qPart ? Number.parseFloat(qPart) : 1;
      return { tag: tag.toLowerCase().trim(), q: Number.isFinite(q) ? q : 0 };
    })
    .filter((x) => x.tag)
    .sort((a, b) => b.q - a.q);
  for (const { tag } of ranked) {
    if (tag.startsWith('zh')) return 'zh';
    if (tag.startsWith('en') || tag === '*') return 'en';
  }
  return 'en';
}

export const onRequest: PagesFunction = ({ request }): Response => {
  const locale = pickLocale(request.headers.get('Accept-Language'));
  return Response.redirect(new URL(`/${locale}/`, request.url), 302);
};
