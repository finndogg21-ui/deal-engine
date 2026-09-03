# Launch baseline — 2026-09-03 (24h autonomous run)

Live site: https://summitclearance.com, measured headless Chromium 375x812.

## Gates
- `npx tsc --noEmit` ✅ clean
- `npm run web:build` ✅ 372KB js / 67KB css, 557ms

## Mobile /app fold (the launch blocker)
- **firstDealTop = 640px** of an 812px viewport → **0 complete deals visible on load**
- header = 194px (brand + CTA row + caption + ZIP input)
- Measured chrome stack: header 194 + store rail ~65 + ZIP banner ~55 + ALL DEALS tab ~55
  + HIDDEN CLEARANCE tab ~55 + search ~55 + sort ~55 + "No scan yet" ~40 + gaps ~66 = 640px

## Duplication found (design bugs, post-1ad6bf9)
1. "All Deals" and "Hidden Clearance" each appear TWICE: once in the store rail,
   again as big spool tabs below. Two selectors for the same state.
2. ZIP appears TWICE: header "STORES NEAR [ZIP]" input AND the dashed
   "SET YOUR ZIP TO SEE STOCK NEAR YOU →" banner directly under the rail.

## Anonymous (preview) API behavior
- `GET /api/deals/published?limit=200` → 200 (teaser feed works: 12 deals, 8 hidden)
- `GET /api/scan/health` → 402
- `GET /api/stats/hit-rate` → 402
- `GET /api/community-deals?kind=penny...` → 402
- `GET /api/community-deals?kind=clearance...` → 402
- No console errors surfaced in this capture (prior session logged 4x 402 console errors).
- "No scan yet" chip shown to anonymous is likely the 402'd scan/health degrading confusingly.

## Landing page mobile
- Good: hero, dual CTA, "Two feeds" story all above fold. No blocking issues.

## Working state at start of run
- HEAD = 1ad6bf9 (hidden clearance first-class track), desktop session finished + quiet.
- Untracked from prior sessions: cloak-browser experiments, ingest scripts, audit scripts.
- Uncommitted: package.json/package-lock (cloakbrowser dep).
