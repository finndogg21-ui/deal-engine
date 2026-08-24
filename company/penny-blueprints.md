# Penny-method blueprints — data-engine backlog

Maintained by the BLUEPRINTS sector. Scope: the DATA-METHOD and scan/score/
verify engine specifically (not marketing/UI copy — see `company/blueprints.md`
for that track). Built from `company/penny-recon.md` (2026-08-22 recon, Parts
D and E added 2026-08-23/24), `company/next-retailer.md` (2026-08-23, updated
same day with a Costco-vs-Walmart pass after Target and Lowe's shipped),
`company/lowes-cracked.md`, `company/target-cracked.md`, `company/
architecture-verdict.md`, plus a direct read of the current code and git
history — so this does not re-propose anything already shipped, already
resolved by a later recon pass, or already sitting unused in the repo. Open
GitHub PRs (#1–#4, all marketing/UI track, none touching the data-method
layer) were checked and don't overlap this file.

**Last pass:** 2026-08-24 (this pass). Previous pass: 2026-08-23.

**Product vision this backlog serves:** Home Depot penny deals = the free hook
for the RESELLING tier; the PAID tier later adds Lowe's + Costco.

**What changed since 2026-08-23, in one line:** Lowe's shipped — 45 deals
published — using the *exact same* manual browser-handoff pattern as Home
Depot and Target (a human drives a browser, drops JSON, a CLI script ingests
it). That's now three retailers proving the free method works and three
retailers running it by hand. `package.json` still has zero browser-automation
dependency. The gap this file has flagged for two passes running just tripled
in scope without getting any smaller.

---

## KEY STRATEGIC DECISION — which data method to run with

**Recommendation (unchanged in shape from the last two passes, now backed by
a third repeated proof rather than two): keep the two-layer hybrid — a broad
DISCOVERY sweep to generate candidates, plus a per-item CONFIRM call before
publishing a lead — but run the confirm layer, and increasingly discovery
too, through each retailer's own internal storefront endpoint called from a
real browser session, not through a paid store-specific-price-scan vendor and
not by building a penny-SKU corpus as the core method.**

**Why, plainly:** every retailer this project has actually inspected live —
Home Depot (`hd-direct.ts`), Target (`target-direct.ts`), Lowe's
(`lowes-direct.ts`) — turned out to expose real price and (for HD) real
per-store stock through its own undocumented internal API, reachable for **$0**
from a real browser session, refusing a server-side request with a 403/206.
That is now three-for-three, not two-for-two. Every paid vendor this recon
surveyed (Unwrangle, SerpApi, BigBox API, the Apify actors) is calling the
*same* underlying endpoints behind their own bot-mitigation layer — paying
them buys their bot-mitigation engineering, not a different or more
authoritative data source (`penny-recon.md` Part B.1–B.3). At this project's
current scale (one metro, three retailers), the free path has won every time
it's been tried head-to-head.

**Reject, explicitly, the other two options named in this pass's scope:**

- **A pure store-specific price-scan API, run at volume, as the primary
  method.** Rejected for the same structural reason both prior passes gave:
  you cannot query per-store stock for a SKU you don't already suspect is a
  candidate, so a confirm-only API without a discovery layer in front of it
  doesn't work. It's also the more expensive path — Unwrangle alone is
  $99/mo+ before a single request pays off, versus $0 for the browser-direct
  calls already proven working.
- **The current clearance-listing SCRAPE via a paid Apify actor, as the
  primary/only discovery method.** Rejected as the *sole* method, not as a
  concept — see the honest caveat below. The specific actor this repo's own
  `.env.example` was pointed at, `pulsewatch/dealwatch-scraper`, is now
  **[verified: Apify's own platform-reported usage stats, Part E1]** confirmed
  hobby-grade and effectively abandoned: 0.0/5 rating, 0 reviews, 313 total
  users but only **8 monthly active**, last modified 5 months ago, 73-day
  issue-response time, SQLite storage + a Telegram-bot delivery path + a
  `test_scraper.py` entry point in its own internals — this matches the
  first-hand fabrication incident this repo already caught from that same
  actor (`SAMPLE-SCREWDRIVER` rows, `looksFabricated()` guard). **Do not wire
  this actor.** No drop-in replacement was found either — `scrapyspider/
  home-depot-clearance-scraper`, `ecomscrape/homedepot-product-details-
  scraper`, and `scraptivo/homedepot-scraper` are all generic (not
  clearance/penny-specific) and all show 0.0/5 with 0 reviews. Recommendation:
  **do not commit spend to any Apify actor until a small paid side-by-side
  trial** (scrapyspider vs. one generic scraper) is run and compared, per
  `penny-recon.md` Part E1's own conclusion. This is a real gap — see
  Blueprint 3.
- **A penny-SKU crowdsourced corpus as the CORE method.** Rejected as the
  core method for the third pass running (recon Part A.5/A.9, Part C.5) — but
  **this is not a hole in the plan, it's already built as a supporting
  layer**: `community.ts` (PennyCentral/Slickdeals/RebelSavings ingest, public
  pages only) and `finds.ts` + `reputation.ts` (first-party, reputation-
  weighted "found it / not there" submissions, reciprocity-gated) are both
  shipped and running. Crowdsourcing is correctly used here as corroboration
  and ground truth, never as the primary discovery signal.

**The honest, load-bearing catch — stated plainly, not softened, for the
third pass running: nothing about this recommendation lets deal-engine read a
real $0.01 price from any public endpoint, HD/Target/Lowe's included.**
`penny-recon.md` Part B.5 remains true and was not contradicted again this
pass: the register-level $0.01 state does not exist online. HD's
`alternatePriceDisplay`, Target's per-store quantity, and Lowe's markdown
fields are all genuinely more than most competitors show — but they are
still leads (real price, real stock, real markdown depth), not confirmed
penny prices. Every "verified" claim this repo makes must keep saying that.
**This plan is lead-and-verify by construction; it does not, and structurally
cannot, promise a penny.**

**Honest tradeoffs, costs, and risks:**

1. **Akamai/bot-blocking is real for all three retailers now, not one.**
   HD (Akamai 206), Target (403 + captcha), and now Lowe's (403 server-side,
   verified in `lowes-cracked.md`) all reject a raw HTTP request and only
   answer a real browser session. The mitigation this repo has actually used
   so far — a human manually drives the browser and hands off JSON — works,
   but is not automation; see Blueprint 1.
2. **Cost genuinely does scale with store count for a broad SWEEP, not for
   the confirm call.** The Apify `$0.85/1k` figure in `.env.example` is still
   **[claim, vendor-reported, never independently measured by this repo]**.
   At current scope (~5 San Antonio HD stores) that's cheap; national scale
   would not be. The browser-direct confirm call has the opposite cost
   shape — it's not per-request-metered, but it needs somewhere to run a real
   headless browser on a schedule (~$5-20/mo of compute, realistically) and
   it trades a vendor SLA for engineering time when a retailer changes its
   endpoint or DOM with zero notice. That is a real cost, not a free lunch —
   just a different, currently cheaper one at this scale.
3. **Legal exposure now spans three retailers.** Home Depot's and Lowe's ToS
   both explicitly prohibit automated collection (`penny-recon.md` Part B.1,
   D2); Target's terms were flagged as unchecked last pass and are **still
   unchecked this pass** — an honest gap, not an assumed-safe one. No file in
   this repo makes an explicit, on-purpose, written risk-acceptance decision
   covering all three. See Blueprint 4.
4. **The $0.01-cannot-be-read-from-a-public-API limit is fully respected in
   the codebase and in this recommendation**, and nothing proposed below
   changes that. Every Lowe's row ships as a dated markdown, never as
   clearance, specifically because the code already treats "no penny field
   in the payload" as a labeling constraint, not a data problem to route
   around (`lowes-direct.ts`'s own header).

**Confidence:** the *shape* (sweep for discovery, browser-direct confirm
before trusting a lead, crowdsourcing as corroboration not core) is
well-supported and has now been independently reached by the recon (WebSearch
only) and proven three separate times by this repo's own first-hand browser
tests — two different methods converging on the same answer. The *specific
Apify actor pick* for the discovery sweep is still genuinely open (E1) and
should not be guessed at; it needs a real trial, not another recon pass.

---

## Already shipped in this domain — not re-proposed

- Two-vendor sweep+confirm architecture (`src/vendors/`, `README.md`).
- **Home Depot, Target, and Lowe's direct-confirm/discovery modules — all
  three individually verified live, all three still run by hand.**
  `hd-direct.ts`, `target-direct.ts`, `lowes-direct.ts` each document a
  real, browser-verified result at $0. `target-ingest.ts` and
  `lowes-ingest.ts` both take a browser-collected JSON file as a CLI argument
  and write it to the DB — **this is the actual shipping mechanism for two of
  three retailers today, and it is a manual handoff, not a scheduled job.**
  Lowe's specifically shipped 45 published deals this way, after two rounds
  of hardening (a units-guard that dropped 31 of the first 45 rows as
  per-sq-ft/per-carton pricing traps, then a slug-decimal repair for
  dimension strings) — the module is genuinely solid; it just isn't automated.
- **The report-and-confirm loop this pass's Costco/Walmart research
  recommends building — already fully built, for catalog items.**
  `src/api/routes/finds.ts` (`POST /api/finds`, reputation-weighted via
  `reputation.ts`, reciprocity-gated `GET /api/finds/verified`,
  `GET /api/me/spotter`) plus the `finds`/`spotter_stats` tables is a
  complete "found it / not there" submission-and-corroboration system,
  already live for Home Depot/Target/Lowe's. This is more built than
  `next-retailer.md`'s Costco recommendation assumed — see Blueprint 2 for
  the actual, narrower gap.
- Community third-party ingest (`community.ts`): PennyCentral, Slickdeals
  RSS, RebelSavings — public pages only, 1-2 polls/day, feeding
  `community_reports` as labeled hearsay, separate from `price_observations`.
- Multi-signal, replayable scoring model (`score.ts`), markdown-ladder/
  stockDivergence detection (`stages.ts`), fabrication guard
  (`looksFabricated()`), append-only `price_observations` + `scan_runs`,
  parallel-wave store verification (`verify-deals.ts` — still Unwrangle-only),
  spotter reputation/corroboration (`reputation.ts`), metro-scoped coverage
  gating (`coverage.ts`).
- On-demand async stock-lookup worker (`store-lookup-async.ts`).
- **Costco data-method question, resolved twice now (not built).**
  `penny-recon.md` Part D1 and `next-retailer.md`'s 2026-08-23 Costco/Walmart
  pass both independently conclude in-warehouse manager-markdown clearance is
  structurally invisible on costco.com. See "Decided, not building" below.

---

## Ranked backlog

### 1. Build the automation to run the $0 browser-direct handoff that's now shipped THREE times by hand
**status:** todo — top priority for the third pass running; scope grew, not
shrank
**problem:** `hd-direct.ts`, `target-direct.ts`, and `lowes-direct.ts` are
each individually, first-hand verified to return correct price (and, for HD,
stock) for $0. But the actual pipeline for all three is: a human opens a
browser, watches network traffic or runs a manual fetch, saves JSON, then
runs a CLI script (`lowes-ingest.ts <sweep.json>`, the equivalent for Target)
by hand. There is still no Playwright/Puppeteer dependency in `package.json`
(checked again this pass — unchanged), no scheduler, and no `npm run` script
for the Lowe's ingest path at all (only `scan`/`scan:dry` exist, both
Apify-only). Every "45 deals published" or "verified 2026-08-22" claim in this
repo describes a one-time manual session, not a running system. This is the
same finding as last pass's Blueprint 1, except it now covers three retailers
of manual toil instead of two, and Lowe's shipping this way proves the
process is repeatable by hand — which is exactly the argument for automating
it before a fourth retailer makes it worse.
**what to build:** a minimal headless-browser runner (Playwright is the
natural fit — nothing in `package.json` conflicts) that, on a schedule, loads
each retailer's storefront in a real browser context, calls the existing
`clearanceUrl()`/`detailUrl()`-style builders already written in each
`*-direct.ts` module for a batch of candidates, and writes results into the
same tables `verify-deals.ts` / `*-ingest.ts` already target. Treat every
failure as "unknown," never "no stock" — `hd-direct.ts`'s own header already
says this. Keep Unwrangle/Apify stock-lookup wired as a fallback, not
deleted (Blueprint 3).
**data-method:** cites `hd-direct.ts`, `target-cracked.md`, and
`lowes-cracked.md`'s three independently verified results, plus
`next-retailer.md`'s "two-for-two, do the browser test before paying"
conclusion — now three-for-three.
**why it beats today / beats Hidden Clearances:** turns three
manually-verified facts into one running, free, accurate pipeline — something
no competitor in `penny-recon.md`'s survey is documented doing (every one of
them scrapes listing pages or crowdsources; none showed evidence of a direct
internal-API browser call, let alone across three retailers). It also fixes
today's operational reality: shipping a retailer today means someone sits
down and drives a browser by hand, which does not scale past three and will
not survive anyone being unavailable.
**effort:** M-L — new infrastructure (a browser-automation dependency, a
scheduled runner, three existing modules to wire into it), unchanged from
last pass's estimate.
**cost:** no per-request API fee; realistic infra cost ~$5-20/mo for a small
scheduled headless-browser runtime — well under Unwrangle's $99/mo+ tier —
plus ongoing engineering time to notice and fix breakage when a retailer
changes its endpoint or DOM, which a paid vendor would otherwise absorb.
**success metric:** N consecutive days (recommend 7) of unattended, scheduled
calls against all three retailers' known candidates, spot-checked against a
manual check, feeding real rows into the DB — not another one-off manual
session, and not another "held back from the rail" commit.

