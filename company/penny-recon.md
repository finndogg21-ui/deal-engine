# Penny-Method Recon — technical & competitive survey

**Run date:** 2026-08-22, updated 2026-08-23 (scheduled recon, WebSearch only)
**2026-08-23 update note:** This pass targeted the five open questions left by
the 2026-08-22 run (Costco feasibility, Lowe's data method, Apify actor real
pricing/cadence, competitor changes) rather than re-doing the full survey.
New findings are appended as **Part D** and the Open Questions list below is
revised to reflect what got resolved vs. what's still open. Nothing in Parts
A–C below was found to be contradicted by this pass — see Part D for the one
material update to Part C's recommendation (Costco).
**Method note:** This research used ONLY web search (no site visits, no
network/API inspection, no logged-in access). Every claim below is tagged:
`[verified: 2+ independent sources]`, `[single source]`, or `[inference]`.
Marketing copy from a company about its own product is always labeled
**[claim]** — it is not treated as fact even when repeated on the
company's own multiple pages, since that's still one source (the company).
Any page text that appeared to be trying to direct behavior (rather than
describe the product) is flagged inline as a possible injection — none
was found this pass.

---

## Part A — Per-site two-lens findings

### 1. Hidden Clearances (hiddenclearances.com)

**A. Product/UX** — **[claim]** Free forever, no credit card. **[claim]**
Covers Amazon, Home Depot, Lowe's, Walmart, Costco, Target (7 retailers
counting variants) — breadth over depth. **[claim]** New Home Depot deals
"surfaced every minute." **[claim]** ZIP-code entry shows store locations,
stock counts, aisle detail. **[single source]** Domain is very
recent — under 6 months old per one WHOIS-based scam-check tool, which is
a leading indicator of an early-stage/unproven operation, not evidence of
fraud by itself.

