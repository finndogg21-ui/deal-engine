# Dollar General recon — 2026-08-25

Should DG be retailer #6, and if so, built how? Recon only; no code shipped on
this pass. Method: five parallel research passes (Reddit/YouTube/blogs) plus
first-party endpoint probing against dollargeneral.com. Every claim tagged
[verified] (multiple independent sources or reproduced firsthand) or
[single-source].

## The decisive finding, up front

**DG clearance and penny prices are REGISTER-ONLY. They do not exist on any web
surface.** This is the Home Depot penny situation exactly: the markdown lives in
the store's POS, carries no shelf tag, and is visible only by scanning the item's
barcode in the DG app while standing in that store. [verified — research pass +
Krazy Coupon Lady, RetailWire, PennyPinchinMom]

Consequence for the build: **DG is not a scrape-a-clearance-endpoint retailer**
like Target (RedSky), Lowe's (Back Aisle), or Walmart (`__NEXT_DATA__`). The data
that makes those valuable — the clearance price — is structurally unreachable for
DG. A DG module cannot be a vendor sweep. It has to ride the crowd-sourced
`community_reports` path the repo already has, or it does not exist at all.

## Firsthand endpoint probe (2026-08-25)

- DG runs **Adobe Experience Manager** (clientlibs/granite) for content plus
  **Kibo commerce** (`api-prod1a-use.productmarketingcloud.com`, siteId 40) for
  catalog. Not Next.js — no `__NEXT_DATA__` blob like Walmart. [verified firsthand]
- `/c/on-sale` renders **national online sale prices server-side** (43 price
  tokens, one `application/ld+json` block on the page). So online sale price IS
  scrapable. [verified firsthand]
- But that is the online price, one national number — NOT the per-store in-store
  clearance/penny price. The two are different, and only the latter is what the
  penny community trades in. Scraping `/c/on-sale` would publish shallow national
  sales, not penny finds. Low value, and off-brand for a penny app.
- Store-locator pages carry structured store data (address/lat-lng/hours/ref id)
  in HTML data-attributes — locations are scrapable, products/prices are not.
  [verified — research pass, AllThePlaces spider]
- No official DG developer/products API. Neither BigBox (HD only) nor Unwrangle
  (HD/Lowe's/Target/Sam's, no DG) carries Dollar General. Apify has DG category
  scrapers (~$9/1k results) but their output has **no clearance field**. [verified]

## DATA ACCESS — RESOLVED: crowd-sourced human intelligence, no feed

The penny list is fundamentally **community-scanned**, confirmed across 8 sources
(Paydirt, Penny Finder/MoneyPantry, Scavenger, pennydeals.app, KCL, RetailWire,
TheFreebieGuy). The real pipeline every existing source runs:

  employee/insider intel (advance candidates, some groups have DG-employee
  members who leak pre-Tuesday) → crowd-sourced in-store barcode scans
  (verification via the DG app price-checker or a self-checkout test scan) →
  editorial aggregation with UPCs + product links.

Why scrape-only is structurally impossible for DG [verified]:
1. No feed lists penny items — the DG app only returns a price for a UPC you
   already hand it, so you need the crowd's UPC list as input first. Circular
   without the human layer.
