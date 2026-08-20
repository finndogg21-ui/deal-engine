# Deploy runbook

How deal-engine goes to (and stays in) production. Host-agnostic: everything
here assumes only "somewhere that runs a Docker container (or Node 20) and can
set environment variables and a cron schedule".

The shape of production:

- **One container / one process** — Express serves the API *and* the built
  dashboard (`web/dist`). No CDN, no second service.
- **Neon Postgres** is the database (`DB_DRIVER=postgres`). PGlite is dev-only.
- **The host's scheduler** fires the daily scan by HTTPS POST. Nothing inside
  the container schedules anything.

---

## 1. Environment variables

Set these in the host's environment / secrets UI, never in a committed file.
"Secret" means: store it in the host's secret store, never in logs or docs.

| Name | Purpose | Secret | Example placeholder |
| --- | --- | --- | --- |
| `NODE_ENV` | Must be `production`. Turns on Secure cookies and locks out dev plan activation. | no | `production` |
| `DB_DRIVER` | Must be `postgres` in production (PGlite is a local dev file). | no | `postgres` |
| `DATABASE_URL` | Neon connection string. Keep `sslmode=require` — Neon refuses plaintext. | **yes** | `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require` |
| `PORT` | Port the server binds. Most hosts inject this themselves — if yours does, set nothing. Do **not** set `API_PORT` in production (dev-only override that outranks `PORT`). | no | `8787` |
| `APP_URL` | Public https origin of the deployed app. Used in every email link (reset, delete, alerts). | no | `https://deal-engine.example.com` |
| `OPERATOR_EMAIL` | The founder's email. An account with this address is auto-promoted to `role=operator, plan=reseller` (at signup, or by the next migrate if it already exists). The founder signs up through the normal form personally — no tooling ever touches the password. | no | `founder@example.com` |
| `SCAN_TRIGGER_TOKEN` | Shared secret for cron-triggered scans (`x-scan-token` header). Must be ≥ 32 chars or the endpoint refuses token auth entirely. Generate: `openssl rand -base64 48`. | **yes** | `<random-48-char-string>` |
| `APIFY_TOKEN` | Apify API token — runs the clearance scraper. | **yes** | `apify_api_XXXXXXXX` |
| `APIFY_ACTOR_ID` | Which Apify actor the scan runs. | no | `scrapyspider/home-depot-clearance-scraper` |
| `APIFY_MAX_RESULTS` | Cap on rows per scan (cost control). | no | `1000` |
| `SCAN_ZIPS` | ZIP codes the daily scan sweeps. | no | `78232,78216,78248,78258` |
| `UNWRANGLE_KEY` | Unwrangle API key — store-level aisle/bay + stock lookups. | **yes** | `uw_XXXXXXXX` |
| `KEEPA_KEY` | Optional. Price-history enrichment. | **yes** | `keepa_XXXXXXXX` |
| `SUPPORT_EMAIL` | Where the contact form delivers once the mailer is wired. Defaults to `support@localhost` (a dead address) if unset. | no | `you@example.com` |
| `BRAND_NAME` | User-visible product name in alert emails. Defaults to `Finnley's Deals`. | no | `Finnley's Deals` |
| `HOME_LAT` / `HOME_LNG` | Point that "distance" on the dashboard is measured from. | no | `29.6047` / `-98.4947` |
| `COVERAGE_ZIP_PREFIXES` | ZIP prefixes where scores are trustworthy (the coverage check). | no | `782,780,781` |
| `COVERAGE_METRO_NAME` | Label shown for the covered metro. | no | `San Antonio` |
| `OPERATOR_USER_ID` | Leave at `1` unless you know otherwise. | no | `1` |
| `ALLOW_DEV_PLAN_ACTIVATION` | **Never set in production.** It bypasses billing. Absent = off; the server logs a loud warning if it sees `true` under `NODE_ENV=production`. | — | *(unset)* |

Stripe (`STRIPE_*`), the mailer, and the LLM (`ANTHROPIC_API_KEY`) are stubbed
behind readiness checks — leave them unset until each is actually wired; the
admin overview shows which vendors are connected.

## 2. Neon setup (founder does this personally)

1. Create the account and project at <https://neon.tech> — the agent/tooling
   never handles this login.
