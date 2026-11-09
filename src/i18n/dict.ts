// i18n 双语字典（en 基线；语言包最终 registry 化）
// 约定：en 为基线语言（key 必须齐全），zh 回落 en。

export type Lang = 'en' | 'zh';

export const LANGS: Lang[] = ['en', 'zh'];

export const langLabel: Record<Lang, string> = { en: 'English', zh: '中文' };

const en = {
  brand: 'AiBOX.im',
  brandSub: 'Portable AI toolbox',
  nav: { catalog: 'App catalog', download: 'Download' },
  hero: {
    title: 'Installed until it works.',
    lede: 'AiBOX installs desktop tools for you — from a fresh PC to a real model reply. No terminal, no admin rights, no guessing what to type next.',
    cta: 'Download AiBOX',
    ctaHint: 'Windows · macOS · portable, nothing to install',
    secondary: 'Browse the app catalog',
    botAlt: 'Pixel robot placeholder',
  },
  steps: {
    title: 'Three steps. That is all.',
    items: [
      { t: 'Download AiBOX', d: 'One portable file per platform. Double-click it and it runs — no installer, no admin prompt.' },
      { t: 'Pick an app', d: 'Choose from the catalog. AiBOX checks what your machine already has before touching anything.' },
      { t: 'Follow the clicks', d: 'It installs in order, fills in your API key, and verifies the app really answers.' },
    ],
    done: 'done',
  },
  catalog: {
    title: 'App catalog',
    lede: 'Rendered at build time from the public aibox-registry repository — the same data source the installer reads.',
    sourceLive: 'live · from registry',
    sourceFallback: 'placeholder · registry unavailable',
    difficulty: 'Difficulty',
    platforms: 'Platforms',
    status: 'Status',
    empty: 'No apps published yet — the registry is still being filled in.',
    difficultyLevel: (n: number) => `${n} / 5`,
  },
  footer: {
    phase: 'static site skeleton.',
    copy: 'AiBOX.im · data from GitHub, served as static HTML.',
  },
} ;

type Dict = typeof en;

const zh: Dict = {
  brand: 'AiBOX.im',
  brandSub: '智能盒子',
  nav: { catalog: '应用目录', download: '下载' },
  hero: {
    title: '装到能用为止。',
    lede: 'AiBOX 帮你把桌面工具真正装好——从一台新电脑到模型回复第一条消息。不开终端、不要管理员权限、不用猜下一步该敲什么。',
    cta: '下载 AiBOX',
    ctaHint: 'Windows · macOS · 绿色免安装',
    secondary: '先逛逛应用目录',
    botAlt: '像素机器人占位图',
  },
  steps: {
    title: '一共三步。',
    items: [
      { t: '下载 AiBOX', d: '每个平台一个便携文件，双击即用——没有安装器，也不弹管理员权限。' },
      { t: '选一个应用', d: '从目录里挑一个。AiBOX 先体检本机已有环境，再决定装什么。' },
      { t: '跟着点下去', d: '按序自动安装、帮你填好 key，最后真实验证它能用。' },
    ],
    done: '完成',
  },
  catalog: {
    title: '应用目录',
    lede: '构建时从公开仓库 aibox-registry 拉取——与安装器读取的是同一份数据源。',
    sourceLive: '实时 · 来自 registry',
    sourceFallback: '占位 · registry 暂不可用',
    difficulty: '难度',
    platforms: '平台',
    status: '状态',
    empty: '暂无已发布应用——registry 还在填充中。',
    difficultyLevel: (n: number) => `${n} / 5`,
  },
  footer: {
    phase: '静态站骨架。',
    copy: 'AiBOX.im · 数据来自 GitHub，纯静态 HTML 输出。',
  },
};

export const dict: Record<Lang, Dict> = { en, zh };

export function t(lang: Lang): Dict {
  return dict[lang] ?? dict.en;
}
