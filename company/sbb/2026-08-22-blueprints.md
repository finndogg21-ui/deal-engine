# SBB Blueprints — 2026-08-22 (test cycle)

Council: 5 advisors, converged (peer review skipped per skill rule).
Chairman resolution of the one clash: CTA-first (First Principles) vs
trust-first (Contrarian) → the CTA ships ON the new penny page together with
the trust patches, so neither waits.

## Build tonight (3 items, low-risk frontend)

**B1 — Penny detail PAGE (founder-mandatory + Expansionist's insight).**
Problem: "See all the details" opens a side panel. Change: route
`/app/p/:reportId` → full page: $0.01 replay on load, receipt cells,
sighting map, HD store-mode link, and the trial CTA ("Get penny alerts near
you — start free trial" → /signup). Every penny becomes a shareable URL —
distribution + conversion in one build. Files: PennyDealPage.tsx (new),
lib/deal-ui.ts (shared helpers), AllDeals.tsx (card → navigate, panel
removed), App.tsx (route), dashboard.css. Risk: LOW. Guard (Contrarian):
back returns to the spool; browser back handles it (no modal state to lose).

**B2 — Card trust patches.** 21-state wall → "CA, KY, CO +18 more"; titleless
records → "Home Depot item #1007437601". Display-only. Risk: TRIVIAL.

**B3 — Activation + header CTA.** Passive strip when no ZIP is set ("Set your
ZIP to see local stock →" — focuses the header input; never a modal), and an
uppercase mono "START FREE TRIAL" bordered link in the header (inverts on
hover — pure tape). Risk: LOW.

## Deferred (logged, not built tonight)

- **Landing page**: replace the fabricated-sounding hero ("62 on the shelf,
  aisle 50") with a REAL crowd-reported find, properly hedged, and reskin to
  THE TAPE. All five advisors flagged it; it is a full night of its own. The
  green→B&W brand break stands until then.
- Anything backend/data (constitution).
