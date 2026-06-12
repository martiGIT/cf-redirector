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
