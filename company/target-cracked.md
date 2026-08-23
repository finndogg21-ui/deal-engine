# Target: cracked, free, and better than Home Depot

**Date:** 2026-08-23. Every claim below was VERIFIED live from a browser
session against Target's own API (not vendor marketing, not inference).

## The finding

Target's storefront runs on **RedSky**, and it answers us directly with a
public web key lifted from target.com. No vendor, no cost.

- Endpoint (product + price): `redsky.target.com/redsky_aggregations/v1/web/pdp_client_v1`
- Endpoint (per-store stock): `redsky.target.com/redsky_aggregations/v1/web/product_fulfillment_v1`
- Key seen in use: `9f36aeafbe60771e321a7cc95a781407` (public web client key;
  expect rotation — read it from the page rather than hardcoding long-term)

### What it returns (verified)

| Field | Meaning | Evidence |
|---|---|---|
| `price.current_retail_min` / `reg_retail_max` | store-level price vs regular | tcin 95104445: $6.80 vs $8.00 |
| `price.formatted_current_price_type` | `reg` / `clearance` | seen `reg` |
| **`price.mixed_current_price_type`** | **`mixed_clearance`** — Target's own clearance flag | seen on 95104445 |
| `price.location_id` | which store priced it | 3991 / 176 |
| **`location_available_to_promise_quantity`** | **exact shelf count** | 3, 0, 0, 10 across four tcins |
| `in_store_only.availability_status` | IN_STOCK / LIMITED_STOCK / OUT_OF_STOCK / NOT_SOLD_IN_STORE | matched the counts exactly |
| `store.location_name` | store name | Bitters, Stone Oak, Park North, … |

Quantities are REAL, not capped placeholders: four products at one store
returned 10 / 3 / 0 / 0 with statuses that agree (IN_STOCK, LIMITED_STOCK,
OUT_OF_STOCK, NOT_SOLD_IN_STORE).

### Store locator: free
target.com server-renders the visitor's stores into `__TGT_DATA__`. For ZIP
78232 it returned store 176 (Bitters) plus 1354 San Antonio North, 2239 Stone
Oak, 2467 Park North, 2803 Alamo Heights. Per-store queries against all five
worked.

## The constraint (same as Home Depot)

**Server-side calls are blocked.** From Node on Railway: `HTTP 403` with a
`captchaRelativeURL` body. From a browser origin: `HTTP 200`. So Target
verification must ride the browser agent, exactly like the HD checker.

## What this changes

- The overnight recon recommended Target partly on a **$15/mo vendor
  (RedCircle/Traject)**. That is **unnecessary** — Target's own API is free and
  gives MORE than we pay Apify for on Home Depot (clearance flag + exact
  quantity + multi-store + locator).
- Target is now the clear next module, and it is close to a copy of the HD
  one: same shape (discovery pool -> browser-side verify -> judge -> publish),
  different adapter.

## Module plan

1. `src/vendors/target-direct.ts` — mirror of `hd-direct.ts`: given tcin +
   store id, return {price, regPrice, clearanceFlag, quantity, storeName}.
2. `src/vendors/target-stores.ts` — ZIP -> store ids (read Target's own
   locator payload; no vendor).
3. Reuse `src/engine/discovery.ts` unchanged: the pool, judge, and publish
   flow are already retailer-agnostic (`retailer` column exists everywhere).
4. Discovery source for Target: its clearance browse/search pages give real
   tcins (verified: 95104445, 95127459, 94889277, 95171568 came straight off
   the clearance results page).
5. The scheduled browser agent gains a Target pass alongside the HD pass.

## Open questions

- The web key rotates. Read it from a page load each run rather than pinning
  it (cheap: parse the services config).
- Does the clearance flag ever appear with no real markdown (the HD
  `alternatePriceDisplay` trap)? Rule: only publish when the clearance price
  is BELOW the regular price and clears the tiered floor.
- Rate limits unknown. Keep the same polite cadence (~350ms between calls).
