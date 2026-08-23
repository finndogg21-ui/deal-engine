/** Read-only: published rows whose deal_kind claims clearance but hold no price. */
import 'dotenv/config';
process.env.DB_DRIVER = 'postgres';
const { getDb } = await import('../src/db/client.js');
const db = await getDb();
const { rows } = await db.query(
  `SELECT item_id, status, deal_kind, hd_price, hd_discount, clearance_price, alt_price_display,
          left(coalesce(title,''), 38) AS t
     FROM discovery
    WHERE retailer='homedepot' AND status='published'
      AND deal_kind='hidden_clearance' AND clearance_price IS NULL`,
);
console.log(`published, kind=hidden_clearance, NO price: ${rows.length}`);
for (const r of rows as Array<Record<string, unknown>>) {
  console.log(
    `  ${r.item_id} disc=${String(r.hd_discount).padEnd(6)} price=${String(r.hd_price).padEnd(8)}` +
    ` alt=${String(r.alt_price_display)} | ${r.t}`,
  );
}
process.exit(0);
