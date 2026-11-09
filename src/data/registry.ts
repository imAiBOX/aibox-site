// 构建时拉取 aibox-registry（I1 不变式：官网内容源 = GitHub 唯一 SSOT）
// 容错红线：registry 仓刚建/内容由并行任务填充，任何失败（404/超时/格式不符）
// 必须降级为内置占位数据，**构建绝不允许炸**。
export type RegistryApp = {
  id: string;
  name: string;
  summary?: string;
  difficulty?: number; // 1..5
  platforms?: string[];
  status?: string;
};

// 内置占位（与并行 registry 任务的 openclaw/hermes-agent 对齐，字段仅作展示）
const FALLBACK_APPS: RegistryApp[] = [
  { id: 'openclaw', name: 'OpenClaw', summary: 'Open-source AI agent', difficulty: 2, platforms: ['win', 'mac'], status: 'preview' },
  { id: 'hermes-agent', name: 'Hermes agent', summary: 'Desktop AI assistant', difficulty: 3, platforms: ['win'], status: 'planned' },
];

const SOURCES = [
  'https://raw.githubusercontent.com/imAiBOX/aibox-registry/main/index.json',
  'https://cdn.jsdelivr.net/gh/imAiBOX/aibox-registry@main/index.json',
];

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function normalizeApp(raw: unknown, fallbackId?: string): RegistryApp | null {
  if (typeof raw === 'string') {
    const id = raw.trim();
    if (!id) return null;
    return { id, name: id };
  }
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const meta = (o.meta && typeof o.meta === 'object' ? o.meta : {}) as Record<string, unknown>;
  const id = str(o.id) ?? str(o.slug) ?? fallbackId;
  const name = str(o.name) ?? str(o.title) ?? (id ? id.replace(/(^|[-_])\w/g, (m) => m.replace(/[-_]/, '').toUpperCase()) : undefined);
  if (!name) return null;

  let difficulty: number | undefined;
  const d = o.difficulty ?? o.level ?? meta.difficulty;
  if (typeof d === 'number' && d >= 1 && d <= 5) difficulty = d;
  else if (typeof d === 'string' && /^\d$/.test(d)) difficulty = Number(d);

  let platforms: string[] | undefined;
  const p = o.platforms ?? o.platform ?? o.targets ?? o.os;
  if (Array.isArray(p)) platforms = p.filter((x): x is string => typeof x === 'string');
  else if (typeof p === 'string') platforms = [p];

  const status = str(o.status) ?? str(o.state) ?? str(meta.status);

  return { id: id ?? name, name, summary: str(o.summary) ?? str(o.description) ?? str(o.tagline), difficulty, platforms, status };
}

function normalize(data: unknown): RegistryApp[] | null {
  // 支持形态：{ apps: [...] } | { apps: { id: {...} } } | [ ... ] | { index: [...] }
  let list: unknown;
  if (Array.isArray(data)) list = data;
  else if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    list = o.apps ?? o.index ?? o.entries;
  }
  if (Array.isArray(list)) {
    const apps = list.map((x) => normalizeApp(x)).filter((x): x is RegistryApp => x !== null);
    return apps.length ? apps : null;
  }
  if (list && typeof list === 'object') {
    const apps = Object.entries(list as Record<string, unknown>)
      .map(([k, v]) => normalizeApp(v, k))
      .filter((x): x is RegistryApp => x !== null);
    return apps.length ? apps : null;
  }
  return null;
}

export type RegistryResult = { apps: RegistryApp[]; live: boolean; source?: string };

// 模块级 memo：多个页面共用一次拉取（构建时执行一次）
let pending: Promise<RegistryResult> | null = null;

export function fetchRegistry(): Promise<RegistryResult> {
  pending ??= (async () => {
    for (const url of SOURCES) {
      try {
        const res = await fetch(url, {
          headers: { accept: 'application/json' },
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) continue;
        const data = await res.json();
        const apps = normalize(data);
        if (apps) return { apps, live: true, source: url };
      } catch {
        // 降级：换下一个源，全挂则用占位数据
      }
    }
    return { apps: FALLBACK_APPS, live: false };
  })();
  return pending;
}
