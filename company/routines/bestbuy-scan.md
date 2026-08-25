# Best Buy scan — outlet sweep + re-check

You are running the scheduled Best Buy scan for deal-engine
(C:\Users\12108\deal-engine). Work autonomously; do not wait for user input.

## Step 1 — sweep in the Browser pane

Open the Browser pane on https://www.bestbuy.com (any page), then execute the
ENTIRE contents of `scripts/bestbuy-sweep.browser.js` with javascript_tool.
It POSTs Best Buy's own gateway (PlpView_ProductList_Refresh, minimal query)
over two facet passes — Clearance flag (~37 pages) and 20%+ outlet discounts
(~49 pages before the server stops serving; known depth limit) — at 1.2s
pacing, ~86 calls total. It stops on the first non-200; never retry into a
block.

Poll `window.__bb.done` (a full run takes ~4 minutes). When done, read
`window.__bb` for the run stats.

## Step 2 — transfer the results

`window.__bb.hits` is ~1MB of JSON. Use the gzip transfer:

1. In the page: gzip + base64 the JSON (CompressionStream), store as
   `window.__x.b64`, compute per-60000-char checksums
   (`h = (h*31 + charCode) >>> 0`).
2. Return each 60000-char slice from javascript_tool — oversized results get
   saved to tool-result files automatically; pad the final slice with '@' to
   force the save.
3. In Python: read the files, strip the tool wrapper + padding, verify every
   checksum, base64-decode, gunzip, write `bb-sweep.json` to the scratchpad.
   If ANY checksum fails, re-pull that slice — never ingest a corrupt file.

## Step 3 — ingest to prod

```
cd C:\Users\12108\deal-engine
DB_DRIVER=postgres npx tsx src/ingest/bestbuy-gateway-ingest.ts <scratchpad>\bb-sweep.json
```

The guard re-runs at ingest (new-condition only, price/pct consistency, >90%
ceiling); everything publishes or rejects through the same judge as every
retailer. No store claims, ever.

## Step 4 — re-check what the sweep no longer sees

Published bestbuy rows that did NOT appear in this sweep have either ended or
moved. Ask the admin API (header `x-scan-token` from .env SCAN_TRIGGER_TOKEN):

```
GET https://web-production-cc975.up.railway.app/api/admin/discovery/pending?n=40&retailer=bestbuy
```

The `retailer=bestbuy` filter is REQUIRED — without it you get every
retailer's queue and would mark live foreign rows unreachable. Skip any row
that is not bestbuy. For each pending sku, re-query the gateway for that item
(searchpage `st=<sku>` search via the same minimal query with
`input.query = '<sku>'` and `queryType: 'SEARCH'`, no facets): still
discounted → leave as is; full price → verdict with discount 0 (judge
rejects it as ended); no answer → reachable:false. POST verdicts to
`/api/admin/discovery/verdicts`.

## Report

End with one line: calls made, docs scanned, rows kept, published/rejected
counts, and any block or checksum failure. Never invent a number — every
figure comes from the run.
