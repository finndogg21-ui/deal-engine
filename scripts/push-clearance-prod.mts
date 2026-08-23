/**
 * Push the real Home Depot clearance readings to PRODUCTION.
 *
 * Values fetched in-browser 2026-08-23 at store 582 from HD's own
 * pricing.clearance / alternatePriceDisplay fields. Nothing is inferred.
 *
 * Why this exists: production's pool had 20 rows flagged as hidden clearance
 * with no number, because the verification query never asked for the clearance
 * field. They were not due for another check for 12 hours, so the next
 * scheduled run would have skipped them and the site would have kept showing a
 * price slot with no price in it.
 *
 * Reads discovery_ids directly (read-only) but WRITES ONLY through the public
 * verdicts endpoint, so production's own deployed judge decides every outcome —
 * this script cannot publish anything the server would not publish itself.
 *
 *   npx tsx scripts/push-clearance-prod.mts
 */

import 'dotenv/config';

const URL = 'https://web-production-cc975.up.railway.app';
const TOKEN = process.env.SCAN_TRIGGER_TOKEN ?? '';
if (!TOKEN) {
  console.error('SCAN_TRIGGER_TOKEN missing from the environment.');
  process.exit(1);
}

/** itemId, shelf price, alt flag, clearance price, clearance % — as HD returned. */
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

process.env.DB_DRIVER = 'postgres';
const { getDb } = await import('../src/db/client.js');
const db = await getDb();

const { rows } = await db.query(
  `SELECT discovery_id, item_id FROM discovery
    WHERE retailer = 'homedepot' AND item_id = ANY($1::text[])`,
  [READINGS.map((r) => r[0])],
);
const idBy = new Map<string, number>();
for (const r of rows as Array<Record<string, unknown>>) {
  idBy.set(String(r.item_id), Number(r.discovery_id));
}
console.log(`matched ${idBy.size} of ${READINGS.length} items in production`);

const verdicts = READINGS.flatMap(([itemId, price, alt, clr, clrPct]) => {
  const discovery_id = idBy.get(itemId);
  if (discovery_id === undefined) return [];
  return [{
    discovery_id,
    retailer: 'homedepot',
    reachable: price !== null,
    price,
    list_price: null,
    discount_pct: 0,
    store_id: '582',
    quantity: null,
    discontinued: false,
    alt_price_display: alt,
    clearance_price: clr,
    clearance_pct: clrPct,
  }];
});

const res = await fetch(`${URL}/api/admin/discovery/verdicts`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-scan-token': TOKEN },
  body: JSON.stringify({ verdicts }),
});
console.log(`verdicts POST -> HTTP ${res.status}`);
console.log(await res.text());
process.exit(0);
