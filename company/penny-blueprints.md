# Penny-method blueprints — data-engine backlog

Maintained by the BLUEPRINTS sector. Scope: the DATA-METHOD and scan/score/
verify engine specifically (not marketing/UI copy — see `company/blueprints.md`
for that track). Built from `company/penny-recon.md` (2026-08-22 recon, Parts
D/E/F added 2026-08-23/24/25), `company/next-retailer.md` (2026-08-23,
2026-08-24 Costco/Walmart probe, 2026-08-25 closing-status update),
`company/lowes-cracked.md`, `company/target-cracked.md`, `company/
architecture-verdict.md`, plus a direct read of the current code, `schema.sql`,
and git history — so this does not re-propose anything already shipped,
already resolved by a later recon pass, or already sitting unused in the
repo. Open GitHub PRs (#1–#5, all marketing/UI track — header state, contact
form, false-claim removal, freshness bar, hero copy) were checked and don't
overlap this file.

**Last pass:** 2026-08-25 (this pass). Previous pass: 2026-08-24.

**Product vision this backlog serves:** Home Depot penny deals = the free hook
for the RESELLING tier; the PAID tier later adds Lowe's + Costco.

**What changed since 2026-08-24, in one line:** Walmart shipped as retailer
#4 — same $0 browser-direct pattern as Target and Lowe's, first-party-only via
a `sellerName` guard, 10 deals live — making it four-for-four on the free
method, not three-for-three; `penny-recon.md` Part F landed (two resolves, one
reversed claim, one strengthened category, a corrected funding figure); and
this repo's own `next-retailer.md` closed the "which retailer next" question
directly against the code rather than another WebSearch pass, confirming the
Costco crowdsourcing feature still isn't built and — on this pass's own check
below — was pointed at the wrong table.

---

## KEY STRATEGIC DECISION — which data method to run with

**Recommendation (unchanged in shape for the third pass running, now backed by
a fourth repeated proof, not a third): keep the two-layer hybrid — a broad
DISCOVERY sweep to generate candidates, plus a per-item CONFIRM call before
publishing a lead — but run both layers, for as many retailers as will bear
it, through that retailer's own internal storefront endpoint called from a
real browser session, not through a paid store-specific-price-scan vendor and
not by building a penny-SKU corpus as the core method.**

**Why, plainly:** every retailer this project has actually inspected live —
Home Depot (`hd-direct.ts`), Target (`target-direct.ts`), Lowe's
(`lowes-direct.ts`), and now Walmart (`walmart-direct.ts`) — turned out to
expose real price (and for HD, real per-store stock) through its own
undocumented internal API, reachable for **$0** from a real browser session,
while refusing a server-side/raw-HTTP request with a 403/206. That is four
independent tries, four confirmations, zero counterexamples. Every paid
vendor this recon surveyed (Unwrangle, SerpApi, BigBox API, the Apify actors)
is calling the *same* underlying endpoints behind their own bot-mitigation
layer — paying them buys their bot-mitigation engineering, not a different or
more authoritative data source (`penny-recon.md` Part B.1–B.3). At this
project's current scale (one metro, four retailers), the free path has won
every time it's been tried head-to-head.

**Reject, explicitly, the other two options named in this pass's scope:**

- **A pure store-specific price-scan API, run at volume, as the primary
  method.** Rejected for the same structural reason every prior pass gave:
  you cannot query per-store stock for a SKU you don't already suspect is a
  candidate, so a confirm-only API without a discovery layer in front of it
  doesn't work. It's also the more expensive path — Unwrangle alone is
  $99/mo+ before a single request pays off, versus $0 for the browser-direct
  calls already proven working four times over.
