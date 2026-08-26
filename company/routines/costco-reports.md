# Routine — Costco member markdown reports

Run the Costco find-ingest cycle for deal-engine. Repo is this checkout, live
site https://web-production-cc975.up.railway.app, prod DB via DATABASE_URL in
the repo .env.

Costco is NOT a vendor sweep. Its manager markdowns — the .97 prices and the
asterisk/"death star" tags — exist only in the warehouse and never appear on
costco.com (verified across recon passes + a live browser probe, see
company/next-retailer.md). So Costco rides the `community_reports` path, as a
CLEARANCE retailer, like Tractor Supply.

## How Costco differs from DG / TSC

- **Markdown, not penny.** A Costco report carries a real price and "was" and
  must clear the tiered floor. There is NO penny mechanic; the signal is the
  .97 ending and the asterisk (not-being-reordered) tag. Depths are percent
  cuts on discontinued stock.
- Source tag: `costco-members`, retailer `costco`, kind `clearance`.
- Opens on the All track, not a penny track.

## Sourcing: crowd-scanned, and LOWER risk than Dollar General

The recon pre-flagged a DG-style leak risk; the research overturned that. Costco
floor markdowns (.97 / .00 / .88 / asterisk) are set by each warehouse manager
LOCALLY — there is no central corporate markdown list to leak, which is exactly
why the whole Costco deal ecosystem became crowd-scanned. costco97.com states
its own method plainly: members photograph the in-warehouse tag and submit it.
So sourcing risk here is LOW, materially safer than DG.

The ONLY genuine gray zone is a DIFFERENT layer: advance scans of the monthly
Coupon Book / regional "Hot Buys" flyers, which some blogs post before they go
live. Those are vendor-funded PROMOTIONS, not manager clearance, and they carry
the leak ambiguity. Do not ingest them.

The rule, then: a Costco report is a member's own in-warehouse markdown tag (a
.97, a .00/.88 closeout, an asterisk sign) — verified on the shelf, attributed
to a location. Member-observed public in-store pricing only. Do not wire any
third-party list without a fresh provenance check, and never a not-yet-live
Coupon Book / Hot Buys scan. Every source still clears the fabrication gate
(the RebelSavings lesson).

RULES: never invent a Costco price — a markdown lead is a member's report, never
a guess. Touch only Costco rows. Budget $0. No deploys from this routine.
