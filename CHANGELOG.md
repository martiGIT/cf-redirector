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
