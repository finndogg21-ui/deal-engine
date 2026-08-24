/**
 * Lowe's ingest — turn a browser-collected sweep into pool rows.
 *
 * Same handoff as Target: Lowe's answers a browser and refuses our server
 * (403, verified), so the browser agent fetches and drops JSON here, and this
 * module owns every DB write.
 *
 * LOWE'S ROWS ARE MARKDOWNS, NEVER CLEARANCE. Every Lowe's discount carries an
 * expiry (`savings.endDateTime`), which makes it a time-limited sale rather
 * than the permanent in-store clearance Home Depot exposes. They publish as
 * `deal_kind = 'markdown'` and the card shows an ordinary was/now — no
 * "as low as", no clearance badge, no per-store claim.
 *
 *   npx tsx src/ingest/lowes-ingest.ts <sweep.json>
 *   DB_DRIVER=postgres npx tsx src/ingest/lowes-ingest.ts <sweep.json>   # prod
 */

import { readFileSync } from 'node:fs';
import { getDb, type Db } from '../db/client.js';
import { recordVerdicts, type HdVerdictInput } from '../engine/discovery.js';
import type { LowesHit } from '../vendors/lowes-direct.js';

const RETAILER = 'lowes';

/** Seed sweep hits as pending. Idempotent — an existing row keeps its status. */
/**
 * THE UNITS GUARD. Lowe's Back Aisle mixes units within one price object:
 * flooring shows basePrice PER CARTON and finalPrice PER SQUARE FOOT, so
 * "$80.47 -> $2.99" reads as 96% off when 80.47/27 sq ft = 2.98 — no discount
 * at all. 83 of 140 raw hits in the first real sweep were this trap.
 *
 * A row is kept only when its numbers agree with themselves:
 *   - the computed percentage matches the stated one (within 5 points), and
 *   - the ratio does not equal a carton/pack size named in the title, and
 *   - the discount is under 90% (deeper than that with no penny evidence is
 *     not credible on a dated promo).
 */
export function unitsConsistent(h: LowesHit): boolean {
  if (h.price === null || h.listPrice === null || h.listPrice <= h.price) return false;
  const computed = Math.round(((h.listPrice - h.price) / h.listPrice) * 100);
  if (computed > 90) return false;
  if (h.discountPct !== null && Math.abs(computed - h.discountPct) > 5) return false;

  const ratio = h.listPrice / h.price;
  const near = (a: number, b: number) => b > 1 && Math.abs(a - b) / b < 0.15;

  // Slug corruption writes 7.75 as "7 75", so repair digit pairs before a
  // unit word — otherwise "7 75 sq ft" parses as 75 and the guard misses.
  // The corruption hits dimensions too: "23 62 in x 11 81 in" is 23.62 x 11.81.
  const t = h.title.replace(/(\d)\s+(\d{1,2})(?=\s*(sq ?ft|SF|in))/gi, '$1.$2');

  // Trap 1: was/now ratio equals a stated sq-ft or pack size -> the "now" is a
  // per-unit price, not a discount.
  const qty = t.match(/(\d+(?:\.\d+)?)\s*(sq ?ft|SF|Pack)/i);
  if (qty && near(ratio, parseFloat(qty[1]!))) return false;

  // Trap 2: ratio equals the item's own area from its dimensions ("24 in x
  // 48 in" = 8 sq ft). Catches tiles that never state sq ft in the title.
  const dim = t.match(/(\d+(?:\.\d+)?)\s*in\s*x\s*(\d+(?:\.\d+)?)\s*in/i);
  if (dim) {
    const area = (parseFloat(dim[1]!) * parseFloat(dim[2]!)) / 144;
    if (near(ratio, area)) return false;
  }

  // Trap 3: category-level backstop. Tile/flooring under $20 with a 1.5-9x
  // ratio is overwhelmingly the per-piece/per-sq-ft mismatch; a real tile
  // markdown that deep on a sub-$20 item is not worth a customer's drive
  // anyway, so the honest cost of this rule is ~zero.
  if (/tile|flooring|plank|carton/i.test(t) && h.price < 20 && ratio > 1.5 && ratio < 9) {
    return false;
  }

  return true;
}

