/**
 * Re-apply the CURRENT judge to rows already in the pool.
 *
 * Verdicts are stored, not recomputed at read time, so a row judged under an
 * older rule keeps its old status forever. That is how 20 Home Depot rows
 * stayed published with no markdown and no clearance price: they were passed by
 * an earlier judge that treated `alternatePriceDisplay` as sufficient.
 *
 * This re-runs judge() over the values already stored. It asks no retailer
 * anything — it only re-scores what we already have, so it is safe to run while
 * Home Depot is blocking us.
 *
 *   npx tsx scripts/rejudge.mts [--apply]
 *
 * Without --apply it prints what would change and writes nothing.
 */

import 'dotenv/config';

process.env.DB_DRIVER = process.env.REJUDGE_DRIVER ?? 'pglite';
const { getDb } = await import('../src/db/client.js');
const { judge } = await import('../src/engine/discovery.js');

const apply = process.argv.includes('--apply');
const db = await getDb();

const { rows } = await db.query(
  `SELECT discovery_id, retailer, title, status, hd_price, hd_list, hd_discount,
          clearance_price, clearance_pct, hd_quantity, hd_store_id
     FROM discovery
    WHERE status = 'published'`,
);
// PUBLISHED ONLY. The job is to pull back rows that should never have gone
// live. Re-scoring rejected rows just rewrites their reject reasons — it throws
// away the audit trail that says why each one was turned down.

let changed = 0;
const moves = new Map<string, number>();

for (const r of rows as Array<Record<string, unknown>>) {
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

  const verdict = judge({
    discovery_id: Number(r.discovery_id),
    retailer: String(r.retailer ?? 'homedepot'),
    // These rows were reachable when checked; we are re-scoring stored facts,
    // not re-asking. Treat a stored price as proof the retailer answered.
    reachable: r.hd_price !== null || r.clearance_price !== null,
    price: n(r.hd_price),
    list_price: n(r.hd_list),
    discount_pct: n(r.hd_discount),
    clearance_price: n(r.clearance_price),
    clearance_pct: n(r.clearance_pct),
    quantity: n(r.hd_quantity),
    store_id: r.hd_store_id as string | null,
    discontinued: false,
  });

  if (verdict.status === r.status) continue;
  changed++;
  const key = `${String(r.status)} -> ${verdict.status}`;
  moves.set(key, (moves.get(key) ?? 0) + 1);

  if (apply) {
    await db.query(
      `UPDATE discovery
          SET status = $2, reject_reason = $3, deal_kind = $4
        WHERE discovery_id = $1`,
      [Number(r.discovery_id), verdict.status, verdict.reason, verdict.kind],
    );
  }
}

console.log(`${apply ? 'APPLIED' : 'DRY RUN'} — ${rows.length} rows scored, ${changed} would change`);
for (const [k, v] of moves) console.log(`  ${k}: ${v}`);

const after = await db.query(
  `SELECT retailer, status, count(*) n FROM discovery GROUP BY 1,2 ORDER BY 1,2`,
);
console.log(apply ? 'pool now:' : 'pool currently:');
for (const s of after.rows as Array<Record<string, unknown>>) {
  console.log(`  ${s.retailer} ${s.status} ${s.n}`);
}
process.exit(0);
