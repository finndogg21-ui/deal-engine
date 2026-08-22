# Penny-method blueprints — data-engine backlog

Maintained by the BLUEPRINTS sector. Scope: the DATA-METHOD and scan/score/
verify engine specifically (not marketing/UI copy — see `company/blueprints.md`
for that track). Built from `company/penny-recon.md` (2026-08-22 recon) plus a
direct read of the current code, so this does not re-propose anything already
shipped or already in an open PR.

**Last pass:** 2026-08-22

**Product vision this backlog serves:** Home Depot penny deals = the free hook
for the RESELLING tier; the PAID tier later adds Lowe's + Costco.

---

## KEY STRATEGIC DECISION — which data method to run with

**Recommendation: keep the two-layer hybrid already coded in this repo — a
broad Apify clearance/listing sweep for candidate discovery, plus a
store-level confirm call for per-store stock — and do NOT switch to a
direct-scrape build, a pure store-API-only design, or a penny-SKU
crowdsourced corpus as the core method.**

This is not a new architectural call. `src/vendors/README.md`, `apify.ts`,
`unwrangle.ts`, `src/engine/stages.ts`, and `src/engine/score.ts` already
implement exactly this shape — sweep generates a candidate (deep discount →
delisted online while a prior scan showed stock, i.e. `stockDivergence` in
`stages.ts`), a store-level call confirms it, the score never claims
certainty. **Per the recon (Part C), this is also independently where every
competitor researched converges, including the ones that market themselves as
something more.** The gap is not "which method" — it's that the confirm
layer isn't proven reliable yet (see below), and nothing is actually running
with a real key.

**Why the alternatives lose, honestly:**

- **Direct GraphQL scrape, built and run ourselves** — rejected. Recon Part
  B.1/B.3: every vendor in this space (Apify actors, SerpApi, BigBox,
  Unwrangle) is reverse-engineering the *same* Home Depot GraphQL surface
  behind Akamai. Building our own buys the identical data at the cost of
  owning Akamai bot-mitigation engineering and eating the ToS exposure
  directly instead of behind a vendor's terms. No upside identified.
- **Store-specific price/stock API alone, skipping the broad sweep** —
  rejected. You cannot query per-store stock for a SKU you don't yet know is
  a penny candidate. The sweep is the *discovery* layer; a store-level call
  is a *confirm* step, never a substitute for one. This is a structural
  reason, not a preference.
