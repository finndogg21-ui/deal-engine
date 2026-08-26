# Tractor Supply recon — 2026-08-26

Should Tractor Supply (TSC) be a retailer, and built how? Recon only. Method:
two parallel research passes (endpoint/stack; mechanics/community) plus
firsthand probing of tractorsupply.com. Claims tagged [verified] (multiple
sources or reproduced firsthand) or [single-source].

## Decisive findings, up front

1. **Akamai Bot Manager walls the whole site.** Server-side curl returns HTTP
   000 (TLS completes, no response); even the browser pane gets "Access Denied"
   on the clearance category — both on a direct nav AND on an in-site click.
   The one dedicated Apify actor (`fortuitous_pirate/tractorsupply-camoufox`)
   is marked DEPRECATED — Akamai-blocked. [verified firsthand + Apify]
2. **No official API.** No developer portal, no free products feed. The only
   channel is a Partnerize affiliate datafeed, application-gated, not per-store
   or clearance-granular. Unwrangle does NOT cover TSC; no Traject/RapidAPI
   endpoint. [verified]
3. **Clearance is hybrid, and the online tier is national.** TSC runs online
   clearance category pages (`/tsc/clearance`, `/tsc/vc/clearance-markdowns`,
   `?filter=71`) with was/now pricing down to ~$0.09 — but that price is
   **national, the same at every store** (unlike Home Depot/DG per-store). The
   deeper red-tag/manager markdowns are **in-store only, YMMV, not online**,
   and are explicitly excluded from TSC's price-match policy. [verified]
4. **NO penny mechanic and NO price-ending code system.** The premise's ".06/
   .03/penny" belongs to Home Depot; TSC is not in any price-tag-code guide and
   no penny ($0.01) literature mentions it. TSC clearance is plain percent
   markdowns, ~40–80% off, on standard "WAS" tags. Do not model a penny rung or
   a cent-ending code for TSC. [verified by absence across code/penny guides]

## Stack

- Next.js frontend (React/Node), AEM as CMS, Java commerce tier + SAP CRM +
  Manhattan (WMS/OMS). Ecommerce engine likely SAP-adjacent, unconfirmed. Site
  search vendor not confirmed (not Coveo/Bloomreach/Algolia per case studies).
  `__NEXT_DATA__` was absent on the pages we could load. [mixed]

## Cadence & mechanics

- Clearance refreshes ~weekly, online and in-store. Big events are seasonal
  transitions: winter ~50% off in Jan, ~40% remnants Mar, summer ~50% Jul,
  year-end up to 60% Dec. Farm/ranch/pet/seasonal clearance hardest. [verified]
- Pricing national; **availability highly store-variable (every hunter thread is
  tagged YMMV)**. Deepest in-store remnants often still show full price online.

## Competition & demand — thin, and already covered free

- **r/TractorSupply ≈ 1,064 subscribers** (a general sub, ~1 post/day). No
  dedicated TSC clearance subreddit or notable FB group. An order of magnitude
  smaller than the HD (155k+) / DG (hundreds of k across FB) penny scenes.
  TSC hunting is a byproduct of farm/tool shoppers, not an organized subculture.
- **The only existing TSC clearance tracker is RebelSavings** (free) — and this
  project already proved RebelSavings' dataset 100% FABRICATED (item ids 404,
  wrong brands, coords in Mexico; see src/ingest/community.ts). So the "gap is
  covered" claim is hollow: it's covered by a source we cannot trust.
- Every paid app (Scavenger $47, Deal Soldier $44, Penny/pennydeals, BrickSeek,
  Endless, Hidden Clearances) OMITS TSC. Genuine coverage gap, but a low-demand
  one, and there's no $0.01 lottery hook to drive virality.

## ARCHITECTURE VERDICT

TSC is a **community-reported clearance retailer**, same path as Dollar General,
with three differences from DG in the model:
- **Clearance, not penny.** A TSC report carries a real price and "was", clears
  the tiered floor — never a $0.01. No penny toggle for TSC.
- **National pricing.** The price is the same at every store (like Best Buy), so
  a report is a national fact; store location is about *availability* (YMMV),
  not a different price.
- No code system to model. 90%-off is not a thing here; depths run 40–80%.

Why NOT a vendor sweep now: the online tier is Akamai-walled from our
environment (proven firsthand), needs residential proxies + stealth headless =
real cost and fragile (it already killed the Apify actor). That's a documented
FUTURE option, explicitly gated behind cost — not this pass. The deep-value tier
is in-store YMMV anyway, which is crowd-only.

Honest note for the operator: TSC is the lowest-value add of the retailers so
far — thin demand, no viral hook, and the incumbent is a fabricated feed. The
reason to add it is breadth of the multi-store aggregator and near-zero marginal
cost (the community path already exists), NOT because TSC is a hero product.

## What shipped this pass

- Member-report endpoint generalized from DG-only to a retailer allowlist
  (dollargeneral → dg-members, tractorsupply → tsc-members); dedupe keyed by
  retailer. DG behaviour unchanged by default.
- TSC wired as a first-class `community` retailer: retailers.ts (national
  clearance / red-tag / YMMV / no-penny copy), discovery label, stock route
  (perStoreStock false), StockCheck + RetailerDeals slugs, in-app rail (opens
  on the All track, since TSC has no penny track).
- Report form made retailer-aware: TSC opens clearance-only (no penny toggle).
- Routine: company/routines/tractor-supply-reports.md.

Deliberately NOT shipped: any live TSC scrape. The Akamai-gated online tier is a
future proxied-browser job, not a $0 call.
