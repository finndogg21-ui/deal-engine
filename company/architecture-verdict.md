# Architecture verdict — instant per-ZIP stock under $50/mo

**Date:** 2026-08-22. **Method:** 5-advisor LLM council + anonymized peer review
(5 reviewers, unanimous) + a 6-agent research workflow with verified vendor
pricing. This file is the binding synthesis; the blueprints/build routines
should execute against it, not re-litigate it.

## Where the council agrees (high confidence)

- **Stop paying for stock counts.** Scraper counts are proven wrong at every
  magnitude ("2" and "1,006" both false at the shelf). Cached-wrong and
  fresh-wrong are worth the same: zero. No architecture launders a bad input.
- **The instant ZIP page is a database index, not a scraper bill.** The daily
  sweep already returns per-store rows; index store→ZIP at ingest and serve
  every ZIP from our own Postgres — instant, national, $0 marginal.
- **The product is leads + in-store confirmation** ("a reason to drive to a
  specific store"), because that is all ANY competitor sells. VERIFIED by direct
  observation: Hidden Clearances buys zero inventory data — community-submitted
  deals, ToS-disclaimed, nothing fresher than ~9 hours, despite "9,000
  stores/minute" marketing. The bar we chased was theater.
- **Show "N reported · last seen <time> · confirm in store", never a live
  guarantee.**

## Where the council clashed (and the resolution)

- The Expansionist wanted paid lazy hydration for its demand-heatmap and
  confirmation-loop upsides. All five reviewers rejected the spend (it buys
  fiction) but kept the assets: **log every ZIP entry (free demand map) and
  keep the Found-it/Not-there loop (free ground truth)**.

## Blind spots peer review caught (now requirements)

1. **Alert latency beats spatial precision.** Pennies clear in hours; a daily
   sweep is up to 24h stale. Budget should buy *prioritized re-sweeps of hot
   SKUs*, not per-ZIP stock calls.
2. **Deep-link to Home Depot's own product page** ("check live stock at your
   store") — offloads freshness to HD for $0.
3. **The sweep cannot see pennies at all** ($0.01 is register-only). Penny
   leads must come from (a) price-trajectory inference (stages.ts ladder) and
   (b) free crowd sources — PennyCentral's penny list is server-embedded JSON,
   robots-allowed, VERIFIED fetchable; Slickdeals RSS is free.
4. **Measure lead precision** (alerts confirmed at shelf ÷ alerts sent) — the
   one metric that decides survival; the `finds` table already captures it.
5. **Binary in-stock may still carry signal even though counts are wrong** —
   cheap side-by-side test vs the HD app settles it.

## The recommendation (binding)

**Serve-from-our-DB + free penny seeds + hedged $0 probe. Do NOT build paid
per-ZIP hydration.**

- **Discovery (~$10/mo):** cut sweep to 500 results every other day with
  ROTATING category slices (rotation, not truncation — the actor crawls
  category-by-category).
- **Penny leads ($0):** daily PennyCentral ingest + Slickdeals RSS 1-2x/day.
- **Instant ZIP page ($0):** store→ZIP index over sweep data; last-seen
  framing; HD deep link per deal.
- **Stock probe ($0):** maplerope44/home-depot-product-lookup — VERIFIED
  $5.00/1,000 lookups, free tier 20/day. Run 20/day vs the HD app for a week in
  78232. If accurate → it becomes a rate-limited paid-tier "refresh this store"
  button later. Upside, never dependency.
- **Cost:** ~$10-15/mo now (vs $40 today); headroom stays under the $50 cap.
  At scale, marginal data cost ~$0.40-2/user — covered by any paid tier.

## The one thing to do first

**Cut the sweep to alternate-day/500/rotating TODAY** (drops cost ~75%, frees
budget for everything else, zero risk), then start the free maplerope44
accuracy pilot the same day.
