/**
 * Best Buy ingest — official-API sweep straight into the pool.
 *
 * Different handoff from Target/Lowe's/Walmart: there is no browser agent in
 * the loop, because the Products API answers a server. This module fetches
 * AND writes, one command, and still owns every DB write through the same
 * judge the other retailers use.
 *
 * BEST BUY ROWS ARE NATIONAL MARKDOWNS with Best Buy's own clearance/onSale
 * flags behind them. They publish with NO store claims: the API retired
 * per-store availability years ago, so store_id and quantity stay null and
 * the ledger stays empty — exactly like Walmart.
 *
 * THE GUARD RUNS AGAIN AT INGEST. The client already filtered, but when this
 * module is handed a saved sweep file instead, that file is an untrusted
 * input like any other.
 *
 *   npx tsx src/ingest/bestbuy-ingest.ts                    # fetch live, ingest
 *   npx tsx src/ingest/bestbuy-ingest.ts <sweep.json>       # ingest a saved sweep
 *   DB_DRIVER=postgres npx tsx src/ingest/bestbuy-ingest.ts # prod
 */

import { readFileSync } from 'node:fs';
import { getDb, type Db } from '../db/client.js';
import { recordVerdicts, type HdVerdictInput } from '../engine/discovery.js';
import { fetchBestBuyClearance, bestbuyRowSound, type BestBuyHit } from '../vendors/bestbuy-direct.js';

const RETAILER = 'bestbuy';

export async function seedBestBuyDiscovery(db: Db, hits: BestBuyHit[]): Promise<number> {
  let n = 0;
  for (const h of hits) {
    const r = await db.query(
      `INSERT INTO discovery (retailer, item_id, sku, title, image_url, product_url, source,
                              claimed_price, claimed_list, claimed_discount)
       VALUES ($1, $2, $2, $3, $4, $5, 'bestbuy-api', $6, $7, $8)
       ON CONFLICT (retailer, item_id) DO NOTHING`,
      [
        RETAILER, h.sku, h.title.slice(0, 300),
        h.imageUrl, h.productUrl,
        h.price, h.listPrice, h.discountPct,
      ],
    );
    n += r.rowCount ?? 0;
  }
  return n;
}

export async function recordBestBuyVerdicts(
  db: Db,
  hits: BestBuyHit[],
): Promise<{ published: number; rejected: number; unreachable: number }> {
  const { rows } = await db.query<Record<string, unknown>>(
    `SELECT discovery_id, item_id FROM discovery
      WHERE retailer = $1 AND item_id = ANY($2::text[])`,
    [RETAILER, hits.map((h) => h.sku)],
  );
  const idBy = new Map<string, number>();
  for (const r of rows) idBy.set(String(r.item_id), Number(r.discovery_id));

  const verdicts: HdVerdictInput[] = [];
  for (const h of hits) {
    const discovery_id = idBy.get(h.sku);
    if (discovery_id === undefined) continue;
    verdicts.push({
      discovery_id,
      retailer: RETAILER,
      reachable: h.price !== null,
      price: h.price,
      list_price: h.listPrice,
      discount_pct: h.discountPct,
      // NO STORE CLAIMS. inStoreAvailability is a national boolean, not a
      // shelf; both stay null so the card can never imply either.
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

  let raw: BestBuyHit[];
  if (sweepPath) {
    raw = JSON.parse(readFileSync(sweepPath, 'utf8')) as BestBuyHit[];
  } else {
    const { hits, seen } = await fetchBestBuyClearance();
    console.log(`api sweep: ${seen} products seen, ${hits.length} passed the client guard`);
    raw = hits;
  }

  const hits = raw.filter(bestbuyRowSound);
  console.log(`consistency guard: ${raw.length} in, ${hits.length} kept, ${raw.length - hits.length} dropped`);

  const db = await getDb();
  const seeded = await seedBestBuyDiscovery(db, hits);
  console.log(`discovery seeded (new): ${seeded}`);

  const out = await recordBestBuyVerdicts(db, hits);
  console.log(`verdicts: ${JSON.stringify(out)}`);

  const live = await db.query<Record<string, unknown>>(
    `SELECT status, count(*) n FROM discovery WHERE retailer = $1 GROUP BY 1 ORDER BY 1`,
    [RETAILER],
  );
  for (const r of live.rows) console.log(`  ${r.status}: ${r.n}`);
}

if (process.argv[1] && process.argv[1].includes('bestbuy-ingest')) {
  main().then(
    () => process.exit(0),
    (e) => { console.error(e); process.exit(1); },
  );
}
