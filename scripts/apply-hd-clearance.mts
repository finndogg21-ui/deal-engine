/**
 * Apply real Home Depot clearance readings to the pool.
 *
 * Fetched in-browser 2026-08-23 at store 582 (HD answers a browser, refuses our
 * server). Every value here came back from HD's own pricing.clearance field —
 * nothing is inferred.
 *
 * WHAT THIS DATA SHOWS, and why the card needs a reveal control:
 * 18 of 20 items carry `alternatePriceDisplay` (HD's "See In-Store Clearance
 * Price" tell), but only 4 return a clearance number AT THIS STORE. Clearance
 * is a per-store fact. A flagged item with no number here may well be marked
 * down at the next store over — which is precisely why Home Depot puts the
 * price behind a click instead of printing it on the listing.
 *
 *   npx tsx scripts/apply-hd-clearance.mts
 */

import 'dotenv/config';

process.env.DB_DRIVER = 'pglite';
const { getDb } = await import('../src/db/client.js');
const { recordVerdicts } = await import('../src/engine/discovery.js');

/** id, shelf price, alt flag, clearance price, clearance % — as HD returned them. */
const READINGS: Array<[string, number | null, boolean, number | null, number | null]> = [
  ['205822194', 12.61, false, null, null],
  ['205996750', 46.5, true, null, null],
  ['206346283', 14.3, true, null, null],
  ['324763342', 189.99, true, 161.1, 15],
  ['320591464', 16.47, true, null, null],
  ['316066836', 31.68, true, 31.68, 0],
  ['315964787', 21.47, true, null, null],
  ['316803941', 69.97, true, null, null],
  ['324233504', 99, true, null, null],
  ['317026502', 169, true, null, null],
  ['324585506', 94.25, true, null, null],
  ['325001889', 11.98, true, 3, 75],
  ['311990757', 29.97, true, null, null],
  ['324308361', 29.98, true, 7.03, 77],
  ['330434080', 14.98, true, null, null],
  ['331282373', 16.98, true, null, null],
  ['204468560', null, false, null, null],
  ['330141971', 93.25, true, null, null],
  ['339190789', 22.97, true, null, null],
  ['317882990', 119, true, null, null],
];

const db = await getDb();

const { rows } = await db.query(
  `SELECT discovery_id, item_id FROM discovery WHERE retailer = 'homedepot' AND item_id = ANY($1::text[])`,
  [READINGS.map((r) => r[0])],
);
const idBy = new Map<string, number>();
for (const r of rows as Array<Record<string, unknown>>) {
  idBy.set(String(r.item_id), Number(r.discovery_id));
}

const verdicts = READINGS.flatMap(([itemId, price, alt, clr, clrPct]) => {
  const discovery_id = idBy.get(itemId);
  if (discovery_id === undefined) return [];
  return [{
    discovery_id,
    retailer: 'homedepot',
    reachable: price !== null,
    price,
    list_price: null,
    // These carry no online markdown; the markdown is the in-store clearance.
    discount_pct: 0,
    store_id: 'homedepot:582',
    quantity: null,
    discontinued: false,
    alt_price_display: alt,
    clearance_price: clr,
    clearance_pct: clrPct,
  }];
});

const out = await recordVerdicts(db, verdicts);
console.log('verdicts:', JSON.stringify(out));

const after = await db.query(
  `SELECT status, deal_kind, count(*) n FROM discovery WHERE retailer='homedepot'
    GROUP BY 1,2 ORDER BY 1,2`,
);
for (const r of after.rows as Array<Record<string, unknown>>) {
  console.log(`  ${r.status} ${r.deal_kind ?? '-'} ${r.n}`);
}
const priced = await db.query(
  `SELECT item_id, hd_price, clearance_price, clearance_pct FROM discovery
    WHERE retailer='homedepot' AND clearance_price IS NOT NULL ORDER BY clearance_pct DESC`,
);
console.log('rows with a real register price:');
for (const r of priced.rows as Array<Record<string, unknown>>) {
  console.log(`  ${r.item_id}  $${r.clearance_price} (${r.clearance_pct}% off $${r.hd_price})`);
}
process.exit(0);