2. "Being a penny" is a physical fact (item still on a shelf a short-staffed
   store hasn't pulled), not a digital one. Only a person in the aisle confirms it.
3. Per-store variance: same UPC is $0.01 at one store, full price at the next.
   No national feed exists.

Scavenger's line: *"For Dollar General's list-driven pennies, the crowd is still
the only game running."* Penny Finder holds a crowdsourced DB of 3,700+ verified
DG penny UPCs that "only updates when a shopper reports a find."

**SHARPER TRUTH from DG employees (r/DollarGeneralWorkers, primary sources):** the
*public* penny lists (FB groups, blog lists) are predominantly **corporate-level
leaks**, not crowd scans. Workers repeatedly confirm the FB groups get the list a
week before stores do — impossible without an insider. The internal list arrives
as a "START" app task Mondays; prices flip Tuesday. Employees who buy penny items
are terminated (first offense). The DG-app barcode scan is the shopper's
**verification** layer, not the list's source.

Consequence, and it hardens the RISKS finding: republishing a third-party DG penny
list means republishing leaked corporate data at the root — the exact sourcing
tripwire. The clean source is the app's OWN members reporting what scanned $0.01 on
a shelf (verified-on-shelf), NOT ingesting someone's leaked list.

**Adding DG is not an integration problem, it's a community problem.** The moat
is the reporting network, not a data source. Either we seed/own a report flow, or
we aggregate an existing crowd list (which carries its own sourcing/ToS questions,
see RISKS pass).

Caveat: Reddit (r/DollarGeneralPenny) was not directly fetchable this pass
(WebFetch blocked for reddit.com + .json); its corroboration is secondary.

## RISKS — RESOLVED: low legal exposure, one sourcing tripwire, be honest in UX

- **DG's stance:** $0.01 is an internal "pull and destroy" signal, not a sale
  price. Stores get penny lists internally (Tuesdays) and are told to remove
  items. Items only penny out for customers when staff don't pull in time.
  [verified]
- **But selling is required by DG's own written policy** — quoted identically
  across every major penny site: *"If any penny item is identified by a customer,
  ALWAYS sell the product to the customer at 1c… it is never appropriate to deny
  the sale."* Penny shopping is legal; you pay the scanned price. [verified]
- **Register refusals are common anyway.** The "they legally HAVE to sell it" is
  a half-myth: it's DG *internal policy*, not a consumer right, so a store can
  refuse and you have no recourse ("ask them to remove it from the transaction").
  A named hunter was refused and told *"I can't believe everything I read
  online."* [verified — The Sun + community-wide]
- **No enforcement against publishers, ever.** No C&D, suit, or takedown against
  any penny-list site/app on record. TheFreebieGuy, KCL, Penny Pinchin' Mom have
  run openly for years with SKUs and photos. Bulk facts (a SKU rings $0.01) are
  not copyrightable. Direct legal exposure to a publisher looks low. [verified —
  absence across targeted search]
- **The one tripwire:** the raw pre-Tuesday lists originate as insider leaks (DG
  employees breaching employment terms). A business built on insider pre-release
  feeds carries reputational + tortious-interference-flavored risk and is the one
  thing that could move DG from tolerance to action. **Crowd-sourced "verified on
  shelf" reports carry far less taint than pre-Tuesday insider leaks** — so the
  product must lean on member scans, not on republishing leaked lists.
- **UX honesty (fits this app's whole ethos):** do NOT promise "they have to sell
  it to you." Represent the refusal reality honestly; don't amplify the myth that
  gets hunters into register confrontations. Community etiquette itself says don't
  argue with staff, don't call corporate.

## MARKDOWN MECHANICS — RESOLVED

- **Full ladder, from DG employees themselves** [verified — r/DollarGeneralWorkers
  primary sources]: `10% → 25% → 50% → 75% → 90% → $0.01`. (The earlier
  consumer-blog pass compressed this to 50/70/90; the worker accounts are more
  granular and authoritative. Food/consumables start shallower.) Discontinued
  items get ~10% off when pulled from planogram, then step down over weekly
  markdown windows.
- Seasonal clearance runs a **colored-dot system** (yellow/blue/brown/green dots);
  big 90%-off seasonal events precede chain-wide penny-outs.
- **Terminal rung is $0.01 only. There is NO 7-cent rung** — that's a Home
  Depot/Lowe's convention; "7 cents" in DG accounts is a cumulative basket total,
  not a price tier. Do not model a $0.07 stage. [verified across 4 sources]
- **No reliable cent-ending code** like HD's .06/.03/.01. Best weak signal:
  yellow stickers ending .25/.50 tend to penny within 1-2 weeks. Treat the
  **90%-off rung as the predictive edge**, not a cent ending.
- **Cadence: weekly, Tuesday, ±1 day** (registers update overnight Mon→Tue, some
  stores slip to Wed). Quarterly clearance events (~every 4-8 wks, Fri-Sun) layer
  on as ladder accelerants. [verified]
- **Model penny-listing and store-has-stock as SEPARATE probabilities.** An item
  can be flagged penny nationally while a given store has already pulled it —
  the noisy variable, and exactly why per-store crowd confirmation matters.
- Verify in-store via DG app scan (app shows $0.00 or $0.01 = penny at register);
  register is final arbiter.

## COMPETITION + DEMAND — RESOLVED

- **Free content incumbents own the consumer audience via ads/affiliate:**
  TheFreebieGuy (self-reported 1M+ member FB group, weekly Tue list), Krazy
  Coupon Lady, Kristie's Connections (223K YouTube subs), Penny Pinchin' Mom.
  None do store-level data. ("Penny Pincher Jenn" from the brief appears not to
  exist — likely a misremember of Penny Pinchin' Mom.)
- **The direct analog to what we'd build: Penny General (pennygeneral.net)** —
  free web tracker aggregating publicly-posted penny lists, images/UPC/SKU,
  search, and a **32-store filter**. Small, no monetization. This is the closest
  existing product and it's thin.
- **Reseller segment is underserved and pays.** Penny Flip (pennyflip.ai) claims
  24/7 DG monitoring + per-item net-profit + JSON API, reseller-framed. The HD
  paid scene proves willingness to pay $40-50/mo for store-level freshness
  (Scavenger $47, Deal Soldier $44). DG-focused paid apps are all weak: Penny
  Finder ($2.99, 2.7★, stale), pennydeals.app ($15-30/mo, 20 ratings, 3.0★).
- **Demand is large and mainstream** — bigger and more consumer than the HD penny
  crowd, skewing frugal-shopper/reseller. Spanish-first is an explicitly
  underserved niche.
- **Unclaimed territory: real per-store DG truth.** Nobody credible does it,
  because it requires bodies in aisles — the same crowd problem, which is the
  moat if we can seed the reports.

## ARCHITECTURE VERDICT

DG is a **community-reports retailer, not a vendor sweep.** There is no
`dollar-general-direct.ts` to write because there is no clearance/penny endpoint
to adapt — that data is register-only and physical. The build is:

1. Wire DG as a first-class retailer in the existing `community_reports` /
   community-deals path (the same crowd/penny-report infrastructure the HD penny
   side already uses), with its own two-track markdown ladder and a Tuesday-±1
   cadence note. Seed reports come from member scans, NOT insider pre-release
   lists (the one sourcing tripwire from the RISKS pass).
2. A distinct, honest coverage tier on the site — not "online prices," not
   "in-store stock", but "community-reported penny finds", because we're
   republishing verified member finds, not a price we measured.
3. Honest UX: never promise "they have to sell it to you." Surface the
   refusal reality; mirror community etiquette (don't argue staff, don't call
   corporate).

Explicitly NOT this pass: scraping `/c/on-sale` national online sales (shallow,
off-brand for a penny app) and anything sourced from leaked pre-Tuesday lists.

## What shipped on this pass (2026-08-25)

- `community_reports` ingest made retailer-correct — it hardcoded 'homedepot' in
  the INSERT, which would mislabel every DG report. Now carries each report's
  retailer; `CommunityReport` gains a `retailer` field + a `dg-members` source.
- DG wired as a first-class retailer: shared `retailers.ts` (new `community`
  coverage tier + honest DG page copy), `discovery.ts` reject-reason label,
  `stock.ts` (perStoreStock false — a DG stock check can only say it's
  impossible), `StockCheck` slug. The in-app rail is deliberately NOT touched:
  DG has no browsable feed yet, so it must not appear shoppable.
- Store page live at `/stores/dollar-general` as `community` — honest "reported
  by hunters, not scraped" framing, not-yet-shoppable CTA.
- Routine: `company/routines/dollar-general-reports.md`, encoding the
  member-scans-not-leaked-lists rule so no future session wires a leak scraper.

Deliberately NOT shipped: any live DG data source. The member-report submission
flow (auth'd POST + UI + moderation) is the next build; until it exists DG shows
the page and the model, not a feed.

## Provisional architecture (to confirm after the full recon)

If the remaining passes hold, the DG module is a **community-reports retailer**,
not a vendor sweep:
- Reuse `community_reports` / `community-deals` — DG penny finds are member scan
  reports, attributed to a store, with the same fabrication gate the other
  community sources already pass through.
- The site page ships as a distinct coverage tier — NOT "online prices" and NOT
  "in-store stock", but something honest like "community-reported penny finds",
  because we are republishing what hunters found, not a price we measured.
- No `bestbuy-direct`-style adapter, because there is no endpoint to adapt.
