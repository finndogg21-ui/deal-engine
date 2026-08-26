# Costco recon — 2026-08-26

Costco as retailer #8. The architecture was already settled in
company/next-retailer.md (community-report, not a scrape); this pass confirmed
the mechanics for honest copy and resolved the one open risk. Claims tagged
[verified] (multiple sources) or [single-source].

## Verdict

Community-reported CLEARANCE retailer, same path as Tractor Supply. Costco's
manager markdowns exist only in the warehouse — nothing to scrape.

## Mechanics [verified across costco97, Tasting Table, CostLow, KCL]

Price-ending code system (decoded convention, not official Costco policy):
- **.99** = regular price.
- **.97** = manager clearance markdown — the workhorse signal hunters chase.
- **.00 / .88** = final closeout, the deepest reliable markdown (returns, floor
  models, last units; often on flatbed carts). Discretionary, human-set.
- **asterisk (✱) top-right of the sign** = "death star": not being reordered,
  gone once sold out. Independent of price ending.
- (.49/.79 odd endings = temporary manufacturer rebates, not store clearance.)

- **No penny mechanic.** Nothing algorithmic ends at $0.01; the practical floor
  is the .00/.88 closeout. Rare social anecdotes of $0.01 rings are register/
  liquidation glitches, not policy. Do not model a penny rung. [verified by
  omission; anecdotes single-source]
- **Warehouse-specific, not national.** A .97 at your warehouse can be full
  price at the next — managers set clearance locally. costco.com and warehouses
  are separate, non-syncing systems that don't price-match each other. There IS
  a separate online .97 pool (searchable on costco.com via keyword
  "whilesupplieslast"), but it's a different inventory, not a mirror of any
  warehouse floor. [verified]

## Community — large, mainstream, low-stigma [verified where numbered]

Bigger and more public than the HD/DG penny scenes. IG @costcodeals 1.6M+
followers; "Costco Finds" FB group ~1.4M [single-source]; costco97.com delivers
to 138K+ subscribers 3x/week. Reddit counts now hidden (removed Sept 2025) —
r/Costco historically >1M, r/CostcoDeals/r/CostcoFinds tens of thousands.

## Provenance — LOW risk, crowd-scanned (overturns the pre-flag)

The recon pre-flagged a DG-style leaked-list risk. The research overturned it:
Costco floor markdowns are set LOCALLY per warehouse, so there is no central
markdown list to leak — which is precisely why the ecosystem is crowd-scanned.
costco97.com's own stated method: members photograph the in-warehouse tag and
submit it. Sourcing risk is LOW, materially safer than DG. [verified across the
blogs' self-descriptions]

The only gray zone is a DIFFERENT layer — advance scans of the monthly Coupon
Book / regional "Hot Buys" (vendor-funded promotions, not manager clearance),
which some blogs post before they go live. Those carry the leak ambiguity and
are explicitly out of scope. See company/routines/costco-reports.md.

## What shipped this pass

- costco added to the member-report allowlist (costco → costco-members), the
  discovery label, the stock route (perStoreStock false), StockCheck +
  RetailerDeals slugs, the in-app rail, the shared COMMUNITY_STORES config, and
  the report-form retailer config (clearance-only, no penny toggle).
- Store page /stores/costco ships 'community' with the price-code copy above.
- Routine: company/routines/costco-reports.md, with the corrected (low-risk)
  provenance guidance and the Coupon-Book carve-out.

Deliberately NOT shipped: the separate costco.com "whilesupplieslast" online
clearance scrape — a possible future national tier, but a different inventory
from the warehouse markdowns members actually chase, and lower value.
