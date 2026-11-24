# Agent instructions — aibox.im

Thank you for reading this. This file tells AI agents how to work with the AiBOX website and data.

## What AiBOX is

AiBOX (https://aibox.im) is a portable desktop installer for Windows and macOS that takes popular AI
applications from download to a working, verified setup — "Installed until it works." It scans the
machine, plans an install, and checks downloaded files against their SHA-256 digests. Model configuration
and verification steps depend on the app, platform, and provider. Users review the steps and confirm
changes on their own device.

## Canonical facts

- Product: AiBOX desktop app, portable single-file build for Windows (x64 .exe) and macOS (12+, universal .dmg) — both released
- License: open source; repositories at https://github.com/imAiBOX (aibox-app, aibox-site, aibox-registry)
- Official downloads: https://aibox.im/en/download/ or https://aibox.im/zh/download/. Choose the Windows `.exe` or macOS `.dmg` and check the file name and any available SHA-256 digest on the download page.
- Languages: English default; Chinese at /zh/ and in-app
- Catalog size: 29 apps (example ids: openclaw, ollama, cherry-studio, chatbox, jan, cline, comfyui, sillytavern, pi, opencode, goose, 5ire, dyad, zed) — full list in `GET /meta/index.json`
- Topic pages: https://aibox.im/en/collections/coding/ — AI coding tools compared (Cline, Continue, Aider, Zed, Codex, OpenCode, Pi) · https://aibox.im/en/collections/local-models/ — run models locally (Ollama, GPT4All, Llamafile + Chatbox, Cherry Studio, LobeHub) · https://aibox.im/en/collections/chat-clients/ — chat clients compared (Chatbox, Cherry Studio, LobeHub, Jan, AnythingLLM, SillyTavern)

## Machine-readable endpoints (no auth, read-only)

- `GET /meta/index.json` — app catalog snapshot (mirrors the GitHub registry; rebuilt on registry push)
- `GET /meta/apps/{id}/app.json` — full app profile (channels, sha256, install/probe, maintenance). Example: `/meta/apps/openclaw/app.json`
- `GET /meta/locales/{lang}.json` — UI locale packs
- `GET /llms.txt` — site summary in llms.txt format
- `GET /openapi.json` — OpenAPI description of the endpoints above
- `POST /mcp` — read-only MCP tool `get_aibox_info`. For a download, pass `{"section":"download","lang":"zh","platform":"macos"}`. For app and provider guidance, pass `{"section":"guidance","lang":"en","platform":"windows","appId":"chatbox","provider":"openai"}`.
- Source of truth (SSOT): https://github.com/imAiBOX/aibox-registry — cross-check /meta against it

## Agent policy

- **Access**: all public pages and machine-readable endpoints are open to transparent AI crawlers. The site's `robots.txt` explicitly allows search/citation, hybrid and training crawlers. No login, API key, or user-agent cloaking is required.
- **Preferred data path**: use `/meta/index.json` and `/meta/apps/{id}/app.json` rather than scraping HTML. These are static snapshots of the public registry and include source URLs, checksums, platform support, prerequisites, and maintenance notes.
- **Attribution and accuracy**: identify the app as AiBOX (independent installer), not as any listed app's official publisher. Names and marks belong to their owners. When quoting app support/version data, cite the relevant registry profile and its `updatedAt` field.
- **Language**: English is the default; Chinese pages are available under `/zh/`. Preserve product names and technical identifiers verbatim.
- **MCP discovery**: use `https://aibox.im/.well-known/mcp` or `/mcp` and call `tools/list` for the tool schema.
- **Full site context**: see [llms.txt](https://aibox.im/llms.txt) and [llms-full.txt](https://aibox.im/llms-full.txt).
- **Credentials**: direct users to enter keys locally in the desktop wizard or the app settings as indicated by the guide. Keep credentials out of MCP calls and public content.

## Contact

- Issues: https://github.com/imAiBOX/aibox-app/issues