- **The current clearance-listing SCRAPE via a paid Apify actor, as the
  primary/only discovery method.** Rejected as the *sole* method, not as a
  concept. **New this pass — a real, unresolved contradiction worth stating
  plainly:** `.env.example` and `company/architecture-verdict.md` (2026-08-22)
  already point `APIFY_ACTOR_ID` at `scrapyspider/home-depot-clearance-
  scraper`, with an internal note claiming "measured 2026-08-16: 17 monthly
  users, 98.7% success, 24-48h support, $0.85/1k results" — described as
  **VERIFIED vendor pricing** from a "6-agent research workflow." But
  `penny-recon.md` Part E1 (2026-08-24), working from Apify's own
  platform-reported usage stats via WebSearch, found the **same actor**
  showing **0.0/5 rating, 0 reviews** — one of three "generic, not
  clearance-specific, all 0.0/5" alternatives, not a differentiated pick.
  Neither of these two internal, self-reported numbers can be verified
  against the other from outside this recon's method — one is this repo's
  own prior "verified" claim, the other is a fresh WebSearch read of the same
  actor's public page two months later. **Do not trust either number as
  settled.** This is exactly the kind of discrepancy that only a real trial
  run resolves — see Blueprint 3.
- **A penny-SKU crowdsourced corpus as the CORE method.** Rejected as the
  core method for the fourth pass running (recon Part A.5/A.9, Part C.5) —
  but this is not a hole in the plan, it's already built as a supporting
  layer: `community.ts` (PennyCentral/Slickdeals/RebelSavings ingest, public
  pages only) and `finds.ts` + `reputation.ts` (first-party, reputation-
  weighted "found it / not there" submissions against an already-scanned
  candidate) are both shipped and running. Crowdsourcing is correctly used
  here as corroboration and ground truth, never as the primary discovery
  signal.

**The honest, load-bearing catch — stated plainly, not softened, for the
fourth pass running: nothing about this recommendation lets deal-engine read
a real $0.01 price from any public endpoint, across any of the four
retailers now live.** `penny-recon.md` Part B.5 remains true and was not
contradicted again this pass (Part F targeted unrelated open questions and
found nothing that touches it): the register-level $0.01 state does not
exist online. HD's `alternatePriceDisplay`, Target's per-store quantity,
Lowe's markdown fields, and Walmart's `flag:"Clearance"` are all genuinely
more than most competitors show — but they are still leads (real price, real
stock where available, real markdown/clearance flag), not confirmed penny
prices. Every "verified" claim this repo makes must keep saying that.
**This plan is lead-and-verify by construction; it does not, and structurally
cannot, promise a penny.**

**Honest tradeoffs, costs, and risks:**

