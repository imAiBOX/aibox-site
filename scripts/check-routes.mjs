// 双语缺页扫描：dist/en/<tail> 与 dist/zh/<tail> 必须成对（zh/en 无缺页）
// 用法: node scripts/check-routes.mjs   （build 后运行）
import { readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
if (!existsSync(DIST)) {
  console.error('[check-routes] dist/ 不存在，请先 pnpm build');
  process.exit(1);
}

/** 收集某语言下所有页面 tail（相对语言根的路径） */
function collectTails(lang) {
  const root = join(DIST, lang);
  const tails = new Set();
  if (!existsSync(root)) return tails;
  const walk = (dir, rel) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const r = rel ? `${rel}/${name}` : name;
      if (statSync(p).isDirectory()) {
        if (existsSync(join(p, 'index.html'))) tails.add(r);
        walk(p, r);
      }
    }
  };
  walk(root, '');
  return tails;
}

const en = collectTails('en');
const zh = collectTails('zh');
const missingZh = [...en].filter((t) => !zh.has(t));
const missingEn = [...zh].filter((t) => !en.has(t));

console.log(`[check-routes] en=${en.size} zh=${zh.size}`);
let fail = false;
if (missingZh.length) {
  console.error('[check-routes] 缺 zh 页:', missingZh.join(', '));
  fail = true;
}
if (missingEn.length) {
  console.error('[check-routes] 缺 en 页:', missingEn.join(', '));
  fail = true;
}
if (fail) process.exit(1);
console.log('[check-routes] OK — 双语页面全部成对');
