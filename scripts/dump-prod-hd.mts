/**
 * Read-only export of the production Home Depot pool to JSON.
 *
 * Local development runs on PGlite while production runs on Neon, so the local
 * dashboard only ever sees what was ingested locally. This pulls the real Home
 * Depot rows down so both retailers can be viewed in one place.
 *
 * SELECT only. Nothing here writes to production.
 *
 *   npx tsx scripts/dump-prod-hd.mts [outfile]
 */

import 'dotenv/config';
import { writeFileSync } from 'node:fs';

process.env.DB_DRIVER = 'postgres';
const { getDb } = await import('../src/db/client.js');

const out = process.argv[2] ?? 'hd-prod.json';
const db = await getDb();

const { rows } = await db.query(
  `SELECT retailer, item_id, sku, title, image_url, product_url, source,
          claimed_price, claimed_list, claimed_discount,
          status, checked_at, hd_price, hd_list, hd_discount,
          hd_store_id, hd_quantity, reject_reason, publish_at,
          deal_kind, clearance_price, clearance_pct
     FROM discovery
    WHERE retailer = 'homedepot'`,
);

writeFileSync(out, JSON.stringify(rows));

const all = rows as Array<Record<string, unknown>>;
const published = all.filter((r) => r.status === 'published');
console.log(`exported: ${all.length} rows -> ${out}`);
console.log(`published: ${published.length}`);
console.log(
  `published WITH a real clearance price: ${published.filter((r) => r.clearance_price !== null).length}`,
);
process.exit(0);
