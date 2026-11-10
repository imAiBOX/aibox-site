// aibox-site — Astro 5 静态站（默认零 JS，下载页一个 React 岛）
// VI palette: logo-derived green (authoritative tokens in src/styles/global.css)
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // 静态输出：构建产物纯 HTML/CSS，直传 Cloudflare Pages（无 SSR 运行时）
  output: 'static',
  // 生产域做 canonical/hreflang/sitemap 规范（开发期在 pages.dev，域名后续接管）
  site: 'https://aibox.im',
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh'],
    routing: {
      // 前缀式路由：/en/ /zh/（默认 en 也在前缀后，根 / 由 CF Function 302 分流）
      prefixDefaultLocale: true,
      // 根路径交给 functions/index.ts（Accept-Language 302）；静态兜底页在 src/pages/index.astro
      redirectToDefaultLocale: false,
    },
  },
  integrations: [
    react(),
    sitemap({
      // hreflang 互指（sitemap 内 xhtml:link）；根分流页 noindex 不进 sitemap
      i18n: {
        defaultLocale: 'en',
        locales: { en: 'en', zh: 'zh' },
      },
      filter: (page) => page !== 'https://aibox.im/',
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
