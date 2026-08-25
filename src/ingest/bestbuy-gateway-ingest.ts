/**
 * Best Buy GATEWAY ingest — browser-collected outlet sweep into pool rows.
 *
 * Companion to bestbuy-ingest.ts (official Products API, waiting on its key).
 * This is the path that runs today.
 *
 * Same handoff as Walmart: the browser agent POSTs Best Buy's own gateway
 * (browser-only for us), drops JSON here, and this module owns every DB write
 * through the same judge the other retailers use.
 *
 * BEST BUY ROWS ARE MARKDOWNS on NEW-condition outlet items. They publish
 * with NO store claims — the sweep pins one store's context because the
 * gateway requires it, but nothing per-store was verified, so store_id and
 * quantity stay null like Walmart's.
 *
 * OPEN-BOX / REFURBISHED / PRE-OWNED NEVER PASS in v1: the sweep's price is
 * the new-condition price even when the facet selects open-box products
 * (measured 2026-08-25), so publishing those rows would quote a price for a
 * condition that was never fetched.
 *
 * THE GUARD RUNS AGAIN AT INGEST — the sweep file is an untrusted input like
 * any other.
 *
 *   npx tsx src/ingest/bestbuy-gateway-ingest.ts <sweep.json>
 *   DB_DRIVER=postgres npx tsx src/ingest/bestbuy-gateway-ingest.ts <sweep.json>   # prod
 */

import { readFileSync } from 'node:fs';
import { getDb, type Db } from '../db/client.js';
import { recordVerdicts, type HdVerdictInput } from '../engine/discovery.js';
import type { BestBuyGatewayHit } from '../vendors/bestbuy-gateway.js';

const RETAILER = 'bestbuy';

/** Re-check every row's internal consistency before it can touch the pool. */
export function gatewayRowSound(h: BestBuyGatewayHit): boolean {
  if (h.condition !== 'new') return false;
  if (h.price === null || h.listPrice === null || h.listPrice <= h.price) return false;
  const pct = Math.round(((h.listPrice - h.price) / h.listPrice) * 100);
  if (pct > 90) return false;
  if (h.discountPct !== null && Math.abs(pct - h.discountPct) > 5) return false;
  return true;
}

export async function seedBestBuyDiscovery(db: Db, hits: BestBuyGatewayHit[]): Promise<number> {
  let n = 0;
  for (const h of hits) {
    const r = await db.query(
      `INSERT INTO discovery (retailer, item_id, sku, title, image_url, product_url, source,
                              claimed_price, claimed_list, claimed_discount)
       VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (retailer, item_id) DO NOTHING`,
      [
        RETAILER, h.skuId, h.title.slice(0, 300),
        h.imageUrl, h.productUrl,
        // Provenance: which facet surfaced it. 'bestbuy-clearance' rows carry
        // Best Buy's own Clearance flag; 'bestbuy-outlet' rows are outlet
        // discounts without it.
        h.sweep === 'clearance' ? 'bestbuy-clearance' : 'bestbuy-outlet',
        h.price, h.listPrice, h.discountPct,
      ],
    );
    n += r.rowCount ?? 0;
  }
  return n;
}

export async function recordBestBuyVerdicts(
  db: Db,
  hits: BestBuyGatewayHit[],
): Promise<{ published: number; rejected: number; unreachable: number }> {
  const { rows } = await db.query<Record<string, unknown>>(
    `SELECT discovery_id, item_id FROM discovery
      WHERE retailer = $1 AND item_id = ANY($2::text[])`,
    [RETAILER, hits.map((h) => h.skuId)],
  );
  const idBy = new Map<string, number>();
  for (const r of rows) idBy.set(String(r.item_id), Number(r.discovery_id));

  const verdicts: HdVerdictInput[] = [];
  for (const h of hits) {
    const discovery_id = idBy.get(h.skuId);
    if (discovery_id === undefined) continue;
    verdicts.push({
      discovery_id,
      retailer: RETAILER,
      reachable: h.price !== null,
      price: h.price,
      list_price: h.listPrice,
      discount_pct: h.discountPct,
      // NO STORE CLAIMS. Store 58 in the sweep is pricing context the gateway
      // demands, not a shelf anyone checked.
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
    console.error('usage: tsx src/ingest/bestbuy-gateway-ingest.ts <sweep.json>');
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(sweepPath, 'utf8')) as BestBuyGatewayHit[];
  const hits = raw.filter(gatewayRowSound);
  console.log(`condition+consistency guard: ${raw.length} in, ${hits.length} kept, ${raw.length - hits.length} dropped`);

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

if (process.argv[1] && process.argv[1].includes('bestbuy-gateway-ingest')) {
  main().then(
    () => process.exit(0),
    (e) => { console.error(e); process.exit(1); },
  );
}
