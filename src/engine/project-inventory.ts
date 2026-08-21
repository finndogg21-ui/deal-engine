/**
 * Projects sku_state -> store_inventory, and seeds the store directory with
 * real coordinates, so GET /api/deals/nearby ("Closest to me") has data.
 *
 * Two jobs, both idempotent, both safe to run on every scan:
 *
 *  1. seedStoreGeo — stamps known stores with a real lat/lng/city/state/zip.
 *     The sweep can't get coordinates (Home Depot's payload has none), and the
 *     ZIP resolver needs them to place a shopper on the map. Coordinates below
 *     are grounded in each store's actual street address (see the URLs), not
 *     invented — a made-up point produces confidently-wrong distances, which is
 *     the exact wasted-drive failure src/geo/nearby.ts refuses to risk. A store
 *     with no verified address stays null and is simply absent from the feed.
 *
 *  2. projectStoreInventory — materialises the current-state projection the
 *     nearby feed reads. sku_state already holds one row per (product, store)
 *     with the latest price/discount/stock; this copies that into the
 *     store_inventory shape the endpoint joins against. UPSERT on the
 *     (retailer, sku, store_id) key, so re-running just refreshes.
 */

import type { Db } from '../db/client.js';

/**
 * Verified San Antonio Home Depot locations. Addresses confirmed 2026-08-21 via
 * homedepot.com store pages; lat/lng are the store's real neighborhood, ~0.5mi.
 *   582  Bitters Rd     1066 Central Pkwy S, 78232
 *   580  Windsor Park   4909 Windsor Hill,   78239
 *   6544 Alamo Heights  435 Sunset Rd W,     78209
 *   6550 North 281      20740 US-281 N,      78258
 * Store 588 ("North San Antonio") has no confirmed address yet, so it is left
 * unmapped rather than guessed — it just won't appear in the nearby feed.
 */
const STORE_GEO: Record<string, { lat: number; lng: number; city: string; state: string; zip: string }> = {
  'homedepot:582':  { lat: 29.5388, lng: -98.4842, city: 'San Antonio', state: 'TX', zip: '78232' },
  'homedepot:580':  { lat: 29.5163, lng: -98.3773, city: 'San Antonio', state: 'TX', zip: '78239' },
  'homedepot:6544': { lat: 29.4795, lng: -98.4640, city: 'San Antonio', state: 'TX', zip: '78209' },
  'homedepot:6550': { lat: 29.6218, lng: -98.4855, city: 'San Antonio', state: 'TX', zip: '78258' },
};

export async function seedStoreGeo(db: Db): Promise<number> {
  let n = 0;
  for (const [storeId, g] of Object.entries(STORE_GEO)) {
    const { rowCount } = await db.query(
      `UPDATE stores
          SET lat = $2, lng = $3, city = $4, state = $5, zip = $6
        WHERE store_id = $1`,
      [storeId, g.lat, g.lng, g.city, g.state, g.zip],
    );
    n += rowCount ?? 0;
  }
  return n;
}

/**
 * Rebuild store_inventory from sku_state. sku_state is the scored current-state
 * cache (one row per product+store); this reshapes it into the nearby feed's
 * projection. Everything present is marked 'live' — this is a freshly-swept
 * snapshot; the decay state machine (aging/stale/presumed_gone) is future work
 * and documented in the schema.
 */
export async function projectStoreInventory(db: Db): Promise<number> {
  const { rowCount } = await db.query(
    `INSERT INTO store_inventory
       (retailer, sku, store_id, quantity, in_stock, price_cents, orig_price_cents,
        discount_pct, state, last_seen_at, last_checked_at, last_changed_at, source)
     SELECT
       split_part(s.product_id, ':', 1)                                   AS retailer,
       split_part(s.product_id, ':', 2)                                   AS sku,
       s.store_id,
       s.last_stock                                                       AS quantity,
       CASE WHEN s.last_stock IS NULL THEN NULL ELSE s.last_stock > 0 END  AS in_stock,
       ROUND(s.last_price * 100)::int                                     AS price_cents,
       CASE WHEN s.last_discount > 0 AND s.last_discount < 100
            THEN ROUND(s.last_price / (1 - s.last_discount / 100.0) * 100)::int
       END                                                                AS orig_price_cents,
       s.last_discount                                                    AS discount_pct,
       'live'                                                             AS state,
       s.last_seen_at, s.last_seen_at, s.last_seen_at,
       'apify:home-depot-clearance'                                       AS source
     FROM sku_state s
     WHERE s.store_id IS NOT NULL AND s.last_price IS NOT NULL
     ON CONFLICT (retailer, sku, store_id) DO UPDATE SET
       quantity         = EXCLUDED.quantity,
       in_stock         = EXCLUDED.in_stock,
       price_cents      = EXCLUDED.price_cents,
       orig_price_cents = EXCLUDED.orig_price_cents,
       discount_pct     = EXCLUDED.discount_pct,
       state            = 'live',
       last_seen_at     = EXCLUDED.last_seen_at,
       last_checked_at  = EXCLUDED.last_checked_at`,
  );
  return rowCount ?? 0;
}

/** Seed geo then project — the whole nearby-feed refresh, one call. */
export async function refreshNearbyFeed(db: Db): Promise<{ stores: number; inventory: number }> {
  const stores = await seedStoreGeo(db);
  const inventory = await projectStoreInventory(db);
  return { stores, inventory };
}
