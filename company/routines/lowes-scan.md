---
name: lowes-scan
description: Lowes deal cycle - sweep the Back Aisle and all deal lists, units-guard, publish, re-check expired promos (4:37am and 4:37pm)
---

Run the Lowe's deal cycle for deal-engine. Repo C:\Users\12108\deal-engine, live site https://web-production-cc975.up.railway.app, prod DB via DATABASE_URL in the repo .env.

WHY THIS SHAPE. Lowe's prices are chain-wide (verified: identical price/qty/aisle across stores by path AND sn cookie), so ONE pricing read stands for every store — never sweep stores for a cheaper price, never claim per-store stock or aisle. Every Lowe's markdown carries savings.endDateTime, so these are DATED SALES: they churn fast and re-checking is as important as discovering.

1. DISCOVER (free, browser-only — Lowe's 403s servers). On a lowes.com tab in the Browser pane, sweep EVERY list in DEAL_LISTS from src/vendors/lowes-direct.ts (the real Back Aisle 2021454685607 plus deals/tools/lighting/appliances/patio/bathroom), ~10 pages each via ?offset=N (24 items/page), ~900ms pacing. Parse with the exact logic in scripts/lowes-sweep.browser.js — anchor on "finalPrice" (NEVER on /pd/ links near the top of the HTML: those are navigation and yield 0 hits), take the 10-DIGIT id from the /pd/ link behind each price (the 7-digit itemNumber 404s), title from the slug with decimals repaired.

   TRAP: a list's path text is cosmetic — only the numeric id routes. Verify any new list by its <title> tag (4294857977 says "Clearance" but is washing machines).

2. INGEST with the units guard — never bypass it. Write hits to sweep.json, then from the repo:
   DB_DRIVER=postgres npx tsx src/ingest/lowes-ingest.ts sweep.json
   The guard drops the per-carton vs per-sq-ft flooring trap ("$69.37 -> $3.69, 95% off" is NOT a discount — 83 of 140 hits in the first real sweep were this).

3. RE-CHECK what is already published — dated sales end daily. Get the token (see deal-verify-publish SKILL.md SETUP), then:
   curl -s "https://web-production-cc975.up.railway.app/api/admin/discovery/pending?n=25&retailer=lowes" -H "x-scan-token: <TOKEN>"
   The retailer=lowes filter is REQUIRED (the queue holds every retailer). For each item fetch /wpd/{id}/productdetail/1155/Guest/78232 in the browser: displayType "WAS" with basePrice>finalPrice is live (send price/list/discount); displayType "REGULAR" means the sale ended (send discount_pct 0); a 200 with NO pricingDataList means the item left the catalog (send reachable:false). POST verdicts to /api/admin/discovery/verdicts with retailer "lowes", store_id null, quantity null, clearance fields null.

RULES: never invent a price or count; touch only Lowe's rows; no deploys; budget $0. If every request 403s, check credentials:'include' first, then STOP and report rather than retrying into a block.

FINISH with a report: lists swept, items scanned, guard drops, published, rejected, expired, unreachable.