/**
 * Re-apply the hardened units guard to Lowe's rows already in the pool.
 *
 * The first guard missed two shapes the live site then exposed: slug-corrupted
 * decimals ("7 75 sq ft" parsing as 75, hiding a 7.75x per-piece/per-sq-ft
 * ratio) and areas stated only as dimensions ("24 in x 48 in" = 8 sq ft). This
 * re-runs the current unitsConsistent() over stored Lowe's rows and rejects
 * the ones that no longer pass — the same numbers the cards would print.
 *
 *   npx tsx scripts/reguard-lowes.mts            # local
 *   REGUARD_DRIVER=postgres npx tsx scripts/reguard-lowes.mts   # prod
 */

import 'dotenv/config';

process.env.DB_DRIVER = process.env.REGUARD_DRIVER ?? 'pglite';
const { getDb } = await import('../src/db/client.js');
const { unitsConsistent } = await import('../src/ingest/lowes-ingest.js');

const db = await getDb();
const { rows } = await db.query<Record<string, unknown>>(
  `SELECT discovery_id, item_id, title, hd_price, hd_list, hd_discount
     FROM discovery WHERE retailer = 'lowes' AND status = 'published'`,
);

let rejected = 0;
for (const r of rows) {
  const ok = unitsConsistent({
    itemNumber: String(r.item_id),
    title: String(r.title ?? ''),
    brand: null,
    price: r.hd_price === null ? null : Number(r.hd_price),
    listPrice: r.hd_list === null ? null : Number(r.hd_list),
    discountPct: r.hd_discount === null ? null : Number(r.hd_discount),
    endsAt: null,
    imageUrl: null,
    productUrl: '',
  });
  if (!ok) {
    rejected++;
    await db.query(
      `UPDATE discovery SET status='rejected',
              reject_reason='units mismatch: the was-price and now-price are in different units (per-carton vs per-sq-ft), so the discount is not real'
        WHERE discovery_id = $1`,
      [Number(r.discovery_id)],
    );
  }
}
console.log(`lowes published: ${rows.length} checked, ${rejected} rejected as units traps, ${rows.length - rejected} remain`);
process.exit(0);
