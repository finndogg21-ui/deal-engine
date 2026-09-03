/**
 * Target DIRECT ingest — the FAST PATH to volume.
 *
 * Modeled on homedepot-direct-ingest.ts. Target's RedSky plp_search_v2 (the
 * same endpoint target.com's own clearance listing calls) returns each item's
 * CURRENT online price and its REGULAR price. That number is what target.com
 * shows a shopper — so a floor-clearing row can publish DIRECTLY, with NO
 * per-store verify. A reseller confirms it by pulling up the target.com page.
 *
 * HONESTY: these rows carry NO per-store claim. store_id and quantity stay
 * null (like Best Buy, Walmart, and HD-direct), so DealPage renders the
 * markdown chain-wide ("current online price"), never as a shelf someone
 * counted. The separate per-store fulfillment pass (target-ingest.ts) is a
 * BACKGROUND enrichment that can later attach real shelf counts — it is not a
 * gate on publishing the honest online markdown now.
 *
 * The tiered floor + the >90% data-error ceiling are re-applied by the judge
 * (recordVerdicts); the sweep file is an untrusted input like any other.
 *
 *   DB_DRIVER=postgres npx tsx src/ingest/target-direct-ingest.ts <discovery.json>
 *
 * discovery.json: [{ tcin, title?, price, listPrice, discountPct?, imageUrl?, productUrl? }]
 */

import { readFileSync } from 'node:fs';
import { getDb, type Db } from '../db/client.js';
import { recordVerdicts, type HdVerdictInput } from '../engine/discovery.js';

const RETAILER = 'target';

export interface TargetDirectHit {
  tcin: string | number;
  title?: string | null;
  price: number | null;
  listPrice: number | null;
  discountPct?: number | null;
  imageUrl?: string | null;
  productUrl?: string | null;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Internal consistency — the FLOOR itself is the judge's call, not ours. */
export function directRowSound(h: TargetDirectHit): boolean {
  const price = num(h.price);
  const list = num(h.listPrice);
  if (price === null || list === null) return false;
  if (price <= 0 || list <= 0) return false;      // no price is NOT a $0 deal
  if (list <= price) return false;                 // must be a real markdown
  const pct = Math.round(((list - price) / list) * 100);
  if (pct > 90) return false;                      // data-error ceiling
  if (h.discountPct != null) {
    const stated = num(h.discountPct);
    if (stated !== null && stated > 0 && Math.abs(pct - stated) > 5) return false;
  }
  return true;
}

export async function seedTargetDirect(db: Db, hits: TargetDirectHit[]): Promise<number> {
  let n = 0;
  for (const h of hits) {
    const id = String(h.tcin);
    const r = await db.query(
      `INSERT INTO discovery (retailer, item_id, sku, title, image_url, product_url, source,
                              claimed_price, claimed_list, claimed_discount)
       VALUES ($1, $2, $2, $3, $4, $5, 'target-direct', $6, $7, $8)
       ON CONFLICT (retailer, item_id) DO NOTHING`,
      [
        RETAILER, id,
        (h.title ?? `Target item ${id}`).slice(0, 300),
        h.imageUrl ?? null,
        h.productUrl ?? `https://www.target.com/p/-/A-${id}`,
        num(h.price), num(h.listPrice),
        h.discountPct != null ? num(h.discountPct) : null,
      ],
    );
    n += r.rowCount ?? 0;
  }
  return n;
}

export async function recordTargetDirectVerdicts(
  db: Db,
  hits: TargetDirectHit[],
): Promise<{ published: number; rejected: number; unreachable: number }> {
  const { rows } = await db.query<Record<string, unknown>>(
    `SELECT discovery_id, item_id FROM discovery
      WHERE retailer = $1 AND item_id = ANY($2::text[])`,
    [RETAILER, hits.map((h) => String(h.tcin))],
  );
  const idBy = new Map<string, number>();
  for (const r of rows) idBy.set(String(r.item_id), Number(r.discovery_id));

  const verdicts: HdVerdictInput[] = [];
  for (const h of hits) {
    const discovery_id = idBy.get(String(h.tcin));
    if (discovery_id === undefined) continue;
    const price = num(h.price);
    const list = num(h.listPrice);
    const pct = price !== null && list !== null && list > price
      ? Math.round(((list - price) / list) * 100) : 0;
    verdicts.push({
      discovery_id,
      retailer: RETAILER,
      reachable: price !== null,
      price,
      list_price: list,
      discount_pct: pct,
      // CHAIN-WIDE: this is Target's online markdown, no shelf was counted.
      store_id: null,
      quantity: null,
      discontinued: false,
      alt_price_display: false,
      clearance_price: null,
      clearance_pct: null,
    });
  }
  const out = await recordVerdicts(db, verdicts);
  return { published: out.published, rejected: out.rejected, unreachable: out.unreachable };
}

async function main() {
  const [path] = process.argv.slice(2);
  if (!path) {
    console.error('usage: tsx src/ingest/target-direct-ingest.ts <discovery.json>');
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(path, 'utf8')) as TargetDirectHit[];
  const hits = raw.filter(directRowSound);
  console.log(`consistency guard: ${raw.length} in, ${hits.length} kept, ${raw.length - hits.length} dropped`);

  const db = await getDb();
  const seeded = await seedTargetDirect(db, hits);
  console.log(`discovery seeded (new): ${seeded}`);
  const out = await recordTargetDirectVerdicts(db, hits);
  console.log(`verdicts: ${JSON.stringify(out)}`);
}

if (process.argv[1] && process.argv[1].includes('target-direct-ingest')) {
  main().then(
    () => process.exit(0),
    (e) => { console.error(e); process.exit(1); },
  );
}
