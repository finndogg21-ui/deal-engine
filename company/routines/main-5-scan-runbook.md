# Deal-Engine — Main-5 Scan Runbook (real Chrome + CLI publish)

## THE ONE HARD RULE — why this exists
All 5 retailers BLOCK server-side requests AND automated browser panes
(Home Depot=Akamai, Target=403, Walmart=PerimeterX, Best Buy=gateway block).
Tested live: the sweep's POST to Best Buy's gateway fails ("Failed to fetch")
from an automated pane, exactly like a server. So the sweeps run ONLY in a
REAL Chrome window with a genuine session — paste the script into Chrome
DevTools console (F12) on the retailer's own site. The price is "real on their
website" because the script reads the retailer's OWN live gateway. Do NOT use
Claude's automated Browser pane — it's rejected like a server AND crashes the PC.

## PREREQS
- Repo github.com/finndogg21-ui/deal-engine, `npm install`, Node 20+.
- `.env` with DATABASE_URL (Neon prod) + SCAN_TRIGGER_TOKEN (+ APIFY_TOKEN /
  APIFY_ACTOR_ID for Home Depot). Publish to PROD by prefixing ingest with
  `DB_DRIVER=postgres`. Scan on ONE machine at a time. Never open PGlite while
  `npm run dev` runs.

## THE 4 BROWSER SWEEPS (Best Buy, Target, Lowe's, Walmart) — each $0
In a REAL Chrome window, per retailer:
1. Open the real site: bestbuy.com / target.com / lowes.com / walmart.com
2. F12 → Console. (If Chrome blocks paste, type `allow pasting` once.)
3. Paste the ENTIRE script: scripts/{bestbuy,target,lowes,walmart}-sweep.browser.js
   (each self-filters to floor-clearing markdowns + applies guards).
4. Wait for done: window.__bb.done / __sweep.done / __lowes.done / __wm.done
5. Download the JSON (swap accessor per retailer):
   (() => { const r = window.__bbResult(); // __sweepResult/__lowesResult/__wmResult
     const a=document.createElement('a');
     a.href=URL.createObjectURL(new Blob([r],{type:'application/json'}));
     a.download='bestbuy-sweep.json'; a.click(); })();
6. Publish (re-applies guards through the judge):
   DB_DRIVER=postgres npx tsx src/ingest/bestbuy-gateway-ingest.ts ~/Downloads/bestbuy-sweep.json
   DB_DRIVER=postgres npx tsx src/ingest/target-ingest.ts   ~/Downloads/target-sweep.json
   DB_DRIVER=postgres npx tsx src/ingest/lowes-ingest.ts    ~/Downloads/lowes-sweep.json
   DB_DRIVER=postgres npx tsx src/ingest/walmart-ingest.ts  ~/Downloads/walmart-sweep.json

## HOME DEPOT — different, costs money
Follow company/routines/deal-verify-publish.md (searchModel discovery →
productClientOnlyProduct verify across 11 stores). Verify needs real Chrome or
paid Unwrangle. NOT a $0 path — only run if you accept the cost.

## HONESTY GUARDS — never bypass
Floor: <$50 ≥40%, $50–99 ≥30%, $100+ ≥25%. Walmart first-party only (exact
walmart.com). Lowe's units guard. Best Buy new-condition only. >90% off =
data error → reject. Never fabricate a price; no real was-price → drop the row.

## VERIFY IT LANDED
curl -s "https://web-production-cc975.up.railway.app/api/deals/published?limit=3"

<!-- Accessors, ingest paths, floor, and CLIs verified against the code
     2026-08-27. Best Buy publishes through bestbuy-gateway-ingest.ts (reads
     skuId); bestbuy-ingest.ts is the older official-API path (reads sku) and
     does NOT match the browser sweep — do not use it for a sweep file. -->
