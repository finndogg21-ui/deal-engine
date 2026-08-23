# The Target deal page — design

Council: First Principles, Contrarian, Expansionist. Chairman synthesis, with
two council claims overturned by direct measurement (below).

## Verified facts this design rests on

Measured 2026-08-23 in-browser, TCIN 95127459, five San Antonio stores.

| Store | id | Price | Reg | Type | Qty | Status |
|---|---|---|---|---|---|---|
| Bitters | 176 | 4.00 | 5.00 | clearance | 3 | LIMITED_STOCK |
| SA North | 1354 | 4.00 | 5.00 | clearance | 2 | LIMITED_STOCK |
| Stone Oak | 2239 | 4.00 | 5.00 | clearance | 3 | LIMITED_STOCK |
| Park North | 2467 | 4.00 | 5.00 | clearance | 0 | OUT_OF_STOCK |
| Alamo Hts | 2803 | 4.00 | 5.00 | clearance | 0 | OUT_OF_STOCK |

1. **RedSky needs `credentials:'include'`.** A plain cross-origin `fetch()`
   returns 403; the identical call with cookies returns 200. There is NO bot
   block and NO rate limit at ~1.8s spacing. An earlier read of "durable bot
   gate" was wrong — it was a missing credentials flag.
2. **Price did NOT vary by store.** All five read $4.00/$5.00. The council's
   proposed per-store price-comparison column has no data behind it. CUT.
3. **Quantity DID vary: 3 / 2 / 3 / 0 / 0.** This is the real per-store signal.
4. **`location_name` is null** in the fulfillment payload. Store names must
   come from our own store table. Never print a raw store number (product rule).
5. Price fields arrive as `current_retail_min` / `reg_retail_max` on this item,
   not `current_retail` / `reg_retail`. The parser must accept both.
6. This item is 20% off — **under our tiered floor** (<$50 needs 40%). It would
   correctly NOT publish. The floor applies to Target unchanged.

## Overturned council claim: the ledger is not Target's alone

First Principles argued the multi-store ledger is something "HD structurally
cannot render." That is backwards. `src/vendors/hd-direct.ts:55` already
requests `locations { locationId storeName inventory { quantity } }` — plural,
ZIP-scoped, **one call** — and line 123 `continue`s past every store except the
anchor, discarding the rest. Target needs one call PER store.

So the ledger is CHEAPER on Home Depot than on Target, and we are throwing the
data away today. Build the ledger as a **retailer-agnostic component**, feed it
from HD first (free, one call, already in the query), and let Target populate
the same component via N calls.

(Unverified: whether HD's response actually returns >1 store for a ZIP. The
field is plural and takes a zipCode, but I have not observed a multi-store
response. Confirm before promising it in the UI.)

## The design

**One feed. No third spool.** Retailer is a scope control ABOVE the two spools
(Find / Penny), never a peer of them. "Penny" is a Home Depot artifact that does
not generalize; a Target spool would orphan it. Merging by % off is also wrong —
it ranks a $3 tee over a $400 vanity.

**No red. Ever.** THE TAPE stays black and white. Retailer identity is
typographic: `[HD]` / `[TGT]` in mono. The first color exception licenses the
second, and red is held in reserve for urgency.

**The card gets a ledger.** Print the zeros — absence is what makes 3 mean
something.

```
STORE                    UNITS
BITTERS RD ............... 3
STONE OAK ................ 3
SAN ANTONIO N ............ 2
PARK NORTH ............... 0
ALAMO HEIGHTS ............ 0
--------------------------------
TOTAL NEARBY             8 UNITS
```

Out-of-stock lines print struck through, in `--ink-faint`. The total rules off
after a tear line. It reads as a receipt because it IS a line-item list.

**The unlock is a route, not a listing.** Exact counts across stores turn "is it
still there" into "how many can I take, and in what order." Sort by units
descending; that ordering is the drive order.

**Velocity, once we have two samples.** Same numbers polled twice give
sell-through: `3 -> 1` is decay, `0 -> 8` is a restock. Do NOT ship a velocity
claim until two real observations exist for that SKU/store. Never compute it
from one.

## Honesty rules (inherited, non-negotiable)

- Never print an invented price. If Target says clearance without a number, the
  card says so and does not guess.
- Never print a raw store number or promise live stock. Counts are stamped with
  when they were read.
- Provenance is per retailer: "HD-verified" does not stretch to Target. Stamp
  freshness per retailer or the trust word rots.
- One saved ZIP now resolves to two different store sets. "Your store" must name
  the retailer, or it silently means two things.

## Known blocker

`web/src/pages/AllDeals.tsx:378` hardcodes `retailer: 'homedepot'` when mapping
the published pool, though the row carries a real `retailer`. Every Target deal
would render as Home Depot. Fix before any Target row publishes.
