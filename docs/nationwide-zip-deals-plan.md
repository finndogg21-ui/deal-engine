# Nationwide ZIP → nearby in-store deals

**Goal.** A user enters ANY US ZIP and instantly sees nearby in-store clearance
deals, served from our own database — not a live scrape. This is the feature
that makes coverage a non-problem for the *browse* experience, the same way
"Find Stock" made it a non-problem for per-product stock. It matches the
competitor Hidden Clearances' `/leads/nearby` feed (fast, ~150ms, DB-served),
minus the parts that are a live Akamai-defeating fetch.

This document is the plan. The scaffolding it describes has been written as
FILES ONLY — no migration has been applied and no DB has been opened. A human
applies the migration and seeds data.

---

## 1. What already exists (and what we reuse)

| Piece | Today | Reused how |
|---|---|---|
| `price_observations` | Append-only log; THE compounding asset. | Stays the single append-only log. Lead/stock rows land here tagged `source='leads:<vendor>'`. |
| `sku_state` | Projection of the scorer, keyed `(product_id, store_id)`, dropped-and-rebuilt from observations. | The *pattern* (log → projection) is copied. `store_inventory` is the new projection. |
| `stores` | `(store_id, retailer, store_number, name, address, city, state, zip, lat, lng)`. Only ~5 San Antonio rows populated. | Becomes the nationwide store directory. Distance queries run over `lat/lng`. |
| `stock_lookups` | On-demand per-product stock, doubles as spend ledger. | Where a *vendor error* is recorded — deliberately NOT in the projection. |
| `coverage.ts` | ZIP-prefix metro check + `normalizeStoreNumber`. | Same prefix idea reused for ZIP-anchor fallback. |
| Inline haversine | Copied in `server.ts` and `finds.ts`. | Promoted to `src/geo/nearby.ts` (`haversineMi`). |

The architecture is intentionally **not** a second append-only log. This
codebase's stated philosophy is one compounding log (`price_observations`) plus
rebuildable projections. We honor that: leads are observations; `store_inventory`
is a projection.

---

## 2. Data model

### 2a. `stores` — nationwide directory (migration, additive)

Idempotent `ADD COLUMN IF NOT EXISTS` for `city, state, address, lat, lng`
(no-ops on a fresh DB; belt-and-suspenders for older DBs), plus:

- `source TEXT` — how the row was learned: `seed | scan | teaser | directory`.
  A national directory is assembled from several sources; a low-trust row (a
  competitor teaser lookup) must be re-verifiable.
- Indexes: `idx_stores_latlng (lat,lng)` for bounding-box prefilter,
  `idx_stores_state`, `idx_stores_zip` for anchor resolution.

### 2b. `store_inventory` — the in-store projection (migration, new table)

