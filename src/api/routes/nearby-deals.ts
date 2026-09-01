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
import { requireAuth, isPaidMember, TEASER_LIMIT, rateLimit, route } from '../middleware.js';
import { nearbyStores, type NearbyStore } from '../../geo/nearby.js';
import { EXCLUDE_BUNDLES_SQL, EXCLUDE_HD_REJECTED_SQL } from '../../engine/bundle.js';
import { tieredFloorSql } from '../../engine/deal-floor.js';

export const nearbyDeals = Router();

// Browsing "deals near you" is the hook — free to any visitor (anonymous
// preview or signed-up, paid or not). Membership gates alerts/tracking, not
// looking. Signing up must not remove access a stranger already had.
const browse = [requireAuth];

/** The 25% floor from DESIGN/product rules. A request can raise it, never lower it. */
const MIN_DISCOUNT_FLOOR = 25;

/** Default search radius, in miles. Matches users.radius_mi default of 30. */
const DEFAULT_RADIUS_MI = 30;
const MAX_RADIUS_MI = 100;

const num = (v: unknown): number | null =>
  v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null;

nearbyDeals.get(
  '/deals/nearby',
  ...browse,
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

    // 1. Place the ZIP, then take the NEAREST 5 STORES (within a generous
    //    radius so a rural ZIP still gets stores). Per deal we later pick which
    //    of these 5 to show — the one that actually has the most stock, not the
    //    closest one, because the closest store is often the one with 0 left.
    const NEAREST_N = 5;
    const { anchor, stores } = await nearbyStores(db, {
      zip,
      radiusMi: MAX_RADIUS_MI,
      retailer,
      limit: NEAREST_N,
    });

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

    // The deal CATALOG is national — a clearance SKU is marked down chain-wide,
    // not native to one store — so the SAME deal list shows in every ZIP. What
    // is local is STOCK, which we overlay per deal, shown even when it is 0 or
    // unknown. "0 near you" is real information: the deal exists, just not on a
    // nearby shelf right now. This is why an empty-store ZIP still lists deals.
    const byId = new Map<string, NearbyStore>(stores.map((s) => [s.store_id, s]));
    const nearbyIds = stores.map((s) => s.store_id);

    // 1) National catalog: one row per product (best discount), over the floor.
    const cat = await db.query<Record<string, unknown>>(
      `SELECT DISTINCT ON (s.product_id)
              s.product_id, p.item_id, p.retailer, p.title, p.image_url, p.product_url, p.category,
              s.last_price, s.last_discount, s.stage
         FROM sku_state s
         JOIN products p ON p.product_id = s.product_id
        WHERE COALESCE(s.last_discount, 0) >= $1
          AND ($2::text IS NULL OR p.retailer = $2)
          -- Price-tiered floor: cheap items must be marked down harder to be a
          -- real reseller deal. See deal-floor.ts.
          AND ${tieredFloorSql('s.last_price', 's.last_discount')}
          -- Delivery-only bundles have no real shelf stock; hide them. See bundle.ts.
          AND ${EXCLUDE_BUNDLES_SQL}
          -- Home Depot said no; see bundle.ts + discovery pool.
          AND ${EXCLUDE_HD_REJECTED_SQL}
        ORDER BY s.product_id, s.last_discount DESC NULLS LAST`,
      [minDiscount, retailer],
    );
    const catalog = cat.rows
      .sort((a, b) => (num(b.last_discount) ?? 0) - (num(a.last_discount) ?? 0))
      .slice(0, limit);

    // 2) Local stock overlay: the nearest nearby store carrying each product.
    const productIds = catalog.map((r) => String(r.product_id));
    const stockByProduct = new Map<string, { qty: number | null; store: NearbyStore }>();
    if (productIds.length > 0 && nearbyIds.length > 0) {
      const st = await db.query<Record<string, unknown>>(
        `SELECT product_id, store_id, last_stock
           FROM sku_state
          WHERE product_id = ANY($1::text[]) AND store_id = ANY($2::text[])`,
        [productIds, nearbyIds],
      );
      for (const r of st.rows) {
        const pid = String(r.product_id);
        const store = byId.get(String(r.store_id));
        if (!store) continue;
        const qty = num(r.last_stock);
        const prev = stockByProduct.get(pid);
        // Show the store with the MOST stock among the nearest 5; break ties by
        // distance. A treated-as -1 lets a real 0 still beat "no record".
        const q = qty ?? -1;
        const pq = prev ? (prev.qty ?? -1) : -2;
        if (!prev || q > pq || (q === pq && store.distance_mi < prev.store.distance_mi)) {
          stockByProduct.set(pid, { qty, store });
        }
      }
    }

    const deals = catalog.map((r) => {
      const pid = String(r.product_id);
      const price = num(r.last_price);
      const disc = num(r.last_discount);
      const listPrice =
        price !== null && disc !== null && disc > 0 && disc < 100
          ? Math.round((price / (1 - disc / 100)) * 100) / 100
          : null;
      const local = stockByProduct.get(pid);
      return {
        product_id: pid,
        // Canonical URL id — lets the client key nearby cards the SAME way as the
        // published feed (`retailer:item_id`), so the "stock near you" overlay
        // joins and a Closest-to-me click resolves in DealPage. products carries
        // two HD ids: product_id is the store SKU, item_id is the canonical URL id.
        item_id: r.item_id != null ? String(r.item_id) : null,
        // The specific store this card's stock belongs to, so the detail screen
        // opens the SAME store and its numbers match the card. Null when no
        // nearby store has a record for this deal.
        store_id: local ? local.store.store_id : null,
        retailer: r.retailer,
        title: r.title ?? null,
        category: r.category ?? null,
        image_url: r.image_url ?? null,
        product_url: r.product_url ?? null,
        price,
        original_price: listPrice,
        discount_pct: disc,
        in_store_only: r.stage === 'penny_candidate' || r.stage === 'delisted',
        // Stock at the nearest nearby store, shown even when 0. qty null means we
        // have no local record at all (no swept store near this ZIP yet); a
        // number (including 0) is a real nearby count.
        stock: {
          qty: local ? local.qty : null,
          store: local
            ? {
                name: local.store.name,
                city: local.store.city,
                state: local.store.state,
                distance_mi: local.store.distance_mi,
              }
            : null,
        },
      };
    });

    // Teaser paywall (same as published): members get the full nearby feed,
    // everyone else the first TEASER_LIMIT with the real total + a locked flag.
    const paidMember = isPaidMember(req);
    const shown = paidMember ? deals : deals.slice(0, TEASER_LIMIT);
    res.json({
      zip,
      radius_mi: radiusMi,
      located: true,
      anchor_precision: anchor.source,
      min_discount: minDiscount,
      count: shown.length,
      total: deals.length,
      locked: !paidMember && deals.length > shown.length,
      nearby_stores: stores.length,
      // The nearest store's NUMBER — never printed on a card (product rule),
      // but used inside Home Depot links (?store=NNN) so HD opens already in
      // the customer's store mode, showing THAT store's shelf availability.
      // Verified 2026-08-22: the ?store= param switches homedepot.com's store
      // context (header, pickup section, stock state).
      nearest_store_number: stores[0]?.store_number ?? null,
      deals: shown,
    });
  }),
);
