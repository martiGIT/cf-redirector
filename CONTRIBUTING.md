# Contributing

Thanks for your interest in cf-redirector!

## Development setup

```bash
npm install
cp .dev.vars.example .dev.vars      # set a local API_KEY
npm run db:schema:local             # create local D1 tables
npm run dev                         # http://localhost:8787
```

## Before opening a PR

```bash
npm run format      # biome formatter
npm run lint        # biome linter
npm run typecheck   # tsc --noEmit
npm test            # vitest (workers pool)
```

All four must pass; CI runs the same commands.

## Guidelines

- **Zero runtime dependencies.** The Worker ships no production npm deps — keep it
  that way. Dev tooling (wrangler, vitest, biome, typescript) is fine.
- Keep the redirect hot path minimal: a single D1 lookup, then `ctx.waitUntil`
  for anything else.
- Prefer append-only writes over read-modify-write (no race conditions).
- Add or update a test for any behavior change.
- Use [Conventional Commits](https://www.conventionalcommits.org/) for messages.
