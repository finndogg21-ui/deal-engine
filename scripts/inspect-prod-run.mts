/** Read-only: did the scheduled run send the clearance fields? */
import 'dotenv/config';
process.env.DB_DRIVER = 'postgres';
const { getDb } = await import('../src/db/client.js');
const db = await getDb();

const q = async (label: string, sql: string) => {
  const { rows } = await db.query(sql);
  console.log(label, JSON.stringify(rows[0]));
};

await q('alt_price_display stored: ', `
  SELECT COUNT(*) FILTER (WHERE alt_price_display IS NOT NULL) AS has_flag,
         COUNT(*) FILTER (WHERE alt_price_display IS TRUE)     AS flag_true,
         COUNT(*) FILTER (WHERE clearance_price IS NOT NULL)   AS has_clearance,
         COUNT(*)                                              AS total
    FROM discovery WHERE retailer = 'homedepot'`);

await q('checked in last 6h:       ', `
  SELECT COUNT(*) AS checked_recently,
         COUNT(*) FILTER (WHERE alt_price_display IS NOT NULL) AS of_those_with_flag,
         MAX(checked_at)::text AS latest
    FROM discovery
   WHERE retailer='homedepot' AND checked_at > now() - INTERVAL '6 hours'`);

const { rows } = await db.query(
  `SELECT item_id, status, deal_kind, hd_price, alt_price_display, clearance_price, checked_at::text
     FROM discovery
    WHERE retailer='homedepot' AND checked_at > now() - INTERVAL '6 hours'
    ORDER BY checked_at DESC LIMIT 8`,
);
console.log('most recently checked rows:');
for (const r of rows as Array<Record<string, unknown>>) {
  console.log(
    `  ${r.item_id} ${String(r.status).padEnd(9)} kind=${String(r.deal_kind ?? '-').padEnd(17)}` +
    ` price=${String(r.hd_price ?? '-').padEnd(8)} alt=${String(r.alt_price_display ?? 'NULL').padEnd(5)}` +
    ` clr=${String(r.clearance_price ?? 'NULL')}`,
  );
}
process.exit(0);
