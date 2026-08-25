/**
 * Seed arbitrary discovered items into the pool — the generic half of every
 * discovery sweep.
 *
 * The browser agent discovers (searchModel for Home Depot, category lists for
 * the others), writes a JSON array, and this script inserts the rows as
 * `pending`. It NEVER publishes: publishing is the judge's job after a
 * verification pass prices each item, so nothing reaches the feed on a
 * sweep's word alone.
 *
 *   npx tsx scripts/seed-items.mts <retailer> <items.json>
 *   DB_DRIVER=postgres npx tsx scripts/seed-items.mts homedepot hd-found.json
 *
 * items.json: [{ itemId, title?, price?, listPrice?, discountPct?, imageUrl?, productUrl? }]
 */

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { getDb } from '../src/db/client.js';

const KNOWN = new Set(['homedepot', 'target', 'lowes', 'walmart']);

const [retailer, file] = process.argv.slice(2);
if (!retailer || !file || !KNOWN.has(retailer)) {
  console.error(`usage: tsx scripts/seed-items.mts <${[...KNOWN].join('|')}> <items.json>`);
  process.exit(1);
}

interface SeedItem {
  itemId: string | number;
  title?: string | null;
  price?: number | null;
  listPrice?: number | null;
  discountPct?: number | null;
  imageUrl?: string | null;
  productUrl?: string | null;
}

const items = JSON.parse(readFileSync(file, 'utf8')) as SeedItem[];
const db = await getDb();

let inserted = 0;
for (const it of items) {
  const id = String(it.itemId ?? '').trim();
  if (!id) continue;
  const r = await db.query(
    `INSERT INTO discovery (retailer, item_id, sku, title, image_url, product_url, source,
                            claimed_price, claimed_list, claimed_discount)
     VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (retailer, item_id) DO NOTHING`,
    [
      retailer, id,
      (it.title ?? '').slice(0, 300) || null,
      it.imageUrl ?? null, it.productUrl ?? null,
      `${retailer}-browse`,
      it.price ?? null, it.listPrice ?? null, it.discountPct ?? null,
    ],
  );
  inserted += r.rowCount ?? 0;
}

console.log(`seeded ${inserted} new of ${items.length} (existing rows untouched)`);
const { rows } = await db.query<Record<string, unknown>>(
  `SELECT status, count(*) n FROM discovery WHERE retailer = $1 GROUP BY 1 ORDER BY 1`,
  [retailer],
);
for (const r of rows) console.log(`  ${r.status}: ${r.n}`);
process.exit(0);
