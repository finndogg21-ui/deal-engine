/**
 * Walmart ingest — turn a browser-collected clearance sweep into pool rows.
 *
 * Same handoff as Target and Lowe's: the browser agent fetches (Walmart is
 * browser-only for us), drops JSON here, and this module owns every DB write
 * through the same judge the other retailers use.
 *
 * WALMART ROWS ARE MARKDOWNS with Walmart's own Clearance badge behind them.
 * They publish with NO store claims: the in-app hidden price is physically
 * gated (never reachable), and no per-store quantity surfaced in any payload
 * probed — so store_id and quantity stay null and the ledger stays empty.
 *
 * THE GUARD RUNS AGAIN AT INGEST. The harness already filters to first-party
 * sellers, but this module re-applies the guard to whatever file it is handed —
 * the sweep file is an untrusted input like any other, and one marketplace
 * "$199 -> $24" smartwatch reaching the feed is a RebelSavings repeat.
 *
 *   npx tsx src/ingest/walmart-ingest.ts <sweep.json>
 *   DB_DRIVER=postgres npx tsx src/ingest/walmart-ingest.ts <sweep.json>   # prod
 */

import { readFileSync } from 'node:fs';
import { getDb, type Db } from '../db/client.js';
import { recordVerdicts, type HdVerdictInput } from '../engine/discovery.js';
import { isFirstParty, type WalmartHit } from '../vendors/walmart-direct.js';

const RETAILER = 'walmart';

/** Re-check every row's internal consistency before it can touch the pool. */
export function walmartRowSound(h: WalmartHit): boolean {
  if (!isFirstParty(h.sellerName)) return false;
  if (h.flag !== 'Clearance') return false;
  if (h.price === null || h.listPrice === null || h.listPrice <= h.price) return false;
  const pct = Math.round(((h.listPrice - h.price) / h.listPrice) * 100);
  if (pct > 90) return false;
  if (h.discountPct !== null && Math.abs(pct - h.discountPct) > 5) return false;
  return true;
}

export async function seedWalmartDiscovery(db: Db, hits: WalmartHit[]): Promise<number> {
  let n = 0;
  for (const h of hits) {
    const r = await db.query(
      `INSERT INTO discovery (retailer, item_id, sku, title, image_url, product_url, source,
                              claimed_price, claimed_list, claimed_discount)
       VALUES ($1, $2, $2, $3, $4, $5, 'walmart-clearance', $6, $7, $8)
       ON CONFLICT (retailer, item_id) DO NOTHING`,
      [
        RETAILER, String(h.usItemId), h.title.slice(0, 300),
        h.imageUrl, h.productUrl,
        h.price, h.listPrice, h.discountPct,
      ],
    );
    n += r.rowCount ?? 0;
  }
  return n;
}

export async function recordWalmartVerdicts(
  db: Db,
  hits: WalmartHit[],
): Promise<{ published: number; rejected: number; unreachable: number }> {
  const { rows } = await db.query<Record<string, unknown>>(
    `SELECT discovery_id, item_id FROM discovery
      WHERE retailer = $1 AND item_id = ANY($2::text[])`,
    [RETAILER, hits.map((h) => String(h.usItemId))],
  );
  const idBy = new Map<string, number>();
  for (const r of rows) idBy.set(String(r.item_id), Number(r.discovery_id));

  const verdicts: HdVerdictInput[] = [];
  for (const h of hits) {
    const discovery_id = idBy.get(String(h.usItemId));
    if (discovery_id === undefined) continue;
    verdicts.push({
      discovery_id,
      retailer: RETAILER,
      reachable: h.price !== null,
      price: h.price,
      list_price: h.listPrice,
      discount_pct: h.discountPct,
      // NO STORE CLAIMS. The page's storeId is pricing context, not a shelf;
      // the in-app hidden price is unreachable by design. Both stay null so
      // the card can never imply either.
      store_id: null,
      quantity: null,
      discontinued: false,
      alt_price_display: false,
      clearance_price: null,
      clearance_pct: null,
    });
  }

  const out = await recordVerdicts(db, verdicts);
  return { published: out.published, rejected: out.rejected, unreachable: out.unreachable };
}

async function main() {
  const [sweepPath] = process.argv.slice(2);
  if (!sweepPath) {
    console.error('usage: tsx src/ingest/walmart-ingest.ts <sweep.json>');
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(sweepPath, 'utf8')) as WalmartHit[];
  const hits = raw.filter(walmartRowSound);
  console.log(`seller+consistency guard: ${raw.length} in, ${hits.length} kept, ${raw.length - hits.length} dropped`);

  const db = await getDb();
  const seeded = await seedWalmartDiscovery(db, hits);
  console.log(`discovery seeded (new): ${seeded}`);

  const out = await recordWalmartVerdicts(db, hits);
  console.log(`verdicts: ${JSON.stringify(out)}`);

  const live = await db.query<Record<string, unknown>>(
    `SELECT status, count(*) n FROM discovery WHERE retailer = $1 GROUP BY 1 ORDER BY 1`,
    [RETAILER],
  );
  for (const r of live.rows) console.log(`  ${r.status}: ${r.n}`);
}

if (process.argv[1] && process.argv[1].includes('walmart-ingest')) {
  main().then(
    () => process.exit(0),
    (e) => { console.error(e); process.exit(1); },
  );
}
