// 极简 Markdown → HTML 渲染器（零依赖，站内教程 registry guides/*.md 专用子集）
// 支持：`# ` 一级跳过（页内已有 hero）、`##`/`###` 标题、段落（软换行合并）、
// `- ` 无序列表、`1.` 有序列表、**粗体**、`行内代码`、[文字](url)、裸 URL、
// `> ` 引用、``` 代码块、`---` 分隔线、| 管道表格 |
// 安全：先整体转义 <>&" 再套标记（原始 HTML 一律中和）；链接协议白名单（http/https/站内路径/mailto）。

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SAFE_HREF = /^(https?:\/\/|\/|#|mailto:)/i;

/** 行内标记（对已转义文本套标记；code/link 先占位，避免互相污染） */
function inline(text: string): string {
  const stash: string[] = [];
  const keep = (html: string): string => `\u0000${stash.push(html) - 1}\u0000`;

  let s = escapeHtml(text);

  // 1) 行内代码（最内层，先摘出来）
  s = s.replace(/`([^`]+)`/g, (_m, code: string) => keep(`<code>${code}</code>`));

  // 2) 链接 [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => {
    if (!SAFE_HREF.test(href)) return label; // 协议不白名单 → 只留文字
    const external = /^https?:/i.test(href);
    return keep(`<a href="${href}"${external ? ' rel="noopener noreferrer nofollow" target="_blank"' : ''}>${label}</a>`);
  });

  // 3) 粗体
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // 4) 裸 URL（避开已在属性/标签里的）
  s = s.replace(/(?<!["'>\\])https?:\/\/[^\s<]+/g, (m) => {
    const trimmed = m.replace(/[.,;:!?)）」]+$/, '');
    const tail = m.slice(trimmed.length);
    return keep(`<a href="${trimmed}" rel="noopener noreferrer nofollow" target="_blank">${trimmed}</a>`) + tail;
  });

  // 5) 还原占位（占位可能嵌套，循环到稳定）
  for (let guard = 0; guard < 10; guard++) {
    const before = s;
    s = s.replace(/\u0000(\d+)\u0000/g, (_m, n: string) => stash[Number(n)] ?? '');
    if (s === before) break;
  }
  return s;
}

const splitRow = (row: string): string[] =>
  row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());

/** 渲染教程正文 → 安全 HTML 字符串 */
export function renderMd(md: string): string {
  if (!md || !md.trim()) return '';
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${inline(para.join(' '))}</p>`);
      para = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ``` 代码块
    if (/^```/.test(line.trim())) {
      flushPara();
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) body.push(lines[i++]);
      out.push(`<pre class="guide-code"><code>${escapeHtml(body.join('\n'))}</code></pre>`);
      continue;
    }

    if (!line.trim()) {
      flushPara();
      continue;
    }

    // --- 分隔线
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushPara();
      out.push('<hr />');
      continue;
    }

    // 标题
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushPara();
      const level = h[1].length;
      if (level === 1) continue; // 一级标题跳过（页内 hero 已给应用名）
      const tag = level === 2 ? 'h3' : 'h4';
      out.push(`<${tag}>${inline(h[2].trim())}</${tag}>`);
      continue;
    }

    // > 引用
    if (/^\s*>/.test(line)) {
      flushPara();
      const body: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, ''));
      i--;
      out.push(`<blockquote>${inline(body.join(' '))}</blockquote>`);
      continue;
    }

    // 表格（首行 | 开头 + 次行为 |---| 分隔行）
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      flushPara();
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(splitRow(lines[i++]));
      i--;
      const head = rows[0] ?? [];
      const body = rows.slice(2);
      out.push(
        `<div class="guide-table"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>` +
          `<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`,
      );
      continue;
    }

    // - 无序列表
    if (/^\s*[-*+]\s+/.test(line)) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*+]\s+/, ''));
      i--;
      out.push(`<ul>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>`);
      continue;
    }

    // 1. 有序列表
    if (/^\s*\d+[.)]\s+/.test(line)) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ''));
      i--;
      out.push(`<ol>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</ol>`);
      continue;
    }

    // 普通段落（软换行合并）
    para.push(line.trim());
  }
  flushPara();
  return out.join('\n');
}
