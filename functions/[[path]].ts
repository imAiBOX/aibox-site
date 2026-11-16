// Catch-all: www.aibox.im/* → 301 apex（根路径由 functions/index.ts 处理，这里兜子路径）。
// apex 上的未知路径保持原生 404 语义（返回 404.html 内容 + 404 状态，保住 SEO 友好页）。
export const onRequest: PagesFunction = async ({ request }): Response => {
  const url = new URL(request.url);
  const host = (request.headers.get('host') ?? url.hostname).toLowerCase();
  if (host.startsWith('www.')) {
    return Response.redirect(`https://aibox.im${url.pathname}`, 301);
  }
  try {
    const notFound = await fetch(new URL('/404.html', url));
    if (notFound.ok) {
      return new Response(await notFound.text(), {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
  } catch { /* fall through */ }
  return new Response('Not Found', { status: 404 });
};
