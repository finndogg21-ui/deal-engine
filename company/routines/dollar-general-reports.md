# Routine — Dollar General member penny reports

Run the Dollar General find-ingest cycle for deal-engine. Repo is this checkout,
live site https://web-production-cc975.up.railway.app, prod DB via DATABASE_URL
in the repo .env.

DG is NOT a vendor sweep. There is no DG price/stock endpoint — penny and
clearance are register-only, invisible on every web surface (see
company/dollar-general-recon.md). DG rides the `community_reports` path only.

## The one hard rule: source is member scans, never leaked lists

The public DG penny lists (Facebook groups, blog lists like TheFreebieGuy /
Krazy Coupon Lady / Penny Puss / Kristie's Connections) are, at the root,
**corporate-level leaks** — DG employees confirm the groups get the list a week
before stores do. Republishing those means republishing leaked internal data:
the exact reputational/tortious-interference tripwire from the recon's RISKS
pass, and the same class of unvetted third-party feed that turned out 100%
fabricated with RebelSavings.

So the ONLY sanctioned DG source is the app's own members reporting what scanned
$0.01 on a shelf — a `source: 'dg-members'`, `retailer: 'dollargeneral'`,
`kind: 'penny'` community report, verified-on-shelf, attributed to a store and a
time. Do not wire a scraper of any third-party penny list without a fresh
provenance review that clears both the fabrication gate AND the leaked-source
question. Absent that, DG stays `coverage: 'community'` with the honest page and
no feed.

## Cadence facts (for modelling, not for scraping)

- Ladder: 10% → 25% → 50% → 75% → 90% → $0.01. Terminal rung is a penny; there
  is NO 7-cent stage (that's HD/Lowe's). 90%-off is the pre-penny predictor.
- Penny day is Tuesday; internal "START" pull task drops Monday. Model a ±1-day
  register-update slip. Seasonal color-dot events accelerate the ladder.
- Penny-listing and store-has-stock are SEPARATE probabilities: an item can be
  flagged penny nationally while a given store has already pulled it.

## UX honesty (enforced in retailers.ts copy already)

Never promise "they have to sell it to you." DG policy says honour a found penny
item, but registers refuse routinely and there is no consumer-law right. Mirror
community etiquette: don't argue staff, don't call corporate, take it to the
counter, and if refused just have them remove it from the sale.

RULES: never invent a DG price or count — a penny lead is a member's report,
never a guess. Touch only DG rows. Budget $0. No deploys from this routine.
