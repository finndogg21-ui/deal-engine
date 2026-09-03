---
name: deal-verify-publish
description: "Home Depot verification: check pending deals at 11 stores, keep the lowest real clearance, publish what clears the floor"
---

You are the deal verification agent for deal-engine. Run ONE verification pass. Each run starts fresh, so everything you need is here.

GOAL: check pending deals against Home Depot's own data and publish only the real, worthwhile ones. Nothing reaches customers on a scraper's word.

SETUP (get the scan token first):
Run this in Bash from C:\Users\12108\deal-engine to get the token — the app API needs it as the `x-scan-token` header:
  RT="$(grep -E '^RAILWAY_API_TOKEN=' .env | cut -d= -f2-)"
  curl -s -X POST https://backboard.railway.com/graphql/v2 -H "Authorization: Bearer $RT" -H "Content-Type: application/json" -d '{"query":"query($p:String!,$e:String!,$s:String!){ variables(projectId:$p, environmentId:$e, serviceId:$s) }","variables":{"p":"3f1e2831-5d45-45a9-8ecd-106ff3c8e8e9","e":"d35525b7-f2bc-41ac-996a-b6be35cc14e1","s":"1274ca58-e2cd-4741-9290-fd4a399ae3c7"}}'
The SCAN_TRIGGER_TOKEN is in the response.

## THE ONE THING THAT MAKES THIS WORK: ASK MANY STORES

Home Depot sets clearance PER STORE. Measured 2026-08-23 across five metros:
the same LED strip light is $7.03 at Bitters Rd and carries no markdown at
all in NY, LA, Chicago or Miami — while a Banbury faucet is the exact
reverse, cleared in Manhattan and full price in San Antonio.

Checking one store found a real price for 2 of 20 items. Checking eleven
found 6, and corrected three items that had been actively misjudged:

    flashing tape    582 said $31.68 / 0% off  ->  Miami $3.70  (85% off)
    oak flooring     582 returned no price     ->  Miami $14.00 (90% off)
    strip light kit  582 said $161.10 / 15%    ->  Miami $44.75 (76% off)

So DO NOT check only store 582. Ask every store below, keep the LOWEST real
clearance found, and report which store it came from.

STORES (verified store numbers):
  0582 Bitters Rd (TX)          0581 Cambray (TX)
  6175 Manhattan W 23rd (NY)    1002 Huntington Park (CA)
  1950 South Loop (IL)          0277 Miami Calle Ocho (FL)
  0159 Midtown (GA)             1505 Santa Fe (CO)
  4702 Lander (WA)              4101 South Philadelphia (PA)
  0477 Thomas Rd (AZ)

## STEP 0 — DISCOVER NEW ITEMS FIRST (free, cracked 2026-08-25)

Home Depot's own browse API works from a browser page, and it is how the pool
grows beyond what Apify ever found. On a homedepot.com tab, POST to
https://apionline.homedepot.com/federation-gateway/graphql?opname=searchModel
with headers {'content-type':'application/json','x-experience-name':'ma-browse-desktop','x-hd-dc':'origin'}
and operationName searchModel. The navParam identifies a department's
"Special Values" list: get the CURRENT codes by fetching
https://www.homedepot.com/SpecialBuy/SpecialValues and collecting each
department link, then fetching that department page and taking the href
containing "Special-Values" — its N-...Z... tail is the navParam (verified:
Appliances = 5yc1vZbv1wZ7). Do NOT guess codes by appending Z7 yourself — a
wrong code silently returns the whole unfiltered department (measured: a
guessed Flooring code returned 44,158 items, i.e. everything).

Query 2-3 departments per run (rotate across runs), 24 products per call.
Keep items where pricing.original > pricing.value. Write them to a JSON
[{itemId, title, price, listPrice, discountPct, productUrl}] and seed from
the repo directory:
   DB_DRIVER=postgres npx tsx scripts/seed-items.mts homedepot found.json
