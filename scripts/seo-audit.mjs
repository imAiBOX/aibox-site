// SEO 审计（一次性全量抽查 dist，build 后运行；缺项 exit 1）
// 覆盖：20 应用落地页（en+zh，含手写 openclaw）的 title/description/JSON-LD/hreflang/canonical/
//       StatsBadge 停用状态 + sitemap 收录。
// 用法: node scripts/seo-audit.mjs   （需先 pnpm build）
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const SITE = 'https://aibox.im';
if (!existsSync(join(DIST, 'en'))) {
  console.error('[seo-audit] dist/ 不存在或未构建，请先 pnpm build');
  process.exit(1);
}

const errors = [];
const err = (page, msg) => errors.push(`${page}: ${msg}`);

function jsonLdBlocks(html) {
  const out = [];
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      out.push(JSON.parse(m[1]));
    } catch {
      out.push({ __parseError: true });
    }
  }
  return out;
}

const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;

// —— 应用清单：以 dist/meta/index.json（registry 镜像）为准 ——
let ids = [];
const metaIndexPath = join(DIST, 'meta', 'index.json');
if (existsSync(metaIndexPath)) {
  const parsed = JSON.parse(readFileSync(metaIndexPath, 'utf8'));
  ids = (parsed.apps ?? []).map((a) => (typeof a === 'string' ? a : a?.id)).filter((x) => typeof x === 'string' && x);
} else {
  ids = readdirSync(join(DIST, 'en', 'apps')).filter((d) => existsSync(join(DIST, 'en', 'apps', d, 'index.html')));
}
if (ids.length === 0) {
  console.error('[seo-audit] 未找到任何应用 id（meta/index.json 缺失且 dist/en/apps 为空）');
  process.exit(1);
}

const sitemap = existsSync(join(DIST, 'sitemap.xml')) ? readFileSync(join(DIST, 'sitemap.xml'), 'utf8') : '';

for (const id of ids) {
  for (const lang of ['en', 'zh']) {
    const page = `/${lang}/apps/${id}/`;
    const file = join(DIST, lang, 'apps', id, 'index.html');
    if (!existsSync(file)) {
      err(page, '缺落地页文件');
      continue;
    }
    const html = readFileSync(file, 'utf8');

    // title / description（en 底线更长；title 上限只拦离谱值，不改手写页措辞）
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
    if (!nonEmpty(title)) err(page, 'title 为空');
    else if (!title.includes('aibox.im')) err(page, `title 未含 aibox.im: ${title}`);
    else if (title.length < 15 || title.length > 75) err(page, `title 长度异常(${title.length}): ${title}`);
    const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
    const minDesc = lang === 'en' ? 70 : 40;
    if (!nonEmpty(desc)) err(page, 'meta description 为空');
    else if (desc.length < minDesc) err(page, `description 过短(${desc.length} < ${minDesc}): ${desc}`);

    // canonical
    const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? '';
    if (canonical !== `${SITE}${page}`) err(page, `canonical 不符: ${canonical}`);

    // hreflang 三件套
    const hreflangs = {};
    for (const m of html.matchAll(/<link rel="alternate" hreflang="([^"]*)" href="([^"]*)"/g)) hreflangs[m[1]] = m[2];
    if (hreflangs.en !== `${SITE}/en/apps/${id}/`) err(page, `hreflang en 不符: ${hreflangs.en}`);
    if (hreflangs.zh !== `${SITE}/zh/apps/${id}/`) err(page, `hreflang zh 不符: ${hreflangs.zh}`);
    if (hreflangs['x-default'] !== `${SITE}/en/apps/${id}/`) err(page, `hreflang x-default 不符: ${hreflangs['x-default']}`);

    // JSON-LD
    const blocks = jsonLdBlocks(html);
    const bad = blocks.filter((b) => b.__parseError).length;
    if (bad) err(page, `${bad} 个 JSON-LD 解析失败`);
    const sw = blocks.find((b) => b['@type'] === 'SoftwareApplication');
    if (!sw) err(page, '缺 SoftwareApplication JSON-LD');
    else {
      if (!nonEmpty(sw.name)) err(page, 'SoftwareApplication.name 为空');
      if (!nonEmpty(sw.description)) err(page, 'SoftwareApplication.description 为空');
      if (!nonEmpty(sw.applicationCategory)) err(page, 'SoftwareApplication.applicationCategory 为空');
      if (!nonEmpty(sw.url)) err(page, 'SoftwareApplication.url 为空');
    }
    const faq = blocks.find((b) => b['@type'] === 'FAQPage');
    if (!faq) err(page, '缺 FAQPage JSON-LD');
    else {
      const items = faq.mainEntity;
      if (!Array.isArray(items) || items.length === 0) err(page, 'FAQPage.mainEntity 为空');
      else {
        for (const [i, q] of items.entries()) {
          if (!nonEmpty(q.name)) err(page, `FAQ 问题${i + 1} name 为空`);
          if (!nonEmpty(q.acceptedAnswer?.text)) err(page, `FAQ 问题${i + 1} answer 为空`);
        }
      }
    }

    // StatsBadge remains present without event-reporting hooks.
    if (!html.includes('data-stats-app=')) err(page, '缺应用统计暂停提示');
    if (html.includes('data-stats-report=') || html.includes('/api/stats')) err(page, '页面仍包含统计上报钩子');

    // sitemap 收录
    if (sitemap && !sitemap.includes(`${SITE}${page}`)) err(page, 'sitemap.xml 未收录');
  }
}

if (errors.length) {
  console.error(`[seo-audit] FAIL — ${errors.length} 项问题（${ids.length} 应用 × 2 语言）:`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`[seo-audit] OK — ${ids.length} 应用 × 2 语言全量通过（title/description/JSON-LD/hreflang/canonical/StatsBadge/sitemap）`);
