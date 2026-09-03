/** Pull HD itemIds already in prod as a seed list for per-store hidden-clearance probes.
 *  DB_DRIVER=postgres npx tsx scripts/hd-seed-items.mts [limit] [out.json] */
import { getDb } from '../src/db/client.js';
import fs from 'node:fs';
const limit = Number(process.argv[2] || 80);
const out = process.argv[3] || 'experiments/cloak-browser/out/seed-items.json';
const db = await getDb();
const cols = (await db.query(`select column_name from information_schema.columns where table_name='discovery' order by ordinal_position`)).rows.map((r: any) => r.column_name as string);
console.log('discovery columns:', cols.join(', '));
const idCol = cols.find((c) => /^(item_id|product_id|hd_item_id|sku|retailer_item_id)$/.test(c)) ?? cols.find((c) => /item|product/.test(c));
const titleCol = cols.find((c) => /^(title|name|label|product_label|product_name)$/.test(c));
if (!idCol) throw new Error('no item id column found');
const sel = [`${idCol} as item_id`, titleCol ? `${titleCol} as title` : `null as title`, 'hd_price', 'hd_list', 'deal_kind', 'clearance_price'].join(', ');
const { rows } = await db.query(`select ${sel} from discovery where retailer='homedepot' and status='published' order by hd_list desc nulls last limit ${limit}`);
fs.mkdirSync(out.replace(/\/[^/]*$/, ''), { recursive: true });
fs.writeFileSync(out, JSON.stringify(rows, null, 2));
console.log(`wrote ${rows.length} HD seed items -> ${out}`);
console.log('sample:', JSON.stringify(rows.slice(0, 3)));
process.exit(0);
