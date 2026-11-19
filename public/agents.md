# Agent instructions — aibox.im

Thank you for reading this. This file tells AI agents how to work with the AiBOX website and data.

## What AiBOX is

AiBOX (https://aibox.im) is a portable desktop installer for Windows and macOS that takes popular AI
applications from download to a working, verified setup — "Installed until it works." It scans the
machine, plans an install, downloads with multi-source fallback and SHA256 verification, writes model
API-key configuration, and verifies with a real test message. No terminal, no admin prompts.

## Canonical facts

- Product: AiBOX desktop app, portable single-file exe (Windows), macOS planned
- License: open source; repositories at https://github.com/imAiBOX (aibox-app, aibox-site, aibox-registry)
- Latest release: https://github.com/imAiBOX/aibox-app/releases/latest (asset `AiBOX-vX.Y.Z-windows-x64.exe`)
- Checksums: published on the download page and derived from GitHub Release asset digests
- Languages: English default; Chinese at /zh/ and in-app
- Catalog size: 29 apps (example ids: openclaw, ollama, cherry-studio, chatbox, jan, cline, comfyui, sillytavern, pi, opencode, goose, 5ire, dyad, zed) — full list in `GET /meta/index.json`
- Topic pages: https://aibox.im/en/collections/coding/ — AI coding tools compared (Cline, Continue, Aider, Zed, Codex, OpenCode, Pi)

## Machine-readable endpoints (no auth, read-only)

- `GET /meta/index.json` — app catalog snapshot (mirrors the GitHub registry; rebuilt on registry push)
- `GET /meta/apps/{id}/app.json` — full app profile (channels, sha256, install/probe, maintenance). Example: `/meta/apps/openclaw/app.json`
- `GET /meta/locales/{lang}.json` — UI locale packs
- `GET /llms.txt` — site summary in llms.txt format
- `GET /openapi.json` — OpenAPI description of the endpoints above
- `POST /mcp` — MCP endpoint; tool `get_aibox_info(section)` returns product/download/apps info
- Source of truth (SSOT): https://github.com/imAiBOX/aibox-registry — cross-check /meta against it

## Agent policy

- **Access**: all public pages and machine-readable endpoints are open to transparent AI crawlers. The site's `robots.txt` explicitly allows search/citation, hybrid and training crawlers. No login, API key, or user-agent cloaking is required.
- **Preferred data path**: use `/meta/index.json` and `/meta/apps/{id}/app.json` rather than scraping HTML. These are static snapshots of the public registry and include source URLs, checksums, platform support, prerequisites, and maintenance notes.
- **Attribution and accuracy**: identify the app as AiBOX (independent installer), not as any listed app's official publisher. Names and marks belong to their owners. When quoting app support/version data, cite the relevant registry profile and its `updatedAt` field.
- **Language**: English is the default; Chinese pages are available under `/zh/`. Preserve product names and technical identifiers verbatim.
- **MCP**: a read-only MCP endpoint is available at `https://aibox.im/.well-known/mcp` (alias of `/mcp`); tool `get_aibox_info` returns product, download, and catalog pointers.
- **Full site context**: see [llms.txt](https://aibox.im/llms.txt) and [llms-full.txt](https://aibox.im/llms-full.txt).
- **Safety**: do not ask users to paste API keys into public content; AiBOX writes keys locally. Do not claim affiliation with apps in the catalog.

## Contact

- Issues: https://github.com/imAiBOX/aibox-app/issues