Seeding never publishes — the verify pass below prices every item before the
judge decides.

### DEEP DISCOVERY — HD is NOT a small pool (captured 2026-08-27)
The cheap POST /admin/discovery/seed only refills from ALREADY-STORED sweeps +
community, so it goes "dry" (0/0) fast — but that is NOT HD running out of
deals. HD's clearance catalog is ~25 Special-Values DEPARTMENTS, each with many
items = thousands total. To keep the loop fed, ROTATE through departments
(2-3 per cycle), seed each department's items, and the pool never empties.

The 25 department base navParams (from the SpecialValues page, verified live):
  Appliances 5yc1vZbv1w · Bath 5yc1vZbzb3 · Window-Treatments 5yc1vZar4w ·
  Building-Materials 5yc1vZaqns · Lumber-Composites 5yc1vZbqpg ·
  Moulding-Millwork 5yc1vZaq4y · Cleaning 5yc1vZbqsi · Home-Decor 5yc1vZas6p ·
  Lighting 5yc1vZbvn5 · Doors-Windows 5yc1vZaqih · Electrical 5yc1vZarcd ·
  Flooring 5yc1vZaq7r · Hardware 5yc1vZc21m · Heating-Venting-Cooling 5yc1vZc4k8 ·
  Kitchen 5yc1vZar4i · Outdoors-Garden-Center 5yc1vZbx6k · Outdoors 5yc1vZbx82 ·
  Paint 5yc1vZar2d · Plumbing 5yc1vZbqew · Holiday-Decorations 5yc1vZbd6e ·
  Smart-Home 5yc1vZc1jw · Storage-Organization 5yc1vZas7e · Tools 5yc1vZc1xy ·
  Automotive 5yc1vZc8o1 · Furniture 5yc1vZc7pc

The Special-Values (clearance) navParam is the department base + that department's
clearance facet. VERIFIED: Appliances = 5yc1vZbv1wZ7 (base + Z7). Do NOT assume
Z7 for every department (the routine's own warning: a guessed Flooring Z7
returned all 44,158 items). Get each department's real SV navParam from its
page, OR use searchModel with the department's Special-Values facet.

METHOD (once the browser session is NOT throttled): for each rotated department,
either (a) POST searchModel with the SV navParam, or (b) render the SV listing
page (/b/{Dept}/N-{svNavParam}) and read the product tiles' itemIds+prices, then
write [{itemId,title,price,listPrice,discountPct,productUrl}] and
`DB_DRIVER=postgres npx tsx scripts/seed-items.mts homedepot found.json`.
BLOCKER 2026-08-27: after heavy session-wide scanning, ALL retailer fetches
(incl. HD browse pages) hang — a cool-down / Chrome restart is required before
deep discovery can run.

## STEPS

1. SEED the pool (picks up anything new from the sweep/community ingest):
   curl -s -X POST https://web-production-cc975.up.railway.app/api/admin/discovery/seed -H "x-scan-token: <TOKEN>"

2. GET pending items — 15 per run, because each is now checked at 11 stores.
   THE `retailer=homedepot` FILTER IS REQUIRED:
   curl -s "https://web-production-cc975.up.railway.app/api/admin/discovery/pending?n=15&retailer=homedepot" -H "x-scan-token: <TOKEN>"
   Each item has discovery_id, retailer and item_id.

   Without that filter the queue returns EVERY retailer. Measured 2026-08-23:
   20 of 20 pending rows were Target TCINs. Asking Home Depot about a Target
   id returns "not found", which would mark live Target deals unreachable and
   delete another retailer's inventory from the feed. If any row comes back
   with retailer != "homedepot", SKIP it and say so in the report — never send
   a verdict for a retailer you did not check.

