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
  category?: string;
  /** index.json 的本地化 tagline：{ 'zh-CN': ..., en: ... } */
  tagline?: Record<string, string>;
};

/** 有独立落地页的应用 id（新增落地页时在此登记，卡片才挂链接避免 404） */
export const LANDING_APP_IDS = ['openclaw'];

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
  const category = str(o.category) ?? str(o.kind) ?? str(meta.category);

  let tagline: Record<string, string> | undefined;
  if (o.tagline && typeof o.tagline === 'object' && !Array.isArray(o.tagline)) {
    tagline = {};
    for (const [k, v] of Object.entries(o.tagline as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) tagline[k] = v.trim();
    }
    if (!Object.keys(tagline).length) tagline = undefined;
  }

  return {
    id: id ?? name,
    name,
    summary: str(o.summary) ?? str(o.description) ?? (typeof o.tagline === 'string' ? o.tagline : undefined),
    difficulty,
    platforms,
    status,
    category,
    tagline,
  };
}

/** 卡片一句话：按语言取本地化 tagline，回落 summary / en */
export function taglineFor(app: RegistryApp, lang: 'en' | 'zh'): string | undefined {
  if (app.summary) return app.summary;
  const t = app.tagline;
  if (!t) return undefined;
  if (lang === 'zh') return t['zh-CN'] ?? t.zh ?? t.en;
  return t.en ?? t['zh-CN'] ?? t.zh;
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

// —— 应用详情（apps/<id>/app.json：落地页用 runtime/version/upstream/modelProviders） ——
export type AppProvider = { id: string; authType?: string; getKeyUrl?: string; configTarget?: string };
export type AppDetail = {
  id: string;
  name: string;
  version?: string;
  updatedAt?: string;
  /** 本地化描述：{ 'zh-CN': ..., en: ... } */
  description?: Record<string, string>;
  runtime?: { node?: { recommended?: string; supported?: string; disallowed?: string[]; note?: string } };
  configTarget?: string;
  providers?: AppProvider[];
  upstreamGithub?: { repo: string; tag: string }[];
  upstreamNpm?: { name: string; version: string };
  live: boolean;
};

// 详情降级占位（registry 不可达时用；仅展示层兜底，构建绝不允许炸）
const FALLBACK_DETAILS: Record<string, AppDetail> = {
  openclaw: {
    id: 'openclaw',
    name: 'OpenClaw',
    runtime: {
      node: {
        recommended: '>=26.12.1',
        supported: '>=24.22.1 <25',
        disallowed: ['22.x', '23.x', '25.x'],
      },
    },
    configTarget: '~/.config/openclaw/openclaw.json5',
    providers: [
      { id: 'openrouter', authType: 'api-key', getKeyUrl: 'https://openrouter.ai/keys' },
      { id: 'anthropic', authType: 'api-key', getKeyUrl: 'https://console.anthropic.com/settings/keys' },
      { id: 'openai', authType: 'api-key', getKeyUrl: 'https://platform.openai.com/api-keys' },
      { id: 'google', authType: 'api-key', getKeyUrl: 'https://aistudio.google.com/apikey' },
      { id: 'claude-oauth', authType: 'oauth', getKeyUrl: 'https://claude.ai/' },
      { id: 'ollama', authType: 'local', getKeyUrl: 'https://ollama.com/download' },
    ],
    live: false,
  },
};

function detailSources(id: string): string[] {
  const enc = encodeURIComponent(id);
  return [
    `https://raw.githubusercontent.com/imAiBOX/aibox-registry/main/apps/${enc}/app.json`,
    `https://cdn.jsdelivr.net/gh/imAiBOX/aibox-registry@main/apps/${enc}/app.json`,
  ];
}

function strArr(v: unknown): string[] | undefined {
  if (Array.isArray(v)) {
    const a = v.filter((x): x is string => typeof x === 'string' && !!x.trim());
    return a.length ? a : undefined;
  }
  return undefined;
}

function parseDetail(id: string, raw: unknown): AppDetail | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const name = str(o.name) ?? id;

  const description =
    o.description && typeof o.description === 'object' && !Array.isArray(o.description)
      ? (Object.fromEntries(
          Object.entries(o.description as Record<string, unknown>).filter(([, v]) => typeof v === 'string' && !!v.trim()),
        ) as Record<string, string>)
      : undefined;

  const rt = o.runtime && typeof o.runtime === 'object' ? (o.runtime as Record<string, unknown>) : {};
  const nodeRaw = rt.node && typeof rt.node === 'object' ? (rt.node as Record<string, unknown>) : {};
  // disallowed/note 在 runtime 层级（非 runtime.node 下），两层都查
  const disallowed = strArr(nodeRaw.disallowed) ?? strArr(rt.disallowed);
  const node = {
    recommended: typeof nodeRaw.recommended === 'string' ? nodeRaw.recommended : undefined,
    supported: typeof nodeRaw.supported === 'string' ? nodeRaw.supported : undefined,
    disallowed,
    note: typeof nodeRaw.note === 'string' ? nodeRaw.note : typeof rt.note === 'string' ? rt.note : undefined,
  };
  const runtime = node.recommended || node.supported || node.disallowed ? { node } : undefined;

  let providers: AppProvider[] | undefined;
  if (o.modelProviders && typeof o.modelProviders === 'object' && !Array.isArray(o.modelProviders)) {
    providers = Object.entries(o.modelProviders as Record<string, unknown>).map(([pid, v]) => {
      const p = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
      return {
        id: pid,
        authType: typeof p.authType === 'string' ? p.authType : undefined,
        getKeyUrl: typeof p.getKeyUrl === 'string' ? p.getKeyUrl : undefined,
        configTarget: typeof p.configTarget === 'string' ? p.configTarget : undefined,
      };
    });
  }

  const dataPaths =
    o.maintenance && typeof o.maintenance === 'object'
      ? strArr((o.maintenance as Record<string, unknown>).dataPaths)
      : undefined;
  const configTarget = providers?.find((p) => p.configTarget)?.configTarget ?? dataPaths?.[0];

  const up = o.upstream && typeof o.upstream === 'object' ? (o.upstream as Record<string, unknown>) : {};
  let upstreamGithub: { repo: string; tag: string }[] | undefined;
  if (Array.isArray(up.github)) {
    upstreamGithub = up.github
      .map((x) => {
        const g = x && typeof x === 'object' ? (x as Record<string, unknown>) : {};
        return { repo: typeof g.repo === 'string' ? g.repo : '', tag: typeof g.tag === 'string' ? g.tag : '' };
      })
      .filter((x) => x.repo);
    if (!upstreamGithub.length) upstreamGithub = undefined;
  }
  let upstreamNpm: { name: string; version: string } | undefined;
  if (up.npm && typeof up.npm === 'object') {
    const n = up.npm as Record<string, unknown>;
    if (typeof n.name === 'string') upstreamNpm = { name: n.name, version: typeof n.version === 'string' ? n.version : '' };
  }

  return {
    id,
    name,
    version: str(o.version),
    updatedAt: str(o.updatedAt),
    description,
    runtime,
    configTarget,
    providers,
    upstreamGithub,
    upstreamNpm,
    live: true,
  };
}

const detailPending = new Map<string, Promise<AppDetail>>();

export function fetchAppDetail(id: string): Promise<AppDetail> {
  const memo = detailPending.get(id);
  if (memo) return memo;
  const p = (async (): Promise<AppDetail> => {
    for (const url of detailSources(id)) {
      try {
        const res = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
        if (!res.ok) continue;
        const detail = parseDetail(id, await res.json());
        if (detail) return detail;
      } catch {
        // 换下一个源；全挂则用占位
      }
    }
    const fb = FALLBACK_DETAILS[id];
    return fb ?? { id, name: id, live: false };
  })();
  detailPending.set(id, p);
  return p;
}

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