1. **Akamai/bot-blocking is real for all four retailers now, not one or
   three.** HD (Akamai, 206), Target (403 + captcha), Lowe's (403
   server-side, Akamai confirmed this pass — Part F1), and now Walmart
   (Akamai **plus** PerimeterX, per `next-retailer.md`'s 2026-08-24 probe) —
   all reject a raw HTTP request and only answer a real browser session. The
   mitigation this repo has actually used so far — a human manually drives
   the browser and hands off JSON, or (for Walmart) a browser-pane harness
   script — works, but is not automation; see Blueprint 1.
2. **Cost genuinely does scale with store/request count for a broad SWEEP,
   not for the confirm call — and this pass found the first real
   order-of-magnitude anchor for that cost.** `penny-recon.md` Part F7
   surfaces a non-HD-specific case study: an Akamai-protected target burned
   through unblocker-proxy pricing around **$2.50–$3 per 1,000 requests**.
   **[inference, not modeled against this repo's actual request volume]** —
   at that rate, a metro-scale daily sweep (this repo's current San Antonio
   scope) plausibly lands in the "low hundreds of dollars/month" range, not
   the $1,200–10,000+/mo enterprise figure Part E4 had as the only prior
   anchor. This is directional, not a number to budget against yet — see
   Blueprint 3. The browser-direct confirm call has the opposite cost
   shape — not per-request-metered, but it needs somewhere to run a real
   headless browser on a schedule (~$5–20/mo of compute, realistically) and
   it trades a vendor SLA for engineering time when a retailer changes its
   endpoint or DOM with zero notice.
3. **Legal exposure now spans four retailers, not three.** Home Depot's and
   Lowe's ToS both explicitly prohibit automated collection (`penny-recon.md`
   Part B.1, D2, F1). Target's and **Walmart's** terms are both **unchecked**
   — confirmed by a direct grep of this repo's own vendor files this pass;
   neither `target-direct.ts` nor `walmart-direct.ts` records a ToS check.
   No file in this repo makes an explicit, on-purpose, written risk-
   acceptance decision covering all four. See Blueprint 4.
4. **The $0.01-cannot-be-read-from-a-public-API limit is fully respected in
   the codebase and in this recommendation**, and nothing proposed below
   changes that. Walmart's own ingest commit message says this explicitly:
   the in-app hidden-clearance price is "physically gated to a device in the
   aisle" and is never claimed; Walmart rows carry no per-store stock claim
   either, same discipline already applied to Lowe's.

**Confidence:** the *shape* (sweep for discovery, browser-direct confirm
before trusting a lead, crowdsourcing as corroboration not core) is
well-supported and has now been independently reached by the recon (WebSearch
only) and proven **four** separate times by this repo's own first-hand
browser tests — two different methods converging on the same answer, with
zero counterexamples across HD/Target/Lowe's/Walmart. The *specific Apify
actor pick* for the discovery sweep is still genuinely open and, per the new
scrapyspider contradiction above, arguably **less** settled than it looked
last pass, not more — it needs a real trial, not another recon pass and not
trust in either self-reported number on file.

---

## Already shipped in this domain — not re-proposed

- Two-vendor sweep+confirm architecture (`src/vendors/`, `README.md`) — still
  not wired (`APIFY_TOKEN`, `UNWRANGLE_KEY` both blank in `.env.example`,
  checked again this pass).
- **Home Depot, Target, Lowe's, and now Walmart direct-confirm/discovery
  modules — all four individually verified live, all four still run by
  hand or by a one-off browser-pane harness script, not a scheduler.**
  `hd-direct.ts`, `target-direct.ts`, `lowes-direct.ts`, and
  `walmart-direct.ts` each document a real, browser-verified result at $0.
  `target-ingest.ts`, `lowes-ingest.ts`, and `walmart-ingest.ts` all take a
  browser-collected JSON file as a CLI argument and write it to the DB —
  this is the actual shipping mechanism for three of four retailers today,
  and it is a manual handoff, not a scheduled job. Walmart's own commit
  documents the load-bearing guard for this pattern generalizing safely: an
  **exact-match `sellerName` guard**, run twice (harness + ingest), because
  only 6 of 71 measured items were first-party — marketplace sellers invent
  was-prices otherwise. This is the same "treat every untrusted input as
  untrusted twice" discipline Lowe's units-guard already established.
- The report-and-confirm loop for **already-scanned** candidates — fully
  built. `src/api/routes/finds.ts` (`POST /api/finds`, reputation-weighted
  via `reputation.ts`, reciprocity-gated `GET /api/finds/verified`,
  `GET /api/me/spotter`) plus the `finds`/`spotter_stats` tables is a
  complete "found it / not there" submission-and-corroboration system,
  already live for Home Depot/Target/Lowe's/Walmart candidates. **Important
  scope correction made this pass, see Blueprint 2:** this system requires an
  existing `products`/`stores` row and an `sku_state.penny_score` to grade
  against — it is not the right extension point for a catalog-free retailer
  like Costco, and last pass's Blueprint 2 aimed at the wrong table.
- Community third-party ingest (`community.ts`, served by
  `community-deals.ts`): PennyCentral, Slickdeals RSS, RebelSavings — public
  pages only, 1–2 polls/day, feeding `community_reports` (retailer-keyed,
  no FK into `products`/`stores`) as labeled hearsay, separate from
  `price_observations`. **This table, not `finds`, is the actual shape a
  catalog-free submission feature would extend — see Blueprint 2.** As
  built today it is one-way ingest only: there is no `POST` endpoint, so a
  human user cannot submit into it yet.
- Multi-signal, replayable scoring model (`score.ts`), markdown-ladder/
  stockDivergence detection (`stages.ts`), fabrication guard
  (`looksFabricated()`), append-only `price_observations` + `scan_runs`,
  parallel-wave store verification (`verify-deals.ts` — still Unwrangle-only),
  spotter reputation/corroboration (`reputation.ts`), metro-scoped coverage
  gating (`coverage.ts`).
- On-demand async stock-lookup worker (`store-lookup-async.ts`).
- **Costco data-method question, resolved three times now (not built).**
  `penny-recon.md` Part D1, `next-retailer.md`'s 2026-08-23 pass, and
  `next-retailer.md`'s 2026-08-24 live browser probe (Part "Probe the
  rejects," `170bfe6`) all independently conclude Costco's warehouse-specific
  manager-markdown clearance is structurally invisible on costco.com — the
  2026-08-24 probe found only the monthly member coupon book ($2–4 off CPG,
  dated), which the reseller-grade price floor would reject almost entirely.
  See "Decided, not building" below.
- **Walmart data-method question, resolved and reversed since last pass.**
  Last pass's `next-retailer.md` ranking said "decided NOT next"; a live
  2026-08-24 probe overturned that WebSearch-only verdict and shipped it the
  same night. Nothing further to decide here — see "Already shipped" above.

---

## Ranked backlog

### 1. Build the automation to run the $0 browser-direct handoff that's now shipped FOUR times by hand
**status:** todo — top priority for the fourth pass running; scope grew again,
not shrank
**problem:** `hd-direct.ts`, `target-direct.ts`, `lowes-direct.ts`, and
`walmart-direct.ts` are each individually, first-hand verified to return
correct price (and, for HD, stock) for $0. But the actual pipeline for all
four is: a human opens a browser, watches network traffic or runs a manual
fetch or a one-off harness script (`scripts/walmart-sweep.browser.js`), saves
JSON, then runs a CLI script by hand. There is still no Playwright/Puppeteer
dependency in `package.json` (checked again this pass — unchanged), no
scheduler, and no `npm run` script for the Lowe's or Walmart ingest paths at
all (only `scan`/`scan:dry` exist, both Apify-only). Every "10 Walmart deals
published" or "45 Lowe's deals published" claim in this repo describes a
one-time manual session, not a running system. Walmart's own commit is
explicit that "sweep-volume behavior beyond [~22 clean requests] is
untested" — meaning even the manual process hasn't been run at the volume a
real daily job would need yet.
**what to build:** a minimal headless-browser runner (Playwright is the
natural fit — nothing in `package.json` conflicts) that, on a schedule, loads
each retailer's storefront in a real browser context, calls the existing
`clearanceUrl()`/`detailUrl()`-style builders already written in each
`*-direct.ts` module (and generalizes `walmart-sweep.browser.js`'s
pagination-plus-seller-guard pattern) for a batch of candidates, and writes
results into the same tables `verify-deals.ts` / `*-ingest.ts` already
target. Treat every failure as "unknown," never "no stock" — `hd-direct.ts`'s
own header already says this. Keep the seller-exact-match guard and the
units guard running twice (harness + ingest) exactly as shipped, not
simplified. Keep Unwrangle/Apify stock-lookup wired as a fallback, not
deleted (Blueprint 3).
**data-method:** cites `hd-direct.ts`, `target-cracked.md`,
`lowes-cracked.md`, and Walmart's `170bfe6`/`f7810fd` commits — four
independently verified results, all converging on the same architecture.
**why it beats today / beats Hidden Clearances:** turns four
manually-verified facts into one running, free, accurate pipeline — something
no competitor in `penny-recon.md`'s survey is documented doing (every one of
them scrapes listing pages or crowdsources; none showed evidence of a direct
internal-API browser call across even two retailers, let alone four). It also
fixes today's operational reality: shipping or maintaining a retailer today
means someone sits down and drives a browser by hand, which does not scale
past four and will not survive anyone being unavailable.
**effort:** M-L — new infrastructure (a browser-automation dependency, a
scheduled runner, four existing modules to wire into it), unchanged in size
from last pass's estimate despite covering one more retailer.
**cost:** no per-request API fee; realistic infra cost ~$5–20/mo for a small
scheduled headless-browser runtime — well under Unwrangle's $99/mo+ tier —
plus ongoing engineering time to notice and fix breakage when a retailer
changes its endpoint or DOM, which a paid vendor would otherwise absorb.
**success metric:** N consecutive days (recommend 7) of unattended, scheduled
calls against all four retailers' known candidates, spot-checked against a
manual check, feeding real rows into the DB — not another one-off manual
session, and specifically including a real test of Walmart at sweep volume
(beyond the ~22 requests run clean so far) without triggering a block.

