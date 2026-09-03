/**
 * HD hidden-clearance ingest — publish the GraphQL scanner's per-store reads.
 *
 * Input is the JSON from scripts/hd-clearance-scan-gql.mts: one record per
 * (item, store) reading of HD's federation-gateway `pricing`. This module turns
 * those raw readings into published deals, reusing the SAME judge every other
 * retailer goes through (src/engine/discovery.ts → recordVerdicts):
 *
 *   1. GROUP by item. `discovery` is keyed (retailer, item_id) — one row per SKU,
 *      not per store — so we collapse each item's store readings into ONE verdict
 *      that quotes the BEST (lowest) real price found and names the store it's at.
 *   2. CLASSIFY. Hidden clearance (pricing.clearance.value below the shelf value)
 *      wins over a plain markdown (value < original) — it's the category this
 *      product is named after. clearance_store + clearance_stores_checked make the
 *      "as low as $X at <store>, checked N stores" claim honest.
 *   3. JUDGE. recordVerdicts re-applies the tiered floor + 90% ceiling and only
 *      publishes what clears it. A reading with no deal is never seeded, so it
 *      can't reach the feed as "Varies by store".
 *
 * HONESTY: every price here is a real number HD's own API returned for a named
 * store — nothing is inferred. Items with no markdown and no clearance are dropped.
 *
 *   DB_DRIVER=postgres npx tsx src/ingest/hd-clearance-ingest.ts <reads.json>
 */

import { readFileSync } from 'node:fs';
import { getDb, type Db } from '../db/client.js';
import { recordVerdicts, type HdVerdictInput } from '../engine/discovery.js';

const RETAILER = 'homedepot';

/** Mirrors ScanRecord in scripts/hd-clearance-scan-gql.mts (kept in sync by hand). */
interface ScanRecord {
  itemId: string;
  storeId: string;
  brand: string | null;
  label: string | null;
  model: string | null;
  imageUrl: string | null;
  value: number | null;
  original: number | null;
  alt: boolean | null;
  clearanceValue: number | null;
  clearancePct: number | null;
  error?: string;
}