export async function seedLowesDiscovery(db: Db, hits: LowesHit[]): Promise<number> {
  let n = 0;
  for (const h of hits) {
    const r = await db.query(
      `INSERT INTO discovery (retailer, item_id, sku, title, image_url, product_url, source,
                              claimed_price, claimed_list, claimed_discount)
       VALUES ($1, $2, $2, $3, $4, $5, 'lowes-clearance', $6, $7, $8)
       ON CONFLICT (retailer, item_id) DO NOTHING`,
      [
        RETAILER, String(h.itemNumber),
        h.brand ? `${h.brand} ${h.title}`.slice(0, 300) : h.title.slice(0, 300),
        h.imageUrl, h.productUrl,
        h.price, h.listPrice, h.discountPct,
      ],
    );
    n += r.rowCount ?? 0;
  }
  return n;
}

/**
 * Judge the sweep. Lowe's prices are chain-wide (verified: identical across
 * four stores by path and by cookie, and a two-store list diff found zero
 * price differences), so ONE reading stands for every store and there is no
 * multi-store sweep to run.
 */
export async function recordLowesVerdicts(
  db: Db,
  hits: LowesHit[],
): Promise<{ published: number; rejected: number; unreachable: number }> {
  const { rows } = await db.query<Record<string, unknown>>(
    `SELECT discovery_id, item_id FROM discovery
      WHERE retailer = $1 AND item_id = ANY($2::text[])`,
    [RETAILER, hits.map((h) => String(h.itemNumber))],
  );
  const idBy = new Map<string, number>();
  for (const r of rows) idBy.set(String(r.item_id), Number(r.discovery_id));

  const verdicts: HdVerdictInput[] = [];
  for (const h of hits) {
    const discovery_id = idBy.get(String(h.itemNumber));
    if (discovery_id === undefined) continue;
    verdicts.push({
      discovery_id,
      retailer: RETAILER,
      reachable: h.price !== null,
      price: h.price,
      list_price: h.listPrice,
      discount_pct: h.discountPct,
      // Chain-wide: no store owns this price, so none is claimed.
      store_id: null,
      // NOT collected. See lowes-direct.ts — the per-store quantity did not
      // vary by store, so it is not real per-store stock and is not stored.
      quantity: null,
      discontinued: false,
      // Never clearance: a dated was/now is a sale.
      alt_price_display: false,
      clearance_price: null,
      clearance_pct: null,
    });
  }

  const out = await recordVerdicts(db, verdicts);
  return { published: out.published, rejected: out.rejected, unreachable: out.unreachable };
}

async function main() {
  const [sweepPath] = process.argv.slice(2);
  if (!sweepPath) {
    console.error('usage: tsx src/ingest/lowes-ingest.ts <sweep.json>');
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(sweepPath, 'utf8')) as LowesHit[];
  const hits = raw.filter(unitsConsistent);
  console.log(`units guard: ${raw.length} in, ${hits.length} kept, ${raw.length - hits.length} dropped`);
  const db = await getDb();

  const seeded = await seedLowesDiscovery(db, hits);
  console.log(`lowes hits in file: ${hits.length}`);
  console.log(`discovery seeded (new): ${seeded}`);

  const out = await recordLowesVerdicts(db, hits);
  console.log(`verdicts: ${JSON.stringify(out)}`);

  const live = await db.query<Record<string, unknown>>(
    `SELECT status, count(*) n FROM discovery WHERE retailer = $1 GROUP BY 1 ORDER BY 1`,
    [RETAILER],
  );
  for (const r of live.rows) console.log(`  ${r.status}: ${r.n}`);
}

if (process.argv[1] && process.argv[1].includes('lowes-ingest')) {
  main().then(
    () => process.exit(0),
    (e) => { console.error(e); process.exit(1); },
  );
}