### 2. Build the catalog-free report-and-confirm feature — on `community_reports`, not `finds` (scope corrected this pass)
**status:** todo — carried forward, gap re-analyzed against the actual schema
**problem:** `next-retailer.md`'s 2026-08-25 closing-status update
(`1d1b092`) checked this repo's own code directly and confirmed: the report-
and-confirm feature Costco structurally needs (per Part D1/the 2026-08-24
probe: warehouse markdowns don't reach costco.com, so crowdsourcing is the
*only* honest route) has still not been built. **This pass went one step
further and found last pass's proposed fix pointed at the wrong table.**
Last pass's Blueprint 2 proposed extending `finds.ts` (`POST /api/finds`) to
accept catalog-free submissions. But `finds` requires `product_id` and
`store_id` as `NOT NULL` foreign keys into `products`/`stores`
(`schema.sql` lines 186-189) **and** its whole design is graded against an
existing `sku_state.penny_score` prediction (`finds.ts` line 50) — it is an
answer key for a candidate our own scan already flagged, which Costco, having
no scan pipeline, structurally never will. `community_reports`
(`schema.sql` lines 578-601) is the actual better fit — already
retailer-keyed, `sku`/`item_id` are plain nullable `TEXT`, no FK into
`products`/`stores` at all — **but it has no `user_id` column, no link to
`spotter_stats`, and no `POST` endpoint**; `community-deals.ts` only exposes
`GET` routes today. So the real gap is not "loosen two NOT NULL columns," it's
"design and build a lightweight, user-attributed submission path for a table
that was built anonymous-ingest-only."
**what to build:** add a nullable `user_id` (and `evidence_url`, matching
`finds`'s pattern) to `community_reports`, or a small parallel table with the
same shape plus user attribution; a `POST /api/community-deals` endpoint,
authenticated, rate-limited like `finds.post` and `community-deals.get`
already are; and a narrow corroboration rule reusing `reputation.ts`'s
formula (`reputationFrom()`) but keyed off `(retailer, dedupe_key)` or
`(retailer, store_number, title)` instead of `(product_id, store_id)`, since
there's no product row to key against. Gate the corroboration window and
weight formula identically to `finds` — don't invent a second one.
**data-method:** cites `next-retailer.md`'s 2026-08-25 closing note (which
names the CostLow precedent: photo-and-manual-entry, no scraping at all) and
this pass's own direct read of `schema.sql`/`finds.ts`/`community-deals.ts`.
**why it beats today / beats Hidden Clearances:** per `next-retailer.md`,
Costco pairs the largest verified demand figure found in the entire
competitor survey (Costco Finds Facebook group, **[verified: 2+ independent
sources]** ~1.4M members) with a $0 cost path — no vendor bill, because the
cost is engineering time on infrastructure this repo already built most of.
No competitor surveyed (Part C) publishes a transparent, reputation-weighted
confirmation loop at all; Costco would be the first retailer where that loop
*is* the entire product.
**effort:** S-M — larger than last pass's "S" estimate now that the real gap
(schema change + new endpoint + a keying scheme with no product row) is
understood, but still reuses `reputation.ts`'s math and `finds.ts`'s
auth/rate-limit pattern rather than building either from scratch.
**cost:** $0 incremental — no vendor, no scraping surface, no bot-mitigation
risk, because there is nothing to scrape.
**success metric:** a real Costco submission accepted end-to-end (free-text
item, warehouse number, price) with no existing catalog row, visible in a
corroborated feed once a second report lands. **Honest caveat, carried
forward unchanged from last pass, still unresolved:** whether this actually
gets submissions at a small user base before Costco's 1.4M-member audience is
ever redirected to it is unproven — the cheap test is still to launch this
against HD/Target/Lowe's/Walmart leads first (harder now, since `finds`
already covers scanned candidates there) or ship it Costco-only and measure
real submission rate over 1-2 weeks before deciding whether it's worth more
investment. **Do this measurement before writing Costco marketing copy.**

