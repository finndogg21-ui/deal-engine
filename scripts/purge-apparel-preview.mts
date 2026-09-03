/**
 * READ-ONLY preview for the Target apparel cut.
 *
 * Decision: keep the top 40% of published Target apparel by absolute dollar
 * savings (hd_list - hd_price); mark the bottom 60% ("smaller deals") for
 * deletion. This script DELETES NOTHING. It classifies, ranks, prints the
 * boundary, and writes the exact delete set (by discovery_id) to a backup
 * JSON so the later delete keys on precise IDs, not a re-run of the regex.
 *
 *   cd deal-engine && npx tsx scripts/purge-apparel-preview.mts
 */
import 'dotenv/config';
import pg from 'pg';
import { writeFileSync, mkdirSync } from 'node:fs';

// --- isClothing(): copied VERBATIM from scripts/target-quality.mts so the
//     preview classifies identically to the curation gate. ---
const APPAREL = /\b(shirt|t-?shirts?|tee|tees|blouse|sweatshirts?|hoodies?|sweaters?|pullovers?|cardigans?|pants?|jeans?|leggings?|joggers?|shorts?|skirts?|dress|dresses|jumpsuits?|rompers?|jackets?|coats?|blazers?|vests?|socks?|underwear|bra|bras|bralette|panties|panty|boxers?|briefs?|pajamas?|pjs|sleepwear|nightgown|loungewear|swimsuits?|swimwear|bikini|trunks|robes?|slippers?|shoes?|sneakers?|boots?|sandals?|heels?|loafers?|beanie|scarf|scarves|gloves?|mittens?|tights|camisole|tank tops?|polos?|henley|onesie|bodysuits?|leotard|swaddle|footie|overalls?|kimono|poncho|shrug|jersey)\b/i;
const OVERRIDE = /\b(stroller|haptic|gaming|console|monitor|tv|television|laptop|tablet|headphones?|earbuds?|airpods?|speaker|soundbar|smartwatch|tumbler|quencher|stanley|blender|fryer|vacuum|cooker|kettle|toaster|keurig|dyson|doll|toy|toys|lego|figure|playset|table|cabinet|desk|shelf|shelving|sofa|couch|rug|lamp|mattress|bedding|comforter|duvet|pillow|blanket|grill|drill|tool|toolkit|backpack|luggage|suitcase|bike|bicycle|scooter|helmet|camera|drone|printer|router|keyboard|charger|jbl|bose|sony|samsung|nintendo|xbox|playstation|controller|projector|humidifier|purifier|diffuser|heater|cookware|dinnerware|thermos|organizer|storage|hamper|mirror|planter|vase|candle|diaper|wipes|formula|highchair|carseat|bassinet|crib|playard|bouncer|walker|book|puzzle|boardgame|craft|jewelry|earrings?|necklace|bracelet|sunglasses|perfume|cologne|vitamin|supplement|watch)\b/i;
const STRONG_APPAREL = /\b(bike shorts?|tube tops?|crop tops?|halter tops?|halter|tankinis?|skorts?|swim trunks?|board shorts?|sports? bras?)\b/i;
const isClothing = (title: unknown) => {
  const t = String(title ?? '');
  if (STRONG_APPAREL.test(t)) return true;
  if (OVERRIDE.test(t)) return false;
  return APPAREL.test(t);
};

const KEEP_FRACTION = 0.40; // keep the top 40% by savings; delete bottom 60%

