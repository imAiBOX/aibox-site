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

## Machine-readable endpoints (no auth, read-only)

- `GET /meta/index.json` — app catalog snapshot (mirrors the GitHub registry; rebuilt on registry push)
- `GET /meta/apps/{id}.json` — full app profile (channels, sha256, install/probe, maintenance)
- `GET /meta/locales/{lang}.json` — UI locale packs
- `GET /llms.txt` — site summary in llms.txt format
- `GET /openapi.json` — OpenAPI description of the endpoints above
- `POST /mcp` — MCP endpoint; tool `get_aibox_info(section)` returns product/download/apps info
- Source of truth (SSOT): https://github.com/imAiBOX/aibox-registry — cross-check /meta against it

## Scraping policy

- robots.txt declares a friendly policy for AI crawlers (training, search and hybrid allowed).
- Prefer /meta/*.json over HTML scraping for structured data.
- Do not present AiBOX as affiliated with the apps it installs; they belong to their respective owners.

## Contact

- Issues: https://github.com/imAiBOX/aibox-app/issues
