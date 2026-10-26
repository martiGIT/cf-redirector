# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/) and the project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Initial release: short-link resolver with `302` redirects on Cloudflare Workers + D1.
- Append-only click logging via `ctx.waitUntil` (no added redirect latency, race-free).
- Query-time bot filtering for messenger/preview crawlers (`?bots=exclude`).
- REST API: create, list, get, delete links; per-code stats; full export (JSON/CSV).
- Bearer API-key auth on all `/api/*` endpoints.
- Vitest (workers pool) test suite and GitHub Actions CI.
- Security tooling: Trivy (deps/secrets/misconfig), CodeQL, `npm audit`, and
  Dependabot. Least-privilege workflow permissions. `SECURITY.md` disclosure policy.
- Built-in stats panel at `/admin` (zero-dependency single page; key kept in
  sessionStorage). `GET /api/links` now includes a per-link click count.
- `HEAD /:code` now redirects like `GET` (was `405`); HEAD is not counted as a
  click. Referrer breakdown added to `/api/stats/:code` and the panel.
- `PATCH /api/links/:code` to edit a link's destination url / tags / metadata.
  The `/admin` panel gained edit and delete buttons per link.

### Changed

- Test tooling migrated from the deprecated `@cloudflare/vitest-pool-workers` to
  `@cloudflare/vitest-plugin`.
- Dev toolchain bumped: wrangler 4.152, vitest 5, TypeScript 7, workers-types 5,
  Biome 2.6 (now also formats Markdown). CI uses `actions/checkout@v7` and `actions/setup-node@v7`.

### Security

- Resolved all `npm audit` advisories in dev dependencies (undici, zod, sharp,
  vite, source-map-js, postcss). `overrides` in `package.json` force patched
  undici/zod/sharp until miniflare and `@cloudflare/vitest-plugin` stop pinning
  vulnerable versions. The Worker itself has no runtime dependencies and was not
  affected.
- Short-code generator no longer has modulo bias (CodeQL
  `js/biased-cryptographic-random`): random bytes are now rejection-sampled.
