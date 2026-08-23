/** Read-only: does production already have the columns the new code writes? */
import 'dotenv/config';
process.env.DB_DRIVER = 'postgres';
const { getDb } = await import('../src/db/client.js');
const db = await getDb();

const { rows } = await db.query(
  `SELECT column_name FROM information_schema.columns
    WHERE table_name = 'discovery'
      AND column_name IN ('alt_price_display','clearance_price','clearance_pct','deal_kind','retailer')
    ORDER BY column_name`,
);
const have = new Set((rows as Array<Record<string, unknown>>).map((r) => String(r.column_name)));
for (const c of ['retailer', 'deal_kind', 'alt_price_display', 'clearance_price', 'clearance_pct']) {
  console.log(`  ${have.has(c) ? 'OK  ' : 'MISSING'} ${c}`);
}

const si = await db.query(
  `SELECT COUNT(*) n FROM information_schema.tables WHERE table_name = 'store_inventory'`,
);
console.log(`  store_inventory table: ${(si.rows[0] as any).n > 0 ? 'OK' : 'MISSING'}`);
process.exit(0);
