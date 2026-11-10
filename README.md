# aibox-site — AiBOX.im 官网

AiBOX.im（中文名：智能盒子）的官方网站源码。**Astro 5 + Tailwind CSS 4 静态输出，默认零 JS**，
构建产物直传 Cloudflare Pages：i18n 双首页 + VI 绿色系 + registry 构建时拉取。

## 部署（Cloudflare Pages）

- CI：`.github/workflows/deploy.yml`，**仓库内零凭据**，凭据在 GitHub Secrets：
  - `CF_API_TOKEN`（CF 账户级令牌）、`CF_ACCOUNT_ID`
- 触发链：
  1. `push main` → `pnpm install && pnpm build` → `npx --yes wrangler@4.62.0 pages deploy dist --project-name=aibox-site --branch=main`
  2. `repository_dispatch: registry-updated` → 同部署（registry 仓 push 后发此事件，重建拉最新数据）
  3. `schedule` 每日一次（UTC 03:47）兜底重建 —— Pages 构建 500 次/月配额，日 1 次 ≈30/月，安全
  4. `workflow_dispatch` 手动触发
- 部署项目名：**`aibox-site`**，预览域名：**`https://aibox-site.pages.dev`**
- 本地手动部署（等价 CI，token 只经环境变量注入，不入库）：

  ```bash
  pnpm install && pnpm build
  CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… \
    npx --yes wrangler@4.62.0 pages deploy dist --project-name=aibox-site --branch=main
  ```

> 红线：**本阶段绝不绑 aibox.im 自定义域名**，只用 `*.pages.dev`（域名后续接管）。

## i18n 约定

- **前缀式路由**：`/en/`、`/zh/`，**默认 en**（Astro `i18n.routing.prefixDefaultLocale: true`）
- **根路径 `/` 分流**：
  - 首选 `functions/index.ts`（CF Pages Function）读 `Accept-Language` → 302 到 `/zh/` 或 `/en/`（en 兜底）
  - 兜底 `src/pages/index.astro` 纯静态 meta refresh → `/en/`（零 JS，Function 失效也不 404）
- 文案字典：`src/i18n/dict.ts`（**en 为基线语言，key 必须齐全**；zh 缺 key 时结构与 en 对齐）
- 页面 `lang` 属性、hreflang（`en` / `zh` / `x-default`）随语言输出；语言切换按钮在页头
- 远期：语言包 registry 化，加语言 = 一个 PR、零发版；先站内字典
- 排版规则：中文行高 1.7 / 西文 1.55，中文正文 ≥16px

## 与 aibox-registry 的数据流

```
aibox-registry (GitHub, 唯一 SSOT)
   │  push → Actions → repository_dispatch: registry-updated → 本仓重建
   ▼
构建时 fetch https://raw.githubusercontent.com/imAiBOX/aibox-registry/main/index.json
   （备源 jsDelivr；任何失败 → 内置占位数据，构建绝不炸，src/data/registry.ts）
   ▼
静态 HTML（首页「应用目录」区：名称/难度/平台/状态徽章）→ Cloudflare Pages
```

- 数据形态容错：`{apps:[…]}` / `{apps:{id:{…}}}` / 顶层数组 / 字符串条目均可解析
- 页面上有数据源徽章：`live · from registry` 或 `placeholder · registry unavailable`

## VI（唯一权威色板）

- 色板 token 见 `src/styles/global.css`（`--aibox-*`）：黑底 `#0A0A0A`、主绿 `#B6FB50`、米白 `#FBF6E2`…
- CTA = 绿底黑字；字体 Space Grotesk / Noto Sans SC / JetBrains Mono，像素风 Handjet **仅品牌字标**
- 母题 = 像素圆角方块（loading / bullet / 分区分隔线 / 状态方块点）
- 反模板铁律：禁渐变横幅、三等宽卡片阵列、玻璃拟态、12px+ 大圆角；超大字承担层级；情绪 =「可靠的工具箱」

## 开发

```bash
pnpm install     # pnpm 11（构建脚本白名单见 pnpm-workspace.yaml）
pnpm dev         # Astro dev server
pnpm build       # → dist/（静态）
```

## 待办（本站）

- [ ] 绑定 `aibox.im` 自定义域名 + `www` 301（zone 已在新 CF 账号；域名接管点在后续阶段）
- [ ] `astro.config.mjs` 补 `site:`（canonical / sitemap 依赖）
- [ ] 下载按钮真岛化：`client:load` + 运行时 fetch GitHub Releases latest（5 分钟缓存）
- [ ] `/apps/` 目录页与应用落地页（JSON-LD、SEO 主力页）
- [ ] 完整内容填充（hero 配图、教程、FAQ、隐私页）
- [ ] hreflang 换绝对地址（绑域名后）