/** One item's best deal across the stores we read, ready to seed + judge. */
export interface ItemDeal {
  itemId: string;
  title: string;
  imageUrl: string | null;
  productUrl: string;
  seedPrice: number;          // the deal price (goes to discovery.claimed_price)
  seedList: number | null;    // the was/shelf price (discovery.claimed_list)
  verdict: Omit<HdVerdictInput, 'discovery_id'>;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const pctOff = (from: number, to: number) => Math.round(((from - to) / from) * 100);

/**
 * Collapse every (item, store) reading into one best-deal-per-item. Hidden
 * clearance is preferred over a markdown; within a kind, the lowest price wins.
 */
export function aggregate(records: ScanRecord[]): ItemDeal[] {
  const byItem = new Map<string, ScanRecord[]>();
  for (const r of records) {
    if (!r.itemId) continue;
    (byItem.get(r.itemId) ?? byItem.set(r.itemId, []).get(r.itemId)!).push(r);
  }

  const deals: ItemDeal[] = [];
  for (const [itemId, reads] of byItem) {
    const answered = reads.filter((r) => r.value != null);
    const storesChecked = answered.length;
    if (!storesChecked) continue;

    const meta = (answered.find((r) => r.label) ?? answered[0])!;
    const title = [meta.brand, meta.label].filter(Boolean).join(' ').slice(0, 300) || `HD item ${itemId}`;
    const productUrl = `https://www.homedepot.com/p/${itemId}`;
    const imageUrl = (answered.find((r) => r.imageUrl)?.imageUrl) ?? null;

    // Hidden clearance: a clearance.value strictly below that store's shelf value.
    const hidden = answered
      .filter((r) => r.clearanceValue != null && r.value != null && r.clearanceValue < r.value)
      .sort((a, b) => a.clearanceValue! - b.clearanceValue!)[0];

    if (hidden) {
      const shelf = hidden.value!;
      const clr = round2(hidden.clearanceValue!);
      const clrPct = hidden.clearancePct != null ? Math.round(hidden.clearancePct) : pctOff(shelf, clr);
      deals.push({
        itemId, title, imageUrl, productUrl,
        seedPrice: clr, seedList: round2(shelf),
        verdict: {
          reachable: true, retailer: RETAILER,
          price: round2(shelf), list_price: hidden.original != null ? round2(hidden.original) : round2(shelf),
          discount_pct: 0,
          store_id: hidden.storeId, quantity: null, discontinued: false,
          alt_price_display: true,
          clearance_price: clr, clearance_pct: clrPct,
          clearance_store: hidden.storeId, clearance_stores_checked: storesChecked,
        },
      });
      continue;
    }

    // Plain markdown: value < original. Take the lowest value across stores.
    const markdown = answered
      .filter((r) => r.original != null && r.value != null && r.value < r.original)
      .sort((a, b) => a.value! - b.value!)[0];

    if (markdown) {
      const price = round2(markdown.value!);
      const list = round2(markdown.original!);
      deals.push({
        itemId, title, imageUrl, productUrl,
        seedPrice: price, seedList: list,
        verdict: {
          reachable: true, retailer: RETAILER,
          price, list_price: list, discount_pct: pctOff(list, price),
          store_id: markdown.storeId, quantity: null, discontinued: false,
          alt_price_display: false,
          clearance_price: null, clearance_pct: null,
          clearance_store: markdown.storeId, clearance_stores_checked: storesChecked,
        },
      });
    }
    // else: no deal at any store — never seeded, never shown.
  }
  return deals;
}

/** Seed discovery rows for the deal items (idempotent on (retailer, item_id)). */
export async function seedDeals(db: Db, deals: ItemDeal[]): Promise<number> {
  let n = 0;
  for (const d of deals) {
    const r = await db.query(
      `INSERT INTO discovery (retailer, item_id, sku, title, image_url, product_url, source,
                              claimed_price, claimed_list)
       VALUES ($1, $2, $2, $3, $4, $5, 'hd-clearance-gql', $6, $7)
       ON CONFLICT (retailer, item_id) DO UPDATE
         SET title = EXCLUDED.title,
             image_url = COALESCE(EXCLUDED.image_url, discovery.image_url)`,
      [RETAILER, d.itemId, d.title, d.imageUrl, d.productUrl, d.seedPrice, d.seedList],
    );
    n += r.rowCount ?? 0;
  }
  return n;
}

/** Publish: seed, resolve discovery ids, judge every item's verdict. */
export async function ingestClearanceReads(
  db: Db,
  records: ScanRecord[],
): Promise<{ items: number; published: number; hidden_clearance: number; rejected: number }> {
  const deals = aggregate(records);
  if (!deals.length) return { items: 0, published: 0, hidden_clearance: 0, rejected: 0 };

  await seedDeals(db, deals);

  const { rows } = await db.query<Record<string, unknown>>(
    `SELECT discovery_id, item_id FROM discovery
      WHERE retailer = $1 AND item_id = ANY($2::text[])`,
    [RETAILER, deals.map((d) => d.itemId)],
  );
  const idBy = new Map<string, number>();
  for (const r of rows) idBy.set(String(r.item_id), Number(r.discovery_id));

  const verdicts: HdVerdictInput[] = [];
  for (const d of deals) {
    const discovery_id = idBy.get(d.itemId);
    if (discovery_id === undefined) continue;
    verdicts.push({ discovery_id, ...d.verdict });
  }
  const out = await recordVerdicts(db, verdicts);
  return { items: deals.length, published: out.published, hidden_clearance: out.hidden_clearance, rejected: out.rejected };
}

async function main() {
  const [path] = process.argv.slice(2);
  if (!path) {
    console.error('usage: tsx src/ingest/hd-clearance-ingest.ts <reads.json>');
    process.exit(1);
  }
  const records = JSON.parse(readFileSync(path, 'utf8')) as ScanRecord[];
  const db = await getDb();
  const out = await ingestClearanceReads(db, records);
  console.log(
    `HD clearance ingest: ${records.length} reads → ${out.items} item-deals → ` +
    `published ${out.published} (${out.hidden_clearance} hidden clearance), rejected ${out.rejected}`,
  );
  process.exit(0);
}

if (process.argv[1] && process.argv[1].includes('hd-clearance-ingest')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
