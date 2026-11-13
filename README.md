# aibox-site — AiBOX.im website

Official website source for **AiBOX.im**. **Astro 5 + Tailwind CSS 4, static output, zero JS by default**;
build artifacts are uploaded straight to Cloudflare Pages: bilingual routes (`/en/`, `/zh/`),
brand-green VI, and the app catalog pulled from `aibox-registry` at build time.

**English | [简体中文](README.zh-CN.md)**

## Deployment (Cloudflare Pages)

- CI: `.github/workflows/deploy.yml`, **zero credentials in the repo** — secrets live in GitHub Secrets:
  `CF_API_TOKEN` (account-level token) and `CF_ACCOUNT_ID`.
- Triggers:
  1. `push main` → `pnpm install && pnpm build` → `npx --yes wrangler@4.62.0 pages deploy dist --project-name=aibox-site --branch=main`
  2. `repository_dispatch: registry-updated` → same deploy (fired when the registry repo pushes, so the
     site always rebuilds against fresh data)
  3. `schedule` daily (UTC 03:47) as a safety net — Pages build quota is 500/month, ~30/month used
  4. `workflow_dispatch` for manual runs
- Project name: **`aibox-site`**; reachable at **`https://aibox.im`** (custom domain connected) and
  **`https://aibox-site.pages.dev`** (preview).
- Local deploy (equivalent to CI; token only via environment variables, never committed):

  ```bash
  pnpm install && pnpm build
  CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… \
    npx --yes wrangler@4.62.0 pages deploy dist --project-name=aibox-site --branch=main
  ```

- **Download short-link Worker** (`workers/dl/`, separate Wrangler project `aibox-dl`,
  deployed manually — not part of the Pages pipeline): serves `https://dl.aibox.im`
  with 302 redirects to GitHub Releases plus a best-effort daily counter.
  See [`workers/dl/README.md`](workers/dl/README.md) for routes and deploy commands.

## Quality gates (CI `quality` job)

- **Bilingual route parity**: `node scripts/check-routes.mjs` — every `/en/…` page must have a `/zh/…`
  twin and vice versa.
- **Lighthouse** (desktop preset, official throttling, median of 3 runs): performance ≥ 0.95,
  accessibility ≥ 0.90, SEO ≥ 0.90 — assertions in `lighthouserc.json`.
- **Sanitization scan**: `scripts/prepush-scan.mjs --history` (credentials + internal-document patterns).

## i18n conventions

- **Prefixed routes**: `/en/`, `/zh/`, **English is the default** (Astro `prefixDefaultLocale: true`).
- **Root path `/`**: CF Pages Function `functions/index.ts` → 302 to `/en/` (English-first product
  policy; Chinese is opt-in via the header language switch). Static fallback `src/pages/index.astro`
  meta-refreshes to `/en/` (zero JS, never 404s).
- Copy dictionary: `src/i18n/dict.ts` (English baseline, all keys required; zh keeps key parity —
  enforced by CI). Page `lang` + hreflang (`en` / `zh` / `x-default`) emitted per locale; the language
  switch lives in the page header.
- Long term: locale packs move into the registry — adding a language becomes one PR, zero releases.

## Data flow from aibox-registry

```
aibox-registry (GitHub, single source of truth)
   │  push → Actions → repository_dispatch: registry-updated → this repo rebuilds
   ▼
build-time fetch of index.json + app detail (raw.githubusercontent, jsDelivr fallback;
   any failure → built-in placeholder data, the build never breaks — src/data/registry.ts)
   ▼
static HTML (catalog cards: name / difficulty / platforms / status) → Cloudflare Pages
```

- The page shows a source badge: `live · from registry` or `placeholder · registry unavailable`.

## VI (authoritative palette)

- Tokens in `src/styles/global.css` (`--aibox-*`): near-black `#0A0A0A`, brand green `#B6FB50`,
  cream `#FBF6E2` …; CTA = green background with black text.
- Type: Space Grotesk / Noto Sans SC (system fallback) / JetBrains Mono; pixel font Handjet **only
  for the brand wordmark**.
- Motif = rounded pixel squares (loading, bullets, section dividers, status dots).
- Anti-template rules: no gradient banners, no three-equal card grids, no glassmorphism, radius ≤ 4px;
  oversized type carries hierarchy; mood = “a reliable toolbox”.

## Development

```bash
pnpm install     # pnpm 11 (build-script allowlist lives in pnpm-workspace.yaml)
pnpm dev         # Astro dev server
pnpm build       # → dist/ (static) + dist/meta/* registry snapshots (aibox.im/meta channel)
node scripts/check-routes.mjs   # bilingual parity check
```

## TODO

- [ ] `www.aibox.im` → apex 301 redirect rule (created in the Cloudflare dashboard; token lacks Page-Rules permission)
- [ ] Email Routing: verify destination address + forward `hi@` / `support@` (dashboard; current catch-all drops mail)
- [ ] Download button island: runtime fetch of GitHub Releases latest (5-minute cache) — snapshot fallback is in place
- [ ] Content expansion: per-app tutorials, screenshots, blog