Keyed **`(retailer, sku, store_id)`** — the same grain as `sku_state`'s
`(product_id, store_id)` decomposed, because a lead arrives as retailer + SKU
(Home Depot Internet #) and must be able to land **before** a catalog `products`
row exists. Hence **no FK to `products`**; display fields join at read time on
`(retailer, sku)`. `store_id` **does** reference `stores` — a row with no
coordinates can't appear in a nearby feed.

**Three clocks** (never collapse them):

- `last_seen_at` — last observed **present** (units on the shelf).
- `last_checked_at` — last time we **looked**, hit OR miss. "Checked 2h ago,
  still nothing" is a real answer.
- `last_changed_at` — last time a stored **value** changed. Powers "price held
  9 days" without walking history.

Plus `quantity`, `in_stock`, `price_cents`, `orig_price_cents`, `discount_pct`
(stored so the 25% floor filters in SQL and "was/now" renders without a second
code path), `aisle`, `bay`, `aisle_source` (`community | vendor | retailer`),
`miss_streak`, `source`, `first_seen_at`, and a `state` enum.

**Two rules burned into the table:**

1. **A vendor error is NOT an observation.** A 500/429/timeout updates nothing —
   never nulls a quantity, never advances a clock, never bumps `miss_streak`. It
   is logged in `stock_lookups` as a failed *check*. Only a real "looked and it
   was gone" is a miss. Conflating the two silently deletes good inventory.
2. **Only an archiver ever deletes.** Normal ingest and decay NEVER `DELETE`.
   Dried-up stock is **tombstoned** (`state='archived'`), never removed, so
   history and pending finds survive. One dedicated archiver job is the only
   writer permitted to hard-delete, and only archived tombstones past retention.
   Tombstone, never delete.

`state`: `live | aging | stale | presumed_gone | archived`. Only `live` and
`aging` are feed-visible.

---

## 3. Ingest flow (log → projection)

```
lead/stock source (pluggable)                 [SOURCE = OPEN QUESTION, §7]
        │  retailer, sku, store, price, discount, aisle, present?/gone?
        ▼
  normalize to DealEvent (src/vendors/contracts.ts) ── already the vendor-neutral shape
        │
        ├─ upsert products(retailer, sku)      (optional; lets a card render title/image)
        ├─ upsert stores(store_id, …, source)  (learns the store + coordinates)
        └─ append price_observations(source='leads:<vendor>')   ← the log, append-only
        ▼
  projection maintainer  (a "rebuild-ish" pass, but incremental — see §4)
        ▼
  store_inventory  ← the fast read model the API serves
```

A **present** report → upsert row `state='live'`, set all three clocks,
`miss_streak=0`. A **miss** (looked, genuinely gone) → bump `miss_streak`,
advance `last_checked_at` only, transition per §4. A **vendor error** → nothing
here; `stock_lookups` row only.

---

## 4. Decay / archiver (the projection maintainer)

Unlike `sku_state`, this projection is **not** a pure drop-and-rebuild, because
the source is event-driven and sparse (community reports, per-store checks), so
there is no dense history to re-derive decay from. Decay is carried as explicit
state and advanced by a scheduled pass:

| From | To | Trigger (tunable via env) |
|---|---|---|
| `live` | `aging` | no re-confirmation in ~7 days |
| `aging` | `stale` | no re-confirmation in ~14 days |
| any | `presumed_gone` | `miss_streak >= 2` real misses |
| `stale`/`presumed_gone` | `archived` | grace window elapsed (tombstone) |
| `archived` | *(deleted)* | ONLY the archiver, only past retention |

Thresholds are policy, not schema — they live in the maintainer, so tuning them
never touches the table. This mirrors the competitor's guide: "stale posts are
archived once stock dries up."

---

## 5. ZIP → nearby stores resolver (`src/geo/nearby.ts`)

- `haversineMi(aLat,aLng,bLat,bLng)` — the shared great-circle helper.
- `resolveZipAnchor(db, zip)` — turns a ZIP into a coordinate. **See §7: we have
  no ZIP-centroid source, so we refuse to invent one.** Today it anchors on a
  store we already trust — exact-ZIP match first, then 3-digit prefix — and
  returns `null` when we know nothing near the ZIP. `null` means "can't place
  this ZIP yet", never "no deals".
- `nearbyStores(db, {zip, radiusMi, retailer?})` — bounding-box prefilter in SQL
  (served by `idx_stores_latlng`), exact haversine in JS, nearest first. Same
  two-step split the rest of the API uses.

The resolver never calls any external service — it must stay DB-fast.

---

## 6. API endpoint (`src/api/routes/nearby-deals.ts`)

`GET /api/deals/nearby?zip=&retailer=&min_discount=&radius=&limit=`

Wired into `server.ts` as `app.use('/api', nearbyDeals)`; gated `paid`
(`requireAuth` + `requirePlan('consumer','reseller')`) because deal data is the
paywall — same as `/api/candidates`. Rate-limited 60/min.

Reads `store_inventory` joined to nearby stores (`store_id = ANY(...)`),
LEFT JOIN `products` on `(retailer, sku)` for title/image.

**Product rules enforced server-side:**

- **25% discount floor**, clamped so a smaller `?min_discount` can't lower it.
- **Cards are "Possible Deals"** — hedged framing; only `state IN ('live','aging')`
  rows are returned.
- **Never expose a raw store number or a shelf count on a card.** The mapper
  returns store *name / city / state / distance* and a coarse `availability`
  state — never `store_number`, never `quantity`.
- **The penny page stays literal** and is a different endpoint
  (`/api/candidates?penny=1`). This feed is the broad "possible deals near you".
- Unresolvable ZIP → `200 { located:false, deals:[], message }`, an honest data
  gap, never a `500` and never invented distances.

Response also carries `anchor_precision` (`store_zip_exact | store_zip_prefix`)
so the client can caveat distances when the anchor is only a prefix match.

---

## 7. Open questions

### 7a. ZIP-centroid reference data — **blocking for true national reach**

There is **no US ZIP → lat/lng source** in the repo or `node_modules`. Distance
*from a ZIP* needs that ZIP's centroid. We refuse to invent coordinates (a
made-up point produces confidently wrong distances — the wasted-drive failure).

