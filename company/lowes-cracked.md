# Lowe's — cracked, free, and richer than both current retailers

Measured in-browser 2026-08-23. Every claim below is VERIFIED unless tagged.

## The endpoint

```
GET https://www.lowes.com/wpd/{itemNumber}/productdetail/{storeNumber}/Guest/{zip}
```

Public, no login, HTTP 200, ~30KB JSON. Parameterised by STORE NUMBER, which is
what makes per-store pricing possible.

**Browser-only.** A server-side curl with a normal User-Agent returns **403**
(verified). Same posture as Home Depot (Akamai 206) and Target (403 + captcha),
so the same browser-agent pattern applies and the cost is the same: **$0**.

## Where the data lives

```
productDetails[itemId].location.price.pricingDataList[0]
  usageType   "SELLING"
  displayType "REGULAR" | "WAS"     <- the markdown tell
  priceType   1 | 2 | 27            <- promo variant, NOT the discount
  basePrice   was-price
  finalPrice  what you pay
  retailPrice
```

There is **no separate "CLEARANCE" display type**. Clearance and sale both come
through as `displayType: "WAS"` with `basePrice > finalPrice`, so the discount is
computed the same way we already do it everywhere else.

```
productDetails[itemId].itemInventory
  pickupQuantity     69      <- THE SHELF COUNT at that store
  totalAvailableQty  76
  productLocation    { aisle: "26", bay: "22" }
  analyticsData.pickup  { onhandQty, totalQty, availabilityStatus }
  analyticsData.parcel  { ... }     <- SHIPPING NETWORK. NOT shelf stock.
```

**Do not read `parcel` as stock.** On one item parcel said 58 while the shelf
held 69 — the exact trap that produced the "138 in stock" fabrication on Home
Depot. `pickupQuantity` / `analyticsData.pickup` is the store floor.

## What Lowe's gives us that HD and Target do not — WITH A CAVEAT

**AISLE AND BAY.** `productLocation: {aisle: "26", bay: "22"}` — the physical
spot in the building. Neither Home Depot nor Target publishes this, and it is
the difference between "somewhere in this store" and "aisle 26, bay 22".

**BUT IT DID NOT VARY BY STORE, AND NEITHER DID STOCK.** Measured: item
1000064061 against six stores in six states (San Antonio, Mooresville NC,
Willoughby OH, Castle Rock CO, Gun Barrel City TX, Big Flats NY) and five
ZIPs, including no ZIP at all:

| what | result |
|---|---|
| storeName / storeZip | CHANGED correctly per store |
| finalPrice | $499 at all six |
| pickupQuantity | 5 at all six |
| aisle | 14 at all six |

The store block proves the path parameter is read. The inventory block not
moving — identical aisle numbers in six states — is not plausible real
per-store data.

So the aisle/qty are returned but are NOT ESTABLISHED as store-specific.
Shipping them as "5 on the shelf at your store, aisle 14" would be exactly the
fabrication that produced the "138 in stock" appliance bug. Treat both as
unverified until a store cookie, a different endpoint, or a genuinely
store-varying item proves otherwise.

## Discovery is free too

Lowe's clearance browse — "The Back Aisle" — is a plain page:

```
GET https://www.lowes.com/pl/Clearance/4294857977?offset=0
```

Returned 200 with product ids parseable straight from the HTML. Six sampled
items, all real markdowns:

| was | now | off | clears our floor? |
|---|---|---|---|
| $719 | $499 | 31% | yes |
| $1149 | $799 | 30% | yes |
| $849 | $599 | 29% | yes |
| $799 | $599 | 25% | yes |
| $779 | $599 | 23% | no |
| $729 | $599 | 18% | no |

Four of six clear the $100+/25% tier. That is a real hit rate, not a trickle.

## Cost

| line | monthly |
|---|---|
| Lowe's product + inventory endpoint | $0 |
| Lowe's clearance browse (discovery) | $0 |
| **total added** | **$0** |

Fits the $50/mo cap with nothing spent — Apify's ~$37-40 is untouched.

## Module shape

Undecided, and deliberately so. Price did not vary across six stores, which
would point at the Target (chain-wide, cheap) shape — but the inventory did not
vary either, and that part is certainly wrong, so the flat price may be the
same artifact rather than a real finding. One negative result cannot be read as
two.

