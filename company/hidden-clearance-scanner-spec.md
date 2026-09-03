# HD In-Store (Hidden) Clearance Scanner — build spec

Status: **DIY automation is dead (8 configs), BUT a rented unlocker WORKS — proven live 2026-08-29.**
Scrapfly ASP returned **HTTP 200** on `/p/205794807` (the exact page Playwright got 403 on), full 771KB–814KB
render, `success:true`. Read primitive confirmed. Fork now: **spotters (discover, $0) + Scrapfly (read/verify
the store's markdown, ~$30/mo at volume, starts free).** Written 2026-08-29.

## PROVEN unlocker test (2026-08-29, Scrapfly free trial, ~55 of 1,000 free credits)
- **Akamai beaten.** `GET https://api.scrapfly.io/scrape?url=<hd /p/ url>&asp=true&country=us` → HD status **200**.
  With `render_js=true` = **30 credits**; **without render_js = 25 credits** and the pricing JSON is STILL present
  (HD server-renders the Apollo state), so we read cheaper without a browser.
- **Read primitive = parse embedded Apollo JSON**, no click needed: the page contains
  `pricing({"…","storeId":"NNNN"}):{"value":…,"original":…,"promotion":…,"message":…}`. Clearance populates
  `original`/`promotion` when the item is marked down at the localized store. (At the auto-localized store 8119
  the test item was full price $39.97, original:null — so no markdown there; that's expected, not a failure.)
- **STORE-CONTROL IS THE REAL WALL (the value is store-specific; you can't fake the store cheaply).** Hidden
  clearance only appears when localized to the exact store that has it. At the proxy-default store 8119 EVERY item
  reads full price / `original:null` — even Special-Values items — so we cannot dodge localization by picking
  "already-marked-down" items. Four cheap levers ALL failed (tested live 2026-08-29):
  1. Cookie `C4=0883` (the real crumb name) → Scrapfly **422** (C4 is an ENCODED crumb blob, not a raw store#).
  2. Cookie `THD_LOCSTORE=0883` → ignored (pricing stayed 8119).
  3. Scrapfly proxy geo → **country-level only** (25cr residential; no state/city) → random US store (Cumberland-121).
  4. URL `?store=0883` / `?storeId=0883` → ignored (pricing stayed 8119, no $4, no clearance).
  HD localizes ONLY through its real server-side set-store flow (IP-influenced + a properly-encoded C4 crumb).
  Forcing an ARBITRARY store therefore needs a v2 dig: **Scrapfly `session` + replay HD's actual "Set as My Store"
  request** (reverse-engineer that endpoint/payload so HD Set-Cookies the real crumb), then in-session product fetch.
  OR geo-exact residential exits near the store + solve Akamai ourselves (Hyper Solutions). Both are real work.

## Reframe: what ships without the store-RE (v1) vs what needs it (v2)
- **The read primitive is DONE + proven** (Scrapfly fetch → parse `pricing` JSON). It just reads the proxy-localized
  (random) store today — useful as the foundation, not yet for a chosen store.
- **v1 (ships now, $0, NEEDS NO store-control):** spotters submit the find (item, store#, price, aisle, photo) → we
  RANK by resale margin (eBay/Amazon comps) → publish. The spotter standing in the store IS the verification.
- **v2 (optional, the RE project):** automated re-verify/enrich a spotter's EXACT store via Scrapfly session +
  HD set-store replay. Only worth it if spotter volume justifies automation (economics: ~8k reads/mo at $30).
- Credits burned proving all this: ~⅓ of the 1,000 free Scrapfly credits (~665 left ≈ 26 reads).
- **Economics (concrete):** 25 credits/read. Scrapfly $30/mo Discovery = 200k credits ≈ **8,000 reads/mo (~267/day)**
  ≈ **~$3.75 per 1,000 HD reads**. Free tiers combined (Scrapfly 1k once + ScraperAPI 1k/mo + ZenRows 5k/mo, no card)
  ≈ ~7k free reads/mo → **$0 for early spotter-verify volume.** Brute-force discovery still unaffordable (item×store
  explodes); spotter-verify fits the cap. DISCOVERY (which items are on clearance) is UNCHANGED — unlocker solves the
  READ, not the FIND → spotters still essential.
- Scrapfly key: use inline (env `SCRAPFLY_KEY`) for tests, **never store it** (same rule as proxies/Railway token).
Scanner: `scripts/hd-clearance-scan.mjs` (Node + `playwright-extra`+stealth over `playwright-core`, drives
system Chrome via `channel:'chrome'`, routed through `HD_PROXY`). Modes: `--derisk` (self-test on the known
$4 spikes), `--items a,b,c --store SSSS`, `--crawl <HD category url> --store SSSS`. Executes end-to-end and
correctly detects blocks.

**DEFINITIVE derisk matrix (2026-08-29) — every combination = homepage 200, product `/p/` 403:**
Mac-IP headless/headful (no stealth); ISP-proxy headless/headful × stealth on/off; **residential-proxy
(ipfist rotating, fresh sid) headless AND headful + stealth**. The homepage always 200s (proxy + TLS fine,
lenient sensor); the product page always 403s. This ISOLATES the blocker as **Akamai's stricter product-page
sensor challenge, NOT IP reputation and NOT headless mode.** The earlier "clean residential IP is the fix"
hypothesis is **DISPROVEN** — residentials pass the homepage and still 403 the product page. The `_abck`
cookie from the homepage is never validated to the trusted state the protected `/p/` endpoint requires; our
Playwright-driven real Chrome (even headful + stealth + residential) fails the sensor. This is the
"HD needs a paid unlocker" wall, now empirically confirmed, not assumed.

**What actually read the $4:** the real in-app Claude-in-Chrome browser with a human-warmed session (validated
`_abck`) — the spec's "proven-but-slow path." That works one page at a time in the real browser; it is NOT a
headless farm and would hang the app under load (Finnley's standing "work conservatively" rule). Fit for
*verifying a submitted find*, not bulk discovery.

**FORK (awaiting Finnley):**
(A) **Paid Akamai unlocker** (BrightData Web Unlocker / ScraperAPI / Oxylabs / ZenRows) — solves `_abck` as a
service; drop-in for the READ primitive; most have free trials → ~20 min to know if it clears HD. Costs $
(verify current per-request pricing before committing; small scale may fit the ~$40/mo cap, scale will not).
(B) **Crowd-sourced spotters** ($0) — members submit finds; the real in-app browser verifies one at a time.
Sidesteps Akamai entirely. The original moat.
Do NOT keep tweaking DIY stealth/proxies — that axis is exhausted and proven dead.

## What is verified (proven live, extracted from the page myself)

- HD exposes **store-specific in-store clearance ONLINE and browser-readable** on the `/p/` page
  via a yellow CLEARANCE badge + "See In-Store Clearance Price" link.
- Proven example: Dimex Contractor Pack Nylon Spikes, **itemId 205794807**, at **Montgomery store 0883** =
  **$4.00, Save $35.97 (90% off $39.97)**, in-store location **Aisle 38, Bay EC3**, qty in stock,
  "while supplies last." Read straight from the page DOM.
- It is a **store-specific call through `/federation-gateway/graphql`, SEPARATE from the catalog
  price we already scrape.** The catalog `pricing.clearance` field read `null` at the same instant
  the page showed $4. Store is set by the `THD_LOCALIZER` / `THD_LOCSTORE` cookie.
- So: register-PENNY ($0.01) may still be register-only, but **deep in-store clearances ($4 / 90%) are
  online and readable in a browser session** (Akamai `_abck` cookie is satisfied in-session).

## Architecture (three parts)

1. **READ primitive** — given `(itemId, storeId)` → in-store clearance price or null.
   - Fast path: replay the `product` GraphQL op (name `product`, vars incl. itemId + storeId) against
     `/federation-gateway/graphql`. BLOCKER: HD sets the api-key / `x-experience-name` headers and the
     persisted-query sha256 hash dynamically (not in page source); must be captured from a live call,
     and Akamai must be satisfied. Not cracked yet.
   - Proven-but-slow path: browser-automate — set `THD_LOCSTORE` cookie to the target store, navigate to
     `/p/{itemId}`, let it render, extract the "See In-Store Clearance Price" value + aisle/bay/qty from
     the DOM. WORKS today (that is how the $4 was read). ~1 page-load per item.

2. **DISCOVERY** — which itemIds to check. **HARD PROBLEM #1.** There is NO public "list all clearance at
   store X" feed (only Special-Values, which is national promo, a different population). The in-store
   yellow-tag clearances are largely NOT in our Special-Values catalog. Options:
   - (a) **SKU enumeration**: crawl HD categories / enumerate Internet# ranges to build a broad seed list,
     then check each per store. Big, but bounded per category.
   - (b) **Crowd-source / spotter submissions**: users submit finds (already the planned moat). No scan.
   - (c) Third-party clearance lists (BrickSeek/HiddenClearance) — gray area, not $0.

3. **RANK + STORE** — dedupe, compute % off, rank by absolute savings + resale value, write to the pool
   with the in-store location (aisle/bay) and qty. (Resale-value ranking is the separate Keepa/eBay layer.)

## HARD PROBLEM #2 — Akamai at scale

Reading one item in a live browser session works. Grinding thousands of item×store checks server-side
hits HD's Akamai bot wall — the known constraint (a paid unlocker or a headless-browser + residential-
proxy farm is required for volume). This is the real cost, and it is what paid competitors monetize.

## On "just scan the biggest store"

Store size is a **minor** lever, not the unlock. You cannot scan a store directly (no feed); you check a
SKU list against it. A bigger / higher-traffic store stocks more of your list and has more clearance
events, so it yields somewhat more hits — but discovery (the seed list) and Akamai-at-scale are the real
levers, and both are store-agnostic. A nationwide "cheapest store per item" sweep would out-perform any
single store, at the cost of many more calls.

## Decision needed from Finnley before building for real

1. **Discovery approach:** enumerate SKUs (compute + Akamai cost) vs crowd-sourced spotters (no scan, but
   needs users) vs buy a data feed. This gates everything.
2. **Infra for scale:** accept a paid unlocker / proxy budget (fits the ≤~$40/mo cap only at small scale)
   or keep it browser-manual (tiny volume).

## Cheapest honest first milestone (buildable now, no unlocker)

A browser-automation PoC: hand a small seed list + a store, loop `/p/{itemId}` with the store cookie set,
extract clearance from the DOM, output the hits. Proves end-to-end value and measures hit-rate on a real
seed list — before spending on discovery + Akamai infra. Slow (browser-bound), but real and $0.
