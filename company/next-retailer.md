# Next retailer after Home Depot — recon &amp; recommendation

**Run date:** 2026-08-23 (scheduled recon, WebSearch only, 4-agent parallel sweep).
**Method note:** Same tagging discipline as `penny-recon.md`: every claim is
`[verified: 2+ independent sources]`, `[single source]`, `[inference]`, or
`[claim]` (a vendor's own marketing about its own product — never treated as
fact even when repeated across that vendor's own pages, since that's still
one source). Nothing below was tested — no endpoint was called, no page was
loaded. Four independent research passes (one per retailer: Lowe's, Costco,
Walmart, Target) were run against the same four questions, then cross-checked
against this repo's actual code (`src/vendors/apify.ts`, `src/db/schema.sql`)
where a research claim touched something we could check directly.

**Headline recommendation: TARGET, then LOWE'S. Not Walmart. Not Costco (yet).**

**STATUS (2026-08-24): Target AND Lowe's have both shipped.** Target shipped
2026-08-23 (`company/target-cracked.md`, commits `a380682`/`2a51a05`) — RedSky
turned out to be **free**, not the ~$15-75/mo estimate below. Lowe's shipped
the same night (`company/lowes-cracked.md`, commits `915bc75` through
`c65edbd`/`bebd925` — endpoint cracked free, browser-only, 45 deals
published, a units-guard hardening pass applied after). **Three of the four
retailers this file was built to rank are now live: Home Depot, Target,
Lowe's.** The only two names left from the original scheduled-task scope
(LOWE'S, COSTCO, WALMART, TARGET) are **Costco and Walmart** — see the
**"2026-08-24 update — Costco vs. Walmart"** section near the bottom for the
current-dated recommendation between the two. The original four-retailer
analysis below is left intact as the historical record.

---

## The ranked recommendation

### 1st — Target

Cheapest and least-blocked path to something resembling Home Depot's win, on
paper. Target's internal API (`redsky.target.com`, "RedSky") is
**[verified: 2+ independent sources]** — multiple independent scraping guides
and a public GitHub gist all name it and describe the same GraphQL/REST
surface, and it is reported to answer over plain HTTPS **without** browser
rendering **[single source, treat cautiously — this is scraper-vendor
self-description]**, unlike Home Depot's Akamai-gated gateway which needed a
real browser. A public gist claims a real per-store numeric field —
`location_available_to_promise_quantity` — which would be the direct
structural analog to HD's shelf quantity **[single source, unconfirmed
elsewhere — this is the single most important fact to verify before
committing]**. Cheapest named vendor entry point found across all four
retailers: Traject Data's RedCircle API at **$15/mo**, same price floor as
the HD tool this team already knows (BigBox API). Demand is real (multiple
live Facebook clearance groups, an ecosystem of clearance blogs, and Target's
own public `/b/penny` merchandising category page confirming penny-tier
clearance is a retailer-recognized concept, not just HD/Dollar General
folklore) but is the **least quantified of the four** — no subreddit or hard
subscriber count was found. Competitively, Target sits in the middle: covered
by 3-4 of the 7 tracked competitors (not the near-total saturation Walmart
has), and one of them (Endless) is reported to already run live scanning
against it, so it is not open water either.

**The one real risk:** sources directly conflict on whether Target's public
data channel reflects the *true in-store shelf price*, or just online/pickup
pricing — a BrickSeek-sourced claim states "Target...share[s] pickup pricing
and online pricing but not in-store prices or counts," which contradicts the
gist's claim of a working per-store quantity field. This is exactly the
question that decides whether a Target module could inherit HD's
"verify-before-publish" architecture or would be reduced to guessing. Cheap
to settle (see Open Questions).

**No equivalent of `alternatePriceDisplay` was found for Target.** Absence of
evidence, not evidence of absence — but nobody has documented one.

### 2nd — Lowe's

The natural adjacency pick — same customer base as Home Depot (resellers
already flip both), a real, multi-sourced $0.01 penny-item culture
**[verified: 2+ sources — Slickdeals threads showing actual Lowe's items at
$0.01/$0.02, a dedicated Facebook group, and multiple existing tools built
around it]**, and it's the retailer most competitor products already bundle
alongside Home Depot rather than treat as a standalone build (Deal Soldier,
Rebel Savings, Endless all list it as one of a handful of core retailers).

**But it is confirmed more expensive than Target, not cheaper.** No source —
reverse-engineering write-up, GitHub repo, or scraper-vendor doc — pointed to
a $0 internal endpoint the way Home Depot's federation-gateway exists. Two
independent commercial scrapers, Bright Data and Oxylabs, **both** price
Lowe's at their premium "heavily protected" tier at an identical
**$2.50/1,000 requests** **[verified: 2+ independent sources agreeing on the
same number]**, versus their ~$0.50/1,000 standard-site rate — putting a
realistic HD-scale daily sweep in the **$225–$2,500+/month** range,
depending on SKU breadth. Nothing free was found.

