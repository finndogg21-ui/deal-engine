---
name: target-scan
description: "Target clearance cycle — sweep the clearance category, count shelves, publish what clears the floor"
---

Run the Target clearance cycle for deal-engine. Repo C:\Users\12108\deal-engine, live site https://web-production-cc975.up.railway.app, prod DB via DATABASE_URL in the repo .env.

## Why Target is not a copy of the Home Depot routine

This difference decides the whole shape of the job.

**Target sets clearance CHAIN-WIDE.** Measured 2026-08-23: three published clearance items priced identically at six stores across San Antonio, New York, Los Angeles, Chicago, Miami and Seattle — Stanley 30 oz $22.50/$45.49, Champion pants $20/$40, toy fridge $38.49/$69.99, all six the same. So DO NOT sweep stores hunting a cheaper price; there isn't one. One pricing store is enough, and a Target card must never say "As low as" — the price is simply the price.

Home Depot is the opposite (clearance set per store), which is why its routine sweeps many stores. Do not copy that here.

**What DOES vary at Target is QUANTITY.** That is the only reason to loop stores, and only to fill the ledger.

## Steps

1. **DISCOVER — free.** Target publishes its whole clearance category through the same public RedSky endpoint the website uses. Category id is `5q0ga` (found in the redirect metadata of a *failing* keyword search; undocumented).

   Run it in the Browser pane on a target.com page — Target answers a browser and refuses our server with 403 + captcha. Use the harness `scripts/target-sweep.browser.js` in the repo: read it, evaluate it with javascript_tool, then poll `window.__sweep` until `done`. It does discovery, store names and the per-store quantity pass in one go.

   TWO NON-NEGOTIABLES, both learned by getting them wrong:
   - every fetch needs `credentials: 'include'` — a plain cross-origin fetch omits cookies and RedSky answers 403. This is NOT a bot block and NOT a rate limit.
   - `include_sponsored=false` — true fails the entire response on the sponsored backend even when the organic results are fine.

   Pace ~600ms between calls. Run **120 pages (~2,880 items)** — the category
   held ~3,657 items when measured, and a 50-page pass was leaving most of it
   unseen. At 600ms spacing that is ~14 minutes of polite background fetching,
   still $0.

2. **FILTER to the tiered floor** (the harness already does this): under $50 needs 40%+, $50–99 needs 30%+, $100+ needs 25%+. Drop anything Target does not explicitly flag as clearance — a plain promo is not the in-store markdown this product is about.

3. **COUNT SHELVES** at the San Antonio stores, for the best items by ABSOLUTE saving (reg − current, the reseller's margin — not the percentage). The harness verifies the top 24.

   `NOT_SOLD_IN_STORE` is NOT zero stock — it means that store never carries the item. Never record it as 0; a store that could never have had one reading "0" is a different, false claim. An item no nearby store stocks is an ONLINE-ONLY clearance and must not publish: this product is about in-store finds.

4. **INGEST.** Write `window.__sweepResult()` to three JSON files, then:

   `DB_DRIVER=postgres npx tsx src/ingest/target-ingest.ts sweep.json stores.json facts.json`

   (Drop `DB_DRIVER=postgres` to write the local DB instead.) That module owns every DB write and runs verdicts through the same judge Home Depot uses, so nothing publishes that the server would not publish itself.

5. **RE-CHECK WHAT IS ALREADY PUBLISHED.** Discovery alone never revisits a
   live deal, so a Target row that ended or sold through would sit on the feed
   indefinitely. Ask for Target's own queue — the `retailer=target` filter is
   REQUIRED, because the queue returns every retailer and the Home Depot
   routine shares it:

   `curl -s "https://web-production-cc975.up.railway.app/api/admin/discovery/pending?n=25&retailer=target" -H "x-scan-token: <TOKEN>"`

   (Get the token the same way the Home Depot routine does — see its SKILL.md
   SETUP block.) Re-price those TCINs at the pricing store, refresh their shelf
   counts, and POST verdicts to /api/admin/discovery/verdicts. If any row comes
   back with retailer != "target", SKIP it — never send a verdict for a
   retailer you did not check.

6. **REPORT**: items scanned, items clearing the floor, published, rejected with the top reasons, re-checked, and anything that would not answer.

## Rules

- Never invent a Target price or a shelf count. A missing quantity is null, never 0.
- Touch only Target rows.
- No deploys. This is data only.
- Budget $0 — the whole cycle is public endpoints.
- If every RedSky call 403s, check `credentials: 'include'` first (almost always the cause), then STOP and report rather than retrying in a loop.
