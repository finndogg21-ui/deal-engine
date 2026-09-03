/** Classify Target published + a newest-sweep spill into clothing vs real deals.
 *  Writes NEW non-clothing hits (not yet published) to an ingest file, and reports
 *  the true non-clothing ceiling.  Usage: tsx target-quality.mts <spillFile> <outFile> */
import { getDb } from '../src/db/client.js';
import { readFileSync, writeFileSync } from 'node:fs';

// Apparel / footwear (low-value "clothing").
const APPAREL = /\b(shirt|t-?shirts?|tee|tees|blouse|sweatshirts?|hoodies?|sweaters?|pullovers?|cardigans?|pants?|jeans?|leggings?|joggers?|shorts?|skirts?|dress|dresses|jumpsuits?|rompers?|jackets?|coats?|blazers?|vests?|socks?|underwear|bra|bras|bralette|panties|panty|boxers?|briefs?|pajamas?|pjs|sleepwear|nightgown|loungewear|swimsuits?|swimwear|bikini|trunks|robes?|slippers?|shoes?|sneakers?|boots?|sandals?|heels?|loafers?|beanie|scarf|scarves|gloves?|mittens?|tights|camisole|tank tops?|polos?|henley|onesie|bodysuits?|leotard|swaddle|footie|overalls?|kimono|poncho|shrug|jersey)\b/i;

// Definitely NOT clothing even if an apparel word appears (fixes "Baby Jogger stroller",
// "Haptic Vest", "sock organizer", etc.).
const OVERRIDE = /\b(stroller|haptic|gaming|console|monitor|tv|television|laptop|tablet|headphones?|earbuds?|airpods?|speaker|soundbar|smartwatch|tumbler|quencher|stanley|blender|fryer|vacuum|cooker|kettle|toaster|keurig|dyson|doll|toy|toys|lego|figure|playset|table|cabinet|desk|shelf|shelving|sofa|couch|rug|lamp|mattress|bedding|comforter|duvet|pillow|blanket|grill|drill|tool|toolkit|backpack|luggage|suitcase|bike|bicycle|scooter|helmet|camera|drone|printer|router|keyboard|charger|jbl|bose|sony|samsung|nintendo|xbox|playstation|controller|projector|humidifier|purifier|diffuser|heater|cookware|dinnerware|thermos|organizer|storage|hamper|mirror|planter|vase|candle|diaper|wipes|formula|highchair|carseat|bassinet|crib|playard|bouncer|walker|book|puzzle|boardgame|craft|jewelry|earrings?|necklace|bracelet|sunglasses|perfume|cologne|vitamin|supplement|watch)\b/i;

// Apparel compounds that contain an OVERRIDE word (or a word too generic for APPAREL)
// but ARE clothing. Checked BEFORE OVERRIDE so e.g. "Bike Shorts" isn't cleared by the
// "bike" (bicycle) rule, and "Tube Top"/"Skort" aren't missed by APPAREL's vocab.
const STRONG_APPAREL = /\b(bike shorts?|tube tops?|crop tops?|halter tops?|halter|tankinis?|skorts?|swim trunks?|board shorts?|sports? bras?)\b/i;

const isClothing = (title: unknown) => {
  const t = String(title ?? '');
  if (STRONG_APPAREL.test(t)) return true;
  if (OVERRIDE.test(t)) return false;
  return APPAREL.test(t);
};

async function main() {
  const [spillPath, outPath] = process.argv.slice(2);
  const raw = readFileSync(spillPath, 'utf8');
  let full = raw;
  try { const arr = JSON.parse(raw); if (Array.isArray(arr)) full = arr.map((x: any) => x?.text ?? '').join(''); } catch { /* raw */ }
  const m = full.match(/<<<TGTSTART>>>([\s\S]*?)<<<TGTEND>>>/);
  if (!m) throw new Error('sentinels not found in spill');
  const newestHits = JSON.parse(m[1]) as { t: string; n: string; p: number; l: number; d: number; i: string | null }[];

  const db = await getDb();
  const { rows } = await db.query<Record<string, unknown>>(
    `SELECT item_id, title, hd_price::float p FROM discovery WHERE retailer='target' AND status='published'`);
  const publishedIds = new Set(rows.map((r) => String(r.item_id)));
  const pubClothing = rows.filter((r) => isClothing(r.title)).length;
  const pubNon = rows.length - pubClothing;

  const newNon = newestHits.filter((h) => !isClothing(h.n) && !publishedIds.has(String(h.t)));
  const out = newNon.map((h) => ({
    tcin: h.t, title: h.n, price: h.p, listPrice: h.l, discountPct: h.d,
    imageUrl: h.i ? 'https://target.scene7.com/is/image/Target/' + h.i : null,
    productUrl: 'https://www.target.com/p/-/A-' + h.t,
  }));
  writeFileSync(outPath, JSON.stringify(out));

  const newestNonTotal = newestHits.filter((h) => !isClothing(h.n)).length;
  console.log(`PUBLISHED target ${rows.length}: clothing ${pubClothing}, non-clothing ${pubNon}`);
  console.log(`NEWEST batch ${newestHits.length}: non-clothing ${newestNonTotal}, of which NEW (unpublished) ${newNon.length}`);
  console.log(`=> PROJECTED non-clothing after publishing new: ${pubNon + newNon.length}`);
  console.log(`wrote ${out.length} new non-clothing hits -> ${outPath}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
