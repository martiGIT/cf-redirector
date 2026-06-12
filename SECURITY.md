# Security Policy

## Reporting a vulnerability

Please report security issues privately via
[GitHub Security Advisories](https://github.com/martiGIT/cf-redirector/security/advisories/new)
rather than opening a public issue. We aim to respond within a few days.

## Security posture

- **Zero runtime dependencies** — the deployed Worker ships no third-party npm
  packages, minimizing supply-chain surface.
- **Secrets** — `API_KEY` is a Cloudflare secret (`wrangler secret put`), never
  committed. Local dev uses `.dev.vars`, which is gitignored. Only
  `.dev.vars.example` (a placeholder) is tracked.
- **Auth** — every `/api/*` endpoint requires a Bearer `API_KEY` compared in
  constant time. Resolving short links is intentionally public.
- **Automated scanning** (see `.github/workflows/`):
  - `npm audit` (high severity) on every push/PR and weekly.
  - **Trivy** filesystem scan — dependency vulnerabilities, leaked secrets, and
    misconfiguration — with results in the GitHub Security tab.
  - **CodeQL** static analysis (`security-and-quality`) for JS/TS.
  - **Dependabot** weekly updates for npm and GitHub Actions.
