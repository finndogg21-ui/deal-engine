/**
 * Apply a MULTI-STORE clearance sweep to the pool.
 *
 * Fetched in-browser 2026-08-23: 20 flagged Home Depot items x 11 stores
 * across San Antonio, NY, LA, Chicago, Miami, Atlanta, Denver, Seattle,
 * Philadelphia and Phoenix. 220 calls, 0 errors.
 *
 * WHY MULTI-STORE. Clearance is a per-store fact. Checking only store 582 found
 * a real price for 2 of 20 items; checking 11 found 6 — and three of those had
 * been actively misjudged:
 *
 *   flashing tape   582 said $31.68 / 0% off  -> Miami has it at $3.70  (85%)
 *   oak flooring    582 returned no price     -> Miami has it at $14.00 (90%)
 *   strip light kit 582 said $161.10 / 15%    -> Miami has it at $44.75 (76%)
 *
 * Each row stores the LOWEST real clearance found and the store it belongs to,
 * so the card can say "As low as $3.70 — cheapest at Miami (Calle Ocho)"
 * instead of a bare number that no particular store honors.
 *
 * The 14 with no price at any of the 11 stores are sent too, so the judge
 * rejects them. A card that cannot quote a price is not a deal.
 *
 *   npx tsx scripts/apply-multistore-clearance.mts [--prod]
 */

import 'dotenv/config';

const PROD = process.argv.includes('--prod');
process.env.DB_DRIVER = PROD ? 'postgres' : 'pglite';

const { getDb } = await import('../src/db/client.js');
const { recordVerdicts } = await import('../src/engine/discovery.js');

const STORES_CHECKED = 11;

/** itemId, shelf price, altFlag, bestClearance, bestPct, bestStore */
const SWEEP: Array<[string, number | null, number, number | null, number | null, string | null]> = [
  ['204468560', 133.85, 1, 14, 90, 'Miami (Calle Ocho)'],
  ['205822194', 12.61, 0, null, null, null],
  ['205996750', 46.5, 1, null, null, null],
  ['206346283', 14.3, 1, null, null, null],
  ['311990757', 29.97, 1, null, null, null],
  ['315964787', 21.47, 1, null, null, null],
  ['316066836', 31.68, 1, 3.7, 85, 'Miami (Calle Ocho)'],
  ['316803941', 69.97, 1, null, null, null],
  ['317026502', 169, 1, null, null, null],
  ['317882990', 119, 1, 89, 25, 'Lander'],
  ['320591464', 16.47, 1, null, null, null],
  ['324233504', 99, 1, null, null, null],
  ['324308361', 29.98, 1, 7.03, 77, 'Bitters Rd'],
  ['324585506', 94.25, 1, null, null, null],
  ['324763342', 189.99, 1, 44.75, 76, 'Miami (Calle Ocho)'],
  ['325001889', 11.98, 1, 3, 75, 'Bitters Rd'],
  ['330141971', 93.25, 1, null, null, null],
  ['330434080', 14.98, 1, null, null, null],
  ['331282373', 16.98, 1, null, null, null],
  ['339190789', 22.97, 1, null, null, null],
];

const db = await getDb();

const { rows } = await db.query(
  `SELECT discovery_id, item_id FROM discovery
    WHERE retailer = 'homedepot' AND item_id = ANY($1::text[])`,
  [SWEEP.map((r) => r[0])],
);
const idBy = new Map<string, number>();
for (const r of rows as Array<Record<string, unknown>>) {
  idBy.set(String(r.item_id), Number(r.discovery_id));
}
console.log(`${PROD ? 'PRODUCTION' : 'local'}: matched ${idBy.size} of ${SWEEP.length}`);

const verdicts = SWEEP.flatMap(([itemId, shelf, alt, clr, pct, store]) => {
  const discovery_id = idBy.get(itemId);
  if (discovery_id === undefined) return [];
  return [{
    discovery_id,
    retailer: 'homedepot',
    reachable: shelf !== null,
    price: shelf,
    list_price: null,
    discount_pct: 0,
    store_id: '582',
    quantity: null,
    discontinued: false,
    alt_price_display: alt === 1,
    clearance_price: clr,
    clearance_pct: pct,
    clearance_store: store,
    clearance_stores_checked: STORES_CHECKED,
  }];
});

const out = await recordVerdicts(db, verdicts);
console.log('verdicts:', JSON.stringify(out));

const after = await db.query(
  `SELECT item_id, status, clearance_price, clearance_pct, clearance_store
     FROM discovery
    WHERE retailer='homedepot' AND status='published' AND deal_kind='hidden_clearance'
    ORDER BY clearance_pct DESC NULLS LAST`,
);
console.log('published clearance deals, all with a real price:');
for (const r of after.rows as Array<Record<string, unknown>>) {
  console.log(`  $${r.clearance_price} (${r.clearance_pct}% off) @ ${r.clearance_store} — ${r.item_id}`);
}
process.exit(0);
