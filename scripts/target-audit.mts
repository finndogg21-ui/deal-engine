/** Audit Target published rows: apparel vs substantive, by price. Read-only. */
import { getDb } from '../src/db/client.js';

const APPAREL = /\b(shirt|t-?shirt|tee|tees|blouse|sweatshirt|hoodie|sweater|pullover|cardigan|pant|pants|jean|jeans|legging|leggings|jogger|joggers|short|shorts|skirt|dress|jumpsuit|romper|jacket|coat|blazer|vest|sock|socks|underwear|bra|bralette|pant(y|ies)|boxer|brief|briefs|pajama|pajamas|pjs|sleepwear|nightgown|swim|swimsuit|bikini|trunks|robe|slipper|slippers|shoe|shoes|sneaker|sneakers|boot|boots|sandal|sandals|beanie|scarf|glove|gloves|mitten|tights|camisole|tank top|polo|henley|onesie|bodysuit|bib|apparel|clothing|outfit|leotard|swaddle|footie|footed)\b/i;

async function main() {
  const db = await getDb();
  const { rows } = await db.query<Record<string, unknown>>(
    `SELECT discovery_id, item_id, title, hd_price::float p, hd_list::float l, hd_discount::float d
       FROM discovery WHERE retailer='target' AND status='published'`);
  const apparel = rows.filter(r => APPAREL.test(String(r.title ?? '')));
  const other = rows.filter(r => !APPAREL.test(String(r.title ?? '')));
  const bucket = (arr: typeof rows) => {
    const b = { u10: 0, u25: 0, u50: 0, u100: 0, o100: 0 };
    for (const r of arr) { const p = Number(r.p) || 0; if (p < 10) b.u10++; else if (p < 25) b.u25++; else if (p < 50) b.u50++; else if (p < 100) b.u100++; else b.o100++; }
    return b;
  };
  console.log(`TOTAL target published: ${rows.length}`);
  console.log(`  apparel (keyword): ${apparel.length}`);
  console.log(`  other/substantive: ${other.length}`);
  console.log(`apparel price buckets: ${JSON.stringify(bucket(apparel))}`);
  console.log(`other   price buckets: ${JSON.stringify(bucket(other))}`);
  console.log(`\ncheap apparel (<$25) sample:`);
  apparel.filter(r => (Number(r.p) || 0) < 25).slice(0, 18).forEach(r => console.log(`  $${r.p} (${r.d}% off) ${String(r.title).slice(0, 70)}`));
  console.log(`\nsubstantive (other, >=$25) sample:`);
  other.filter(r => (Number(r.p) || 0) >= 25).slice(0, 18).forEach(r => console.log(`  $${r.p} (${r.d}% off) ${String(r.title).slice(0, 70)}`));
  console.log(`\nexpensive apparel (>=$40) sample (KEEP-worthy?):`);
  apparel.filter(r => (Number(r.p) || 0) >= 40).slice(0, 10).forEach(r => console.log(`  $${r.p} (${r.d}% off) ${String(r.title).slice(0, 70)}`));
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
