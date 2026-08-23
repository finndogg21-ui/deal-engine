# Penny-method blueprints — data-engine backlog

Maintained by the BLUEPRINTS sector. Scope: the DATA-METHOD and scan/score/
verify engine specifically (not marketing/UI copy — see `company/blueprints.md`
for that track). Built from `company/penny-recon.md` (2026-08-22 recon, Part D
added 2026-08-23), `company/next-retailer.md` (2026-08-23, updated same day
after Target shipped), `company/target-cracked.md`, `company/
architecture-verdict.md`, plus a direct read of the current code — so this
does not re-propose anything already shipped, already resolved by a later
recon pass, or already sitting unused in the repo.

**Last pass:** 2026-08-23 (this pass). Previous pass: 2026-08-22.

**Product vision this backlog serves:** Home Depot penny deals = the free hook
for the RESELLING tier; the PAID tier later adds Lowe's + Costco.

**What changed since 2026-08-22, in one line:** Target shipped, and shipping
it proved — a second time — that a live-browser session against a retailer's
own internal API beats every paid vendor in this space for $0. That proof
changes this file's #1 priority: the sharpest gap is no longer "we don't know
which vendor to trust for store confirmation," it's "the $0 method that
already works twice has no automation running it."

---

## KEY STRATEGIC DECISION — which data method to run with

**Recommendation, updated: keep the two-layer sweep-plus-confirm hybrid, but
promote the browser-direct internal-API call — proven free and accurate on
BOTH Home Depot and Target — to the primary confirm method, ahead of both
paid vendors (Unwrangle, Apify stock-lookup actors) this repo has been
carrying as the default. Do not switch to a pure store-API-only design, a
direct self-built scraper as the *discovery* layer, or a penny-SKU
crowdsourced corpus as the core method — none of that changed this pass.**

