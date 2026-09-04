/**
 * Amazon resale comps — ingest frame.
 *
 *   npm run amazon:comps          # no-op until a source is wired
 *
 * Fills discovery.amazon_price / amazon_url / amazon_checked_at for published
 * deals, so a markdown becomes a known margin instead of a guess. The frame
 * runs today and says exactly why it is idle; the fetch is one function.
 *
 * Source candidates (researched 2026-09-03, in preference order):
 *   1. Keepa (src/vendors/keepa.ts) — retroactive price history, no cold
 *      start. EUR49/mo entry tier [forum-sourced, VERIFY ON SIGNUP] — over the
 *      $50 data cap alone, so this waits for consumer-tier revenue.
 *   2. RetailerAPI MCP (github.com/retailerapi/mcp) — free 1,000 lookups/mo
 *      [repo existence unverified — check before wiring]. Enough to comp the
 *      top ~30 deals daily as an enrichment layer.
 *
 * Constitution rule 7: no guessed numbers. Until a real source responds, every
 * amazon_price stays NULL and the UI shows nothing — never an estimated comp.
 */

import { getDb } from '../db/client.js';
import { keepaReady } from '../vendors/keepa.js';

/** How many top deals get a comp per run once a source is live. */
const COMP_BUDGET = Number(process.env.AMAZON_COMP_BUDGET ?? 30);

async function main() {
  const db = await getDb();

  if (!keepaReady()) {
    const { rows } = await db.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM discovery WHERE status = 'published' AND amazon_price IS NULL`,
    );
    console.log(
      `amazon-comps: idle (no source wired — set KEEPA_KEY or wire RetailerAPI). ` +
      `${rows[0]?.n ?? 0} published deals awaiting a comp; budget ${COMP_BUDGET}/run when live.`,
    );
    return;
  }

  // ---- REAL COMP FETCH GOES HERE (keepa.priceHistory per SKU->ASIN match,
  //      newest published deals first, COMP_BUDGET per run) ----
  console.log('amazon-comps: source wired but fetch not implemented yet — see keepa.ts');
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