**Important correction to a claim the research surfaced, checked directly
against this repo's own code:** one Apify actor, `pulsewatch/dealwatch-
scraper`, is explicitly marketed as a combined "Home Depot &amp; Lowe's Price
Tracker with Penny Detection API" and was flagged by the research pass as
potentially meaning Lowe's coverage is a marginal add-on to what we already
pay for. **This is wrong, and the record already exists in this repo:**
`src/vendors/apify.ts` lines 13-17 document that this exact actor was
**already evaluated and rejected** on 2026-08-16 for returning fabricated
rows (`"SAMPLE-SCREWDRIVER"`) — it is the same actor class that invented the
50%-off deals described in `penny-recon.md`. The actor we actually run,
`scrapyspider/home-depot-clearance-scraper`, is Home Depot-only. So Lowe's
candidate generation is **not** a free extension of existing spend; it is a
new vendor relationship, and the one vendor that claims to already solve it
is a documented fabricator in our own testing. No hidden-clearance API
field was found for Lowe's either, and the "0.06/.03 week-countdown" tag
convention — Home Depot's well-documented pattern — was **not** independently
corroborated for Lowe's; the one source found for it reads as content that
may be porting HD's known convention onto Lowe's rather than reporting an
independently observed Lowe's-specific code. Treat it as folklore, not
signal, until proven otherwise.

Demand is real but smaller and less centralized than HD's: a ~70k-member
Facebook group (single source, unverified count) versus PennyCentral's
claimed 140k-155k for HD alone.

### 3rd — Walmart (not recommended next, despite biggest raw demand)

Walmart has the largest apparent community (several Facebook groups, active
TikTok/Lemon8 hashtag ecosystem, decades of Slickdeals threads) and the
cheapest commodity scraping options (SerpApi from $25/mo, Unwrangle from
~$99/mo). **Reject anyway, for two structural reasons the research
surfaced:**

1. **The verification signal this whole architecture depends on appears to
   be physically gated, not remotely queryable.** Every source describing
   Walmart's "hidden clearance" mechanism describes it as visible only
   through the official app's barcode-scan "Check a Price" feature, which
   explicitly requires location services or in-store WiFi
   **[verified: 2+ independent sources — Krazy Coupon Lady, GOBankingRates]**.
   Home Depot's win was a boolean flag answerable for *any* item+store pair
   from outside the store. Walmart's equivalent, as documented, can only be
   answered by someone standing in the aisle. That collapses the exact
   thing that makes deal-engine different from a scraper-fed leads site.
2. **It is the single most saturated retailer in the entire tracked
   competitor set.** All seven previously-researched competitors already
   cover Walmart (`penny-recon.md`'s Hidden Clearances, Scavenger, Deal
   Soldier, Endless, PennyCentral, Rebel Savings, BrickSeek), several
   treating it as a bolt-on to an HD-first product rather than a specialty.
   There is no gap to win here the way there was with Home Depot's hidden-
   clearance flag.

Walmart also runs a harder bot-defense stack than any other retailer in this
comparison: Akamai **and** PerimeterX/HUMAN in series (one aggregator rates
it 9/10 scrape difficulty) **[verified: 2+ independent sources — spyderproxy,
scrapingbee, proxies.sx, thunderbit all describe the same dual-layer stack]**,
versus Home Depot's Akamai-only defense.

### 4th — Costco (not now; flag for a future paid-tier idea, not a build)

Costco has the strongest raw demand signal of the four — a single Facebook
group ("Costco Finds") reportedly at **1.4 million members**
**[single source, moderate confidence — an aggregator page, not the group's
own stats]** — and the .97-ending / asterisk-discontinuing clearance
convention is the most widely corroborated folklore of any retailer
researched **[verified: 2+ independent sources, arguably many more —
Consumer Reports, The Kitchn, Tasting Table, Cheapism, others]**. But it is
**structurally hard, not just expensive**: Costco's own customer-service FAQ
confirms costco.com and in-warehouse systems are not synced, that in-warehouse
clearance is in-store only, and that many items are warehouse-only with no
online listing at all **[verified: 2+ sources including Costco's own FAQ]**.
That means a large share of the real clearance events this product would
want to surface may have **no online item ID to attach a price/stock query
to in the first place** — a different failure mode than "the API is
expensive," and one no named vendor or competitor (including BrickSeek, the
best-in-class inventory-API player in this whole survey) is reported to have
solved. Membership-wall friction (non-members pay a 5% online surcharge, or
need a temporary Shop Card in-warehouse) adds real but secondary friction on
top. This is worth a from-scratch feasibility spike someday given the demand
size, but it should not be next.

---

## Monthly cost table (single-metro scale, ~5-15 stores, daily sweep — same scale as our current San Antonio HD operation)

| Retailer | Cheapest named path | Realistic $/mo at our scale | Free option found | Bot defense reported |
|---|---|---|---|---|
| **Home Depot** (baseline) | Own GraphQL, browser-only | **$0** (verify) + ~$10-15/mo (sweep, per `architecture-verdict.md`) | Yes — own endpoint, browser-reachable | Akamai (TLS/JA3, JS-gated cookie) |
| **Target** | RedCircle (Traject Data) | **~$15-75/mo** [inference from vendor unit prices; wide error bars since the underlying "is it store-accurate" question is unresolved] | None found | Unconfirmed/unknown — no source named a specific vendor on RedSky itself |
| **Lowe's** | Bright Data / Oxylabs, both $2.50/1,000 req | **~$225-2,500/mo** [inference, our own arithmetic on published unit rates] | None found | Unconfirmed vendor name; two independent scrapers both grade it "heavily protected" tier |
| **Walmart** | SerpApi from $25/mo; Unwrangle from ~$99/mo | **~$25-300/mo** for raw scraping — but the thing we'd actually need (remote store-verification) is not confirmed purchasable at any price | SerpApi free tier: 250 searches/mo | Akamai **+** PerimeterX/HUMAN (stacked, 9/10 difficulty) |
| **Costco** | Apify actors, low tens of $/mo for light volume; Unwrangle ~$70-99/mo (sources disagree even with each other) | **~$50-250/mo** for catalog scraping, but doesn't reach in-warehouse clearance at all per the online/in-store desync finding | None found | Weak signal only — one source claims Akamai, unconfirmed |

Every number above with an "$/mo" figure is **[inference]** built from
vendor-published *unit* prices, not a vendor quote at our actual volume —
none of these should be treated as a budget commitment until a real trial
run is priced, the same caveat `penny-recon.md`'s open questions already
raised for Apify/Home Depot.

---

## The module design plan (files, in this codebase)

The good news, checked directly against the repo rather than inferred from
outside research: **the data layer is already retailer-agnostic.** No schema
migration is required to add a second retailer.

- `src/db/schema.sql` — `products`, `stores`, `discovery`,
  `community_reports`, and `store_inventory` are all keyed on a `retailer`
  column already (`product_id = "{retailer}:{sku}"`,
  `store_id = "{retailer}:{store_number}"`); `discovery` and
  `community_reports` default to `'homedepot'` but accept anything. **No
  schema change needed to add Target or Lowe's.**
- `src/api/routes/nearby-deals.ts` and `finds.ts` already accept and filter
  on `?retailer=` and return it on every row. **No API change needed** to
  serve a second retailer's deals through the existing feed.
- `src/vendors/apify.ts` already has a stubbed `retailer?: 'homedepot' |
  'lowes'` option on `ApifyOptions` (line 34) — but it's a placeholder, not
  real support: the actor (`scrapyspider/home-depot-clearance-scraper`) is
  Home Depot-only, and product URLs are hardcoded to
  `https://www.homedepot.com${canonical}` (line 215). Adding a real second
  retailer means either finding a working actor for it, or a new adapter
  file entirely.