2. Copy the connection string from the Neon dashboard (it already ends in
   `?sslmode=require` — keep that) into the host's `DATABASE_URL` secret.
3. The default compute size is fine; the app holds a pool of at most 10
   connections from its single instance.

## 3. Migrate (before first boot, and after any schema change)

Migrations are **not** run automatically on container start. They are a
deliberate, operator-triggered step: a schema change touches irreplaceable
data, and a failed migration should fail one visible command — not crash-loop
the server on every restart. `npm run migrate` applies `src/db/schema.sql`,
which is idempotent (safe to run repeatedly), and finishes by promoting the
`OPERATOR_EMAIL` account if one exists.

Run it with the production env, either as the host's "release phase" command
if it has one, or as a one-off container:

```sh
docker run --rm --env-file prod.env <image> npm run migrate
```

(or `npm run migrate` in the host's console/shell for the deployed app.)

## 4. Build and run

```sh
docker build -t deal-engine .
docker run -d -p 8787:8787 --env-file prod.env deal-engine
```

On a buildpack-style host instead of Docker: build command
`npm ci && npm run web:build`, start command `npm start`, Node 20.

Boot order for a fresh deploy: set env → migrate → start → smoke test (§6) →
schedule the scan (§5).

## 5. Daily scan scheduling

The whole daily pipeline (scan + score rebuild) is one call:

```
POST https://<app-domain>/api/admin/scan
Header: x-scan-token: <SCAN_TRIGGER_TOKEN>
```

- Schedule it on the **host's** scheduler (cron job / scheduled task feature)
  at **12:00 America/Chicago**, daily. If the host's cron only speaks UTC,
  that is 17:00 UTC during daylight saving and 18:00 UTC in winter — prefer a
  scheduler that accepts a timezone so the DST shift cannot silently move the
  scan an hour.
- Give the job a generous timeout (the scan can run several minutes) and
  treat any non-200 as a failure worth an alert. `409` means a scan was
  already running; `401` means the token doesn't match.
- The endpoint runs one scan at a time — a duplicate trigger is a safe no-op
  (`409`), not a double scan of vendors you pay per row.

> **Turn off the laptop cron.** The Windows Task Scheduler job
> **"deal-engine daily scan"** on the desktop (running
> `scripts/daily-scan.ps1`) exists for local dev and MUST be disabled once
> the cloud cron is live — otherwise both fire daily and every scan's vendor
> spend doubles. Task Scheduler → right-click the job → Disable. Keep it
> disabled rather than deleted, in case local dev needs it again.

## 6. Smoke test (after every deploy)

In order — each step depends on the one before it:

1. **Health**: `GET https://<app-domain>/api/health` → `200 {"ok":true,"db":"postgres"}`.
   `503` or `"db":"pglite"` means the database env is wrong; stop here.
2. **Dashboard loads**: open `https://<app-domain>/` in a browser — the SPA
   renders (proves Express is serving `web/dist`, not just the API).
3. **Signup**: the founder creates their account with the `OPERATOR_EMAIL`
   address via the normal signup form. Then `GET /api/auth/me` (or the
   account page) shows `role: operator`, `plan: reseller`. If the account
   predates `OPERATOR_EMAIL` being set, run migrate once and re-check.
4. **Admin overview**: as that account, the admin page (`/api/admin/overview`)
   loads — vendor readiness shows Apify/Unwrangle connected, Stripe/mailer/LLM
   not, and scan history is empty (no runs yet).
5. **Penny page empty-state**: the penny view renders its honest empty state
   rather than an error. Empty is correct before the first scan — the page
   only ever shows literal pennies.
6. **First scan**: trigger the scan endpoint once by hand (same POST as §5)
   and watch it appear in the admin overview's run history with a row count.

## 7. Known limits (deliberate, revisit when they bite)

- **Single instance assumed.** The rate limiter and the "one scan at a time"
  guard are in-process memory; running two replicas would weaken both. One
  small instance is the right size for this product today.
- **Scan runs in the web process.** A scan slows API responses while it runs;
  acceptable at one operator + a handful of users, worth extracting later.
- **No CSRF token layer** — sessions are `SameSite=Lax` cookies, which covers
  the cross-site POST case for modern browsers.
