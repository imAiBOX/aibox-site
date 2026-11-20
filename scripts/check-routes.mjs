// 双语缺页扫描：dist/en/<tail> 与 dist/zh/<tail> 必须成对（zh/en 无缺页）
// 用法: node scripts/check-routes.mjs   （build 后运行）
import { readdirSync, existsSync, statSync, readFileSync } from 'node:fs';
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

// —— AI 文档防过时断言：public/{llms.txt,agents.md,openapi.json} 提及的 app id 必须 ⊆ registry ids，
// 且三处声明的应用总数必须与 registry 一致（registry 新增应用未同步文档时在此拦截）。
// 前提：dist/meta/index.json 存在（构建时 registry 可达）；不可达 → 降级跳过（与 I1 容错一致）。 ——
const metaIndex = join(DIST, 'meta', 'index.json');
if (!existsSync(metaIndex)) {
  console.warn('[check-routes] meta/index.json 缺失（registry 构建时不可达）— 跳过 AI 文档断言');
  process.exit(0);
}
const regIds = new Set(
  (JSON.parse(readFileSync(metaIndex, 'utf8')).apps ?? [])
    .map((a) => (typeof a === 'string' ? a : a?.id))
    .filter((x) => typeof x === 'string' && x),
);
if (regIds.size === 0) {
  console.error('[check-routes] registry ids 为空 — 无法断言 AI 文档');
  process.exit(1);
}

const docErrors = [];
const llms = readFileSync('public/llms.txt', 'utf8');
const agents = readFileSync('public/agents.md', 'utf8');
const openapi = JSON.parse(readFileSync('public/openapi.json', 'utf8')); // 解析失败即抛 → exit 1

// 1) llms.txt 里的落地页链接 id（/apps/<id>/）必须真实存在
const llmsIds = [...llms.matchAll(/\/apps\/([A-Za-z0-9_-]+)\//g)].map((m) => m[1]);
for (const id of new Set(llmsIds)) if (!regIds.has(id)) docErrors.push(`llms.txt 提及不存在的 id: ${id}`);

// 2) agents.md example ids 必须真实存在
const exLine = agents.match(/example ids:\s*([a-z0-9][a-z0-9_-]*(?:\s*,\s*[a-z0-9][a-z0-9_-]*)*)/i);
if (exLine) {
  for (const id of new Set(exLine[1].split(/[,;\s]+/).map((s) => s.replace(/[^A-Za-z0-9_-]/g, '')).filter(Boolean))) {
    if (!regIds.has(id)) docErrors.push(`agents.md example id 不存在: ${id}`);
  }
} else docErrors.push('agents.md 缺 example ids 行');

// 3) openapi.json /meta/apps/{id}/app.json 的 example(s) 必须真实存在
const param = openapi.paths?.['/meta/apps/{id}/app.json']?.get?.parameters?.[0];
const oaIds = [param?.example, ...(param?.schema?.examples ?? [])].filter((x) => typeof x === 'string' && x);
if (!oaIds.length) docErrors.push('openapi.json 缺 id example');
for (const id of new Set(oaIds)) if (!regIds.has(id)) docErrors.push(`openapi.json example id 不存在: ${id}`);

// 4) 三处声明的应用总数必须与 registry 实际数量一致
const declared = [
  ['llms.txt', llms.match(/(\d+) apps in total/i)?.[1]],
  ['agents.md', agents.match(/Catalog size:\s*(\d+) apps/i)?.[1]],
  ['openapi.json', openapi.paths?.['/meta/apps/{id}/app.json']?.get?.description?.match(/lists (\d+) apps/i)?.[1]],
];
for (const [name, n] of declared) {
  if (!n) docErrors.push(`${name} 缺应用总数声明`);
  else if (Number(n) !== regIds.size) docErrors.push(`${name} 声明 ${n} 个应用，registry 实际 ${regIds.size} 个`);
}

// 4b) llms.txt 标题里的目录数字（`## App catalog (N apps)`）也要一致 ——
// 2026-11-20 实测踩坑：只改了 "N apps in total"，标题仍写着 21 → 同一文件自相矛盾。
const llmsHeading = llms.match(/^##\s*App catalog \((\d+) apps\)/im)?.[1];
if (!llmsHeading) docErrors.push('llms.txt 缺 "## App catalog (N apps)" 标题声明');
else if (Number(llmsHeading) !== regIds.size)
  docErrors.push(`llms.txt 标题声明 ${llmsHeading} 个应用，registry 实际 ${regIds.size} 个`);

// 4c) llms-full.txt（构建产物）也必须声明同一个数字 —— 此前完全不被校验。
// 读取 dist/llms-full.txt（gen-meta 生成）；不存在则跳过（构建顺序问题不误报）。
try {
  const full = readFileSync(join(DIST, 'llms-full.txt'), 'utf8');
  const fullN = full.match(/(\d+) apps in total/i)?.[1];
  if (!fullN) docErrors.push('llms-full.txt 缺应用总数声明');
  else if (Number(fullN) !== regIds.size)
    docErrors.push(`llms-full.txt 声明 ${fullN} 个应用，registry 实际 ${regIds.size} 个`);
} catch {
  // 未生成（本地未跑 gen-meta）→ 跳过
}

// 4d) AI 文档不得把 macOS 描述成「未发布 / planned / coming」——
// 2026-11-20 实测踩坑：macOS 版早已发布，FAQ 仍写 "macOS build is next"。
const staleMac = [
  ['llms.txt', llms],
  ['agents.md', agents],
].filter(([, t]) => /macos[^.\n]{0,40}(planned|coming|not yet|is next)|\bplanned\b[^.\n]{0,20}macos/i.test(t));
if (staleMac.length) {
  for (const [name] of staleMac) docErrors.push(`${name} 把 macOS 描述成尚未发布（与实际已发布双平台矛盾）`);
}

// 4e) AI 文档提及的 release 资产必须含 macOS dmg（避免只提 exe 让 agent 以为没有 Mac 版）
for (const [name, t] of [['llms.txt', llms], ['agents.md', agents]]) {
  if (/AiBOX-vX\.Y\.Z-windows-x64\.exe/.test(t) && !/macos-universal\.dmg/.test(t)) {
    docErrors.push(`${name} 只列了 Windows 资产，漏了 macOS dmg`);
  }
}

if (docErrors.length) {
  console.error(`[check-routes] AI 文档断言 FAIL — ${docErrors.length} 项:`);
  for (const e of docErrors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`[check-routes] OK — AI 文档 id ⊆ registry（${regIds.size} 个应用）且总数一致`);
