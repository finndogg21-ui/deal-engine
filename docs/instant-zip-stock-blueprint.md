# Instant per-ZIP stock — blueprint

**Status:** design, build-ready. No code written, no migration applied. Author: Finnley + Claude, 2026-08-28.

**One-line goal.** A member enters their ZIP once; on every page load they see per-store stock **as of the last scan, instantly** (no blocking fetch). A brand-new ZIP is warmed **instantly on first entry**. We scan a ZIP-*area* once and serve everyone in it from cache.

---

## 0. Relationship to `nationwide-zip-deals-plan.md` — READ THAT FIRST

This EXTENDS the existing plan; it does not replace it. That plan already built the DB-served read path:

- `store_inventory` projection keyed **`(retailer, sku, store_id)`** with three clocks + a `live→aging→stale→presumed_gone→archived` decay machine — **exists** (`src/db/schema.sql:477`).
- `GET /api/deals/nearby?zip=` — resolves ZIP → nearest stores → serves the projection with a local stock overlay, **no live fetch on the read path** — **exists** (`src/api/routes/nearby-deals.ts`).
- ZIP → lat/lng: that plan's **blocking** open question 7a ("no ZIP-centroid source") is now **RESOLVED** — `zip_centroids` (~33k US ZIPs) is loaded (`src/db/schema.sql:554`, seeded by `migrate.ts`).

That plan's remaining open question **7b — "the lead SOURCE"** — is what this blueprint answers, plus the piece it never covered: **how the DB gets warm for a ZIP nobody has scanned yet, fast enough to feel instant.**

---

## 1. The core insight that makes the economics work

**The cache is keyed by STORE, not by ZIP.** A store's stock is identical no matter who asks, so `store_inventory(retailer, sku, store_id)` is already the right shape:

- 5 users in 78232 → same nearest stores → **same cache rows → one scan, shared.** Dedup is automatic and free.
- Nearby ZIPs share stores, so **distinct scan targets ≪ distinct ZIPs.**
- Only rows staler than a TTL get re-scanned.

So you pay per **(deal, store) per refresh** — never per user, and not really per ZIP. Finnley's "$0.77 covers all 5 people in 78232" instinct is exactly this, and it's correct.

**The one honest correction (burned into the cost model): stock is perishable.** $0.77 is the cost of *one* scan of an area, not a one-time cost. Real spend = `$/scan × active store-regions × refreshes per period`. The whole design below exists to keep every multiplier small.

---

## 2. Warm-on-new-ZIP — the new piece (instant)

```
new ZIP entered (member signup or ZipBar change)
  → resolveZipAnchor(zip)  [zip_centroids]  → nearbyStores()  → N nearest stores
  → check store_inventory freshness for the HD/Target deals at those stores
  → COLD or STALE?  → real-time warm call per (deal, zip)
        HD returns ALL nearby stores' stock in ONE call  (see §4 — we currently throw that away)
  → upsert store_inventory (state='live', three clocks set)
  → serve from cache — now warm, instant
returning user / any later user in that ZIP-area → cache hit, zero calls
```

- **Instant source = a real-time API (BigBox / Traject Data)** — it taps **Home Depot's own product/store API**, i.e. the *same source and accuracy as the `/loop` browser verify*, NOT the HTML-scraper counts Finnley already proved unreliable ("2" and "1,006" both wrong vs the shelf). Reliability is preserved.
- **Bounded:** only **Home Depot (+ Target in-store clearance)** need a per-store call. Best Buy / Lowe's / Walmart are chain-wide — same stock everywhere → **$0 per-ZIP cost**, shown as a chain-wide line, never "N at your store."

---

## 3. Refresh — keeping it warm, cheapest source first

The decay states from the nationwide plan already say *what* needs refreshing (anything past its TTL for an **active** store-region). Source, cheapest-first:

1. **Free — the browser `/loop`.** Fix §4 and one HD `fulfillment(zipCode)` call warms a whole ZIP-area's stores at once, for free, on the machine that already runs `/loop`. Sufficient at small scale.
2. **Cheap background — Apify** `maplerope44/home-depot-product-lookup`, **~$0.0035/lookup** (verified: $3.50/1,000). Has run latency → fine for background refresh, NOT for the instant path.
3. **Paid real-time — BigBox** for freshness at scale where the browser can't keep up.

Refresh only **active** store-regions (someone loaded the app there recently). A signup in a dead ZIP costs one warm, then nothing until they return.

---

## 4. Required upstream fix (do this first — free, high-value)

`src/vendors/hd-direct.ts:145-152` asks HD for `fulfillment(zipCode){ locations{ storeName inventory{quantity} } }` — **plural locations, one call** — then **keeps only the anchor store and discards the rest** (`StoreLedger.tsx:11-14` flags this too). Fixing it so we persist **all** returned locations into `store_inventory` means **one call warms every nearby store of a ZIP-area** — the single biggest cost lever, and it makes the existing free `/loop` populate `/api/deals/nearby` for real. **Phase 0.**

