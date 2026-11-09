// aibox-site — Astro 5 静态站（默认零 JS）
// VI palette: logo-derived green (authoritative tokens in src/styles/global.css)
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // 静态输出：构建产物纯 HTML/CSS，直传 Cloudflare Pages（无 SSR 运行时）
  output: 'static',
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
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
  // TODO: 绑定 aibox.im 后补 site: 'https://aibox.im'（canonical/sitemap 依赖）
});
