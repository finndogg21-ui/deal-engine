/**
 * Nationwide in-store clearance feed — GET /api/deals/nearby?zip=&retailer=&min_discount=
 *
 * "Enter any US ZIP, see nearby in-store clearance deals." Served entirely from
 * our own DB (store_inventory joined to nearby stores), never a live scrape —
 * which is what makes it fast, and what lets cost scale with ingest rather than
 * with reads. This mirrors the competitor's /leads/nearby, minus the live part.
 *
 * PRODUCT RULES enforced here (not in the client — the client is not a rule):
 *   - Cards are "Possible Deals". The stock is community/vendor-sourced and can
 *     be stale, so the framing hedges and the copy never promises it is there.
 *   - MINIMUM DISCOUNT FLOOR IS 25%. 5-10% off is retail noise; a feed full of
 *     it trains people to ignore the feed. The floor is clamped server-side so
 *     a smaller ?min_discount can't lower it.
 *   - NEVER put a raw store NUMBER or a shelf COUNT on a card. The store number
 *     is an internal key, and an exact quantity reads as a live guarantee we
 *     are not making. Cards show a store NAME, area, distance, and a coarse
 *     availability state — never "Store #6550" and never "3 left".
 *   - Only rows in a feed-visible state (live | aging) are returned. stale /
 *     presumed_gone / archived are hidden: showing likely-gone stock is the
 *     wasted-drive failure.
 *
 * The penny page stays literal and lives elsewhere (GET /api/candidates?penny=1).
 * This endpoint is the broad "possible deals near you" feed, not the penny one.
 */

import { Router } from 'express';
import { getDb } from '../../db/client.js';
import { requireAuth, requirePlan, rateLimit, route } from '../middleware.js';
import { nearbyStores, type NearbyStore } from '../../geo/nearby.js';

export const nearbyDeals = Router();

// Deal data is the product, so reading it is the paywall — same gate as
// /api/candidates. (A limited public teaser could mirror the competitor's
// funnel later; see the plan. It would be a separate, capped handler.)
const paid = [requireAuth, requirePlan('consumer', 'reseller')];

/** The 25% floor from DESIGN/product rules. A request can raise it, never lower it. */
const MIN_DISCOUNT_FLOOR = 25;

/** Default search radius, in miles. Matches users.radius_mi default of 30. */
const DEFAULT_RADIUS_MI = 30;
const MAX_RADIUS_MI = 100;

const num = (v: unknown): number | null =>
  v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null;

