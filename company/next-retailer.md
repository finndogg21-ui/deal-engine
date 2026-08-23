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
