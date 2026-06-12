# Deployment guide

How to take cf-redirector from a fresh clone to a live shortener on Cloudflare,
and how the automated CI/CD deploy works. Written to be followed step by step.

## 0. Prerequisites

- A **Cloudflare account** (free tier is enough).
- **Node 22+** and this repo cloned locally.
- A domain on Cloudflare if you want a pretty short URL (e.g. `go.example.com`).
  You can also start on the free `*.workers.dev` subdomain.

```bash
npm install
```

## 1. Authenticate wrangler

Pick one — both are fine for local work; CI uses the API token (step 7).

**A) Interactive (simplest for local):**

```bash
npx wrangler login          # opens a browser, one time
npx wrangler whoami         # confirms the account
```

**B) API token (works headless, same token CI uses):**

```bash
export CLOUDFLARE_API_TOKEN="<token from step 7>"
npx wrangler whoami
```

## 2. Create the D1 database

```bash
npx wrangler d1 create cf-redirector
```

Copy the printed `database_id` into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "cf-redirector"
database_id = "PASTE_THE_ID_HERE"
```

## 3. Apply the schema

```bash
npm run db:schema          # remote (production D1)
# npm run db:schema:local  # local dev D1
```

Re-running is safe — the schema uses `CREATE TABLE IF NOT EXISTS`.

## 4. Set the API key (server side)

This is the Bearer token that guards `/api/*`. Generate a strong random value
and store it as a Cloudflare **secret** (never in the repo):

```bash
openssl rand -hex 32                     # generate; copy the output
npx wrangler secret put API_KEY          # paste when prompted
```

The same value goes to every client that creates links (e.g. an n8n
Header-Auth credential, or your shell as `$API_KEY`).

## 5. Set BASE_URL

In `wrangler.toml` under `[vars]`, set `BASE_URL` to the short domain you will
serve from — it is only used to build `shortUrl` in API responses:

```toml
[vars]
BASE_URL = "https://go.example.com"
```

## 6. Deploy

```bash
npm run deploy
```

For a custom domain, add a route or a `[[routes]]`/custom-domain entry in
`wrangler.toml`, or bind the route in the Cloudflare dashboard
(Workers & Pages → your worker → Settings → Domains & Routes). The free
`*.workers.dev` URL works immediately with no DNS setup.

### Verify it works

```bash
# create
curl -X POST https://go.example.com/api/links \
  -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/hello","code":"hi"}'

# resolve (should 302 to the target)
curl -i https://go.example.com/hi

# stats
curl "https://go.example.com/api/stats/hi" -H "Authorization: Bearer $API_KEY"
```

## 7. Automated deploy (GitHub Actions)

`.github/workflows/deploy.yml` deploys on every push to `main` (after typecheck
and tests pass) and on manual dispatch. It needs two repository secrets.

### 7a. Create a Cloudflare API token

Dashboard → **My Profile → API Tokens → Create Token**. Start from the
**"Edit Cloudflare Workers"** template, then ensure these permissions:

| Scope   | Permission        | Access |
| ------- | ----------------- | ------ |
| Account | Workers Scripts   | Edit   |
| Account | D1                | Edit   |
| Account | Account Settings  | Read   |
| Zone    | Workers Routes    | Edit   | (only if you use a custom-domain route) |

Limit it to the relevant account (and zone). Copy the token once — it is shown
only at creation.

### 7b. Find your Account ID

Dashboard → Workers & Pages → right sidebar **Account ID**, or:

```bash
npx wrangler whoami
```

### 7c. Add the GitHub repository secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

- `CLOUDFLARE_API_TOKEN` — the token from 7a
- `CLOUDFLARE_ACCOUNT_ID` — the id from 7b

Push to `main` (or run the **Deploy** workflow manually) and it ships.

> Note: the D1 database must already exist and the schema applied (steps 2–3).
> The deploy workflow only deploys the Worker; it does not create the database.

## 8. Rotating the API key

```bash
openssl rand -hex 32
npx wrangler secret put API_KEY     # set the new value
# then update every client (n8n credential, scripts) to the new key
```

## Troubleshooting

- **`workflow` scope push error over HTTPS** — push over SSH, or run
  `gh auth refresh -s workflow`. (Editing files under `.github/workflows/`
  requires the `workflow` scope on HTTPS OAuth tokens.)
- **401 from `/api/*`** — the Bearer token does not match the `API_KEY` secret.
- **`no such table: links`** — the schema was not applied to the database you
  deployed against (re-run step 3 with `--remote`).
- **CodeQL / Trivy SARIF upload warns** — enable Code scanning in
  Settings → Security (free for public repos).
