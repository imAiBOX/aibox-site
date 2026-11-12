#!/usr/bin/env node
// 构建后把 aibox-registry 快照镜像到 dist/meta/（官网副通道，供安装器在国内拉目录）。
//
// 路径约定（与 aibox-app crates/aibox-core/src/registry.rs 的 source_urls("aibox-im")
// **两端必须一致**）：registry <rel> ↔ https://aibox.im/meta/<rel> ↔ dist/meta/<rel>
//   index.json            → dist/meta/index.json
//   apps/<id>/app.json    → dist/meta/apps/<id>/app.json
//   locales/<lang>.json   → dist/meta/locales/<lang>.json
//
// 容错红线：registry 不可达/内容不合法 → 只告警跳过（meta 缺文件可接受），
// 构建绝不允许炸（与站内 I1 降级一致）。
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const DIST_META = join('dist', 'meta');
const OWNER_REPO = 'imAiBOX/aibox-registry';
const BRANCH = 'main';
// 与站内 src/data/registry.ts 同款双源（raw → jsdelivr）
const SOURCES = [
  (rel) => `https://raw.githubusercontent.com/${OWNER_REPO}/${BRANCH}/${rel}`,
  (rel) => `https://cdn.jsdelivr.net/gh/${OWNER_REPO}@${BRANCH}/${rel}`,
];

/** 拉取 registry 文件原文（双源轮询，全挂 → null） */
async function fetchText(rel) {
  for (const url of SOURCES.map((f) => f(rel))) {
    try {
      const res = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      return await res.text();
    } catch {
      // 换下一个源
    }
  }
  return null;
}

function write(rel, text) {
  const p = join(DIST_META, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
  console.log(`[gen-meta] ${rel} (${Buffer.byteLength(text)} B)`);
}

/** 拉取 + JSON 合法性校验；失败 → null（告警由调用方负责） */
async function fetchJsonText(rel) {
  const text = await fetchText(rel);
  if (text === null) return null;
  try {
    JSON.parse(text);
    return text;
  } catch (e) {
    console.warn(`[gen-meta] warn: ${rel} is not valid JSON (${e.message}) — skipped`);
    return null;
  }
}

if (!existsSync('dist')) {
  console.warn('[gen-meta] dist/ 不存在 — run astro build first; skip');
  process.exit(0);
}

const index = await fetchJsonText('index.json');
if (index === null) {
  console.warn('[gen-meta] registry index unreachable — meta omitted (degraded, build ok)');
  process.exit(0);
}
write('index.json', index);

// 应用清单：index.apps 列表驱动（条目为字符串或 {id} 对象）
let ids = [];
try {
  const parsed = JSON.parse(index);
  const list = Array.isArray(parsed.apps) ? parsed.apps : [];
  ids = list
    .map((a) => (typeof a === 'string' ? a : a && typeof a === 'object' ? a.id : undefined))
    .filter((x) => typeof x === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(x));
} catch {
  // index 已过 JSON.parse，此处仅防御
}
for (const id of ids) {
  const rel = `apps/${id}/app.json`;
  const text = await fetchJsonText(rel);
  if (text === null) {
    console.warn(`[gen-meta] warn: ${rel} unavailable — skipped`);
    continue;
  }
  write(rel, text);
}

// 语言包（registry 语言包热加载用；缺失语言由安装器回退内置）
for (const lang of ['en', 'zh-CN']) {
  const rel = `locales/${lang}.json`;
  const text = await fetchJsonText(rel);
  if (text === null) {
    console.warn(`[gen-meta] warn: ${rel} unavailable — skipped`);
    continue;
  }
  write(rel, text);
}


// sitemap: @astrojs/sitemap 产 index+分片；复制分片为惯例单文件（robots.txt 引用的 /sitemap.xml）
try {
  const { readFileSync, copyFileSync, existsSync } = await import('node:fs');
  const shard = new URL('../dist/sitemap-0.xml', import.meta.url);
  const out = new URL('../dist/sitemap.xml', import.meta.url);
  if (existsSync(shard)) {
    copyFileSync(shard, out);
    const xml = readFileSync(out, 'utf8');
    if (!xml.includes('https://aibox.im/')) throw new Error('sitemap.xml missing production URLs');
    console.log('[gen-meta] sitemap.xml written (single-file)');
  } else {
    console.warn('[gen-meta] warn: sitemap-0.xml not found — skipped sitemap.xml');
  }
} catch (e) {
  console.warn('[gen-meta] warn: sitemap finalize failed —', e.message);
}

console.log(`[gen-meta] done — index + ${ids.length} app(s) + locales under ${DIST_META}`);