- **Today's stub:** anchor on a store we already know in that ZIP / prefix.
  Correct where we have stores, `null` (honest) elsewhere. This means the feed
  only truly works where the store directory is populated.
- **Proper fix (pick one):**
  1. Ship a static ZIP-centroid table — US Census ZCTA Gazetteer, ~33k rows,
     public domain — loaded into a `zip_centroids(zip, lat, lng)` table. Zero
     runtime dependency, exact for every ZIP. **Recommended.** Drop-in: only the
     body of `resolveZipAnchor` changes.
  2. A small `zipcodes`-style npm dependency, if its license is acceptable.
- **Related lever:** the competitor's `GET /landing/teaser?zip_code=` is public,
  no-auth, and resolves ANY ZIP to real nearby HD/Lowe's stores. It could **seed
  the `stores` directory** (and thus anchors) cheaply. But do NOT call it at
  request time — the feed must be DB-served. Treat it as an ingest/seed source,
  and note it's a competitor endpoint (ToS + fragility risk).

### 7b. Lead SOURCE — **pluggable, decided by the parallel research lane**

The whole point of `source` columns and the `DealEvent` normalization is that
nothing here couples to a vendor. A parallel lane is choosing the cheapest
source. Candidates already in play:

- Apify `scrapyspider/home-depot-clearance-scraper` (~$0.002/result) — HD only.
- Unwrangle (HD + Lowe's, `inventory_quantity`, 10 credits/req).
- The competitor's own public `/leads/browse` (hard-capped 50 rows, no auth) —
  useful as a **canary/validation** set, not a primary feed at scale.

**Central hypothesis to confirm/refute** (from the groundwork): the competitor's
`totalDealsCount = 500` for both Fairbanks (3 stores) and San Antonio (85
stores) suggests their count is a **global pool, not location-filtered**. If
true, their "nearby" number is partly theatre, and our genuinely
location-filtered feed is a real differentiator — but it also means their public
counts can't be used to size our per-metro ingest. Confirm before promising
"N deals near you" as a location-true number.

**Both HD and Lowe's sit behind Akamai and reject Node fetch on TLS
fingerprint.** DIY scraping is dead; a paid unlocker is required for anything
live. The whole reason this feed is DB-served is to keep live fetches off the
read path.

### 7c. Smaller open items

- **Retailer slug canonicalization.** `store_inventory.retailer`,
  `products.retailer`, `stores.retailer` must all use the same slug (`homedepot`
  vs `home_depot`). Normalize at ingest; the filter is an exact match.
- **Decay thresholds** (§4) are guesses until we have real lead cadence data.
- **Public teaser variant** of the endpoint (capped rows, no auth) to mirror the
  competitor's funnel — deferred; separate capped handler if we want it.

---

## 8. Phased rollout

1. **Texas metros first.** Seed `stores` for San Antonio → Austin → Houston →
   DFW (we already have SA fixtures + coordinates). Turn on lead ingest for
   those, let history accrue (coverage.ts already gates "scores meaningful"
   behind ~14 days). Validate the feed against the competitor's `/leads/browse`
   canary.
2. **Ship the ZIP-centroid table (7a.1)** so anchoring is exact, not
   store-dependent — this is the gate to reaching beyond seeded metros.
3. **National, directory-first.** Seed the nationwide `stores` directory (teaser
   source and/or a store-locator import), then widen lead ingest. Distance and
   anchoring already work the moment stores + centroids exist; no code change.

---

## 9. Files in this change

| File | Purpose |
|---|---|
| `src/db/schema.sql` (appended) | Idempotent migration: `stores` directory columns + indexes; `store_inventory` projection with three clocks, `miss_streak`, `state` machine, and the two rules in SQL comments. |
| `src/geo/nearby.ts` (new) | `haversineMi`, `resolveZipAnchor` (store-based stub, no invented coords), `nearbyStores` bounding-box + haversine. |
| `src/api/routes/nearby-deals.ts` (new) | `GET /api/deals/nearby` — projection joined to nearby stores, 25% floor, "Possible Deals" rules, honest unresolvable-ZIP response. |
| `src/api/server.ts` (edited) | Import + mount `nearbyDeals`. |
| `docs/nationwide-zip-deals-plan.md` (new) | This plan. |

Reversibility: the migration is additive only (`ADD COLUMN IF NOT EXISTS`,
`CREATE TABLE/INDEX IF NOT EXISTS`). Rollback is `DROP TABLE store_inventory`
plus dropping the added `stores` columns/indexes; no existing column or row is
altered or removed.
