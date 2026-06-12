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

Free-tier friendly: at typical link volumes everything fits comfortably within
Cloudflare's free Workers + D1 allowances. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
for the limits and the documented scale path.

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