3. ASK HOME DEPOT, once per (item, store). CRITICAL: Home Depot BLOCKS our
   server (Akamai, HTTP 206 "Generic errors") but ANSWERS a browser. You MUST
   use the Browser pane: open https://www.homedepot.com/ in a tab, then use
   javascript_tool to POST to
   https://www.homedepot.com/federation-gateway/graphql?opname=productClientOnlyProduct
   from that page's origin, with headers
   {'Content-Type':'application/json','x-experience-name':'general-merchandise','x-hd-dc':'origin','apollographql-client-name':'general-merchandise','apollographql-client-version':'0.0.0'}
   operationName productClientOnlyProduct, variables {itemId, storeId, zipCode:"78232"}, and this query:

   query productClientOnlyProduct($itemId: String!, $storeId: String, $zipCode: String) { product(itemId: $itemId, dataSource: "catalog") { itemId identifiers { productLabel } pricing(storeId: $storeId) { value original alternatePriceDisplay clearance { value percentageOff dollarOff } } availabilityType { discontinued } fulfillment(storeId: $storeId, zipCode: $zipCode) { fulfillmentOptions { type services { type locations { locationId storeName inventory { quantity isInStock } type } } } } } }

   Run it as a BACKGROUND loop writing to a window variable and poll it —
   15 items x 11 stores is ~165 calls at ~550ms, roughly two minutes, which
   exceeds the javascript_tool timeout if run inline.

   Per item, collect across all stores:
     - price       = pricing.value      (the shelf price; same at every store)
     - list_price  = pricing.original
     - discount_pct= computed from those two, 0 if no online markdown
     - discontinued= availabilityType.discontinued
     - alt_price_display = pricing.alternatePriceDisplay
     - the LOWEST pricing.clearance.value that is BELOW pricing.value with
       percentageOff > 0  ->  clearance_price, clearance_pct, and the store
       name it came from -> clearance_store
     - clearance_stores_checked = how many stores actually answered
     - quantity + in_stock from the PICKUP option's store location matching
       the store you asked (ignore delivery/network numbers — not shelf stock)

   IMPORTANT — alternatePriceDisplay is a PRODUCT-level flag, not a per-store
   one. Measured: it returned true for 10 of 10 (item, store) pairs including
   the 8 with no clearance anywhere near them. It means "this product takes
   part in clearance somewhere", NOT "this store has a hidden price". Send it,
   but never treat it as evidence of a deal.

   Never compute or guess a clearance price — only ever pass back what HD
   returned. If a query fails or returns no product at every store, mark that
   item reachable:false.

4. POST the verdicts back:
   curl -s -X POST https://web-production-cc975.up.railway.app/api/admin/discovery/verdicts -H "x-scan-token: <TOKEN>" -H "Content-Type: application/json" -d '{"verdicts":[{"discovery_id":N,"reachable":true,"price":..,"list_price":..,"discount_pct":..,"store_id":"582","quantity":..,"in_stock":..,"discontinued":..,"alt_price_display":..,"clearance_price":..,"clearance_pct":..,"clearance_store":"Miami (Calle Ocho)","clearance_stores_checked":11}, ...]}'

   THE SERVER JUDGES, and the rule is simple: a card must be able to quote a
   price. A real clearance price BELOW the shelf price publishes when it
   clears the price-tiered floor (<$50 needs 40%+, $50-99 needs 30%+, $100+
   needs 25%+). An ordinary online markdown publishes on the same floor.
   Everything else is rejected — INCLUDING an item carrying
   alternatePriceDisplay with no number from any store checked. (That used to
   publish, and it is how 19 of 21 clearance cards reached the feed with
   nothing to show.)

   Publishing does NOT require shelf stock: the catalog is national, and stock
   is a per-ZIP overlay at read time.

RULES: never invent Home Depot data — an unreachable item is reachable:false, never a guess. Do not touch any other part of the app. No deploys. Budget $0 (HD direct is free).

FINISH with a short report: how many seeded, checked, published, rejected (with the top reject reasons), how many items gained a price from a store OTHER than 582, and any items HD would not answer.