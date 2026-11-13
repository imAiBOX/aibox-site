# aibox-dl — download short links (Cloudflare Worker)

Tiny Worker behind **`https://dl.aibox.im`** that 302-redirects short URLs to the
[imAiBOX/aibox-app GitHub Releases](https://github.com/imAiBOX/aibox-app/releases)
and keeps a best-effort daily redirect counter in Workers KV.

## Routes

| Request | Response |
|---|---|
| `GET /` | 200 — minimal HTML index listing the routes below |
| `GET /latest` | 302 → `…/releases/latest` (release page; visitor picks a platform) |
| `GET /vX.Y.Z` (also `X.Y.Z`, optional pre-release suffix) | 302 → `…/releases/tag/vX.Y.Z` |
| `GET /vX.Y.Z/win` | 302 → direct asset `AiBOX-vX.Y.Z-windows-x64.exe` |
| `GET /vX.Y.Z/mac` | 302 → direct asset `AiBOX-vX.Y.Z-macos-universal.dmg` |
| `GET /count` | 200 JSON — today's counters (approximate) |
| anything else | 404 plain text |

All redirects use `302` with `Cache-Control: no-store` (targets change when a
new release is published; never cache the redirect itself).

## Click counting — design & trade-offs

Free-tier limits that shape the design: **Workers 100k requests/day**, **KV
100k reads / 1,000 writes per day** (writes are the scarce resource).

- **Daily key**: `count:<YYYY-MM-DD>` (UTC), JSON `{total, latest, version, asset}`.
  One read + one write per redirect.
- **Non-blocking**: the increment runs in `ctx.waitUntil()` — the 302 is sent
  first; a KV failure can never delay or break a download link.
- **Write cap (`DAILY_WRITE_CAP = 950`)**: once the day's tally reaches the cap,
  the Worker stops writing for the rest of the day instead of hammering a
  rejected API. **Accepted degradation: past ~950 redirects/day the counter
  freezes and only redirects continue** — downloads are never affected.
- **Approximate by nature**: KV is eventually consistent (last-write-wins), so
  concurrent clicks can be lost. Treat the number as a rough download gauge,
  not billing-grade analytics. For exact numbers use Cloudflare Web Analytics
  (free, cookieless) on the main site instead.
- **Why not alternatives**: Durable Objects would give exact counts but exceed
  the intended scope of this tiny link service; Analytics Engine needs an
  enabled/dataset setup for little gain at this traffic level.

## Layout

```
workers/dl/
├── wrangler.toml   # name=aibox-dl, custom domain dl.aibox.im, KV binding HITS
├── src/index.js    # plain JS Worker (no build step, Wrangler-compatible)
└── README.md       # this file
```

## Deployment (manual; token only via environment variables — never committed)

Run from this directory (`workers/dl/`):

```bash
export CLOUDFLARE_API_TOKEN=…      # account-level token, env only
export CLOUDFLARE_ACCOUNT_ID=…     # account id, env only

# one-time: create the KV namespace and paste its id into wrangler.toml
npx --yes wrangler@4.62.0 kv namespace create aibox-dl-count

npx --yes wrangler@4.62.0 deploy   # uploads worker + binds dl.aibox.im
```

`wrangler deploy` with `routes = [{ pattern = "dl.aibox.im", custom_domain = true }]`
creates/updates the DNS record automatically. **After any domain change, re-list
the zone's DNS records** to confirm the other records (apex/`www` CNAMEs, MX,
TXT) are untouched.

### Verify

```bash
curl -I https://dl.aibox.im/latest        # 302 → …/releases/latest
curl -I https://dl.aibox.im/v0.1.3        # 302 → …/releases/tag/v0.1.3
curl -I https://dl.aibox.im/v0.1.3/win    # 302 → direct .exe asset
curl -s  https://dl.aibox.im/             # 200 index page
curl -s  https://dl.aibox.im/count        # today's counters (JSON)
```

## KV red line (free tier)

**≤ 1,000 KV writes/day account-wide.** The counter is capped at 950/day and
fails open (write errors are swallowed); if you raise traffic and need exact
counts, move counting to Durable Objects or Analytics Engine rather than
raising this cap.