**What's new and why it moves the recommendation:** `src/vendors/
hd-direct.ts` documents a live-verified 2026-08-22 result — item 312232605 @
store 582 → $208.00 (was $289.00), quantity 2, in stock — read directly from
Home Depot's own `federation-gateway` GraphQL endpoint from a real browser
session, matching HD's own product page exactly, for $0. `company/
target-cracked.md` repeats the exact same pattern on a second retailer one
day later: Target's `redsky.target.com` endpoint, called from a browser,
returned real per-store clearance flags and *exact* shelf quantities (10 /
3 / 0 / 0 across four SKUs, statuses agreeing) — also $0, and explicitly
*more* than Apify gives on Home Depot today (exact quantity, not just a
discount flag). Two for two: every retailer this project has actually
inspected live (not just WebSearched) turned out to have a free, accurate,
directly-callable internal API. `company/next-retailer.md`'s own updated
conclusion (2026-08-23) draws the same lesson and proposes the identical
test for Lowe's before paying for it (see Blueprint 6, below) — this
decision section adopts that lesson project-wide, not just for Lowe's.

**The honest catch, and it's a real one: nothing runs this today.**
`hd-direct.ts` and `src/vendors/target-direct.ts` both exist and are
individually verified, but grep confirms neither is imported by `run-scan.ts`
(which still only calls Apify), by `verify-deals.ts` (which still only calls
Unwrangle), or by `stock-find.ts` (which still only calls the paid Apify
`maplerope44/home-depot-product-lookup` actor). `package.json` has **no
browser-automation dependency at all** — no Playwright, no Puppeteer. Every
"verified live from a browser session" claim in `hd-direct.ts` and
`target-cracked.md` describes a one-time manual check, not a running system.
**Tag this precisely: the DATA METHOD is verified; the AUTOMATION to run it
unattended does not exist yet.** That gap is this pass's new #1 (below).

**Why the alternatives still lose, honestly (carried forward, re-checked
this pass, nothing reversed):**

- **Direct GraphQL/RedSky scrape, run ourselves, at volume** — still not
  the recommendation, but the calculus shifted: this pass shows the *browser*
  path (not a server-side raw-HTTP scrape) already works for the confirm
  step at $0, for exactly the reason `hd-direct.ts` documents — HD and Target
  both challenge server-origin requests (403 + captcha) but answer a real
  browser session. The recommendation is still to route *broad discovery*
  (thousands of SKUs) through vendor-run infrastructure (Apify) rather than
  build our own bot-mitigation-evading crawler — Akamai/bot-blocking risk is
  real and unchanged (Part B.1) — but the *low-volume, per-item confirm*
  call is a different cost/risk shape than a broad crawl, and this pass's
  evidence says do it ourselves, in a browser, for $0.
- **Store-specific price/stock API alone, skipping the broad sweep** —
  still rejected, same structural reason as last pass: you cannot query
  per-store stock for a SKU you don't yet know is a candidate. Unchanged.
- **Penny-SKU corpus / crowdsourced list as the core method** — still
  rejected as the *core* method, same reasoning as last pass (recon Part
  A.5/A.9, Part C.5); `reputation.ts`'s corroboration-weighting role is
  correct and unchanged.

**Honest tradeoffs, costs, and risks — updated, not softened:**

1. **Cost scales with store count, not flat — for the SWEEP, still true.**
   The `$0.85/1k` Apify figure in `.env.example` is still **[claim,
   vendor-reported, still not independently measured by us]**. At current
   scope (~5 San Antonio HD stores) this is cheap; it will not stay cheap at
   national scale. Unchanged from last pass.
2. **The browser-direct confirm call is not automatically free of cost —
   it trades a per-request vendor fee for infrastructure and maintenance
   cost.** Running Playwright/Puppeteer unattended on a schedule needs
   somewhere to run a real headless browser (a small VM or scheduled
   container — realistically $5-20/mo of compute at this scale, well under
   any vendor's per-request pricing, but not literally $0) and it is
   **more fragile than a vendor SLA**: HD or Target can change their
   internal endpoint, DOM, or bot-check at any time with zero notice and no
   support line to call — `hd-direct.ts`'s own header already says this
   ("HD can change or gate it at any time; every caller must treat failure
   as 'unknown', never as 'no stock'"). A paid vendor's job is partly to
   absorb that maintenance burden; choosing the free path means we absorb
   it instead. Worth it at this cost gap, but not a free lunch.
3. **Akamai/bot-mitigation risk is real and already materialized once** on
   the discovery/sweep side: on 2026-08-16 the `pulsewatch/dealwatch-scraper`
   Apify actor returned fabricated rows (`SAMPLE-SCREWDRIVER`, identical
   prices) while reporting success. `run-scan.ts`'s `looksFabricated()`
   guard and `src/vendors/apify.ts`'s own documented rejection of that actor
   exist because of this exact incident. **Note for the record:**
   `penny-recon.md` Part D3 (2026-08-23) independently flagged the same
   actor as possibly "hobby-grade" from search results alone — this repo
   already has the harder, first-hand evidence WebSearch could only guess
   at. Nothing new to decide here; just confirming the two findings agree.
4. **The store-confirmation layer's *paid-vendor* leg is still not proven
   reliable — separate from the free leg above, which now clearly works.**
   `probe-unwrangle.ts`'s header still documents three failed attempts
   (wrong-city fulfillment nodes) plus a fourth "Product not found" on a
   known-good item, and **no run with a real key is recorded anywhere in
   this repo, still.** This matters less now that the free browser-direct
   path is verified working — but Unwrangle/the Apify stock-lookup actor
   remain useful as a fallback path if the browser automation proves
   fragile in production, so the open probe question is downgraded from
   "the" answer to "a fallback worth still resolving cheaply" (Blueprint 2).
5. **Legal exposure is real, applies to Home Depot AND Target now, not
   just Home Depot, and is still not written down anywhere in this repo as
   an on-purpose decision.** `hd-direct.ts` names HD's ToS prohibition
   explicitly; no equivalent note exists yet for Target's terms (not
   checked this pass — flagged, not verified either way). See Blueprint 5.
6. **The $0.01-cannot-be-read-from-a-public-API limit is still fully
   respected in the codebase and in this recommendation.** Neither
   `hd-direct.ts` nor `target-direct.ts` claims to read a live $0.01 —
   they read real store-level price and quantity, which is genuinely more
   than most competitors get, but per `penny-recon.md` Part B.5 the
   register-level $0.01 state still does not exist in any online-readable
   field anywhere, confirmed again this pass with no contradicting
   evidence found for either retailer. **This plan remains lead-and-verify
   by construction; nothing below proposes claiming a live penny price.**

**Confidence:** the *shape* (sweep for discovery, a confirm step before
trusting a lead) is unchanged and still well-supported. The *promotion of
browser-direct calls to the primary confirm method* is new this pass and
rests on strong, first-hand, twice-repeated evidence (not inference) — but
its *automation* is entirely unbuilt, which is exactly why it is Blueprint 1,
not a fact already banked.

---

## Already shipped in this domain — not re-proposed

- Two-vendor sweep+confirm architecture (`src/vendors/`, `README.md`),
  matching the recon's convergent recommendation. Unchanged from last pass.
- **Target retailer module, shipped since last pass:** `target-direct.ts`
  (RedSky price + exact per-store quantity, browser-verified across 5
  stores), `target-search.ts`, `src/ingest/target-ingest.ts` (256 lines, not
  a stub). Free — no vendor cost, beating the original `next-retailer.md`
  cost estimate ($15-75/mo) entirely. `discovery.ts`, the schema, and
  `nearby-deals.ts` are confirmed retailer-agnostic already (no migration
  needed), so Target reused the pipeline rather than forking it.
- **Home Depot direct-confirm call, verified but unwired** (see Blueprint 1):
  `hd-direct.ts` — real store price/quantity, $0, browser-verified
  2026-08-22. Listed here as "shipped" in the sense that the *code and the
  verification* exist; listed as the top backlog item because *nothing calls
  it yet*.
- Multi-signal, replayable scoring model (`score.ts`), markdown-ladder/
  stockDivergence detection (`stages.ts`), fabrication guard
  (`looksFabricated()`), append-only `price_observations` + `scan_runs`,
  parallel-wave store verification (`verify-deals.ts` — still Unwrangle-only,
  see Blueprint 1), spotter reputation/corroboration (`reputation.ts`),
  metro-scoped coverage gating (`coverage.ts`), consistent "prediction, not a
  promise" copy across public pages. All unchanged from last pass — still
  shipped, still not re-proposed.
- On-demand async stock-lookup worker (`store-lookup-async.ts`).
- **Costco data-method question, resolved (not built):** `penny-recon.md`
  Part D1 (2026-08-23) confirms Costco's in-warehouse clearance is
  structurally invisible online (not synced with costco.com, often no
  online item ID at all) — this is a closed research question now, not an
  open blueprint. See the "Decided, not building" section below instead of
  a Costco todo item.

---

## Ranked backlog

### 1. Build the automation to run the $0 browser-direct confirm call that's already proven twice
**status:** todo — new top priority this pass, supersedes last pass's framing
of Blueprint 1
**problem:** `hd-direct.ts` (HD) and `target-direct.ts` (Target) are each
individually, first-hand verified to return correct store-level price and
quantity for $0 — beating every paid vendor this repo has tried. But neither
is called from anywhere: `run-scan.ts` only imports Apify, `verify-deals.ts`
only calls Unwrangle, `stock-find.ts` only calls a paid Apify actor. There is
no Playwright/Puppeteer dependency in `package.json` — the "scheduled
browser agent" that `target-cracked.md` and `hd-direct.ts`'s comments refer
to does not exist as running infrastructure; every verification recorded so
far was a one-time manual browser session, not a system.
**what to build:** a minimal headless-browser runner (Playwright is the
natural fit — no existing dependency to conflict with) that, on a schedule,
loads each target retailer's storefront in a real browser context (so
cookies/credentials are present, matching `target-direct.ts`'s documented
requirement for `credentials:'include'`), calls `hd-direct.ts`/
`target-direct.ts`'s URL-builders for a batch of pending candidates, and
writes results into the same tables `verify-deals.ts` currently writes to.
Treat every failure as "unknown," never "no stock," exactly as `hd-direct.ts`
already instructs. Keep Unwrangle/the Apify stock-lookup actor wired as a
fallback path, not deleted — see Blueprint 2.
**data-method:** cites `hd-direct.ts`'s own verified 2026-08-22 result,
`target-cracked.md`'s verified 2026-08-23 result, and `next-retailer.md`'s
"two-for-two, do the browser test before paying" conclusion, extended here
from "the next retailer" to "the confirm layer generally."
**why it beats today / beats Hidden Clearances:** turns a manually-verified
fact into a running, free, accurate confirm layer — something no competitor
in `penny-recon.md`'s survey is documented doing (every one of them is
either scraping listing pages or crowdsourcing; none showed evidence of a
direct internal-API browser call). It also directly fixes today's honesty
gap: `verify-deals.ts` calling only Unwrangle means every Home Depot
"verified" deal today is running through the one vendor path this repo's own
probe script has never successfully confirmed works.
**effort:** M-L — new infrastructure (a browser-automation dependency and a
scheduled runner), not "run an existing script." Larger than last pass's
version of this item, which assumed the work was just running two existing
probe scripts.
**cost:** no per-request API fee; realistic infra cost ~$5-20/mo for a small
scheduled headless-browser runtime, well under Unwrangle's $99/mo+ tier or
sustained Apify stock-lookup spend — plus ongoing engineering cost to notice
and fix breakage when HD/Target change their endpoint or DOM, which a paid
vendor would otherwise absorb.
**success metric:** N consecutive days (recommend 7) of unattended, scheduled
`hd-direct.ts` and `target-direct.ts` calls against known candidates,
correct price+quantity spot-checked against a manual check, feeding real
rows into `verify-deals.ts`'s output — not another one-off manual browser
session.

### 2. Keep the paid-vendor probes as a documented fallback, not the primary path
**status:** todo — downgraded from last pass's "top priority," not dropped
**problem:** `probe-unwrangle.ts`'s own header still documents three failed
attempts (wrong-city fulfillment nodes) and a fourth "Product not found" on a
known-good item; no run with a real key is recorded anywhere in this repo.
`store-lookup.ts` (a different Apify actor) is live in the "Find Stock"
button today with no equivalent reliability record either. Now that
Blueprint 1 gives the confirm layer a proven-free primary path, this
question matters less than last pass framed it — but a documented fallback
still matters for resilience if the browser-direct method breaks or gets
rate-limited.
**what to build:** run `npm run probe:unwrangle` and `npm run probe:stock`
against the documented ground-truth item (324308361 @ store 582 = 8 units,
$7.03, 77% off) with real, funded API keys, once. Record the actual result,
dated, in this file. Wire whichever (if either) works as the fallback path
`verify-deals.ts` and `stock-find.ts` fall back to when the browser-direct
path errors, rather than as the primary call.
**data-method:** cites recon Part B.2/B.4, Open Question 4, and this repo's
own unresolved probe scripts.
**why it beats today / beats Hidden Clearances:** a documented, tested
fallback is still more than any competitor discloses about their own
reliability — but it's no longer this backlog's single point of failure.
**effort:** S — both scripts already exist; this is running them once and
wiring a fallback branch.
**cost:** a handful of Unwrangle credits (~2.5/request) and one or two Apify
actor runs — likely under $5 total, unchanged from last pass.
**success metric:** a dated, written answer in this file on whether either
vendor's store-confirm call works at all; if yes, it's wired as fallback
behind Blueprint 1's browser-direct path, not ahead of it.

### 3. Turn the sweep on for real and start the 14-day clock
**status:** todo — unchanged from last pass
**problem:** `APIFY_TOKEN` and `UNWRANGLE_KEY` are still blank in
`.env.example`. Outside a handful of manual test runs, no real append-only
price history is accumulating. `coverage.ts` requires 14 days before scores
mean anything.
**what to build:** subscribe to the Apify actor for real, set `SCAN_ZIPS` to
the real San Antonio store set, wire the daily scheduler path, and actively
monitor the first two weeks for a repeat of the pulsewatch fabrication
incident. Extend to Target once Blueprint 1's browser confirm layer is
running, so both retailers' history starts accumulating together rather than
staggered.
**data-method:** cites recon Part B.2 and Part C's headline finding.
**why it beats today / beats Hidden Clearances:** the actual moat — genuine
per-store timestamped history — only from the moment it's really running.
**effort:** M — mostly ops and monitoring.
**cost:** low single-digit dollars/day at current scope per the vendor's
reported (still unverified by us) $0.85/1k figure.
**success metric:** 14 consecutive real `scan_runs` with zero fabrication
flags and ≥1 row/store/day for both Home Depot and Target;
`coverage.ts`'s `scores_meaningful` flips true for San Antonio.

### 4. Merge the freshness bar once real scan data exists behind it
**status:** todo — blocked on Blueprint 3, unchanged in substance from last
pass
**problem:** a public "last scan: X min ago" widget is either dishonest or
embarrassing without real data behind it — still a sequencing gap, not a
code problem.
**what to build:** nothing new here — this item belongs to `company/
blueprints.md`'s track once Blueprint 3 above has produced real days of
`scan_runs` history; noted here only so this file's dependency chain stays
accurate.
**data-method:** cites recon Part C.4.
**why it beats today / beats Hidden Clearances:** turns an unverifiable
marketing-claim category into a checkable number, on our own site.
**effort:** S (a merge, gated on Blueprint 3).
**cost:** $0 incremental.
**success metric:** freshness bar live in production showing a real,
sub-26h timestamp.

### 5. Close the score-calibration loop against real finds
**status:** todo — blocked on Blueprints 1 & 3 producing real data, unchanged
from last pass
**problem:** `score.ts` says weights should be tuned against measured hit
rate, "never by feel" — no real finds data exists yet to grade against.
**what to build:** once real `penny_candidate` alerts exist and members
report finds, run a periodic review of score vs. confirmed outcome and
adjust weights via `SCORE_VERSION` + replay.
**data-method:** cites `score.ts`'s own methodology and recon Part C.2.
**why it beats today / beats Hidden Clearances:** makes `Faq.tsx`'s
accuracy claim actually true over time. No competitor researched publishes
or even claims to track their own hit rate.
**effort:** M, recurring.
**cost:** $0.
**success metric:** a documented hit-rate figure after the first real
calibration pass.

### 6. Put the legal/ToS risk decision in writing — now covering Target too
**status:** todo — scope widened this pass
**problem:** recon confirms Home Depot's ToS prohibits automated collection;
this now also applies to Target (`target-direct.ts` calls Target's internal
API directly, same posture as HD) but Target's specific terms were not
checked this pass — an unverified gap, flagged honestly rather than assumed
either way. No file in this repo makes an explicit, on-purpose decision
about either.
**what to build:** not code — a short, explicit written risk note covering
both retailers now: who bears the exposure, what mitigates it (staying
low-volume/browser-direct rather than a broad self-built crawler, keeping
volume proportionate to a single metro).
**data-method:** cites recon Part B.1 and this pass's Target-side gap.
**why it beats today / beats Hidden Clearances:** doesn't beat anyone
technically — every competitor in this space carries identical exposure
silently. Writing it down converts an unmanaged risk into a managed one.
**effort:** S (a decision and a paragraph).
**cost:** $0.
**success metric:** a dated, explicit risk-acceptance note exists, covering
Home Depot AND Target; if Target's ToS wasn't actually checked, that's
stated as an open item, not silently assumed.

### 7. Lowe's: try the $0 browser-direct crack BEFORE paying for Unwrangle
**status:** todo — fully rewritten this pass; supersedes last pass's version
of this item
**problem:** last pass framed this as "confirm Lowe's store-level stock
works, once a real sweep surfaces a candidate" and assumed the paid Unwrangle
path ($99/mo+, confirmed live per `penny-recon.md` Part D2) as the default.
That assumption is now outdated: `next-retailer.md`'s same-day update (its
Open Question #8) points out that the exact same live-browser network-tab
method that cracked both Home Depot (`architecture-verdict.md`) and Target
(`target-cracked.md`) for $0 has **never actually been tried on Lowe's** —
every Lowe's finding to date came from WebSearch alone, and WebSearch missed
HD's and Target's real free endpoints too, until someone loaded the actual
site and watched network traffic.
**what to build:** before committing to Unwrangle's $99/mo+ tier, open a
Lowe's product clearance page in a real browser session and watch the
network tab for a price/stock call shaped like HD's `federation-gateway` or
Target's RedSky — specifically checking for a store-level quantity field and
any clearance-flag equivalent to HD's `alternatePriceDisplay`. If found,
build `lowes-direct.ts` following the exact `hd-direct.ts`/`target-direct.ts`
pattern. If genuinely not found (Lowe's does sit behind a plausible B2B-only
`developer.lowes.com` portal per `next-retailer.md`'s Open Question #7,
worth a two-minute check first), fall back to Unwrangle's confirmed-live
Lowe's API as the paid path, per last pass's original recommendation.
**data-method:** cites `next-retailer.md`'s 2026-08-23 update (Open
Questions #7-8) and `penny-recon.md` Part D2.
**why it beats today / beats Hidden Clearances:** if it hits, Lowe's ships
free like Target did — a second retailer with a genuine per-store
confirmation signal none of the "9,000 stores, 24/7" competitors are shown
to have. Even if it misses, it's a two-minute test that avoids committing to
a $99+/mo vendor before checking the free option one more time — exactly the
mistake the original `next-retailer.md` WebSearch-only estimate ($15-75/mo
for Target) already made once and got proven wrong by 100%.
**effort:** S for the browser test itself; M for a full `lowes-direct.ts`
module if it hits (mirrors Target's build, which was itself effort M once
the endpoint was known).
**cost:** $0 for the test. If it hits: $0 ongoing (same infra as Blueprint 1
covers). If it misses: Unwrangle from $99/mo, unchanged from last pass's
estimate.
**success metric:** a dated, written yes/no in this file on whether Lowe's
has a free, store-level, directly-callable endpoint — settled by direct
observation, not inference, before any Lowe's promise reaches a pricing
page.

---

## Decided, not building (closed research questions — keep here so they
## don't get re-asked)

- **Costco — decided NOT to build as a scrape/vendor integration.**
  `penny-recon.md` Part D1 (2026-08-23) is conclusive, not just directional:
  in-warehouse "manager markdown" clearance at Costco is warehouse-specific
  and structurally does not reliably appear on costco.com at all — a
  different failure mode than "the API is expensive" or "Akamai blocks us"
  (both true, but secondary). No vendor found in this pass or last offers a
  Costco-specific pricing/inventory endpoint at any price. **If Costco ships
  at all, it needs a crowdsourced-report feature** (closer to PennyCentral's
  model) as its own, separate product decision — not a line item on this
  data-method backlog, and not something this file should keep re-scoping
  every pass. Do not put Costco on a pricing page referencing "automated
  scanning" — it would be false per this recon.
- **Walmart — decided NOT next**, per `next-retailer.md`'s ranking (dual
  Akamai+PerimeterX/HUMAN bot defense, 9/10 difficulty; the one signal that
  would matter — remote store-verification — is not confirmed purchasable at
  any price; already the most saturated retailer in the competitor set).
  Re-open only if a future pass finds a specific, named, working
  store-verification path — not on raw demand size alone.

---

## Open questions carried forward, with current status

1. **Vendor cost at scale (Apify sweep)** — still open; unverified by an
   actual multi-day run. Settled by Blueprint 3's monitoring.
2. **Refresh cadence we can honestly claim** — still open; depends on
   Blueprint 3 running and Blueprint 4 (freshness bar) being live.
3. **Legal exposure, now for two retailers** — still open as a written
   decision; widened scope, see Blueprint 6.
4. **Store-confirm layer reliability** — **substantially resolved this
   pass for the free path** (hd-direct.ts, target-direct.ts both verified
   live); **still open for the paid-vendor fallback path** (Blueprint 2) and
   **entirely open for whether any of this is actually automated** (Blueprint
   1 — the real gap now).
5. **Lowe's data feasibility** — reframed this pass from "which paid vendor"
   to "try the free browser-direct crack first" — see Blueprint 7.
6. **Target's ToS exposure** — new this pass, unverified either way; folded
   into Blueprint 6.