nearbyDeals.get(
  '/deals/nearby',
  ...paid,
  rateLimit({ key: 'nearby', max: 60, windowMs: 60_000 }),
  route(async (req, res) => {
    const db = await getDb();

    const zip = String(req.query.zip ?? req.user!.zip ?? '').trim();
    if (!/^\d{5}$/.test(zip)) {
      return res.status(400).json({ error: 'Enter a 5-digit ZIP code.' });
    }

    const retailer =
      typeof req.query.retailer === 'string' && req.query.retailer.trim()
        ? req.query.retailer.trim().toLowerCase()
        : null;

    // Clamp the discount to the floor: a smaller value is raised, never honored.
    const requested = Number(req.query.min_discount ?? MIN_DISCOUNT_FLOOR);
    const minDiscount = Math.max(
      MIN_DISCOUNT_FLOOR,
      Number.isFinite(requested) ? requested : MIN_DISCOUNT_FLOOR,
    );

    const radiusMi = Math.min(
      Math.max(Number(req.query.radius ?? DEFAULT_RADIUS_MI) || DEFAULT_RADIUS_MI, 1),
      MAX_RADIUS_MI,
    );

    const limit = Math.min(Number(req.query.limit ?? 100) || 100, 200);

    // 1. Place the ZIP and find the stores around it.
    const { anchor, stores } = await nearbyStores(db, { zip, radiusMi, retailer });

    // ZIP we cannot place yet. Be honest — this is a data gap, not "no deals".
    // (Until a ZIP-centroid source is wired in, this is any ZIP with no store
    //  of ours in its area. See src/geo/nearby.ts and the plan.)
    if (!anchor) {
      return res.json({
        zip,
        radius_mi: radiusMi,
        located: false,
        message:
          'We don\'t have a store mapped near that ZIP yet, so we can\'t place you on the map. ' +
          'This is a coverage gap, not an empty shelf — nearby deals will appear here as we ' +
          'expand.',
        deals: [],
      });
    }

    if (stores.length === 0) {
      return res.json({ zip, radius_mi: radiusMi, located: true, deals: [] });
    }

    const byId = new Map<string, NearbyStore>(stores.map((s) => [s.store_id, s]));
    const storeIds = stores.map((s) => s.store_id);

    // 2. Read the projection for exactly those stores. Join products on
    //    (retailer, sku) for display — store_inventory has no products FK by
    //    design, so this LEFT JOIN is how a card gets its title/image.
    const { rows } = await db.query<Record<string, unknown>>(
      `SELECT si.retailer, si.sku, si.store_id,
              si.price_cents, si.orig_price_cents, si.discount_pct,
              si.in_stock, si.state, si.aisle, si.aisle_source,
              si.last_seen_at, si.last_checked_at,
              p.title, p.image_url, p.product_url, p.category
         FROM store_inventory si
         LEFT JOIN products p
                ON p.retailer = si.retailer AND p.sku = si.sku
        WHERE si.store_id = ANY($1::text[])
          AND si.state IN ('live', 'aging')
          AND COALESCE(si.discount_pct, 0) >= $2
          AND ($3::text IS NULL OR si.retailer = $3)
        ORDER BY si.discount_pct DESC NULLS LAST, si.last_seen_at DESC NULLS LAST
        LIMIT $4`,
      [storeIds, minDiscount, retailer, limit],
    );

    const deals = rows.map((r) => {
      const store = byId.get(String(r.store_id));
      const priceCents = num(r.price_cents);
      const origCents = num(r.orig_price_cents);
      return {
        // Identity a client needs to open the detail / record a find. product_id
        // is the same "{retailer}:{sku}" key the rest of the API uses.
        product_id: `${r.retailer}:${r.sku}`,
        retailer: r.retailer,
        title: r.title ?? null,
        category: r.category ?? null,
        image_url: r.image_url ?? null,
        product_url: r.product_url ?? null,

        // Money, in dollars for display. Clearance price is the hero.
        price: priceCents === null ? null : Math.round(priceCents) / 100,
        original_price: origCents === null ? null : Math.round(origCents) / 100,
        discount_pct: num(r.discount_pct),

        // Location: name + area + distance ONLY. No store_number (internal key),
        // no quantity (a count reads as a live promise we aren't making).
        store: store
          ? {
              name: store.name,
              city: store.city,
              state: store.state,
              distance_mi: store.distance_mi,
            }
          : null,
        // Aisle is location guidance, not a count — the competitor surfaces it
        // and it helps in a big-box store. aisle_source lets the UI grade a
        // staff-verified aisle vs a shopper guess.
        aisle: r.aisle ?? null,
        aisle_source: r.aisle_source ?? null,

        // Coarse availability, never a number. 'live' = recently confirmed,
        // 'aging' = older, treat as possible. This is why cards say "Possible".
        availability: r.state,
        in_store_only: true,
        last_seen_at: r.last_seen_at ?? null,
      };
    });

    res.json({
      zip,
      radius_mi: radiusMi,
      located: true,
      // How precisely we placed the ZIP, so a client can caveat distances when
      // the anchor is only a prefix match rather than an exact-ZIP store.
      anchor_precision: anchor.source,
      min_discount: minDiscount,
      count: deals.length,
      deals,
    });
  }),
);