### 3. Decide the discovery-sweep vendor for real, then turn the sweep on
**status:** todo — merges and updates last pass's Blueprint 3; the "decision"
this file previously described as merely narrowed is, per this pass's own
finding above, now shown to be actively contradictory on file
**problem:** `APIFY_TOKEN` and `UNWRANGLE_KEY` are still both blank in
`.env.example` (checked again this pass). Outside manual test runs and the
four retailers' one-off manual handoffs, no real append-only price history is
accumulating anywhere; `coverage.ts` requires 14 days before scores mean
anything. `.env.example`'s `APIFY_ACTOR_ID` is already pointed at
`scrapyspider/home-depot-clearance-scraper` with an internal note claiming
verified 98.7% success and 17 monthly users (2026-08-16) — but
`penny-recon.md` Part E1 independently found the same actor at 0.0/5, 0
reviews, lumped with two other "generic, not penny-specific" alternatives.
This is a genuine, unresolved contradiction between this repo's own prior
"verified" claim and an independent later read of the same public page — see
the strategic decision section above. Turning the sweep on "as configured"
today means trusting one of two conflicting numbers about the same actor,
neither externally confirmable from outside.
**what to build:** two sequenced steps, not one, unchanged from last pass but
now with a sharper reason to do step one first: run a small paid trial of
`scrapyspider/home-depot-clearance-scraper` against at least one alternative
(`ecomscrape` or `scraptivo` — `scraptivo`'s price may have dropped to
$10/1,000 per Part F7, unconfirmed) and **directly reconcile the trial's real
success rate against both the 98.7% figure on file and the 0.0/5-rating
figure the recon found** — whichever the live trial actually shows should
overwrite both stale, conflicting claims in `.env.example` and
`architecture-verdict.md`. Second, once a vendor is picked (or the decision is
"skip Apify, lean harder on Blueprint 1's browser-direct discovery instead" —
a real option now that HD/Target/Lowe's/Walmart all expose free
clearance-listing or search pages), run `probe:unwrangle` and `probe:stock`
once against the documented ground-truth item with real keys and record the
dated result in this file.
**data-method:** cites recon Part B.2/B.4/E1/F7, `architecture-verdict.md`'s
own conflicting claim, and this repo's own unresolved probe scripts.
**why it beats today / beats Hidden Clearances:** the actual moat — genuine
per-store timestamped history — only exists from the moment a real, working
sweep is actually running, on a vendor whose real success rate this repo has
verified itself rather than inherited from either a stale internal note or an
external recon snapshot.
**effort:** M — a paid trial, a reconciliation of the two conflicting
internal claims, a decision, then ops/monitoring for the first two weeks
watching for a repeat of the earlier fabrication incident.
**cost:** the Apify trial is a few dollars (Part E1/F7 pricing anchors:
`scraptivo` ~$10-15/1,000 products, `ecomscrape` ~$20/mo+usage — both
**[claim, vendor listing]**); the probe runs are under $5 total; ongoing
sweep cost at current San Antonio scope is plausibly low-hundreds-of-
dollars/month at the new Part F7 cost anchor (**[inference]**, not yet
modeled against this repo's real request volume), well below the
$1,200-10,000+/mo enterprise figure that was the only anchor two passes ago.
**success metric:** a dated, written record in this file of which actor (if
any) was trialed, its real observed success rate, and how that reconciles
with the two conflicting numbers already on file — followed by 14 consecutive
real `scan_runs` with zero fabrication flags and ≥1 row/store/day across all
four retailers; `coverage.ts`'s `scores_meaningful` flips true for San
Antonio.

### 4. Put the legal/ToS risk decision in writing — now covering four retailers
**status:** todo — scope widened again this pass
**problem:** recon confirms Home Depot's and Lowe's ToS both prohibit
automated collection. Target's terms were flagged unchecked two passes ago
and remain unchecked. **Walmart's terms are unchecked too — confirmed by a
direct grep of `walmart-direct.ts` and `target-direct.ts` this pass, neither
records a ToS review.** No file in this repo makes an explicit, on-purpose
written decision about any of the four, despite all four now being live,
shipping data sources.
**what to build:** not code — a short, explicit written risk note covering
all four retailers now: who bears the exposure, what mitigates it (staying
low-volume/browser-direct rather than a broad self-built crawler, keeping
volume proportionate to a single metro, per-item confirm calls rather than
full-catalog scraping, the seller/units guards that keep volume low by
design).
**data-method:** cites recon Part B.1, D2, F1, and this pass's confirmed
Target-and-Walmart ToS gap.
**why it beats today / beats Hidden Clearances:** doesn't beat anyone
technically — every competitor in this space carries identical exposure
silently. Writing it down converts an unmanaged risk into a managed one,
across four retailers instead of one.
**effort:** S (a decision and a paragraph).
**cost:** $0.
**success metric:** a dated, explicit risk-acceptance note exists, covering
Home Depot, Target, Lowe's, AND Walmart; for Target and Walmart specifically,
either the ToS gets actually checked and the result stated, or the gap is
stated as a deliberate, open, accepted risk — not silently assumed either
way.

### 5. Close the score-calibration loop against real finds, with Part F's signal-weighting corrections applied
**status:** todo — merges last pass's Blueprint 5 with Part F's reversed and
strengthened signals
**problem:** `score.ts` says weights should be tuned against measured hit
rate, "never by feel" — real `finds` submissions now exist as a mechanism
(shipped) but not yet at volume, since the underlying scan pipelines
(Blueprint 1/3) aren't running unattended yet. Part F changed two specific
inputs to that future calibration work since last pass: **(F4) the
"14-day cadence compression" claim from Part E5 is now reversed, not just
unconfirmed** — it traces to templated marketing copy shared verbatim across
three competitor sites with zero primary-source corroboration, while a
dedicated primary-source search found no posters describing the compression
or tag-ending unreliability. **(F2) Lowe's tag-ending heuristic is downgraded
from "thin" to "actively contradictory"** — four sources disagree with each
other on the actual digits, unlike Home Depot's `.02/.03/.04` pattern which
multiple independent sources agree on.
**what to build:** once real `penny_candidate` alerts and `finds` submissions
exist at volume, run a periodic review of score vs. confirmed outcome and
adjust weights via `SCORE_VERSION` + replay. Two specific corrections to
apply from this pass: **do not** downweight Home Depot's tag-ending signal
based on the cadence-compression claim (F4 says don't act on it); **do**
build any Lowe's-specific scoring signal from Unwrangle's structured fields
(`inventory.status.discontinued`, `list_price`, etc. — Part F3) rather than
from a tag-ending heuristic, which now has zero source agreement for Lowe's
specifically. Also add **Wyze/smart-plug clearance** as a confirmed candidate
category (Part F5: 9 independent Slickdeals posts, up from 2) alongside the
existing Part B.7 category list; leave outdoor power equipment unconfirmed
(still one thin data point).
**data-method:** cites `score.ts`'s own methodology, recon Part C.2, and Part
F2/F3/F4/F5.
**why it beats today / beats Hidden Clearances:** makes the product's
accuracy claim actually true over time, against real data, from a source no
competitor researched publishes or even claims to track — and does it without
importing a competitor-marketing artifact (the 14-day claim) as if it were
real signal.
**effort:** M, recurring; blocked on Blueprints 1 and 3 producing real data
at volume.
**cost:** $0.
**success metric:** a documented hit-rate figure after the first real
calibration pass, plus written confirmation that the F2/F4 corrections above
were actually applied (Lowe's signal built from Unwrangle fields, not
tag-ending; HD tag-ending weight left alone).

### 6. Merge the freshness bar once real scan data exists behind it
**status:** todo — already has an open PR; sequencing note only, not new work
**problem:** PR #2 ("Add public live-scan freshness bar to marketing
footer") is already open against this exact feature. A public "last scan: X
min ago" widget is either dishonest or embarrassing without real, unattended
scan data behind it (Blueprint 1/3) — this is a merge-timing question, not a
code gap, and not this file's track (`company/blueprints.md` owns it).
**what to build:** nothing new here — noted only so this file's dependency
chain stays accurate: **do not merge PR #2 until Blueprint 1 or 3 is
producing real, unattended scan history**, or the bar will show a stale or
manually-faked timestamp. `penny-recon.md` Part E3/F confirms zero
competitors publish real cadence data anywhere — this differentiator is still
fully unclaimed and worth waiting to do honestly rather than rushing.
**data-method:** cites recon Part C.4, E3.
**why it beats today / beats Hidden Clearances:** turns an unverifiable
marketing-claim category into a checkable number, on our own site — but only
once it's true.
**effort:** S (already built as a PR; the remaining work is sequencing).
**cost:** $0 incremental.
**success metric:** PR #2 merges only after Blueprint 1/3's success metric is
met, showing a real, sub-26h timestamp on day one.

---

## Decided, not building (closed research questions — keep here so they
## don't get re-asked)

- **Costco — decided NOT to build as a scrape/vendor integration.** Confirmed
  independently three times now: `penny-recon.md` Part D1, `next-retailer.md`'s
  2026-08-23 research pass, and `next-retailer.md`'s 2026-08-24 **live browser
  probe** (not just research — an actual $0 check of costco.com) all conclude
  in-warehouse manager-markdown clearance is structurally invisible on
  costco.com — the live probe specifically found only the monthly member
  coupon book, which the reseller floor would reject almost entirely. **What
  Costco needs instead is the catalog-free extension to community reporting —
  Blueprint 2, above, now correctly scoped to `community_reports` — not a
  scrape adapter.** Do not put Costco on a pricing page referencing
  "automated scanning" — it would be false per this recon.
- ~~Walmart — decided NOT next~~ — **REVERSED and shipped.** Last pass's
  entry here (based on `next-retailer.md`'s 2026-08-23 WebSearch-only
  ranking: dual Akamai+PerimeterX, 9/10 difficulty, most-saturated retailer
  in the competitor set) was overturned by a live 2026-08-24 browser probe
  that found the clearance browse page serving 200-300 structured products
  per page in `__NEXT_DATA__`, and shipped as retailer #4 the same night.
  Kept here only as a record of a WebSearch-only verdict a live check
  reversed — a caution for weighting future WebSearch-only recon passes
  against an actual $0 browser test when the two disagree, not a standing
  decision anymore.

---

## Open questions carried forward, with current status

1. **Discovery-sweep vendor pick** — **less resolved than it looked last
   pass, not more.** This pass found `.env.example`'s already-configured
   pick (`scrapyspider`) directly contradicted by the recon's own Part E1
   finding for the same actor. Settled by Blueprint 3's real trial, which now
   also needs to reconcile that contradiction, not just pick a vendor cold.
2. **Vendor cost at scale** — a real, non-HD-specific cost anchor now exists
   (Part F7: ~$2.50-3/1,000 requests), suggesting metro-scale cost is
   plausibly "low hundreds of dollars/month" — but this is **[inference]**,
   unmodeled against this repo's actual request volume. Settled by
   Blueprint 3.
3. **Refresh cadence we can honestly claim** — still open; `penny-recon.md`
   Part E3 hardens the case that no competitor anywhere publishes real
   cadence data, strengthening the freshness-bar differentiator once
   Blueprint 1/3 make it true. See Blueprint 6.
4. **Legal exposure, now for four retailers** — still open as a written
   decision; Target's and Walmart's ToS both specifically still unchecked.
   See Blueprint 4.
5. **Store-confirm layer reliability** — resolved for the free path across
   all four retailers now (Blueprint 1's problem is automation, not
   reliability); still open for the paid-vendor fallback path (Blueprint 3).
6. **Costco submission cold-start** — will a catalog-free report flow get
   real submissions before Costco has a large dedicated user base? Cheap
   test proposed in Blueprint 2: measure real submission rate on a small
   base first before assuming the 1.4M-member Facebook audience transfers.
7. **Is the HD markdown cadence actually compressing, and is the tag-ending
   heuristic weakening as a result?** **RESOLVED this pass (F4), and
   reversed:** no — the compression claim traces to templated marketing copy
   with zero primary-source corroboration; do not act on it. HD's
   `.02/.03/.04` heuristic stands as-is. (Lowe's tag-ending is a separate,
   still-open problem — see Blueprint 5; it's actively contradictory, not
   compressing.)
8. **Is `scrapyspider/home-depot-clearance-scraper` actually a good pick, or
   actually abandoned?** New this pass — this repo's own `.env.example`/
   `architecture-verdict.md` and the independent recon (Part E1) give
   directly conflicting answers about the same actor's real-world usage and
   success rate. Neither can be verified from outside; only a real trial
   (Blueprint 3) settles it.
