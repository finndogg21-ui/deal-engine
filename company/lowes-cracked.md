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