---

## 5. Cost model + the cadence knob

```
monthly cost ≈ (active store-regions) × (HD + Target-in-store deals) × ($/lookup) × (refreshes/month)
```

Illustrative, at ~241 HD deals and the verified ~$0.0035/lookup (BigBox real-time tier is pricier per call — **VERIFY before Phase 1**, see §6):

| Scenario | Per-area warm | Cadence | Monthly (1000 users) |
|---|---|---|---|
| One snapshot, 1000 unique areas | ~$0.85 | once | ~$850 |
| Daily refresh, 1000 unique areas | ~$0.85 | 30× | ~$25,500 ❌ over $20k revenue |
| **Weekly refresh** | ~$0.85 | ~4× | **~$3,400 ✅** |
| **Lazy (active areas only) + store-region dedup** | ~$0.85 | active-only | **far less ✅ (users cluster → areas ≪ 1000)** |
| Chain-wide retailers (BB/Lowe's/Walmart) | $0 | — | $0 |

The four levers that keep it profitable: **(a) store-region dedup**, **(b) HD+Target only**, **(c) lazy — active regions only**, **(d) cadence dial**. Membership at $20/user comfortably covers a weekly/lazy cadence; matching Hidden Clearances' all-stores-always model is the expensive part and we deliberately don't.

---

## 6. Decisions to lock before building

1. **Instant source — VERIFY.** Confirm BigBox's real-time tier: (a) that it returns HD's **fulfillment quantity** field (the one the verify trusts), and (b) the **volume per-call price** ($15/500-credit entry tier is too pricey per call; need the discounted tier). If it doesn't pencil out, Phase 1 can ship "free browser warm + honest 'updating for your area' state" and add paid-instant later.
2. **Identity / membership.** The $20 plan implies **real accounts + billing**. The auth system exists but is dormant behind `PUBLIC_PREVIEW` (everyone = operator user, ZIP in localStorage). Decision: gate members with real accounts (ZIP per account, works cross-device), keep anonymous localStorage ZIP for the free/preview tier. *Recommend: yes, real accounts for members.*
3. **Refresh cadence default.** Start weekly or `/loop`-tied; expose as an env knob (mirrors the nationwide plan's "thresholds are policy, not schema").

---

## 7. Honesty guardrails (inherited, non-negotiable)

- A **null** count renders "checking your store — updates on the next refresh," **never** a fabricated number.
- A **vendor error is not an observation** (nationwide plan §3): a 500/429/timeout never nulls stock, never advances a clock. Logged in `stock_lookups` only.
- **Chain-wide retailers never claim per-store.** Best Buy/Lowe's/Walmart show a chain-wide line.
- Every count is stamped **"as of last scan"**; the price (national) is always instant, only the local count can lag.

---

## 8. Files touched (delta on the nationwide plan)

| File | Change |
|---|---|
| `src/vendors/hd-direct.ts` | **Phase 0.** Keep ALL `fulfillment` locations, not just the anchor → one call warms a whole ZIP-area. |
| `src/vendors/bigbox.ts` (new) | Real-time HD stock adapter behind the existing `DealEvent`/`contracts.ts` shape. |
| `src/stock/warm.ts` (new) | Warm-on-cold service: resolve ZIP → freshness check → real-time call → upsert `store_inventory`. |
| `src/api/routes/nearby-deals.ts` | On a cold/new ZIP, trigger the warm (inline for instant, or enqueue for background); otherwise serve cache unchanged. |
| `src/db/schema.sql` | Add per-store-region `last_scanned_at` / active-region tracking if not derivable from `store_inventory` clocks (additive). |
| `web/src/components/ZipBar.tsx`, `AllDeals.tsx`, `StoreLedger.tsx` | Show the "updating for your area" state while a region is cold; otherwise the existing `near_stock` overlay already renders instantly. |
| `company/routines/` | A refresh routine that re-warms **active** store-regions on the cadence. |

Reversibility: additive migration only; the read path already exists and is unchanged when a region is warm.

---

## 9. Phased build

- **Phase 0 — free, do first.** Fix HD multi-store harvest (§4) so the existing `/loop` + `/api/deals/nearby` actually populate per-store stock for scanned ZIPs. No new cost, immediate value.
- **Phase 1 — instant new-ZIP.** BigBox real-time warm on cold ZIP (bounded to HD/Target, store-region-deduped). Ship behind the §6.1 verification.
- **Phase 2 — membership.** Real accounts + billing; active-region refresh worker; cadence knob.
- **Phase 3 — scale.** Paid refresh for large active-region counts; monitor cost against the cadence dial.