The decisive next test: find an item that IS genuinely cleared at one store and
full price at another (Lowe's equivalent of the $7.03 strip light) and see
whether this endpoint reflects it. Until then the module shape is unknown.

## Open questions

- Does a Lowe's markdown differ store to store? (decides sweep width)
- Is there a deeper in-store-only clearance that the site hides, as Home Depot
  does behind `alternatePriceDisplay`? Nothing equivalent was found in the
  payload, so INFERENCE: what you see is what there is.
- Store-number lookup by ZIP — not yet located; store 1155 came from the site's
  own default.

---

## Research fan-out vs measurement (2026-08-23, 5 agents, 196 tool calls)

The council's chairman verdict was **"build after one test, do not spend a
dollar"** — and caught its own researcher fabricating: the only quoted JSON
showing `displayType:"CLEARANCE"` was **a stitched composite of two different
items** ($78 item carrying a $9.98 was-price). It downgraded that claim itself.

Two of its load-bearing claims were testable. I tested both. **Neither
reproduced.**

**Claim 1 — "store is selected by the `sn` cookie, not the URL path."**
Set `sn` to 1155 / 0595 / 2274 / 0530 and refetched the same item:

| sn cookie | storeName | finalPrice | qty | aisle | bay |
|---|---|---|---|---|---|
| 1155 | N.W. Central San Antonio | 499 | 5 | 14 | 12 |
| 0595 | Mooresville | 499 | 5 | 14 | 12 |
| 2274 | Castle Rock | 499 | 5 | 14 | 12 |
| 0530 | Big Flats | 499 | 5 | 14 | 12 |

The cookie changes the store NAME and nothing else. Same as the path.

**Claim 2 — "clearance item set differs per store (442 vs 505 items), and
basePrice/discount differ per store (6% vs 12% on one item)."**
Fetched the clearance PLP for two stores and diffed by product id:

| measure | result |
|---|---|
| items on page 1 | 24 at both stores |
| shared items | 23 of 24 |
| items with a DIFFERENT quantity | **0** |
| items with a DIFFERENT price | **0** |

One item differed in the set, which is as likely to be ordering noise as a real
store difference.

## Standing conclusion

VERIFIED and reproducible:
- the endpoint and the clearance browse are public, free, and browser-only (403 server-side)
- markdowns are real and exposed (`WASNOW`, basePrice > finalPrice, 24 per page)
- per-ITEM stock is real and varies (`onhandQty` 0, 5, 2, 1 within one page)

NOT ESTABLISHED, after direct testing:
- that ANY of it varies by store — price, quantity and aisle were identical
  across every store tried, by both path and cookie

So Lowe's currently looks like the **Target shape** (chain-wide, one cheap
fetch), NOT the Home Depot shape. If that holds, a Lowe's module is cheap to
build — but it must NOT claim per-store stock or aisle, because the evidence
for those varying does not exist.


---

## RETRACTION — one of my own measurements was invalid

While building the parser I found that my two-store PLP comparison was
**worthless**, and I am correcting it rather than leaving it standing.

That test paired `/pd/` links with nearby price fields. But the `/pd/` hrefs in
the served HTML sit at offset ~5,300 and are NAVIGATION; the product data blob
does not start until ~417,000. The two never sit near each other, so every
price and quantity it "compared" was null. `diffQty: 0` and `diffPrice: 0` meant
"no data on either side", not "identical across stores".

**The chain-wide conclusion still stands**, but on the OTHER test only: the
per-item `/wpd/` endpoint returned identical price, qty and aisle at four stores
in four states, by URL path and by `sn` cookie, while storeName changed
correctly. That one used proper JSON paths and is sound. One valid measurement,
not two.

## Parser: the trap worth remembering

Anchoring on the product link yields **0 hits from 96 products** and reads as
"no deals today" rather than a bug. Anchor on `"finalPrice"` instead — it
appears exactly once per product. Re-anchored, the same five pages produced
**57 floor-clearing hits from 120 scanned, a 47% hit rate** (Target's is ~14%):

| was | now | off |
|---|---|---|
| $3,299 | $1,999 | 39% |
| $899 | $569 | 36% |
| $849 | $549 | 35% |
| $3,099 | $2,099 | 32% |

## Remaining gap before Lowe's can go live

**Product titles.** The clearance list carries no clean product name — only
marketing copy, model ids and division labels. The detail endpoint should have
it, but `product.description` came back empty for all 24 enriched items, so the
title path is still unfound.

Cards without product names are useless, so nothing was ingested and the rail
entry is held back rather than shipping a nav item that opens an empty feed.
Find the title field and Lowe's is ready.


---

## CORRECTION — the discovery category is wrong

I identified `/pl/Clearance/4294857977` as Lowe's clearance browse and called it
"The Back Aisle". **That was wrong.** The Back Aisle title came from a page I
navigated to separately, not from this endpoint.

Proof, from the served HTML's own title tag:

| url | title tag | categories in 20 links |
|---|---|---|
| `/pl/Clearance/4294857977` | **"Washing Machines for Front & Top Load Laundry"** | 20/20 washers |
| `/pl/Deals/1611079983848` | "Deals at Lowes.com" | mixed, but only ~10 links/page |

The word "Clearance" in that path is cosmetic — the NUMERIC id routes, and
4294857977 is washing machines. A full 20-page sweep returned 63 hits of which
**62 were washers**.

### What this does and does not invalidate

STILL VERIFIED, and re-checked against real pages:
- the endpoint is free, public and browser-only (403 server-side)
- the `finalPrice` anchor is correct — 336 items parsed cleanly, 0 errors
- the 10-digit `/pd/` id is the usable one (7-digit `itemNumber` 404s), proven
  by a 200 from the detail endpoint
- the slug gives clean titles with decimals repaired: "LG 5.0 cu ft Washer
  Dryer Combo, $3,299 → $1,999, 39% off"
- every markdown carries an expiry, so these are sales rather than clearance

INVALID:
- the claim that this list is site-wide clearance
- the "47% hit rate" as a general figure — it is 47% *within washing machines*,
  where everything is discounted at once

### The one remaining task

Find Lowe's real site-wide clearance category id. Everything downstream of it
already works and is tested. Nothing was ingested, because a Lowe's tab
containing nothing but washing machines is not the product.