**What a new retailer module needs, mapped to existing patterns:**

1. **A new vendor adapter file** (`src/vendors/target.ts` or
   `src/vendors/lowes.ts`), following the existing `contracts.ts` shape
   (`DealEvent`, `StoreStock`) so nothing downstream needs to know which
   retailer it's looking at. Same `notWired()` pattern as every other
   adapter in `src/vendors/README.md` — throws loudly naming its env var
   until a real key is set, never silently returns `[]`.
2. **A direct-verify module**, the retailer's own `hd-direct.ts` equivalent
   (`target-direct.ts` / `lowes-direct.ts`) — this is the piece that decides
   whether this module can inherit deal-engine's actual differentiator or
   is reduced to "another scraper." For Target, this is the single open
   question (does `location_available_to_promise_quantity` really reflect
   store-shelf truth?). For Lowe's, no candidate field was found at all —
   this file may not be buildable yet, meaning a Lowe's module would launch
   *without* HD's core trust mechanism, publishing on tiered-discount-floor
   math and community confirmation alone (closer to what every existing
   Lowe's-covering competitor already does, which is not a differentiator).
3. **Extend `src/engine/discovery.ts`'s `HdVerdictInput`** (or a sibling
   type) to be retailer-shaped rather than HD-shaped — right now the field
   is literally named `alt_price_display` with Home Depot-specific
   documentation in its docstring (lines ~40-47). A second retailer needs
   this generalized to a named-per-retailer confidence signal, not
   necessarily the same field.
4. **`src/engine/deal-floor.ts` stays as-is** — the tiered discount floor
   (`<$50 needs 40%+`, `$50-99 needs 30%+`, `$100+ needs 25%+`) is already
   retailer-agnostic math; no research found a reason a second retailer
   needs different tiers, though this is worth revisiting once real
   Target/Lowe's price distributions are seen.
5. **Deal card copy, honestly stated per retailer:** for Target, if the
   quantity field is confirmed accurate, the card can say what HD's does now
   ("N in stock at &lt;store&gt;, confirmed &lt;time&gt;"). If it can't be confirmed
   remotely (Lowe's, absent a discovered hidden-clearance field; Walmart,
   confirmed physically-gated), the honest card is the same one every
   competitor in `penny-recon.md` already uses: "N reported · last seen
   &lt;time&gt; · confirm in store" — a lead, not a fact. **Never claim a live
   confirmed price we can't back with a store-level answer** — this is the
   exact gap between marketing and reality `penny-recon.md`'s Part B.5
   already found across the whole competitive set.

---

## What to build once, reuse for every future retailer

1. **A retailer-agnostic verify interface**, not another `hd-direct.ts`
   copy-paste. Define the contract once (`item+store -> {price, qty,
   confidence, source}`) and let each retailer's direct-verify module
   implement it. Right now `HdVerdictInput` in `discovery.ts` is literally
   HD-shaped (`alt_price_display`, HD-specific docstring) — generalizing
   this now, before the second retailer, is cheaper than retrofitting it
   after two retailers have grown around the HD-specific shape.
2. **A shared clearance-signal detector abstraction** — even where no
   retailer has an HD-equivalent boolean flag, every retailer researched has
   *some* combination of signals (price-ending patterns, dwell time since
   last markdown, reverted-to-full-price + no-stock-for-store). Build the
   multi-signal scoring model `penny-recon.md`'s Part C already recommended
   as a retailer-agnostic scorer that takes named signals as input, not
   hardcoded HD fields — so a retailer with weaker signals (Lowe's, no
   confirmed hidden-clearance field) still gets a confidence score, just a
   lower one, instead of needing a bespoke pipeline.
3. **Store-locator abstraction** — `src/geo/` and the ZIP-centroid /
   store-index pattern in `discovery.ts`'s `seedDiscovery` are already
   retailer-column-parameterized in the schema; formalize this as the
   pattern every new adapter plugs into rather than re-deriving per
   retailer.

**What the Home Depot build got wrong that should not repeat:**

