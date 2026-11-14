# aibox-dl — download short links (Cloudflare Worker)

Tiny Worker behind **`https://dl.aibox.im`** that serves release downloads with
an **R2 mirror first** (streamed by the Worker, zero egress) and a GitHub
Releases fallback, plus a best-effort daily redirect counter in Workers KV.

## Routes

| Request | Response |
|---|---|
| `GET /` | 200 — minimal HTML index listing the routes below |
| `GET /latest` | 302 → `…/releases/latest` (release page; visitor picks a platform) |
| `GET /vX.Y.Z` (also `X.Y.Z`, optional pre-release suffix) | 302 → `…/releases/tag/vX.Y.Z` |
| `GET /vX.Y.Z/win` | 302 → **`/file/AiBOX-vX.Y.Z-windows-x64.exe`** when mirrored, else GitHub asset |
| `GET /vX.Y.Z/mac` | 302 → **`/file/AiBOX-vX.Y.Z-macos-universal.dmg`** when mirrored, else GitHub asset |
| `GET /file/<name>` | 200 — release asset streamed from R2 (404 if not mirrored) |
| `GET /count` | 200 JSON — today's counters (approximate) |
| anything else | 404 plain text |

All redirects use `302` with `Cache-Control: no-store` (targets change when a
new release is published; never cache the redirect itself).

## R2 mirror — zero-egress download design

Release binaries are mirrored into the R2 bucket **`aibox-releases`** (free
tier: **10 GB storage**, 1M Class A / 10M Class B ops per month, **$0 egress**).

- **`GET /file/<name>` streams the object through this Worker**
  (`env.BUCKET.get(name)` → response body). It deliberately does **not**
  302 to a presigned URL: presigned downloads are billed as R2 egress, while
  a Worker-binding read + streamed response costs nothing. That is the
  zero-egress red line for this service.
- **Headers**: `Content-Type: application/octet-stream`,
  `Content-Disposition: attachment`, `Content-Length` (exact object size),
  `Cache-Control: public, max-age=31536000, immutable` — object names embed
  the release version (`AiBOX-vX.Y.Z-…`), so a stored object never changes and
  can be cached forever by any intermediate.
- **Mirror-first short links**: `/vX.Y.Z/<platform>` does one cheap R2 HEAD;
  on a hit it 302s to the same-domain `/file/…` (browser stays on
  `dl.aibox.im`, download is streamed from R2); on a miss it falls back to the
  existing GitHub release-asset 302. `/latest` still points at the release page.
- **Mirror population**: release CI (`aibox-app`) uploads each asset to
  `aibox-releases/<asset-name>` right after the GitHub Release upload
  (best-effort — a failed mirror sync never breaks a release).
- **10 GB ceiling**: only the two platform installers per release are stored;
  storage grows ~31 MB × releases. Usage monitoring/alerting is a follow-up.
- **Object-name rules**: single safe path segment (`[A-Za-z0-9][A-Za-z0-9._-]*`,
  ≤128 chars) — no traversal, no leading dot; anything else is 404.

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
├── wrangler.toml        # name=aibox-dl, custom domain dl.aibox.im, KV HITS, R2 BUCKET
├── package.json         # type=module (lets node --test import the worker module)
├── src/index.js         # plain JS Worker (no build step, Wrangler-compatible)
├── src/index.test.mjs   # pure-logic tests (node --test)
└── README.md            # this file
```

## Deployment (manual; token only via environment variables — never committed)

Run from this directory (`workers/dl/`):

```bash
export CLOUDFLARE_API_TOKEN=…      # account-level token, env only
export CLOUDFLARE_ACCOUNT_ID=…     # account id, env only

# one-time: create the KV namespace and paste its id into wrangler.toml
npx --yes wrangler@4.62.0 kv namespace create aibox-dl-count

# one-time: create the R2 mirror bucket (binding already declared in wrangler.toml)
npx --yes wrangler@4.62.0 r2 bucket create aibox-releases

npx --yes wrangler@4.62.0 deploy   # uploads worker + binds dl.aibox.im
```

`wrangler deploy` with `routes = [{ pattern = "dl.aibox.im", custom_domain = true }]`
creates/updates the DNS record automatically. **After any domain change, re-list
the zone's DNS records** to confirm the other records (apex/`www` CNAMEs, MX,
TXT) are untouched.

### Verify

```bash
node --test workers/dl/src/index.test.mjs   # pure-logic routing tests

curl -I https://dl.aibox.im/latest        # 302 → …/releases/latest
curl -I https://dl.aibox.im/v0.1.3        # 302 → …/releases/tag/v0.1.3
curl -I https://dl.aibox.im/v0.1.3/win    # 302 → /file/… (mirrored) or GitHub asset
curl -I https://dl.aibox.im/file/AiBOX-v0.1.3-windows-x64.exe
                                          # 200 + long cache + exact Content-Length
                                          # (404 when that release is not mirrored)
curl -s  https://dl.aibox.im/             # 200 index page
curl -s  https://dl.aibox.im/count        # today's counters (JSON)
```

## KV red line (free tier)

**≤ 1,000 KV writes/day account-wide.** The counter is capped at 950/day and
fails open (write errors are swallowed); if you raise traffic and need exact
counts, move counting to Durable Objects or Analytics Engine rather than
raising this cap.
