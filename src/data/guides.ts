// registry 教程正文（apps/<id>/guides/{en,zh-cn}.md）构建时拉取
// 容错红线：与 registry.ts 同款双源（raw → jsdelivr）+ 5s 超时；
// 任一语言失败给空串，全失败 → { en:'', zh:'', live:false }，**构建绝不允许炸**。
export type AppGuides = { en: string; zh: string; live: boolean };

const OWNER_REPO = 'imAiBOX/aibox-registry';
const BRANCH = 'main';

function sources(rel: string): string[] {
  const enc = rel.split('/').map(encodeURIComponent).join('/');
  return [
    `https://raw.githubusercontent.com/${OWNER_REPO}/${BRANCH}/${enc}`,
    `https://cdn.jsdelivr.net/gh/${OWNER_REPO}@${BRANCH}/${enc}`,
  ];
}

async function fetchText(rel: string): Promise<string | null> {
  for (const url of sources(rel)) {
    try {
      const res = await fetch(url, { headers: { accept: 'text/plain' }, signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const text = await res.text();
      if (text.trim()) return text;
    } catch {
      // 换下一个源
    }
  }
  return null;
}

const pending = new Map<string, Promise<AppGuides>>();

/** 拉某应用双语教程（模块 memo：双语页面共用一次拉取） */
export function fetchAppGuides(id: string): Promise<AppGuides> {
  const memo = pending.get(id);
  if (memo) return memo;
  const enc = encodeURIComponent(id);
  const p = (async (): Promise<AppGuides> => {
    const [en, zh] = await Promise.all([fetchText(`apps/${enc}/guides/en.md`), fetchText(`apps/${enc}/guides/zh-cn.md`)]);
    return { en: en ?? '', zh: zh ?? '', live: !!(en || zh) };
  })();
  pending.set(id, p);
  return p;
}