- **It trusted a vendor's own retailer-coverage claim without checking our
  own prior evaluation record first.** This research pass itself made this
  exact mistake mid-run (see the Lowe's section above) before a direct
  repo-code check caught it. The lesson generalizes: before evaluating *any*
  new vendor for a new retailer, check `src/vendors/apify.ts` and
  `src/vendors/README.md`'s existing notes first — this repo already has
  hard-won, dated, verified-live evidence about which vendors fabricate,
  and cross-vendor marketing (one actor claiming multi-retailer coverage)
  is not evidence the coverage is real for either retailer.
- **The HD module wired its trust signal (`alternatePriceDisplay`) directly
  into the shared discovery engine's type instead of behind a retailer-
  neutral interface**, per point 1 above — worth a small refactor before
  the second retailer lands, not after.
- **Nothing here found a second retailer with as clean a $0 breakthrough as
  HD's.** Don't assume one exists — budget real vendor cost into the second
  retailer's plan from day one rather than discovering it the way the HD
  Apify sweep was discovered to be $40/mo of mostly junk.

---

## Open questions and the cheap test for each

1. **Does Target's RedSky `location_available_to_promise_quantity` field
   actually reflect true in-store shelf state, or only online/pickup
   availability?** Sources directly conflict on this (a public gist says
   yes; a BrickSeek-derived claim says Target doesn't share true in-store
   price/count through this channel). **Cheap test:** run the ~$2.50/1,000
   Apify RedSky-based actor (`elliotpadfield/target-scraper`) against a
   handful of known San Antonio Target stores for items with visible
   clearance tags, and cross-check the returned quantity against a manual
   in-store check — same validation method already proven out for
   Home Depot (`architecture-verdict.md`'s maplerope44 pilot). Costs under
   $5 to run.
2. **Is RedSky actually reachable without browser rendering, or does Target
   have undisclosed bot defense equivalent to Akamai?** No source named a
   specific bot-protection vendor for RedSky itself (unlike HD's
   well-documented Akamai). **Cheap test:** the same Apify trial run above
   will surface this immediately — if the actor's own docs admit having to
   "scrape a fresh key from public Target pages" (one source claims this),
   that's the tell that Target already rate-limits/rotates against exactly
   this kind of access.
3. **Does any Lowe's-specific hidden-clearance signal exist that this
   WebSearch-only pass simply couldn't find** (an API field, a documented
   price-ending convention specific to Lowe's rather than borrowed from HD
   folklore)? **Cheap test:** this needs actual network-traffic inspection
   (a real browser session against lowes.com's product page, watching for
   a field shaped like HD's `pricing.alternatePriceDisplay`), which is
   outside what WebSearch can do — flag as the literal next step if Lowe's
   is greenlit, same method that found HD's flag in the first place.
4. **What does a real Apify/vendor trial actually cost at our metro's
   volume**, for both Target and Lowe's? Every dollar figure in the cost
   table above is built from published *unit* prices, not a quote at real
   volume — this is the same caveat `penny-recon.md`'s open question #1
   already raised for the original Apify/HD choice and it was resolved by
   just running the trial; do the same here before committing spend.
5. **Is the 1.4M-member Costco Facebook-group figure and the Walmart
   500k-1M-member figures real, or aggregator-inflated?** Both came from a
   single, non-primary source in this pass. **Cheap test:** none available
   without direct page access (Facebook group member counts aren't
   independently indexed) — treat these numbers as directional only until
   someone with FB access can confirm; do not use them in external-facing
   copy or investor material as verified numbers.
6. **Would Target's or Lowe's price-ending folklore mislead a scoring
   model if built on unverified digit conventions?** Target's own
   spokesperson (via Clark.com) directly disputes that the terminal digit
   of a clearance price is meaningful at all, and sources disagree with
   each other on the exact Lowe's digit pattern. **Resolution:** do not
   build a digit-parsing heuristic into the scoring model for either
   retailer without first checking it against real, in-store-confirmed
   price photos (Slickdeals/community-report corpus, same validation
   pattern `penny-recon.md`'s Part C.5 already proposed for HD).

---

## 2026-08-23 update — Target shipped; what's next (Lowe's, ranked over Walmart and Costco)

This section is a second, same-day pass, run after Target was already built
and after `penny-recon.md`'s own Part D update (2026-08-23) independently
resolved two of the three remaining open questions below. Rather than
re-answering "which retailer after Home Depot" (already moot — Target
shipped), this asks the live question: **of Lowe's, Walmart, and Costco,
which is next?**

**Recommendation: Lowe's.** Ranked reasoning:

1. **Lowe's is the only one of the three with a resolved, bounded cost path
   today.** `penny-recon.md` Part D2 **[verified: vendor's own docs]**
   confirms Unwrangle sells a live Lowe's Product/Search/Reviews API right
   now, credit-metered (**$10-99 per 100,000 credits**, plans from
   **$99/mo** **[verified: 2+ independent sources — Datarade, Unwrangle's
   own docs, cross-checked this pass]**), and rates the underlying
   feasibility "roughly as feasible as Home Depot" via the same
   scrape-plus-verify pattern this repo already runs. Costco's equivalent
   question is **closed negative** (Part D1: no vendor found, warehouse
   markdowns largely invisible online — this isn't a cost problem, it's a
   data-doesn't-exist-online problem). Walmart's cost floor is unclear in
   the other direction: cheap raw scraping exists (SerpApi from $25/mo) but
   the one thing that would matter — a remote store-verification signal —
   is not confirmed purchasable at any price (unchanged from the original
   analysis below).
2. **A new, targeted search this pass found no consumer storefront API for
   Lowe's with a name — the same negative result as two prior passes.** HD's
   internal API has a name (`federation-gateway`) and so does Target's
   (`RedSky`); both turned up specifically and repeatedly in search results.
   Lowe's did not, across three independent research passes now (the
   original pass below, `penny-recon.md` Part D2, and this pass). **[single
   source, new this pass]** A Lowe's-branded developer portal does exist
   (`developer.lowes.com`, built on Azure API Management) — but it sits
   alongside Lowe's Vendor Gateway / EDI trading-partner integration
   references in the same search results, which reads as a **B2B
   supplier/vendor portal** (order management, catalog submission — the
   companies that *sell to* Lowe's), not a consumer product-price lookup
   API. **[inference]** Treat this as almost certainly the wrong door, not
   a free win — but cheap to rule out for certain (see Open Questions).
3. **The one method that has now worked twice — a live browser session
   against the storefront, not WebSearch — has never been tried on Lowe's.**
   Home Depot's `federation-gateway` and Target's RedSky were both
   ultimately confirmed by loading the real site in a browser and watching
   network traffic (`architecture-verdict.md`'s pilot; `target-cracked.md`),
   not by search. WebSearch alone would have under-priced both of those
   builds (this file's own original Target estimate — $15-75/mo — was wrong
   in the cheap direction; Target turned out to be free). **[inference]**
   Two-for-two on retailers actually inspected live vs. zero-for-two on
   retailers only WebSearched suggests the next cheapest test for Lowe's is
   the same live-browser check, before assuming the $99+/mo Unwrangle path
   is the floor.
4. **Walmart and Costco are re-confirmed unchanged, not re-opened.** A
   fresh check this pass re-confirms Walmart's dual-layer bot defense
   (Akamai **+** PerimeterX/HUMAN, still 9/10-rated **[verified: 2+
   independent sources, current]**) and that its Marketplace API is
   seller-gated — approved sellers can query only their own listings, not
   the broader catalog **[single source, this pass]** — which still
   collapses the "remote store-verification" requirement the way the
   original analysis found. Costco's warehouse-clearance-not-online problem
   (Part D1) is a data-availability gap no vendor spend fixes; it remains a
   crowdsourced-report feature idea, not a scrape-module candidate, and
   should stay off the "next retailer module" list even though it has the
   single largest raw demand signal of the four retailers researched
   (1.4M-member Facebook group, unverified single source).

**Updated ranking for "what's next": Lowe's, then Walmart, then Costco
(Costco arguably shouldn't be ranked in this list at all — see above).**

### New open question this pass

7. **Is `developer.lowes.com` (Azure APIM) actually a supplier/EDI portal,
   or does it also expose a consumer product-price/inventory API?**
   **[inference, unconfirmed]** — the surrounding search results (Vendor
   Gateway, EDI trading-partner pages) point strongly to B2B, but this
   wasn't directly confirmed either way. **Cheap test:** load
   `developer.lowes.com`'s API catalog page in a browser (or ask a person
   with access to check) and read the actual API list — this resolves in
   minutes and costs nothing; do it before assuming Lowe's has zero
   named-endpoint option.
8. **Does lowes.com's storefront actually call an internal GraphQL/REST
   endpoint the way Home Depot and Target both do?** Unconfirmed by
   WebSearch across three passes now, but WebSearch also missed HD's and
   Target's real endpoints until someone loaded the site in a browser.
   **Cheap test:** the same live-browser network-tab check that cracked HD
   (`architecture-verdict.md`) and Target (`target-cracked.md`) — open a
   product page on lowes.com, watch the network tab for a price/stock call,
   check for a `mixed_current_price_type`/`alternatePriceDisplay`-style
   clearance-signal field. This is the single highest-leverage next test in
   this whole document: if it hits, Lowe's could be free like HD and Target
   instead of $99+/mo.

---

## Confidence on this synthesis

**Moderate.** The four parallel research passes converged independently on
the same structural finding — no retailer researched has as clean a $0,
remotely-queryable, store-authoritative verification signal as Home Depot's
`alternatePriceDisplay` + federation-gateway combination — which is
reassuring since it wasn't a shared assumption baked into all four prompts,
it fell out of each pass's own search results. The ranking of Target above
Lowe's rests on real, if thin, evidence (a documented field name, a cheaper
vendor entry price) rather than pure inference, but the single fact that
would most change this recommendation — whether RedSky's quantity field is
real — remains unverified and is flagged as the first thing to test, not
assumed. The Lowe's-actor correction (catching that `pulsewatch/dealwatch-
scraper` is a documented fabricator, not free bonus Lowe's coverage) is the
kind of error this whole recon process exists to catch, and it only
surfaced because the recommendation was cross-checked against this repo's
own code rather than taken at the research pass's word — the same discipline
`penny-recon.md` and `architecture-verdict.md` already established should be
applied to every claim in this space, including our own.

---

## 2026-08-24 update — Costco vs. Walmart (the only two names left)

**Method note:** WebSearch-only, run against a live repo where Home Depot,
Target, and Lowe's are already shipped (verified via `git log` and
`src/vendors/` — `hd-direct.ts`, `target-direct.ts`, `lowes-direct.ts` all
exist). No endpoint was called, no page was loaded, no browser session was
run — same discipline as every prior pass. This section answers the
scheduled task's original four-way question narrowed to the two names not
yet resolved by that shipped work.

### Headline: neither Costco nor Walmart has Home Depot/Target/Lowe's shape. Recommend Costco — but as a new module *type* (crowdsourced report), not a fourth scrape adapter.

The pattern that made HD, Target, and Lowe's cheap wins — a storefront
endpoint that answers with a genuine per-store price/stock signal, reachable
free from a browser — **does not exist for either remaining retailer**, for
two different reasons:

- **Walmart's hidden-clearance signal is physically gated to a device
  standing in the store**, not a server-queryable field at all.
  **[verified: 2+ independent sources, converging on the same mechanism —
  GOBankingRates, Krazy Coupon Lady, ConsumerAffairs]**: the "Check a Price"
  in-app scanner requires either device location services or an in-store
  WiFi connection, and it is *that scan* — not the product page — which
  sometimes returns a lower price than the shelf tag. **[inference]** This
  means even a perfect, free Walmart scraper would return the same *online
  listing* price every paid vendor already sells — it would not reach the
  in-app hidden-clearance signal at all, because that signal is bound to a
  physical scan event, not an endpoint. This is the same physically-gated
  finding the 2026-08-23 pass already made; this pass re-confirmed it
  in-app (not just app-review-derived) and found no update to it.
- **Costco's in-warehouse manager-markdown signal mostly never reaches
  Costco.com at all** — unchanged from `penny-recon.md` Part D1
  **[verified: 2+ sources including Costco's own customer-service FAQ]** —
  and this pass found no new vendor or endpoint that changes that. Both
  Bright Data and Oxylabs will scrape Costco.com's *online catalog* (Bright
  Data confirmed at its premium **$2.50/1,000 requests** tier, same rate as
  Lowe's **[verified: 2+ sources, Bright Data's and a comparison blog's own
  published rate]**), but that only reaches what's listed online — the thing
  we'd actually want (the .97/asterisk in-warehouse markdown) mostly isn't
  there to scrape.

**So this is not "which retailer is cheaper to scrape" — it's "which
retailer's real signal can be reached at all, and how."** For Walmart, the
signal is trapped on a shopper's phone in the aisle. For Costco, the signal
is trapped on a physical price tag with no online record. **Both require a
human standing in front of the item** — which is exactly the mechanism
`architecture-verdict.md` already named as a first-class, free asset
("keep the Found-it/Not-there loop — free ground truth") and exactly what
the working precedent in the wild (CostLow) already proves converts to a
real, engaged user base at Costco specifically.

### 1. Cost to find deals

| Retailer | Named vendor path | Real $/mo at our scale | Free option | Bot defense | Does it reach the real signal? |
|---|---|---|---|---|---|
| **Walmart** | Traject Data BlueCart (from **$15/mo**, vendor's own price [claim]); SerpApi Walmart engine (store_id-scoped price/availability fields, confirmed in SerpApi's own docs [verified]); Unwrangle Walmart Product Data API (**2.5 credits/request**, plans $10-99/100k credits [verified: vendor docs + Datarade]) | **~$15-99/mo** for online-listing scraping | **None** for store-level data — the free in-app "Check a Price" scanner is not remotely callable | **PerimeterX confirmed** [verified: 2+ sources — scrapingdog's own docs describe clearing "PerimeterX press-and-hold challenges"; prior pass independently found Akamai+PerimeterX/HUMAN stacked, 9/10 difficulty] | **No** — every vendor above returns the same online listing price; none reach the in-app scan signal |
| **Costco** | Bright Data / Oxylabs, both premium-tier scraping (**$2.50/1,000 req**, Bright Data confirmed) | **~$50-250/mo** [inference, same arithmetic as the Lowe's estimate] for online catalog only | **None** for warehouse markdown data at any price | Reported Akamai, **[single source, unconfirmed]** — unchanged from prior pass | **No** — the manager-markdown signal is largely not listed online to scrape in the first place |

**Flag:** neither retailer has a free option, unlike HD/Target/Lowe's. This
is a structural change from the last three modules, not a vendor-shopping
problem a cheaper plan fixes.

### 2. Module design

**Walmart**, if built as a conventional adapter (`src/vendors/walmart.ts` /
`walmart-direct.ts` following the `contracts.ts` shape), would be honest
only as "leads from online listing price drops" — the same
lead-not-fact framing every non-HD/Target/Lowe's competitor already uses
(`penny-recon.md` Part B.5). **No equivalent of Target's
`mixed_current_price_type` or HD's `alternatePriceDisplay` was found for
Walmart's product-page API** — only the physically-gated app scan carries
that signal. Price-ending folklore is **mixed, not confirmed**
**[inference from directly conflicting sources]** — Krazy Coupon Lady/The US
Sun call the ".00 means extra discount" idea a myth, while other sources
(mysavings.com, Yahoo) say a `.00`/`.01` ending signals the final markdown
floor; treat as unverified, same caution `next-retailer.md`'s original pass
already applied to Target/Lowe's digit lore. **Do not build a Walmart
digit-parsing heuristic without in-store photo validation first.**

**Costco** cannot be a scrape+verify adapter at all — there is no per-store
API surface to verify against, so `costco-direct.ts` in the HD/Target/Lowe's
sense isn't buildable. The only working precedent in this space (CostLow)
confirms the real architecture: **a crowdsourced report-and-confirm
feature**, warehouse-scoped, price-tag-photo or manual-entry driven, with
push alerts to members watching that warehouse. The .97 / .00 / .88 /
asterisk convention is now **[verified: 2+ independent, converging sources
this pass — costlowapp.com, retailshout.com, thrifle.com, and
mojosalesandbranding.com all describe the same four codes the same way]**,
though still folklore in the sense that **[single source, explicitly stated
by one of those same guide sites]** "Costco has never published these
codes" — treat the convention as strong, repeated crowd-knowledge, not a
company-confirmed spec, and validate it against real submitted photos before
scoring on it.

**What this means for `src/engine/discovery.ts`:** a Costco module is the
first real test of the "retailer-agnostic verify interface" and "shared
clearance-signal detector" both prior passes already flagged as the thing to
build once. Costco has *no* remote signal at all — its whole confidence
score would come from a human report — which is the low-confidence end of
exactly the scoring spectrum `penny-recon.md` Part C already designed for.
Building the report-and-confirm feature for Costco is also, directly, the
same "Found-it/Not-there loop" `architecture-verdict.md` already recommended
building as free ground truth for HD/Target/Lowe's penny leads — **it is not
a Costco-only feature**, it is shared infrastructure that happens to be
*required*, not optional, for Costco to exist at all.

### 3. Demand

**Costco has the single largest demand number found across every retailer
researched in this file, HD included.** The "Costco Finds" Facebook group is
now **[verified: 2+ independent sources this pass — a LinkedIn post citing
membership directly, and a Yahoo/AOL syndicated article — both converge on
1.4 million members]**, upgrading the prior pass's single-source tag on the
same figure. CostLow's own feature set (receipt-scan price-adjustment
tracking, a submission leaderboard, push alerts per warehouse) is real,
shipped evidence that people will actively participate in exactly the
report-and-confirm loop a Costco module would need — this is a proof of
mechanism, not just a demand number.

**Walmart's demand is real but still unquantified** — a second, more
targeted search pass for subreddit/community subscriber counts again found
**no hard numbers** **[no data found, two independent attempts across two
passes now]**, only qualitative claims ("thousands of customers... sharing
daily" **[claim, unquantified, GOBankingRates]**). Combined with the
already-established finding that Walmart is the most saturated retailer in
the entire tracked competitor set (all seven `penny-recon.md` competitors
already cover it), the demand case for Walmart is "large but already served
everywhere," not "large and open."

**Demand-to-cost ratio: Costco wins clearly.** Costco pairs the largest
verified demand number in this whole document with a $0 cost path (the
report-and-confirm feature has no per-request vendor bill — its cost is
engineering time, not a monthly data bill). Walmart pairs merely-large,
unquantified, saturated demand with a real **$15-99/mo** vendor bill that
buys a signal we already know doesn't reach the differentiator.

### 4. What makes this module faster/better, and what not to repeat

- **Build the report-and-confirm feature as shared infrastructure, not a
  Costco-only screen.** A generic `community_reports`-backed "Found it /
  Not there" flow (the table already exists per `src/db/schema.sql`,
  retailer-keyed) that Costco *requires* to exist at all is the same
  free-ground-truth loop `architecture-verdict.md` already wants for
  HD/Target/Lowe's. Building it Costco-first forces it to be good enough to
  be a primary data source, not a nice-to-have overlay — a higher bar that
  benefits every other retailer once it's built.
- **Do not repeat the Home Depot build's mistake of trusting a vendor's own
  coverage claim without checking cost against what the signal actually
  is.** Applied here: a Bright Data or Oxylabs Costco/Walmart scrape *looks*
  like the same shape as the Lowe's win (a $2.50/1,000-req premium tier) —
  but unlike Lowe's, where the scraped endpoint at least returns real
  markdown data (`penny-recon.md`/`lowes-cracked.md`), paying that same rate
  for Costco or Walmart buys online listing data that structurally cannot
  carry the clearance signal we need. Same vendor price, very different
  value — don't let the familiar cost anchor imply a familiar payoff.
- **Do not build a Costco or Walmart price-ending scoring heuristic before
  validating it against real submitted photos/scans** — both retailers'
  digit conventions are folklore-level (Costco: repeated-but-unpublished;
  Walmart: directly disputed across sources) in a way HD's
  `alternatePriceDisplay` never was (that one was a real API field, not
  lore).

### Recommendation

**Build the crowdsourced report-and-confirm feature next, aimed first at
Costco.** This is the honest framing: it is not "add Costco the way we added
Lowe's," because that path doesn't exist. It is "build the shared
confirmation-loop infrastructure the architecture already called for, and
ship its first real use case against the retailer with the best
demand-to-cost ratio in this whole survey." Walmart should stay off the
build list — not forever, but until either (a) a cheap way is found to tie
the in-app scan signal to something server-reachable (no evidence found this
pass that one exists), or (b) the report-and-confirm feature is live and
proven, at which point Walmart becomes a second, easy target for the same
mechanism (it has no worse a claim to the report-and-confirm model than
Costco does — it just has a less differentiated demand case to justify going
first).

### Open questions and the cheap test for each

9. **Does Walmart's in-app "Check a Price" scan write anything to a
   server-side record we could ever legally/technically read** (e.g. does
   scanning create a queryable event, the way a receipt upload does for
   CostLow)? **[no data found]** — nothing in this pass suggests it does;
   the feature reads as a local, ephemeral price-check, not a submission.
   **Cheap test:** none available without an actual in-app session and,
   likely, Walmart engineering documentation this recon method cannot reach
   — treat as closed-negative unless someone with app access reports
   otherwise.
10. **Would a Costco report-and-confirm feature actually get submissions at
    launch, or does it need the 1.4M-member Facebook group's existing
    behavior redirected to it (a cold-start problem)?** **[inference]**
    CostLow proves the mechanism works generally, but says nothing about
    whether a brand-new, small-user-base version of it gets enough
    submissions to be useful in, e.g., San Antonio specifically before it
    has a Costco-sized user base. **Cheap test:** ship the feature scoped
    to HD/Target/Lowe's penny leads first (where it's a confirmation
    overlay on top of an already-working feed, so zero submissions is still
    a functioning product), measure real submission rate over 1-2 weeks,
    then decide whether that rate justifies standing up Costco as a
    submission-only retailer before it has its own feed.
11. **Is the Costco .97/.00/.88/asterisk convention actually reliable
    enough to auto-score, or only useful as free-text guidance shown to a
    human submitter?** **[inference]** Four independent guide sites
    converging on the same codes is a stronger signal than the disputed
    Walmart digit lore, but "widely repeated" and "verified against real
    receipts" are different claims. **Cheap test:** once the report feature
    has even a handful of real Costco submissions, check whether the
    submitted price actually matches the code convention before building
    any auto-scoring on top of it — same validation discipline the original
    Part C.5 proposed for HD tag-endings.
12. **Bot-defense vendor on Costco.com** — still **[single source,
    unconfirmed]** whether it's genuinely Akamai. Doesn't block the
    recommendation above (a report-and-confirm feature doesn't scrape
    Costco.com at all), but matters if a future online-listing discovery
    layer is ever added on top. **Cheap test:** a single browser page-load
    against costco.com watching response headers/challenge behavior would
    settle this in minutes — same low-cost check every previous "cracked"
    doc in this repo used, just not yet run here.

---

## 2026-08-24 late update — EMPIRICAL PROBE of the two rejects (browser pane, $0)

The 08-24 verdicts above were WebSearch-derived. Tonight both were probed the
same way Lowe's was cracked — live, in the browser pane, at zero cost. One
verdict survives, one is half-overturned.

### Walmart — HALF-OVERTURNED. Standard clearance is free and structured.

Measured on walmart.com, no block, no press-and-hold, ~10 requests clean:

- `/shop/deals/clearance` serves a **1.5MB `__NEXT_DATA__` with 692 products**:
  `linePrice` / `wasPrice` / `savingsAmt`, an explicit `flag: "Clearance"`
  (45 of 71 items on page 1), `availabilityStatusV2`, per-item `storeId`.
- A product page carries an explicit **`"clearance": true` boolean** plus
  structured current/was prices ($14.00 -> $7.00) — and is store-contextual
  (`storeId: 1198, city: San Antonio`, auto-selected from location).
- **THE MARKETPLACE TRAP, measured:** only **6 of 71** items on the clearance
  browse are sold by Walmart itself; the rest are third-party listings with
  inflated was-prices (a "$199.99 -> $24" smartwatch, 88% off, from
  "Frontier of technology"). `sellerName` exists on every item, so the guard
  is one filter: **first-party only, or the feed is fake-discount soup.**
  First-party yield is real: Scoop jeans $29 -> $12.99 (55%), Reebok $14 -> $7.

What REMAINS true from the research: the in-app "hidden clearance" price is
physically gated to a device in the store (mechanism-verified) — that part is
not reachable and we will not claim it. Per-store QUANTITY was not found in the
payloads probed (no availableQuantity field surfaced). And the clean run was
~10 requests — Walmart's Akamai+PerimeterX stack has not been tested at sweep
volume [flag: small sample].

**Revised Walmart verdict: BUILDABLE FREE** as "Walmart-sold clearance
markdowns, national catalog, store-contextual" — same browser-harness shape as
the other three. Our edge is the floor + seller guard + one cross-retailer
feed, not exclusivity: this data is on walmart.com for anyone. The gated
in-app price stays out of scope, honestly.

### Costco — VERDICT SURVIVES the probe.

costco.com loads unblocked, and the "warehouse savings" surface is real —
but what it carries is the **monthly coupon book**: "$4 OFF / $3 OFF / $2 OFF"
on CPG (measured: 12 tiles, $2.50-$25.50 prices, validity dates). These are
member deals, not the .97/asterisk manager markdowns resellers hunt, and
virtually none would clear the price-tiered floor. The reseller-grade signal
still never reaches the site. Crowdsourced report-and-confirm remains the only
honest Costco route.

---

## 2026-08-25 update — CLOSING STATUS: the four-way question is fully resolved

**Method note:** verified directly against this repo's own git history and
current code (`git log`, `src/vendors/`, `src/db/schema.sql`,
`src/ingest/community.ts`, `src/api/routes/`) — not a new WebSearch pass.
Nothing new was found to research; this section exists to record that the
scheduled task's original scope is done, and to name the one piece of
follow-through work still outstanding.

**All three named scrape-adapter retailers have shipped, in this order:**

| Retailer | Shipped | Commit | Cost |
|---|---|---|---|
| Home Depot (baseline) | pre-existing | — | ~$10-15/mo (`architecture-verdict.md`) |
| Target | 2026-08-23 | `a380682`/`2a51a05` | **$0** — RedSky, free |
| Lowe's | 2026-08-23/24 | `915bc75`...`c65edbd`/`bebd925` | **$0** — endpoint cracked free, browser-only |
| Walmart | 2026-08-24 | `f7810fd` | **$0** — `/shop/deals/clearance` `__NEXT_DATA__`, browser-only, first-party-seller-only |

`src/vendors/` confirms all four adapters exist today: `hd-direct.ts`,
`target-direct.ts`, `lowes-direct.ts`, `walmart-direct.ts`. **[verified:
direct repo inspection]**

**Costco was correctly never built as a fifth scrape adapter** — the
2026-08-24 conclusion above (in-warehouse manager markdowns mostly never
reach costco.com; the empirical browser probe found only the monthly member
coupon book, not resale-grade clearance) stands unchanged and is not
contradicted by anything in `penny-recon.md` Part F (2026-08-25), which
targeted unrelated open questions (Lowe's bot vendor, Apify actor diligence,
competitor funding claims) and found nothing that touches the Costco
decision.

**The one piece of unfinished, actionable work this whole recon thread
pointed at: the Costco crowdsourced report-and-confirm feature has not been
built.** Checked directly: `src/ingest/community.ts` and
`src/api/routes/community-deals.ts` implement a real `community_reports`
pipeline, but it is a one-way **ingest from public pages** (PennyCentral,
Slickdeals, RebelSavings) scoped to Home Depot penny/clearance leads — it is
not the in-app, photo-or-manual-entry, per-warehouse **user submission** flow
the Costco recommendation above actually requires (the CostLow-style
mechanism). The `community_reports` table is retailer-keyed already (per
`src/db/schema.sql`), so the schema doesn't block this — the submission UI
and endpoint don't exist yet.

**Recommendation for whoever picks this up next:** stop re-running the
"which retailer next" question — it's answered and the codebase confirms it.
If Costco demand still looks worth it (1.4M-member Facebook group, largest
raw number in this whole document, `[single source, moderate confidence]`
per the original section above), the next concrete step is a small,
scoped build: a `Found it / Not there`-style submission form against the
existing `community_reports` table, gated to Costco, before any larger
Costco-specific investment. That is a build task, not a research task — this
recon method (WebSearch-only) has nothing further to add to it.