### 2. Extend the finds/report-and-confirm loop to accept catalog-free submissions — the actual gap for Costco
**status:** todo — new this pass
**problem:** `next-retailer.md`'s Costco/Walmart research (2026-08-23)
recommends building "the shared report-and-confirm feature... aimed first at
Costco," reasoning that Costco's in-warehouse manager-markdown signal has no
online record at all (`penny-recon.md` Part D1) and so needs a crowdsourced
report loop as its *only* possible data method. That research did not have
visibility into this repo's own code. Checking it: **the report-and-confirm
loop already exists and is live** — `POST /api/finds`, reputation-weighting,
reciprocity-gated `GET /api/finds/verified`. The real gap is narrower and
specific: `finds.product_id` and `finds.store_id` are both `NOT NULL` foreign
keys into `products`/`stores` (`schema.sql` lines 82-114), which are
populated only by a retailer's scan/ingest pipeline. Costco has no scan
pipeline and never will (that's the whole finding), so there is no
`products`/`stores` row for a Costco item to attach a find to — a member
cannot submit a Costco report today even though the submission API itself is
done.
**what to build:** a narrow, catalog-free submission path — either (a) let
`POST /api/finds` accept a free-text title/brand/photo instead of a
`product_id` when `store_id` doesn't resolve to an existing store row
(auto-creating a minimal `products`/`stores` row on first submission, keyed
`costco:{warehouse-number}` per the existing `"{retailer}:{sku}"` convention
already used everywhere else), or (b) a small parallel table for
catalog-free reports that gets promoted into `products`/`stores` once a
second corroborating report lands. Reuse `reputation.ts`'s existing
corroboration logic either way — don't rebuild it.
**data-method:** cites `next-retailer.md`'s Costco/Walmart pass (2026-08-23),
the working precedent it names (CostLow: photo-and-manual-entry, no scraping
at all), and this repo's own `finds.ts`/`reputation.ts`.
**why it beats today / beats Hidden Clearances:** per `next-retailer.md`,
Costco pairs the largest verified demand figure found in the entire
competitor survey (Costco Finds Facebook group, **[verified: 2+ independent
sources]** ~1.4M members) with a $0 cost path — no vendor bill, because the
cost is engineering time on infrastructure this repo already built 90% of.
No competitor surveyed (Part C) publishes a transparent, reputation-weighted
confirmation loop at all; Costco would be the first retailer where that loop
*is* the entire product, which is a sharper, more honest claim than any
"9,000 stores, 24/7" scan marketing line.
**effort:** S — extends an existing, working system rather than building a
new one; the hard parts (auth, rate-limiting, reputation weighting,
reciprocity gating) are already done.
**cost:** $0 incremental — no vendor, no scraping surface, no bot-mitigation
risk, because there is nothing to scrape.
**success metric:** a real Costco submission accepted end-to-end (free-text
item, warehouse number, price) without an existing catalog row, visible in
`GET /api/finds/verified` once corroborated. **Honest caveat, cited directly
from `next-retailer.md`'s own open question #10:** whether this actually
gets submissions at a small user base before it has Costco's 1.4M-member
audience redirected to it is unproven — the recon's own proposed cheap test
is to launch this against HD/Target/Lowe's leads first (where it's already
live) and measure real submission rate over 1-2 weeks before deciding whether
Costco specifically is worth standing up as a submission-only retailer.
**Do this measurement before writing Costco marketing copy.**

