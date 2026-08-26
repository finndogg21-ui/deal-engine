# Penny-method blueprints — data-engine backlog

Maintained by the BLUEPRINTS sector. Scope: the DATA-METHOD and scan/score/
verify engine specifically (not marketing/UI copy — see `company/blueprints.md`
for that track). Built from `company/penny-recon.md` (2026-08-22 recon through
**Part G, 2026-08-26**), `company/next-retailer.md` (through its 2026-08-26
re-verification pass), `company/dollar-general-recon.md` (2026-08-25),
`company/lowes-cracked.md`, `company/target-cracked.md`,
`company/architecture-verdict.md`, plus a direct read of the current code
(`src/vendors/`, `src/engine/discovery.ts`, `src/api/routes/`, `schema.sql`,
`package.json`, `.env.example`) and git history — so this does not re-propose
anything already shipped, already resolved by a later recon pass, or already
sitting unused in the repo.

**Last pass:** 2026-08-26 (this pass). Previous pass: 2026-08-25
(`b83bbcc`).

**Product vision this backlog serves:** Home Depot penny deals = the free hook
for the RESELLING tier; the PAID tier later adds Lowe's + Costco.

**What changed since 2026-08-25, in one line:** two retailers shipped
*outside* this file's tracking since the last pass — Best Buy (a fifth,
independent proof of the free browser-direct pattern, plus a parallel
official-API path waiting only on a free key) and Dollar General (wired as a
retailer label/coverage-tier, but — checked directly against the code this
pass — **without** the actual member-report submission endpoint, contradicting
`next-retailer.md`'s 2026-08-26 claim that it "shipped, end to end"); recon
Part G lands a real, dollar-anchored cost model for the still-undecided
discovery-sweep vendor and hardens the do-not-wire call on
`pulsewatch/dealwatch-scraper`; and this pass corrects an overclaim made by
this repo's own most recent research file rather than an external source.

---

## KEY STRATEGIC DECISION — which data method to run with

**Recommendation (unchanged in shape for the fourth pass running, now backed
by a FIFTH proof, not a fourth): keep the two-layer hybrid — a broad
DISCOVERY sweep to generate candidates, plus a per-item CONFIRM call before
publishing a lead — but run both layers, for as many retailers as will bear
it, through that retailer's own internal storefront endpoint called from a
real browser session, not through a paid store-specific-price-scan vendor and
not by building a penny-SKU corpus as the core method.**

**Why, plainly:** every retailer this project has actually inspected live —
Home Depot (`hd-direct.ts`), Target (`target-direct.ts`), Lowe's
(`lowes-direct.ts`), Walmart (`walmart-direct.ts`), and now **Best Buy**
(`bestbuy-gateway.ts`, cracked 2026-08-25) — turned out to expose real price
(and for HD and Best Buy's own clearance flag, real markdown status) through
its own undocumented internal API, reachable for **$0** from a real browser
session, while refusing a server-side/raw-HTTP request. That is five
independent tries, five confirmations, zero counterexamples. Every paid
vendor this recon surveyed (Unwrangle, SerpApi, BigBox API, the Apify actors)
is calling the *same* underlying endpoints behind their own bot-mitigation
layer — paying them buys their bot-mitigation engineering, not a different or
more authoritative data source (`penny-recon.md` Part B.1–B.3). At this
project's current scale (one metro, five retailers), the free path has won
every time it's been tried head-to-head.

**Best Buy is the one genuine exception worth naming, and it doesn't break
the pattern — it sharpens it.** Best Buy is also the only retailer in the
lineup with a real, sanctioned, free official API (`bestbuy-direct.ts`,
`BESTBUY_API_KEY` from developer.bestbuy.com, 5 req/s / 50k calls/day, no
Akamai, no browser, no proxy). That module is built and correct today; it
just doesn't have a key yet, so the browser-gateway crack (`bestbuy-gateway.ts`)
is what ships rows in the meantime, on purpose, side by side — see Blueprint 0
below. **This is the cheapest, lowest-risk fix in this entire backlog and
should happen before anything else in this file.**

**Reject, explicitly, the other two options named in this pass's scope:**

- **A pure store-specific price-scan API, run at volume, as the primary
  method.** Rejected for the same structural reason every prior pass gave:
  you cannot query per-store stock for a SKU you don't already suspect is a
  candidate, so a confirm-only API without a discovery layer in front of it
  doesn't work. It's also the more expensive path — Unwrangle alone is
  $99/mo+ before a single request pays off, versus $0 for the browser-direct
  calls already proven working five times over.
- **The current clearance-listing SCRAPE via a paid Apify actor, as the
  primary/only discovery method.** Rejected as the *sole* method, not as a
  concept, and the case against the specific actor already configured
  (`scrapyspider/home-depot-clearance-scraper`) got stronger, not weaker,
  this pass. `.env.example` and `company/architecture-verdict.md` still claim
  this actor was internally "measured 2026-08-16: 17 monthly users, 98.7%
  success" — but `penny-recon.md` Part G6 (2026-08-26) independently
  re-checked the *other* named actor in that same family,
  `pulsewatch/dealwatch-scraper`, and found a concrete, hard number behind
  the prior pass's suspicion: **0.0 rating, 0 reviews, 73-day average issue
  response time.** Neither this repo's own internal "verified" claim nor the
  external recon's read can be checked against the other from outside this
  process. **Do not trust either number as settled — this is exactly the
  kind of discrepancy only a real trial run resolves (Blueprint 3).**
- **A penny-SKU crowdsourced corpus as the CORE method.** Rejected as the
  core method for the fifth pass running (recon Part A.5/A.9, Part C.5) —
  but this is not a hole in the plan, it's a supporting layer, partially
  built: `community.ts` (PennyCentral/Slickdeals/RebelSavings ingest, public
  pages only) and `finds.ts` + `reputation.ts` (first-party, reputation-
  weighted "found it / not there" submissions against an already-scanned
  candidate) are both shipped and running for the four scanned retailers.
  **What is not yet built, corrected this pass: a user-facing submission
  path into `community_reports` itself** — see Blueprint 1 below. DG and
  Costco both need exactly this, and neither has it yet.

**The honest, load-bearing catch — stated plainly, not softened, for the
fifth pass running: nothing about this recommendation lets deal-engine read
a real $0.01 price from any public endpoint, across any of the five
retailers now live, or the sixth retailer (Dollar General) partially wired.**
`penny-recon.md` Part B.5 remains true and was not contradicted again this
pass: the register-level $0.01 state does not exist online. HD's
`alternatePriceDisplay`, Target's per-store quantity, Lowe's markdown fields,
Walmart's `flag:"Clearance"`, and Best Buy's own `currentoffers_facet`
clearance flag are all genuinely more than most competitors show — but they
are still leads (real price, real markdown/clearance flag, real stock where
available), not confirmed penny prices. Every "verified" claim this repo
makes must keep saying that. **This plan is lead-and-verify by construction;
it does not, and structurally cannot, promise a penny.**

**Honest tradeoffs, costs, and risks:**

1. **Akamai/bot-blocking is real for five of six retailers now, with one
   structural exception.** HD (Akamai, 206), Target (403 + captcha), Lowe's
   (403 server-side, Akamai confirmed — recon Part F1), Walmart (Akamai
   **plus** PerimeterX), and Best Buy (its own gateway blocks a raw
   server-side request the same way) all reject a raw HTTP request and only
   answer a real browser session. Dollar General is the one exception: its
   clearance/penny price isn't gated behind bot defense at all, it simply
   **does not exist on any web surface, ever** (`dollar-general-recon.md`,
   firsthand endpoint probe) — a harder problem than bot-blocking, not an
   easier one. The mitigation this repo has actually used so far for the
   five bot-gated retailers — a human manually drives the browser and hands
   off JSON, or a browser-pane harness script — works, but is not
   automation; see Blueprint 2.
2. **Cost genuinely does scale with store/request count for a broad SWEEP,
   not for the confirm call — and this pass has the sharpest cost anchor
   yet, with real spread.** `penny-recon.md` Part G5 (2026-08-26) triangulates
   current 2025–2026 vendor pricing across three named vendors (Bright Data
   Web Unlocker ~$1.50/1,000 after a Jan-2025 price cut, Oxylabs ~$1.15/1,000,
   ScraperAPI ~$0.49/1,000) into a modeled range for a ~2,000-store sweep:
   **~$90-180/mo at daily cadence, one request per store; ~$2,160-4,320/mo at
   hourly cadence.** The load-bearing caveat, stated plainly by the recon
   itself: penny/clearance detection realistically needs multiple
   category/product pages per store, not one request — at that pattern, a
   **realistic hourly production sweep could run $10,000-20,000+/mo** at the
   same per-request rates. Treat the low end as a floor, not a budget. The
   browser-direct confirm call has the opposite cost shape — not
   per-request-metered, but it needs somewhere to run a real headless browser
   on a schedule (~$5-20/mo of compute) and it trades a vendor SLA for
   engineering time when a retailer changes its endpoint or DOM with zero
   notice — Best Buy's own commit history is a live example of exactly that
   trade (a GraphQL gateway crack shipped the same day the official API was
   still waiting on a key).
3. **Legal exposure now spans five scraped retailers, not four, plus a
   distinct exposure class for DG.** Home Depot's and Lowe's ToS both
   explicitly prohibit automated collection (`penny-recon.md` Part B.1, D2,
   F1). Target's, Walmart's, and **Best Buy's** terms are all **unchecked** —
   confirmed by a direct grep of this repo's vendor files this pass; none of
   `target-direct.ts`, `walmart-direct.ts`, or `bestbuy-gateway.ts` records a
   ToS check. **Dollar General carries a different risk shape entirely, not
   a ToS-scraping one:** `dollar-general-recon.md`'s own RISKS pass found the
   real tripwire is republishing *insider pre-release leaks* (DG employees
   leaking the Tuesday penny list a week early) — the routine file
   (`company/routines/dollar-general-reports.md`) already encodes the
   member-scans-only rule as a hard guard, which is correct and should not
   be diluted. No file in this repo makes a single, explicit, written
   risk-acceptance decision covering all five scraped retailers together.
   See Blueprint 3.
4. **The $0.01-cannot-be-read-from-a-public-API limit is fully respected in
   the codebase and in this recommendation**, and nothing proposed below
   changes that. Best Buy's own module docstring is explicit about what it
   deliberately does not claim (per-store stock, open-box condition); DG's
   store page ships with honest "community-reported penny finds" framing,
   never "online prices" or "in-store stock" — same discipline already
   applied to Lowe's and Walmart.

**Confidence:** the *shape* (sweep for discovery, browser-direct confirm
before trusting a lead, crowdsourcing as corroboration not core) is
well-supported and has now been independently reached by the recon (WebSearch
only) and proven **five** separate times by this repo's own first-hand
browser tests, with zero counterexamples across HD/Target/Lowe's/Walmart/Best
Buy. The *specific Apify actor pick* for the discovery sweep remains
genuinely open and, per Part G6, is now backed by a harder negative number
than any prior pass — it needs a real trial, not another recon pass and not
trust in either self-reported number on file.

---

## Already shipped in this domain — not re-proposed

- Two-vendor sweep+confirm architecture (`src/vendors/`, `README.md`) — still
  not wired (`APIFY_TOKEN`, `UNWRANGLE_KEY` both blank in `.env.example`,
  checked again this pass).
- **Home Depot, Target, Lowe's, Walmart, and now Best Buy direct-confirm/
  discovery modules — all five individually verified live, all run by hand or
  by a one-off browser-pane harness script, not a scheduler.** `hd-direct.ts`,
  `target-direct.ts`, `lowes-direct.ts`, `walmart-direct.ts`, and
  `bestbuy-gateway.ts` each document a real, browser-verified result at $0.
  Best Buy's *official* path, `bestbuy-direct.ts`, is also built and correct
  but idle, waiting on `BESTBUY_API_KEY` — see Blueprint 0.
- The report-and-confirm loop for **already-scanned** candidates — fully
  built. `src/api/routes/finds.ts` (`POST /api/finds`, reputation-weighted
  via `reputation.ts`, reciprocity-gated `GET /api/finds/verified`,
  `GET /api/me/spotter`) plus the `finds`/`spotter_stats` tables is a
  complete "found it / not there" submission-and-corroboration system,
  already live for Home Depot/Target/Lowe's/Walmart/Best Buy candidates. This
  system requires an existing `products`/`stores` row and an
  `sku_state.penny_score` to grade against — it is the right extension point
  for scanned retailers, and structurally the wrong one for a catalog-free
  retailer like DG or Costco (see Blueprint 1).
- Community third-party ingest (`community.ts`, served by
  `community-deals.ts`): PennyCentral, Slickdeals RSS, RebelSavings — public
  pages only, 1–2 polls/day, feeding `community_reports` (retailer-keyed,
  no FK into `products`/`stores`) as labeled hearsay, separate from
  `price_observations`. **Still one-way ingest only — checked directly
  against `community-deals.ts` this pass: there is no `POST` route in that
  file at all**, so a human user still cannot submit into it.
- **Dollar General wired as a first-class retailer label and coverage tier —
  but NOT the member-report submission mechanism itself, confirmed by direct
  code inspection this pass.** `discovery.ts` carries the `dollargeneral`
  reject-reason label, `stock.ts` marks it `coverage: 'community'` /
  `perStoreStock: false`, and a live honest page exists at
  `/stores/dollar-general`. `dollar-general-recon.md`'s own "What shipped on
  this pass" section says this explicitly: **"Deliberately NOT shipped: any
  live DG data source. The member-report submission flow (auth'd POST + UI +
  moderation) is the next build."** A grep of `community-deals.ts` and
  `community.ts` this pass confirms no `dg-members` producer or POST route
  exists yet — only a `'dg-members'` string reserved in the `source` type
  union. **This directly contradicts `next-retailer.md`'s 2026-08-26 claim
  that DG "shipped it, end to end, one day later" as a template Costco could
  copy.** DG shipped the *retailer scaffolding* (labels, coverage tier,
  honest page copy, a routine file governing sourcing ethics) — a real,
  useful head start — but not the actual submission endpoint any user could
  hit today. Blueprint 1 below is now scoped to build that missing piece
  once, for both DG and Costco together, rather than treating either as done
  or as a template that already works.
- Multi-signal, replayable scoring model (`score.ts`), markdown-ladder/
  stockDivergence detection (`stages.ts`), fabrication guard
  (`looksFabricated()`), append-only `price_observations` + `scan_runs`,
  parallel-wave store verification (`verify-deals.ts` — still Unwrangle-only),
  spotter reputation/corroboration (`reputation.ts`), metro-scoped coverage
  gating (`coverage.ts`).
- On-demand async stock-lookup worker (`store-lookup-async.ts`).
- **Costco data-method question, resolved three times, still not built.**
  `penny-recon.md` Part D1, and `next-retailer.md`'s 2026-08-23 and
  2026-08-24 (live browser probe) passes all independently conclude Costco's
  warehouse-specific manager-markdown clearance is structurally invisible on
  costco.com. See "Decided, not building" below.
- **Walmart and Best Buy data-method questions, both resolved via a live
  browser probe reversing or extending a WebSearch-only verdict.** Walmart:
  last pass's WebSearch-only "decided NOT next" was overturned by a live
  2026-08-24 probe and shipped the same night. Best Buy: never one of the
  four names this scheduled task's scope originally asked about at all —
  it shipped anyway, 2026-08-25, via its own official-API module plus a
  same-day browser-gateway crack, the same live-probe-beats-WebSearch pattern
  repeating for a second retailer outside the original scope.

---

## Ranked backlog

### 0. Get the free Best Buy API key — the cheapest, lowest-risk item in this file
**status:** todo — new this pass
**problem:** `bestbuy-direct.ts` (the official, sanctioned Products API path —
no Akamai, no browser, no proxy, 5 req/s / 50k calls/day) is fully built and
correct, but idle: `BESTBUY_API_KEY` is blank in `.env.example` and there is
no `.env` file in this checkout at all. Every Best Buy row on the site today
comes from `bestbuy-gateway.ts`, a browser-gateway crack that works but, per
its own docstring, is a companion to the real path, not a replacement, and
carries the same "breaks with zero notice" risk every cracked endpoint in
this file carries.
**what to build:** not code — register for a free key at
developer.bestbuy.com (a same-day, no-cost signup per the vendor's own
public terms), set `BESTBUY_API_KEY` in the real `.env`, and let
`bestbuy-direct.ts` start running alongside `bestbuy-gateway.ts` exactly as
designed — the module's own comment says both can run at once and
`ON CONFLICT` keeps them from double-writing.
**data-method:** cites `bestbuy-direct.ts`'s and `bestbuy-gateway.ts`'s own
docstrings and `.env.example`.
**why it beats today / beats Hidden Clearances:** removes this repo's single
highest-fragility dependency (a gateway crack) for a retailer where a
zero-cost sanctioned alternative already exists and is already coded — no
competitor surveyed in `penny-recon.md` has an official-API retailer at all,
they are all scraping or crowdsourcing every single one of their sources.
**effort:** S — a signup form and an env var, not an engineering task.
**cost:** $0.
**success metric:** `bestbuyReady()` returns true in production and at least
one `bestbuy-direct.ts` sweep runs successfully alongside the gateway crack,
recorded with a date in this file.

### 1. Build the shared catalog-free report-and-confirm submission endpoint — for DG and Costco together, since neither has it
**status:** todo — carried forward from last pass's Blueprint 2, scope
corrected this pass to also cover DG, not just Costco
**problem:** two retailers now structurally require a user-facing submission
path into `community_reports` because their real signal is register-only and
invisible on every web surface: **Dollar General** (`dollar-general-recon.md`,
firsthand endpoint probe — confirmed this pass to still lack the endpoint
despite retailer scaffolding shipping) and **Costco**
(`next-retailer.md`, `penny-recon.md` Part D1 — warehouse manager-markdowns
mostly never reach costco.com). Last pass's proposal (and a claim in
`next-retailer.md`'s 2026-08-26 section) both assumed DG had already solved
this and Costco could just copy it. **Checked directly against the code this
pass: it has not.** `finds.ts` is the wrong extension point for either — it
requires `product_id`/`store_id` `NOT NULL` foreign keys into
`products`/`stores` (`schema.sql` lines 186-189) and grades against an
existing `sku_state.penny_score`, which neither DG nor Costco has, since
neither runs a scan pipeline. `community_reports` (`schema.sql` lines
578-601) is the right table — already retailer-keyed, `sku`/`item_id` are
plain nullable `TEXT` — but it has no `user_id` column, no link to
`spotter_stats`, and `community-deals.ts` exposes only `GET` routes, checked
directly this pass, confirming last pass's read.
**what to build:** add a nullable `user_id` (and `evidence_url`, matching
`finds`'s pattern) to `community_reports`; a `POST /api/community-deals`
endpoint, authenticated, rate-limited like `finds.post` and
`community-deals.get` already are; and a narrow corroboration rule reusing
`reputation.ts`'s formula (`reputationFrom()`) but keyed off
`(retailer, dedupe_key)` or `(retailer, store_number, title)` instead of
`(product_id, store_id)`, since there's no product row to key against. Build
it retailer-agnostic from the start so DG and Costco both plug into the same
endpoint — one submission form, one moderation/fabrication gate, two
`retailer` values. For DG specifically, wire the endpoint to write
`source: 'dg-members'` only (never a third-party leaked-list ingest — the
routine file's hard rule stands unchanged). For Costco, this is also the
*first* piece of Costco infrastructure of any kind in this codebase — no
`costco` string exists anywhere in `src/` yet (checked via grep this pass,
matching `next-retailer.md`'s 2026-08-26 finding).
**data-method:** cites `dollar-general-recon.md`'s "what shipped on this
pass" section, `next-retailer.md`'s Costco sections, and this pass's own
direct read of `schema.sql`/`finds.ts`/`community-deals.ts`/`community.ts`.
**why it beats today / beats Hidden Clearances:** no competitor surveyed in
`penny-recon.md` publishes a transparent, reputation-weighted confirmation
loop at all for any retailer, let alone a catalog-free one. Building it once
for both DG and Costco means the second retailer to need it (whichever one
that turns out to be) costs a fraction of what the first one does — a
retailer-agnostic endpoint is cheaper to extend than a DG-specific one would
be to generalize later. DG demand is large (`dollar-general-recon.md`: DG's
own community incumbents, e.g. TheFreebieGuy, self-report 1M+ members) and
mainstream; Costco pairs the single largest verified demand figure in the
whole competitor survey (~1.4M-member Facebook group) with a $0 cost path.
**effort:** M — larger than a DG-only or Costco-only build would look in
isolation, but the schema change, new endpoint, and no-product-row keying
scheme are shared work, done once.
**cost:** $0 incremental — no vendor, no scraping surface, no bot-mitigation
risk, for either retailer.
**success metric:** a real DG submission and a real Costco submission both
accepted end-to-end through the same endpoint (free-text item, store/
warehouse number, price), each visible in its own retailer's corroborated
feed once a second report lands. **Honest caveat, carried forward unchanged:**
whether either gets real submissions at a small user base before a large
existing audience (DG's incumbent FB groups, Costco's 1.4M-member group) is
redirected to it is unproven — measure real submission rate over 1-2 weeks
before writing marketing copy that assumes either retailer's crowd shows up
on day one.

### 2. Build the automation to run the $0 browser-direct handoff that's now shipped FIVE times by hand
**status:** todo — top data-infrastructure priority for the fifth pass
running; scope grew again, not shrank
**problem:** `hd-direct.ts`, `target-direct.ts`, `lowes-direct.ts`,
`walmart-direct.ts`, and now `bestbuy-gateway.ts` are each individually,
first-hand verified to return correct price (and for HD and Best Buy, a real
clearance/markdown flag) for $0. But the actual pipeline for all five is: a
human opens a browser, watches network traffic or runs a manual fetch or a
one-off harness script, saves JSON, then runs a CLI script by hand. There is
still no Playwright/Puppeteer dependency in `package.json` (checked again
this pass — unchanged), no scheduler, and no `npm run` script for the Lowe's,
Walmart, or Best Buy ingest paths at all (only `scan`/`scan:dry` exist,
both Apify-only). Every "1,758 Best Buy deals published" or "10 Walmart
deals published" claim in this repo describes a one-time manual session, not
a running system.
**what to build:** a minimal headless-browser runner (Playwright is the
natural fit — nothing in `package.json` conflicts) that, on a schedule, loads
each retailer's storefront/gateway in a real browser context, calls the
existing builders already written in each `*-direct.ts`/`*-gateway.ts`
module for a batch of candidates, and writes results into the same tables
`verify-deals.ts` / `*-ingest.ts` already target. Treat every failure as
"unknown," never "no stock" — `hd-direct.ts`'s own header already says this.
Keep every existing guard running exactly as shipped, not simplified: the
seller-exact-match guard (Walmart), the units guard (Lowe's), and Best Buy's
new-condition-only facet discipline. Keep Unwrangle/Apify stock-lookup wired
as a fallback, not deleted (Blueprint 3).
**data-method:** cites `hd-direct.ts`, `target-cracked.md`, `lowes-cracked.md`,
Walmart's `170bfe6`/`f7810fd` commits, and Best Buy's `e6207ef` commit — five
independently verified results, all converging on the same architecture.
**why it beats today / beats Hidden Clearances:** turns five manually-verified
facts into one running, free, accurate pipeline — something no competitor in
`penny-recon.md`'s survey is documented doing (every one of them scrapes
listing pages or crowdsources; none showed evidence of a direct internal-API
browser call across even two retailers, let alone five). It also fixes
today's operational reality: shipping or maintaining a retailer today means
someone sits down and drives a browser by hand, which does not scale past
five and will not survive anyone being unavailable.
**effort:** M-L — new infrastructure (a browser-automation dependency, a
scheduled runner, five existing modules to wire into it), unchanged in size
from last pass's estimate despite covering one more retailer.
**cost:** no per-request API fee; realistic infra cost ~$5-20/mo for a small
scheduled headless-browser runtime — well under Unwrangle's $99/mo+ tier —
plus ongoing engineering time to notice and fix breakage when a retailer
changes its endpoint or DOM, which a paid vendor would otherwise absorb.
**success metric:** N consecutive days (recommend 7) of unattended, scheduled
calls against all five retailers' known candidates, spot-checked against a
manual check, feeding real rows into the DB — not another one-off manual
session, and specifically including a real test of Walmart and Best Buy at
sweep volume beyond what's been run clean so far without triggering a block.

### 3. Decide the discovery-sweep vendor for real, then turn the sweep on
**status:** todo — merges and updates last pass's Blueprint 3 with Part G's
sharper cost model and hardened do-not-use call
**problem:** `APIFY_TOKEN` and `UNWRANGLE_KEY` are still both blank in
`.env.example` (checked again this pass). Outside manual test runs and the
five retailers' one-off manual handoffs, no real append-only price history is
accumulating anywhere; `coverage.ts` requires 14 days before scores mean
anything. `.env.example`'s `APIFY_ACTOR_ID` is still pointed at
`scrapyspider/home-depot-clearance-scraper` with an internal note claiming
verified 98.7% success and 17 monthly users (2026-08-16) — but
`penny-recon.md` Part G6 (2026-08-26) hardens the case against the
closely-related `pulsewatch/dealwatch-scraper` actor with a concrete number
(0.0 rating, 0 reviews, 73-day issue response), and Part E1 already flagged
`scrapyspider`'s own marketing copy as near-identical templated language.
This remains a genuine, unresolved contradiction between this repo's own
prior "verified" claim and an independent later read of a related actor's
public page.
**what to build:** two sequenced steps, unchanged in shape from last pass but
now with a real dollar range to size the decision against: run a small paid
trial of `scrapyspider/home-depot-clearance-scraper` against at least one
alternative (`ecomscrape` at a reconfirmed $3.50/1,000, or `scraptivo` — its
$10 vs. $15/1,000 pricing is now flagged as **conflicting across snippets**,
per Part G6, not a confirmed price cut) and directly reconcile the trial's
real success rate against both the 98.7% figure on file and the negative
signal the recon found for the related actor. Second, once a vendor is picked
(or the decision is "skip Apify, lean harder on Blueprint 2's browser-direct
discovery instead" — a real option now that five retailers expose free
clearance-listing or search pages), run `probe:unwrangle` and `probe:stock`
once against the documented ground-truth item with real keys and record the
dated result in this file.
**data-method:** cites recon Part B.2/B.4/E1/F7/G5/G6, `architecture-
verdict.md`'s own conflicting claim, and this repo's own unresolved probe
scripts.
**why it beats today / beats Hidden Clearances:** the actual moat — genuine
per-store timestamped history — only exists from the moment a real, working
sweep is actually running, on a vendor whose real success rate this repo has
verified itself rather than inherited from either a stale internal note or an
external recon snapshot.
**effort:** M — a paid trial, a reconciliation of the two conflicting
internal claims, a decision, then ops/monitoring for the first two weeks
watching for a repeat of the earlier fabrication incident.
**cost:** the Apify trial is a few dollars; the probe runs are under $5
total. Ongoing sweep cost, per Part G5's first real dollar-anchored model:
**~$90-180/mo at daily cadence** (one request/store), **~$2,160-4,320/mo at
hourly cadence**, but a realistic multi-page-per-store hourly crawl could run
**$10,000-20,000+/mo** at the same per-request rates — treat the low end as a
floor, not a number to budget against until this repo's real
page-count-per-store-per-scan is modeled.
**success metric:** a dated, written record in this file of which actor (if
any) was trialed, its real observed success rate, and how that reconciles
with the conflicting numbers already on file — followed by 14 consecutive
real `scan_runs` with zero fabrication flags and ≥1 row/store/day across all
scanned retailers; `coverage.ts`'s `scores_meaningful` flips true for San
Antonio.

### 4. Put the legal/ToS risk decision in writing — now covering five scraped retailers plus DG's distinct exposure
**status:** todo — scope widened again this pass
**problem:** recon confirms Home Depot's and Lowe's ToS both prohibit
automated collection. Target's, Walmart's, and now **Best Buy's** terms are
all unchecked — confirmed by a direct grep of `bestbuy-gateway.ts`,
`target-direct.ts`, and `walmart-direct.ts` this pass; none records a ToS
review. No file in this repo makes an explicit, on-purpose written decision
about any of the five, despite all five now being live, shipping data
sources. Dollar General is a **separate risk category**, already correctly
identified and guarded in `company/routines/dollar-general-reports.md`
(insider-leak sourcing, not automated-collection ToS exposure) — that
guard should not be diluted or merged into a generic "scraping risk" note,
since the mitigation is different (source discipline, not request volume).
**what to build:** not code — a short, explicit written risk note covering
the five scraped retailers: who bears the exposure, what mitigates it
(staying low-volume/browser-direct rather than a broad self-built crawler,
keeping volume proportionate to a single metro, per-item confirm calls
rather than full-catalog scraping, the seller/units/facet guards that keep
volume low by design) — and a one-line cross-reference to DG's already-written
risk note so a future reader finds both without assuming they're the same
kind of risk.
**data-method:** cites recon Part B.1, D2, F1, `dollar-general-recon.md`'s
RISKS section, and this pass's confirmed Target/Walmart/Best-Buy ToS gap.
**why it beats today / beats Hidden Clearances:** doesn't beat anyone
technically — every competitor in this space carries identical exposure
silently. Writing it down converts an unmanaged risk into a managed one,
across five retailers instead of four, without collapsing DG's genuinely
different risk into the same bucket.
**effort:** S (a decision and a paragraph).
**cost:** $0.
**success metric:** a dated, explicit risk-acceptance note exists, covering
Home Depot, Target, Lowe's, Walmart, AND Best Buy; for Target, Walmart, and
Best Buy specifically, either the ToS gets actually checked and the result
stated, or the gap is stated as a deliberate, open, accepted risk — not
silently assumed either way.

### 5. Close the score-calibration loop against real finds, with Part F/G's signal-weighting corrections applied
**status:** todo — merges last pass's Blueprint 5, unchanged in substance;
Part G added no new signal-weighting corrections this pass
**problem:** `score.ts` says weights should be tuned against measured hit
rate, "never by feel" — real `finds` submissions now exist as a mechanism
(shipped) but not yet at volume, since the underlying scan pipelines
(Blueprints 2/3) aren't running unattended yet. Two corrections from Part F
remain to apply once real data exists: **(F4)** the "14-day cadence
compression" claim is reversed, not just unconfirmed — templated marketing
copy with zero primary-source corroboration; do not downweight HD's
tag-ending signal based on it. **(F2)** Lowe's tag-ending heuristic is
actively contradictory across sources, not just thin — build any
Lowe's-specific scoring signal from Unwrangle's structured fields instead.
**what to build:** once real `penny_candidate` alerts and `finds` submissions
exist at volume, run a periodic review of score vs. confirmed outcome and
adjust weights via `SCORE_VERSION` + replay, applying the F2/F4 corrections
above, and add **Wyze/smart-plug clearance** as a confirmed candidate
category (Part F5: 9 independent Slickdeals posts) alongside the existing
Part B.7 category list. Leave outdoor power equipment unconfirmed — Part G3
(2026-08-26) ran a fresh, dedicated search and found no new primary-source
penny finds for mowers/blowers/generators, plus one new mild counter-signal
("power tools rarely penny out," blog-sourced, not primary) — the category
stays a "keep watching," not a scoring input.
**data-method:** cites `score.ts`'s own methodology, recon Part C.2, and Part
F2/F3/F4/F5/G3.
**why it beats today / beats Hidden Clearances:** makes the product's
accuracy claim actually true over time, against real data, from a source no
competitor researched publishes or even claims to track.
**effort:** M, recurring; blocked on Blueprints 2 and 3 producing real data
at volume.
**cost:** $0.
**success metric:** a documented hit-rate figure after the first real
calibration pass, plus written confirmation the F2/F4 corrections were
actually applied and that OPE was correctly left out of the scoring model
per G3.

### 6. Merge the freshness bar once real scan data exists behind it
**status:** todo — already has an open PR; sequencing note only, not new work
**problem:** PR #2 ("Add public live-scan freshness bar to marketing
footer") is already open against this exact feature. A public "last scan: X
min ago" widget is either dishonest or embarrassing without real, unattended
scan data behind it (Blueprints 2/3) — this is a merge-timing question, not a
code gap, and not this file's track (`company/blueprints.md` owns it).
**what to build:** nothing new here — noted only so this file's dependency
chain stays accurate: **do not merge PR #2 until Blueprint 2 or 3 is
producing real, unattended scan history**, or the bar will show a stale or
manually-faked timestamp. `penny-recon.md` Part E3/G4 confirms zero
competitors publish real cadence data anywhere — this differentiator is
still fully unclaimed and worth waiting to do honestly rather than rushing.
**data-method:** cites recon Part C.4, E3, G4.
**why it beats today / beats Hidden Clearances:** turns an unverifiable
marketing-claim category into a checkable number, on our own site — but only
once it's true.
**effort:** S (already built as a PR; the remaining work is sequencing).
**cost:** $0 incremental.
**success metric:** PR #2 merges only after Blueprint 2/3's success metric is
met, showing a real, sub-26h timestamp on day one.

---

## Decided, not building (closed research questions — keep here so they
## don't get re-asked)

- **Costco — decided NOT to build as a scrape/vendor integration.** Confirmed
  independently three times: `penny-recon.md` Part D1, and `next-retailer.md`'s
  2026-08-23 research pass and 2026-08-24 **live browser probe** (an actual
  $0 check of costco.com) — in-warehouse manager-markdown clearance is
  structurally invisible on costco.com. **What Costco needs instead is the
  catalog-free extension to community reporting — Blueprint 1, above.** Do
  not put Costco on a pricing page referencing "automated scanning" — it
  would be false per this recon.
- ~~Walmart — decided NOT next~~ — **REVERSED and shipped.** Overturned by a
  live 2026-08-24 browser probe finding a structured `__NEXT_DATA__` clearance
  feed; shipped as retailer #4 the same night. Kept here as a caution about
  weighting a WebSearch-only verdict against an actual $0 browser test when
  the two disagree — the same lesson repeated a second time by Best Buy
  shipping outside this task's original four-retailer scope entirely.
- **Dollar General — decided the crowdsourced-report route, per its own
  recon, is correct; scraping `/c/on-sale` national online sales is explicitly
  rejected as off-brand and low-value.** Not re-litigated this pass. What
  remains open is only the submission mechanism (Blueprint 1), not the
  architecture choice.

---

## Open questions carried forward, with current status

1. **Discovery-sweep vendor pick** — still open, harder to trust than it
   looked two passes ago. Part G6 gives a concrete negative number for a
   closely-related actor (`pulsewatch`: 0.0 rating, 0 reviews, 73-day
   response); `scraptivo`'s pricing is now flagged as conflicting across
   snippets, not confirmed lower. Settled by Blueprint 3's real trial.
2. **Vendor cost at scale** — Part G5 gives the first real, dollar-anchored
   model: **~$90-180/mo daily, ~$2,160-4,320/mo hourly, plausibly
   $10,000-20,000+/mo for a realistic multi-page-per-store hourly crawl** —
   still **[inference]**, unmodeled against this repo's actual request
   volume. Settled by Blueprint 3.
3. **Refresh cadence we can honestly claim** — still open; Part G4
   reconfirms unchanged: zero competitors publish real cadence data anywhere.
   See Blueprint 6.
4. **Legal exposure, now for five scraped retailers plus DG's distinct
   sourcing risk** — still open as a written decision; Target's, Walmart's,
   and Best Buy's ToS all still unchecked. See Blueprint 4.
5. **Store-confirm layer reliability** — resolved for the free path across
   all five scanned retailers (Blueprint 2's problem is automation, not
   reliability); still open for the paid-vendor fallback path (Blueprint 3).
6. **DG and Costco submission cold-start** — will a catalog-free report flow
   get real submissions before either retailer has a large dedicated user
   base redirected to it? Cheap test in Blueprint 1: ship it, measure real
   submission rate over 1-2 weeks, before assuming either retailer's existing
   crowd (DG's incumbent FB/blog audiences, Costco's 1.4M-member group)
   transfers on its own.
7. **Is the HD markdown cadence actually compressing?** RESOLVED and reversed
   (F4): no — templated marketing copy, zero primary-source corroboration.
   HD's `.02/.03/.04` heuristic stands as-is.
8. **Is `scrapyspider/home-depot-clearance-scraper` actually a good pick, or
   actually abandoned?** Still open — this repo's own `.env.example`/
   `architecture-verdict.md` and the independent recon (Parts E1/G6, closely
   related actor) give directly conflicting signals. Only a real trial
   (Blueprint 3) settles it.
9. **Is Best Buy's browser-gateway crack durable, or does it need the
   official API as a safety net sooner rather than later?** New this pass —
   `bestbuy-gateway.ts`'s own docstring already frames itself as a stopgap;
   Blueprint 0 (get the free key) is the cheap, fast answer, not a research
   question.
