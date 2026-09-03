/** Published-deal counts per retailer. DB_DRIVER=postgres npx tsx scripts/count-published.mts */
import { getDb } from '../src/db/client.js';
async function main() {
  const db = await getDb();
  const { rows } = await db.query(
    `SELECT retailer, count(*)::int AS published,
            count(*) FILTER (WHERE deal_kind='hidden_clearance')::int AS hidden
       FROM discovery WHERE status='published' GROUP BY retailer ORDER BY published DESC`
  );
  let tot = 0;
  for (const r of rows as any[]) { tot += r.published; console.log(`${String(r.retailer).padEnd(12)} ${String(r.published).padStart(6)}  hidden:${r.hidden}  ${r.published>=500?'✓500':'+'+(500-r.published)}`); }
  console.log(`TOTAL ${tot}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
