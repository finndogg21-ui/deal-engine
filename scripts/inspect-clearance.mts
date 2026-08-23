/** Read-only: what do the published hidden-clearance rows actually hold? */
import 'dotenv/config';
process.env.DB_DRIVER = 'pglite';
const { getDb } = await import('../src/db/client.js');
const db = await getDb();

const { rows } = await db.query(
  `SELECT item_id, title, hd_price, hd_discount, clearance_price, clearance_pct, deal_kind
     FROM discovery
    WHERE status = 'published' AND retailer = 'homedepot'
    ORDER BY deal_kind, hd_discount DESC NULLS LAST`,
);

let noNumber = 0;
for (const r of rows as Array<Record<string, unknown>>) {
  const missing = r.clearance_price === null;
  if (r.deal_kind === 'hidden_clearance' && missing) noNumber++;
  console.log(
    [
      String(r.deal_kind ?? '-').padEnd(18),
      `price=${String(r.hd_price ?? '-').padEnd(8)}`,
      `disc=${String(r.hd_discount ?? '-').padEnd(7)}`,
      `clr=${String(r.clearance_price ?? 'NULL').padEnd(6)}`,
      String(r.title ?? '').slice(0, 40),
    ].join(' '),
  );
}
console.log(`\npublished HD rows: ${rows.length}`);
console.log(`hidden_clearance with NO price (would print the bare word): ${noNumber}`);
process.exit(0);
