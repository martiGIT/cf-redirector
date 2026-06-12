# cf-redirector

A self-hosted, privacy-first **URL shortener and link redirector** that runs
entirely on **Cloudflare Workers + D1**. Permanent click analytics, zero runtime
dependencies, and your data stays yours.

[![CI](https://github.com/martiGIT/cf-redirector/actions/workflows/ci.yml/badge.svg)](https://github.com/martiGIT/cf-redirector/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

## Why another shortener?

Most Worker shorteners either skip analytics, count clicks in KV (lossy under
concurrency), or have no story for the load that messaging apps create. cf-redirector
fills that gap:

- **Permanent click history in D1** — append-only event log, race-free, no retention
  limit. Real `COUNT(*)`, not a fragile counter.
- **Zero added redirect latency** — one indexed lookup, then the click is logged in
  the background via `ctx.waitUntil`.
- **Messenger-aware analytics** — WhatsApp/Telegram/Facebook preview crawlers create
  phantom "clicks". Raw hits are stored and bots are filtered *at read time*
  (`?bots=exclude`), so the filter is tunable and nothing is lost.
- **Portable by design** — `GET /api/export` dumps your whole `code → url` map (JSON/CSV)
  so your links can outlive any single provider.
- **Private** — creating links and reading stats require a Bearer API key. Only
  resolving is public (as it must be).
- **Zero runtime dependencies** — auditable, fast, and built to last.

## Cost — how far does the free tier go?

cf-redirector is designed to run on **Cloudflare's free tier**, and for a link
shortener that goes a long way. Every redirect is one Workers request, so that
request limit is the effective ceiling — in practice you stay free until roughly
**100,000 redirects per day**.

| Resource         | Free tier (per day) | Usage here                                  |
| ---------------- | ------------------- | ------------------------------------------- |
| Workers requests | 100,000             | 1 per redirect + 1 per API call — the ceiling |
| D1 rows read     | 5,000,000           | 1 indexed read per redirect — far below cap |
| D1 rows written  | 100,000             | 1 append per click — comfortable             |
| D1 storage       | 5 GB                | ~50 bytes/click → years of history          |

Beyond ~100k redirects/day you'd move to the **Workers Paid** plan ($5/month,
10M requests included, then ~$0.30/million); D1 stays effectively free for this
workload. The [scale path](docs/ARCHITECTURE.md) (Analytics Engine / Durable
Objects) only matters if click volume truly explodes.

> Figures are order-of-magnitude and change over time — check Cloudflare's
> current pricing before relying on them.

## How it works

```
GET /:code   →  SELECT url FROM links  →  302 redirect
                                       └→ ctx.waitUntil(INSERT into clicks)   (async, non-blocking)

POST /api/links   (Bearer key)  →  create a short link
GET  /api/stats/:code           →  click analytics (?bots=exclude to drop crawlers)
GET  /api/export                →  full link-map backup (JSON or CSV)
```

## Quick start

```bash
# 1. Install
npm install

# 2. Create the D1 database, then paste the printed id into wrangler.toml
npx wrangler d1 create cf-redirector

# 3. Apply the schema
npm run db:schema

# 4. Set the API key (Bearer token for /api/*)
npx wrangler secret put API_KEY

# 5. Set BASE_URL in wrangler.toml to your short domain, then deploy
npm run deploy
```

Local development:

```bash
cp .dev.vars.example .dev.vars     # set a local API_KEY
npm run db:schema:local            # local D1 tables
npm run dev                        # http://localhost:8787
```

For the full setup (auth, D1, secrets, custom domain) and automated CI/CD
deploys, see **[docs/DEPLOY.md](docs/DEPLOY.md)**.

## API

All `/api/*` endpoints require `Authorization: Bearer <API_KEY>`.

### Create a link

```bash
curl -X POST https://your.link/api/links \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "url": "https://example.com/article", "code": "spring", "tags": "newsletter", "metadata": { "edition": "2026-06-12" } }'
```

`code`, `tags` and `metadata` are optional. Without `code`, a random base62 code
is generated.

```json
{ "code": "spring", "shortUrl": "https://your.link/spring", "url": "https://example.com/article" }
```

### Resolve (public)

```
GET https://your.link/spring   →  302 Location: https://example.com/article
```

### Stats

```bash
curl "https://your.link/api/stats/spring?bots=exclude" -H "Authorization: Bearer $API_KEY"
```

```json
{
  "code": "spring",
  "total": 128,
  "excludeBots": true,
  "byDay":     [{ "day": "2026-06-12", "clicks": 90 }, { "day": "2026-06-13", "clicks": 38 }],
  "byCountry": [{ "country": "PL", "clicks": 110 }, { "country": "DE", "clicks": 18 }]
}
```

### Other endpoints

| Method & path            | Description                                   |
| ------------------------ | --------------------------------------------- |
| `GET /api/links`         | List links (newest first; `?limit`, `?offset`)|
| `GET /api/links/:code`   | One link + total click count                  |
| `DELETE /api/links/:code`| Delete a link and its clicks                  |
| `GET /api/export`        | Full link-map dump (`?format=csv`)            |
| `GET /health`            | Health check                                  |

## Admin panel

A tiny built-in stats panel is served at **`/admin`** — create links and browse
per-code click charts (daily bars, by country, bots excluded). It has **no build
step and no dependencies**: one self-contained HTML page.

Auth is deliberately simple: the page carries no secret and is safe to serve
publicly, because all data comes from the authenticated `/api/*` endpoints. You
**paste your API key once** and it is kept in `sessionStorage` (sent as a Bearer
token, never written into the page). For real SSO with no key handling, put
**Cloudflare Access** in front of the `/admin` route — no code change needed.

## Configuration

Set in `wrangler.toml` under `[vars]` (non-secret) or via `wrangler secret`:

| Name               | Type   | Default | Description                                         |
| ------------------ | ------ | ------- | --------------------------------------------------- |
| `API_KEY`          | secret | —       | Bearer token guarding every `/api/*` endpoint       |
| `BASE_URL`         | var    | —       | Short domain, used to build `shortUrl` in responses |
| `REDIRECT_STATUS`  | var    | `302`   | `301`, `302` or `307`. Keep `302` for click tracking |
| `DEFAULT_REDIRECT` | var    | `""`    | Where unknown codes go; empty = `404`               |

## Project layout

```
src/
  index.ts            # Worker entry + router
  handlers/           # resolve, links (CRUD), stats, export
  lib/                # http, auth, codes, bots
schema.sql            # D1 tables (links, clicks)
test/                 # vitest (workers pool) suite
docs/ARCHITECTURE.md  # design decisions & scale path
```

## Testing

```bash
npm test         # vitest with @cloudflare/vitest-pool-workers (local miniflare + D1)
npm run typecheck
npm run lint
```

## License

[MIT](./LICENSE) © martiGIT and contributors
