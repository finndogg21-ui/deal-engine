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
/**
 * INLINED, not imported. The tsx compile cache served a stale copy of
 * lowes-ingest during a re-run, so the guard silently ran WITHOUT the newest
 * checks and reported "0 rejected" while a trap row stayed live. A purge
 * script must not depend on a cache being fresh; this copy is the guard,
 * verbatim. Keep it in step with src/ingest/lowes-ingest.ts.
 */
type Hit = { title: string; price: number | null; listPrice: number | null; discountPct: number | null };
function unitsConsistent(h: Hit): boolean {
  if (h.price === null || h.listPrice === null || h.listPrice <= h.price) return false;
  const computed = Math.round(((h.listPrice - h.price) / h.listPrice) * 100);
  if (computed > 90) return false;
  if (h.discountPct !== null && Math.abs(computed - h.discountPct) > 5) return false;
  const ratio = h.listPrice / h.price;
  const near = (a: number, b: number) => b > 1 && Math.abs(a - b) / b < 0.15;
  const t = h.title.replace(/(\d)\s+(\d{1,2})(?=\s*(sq ?ft|SF|in))/gi, '$1.$2');
  const qty = t.match(/(\d+(?:\.\d+)?)\s*(sq ?ft|SF|Pack)/i);
  if (qty && near(ratio, parseFloat(qty[1]!))) return false;
  const dim = t.match(/(\d+(?:\.\d+)?)\s*in\s*x\s*(\d+(?:\.\d+)?)\s*in/i);
  if (dim) {
    const area = (parseFloat(dim[1]!) * parseFloat(dim[2]!)) / 144;
    if (near(ratio, area)) return false;
  }
  if (/tile|flooring|plank|carton/i.test(t) && h.price < 20 && ratio > 1.5 && ratio < 9) return false;
  return true;
}

const db = await getDb();
const { rows } = await db.query<Record<string, unknown>>(
  `SELECT discovery_id, item_id, title, hd_price, hd_list, hd_discount
     FROM discovery WHERE retailer = 'lowes' AND status = 'published'`,
);

let rejected = 0;
for (const r of rows) {
  const ok = unitsConsistent({
    title: String(r.title ?? ''),
    price: r.hd_price === null ? null : Number(r.hd_price),
    listPrice: r.hd_list === null ? null : Number(r.hd_list),
    discountPct: r.hd_discount === null ? null : Number(r.hd_discount),
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