- **Penny-SKU corpus / crowdsourced list (PennyCentral, Slickdeals-thread
  style)** — rejected as the *core* method. Recon Part A.5/A.9 and Part C.5
  are explicit: 100% human-typed reporting is exactly the "stale/community
  leads" category this product is built to beat, and `src/engine/
  reputation.ts` already treats member reports as a *validation/scoring
  input* (corroboration weighting), correctly demoted below the machine
  sweep — not promoted to replace it.

**Honest tradeoffs, costs, and risks — carried forward, not softened:**

1. **Cost scales with store count, not flat.** `.env.example` records one
   vendor-reported figure: "17 monthly users, 98.7% success, $0.85/1k
   results" for the current Apify actor — **[claim, vendor-reported, not yet
   independently measured by us across a real multi-day run]**. At today's
   scope (`SCAN_ZIPS=78232,78216,78248,78258`, ~5 San Antonio stores), this
   tracks the recon's own estimate (Part B.2: ~$2.50–$22.50/day for 5–15
   stores) — cheap. It will **not** stay cheap if store count grows for a
   future metro; that's a linear cost line, not a fixed one, and nobody has
   run the actual week-one credit spend to confirm the $0.85/1k figure
   first-hand (see Blueprint 2).
2. **Akamai/bot-mitigation risk is real and already materialized once**, not
   theoretical: on 2026-08-16, the `pulsewatch/dealwatch-scraper` actor
   returned fully fabricated rows (`SAMPLE-SCREWDRIVER`, identical prices
   across the batch) while reporting a successful run. `run-scan.ts`'s
   `looksFabricated()` guard exists *because of that exact incident* — a
   good defense, but proof the vendor layer is not a solved problem, just a
   monitored one.
3. **The store-confirmation layer is NOT proven reliable yet — this is the
   sharpest concrete risk this pass surfaced.** `src/vendors/
   probe-unwrangle.ts`'s own header documents three earlier attempts through
   Unwrangle's store-scoped parameters returning a fulfillment node in a
   *different city each time* (Atlanta, Buffalo, Nashville — proxy rotation
   being geolocated, not a real store answer), and a fourth explicit attempt
   with `store_no=582&zipcode=78232` against a known-good item still came
   back `"Product not found."` **No result of running this probe with a real
   key is recorded anywhere in the repo.** Meanwhile `src/vendors/
   store-lookup.ts` (actor `maplerope44/home-depot-product-lookup`) is
   *already wired* into the live "Find Stock" button (`stock-find.ts`) as a
   second, different store-confirmation path — and it's also unproven at
   scale. Two unconfirmed confirm-layer candidates exist in the same repo;
   nobody has run the comparison. This is a data question the recon did not
   have repo access to see, and it changes the recon's own Open Question 4
   from "which fields does the vendor expose" to "does either wired vendor's
   store call actually work at all" — see Blueprint 1, the top item below.
4. **Legal exposure is real, applies identically to every vendor in this
   space, and is not written down as a decision anywhere in this repo.**
   Home Depot's ToS prohibits automated collection (recon Part B.1); routing
   it through Apify/Unwrangle changes who runs the request, not whether the
   activity is against ToS. See Blueprint 5.
5. **The $0.01-cannot-be-read-from-a-public-API limit is fully respected
   already** — this is the one point where the codebase is ahead of the
   recon's own caution. `score.ts`, `stages.ts`, and every public-facing page
   checked this pass (`About.tsx`, `Faq.tsx`, `HowItWorks.tsx`, `Terms.tsx`,
   `Privacy.tsx`, `Pricing.tsx`) already use "prediction," never "confirmed
   live price." **This plan is lead-and-verify by construction, not by
   promise** — nothing below proposes changing that.

**Confidence:** the *shape* of the recommendation (sweep + confirm, not a
corpus, not a self-built scraper) is well-supported by both the recon and an
independent read of the code arriving at the same design. The *store-confirm
vendor choice* (Unwrangle vs. the Apify stock-lookup actor) is explicitly
**not yet settled by real evidence** — flagged honestly as the single most
important open question, and cheaply testable (Blueprint 1) rather than
guessable.

---

## Already shipped in this domain — not re-proposed

- Two-vendor sweep+confirm architecture (`src/vendors/`, `README.md`),
  matching the recon's own convergent recommendation.
- Multi-signal, replayable scoring model (`score.ts`): markdown-ladder
  progress, online/in-store divergence, price-ending code, dwell time,
  scarcity — versioned (`SCORE_VERSION`) so weight changes can be replayed
  over history instead of tuned by feel.
- Markdown-stage/ladder detection and `penny_candidate` inference from
  divergence (`stages.ts`).
- Fabrication guard (`looksFabricated()` in `run-scan.ts`), born from a real
  incident, not a hypothetical.
- Append-only `price_observations` with a `scan_runs` row on every run,
  including crashed ones, so a silent stop is always detectable.
- Store-level verification pass against Unwrangle that overwrites hallucinated
  discounts with real numbers (`verify-deals.ts`), run in parallel waves.
- Spotter reputation / corroboration system (`reputation.ts`) — the
  crowdsourced-validation layer recon Part C.5 recommends, correctly scoped
  as a *check on* the machine scan, not a replacement for it.
- Metro-scoped coverage gating with an honest "not enough history yet"
  message (`coverage.ts`), and a documented 14-day `MEANINGFUL_DAYS` floor.
- "Prediction, not a promise" language shipped consistently across every
  public page checked (`About.tsx`, `Faq.tsx`, `HowItWorks.tsx`,
  `Terms.tsx`, `Privacy.tsx`).
- **PR #2** (open, draft): public freshness bar reading real `scan_runs` data
  — code-complete, correctly gated on having real scan history behind it
  before merge (see Blueprint 3).
- **PR #1** (open, draft): contact form wiring — unrelated to the data
  method, not part of this backlog.
- On-demand async stock-lookup worker pattern (`store-lookup-async.ts`) for
  queued per-item checks without blocking a request thread.

---

## Ranked backlog

### 1. Resolve the store-confirmation layer with real numbers before trusting either vendor
**status:** todo — top priority this pass
**problem:** the entire lead→verified pipeline depends on a store-level
confirm call, and neither wired candidate for that call has a recorded,
successful real-key result. `probe-unwrangle.ts`'s own header documents
repeated failures (wrong-city fulfillment nodes, "Product not found" on a
known-good item). `store-lookup.ts` (a different Apify actor,
`maplerope44/home-depot-product-lookup`) is live in the "Find Stock" button
today with no equivalent reliability record either.
**what to build:** run `npm run probe:unwrangle` and `npm run probe:stock`
against the documented ground-truth item (324308361 @ store 582 = 8 units,
$7.03, 77% off) with real, funded API keys. Record the actual output —
correct store, correct quantity, correct price, or not — in this file, dated.
Standardize `verify-deals.ts` on whichever source (or fallback chain) the
numbers actually support; if neither works reliably, say so and treat store
confirmation as an open engineering problem rather than assuming it's solved.
**data-method:** cites recon Part B.2/B.4 and Open Question 4 — but goes
further than the recon could, since this depends on repo-only diagnostic
scripts the recon (web-search-only) never had access to.
**why it beats today / beats Hidden Clearances:** turns "we probably have a
confirm layer" into a known, tested fact — the prerequisite for every
downstream honesty claim (Faq.tsx's "we can [track accuracy], because members
confirm finds" only holds if the machine-side confirm call is actually
correct). No competitor researched discloses their confirm-layer reliability
at all; we'd be the only one who could.
**effort:** S — both scripts already exist; this is running them plus writing
down the result.
**cost:** a handful of Unwrangle credits (~2.5/request) and one or two Apify
actor runs — likely under $5 total.
**success metric:** a dated, written answer in this file: which vendor (if
either) returns correct store, quantity, and price against the known-good
ground-truth item.

### 2. Turn the sweep on for real and start the 14-day clock
**status:** todo
**problem:** `APIFY_TOKEN` and `UNWRANGLE_KEY` are blank in `.env.example`.
Outside a handful of manual test runs (2026-08-16), no real append-only price
history is accumulating. `coverage.ts` requires 14 days of history before
scores mean anything, and `run-scan.ts`'s own comment is explicit: "getting
yesterday's number wrong is recoverable; losing it is not" — every day this
isn't running is a day of moat that can never be backfilled.
**what to build:** subscribe to the Apify actor for real, set `SCAN_ZIPS` to
the real San Antonio store set, wire the existing `SCAN_TRIGGER_TOKEN`
scheduler path to run daily, and actively monitor the first two weeks of
output for a repeat of the pulsewatch fabrication incident.
**data-method:** cites recon Part B.2 and Part C's headline finding ("the gap
is operational... not architectural").
**why it beats today / beats Hidden Clearances:** this is the actual moat —
genuine per-store timestamped history — but only from the moment it's
actually running. Hidden Clearances' "9,000 stores, 24/7" is an unverified
marketing claim (recon Part A.1); a real, small, running scan is a stronger
claim than a big unverified one.
**effort:** M — mostly ops and monitoring, not new code.
**cost:** low single-digit dollars/day at current scope per the vendor's
reported $0.85/1k figure — **unverified by us**; recommend checking actual
week-one spend against that number rather than assuming it holds.
**success metric:** 14 consecutive real `scan_runs` with zero fabrication
flags and ≥1 row/store/day; `coverage.ts`'s `scores_meaningful` flips true
for San Antonio.

### 3. Merge PR #2 (freshness bar) once real scan data exists behind it
**status:** todo — blocked on Blueprint 2
**problem:** PR #2 is code-complete but a public "last scan: X min ago"
widget is either dishonest or embarrassing without real data behind it.
This is a sequencing gap, not a code problem.
**what to build:** nothing new — merge PR #2 once Blueprint 2 has produced a
few real days of `scan_runs` history.
**data-method:** cites recon Part C.4 — the one thing no competitor in the
survey can produce, because none of their self-reported cadence numbers were
independently verifiable (recon found zero verified refresh-cadence figures
for any competitor).
**why it beats today / beats Hidden Clearances:** turns an unverifiable
marketing claim category into a checkable number, on our own site.
**effort:** S (a merge, gated on Blueprint 2).
**cost:** $0 incremental.
**success metric:** freshness bar live in production showing a real,
sub-26h timestamp.

### 4. Close the score-calibration loop against real finds
**status:** todo — blocked on Blueprints 1 & 2 producing real data
**problem:** `score.ts` is explicit that weights should be "tuned against
measured hit rate," via a `SCORE_VERSION` bump and replay over history,
"never tune by feel" — but there is no real finds data yet to grade it
against. Right now the scoring model is a well-reasoned guess, not yet a
measured one.
**what to build:** once real `penny_candidate` alerts exist and members start
reporting finds (the `finds` table and `reputation.ts` corroboration system
are already fully built for this), run a periodic review of score vs.
confirmed outcome, and adjust weights via `SCORE_VERSION` + `npm run score`
(rebuild.ts) replay when the data supports a change.
**data-method:** cites `score.ts`'s own documented methodology and recon Part
C.2.
**why it beats today / beats Hidden Clearances:** `Faq.tsx` already claims
"we can [show accuracy], because members confirm finds" — this blueprint is
what makes that claim actually true over time instead of aspirational. No
competitor researched publishes or even claims to track their own hit rate.
**effort:** M, recurring — an operational loop, not a single PR.
**cost:** $0 (uses already-collected data).
**success metric:** a documented hit-rate figure (score band vs.
confirmed-find rate) after the first real calibration pass.

### 5. Put the legal/ToS risk decision in writing
**status:** todo
**problem:** recon confirms Home Depot's ToS prohibits automated collection,
and this applies identically to every vendor in this space — routing scrapes
through Apify/Unwrangle changes who sends the request, not whether it's
against ToS. No file in this repo makes an explicit, on-purpose decision
about this; it's currently an unstated assumption.
**what to build:** not code — a short, explicit written risk note (who bears
the exposure, what mitigates it — e.g. staying vendor-routed rather than
self-scraping, keeping volume proportionate to a single metro rather than a
national footprint that draws more attention) added here or to a dedicated
company note, so it's a decision made on purpose.
**data-method:** cites recon Part B.1 and Open Question 3.
**why it beats today / beats Hidden Clearances:** doesn't beat anyone
technically — every competitor in this space carries the identical exposure
silently. Writing it down converts an unmanaged risk into a managed one,
which matters more the closer the product gets to real paying customers.
**effort:** S (a decision and a paragraph, not a build).
**cost:** $0.
**success metric:** a dated, explicit risk-acceptance note exists in the
repo; if the decision is "mitigate further," a concrete next step is named.

---

### 6. Confirm Lowe's store-level stock actually works before it's promised
**status:** todo
**problem:** `apify.ts` already accepts `retailer: 'lowes'`, but
`unwrangle.ts`'s own comment says plainly: "Unconfirmed: whether per-store
stock exists for Lowe's, Walmart, Target." Lowe's coverage is already implied
in consumer-plan copy (flagged separately in `company/blueprints.md`'s
Amazon-claim item) — if Lowe's store confirmation doesn't actually resolve,
that's the identical false-claim risk, just for a different retailer.
**what to build:** once a real sweep surfaces a Lowe's clearance SKU, run the
same probe pattern as Blueprint 1 against it and record a yes/no.
**data-method:** cites `unwrangle.ts`'s own documented uncertainty.
**why it beats today / beats Hidden Clearances:** prevents shipping a second
unverified retailer claim before it's checked, same discipline already
applied to the Amazon claim.
**effort:** S.
**cost:** a few dollars of API credits.
**success metric:** written yes/no on Lowe's store-level confirmation with
the same real-number evidence standard as Blueprint 1.

### 7. Scope Costco feasibility before it ever reaches a pricing page
**status:** todo
**problem:** the product vision names Costco as a future paid-tier add, but
the recon (Open Question 5) found **zero** competitors claiming Costco
coverage at all in this pass's searches — either an open opportunity or a
sign the underlying data doesn't exist publicly (Costco's membership-gated
pricing is a structural complication HD/Lowe's don't have). Nobody has
checked which.
**what to build:** a scoped, cheap research pass — check whether any
Apify/SerpApi/Unwrangle-style vendor offers a comparable Costco store-level
pricing/inventory surface at all, before the paid-tier roadmap commits to it.
**data-method:** extends recon Part B; cites Open Question 5 directly.
**why it beats today / beats Hidden Clearances:** avoids promising a paid-tier
feature on a pricing page before checking whether the data even exists —
exactly the kind of overpromise this backlog exists to prevent.
**effort:** S (research only, no build).
**cost:** $0–a few dollars if a trial credit is spent testing one vendor.
**success metric:** a written yes/no/maybe on Costco data feasibility, with
named evidence, added to this file before Costco appears on any pricing page.

---

## Open questions carried forward from the recon, with current status

1. **Vendor cost at scale** — partially answered: `.env.example` records a
   vendor-reported $0.85/1k figure, but it's unverified by an actual run.
   Settled by Blueprint 2's monitoring.
2. **Refresh cadence we can honestly claim** — still open; only answerable
   once Blueprint 2 is running and Blueprint 3 (freshness bar) is live.
3. **Legal exposure** — still open as a written decision; see Blueprint 5.
4. **Scoring model signal availability** — reframed by this pass: the real
   open question is not which fields the vendor payload has, but whether
   either wired store-confirm vendor call *works at all*; see Blueprint 1.
5. **Paid-tier Costco/Lowe's data feasibility** — still open; see Blueprints
   6 and 7.
