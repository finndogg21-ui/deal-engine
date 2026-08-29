/**
 * Home Depot per-store inventory ingest — the free multi-store harvest.
 *
 * ONE `productClientOnlyProduct` call (with a zipCode) returns the shelf
 * quantity for EVERY nearby store; `parseHdStoreLocations` (src/vendors/
 * hd-direct.ts) now keeps them all instead of discarding all but the anchor.
 * This module lands those readings in `store_inventory` so the per-ZIP nearby
 * feed can show real stock — for $0 extra, because the fetch already happened.
 *
 * Same handoff as Target: the browser fetches (HD's Akamai blocks our server),
 * flattens each item's stores into `HdInventoryHit` rows, and drops JSON here;
 * this module owns the DB write.
 *
 * HONESTY (inherited from docs/nationwide-zip-deals-plan.md):
 *   - A null quantity stays null. "Not counted" is never written as "0 units".
 *   - A vendor error is NOT a row. The browser only sends real readings, so a
 *     failed fetch never reaches here and can never null a shelf.
 *   - A store needs a `stores` row (FK). We upsert it name-only; a row with no
 *     lat/lng simply won't surface in the distance-ranked feed until a store
 *     directory seeds coordinates — that seed is the NEXT step, not this one.
 *
 *   DB_DRIVER=postgres npx tsx src/ingest/homedepot-inventory-ingest.ts <facts.json>
 *   facts.json: [{ itemId, storeId, storeName?, quantity, inStock?,
 *                  priceCents?, origPriceCents?, discountPct? }]
 */

import { readFileSync } from 'node:fs';
import { getDb, type Db } from '../db/client.js';

const RETAILER = 'homedepot';

export interface HdInventoryHit {
  /** HD Internet # — becomes store_inventory.sku (joins products on retailer+sku). */
  itemId: string | number;
  /** Store number (HD locationId). */
  storeId: string | number;
  storeName?: string | null;
  /** Units on the shelf. null = HD did not say — never written as 0. */
  quantity: number | null;
  inStock?: boolean | null;
  priceCents?: number | null;
  origPriceCents?: number | null;
  discountPct?: number | null;
}

/** A real "present" reading: HD said in-stock, or gave a positive count. */
const present = (h: HdInventoryHit): boolean =>
  h.inStock === true || (typeof h.quantity === 'number' && h.quantity > 0);

/**
 * Upsert the stores these hits reference — the FK `store_inventory` needs. Name
 * only; coordinates come from a separate store-directory seed, so a freshly
 * learned store is captured now and becomes feed-visible once it has lat/lng.
 */
export async function seedHdStores(db: Db, hits: HdInventoryHit[]): Promise<number> {
  const seen = new Set<string>();
  let n = 0;
  for (const h of hits) {
    const numStr = String(h.storeId ?? '').trim();
    if (!numStr || seen.has(numStr)) continue;
    seen.add(numStr);
    await db.query(
      `INSERT INTO stores (store_id, retailer, store_number, name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (store_id) DO UPDATE
         SET name = COALESCE(EXCLUDED.name, stores.name)`,
      [`${RETAILER}:${numStr}`, RETAILER, numStr, h.storeName ?? null],
    );
    n++;
  }
  return n;
}

/**
 * Persist every nearby store's HD shelf reading into `store_inventory`.
 * Advances the three clocks honestly: `last_checked_at` always (we looked),
 * `last_seen_at` only when present, `last_changed_at` only when the count moved.
 */
export async function recordHdStoreInventory(
  db: Db,
  hits: HdInventoryHit[],
): Promise<{ stores: number; inventory: number }> {
  const stores = await seedHdStores(db, hits); // FK: the store row must exist first
  let inventory = 0;
  for (const h of hits) {
    const seen = present(h);
    await db.query(
      `INSERT INTO store_inventory
         (retailer, sku, store_id, quantity, in_stock, price_cents, orig_price_cents,
          discount_pct, source, state, last_seen_at, last_checked_at, last_changed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'hd:fulfillment', 'live',
               CASE WHEN $9 THEN now() END, now(), now())
       ON CONFLICT (retailer, sku, store_id) DO UPDATE
         SET quantity = EXCLUDED.quantity,
             in_stock = EXCLUDED.in_stock,
             price_cents = EXCLUDED.price_cents,
             orig_price_cents = EXCLUDED.orig_price_cents,
             discount_pct = EXCLUDED.discount_pct,
             state = 'live',
             last_checked_at = now(),
             last_seen_at = CASE WHEN $9 THEN now() ELSE store_inventory.last_seen_at END,
             last_changed_at = CASE WHEN store_inventory.quantity IS DISTINCT FROM EXCLUDED.quantity
                                    THEN now() ELSE store_inventory.last_changed_at END`,
      [
        RETAILER,
        String(h.itemId),
        `${RETAILER}:${h.storeId}`,
        h.quantity,
        h.inStock ?? (typeof h.quantity === 'number' ? h.quantity > 0 : null),
        h.priceCents ?? null,
        h.origPriceCents ?? null,
        h.discountPct ?? null,
        seen,
      ],
    );
    inventory++;
  }
  return { stores, inventory };
}

async function main() {
  const [path] = process.argv.slice(2);
  if (!path) {
    console.error('usage: tsx src/ingest/homedepot-inventory-ingest.ts <facts.json>');
    process.exit(1);
  }
  const hits = JSON.parse(readFileSync(path, 'utf8')) as HdInventoryHit[];
  const db = await getDb();
  const { stores, inventory } = await recordHdStoreInventory(db, hits);
  console.log(`stores upserted: ${stores}, store_inventory rows: ${inventory}`);

  // Show the multi-store spread we just captured — the whole point of Phase 0.
  const { rows } = await db.query<Record<string, unknown>>(
    `SELECT sku, count(*)::int AS stores,
            count(*) FILTER (WHERE quantity > 0)::int AS in_stock_stores
       FROM store_inventory
      WHERE retailer = 'homedepot' AND source = 'hd:fulfillment'
      GROUP BY sku ORDER BY stores DESC LIMIT 5`,
  );
  for (const r of rows) {
    console.log(`  item ${r.sku}: ${r.stores} stores captured, ${r.in_stock_stores} in stock`);
  }
  process.exit(0);
}

if (process.argv[1] && process.argv[1].endsWith('homedepot-inventory-ingest.ts')) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