**B. Tech/data-method** — **[claim]** "Scans 9,000+ stores and the
internet 24/7." **[single source, unclear which layer]** One
review-aggregator source describes it as "scans local retail store
inventory to identify clearance and pricing errors," but does not specify
whether this is a real per-store API call or an online-listing scrape.
**[claim]** Says it "tracks both online price drops and
community-verified in-store finds" — i.e., by its own description this is
a **hybrid**: automated online scraping + crowdsourced in-store
confirmation, not a pure per-store inventory API. No job postings, GitHub
repos, or engineering write-ups were found describing the actual scanning
stack — **[inference]** the "scans 9,000+ stores" language is very likely
describing an online catalog/listing sweep (which can enumerate every
store's *listed* data) rather than 9,000 independent live per-store hits,
because that volume at real-time cadence would be unusually expensive to
run for a free product with no visible funding signal.

### 2. Scavenger (scavenger.ai)

**A. Product/UX** — **[verified: 2+ sources]** $47/mo after a 3-day free
trial, billed through Whop (so statements show "Whop," not "Scavenger" —
a real, corroborated detail, not just their own copy). **[claim]** Free
ZIP-based preview scan, no signup. **[claim]** "Scouts local Home Depot
inventories 24/7." **[verified: 2+ sources]** Own legitimacy-defense blog
post explicitly states penny prices are "never guaranteed" and items can
be pulled at any time — i.e. **Scavenger's own language confirms it
surfaces leads, not confirmed purchasable penny prices.**

**B. Tech/data-method** — **[single source]** One market-snapshot note
(this repo's own prior blueprint pass) already flagged Scavenger as "the
one rival whose own copy explicitly claims automated inventory reads,"
naming a 25-mile radius, 24/7 claim. **[claim, unverified]** No public
engineering docs, job listings, or independent teardown were found this
pass confirming whether that's a genuine per-store API integration or a
scraper hitting the same public product-search endpoints everyone else
hits. **[verified: 2+ sources]** Multiple independent review/scam-check
sites (Scamadviser, Gridinsoft, Reddit-quoted complaints) report
cancellation friction and unresponsive support — this is a business-
operations signal, not a data-method signal, but it matters for our
competitive read: a $47/mo product with support complaints is a target
whose *retention*, not just its scanning, is weak.

### 3. Deal Soldier (dealsoldier.com)

**A. Product/UX** — **[verified: 2+ sources]** $44/mo after a 7-day free
trial (site itself states this; corroborated by a third-party "is it
legit" style review). Runs **inside Discord** — the app itself is a
community/bot layer bundled with reseller-education content, not a
standalone web/app product. Covers Home Depot, Lowe's, Walmart, Target.
**[claim]** "Penny SKU alerts pushed to your phone, sorted by ZIP code,
every day."

**B. Tech/data-method** — **[claim]** No independent technical detail
found on how Deal Soldier actually detects penny SKUs — its own copy
frames penny pricing correctly ("side effect of the standard markdown
cycle... same product can be penny at one store, full price at another,
same day") which shows *product knowledge* of the domain but is not
evidence of a specific scanning method. **[inference]** The Discord-
bot-plus-community-content packaging strongly suggests a
scrape-plus-human-report hybrid similar to Hidden Clearances/PennyCentral,
rather than a proprietary per-store live API — a pure API-driven service
would have less reason to lean on a community Discord as the delivery
mechanism.

### 4. Endless (endless.page)

**A. Product/UX** — **[claim]** Free public browse of Home Depot
clearance chain-wide, no account required. **[claim]** Paid plan from
$9.99/mo unlocks store-specific watch, title search, price-drop email
alerts, "penny-pricing predictions," multi-store watch, other retailers.
**[claim]** Also covers Nordstrom Rack and others (multi-retailer, not
Home-Depot-only).

**B. Tech/data-method** — **[claim, single source but specific]** States
it "scans Home Depot stores hourly across 1,990+ locations" and treats
"every scan [as] a fresh comparison against the last known price" —
this is the most *specific*, falsifiable technical claim of any
competitor researched (a named store count + named cadence). Still
**[claim]**, not independently verified — no third-party source
confirmed the 1,990-store figure or hourly cadence. Explicitly says Home
Depot "doesn't run a single dedicated clearance page" so it "indexes
markdowns as detected" — this describes an **online catalog/listing
diff-scrape** (compare price this scan vs. last scan), not a live
in-store inventory pull. Its "penny-pricing **predictions**" language (as
opposed to "live penny prices") is consistent with the industry-wide
pattern below (Part B, item 5): nobody claims to show a live $0.01 price
online, because that price doesn't exist online.

### 5. PennyCentral (pennycentral.com)

**A. Product/UX** — **[verified: 2+ sources]** Free, community-driven.
**[claim]** 140,000+ member base. **[claim]** Founder-led (Cade Allen),
grew out of a Facebook-group spreadsheet that was hard to use on mobile —
**[single source]** this origin story is corroborated only by the site's
own "about" page, so tag as company-told-history, not verified fact.
Searchable list filterable by state/date/SKU; "Report a Find" live
verification flow.

**B. Tech/data-method** — **[verified: 2+ sources across our own
prior research + this pass]** This is **100% crowdsourced human
reporting**, not an automated scan of any kind: "submit a find, added to
the list automatically... usually within 5 minutes... other members can
then check their local stores for the same item." There is no scanning
technology here at all — the "5 minute" freshness is human-typing speed,
not machine refresh cadence. This is the clearest, most literal example
of the "stale/community leads" category deal-engine is built to beat.

### 6. Rebel Savings

**A. Product/UX** — **[claim]** Free, no paywall. Covers Home Depot,
Lowe's, Walmart, Walgreens, Tractor Supply — five retailers. **[claim]**
Users can vote whether a markdown "still works" (community confirmation
layer). Monetized via affiliate links, not subscription — **[claim]**
"no brand pays to appear in the feed."

**B. Tech/data-method** — **[claim]** "Proprietary radar technology...
scans major retailers continuously," claims to surface markdowns
"often hours or even days before" human deal-hunters, and "usually before
[items] hit Slickdeals, Reddit, or Facebook groups." **[claim]** "Feed
comes from retailer pricing systems, not from advertisers" — this
phrasing implies an automated pull against retailer pricing data (i.e.
online listing price, likely via public search/category pages) rather
than a community-only model, **but** it also layers a community
vote-to-confirm mechanic on top, so — **[inference]** — like Hidden
Clearances, this reads as automated online price-scrape **plus**
crowd-verification, not a live per-store stock API.

### 7. BrickSeek

**A. Product/UX** — **[verified: 2+ sources]** Multi-retailer (Walmart,
Target, and others; not confirmed for Home Depot specifically in this
pass's sources) in-stock/price checker with a red/yellow/green stock
indicator and approximate quantity counts. Long-established, widely
covered in deal-blog roundups (Hip2Save etc.), unlike the newer penny-
specific sites above.

**B. Tech/data-method** — **[verified: 2+ sources]** "Pulls inventory
directly from retailer systems" — i.e., calls the retailer's own
store-locator/inventory endpoints rather than scraping rendered HTML
listings, which is the closest match in this survey to what we'd call a
genuine store-level inventory API integration. **[verified: 2+ sources]**
Explicitly documented limitations: real-time accuracy is not guaranteed,
exact-quantity counts aren't available for all retailers/items, and some
retailers only report data tied to *online order pickup* eligibility, not
true walk-in shelf stock. **[verified: single strong source, explicit
disclaimer]** BrickSeek itself states its API "should NOT be used in
stores to prove stock availability, quantity and/or price" — i.e. even
the most API-native tool in this space treats its own numbers as
directional leads, not proof, matching the penny-lead pattern in Part B.

### 8. Krazy Coupon Lady (KCL) — penny guides

**A. Product/UX** — **[claim]** Not a scanning tool at all; a
content/media site publishing "how to" guides (price-tag-ending
heuristics, item categories, timing advice). No app, no ZIP lookup, no
subscription.

**B. Tech/data-method** — **[verified: 2+ sources, consistent with other
guide sites]** Describes the ".02/.03/.04 tag-ending" heuristic and a
"~14 weeks from clearance date to penny" rule of thumb, explicitly caveated
as varying by store (some take 6–8 months). This is pure **domain
knowledge**, not a data feed — useful as a *signal/heuristic input* to a
prediction model, not as a source of live inventory truth.

### 9. Slickdeals Home Depot penny threads

**A. Product/UX** — **[verified: 2+ sources]** Long-running community
forum threads (e.g., a dedicated "$xx.06/$xx.03/1-cent" thread, a "Yellow
Clearance Tag Party" thread) where users post SKUs, tag photos, and store
numbers.

**B. Tech/data-method** — **[verified: 2+ sources]** 100% manual human
posting — no automation. Value is as an **independent ground-truth
corpus**: real people confirming real in-store penny finds with
photos/SKUs, useful for validating whether an automated prediction
actually converts to a real find, and for seeding a starter penny-SKU
list. Freshness is bounded by how often people happen to post, not a
refresh cadence.

### 10. The Garage Journal penny thread

**A. Product/UX** — **[verified: 2+ sources]** Similar long-running
forum thread pattern (2016, 2018, 2023 iterations), automotive/garage
hobbyist community, not resale-focused.

**B. Tech/data-method** — **[verified: 2+ sources]** Also 100% manual.
One notable, well-corroborated **[verified: 2+ sources]** detail: Home
Depot's official policy is that a penny item found and rung up is
supposed to be **destroyed or returned to vendor**, not sold — but many
stores sell it anyway at employee/manager discretion. Also surfaced:
**[single source]** a "generic clearance SKU" (0000-923-699) some stores
use to manually ring up $1.05 clearance items — a folklore-level detail,
worth noting as unverified operational trivia, not something to build on.

---

## Part B — Data-method deep dive

### 1. Home Depot GraphQL / store-specific pricing API

**[verified: 2+ sources]** Home Depot's storefront runs on a federated
GraphQL backend (`/federation-gateway/graphql`); pricing and inventory
are bound to a specific store ID, so the same SKU queried against two
stores returns two different prices/stock counts. **[single source,
technical/plausible]** Product results live under a
`data.searchModel.products` path in the response shape, per one
scraping-guide writeup. **[verified: 2+ sources]** Home Depot has **no
official public API** — every option is either (a) directly calling the
undocumented GraphQL endpoint yourself, or (b) a third-party layer that
already did that work (Unwrangle, SerpApi, Apify actors, BigBox API,
OpenWeb Ninja, Stevesie).

**[verified: 2+ sources]** Home Depot fronts this with **Akamai Bot
Manager**: TLS/JA3-JA4 fingerprinting plus a client-side-JS-gated `_abck`
cookie, meaning raw HTTP requests (no real browser) get blocked
regardless of IP reputation; workarounds commonly cited involve real
browser rendering + rotating residential IPs + stealth techniques.
**[verified: 2+ sources]** Home Depot's Terms of Use prohibit automated
data collection — so any direct-scrape approach (ours or a vendor's) is a
ToS violation regardless of technical feasibility; this is a legal/policy
exposure, not just an engineering cost.

**Practical implication for us:** the direct-GraphQL route is exactly
the same integration surface every "penny detection" Apify actor and API
vendor (Unwrangle, SerpApi, BigBox) has already built and is renting out
— none of them claim a special Home Depot partnership; they are all
running the same reverse-engineered endpoint behind their own
bot-mitigation layer. **[inference]** Paying one of these vendors buys
you their bot-mitigation engineering and their uptime SLA, not
fundamentally different data than direct scraping would get you.

### 2. Apify actors — pulsewatch/dealwatch-scraper and scrapyspider/home-depot-clearance-scraper

**[verified: primary source, Apify's own listing]** `pulsewatch/
dealwatch-scraper` is explicitly named and marketed as **"Home Depot &
Lowe's Price Tracker with Penny Detection API"** — real-time price
monitoring that "detects 30-90% off clearance, penny items (.02/.03 →
.01), and inventory drops," queryable by store ID or ZIP. **[verified:
primary source]** `scrapyspider/home-depot-clearance-scraper` scrapes
"all clearance and special buy products from any Home Depot store"
across "2,000+ clearance categories," output as clean JSON (name, price,
savings, ratings, availability). **[claim, from Apify marketplace
listings]** Typical run cost ~$0.50–$1.50 in Apify credits per full-store
scrape; **[inference]** at that unit cost, scanning a metro's worth of
stores (e.g. 5-15 stores in San Antonio, matching this repo's current
coverage) daily is inexpensive (~$2.50–$22.50/day), but scanning
hundreds/thousands of stores nationally for a future multi-metro
expansion would scale linearly and become a real per-scan cost line,
not a fixed cost.

**This repo's own architecture already made this exact choice.**
`src/vendors/README.md` documents Apify DealWatch as the **P0 daily
clearance sweep** vendor and Unwrangle as the **store-level stock/aisle/
discontinued-flag** vendor — i.e. deal-engine's existing design is
already the "online listing-diff scan (Apify) + store-specific
confirmation pass (Unwrangle)" hybrid this recon converges on
independently (see Part C). Both adapters are coded against a shared
contract but currently **NOT WIRED** (throw on missing API key) — this is
an integration/ops task, not an unsolved architecture question.

### 3. SerpApi / Stevesie / BigBox API / OpenWeb Ninja

**[verified: 2+ sources]** SerpApi offers a `home_depot` / `home_depot_
product` engine returning title, brand, price, price variations, and
(when a store ID/ZIP is supplied) store-localized price and inventory
level; 100 free searches/month, then paid tiers. **[verified: 1
source, corroborated by SerpApi's own docs describing the pass-through]**
Stevesie is a no-code wrapper that calls SerpApi on the user's behalf and
exports to CSV — i.e. it is not an independent data source, it's a UI
layer over SerpApi. **[claim]** BigBox API and OpenWeb Ninja market
similar store-localized product/pricing/inventory access. **[inference]**
All of these vendors are almost certainly hitting the same underlying
GraphQL surface described in item 1 above, differentiated mainly by
pricing model, output format, and how well they've solved Akamai
evasion — not by having a fundamentally different or more authoritative
data source.

### 4. Unwrangle (already in this repo's vendor list)

**[verified: 2+ sources]** Unwrangle's Home Depot Product API returns
list price, bulk pricing, discount detail, "enhanced inventory status,"
and supports store-number + ZIP combination for store-localized results,
at 1 credit/request. This matches exactly what `src/vendors/README.md`
already describes it being used for (store-level stock, aisle,
`discontinued` flag) — **[inference]** this recon did not surface any
reason to reconsider that existing vendor choice; it appears to be a
reasonable, already-correct pick for the store-confirmation layer.

### 5. VERIFYING the "$0.01 never shows online" claim

**[verified: 2+ independent, non-competitor sources]** This claim is
**TRUE and well-corroborated**, not merely a vendor talking point:
multiple independent writeups (Endless's own guide, PennyCentral's own
guide, and general "how penny items work" explainers) converge on the
same mechanism: the $0.01 price is a **register/POS-level, in-store-only
state**. Online, a store-localized listing for an item that has reached
penny status typically **stops showing $0.01** and instead reverts to
showing full retail price paired with an "Out of Stock" / "Unavailable" /
"Ship-to-Store-Only" status for that specific store — even though
physical units may still be on the shelf. Online inventory data also
commonly **lags the in-store reality by roughly a day or two.**

**This directly validates the "surface leads, verify in-store" model**
every competitor in Part A implicitly or explicitly uses (Scavenger's own
"never guaranteed" disclaimer; Endless's "penny-pricing **predictions**"
language, never "live penny price"; BrickSeek's explicit "do not use to
prove availability in stores" disclaimer). **No competitor researched
claims to show a live, confirmed $0.01 online price** — every one of them
is, by their own words, surfacing a probabilistic lead (reverted-price +
no-stock + late-stage tag-ending + old markdown date) that still requires
an in-store confirmation step. Any future deal-engine copy or UI that
implies "we show you the live penny price online" would be **factually
false** and should be avoided — the honest, differentiated claim is "we
show you the strongest, freshest, most specific *leads*, and we track
which ones a real member actually confirmed."

### 6. What makes stock-finding fast + accurate

**[verified: 2+ sources]** Consistent findings across BrickSeek, Endless,
and the GraphQL deep-dive: (a) **store-level API calls beat scraping
rendered pages** for structured, parseable data, but both ultimately hit
the same backend; (b) **refresh cadence is a stated differentiator**
competitors compete on (Endless claims hourly across ~1,990 stores;
Rebel Savings claims "often hours... before" competitors; Hidden
Clearances claims "every minute") but **none of these cadence claims were
independently verified** in this pass — treat all of them as **[claim]**
only; (c) **caching against last-known-price is the core mechanism**
every "scanner" actually uses — Endless explicitly describes "every scan
is a fresh comparison against the last known price," which is a diff-scan
pattern, not a continuous live feed. **[inference]** Given Akamai's
bot-mitigation cost/risk, the practical cadence ceiling for any scraping-
based approach (ours or theirs) is likely bounded more by
rate-limit/ban-avoidance economics than by genuine technical limits — i.e.
"scans every minute" for a free product is more likely marketing rounding
than a literal SLA.

### 7. Which categories actually make resellers money

**[claim, converging across multiple flip-guide sources — treat as
folk-consensus, not verified data]** Name-brand power tools/combo kits,
smart thermostats/cameras, name-brand faucets/fixtures (Moen, Delta,
Kohler), boxed ceiling fans, LED shop lights, and **mistinted/
discontinued paint** were repeatedly named as strong categories.
**[claim]** Oversized freight (vanities, doors, storm doors) was
repeatedly named as a category to *avoid* — shipping cost erases margin
unless sold locally, which is directly relevant to a hyper-local (San
Antonio-first) product like deal-engine, since local pickup removes that
constraint entirely and could be a genuine edge over nationally-focused
competitors. **[claim]** Power tools *themselves* (not accessories)
rarely reach penny status; hand tools, accessories, and end-of-season
seasonal goods (snow shovels, fans) do.

---

## Part C — BEST METHOD FOR US (ranked recommendation)

**Headline finding:** every competitor researched — free or paid,
scanner-branded or openly community-based — is running some version of
the same two-layer pattern: **(1) an automated or semi-automated sweep
over online listing/price data to generate candidate leads, plus (2) a
confirmation step** (community report, in-store visit, or a documented
"never guaranteed" disclaimer) **before the $0.01 price is treated as
real.** Nobody has a magic direct feed of live in-store penny prices —
because, per Part B.5, that data literally does not exist online. The
differentiator space is entirely in: which signals you combine to rank
candidates, how fast you refresh, how tightly you scope (metro vs.
national), and how honestly you label confidence — not in having some
undiscovered superior data source.

**Ranked recommendation, in priority order:**

1. **Keep and finish wiring the two-vendor architecture already designed
   in this repo** (`src/vendors/README.md`): Apify (DealWatch-style actor,
   matching the `pulsewatch/dealwatch-scraper` pattern) as the daily/
   frequent broad clearance-and-markdown sweep, generating price-drop and
   tag-ending candidates; Unwrangle for store-level stock/aisle/
   `discontinued`-flag confirmation once a candidate is flagged. This is
   already the correct shape per this recon — **the gap is operational
   (wire the API keys, run it), not architectural.** [inference, but
   directly grounded in Part B.2/B.4 findings + existing repo code]

2. **Build a scoring model on top of the sweep, not a single threshold.**
   Combine the signals independently corroborated across sources in Part
   B.5–B.6: (a) online listing reverted to full price + "Out of Stock"/
   "Unavailable" for that specific store, (b) late-stage clearance tag
   ending (.02/.03), (c) long dwell time since last markdown, (d) prior
   markdown-history depth. Multiple aligned signals = high-confidence
   lead, matching the "when all three align, very likely penny" pattern
   several independent guide sources described.

3. **Stay metro-scoped and lean into that as the honest differentiator**,
   rather than chasing the "we scan more stores/retailers" breadth
   race Hidden Clearances/Rebel Savings/Deal Soldier are already running
   (5-7 retailers, thin depth). deal-engine's existing per-store,
   timestamped, San-Antonio-first scan is a genuinely different claim
   from "9,000 stores, 24/7" marketing copy that no source could verify
   independently — and local-only fits the reseller economics finding in
   Part B.7 (oversized freight kills margin unless sold locally; a
   hyper-local buyer doesn't have that problem).

4. **Publicly surface freshness and confirmation-rate data, not raw
   scan claims.** This recon found **zero** independently-verified
   refresh-cadence numbers for any competitor — every "scans every
   minute" / "hourly across 1,990 stores" figure is self-reported and
   unverifiable from outside. A public, real "last scan: 47 min ago,
   confirmed-vs-flagged ratio: X%" widget (already proposed as Blueprint
   1 in `company/blueprints.md`) is something **no competitor in this
   survey can produce**, because it requires actually having the
   underlying scan-run data truthfully, not just claiming a cadence.
   This recon reinforces that blueprint rather than replacing it.

5. **Treat Slickdeals/Garage Journal/PennyCentral forums as a
   validation corpus, not a data source to build on.** Their value is:
   real people, real SKUs, real store numbers, with photos — useful
   for spot-checking whether the scoring model in #2 is actually
   converting to confirmed real-world finds, and possibly for seeding
   an initial penny-SKU-pattern list. Do not build the core pipeline
   around scraping/parsing these forums; they're unstructured,
   low-volume relative to the retailer's own listing data, and this
   recon found no evidence any well-funded competitor is doing so either.

6. **Do not represent any future feature as showing a "live" or
   "confirmed" penny price online.** Per Part B.5, this would be
   provably false and is exactly the gap between marketing copy and
   reality this recon exists to catch. The honest, buildable, and
   (per Part C's headline finding) genuinely differentiated claim is:
   *fast, frequent, per-store leads, ranked by a transparent multi-signal
   score, with an honest public freshness/confirmation-rate number* — not
   "we see the penny price before you do."

**Confidence on this synthesis as a whole:** [inference, built from
verified/single-source claims above] — the *pattern* (everyone does
lead-generation + confirmation, nobody has a live feed) is
well-supported across independent, non-competitor sources (BrickSeek's
own disclaimer, Endless's "predictions" language, Scavenger's "never
guaranteed" language, and the general penny-mechanism explainers). The
*ranking of what to build first* is this recon's own inference, weighted
toward what the existing `company/blueprints.md` and `src/vendors/`
architecture already have in flight, so BUILD isn't asked to discard
sunk work.

---

## Part D — 2026-08-23 update: closing (and reopening) the open questions

### D1. Costco feasibility — RESOLVED: much harder than Home Depot, different method entirely

**[verified: 2+ independent sources]** No official Costco API exists;
Costco.com is scrape-only, same as Home Depot/Lowe's, and also sits behind
**Akamai** bot protection **[verified: 2+ sources, vendor pages naming
Akamai directly]**. But the critical difference is upstream of scraping
difficulty: **[verified: 2+ independent, non-competitor sources]**
Costco's actual clearance signal — in-warehouse "manager markdowns"
(tags ending .97/.00) — is **warehouse-specific and does not reliably
appear on Costco.com at all**; the same item can be full price online and
marked down in a specific warehouse, and if it isn't listed online you
cannot see it there even if it's on the shelf. This is a structurally
different problem than Home Depot, where store-specific pricing *is*
exposed through the online catalog. **[single source, but mechanism-
consistent]** The one existing consumer tool found (CostLow: Warehouse
Clearance) works by **members photographing price tags in-store and
submitting them manually** — i.e. the working model in the wild is
crowdsourcing, not scraping. **[inference, absence-based]** No evidence
was found that any vendor (BigBox API/TrajectData, SerpApi, or others)
offers a Costco-specific pricing/inventory endpoint at all, unlike Home
Depot and Lowe's where multiple vendors compete.

**Action on Part C:** amend Recommendation #5 (and the paid-tier roadmap)
— **Costco should not be planned as a third scrape-vendor integration
alongside Home Depot/Lowe's.** If Costco ships at all, it needs its own
crowdsourced-report feature (closer to PennyCentral's model, Part A.5)
rather than the Apify/Unwrangle sweep-and-confirm pattern this recon
recommends for Home Depot and Lowe's. This is worth flagging before
Costco is promised on a pricing page.

### D2. Lowe's feasibility — RESOLVED: roughly as feasible as Home Depot, via the same vendor pattern, with two real gaps

**[verified: vendor's own docs, 2+ pages]** Unwrangle already sells a live
Lowe's Product/Search/Reviews API today ($99/mo+). **[verified: multiple
Apify listings]** Several Apify actors cover Lowe's, including one
(`pulsewatch`-style listing) explicitly marketed as **"Home Depot & Lowe's
Price Tracker with Penny Detection API"** — i.e. bundled HD+Lowe's penny
detection already exists as a product in the wild. **[verified: single
primary source, Lowe's own ToU]** Lowe's Terms of Use prohibit scraping,
comparable in strength to Home Depot's — same legal-exposure profile as
D-item below.

Two gaps vs. Home Depot: **[no public evidence found]** which bot-
mitigation vendor protects Lowes.com (unlike Home Depot's confirmed
Akamai) — unknown rigor, treat as at-least-as-hard until proven otherwise.
And **[single source]** Lowe's penny/clearance culture is real (~50%→75%→
90%→$0.01 markdown cascade over ~6 weeks, active Slickdeals threads) but
**thinner and less systematized** than Home Depot's — no confirmed public
tag-ending heuristic equivalent, and confirming true $0.01 status
reportedly needs an in-store scan rather than a shelf-tag read.

**Action on Part C:** Recommendation #1 (finish the Apify+Unwrangle
two-vendor architecture) extends cleanly to Lowe's — Unwrangle already has
a live Lowe's endpoint. But Recommendation #2's scoring model may need to
lean more on Unwrangle's normalized data and less on tag-ending heuristics
for Lowe's specifically, since that signal is less documented there.

### D3. Apify actor pricing/cadence — STILL OPEN, and one new diligence flag

**[no data found]** Real per-run/per-compute-unit pricing for either
named Apify actor could not be confirmed independently this pass —
search only resurfaces the same marketing-page figures already flagged
as unverified yesterday (the "$0.50–$1.50/store" number, and a
"$0.00005 per actor start" figure that reads like generic Apify
boilerplate, not an actor-specific cost). **[no data found]** No
real-world run-time, cost, or cadence case study (Reddit r/webscraping,
Apify community forum) was found for Home Depot scraping specifically —
this question cannot be closed via search; it requires an actual trial
run against the Apify actor's Pricing tab, which needs direct access this
recon method cannot provide.

**New flag:** **[single source, but specific and concerning]** search
results describing `pulsewatch/dealwatch-scraper`'s internals mentioned
"stores results in SQLite," "Telegram bot," and "run
`app/scripts/test_scraper.py`" — details that read like a hobby-grade
GitHub script wrapped as a paid Apify actor rather than a maintained,
production-grade scraping product. This could be a search-conflation
artifact, but it's specific enough to warrant real diligence (read actual
reviews/run-history on the Apify actor page directly, not just search
snippets) before this repo's vendor wiring (Recommendation #1) commits to
that specific actor over the alternative HD scrapers surfaced this pass
(`ecomscrape/homedepot-product-details-scraper`,
`scraptivo/homedepot-scraper`, and others — none confirmed
clearance/penny-specific, but worth a side-by-side trial).

### D4. Competitor landscape — no shutdowns; one funding data point; two new entrants; accuracy signal filled in

**[single source, PitchBook]** Scavenger.ai has reportedly raised $4.12M
across 13 investors — if accurate, this is a materially better-funded
competitor than yesterday's "no visible funding signal" inference
assumed; that inference in Part A.1/A.2 should be treated as **weakened**,
not confirmed wrong (still only one source). **[verified: 2+ independent
sources, new since yesterday]** Scavenger.ai's billing complaints
(trial-to-$47 conversion, cancellation difficulty) are corroborated
again by a second source (ScamAdviser, June 2026) — same pattern, more
confirmed. **[single source each, no shutdowns/major changes found]**
Hidden Clearances, Deal Soldier, Endless, and PennyCentral show no
material changes since yesterday.

**Accuracy signal (gap-filled from yesterday):** **[single source, but a
concrete complaint pattern]** Deal Soldier users report leads are "not
accurate a lot of the time," with in-store tags not matching what the
tool showed — this is the first direct evidence in this recon of a
named competitor's leads failing to convert in-store, and it validates
this doc's core thesis (Part B.5/Part C) that lead quality, not lead
volume, is the differentiator. Scavenger.ai's complaints, by contrast,
cluster on billing/cancellation, not lead accuracy — its underlying data
may be comparatively solid even though its business practices draw
criticism.

**New entrants found (not previously profiled):** RebelSavings.com/
rebelsavings.net (free, HD/Lowe's/Walmart/Walgreens, markets explicitly
against BrickSeek's paywall) — possibly the same operation as "Rebel
Savings" in Part A.6 under a different domain, not independently
resolved this pass, flag for a naming check. And a new iOS app, "Penny:
Deal Scanner & Alerts" (pennydeals.app), covering Home Depot with
aisle/bay location plus Dollar General/Dollar Tree/Family Dollar weekly
lists — worth a closer look next pass since aisle/bay-level detail is
a specific UX claim this recon hasn't seen matched elsewhere except
Hidden Clearances' [claim].

---

## Open questions for the 5AM blueprint run

1. ~~Vendor cost at scale~~ — **still unresolved after a second pass**
   (see D3): search cannot surface real Apify per-run economics. This
   needs a live trial run against the actual Apify Pricing tab (direct
   access, not search) before committing to scan cadence in the
   freshness-bar copy (Blueprint 1). Treat as blocked-on-direct-access,
   not blocked-on-more-research.
2. **New diligence item**: before wiring `pulsewatch/dealwatch-scraper`
   specifically (vs. an alternative HD scraper), verify it isn't a
   thin/hobby-grade wrapper (D3 flag) — check its actual Apify review
   history and run count directly.
3. **Refresh cadence we can honestly claim**: unchanged from yesterday —
   still no verifiable outside cadence numbers for any competitor to
   benchmark against; still depends on resolving #1 above.
4. **Legal exposure**: unchanged — Home Depot's and Lowe's ToS both
   prohibit automated collection (Part B.1, D2); still an accepted-risk
   decision this recon can flag but not resolve.
5. **Scoring model signals**: unchanged from yesterday — do Unwrangle/
   Apify's actual response payloads surface reverted-price,
   out-of-stock-for-store, tag-ending, dwell time, and markdown-history
   depth, or only a subset?
6. **Costco path — RESOLVED to a decision question**: not "is it
   feasible via scraping" (no, per D1) but "do we want to build a
   crowdsourced-report feature for Costco at all, and if so on what
   timeline relative to Lowe's" — this changes the paid-tier roadmap
   shape, not just its sequencing.
7. **Rebel Savings vs. RebelSavings.com/rebelsavings.net naming
   collision** (D4): confirm whether these are the same company before
   citing either in competitive copy.