### 3. Decide the discovery-sweep vendor for real, then turn the sweep on
**status:** todo — merges and updates last pass's Blueprints 2 and 3
**problem:** `APIFY_TOKEN` and `UNWRANGLE_KEY` are still both blank in
`.env.example` (checked again this pass). Outside manual test runs and the
three retailers' one-off manual handoffs, no real append-only price history
is accumulating anywhere; `coverage.ts` requires 14 days before scores mean
anything. Compounding this, the actor `.env.example` was implicitly pointed
at (`pulsewatch/dealwatch-scraper`) is now confirmed abandoned/hobby-grade
(Part E1, cited in the strategic decision above) — turning the sweep on
"as configured" today would mean paying for a dead actor, not a live one.
`probe-unwrangle.ts`'s header still documents three failed attempts plus a
fourth "Product not found" on a known-good item, with no run against a real,
funded key recorded anywhere in this repo.
**what to build:** two sequenced steps, not one. First, run a small paid
trial of `scrapyspider/home-depot-clearance-scraper` against at least one
generic scraper (`ecomscrape` or `scraptivo`), compare real output quality —
this cannot be resolved by more research, only by spending a few dollars and
looking at what comes back (Part E1's own conclusion). Second, once a
non-abandoned actor is picked (or the decision is "skip Apify, lean harder on
Blueprint 1's browser-direct discovery instead" — a real option now that
HD/Lowe's both expose free clearance-listing pages), run `probe:unwrangle`
and `probe:stock` once against the documented ground-truth item
(324308361 @ store 582) with real keys and record the dated result in this
file, wiring whichever works as a fallback behind Blueprint 1, not ahead of
it.
**data-method:** cites recon Part B.2/B.4/E1 and this repo's own unresolved
probe scripts.
**why it beats today / beats Hidden Clearances:** the actual moat — genuine
per-store timestamped history — only exists from the moment a real, working
sweep is actually running, on an actor that isn't already known-abandoned.
**effort:** M — a paid trial, a decision, then ops/monitoring for the first
two weeks watching for a repeat of the earlier fabrication incident.
**cost:** the Apify trial is a few dollars (per Part E1's pricing anchors:
`scraptivo` ~$15/1,000 products, `ecomscrape` ~$20/mo+usage — both **[claim,
vendor listing]**); the probe runs are under $5 total; ongoing sweep cost at
current San Antonio scope is low single-digit dollars/day per the
still-unverified $0.85/1k Apify figure.
**success metric:** a dated, written record in this file of which actor (if
any) was trialed and what it returned, followed by 14 consecutive real
`scan_runs` with zero fabrication flags and ≥1 row/store/day across all three
retailers; `coverage.ts`'s `scores_meaningful` flips true for San Antonio.

### 4. Put the legal/ToS risk decision in writing — now covering three retailers
**status:** todo — scope widened again this pass
**problem:** recon confirms Home Depot's and Lowe's ToS both prohibit
automated collection; Target's specific terms were flagged unchecked last
pass and remain unchecked this pass. No file in this repo makes an explicit,
on-purpose written decision about any of the three, despite all three now
being live, shipping data sources.
**what to build:** not code — a short, explicit written risk note covering
all three retailers now: who bears the exposure, what mitigates it (staying
low-volume/browser-direct rather than a broad self-built crawler, keeping
volume proportionate to a single metro, per-item confirm calls rather than
full-catalog scraping).
**data-method:** cites recon Part B.1, D2, and this pass's still-open
Target-ToS gap.
**why it beats today / beats Hidden Clearances:** doesn't beat anyone
technically — every competitor in this space carries identical exposure
silently. Writing it down converts an unmanaged risk into a managed one,
across three retailers instead of one.
**effort:** S (a decision and a paragraph).
**cost:** $0.
**success metric:** a dated, explicit risk-acceptance note exists, covering
Home Depot, Target, AND Lowe's; if Target's ToS still wasn't actually
checked, that's stated as an open item, not silently assumed either way.

### 5. Close the score-calibration loop against real finds, and re-check the tag-ending heuristic
**status:** todo — merges last pass's Blueprint 5 with a new signal-weighting
flag from Part E5
**problem:** `score.ts` says weights should be tuned against measured hit
rate, "never by feel" — real `finds` submissions now exist as a mechanism
(shipped) but not yet at volume, since the underlying scan pipelines
(Blueprint 1/3) aren't running unattended yet. Separately, `penny-recon.md`
Part E5 surfaces a **[2+ sources, same blog genre, not primary-verified]**
signal that Home Depot's markdown-to-penny cadence may be compressing
(~14 days vs. the previously-cited 9-14 weeks) and that tag-ending digits may
be getting less reliable relative to markdown-date/price-history signals —
worth checking against this project's own accumulating scan history rather
than trusting the blog claim, once real history exists.
**what to build:** once real `penny_candidate` alerts and `finds` submissions
exist at volume, run a periodic review of score vs. confirmed outcome and
adjust weights via `SCORE_VERSION` + replay; as part of that same review,
specifically check whether tag-ending-digit signals are still predictive on
this project's own data, rather than assuming Part E5's blog-sourced claim
either way.
**data-method:** cites `score.ts`'s own methodology, recon Part C.2, and
Part E5 (explicitly flagged there as a hypothesis to validate, not a
confirmed change).
**why it beats today / beats Hidden Clearances:** makes the product's
accuracy claim actually true over time, against real data, from a source no
competitor researched publishes or even claims to track.
**effort:** M, recurring; blocked on Blueprints 1 and 3 producing real data
at volume.
**cost:** $0.
**success metric:** a documented hit-rate figure after the first real
calibration pass, plus a written yes/no on whether the tag-ending signal is
holding up against this project's own history.

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
manually-faked timestamp.
**data-method:** cites recon Part C.4.
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
  independently twice now: `penny-recon.md` Part D1 (2026-08-23) and
  `next-retailer.md`'s Costco/Walmart pass (2026-08-23) both conclude
  in-warehouse manager-markdown clearance is structurally invisible on
  costco.com, not merely expensive to reach — no vendor at any price offers a
  Costco-specific pricing/inventory endpoint. **What Costco needs instead is
  the catalog-free extension to the existing report-and-confirm loop —
  Blueprint 2, above — not a scrape adapter.** Do not put Costco on a pricing
  page referencing "automated scanning" — it would be false per this recon.
- **Walmart — decided NOT next**, per `next-retailer.md`'s ranking, reaffirmed
  in the 2026-08-23 Costco/Walmart pass: dual Akamai+PerimeterX/HUMAN bot
  defense (9/10 difficulty), no vendor reaches the one signal that would
  matter (the in-app "Check a Price" scanner is not remotely callable, and no
  evidence was found that it writes a server-side record at all), and it's
  already the most saturated retailer in the entire competitor set (all seven
  `penny-recon.md` competitors already cover it). Re-open only if (a) a
  future pass finds a specific, named, working store-verification path, or
  (b) Blueprint 2's report-and-confirm extension ships and proves itself on
  Costco first — at which point Walmart becomes an easy second target for the
  same mechanism, per `next-retailer.md`'s own stated sequencing.

---

## Open questions carried forward, with current status

1. **Discovery-sweep vendor pick** — narrowed but not resolved this pass:
   the previously-assumed actor (`pulsewatch/dealwatch-scraper`) is now
   confirmed a bad pick (Part E1); no replacement has been trialed yet.
   Settled by Blueprint 3.
2. **Vendor cost at scale** — still open, still genuinely blocked on a real
   multi-day run against an actual Apify Pricing tab; settled by Blueprint 3.
3. **Refresh cadence we can honestly claim** — still open; `penny-recon.md`
   Part E3 hardens the case that no competitor anywhere publishes real
   cadence data, strengthening (not just reinforcing) the freshness-bar
   differentiator once Blueprint 1/3 make it true. See Blueprint 6.
4. **Legal exposure, now for three retailers** — still open as a written
   decision; Target's ToS specifically still unchecked. See Blueprint 4.
5. **Store-confirm layer reliability** — **resolved for the free path across
   all three retailers now** (Blueprint 1's problem is automation, not
   reliability); **still open for the paid-vendor fallback path**
   (Blueprint 3).
6. **Costco submission cold-start** — new this pass, from
   `next-retailer.md`'s own open question #10: will a catalog-free report
   flow get real submissions before Costco has a large dedicated user base?
   Cheap test proposed in Blueprint 2: measure real submission rate on the
   already-live HD/Target/Lowe's finds flow first.
7. **Is the HD markdown cadence actually compressing, and is the tag-ending
   heuristic weakening as a result?** New from Part E5, blog-genre-sourced
   only — check against this project's own scan history once it exists
   (Blueprint 5), not against the external blog claim.
