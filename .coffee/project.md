# /coffee project config — deal-engine

Portable config read by the `/coffee` skill (Phase 0). Everything project-specific
lives here so the skill itself stays generic.

- **name:** deal-engine (clearance / penny-deal finder for resellers)
- **live_url:** https://summitclearance.com  (custom domain, live 2026-09-02; PUBLIC_PREVIEW=1). Old Railway URL https://web-production-cc975.up.railway.app still serves.
- **repo:** /Users/finnleyolds/Claude/deal-engine
- **stack:** Node ≥20 ESM + TypeScript, Express API (`src/api/`), Vite/React 19 web (`web/`), Postgres via `pg` (prod Neon), Stripe billing.

## typecheck (must pass before any deploy)
```
npx tsc --noEmit          # server
npm run web:build         # web (also the bundle that deploys)
```

## deploy
```
git add <specific files> && git commit -m "..." && git push origin main
RAILWAY_TOKEN=$(grep '^RAILWAY_TOKEN=' .env | head -1 | cut -d= -f2-) \
  npx --yes @railway/cli@5.45.10 redeploy --from-source --service web --yes --json
```
git push does NOT auto-deploy — the redeploy is manual. Server-only changes don't
flip the web bundle hash; verify those by behavior, not hash. See [[deal-engine-railway-deploy]].

## verify (smoke test — the critical path)
`BASE=https://web-production-cc975.up.railway.app`
- teaser: `GET /api/deals/published?limit=200` → 200, count 12, locked true
- paid gate holds: anon `GET /api/community-deals` → 402
- signup → login → `POST /api/billing/checkout {plan:member}` → a Stripe URL (not a 500)
- security headers present (CSP + HSTS); no CSP violations in the browser console
- DELETE throwaway test users after: from repo dir, `DATABASE_URL=$(grep '^DATABASE_URL=' .env|cut -d= -f2-) node _x.mjs`
  with `pg` + `ssl:{rejectUnauthorized:false}`, delete emails LIKE 'coffee-%@example.com'

## constraints
- **Design constitution — "THE RECEIPT / THE TAPE":** pure B&W, exactly three price accents
  (--cut/--save/--grail), Archivo + IBM Plex Mono, zero radius, one --s1..--s9 spacing scale,
  heading weight ≤500. Never add color/gradients/glass/generic-icons/motion. (web/src/styles.css)
- **Honesty:** no fabricated deals/stock/markdowns shown as fact; hedging copy stays; no em dashes
  in user-visible copy; every research claim tagged verified/inference.
- **Budget:** low. No new paid services / paid API calls without the owner's OK.

## high_risk (NEVER auto-ship — blueprint for the owner instead)
auth & sessions · billing / Stripe / webhooks · the data pipeline (ingest / scan / verify) ·
DB schema migrations · .env · Railway env vars · anything that spends money · the signup UX flow.

## focus history
Security was hardened 2026-09-02 (see [[deal-engine-security]] — 13/14 findings fixed). Good
recurring foci: conversion (the teaser → signup → $20 checkout funnel), performance, accessibility,
feed quality (the resale-margin ranking), mobile.