type Row = { discovery_id: number; item_id: string; title: string; p: number | null; l: number | null; d: number | null };

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error(`[retry] ${label} failed once (${(e as Error).message}); retrying in 1.5s…`);
    await new Promise((r) => setTimeout(r, 1500));
    return await fn();
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is empty — set it in deal-engine/.env');

  // Bound the flaky Neon egress: fail fast on connect, cap the query, retry once.
  const pool = new pg.Pool({
    connectionString: url,
    max: 3,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 5000,
    query_timeout: 20000,
    statement_timeout: 20000,
  });

  const { rows } = await withRetry('SELECT published target', () =>
    pool.query<Row>(
      `SELECT discovery_id, item_id, title,
              hd_price::float  AS p,
              hd_list::float   AS l,
              hd_discount::float AS d
         FROM discovery
        WHERE retailer = 'target' AND status = 'published'`,
    ),
  );

  const apparel: Row[] = [];
  const nonApparel: Row[] = [];
  for (const r of rows) (isClothing(r.title) ? apparel : nonApparel).push(r);

  const savings = (r: Row) => (r.p !== null && r.l !== null && r.l > r.p ? r.l - r.p : null);

  // Rows we can't measure a deal size for → default to KEEP (never delete on
  // missing data), but surface the count.
  const measurable = apparel.filter((r) => savings(r) !== null);
  const unmeasurable = apparel.filter((r) => savings(r) === null);

  measurable.sort((a, b) => (savings(b)! - savings(a)!)); // biggest savings first
  const keepCount = Math.ceil(measurable.length * KEEP_FRACTION);
  const keep = measurable.slice(0, keepCount);
  const del = measurable.slice(keepCount);
  const cutoff = del.length ? savings(del[0])! : (keep.length ? savings(keep[keep.length - 1])! : 0);

  const fmt = (r: Row) => `  $${savings(r)?.toFixed(2).padStart(7)}  (${r.d ?? '?'}% off, now $${r.p})  ${String(r.title).slice(0, 68)}`;
  const median = (xs: number[]) => (xs.length ? xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)] : 0);

  console.log('================  TARGET APPAREL CUT — PREVIEW (no writes)  ================');
  console.log(`published Target rows:        ${rows.length}`);
  console.log(`  apparel (isClothing):       ${apparel.length}`);
  console.log(`  non-apparel (untouched):    ${nonApparel.length}`);
  console.log(`apparel with measurable deal: ${measurable.length}  (unmeasurable→kept: ${unmeasurable.length})`);
  console.log('');
  console.log(`KEEP top 40% by $ savings:    ${keep.length}`);
  console.log(`DELETE bottom 60%:            ${del.length}`);
  console.log(`cut line ≈ $${cutoff.toFixed(2)} savings`);
  console.log(`  keep  savings  min/median/max: $${savings(keep[keep.length-1])?.toFixed(2)} / $${median(keep.map(r=>savings(r)!)).toFixed(2)} / $${savings(keep[0])?.toFixed(2)}`);
  console.log(`  del   savings  min/median/max: $${savings(del[del.length-1])?.toFixed(2)} / $${median(del.map(r=>savings(r)!)).toFixed(2)} / $${savings(del[0])?.toFixed(2)}`);
  console.log('');
  console.log('— boundary: last 5 KEPT (smallest deals that survive) —');
  keep.slice(-5).forEach((r) => console.log(fmt(r)));
  console.log('— boundary: first 5 DELETED (biggest deals that go) —');
  del.slice(0, 5).forEach((r) => console.log(fmt(r)));
  console.log('— the 8 smallest deals (definitely deleted) —');
  del.slice(-8).forEach((r) => console.log(fmt(r)));
  console.log('— the 5 biggest apparel deals (definitely kept) —');
  keep.slice(0, 5).forEach((r) => console.log(fmt(r)));
  if (unmeasurable.length) {
    console.log(`— ${unmeasurable.length} apparel rows with null/blank savings (kept by default) —`);
    unmeasurable.slice(0, 8).forEach((r) => console.log(`  (no savings)  ${String(r.title).slice(0, 68)}`));
  }

  // Backup + exact delete set (by discovery_id). This is what a later delete keys on.
  mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
  const outPath = new URL('./out/target-apparel-delete-set.json', import.meta.url);
  const payload = {
    generated_for: 'target apparel bottom-60% cut',
    metric: 'absolute_dollar_savings = hd_list - hd_price',
    keep_fraction: KEEP_FRACTION,
    counts: { published: rows.length, apparel: apparel.length, keep: keep.length, delete: del.length, unmeasurable_kept: unmeasurable.length },
    delete_ids: del.map((r) => r.discovery_id),
    delete_rows: del.map((r) => ({ discovery_id: r.discovery_id, item_id: r.item_id, title: r.title, price: r.p, list: r.l, discount: r.d, savings: savings(r) })),
  };
  writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`\nbackup + exact delete set (${del.length} ids) → scripts/out/target-apparel-delete-set.json`);
  console.log('NOTHING WAS DELETED. Review, then approve the delete step.');

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
