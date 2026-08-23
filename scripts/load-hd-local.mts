/**
 * Load an exported Home Depot pool into the LOCAL database.
 *
 * Pairs with dump-prod-hd.mts so the local dashboard shows both retailers at
 * once instead of only what was ingested locally. Idempotent: re-running
 * refreshes the verdict columns rather than duplicating rows.
 *
 * Local DB only — DB_DRIVER is forced away from postgres so a stray
 * DATABASE_URL in the environment can never point this at production.
 *
 *   npx tsx scripts/load-hd-local.mts [infile]
 */

import 'dotenv/config';
import { readFileSync } from 'node:fs';

process.env.DB_DRIVER = 'pglite';
const { getDb } = await import('../src/db/client.js');

const infile = process.argv[2] ?? 'hd-prod.json';
const rows = JSON.parse(readFileSync(infile, 'utf8')) as Array<Record<string, unknown>>;
const db = await getDb();

let inserted = 0;
for (const r of rows) {
  const res = await db.query(
    `INSERT INTO discovery (retailer, item_id, sku, title, image_url, product_url, source,
                            claimed_price, claimed_list, claimed_discount,
                            status, checked_at, hd_price, hd_list, hd_discount,
                            hd_store_id, hd_quantity, reject_reason, publish_at,
                            deal_kind, clearance_price, clearance_pct)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
     ON CONFLICT (retailer, item_id) DO UPDATE
       SET status = EXCLUDED.status,
           checked_at = EXCLUDED.checked_at,
           hd_price = EXCLUDED.hd_price,
           hd_list = EXCLUDED.hd_list,
           hd_discount = EXCLUDED.hd_discount,
           hd_store_id = EXCLUDED.hd_store_id,
           hd_quantity = EXCLUDED.hd_quantity,
           reject_reason = EXCLUDED.reject_reason,
           deal_kind = EXCLUDED.deal_kind,
           clearance_price = EXCLUDED.clearance_price,
           clearance_pct = EXCLUDED.clearance_pct`,
    [
      r.retailer, r.item_id, r.sku, r.title, r.image_url, r.product_url, r.source,
      r.claimed_price, r.claimed_list, r.claimed_discount,
      r.status, r.checked_at, r.hd_price, r.hd_list, r.hd_discount,
      r.hd_store_id, r.hd_quantity, r.reject_reason, r.publish_at,
      r.deal_kind, r.clearance_price, r.clearance_pct,
    ],
  );
  inserted += res.rowCount ?? 0;
}

console.log(`loaded ${rows.length} rows (${inserted} written)`);
const summary = await db.query(
  `SELECT retailer, status, count(*) n FROM discovery GROUP BY 1,2 ORDER BY 1,2`,
);
for (const s of summary.rows as Array<Record<string, unknown>>) {
  console.log(`  ${s.retailer} ${s.status} ${s.n}`);
}
process.exit(0);
