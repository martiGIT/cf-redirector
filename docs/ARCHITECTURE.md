# Architecture

cf-redirector is a self-hosted URL shortener that runs entirely on Cloudflare's
edge. It is deliberately small: a stateless Worker in front of one D1 database,
zero runtime dependencies. This document records the design decisions and the
reasoning behind them.

## Components

```
            ┌──────────────────────────── Cloudflare edge ───────────────────────────┐
visitor ──▶ │  Worker (src/index.ts)                                                  │
            │    GET /:code   → SELECT url ──▶ 302 ──▶ ctx.waitUntil(INSERT click)     │
            │    /api/*       → Bearer API key ──▶ create / list / stats / export      │
            └───────────────────────────────────┬─────────────────────────────────────┘
                                                 │
                                          ┌──────▼───────┐
                                          │  D1 (SQLite) │  links + clicks  (source of truth)
                                          └──────────────┘
```

- **Worker** — stateless request handler. Each request runs in an ephemeral
  isolate; nothing is "loaded" or kept resident between requests. Correctness
  always comes from D1.
- **D1** — the single source of truth. Holds both the link map (`links`) and the
  permanent, append-only click log (`clicks`).

## Key decisions

### 1. D1 as the single store (map *and* analytics)

A link map is a key→value lookup; click analytics is an event log. Both live in
one D1 database. At newsletter/redirect volumes there is no reason to split them:
one database means one backup, one mental model, and `clicks JOIN links` gives
dimensions (tags, metadata) for free. D1 is durable with **no retention limit**,
so click history lives as long as you keep it — unlike Analytics Engine, whose
data ages out of a rolling window.

### 2. Append-only click log — race-free by construction

Clicks are recorded as **one INSERT per hit**, never `UPDATE counter = counter + 1`.
Read-modify-write counters race under concurrency (two clicks read 5, both write
6, one is lost). An append-only log has no shared mutable cell, so there is
nothing to race on; D1 serializes writes internally anyway. Totals are derived
with `COUNT(*)` at read time and are always correct. The log also preserves full
per-click detail (timestamp, UA, referer, country) for time-series and breakdowns.

### 3. Logging never blocks the redirect

The only work on the critical path is a single indexed `SELECT url`. The click
INSERT runs inside `ctx.waitUntil`, which keeps the Worker alive to finish the
write **after** the response has been sent. The visitor is redirected
immediately; analytics adds zero latency. Logging is best-effort: if the
background write fails, one click is lost — acceptable for analytics, and
swallowed so it can never surface to the visitor. (For at-least-once guarantees,
Cloudflare Queues is the documented upgrade path.)

### 4. Redirects are intentionally not cached

A `302` is not cached by Cloudflare's CDN by default — and that is what we want.
If the edge served the redirect from cache, the Worker would not run and the
click would not be counted. "Cacheable redirect" and "click tracking" are
mutually exclusive; this project chooses tracking. The Worker therefore runs on
every click (1 invocation + 1 D1 read + 1 background D1 write).

### 5. Bot filtering is a read-time view, not a write-time gate

Messenger and preview crawlers (WhatsApp, Telegram, Facebook, …) pre-fetch a URL
once per message to build a preview card, producing phantom "clicks". Rather than
guess and drop them on the hot path, **every hit is stored raw** and bots are
filtered with a SQL `NOT LIKE` clause at read time (`/api/stats/:code?bots=exclude`).
Benefits: no logic in the redirect path, no data loss, and the bot list stays
tunable forever (inspect real UAs with `GROUP BY ua`). See `src/lib/bots.ts`.

### 6. Portability is the real "forever" guarantee

No single provider is truly permanent. `GET /api/export` dumps the entire
`code → url` map (JSON or CSV). Export it on a schedule into your own storage and
the links survive any provider change: you can replay the map into another Worker,
a VPS, or a different shortener and every old link keeps resolving.

## Free-tier limits and the scale path

At the free tier the binding ceiling is **Workers requests/day** — every click is
one invocation. D1 read limits sit far above that, and D1 writes (one per click)
are comfortable for typical newsletter/link volumes. Link creation is a handful
of writes per batch and is never the constraint.

If click volume ever approaches the D1 write ceiling, the per-click write — and
only that — is swapped for a buffered sink, **without touching the resolve path**:

- **Cloudflare Analytics Engine** absorbs the high-volume event stream (its writes
  do not count against D1), with a periodic rollup into D1 for permanent history; or
- a **Durable Object** buffers in memory and flushes one batched D1 write per *N* clicks.

### Optional read-path optimization

`SELECT url` from D1 is already a few-millisecond indexed lookup. If you ever want
sub-millisecond resolves, front it with a warm cache keyed by code:

- **Cache API** (`caches.default`) — per-colo, no read-count limit, ideal warm layer; or
- **KV** — global edge cache (mind the lower free read quota).

Give cache entries a TTL (~14–30 days). Newsletter link traffic is front-loaded
(most clicks in the first 48–72h), so recent links stay warm automatically and
old ones fall back to D1 on a miss — warm/cold tiering with no manual
classification. This is an optimization, not a requirement; the default is a
direct D1 lookup.
