/**
 * Replay a saved vendor payload into the database.
 *
 *   npm run replay -- ./tmp-ss.json
 *
 * Exists for two reasons:
 *
 *   1. Testing the mapping against a real payload costs nothing. Re-running a
 *      paid actor to check a field name is how a $5 credit disappears.
 *   2. `raw` is stored on every observation, so when the mapping is wrong the
 *      fix can be replayed over saved payloads instead of waiting a week for
 *      history to rebuild.
 *
 * It goes through exactly the same write path as a live scan — same upserts,
 * same append-only rule, same fabrication guard. If it works here it works
 * there.
 */

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/client.js';
import { toDealEvents, type HdItem } from '../vendors/apify.js';
import { looksFabricated } from './run-scan.js';
import type { DealEvent } from '../vendors/contracts.js';

const file = process.argv[2];
if (!file) {
  console.error('usage: npm run replay -- <path-to-dataset.json>');
  process.exit(1);
}

const items = JSON.parse(readFileSync(file, 'utf8')) as HdItem[];
if (!Array.isArray(items)) throw new Error('Expected a JSON array of vendor items.');

const observedAt = new Date();
const events: DealEvent[] = items.flatMap((i) => toDealEvents(i, observedAt));

const fabricated = looksFabricated(events);
if (fabricated) {
  console.error(`REFUSED TO WRITE — ${fabricated}`);
  process.exit(1);
}

const db = await getDb();
const runId = randomUUID();

await db.query(
  `INSERT INTO scan_runs (run_id, source, started_at, status, zips)
   VALUES ($1,'apify:replay',$2,'running',$3)`,
  [runId, observedAt, process.env.SCAN_ZIPS ?? ''],
);

let rows = 0;
const failed: string[] = [];

for (const e of events) {
  try {
    await db.tx(async (tx) => {
      let storeId: string | null = null;
      if (e.storeNumber) {
        storeId = `${e.retailer}:${e.storeNumber}`;
        await tx.query(
          `INSERT INTO stores (store_id, retailer, store_number, name, zip, lat, lng)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (store_id) DO UPDATE SET
             name = COALESCE(EXCLUDED.name, stores.name),
             zip  = COALESCE(EXCLUDED.zip,  stores.zip)`,
          [storeId, e.retailer, e.storeNumber, e.storeName, e.zip ?? null, e.lat ?? null, e.lng ?? null],
        );
      }

      const productId = `${e.retailer}:${e.sku}`;
      await tx.query(
        `INSERT INTO products (product_id, retailer, sku, item_id, title, brand, category, image_url, product_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (product_id) DO UPDATE SET
           item_id = COALESCE(products.item_id, EXCLUDED.item_id),
           title = COALESCE(EXCLUDED.title, products.title),
           category = COALESCE(EXCLUDED.category, products.category),
           image_url = COALESCE(EXCLUDED.image_url, products.image_url),
           product_url = COALESCE(EXCLUDED.product_url, products.product_url)`,
        [productId, e.retailer, e.sku, e.itemId ?? null, e.title, e.brand ?? null, e.category ?? null, e.imageUrl ?? null, e.productUrl ?? null],
      );

      await tx.query(
        `INSERT INTO price_observations
           (product_id, store_id, observed_at, price, list_price, discount_pct,
            stock_qty, availability, aisle_bay, source, run_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'apify:replay',$10)`,
        [productId, storeId, e.observedAt, e.price, e.listPrice, e.discountPct,
         e.stockQty, e.availability, e.aisleBay ?? null, runId],
      );
    });
    rows++;
  } catch (err) {
    failed.push(`${e.sku}@${e.storeNumber}: ${(err as Error).message}`);
  }
}

await db.query(
  `UPDATE scan_runs SET finished_at = now(), status = $2, rows_written = $3, canary_ok = true, error = $4
    WHERE run_id = $1`,
  [runId, failed.length > 0 ? 'partial' : 'ok', rows,
   failed.length > 0 ? `${failed.length} failed: ${failed.slice(0, 2).join(' | ')}` : null],
);

console.log(`replayed ${items.length} items -> ${events.length} events -> ${rows} observations written`);
if (failed.length > 0) console.log(`  ${failed.length} failed:\n  ${failed.slice(0, 3).join('\n  ')}`);

await db.close();
