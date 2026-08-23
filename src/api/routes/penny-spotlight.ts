/**
 * GET /api/public/penny-spotlight — a single real penny find, for the
 * marketing landing hero (Blueprint 3, company/blueprints.md).
 *
 * Public and unauthenticated on purpose: the hero's whole pitch is "real
 * scan, not stale scraped leads," so the example on the page has to be real
 * too. Deliberately stripped down — title, discount, a bucketed distance,
 * and a timestamp only. NEVER a store number, NEVER a shelf/stock count
 * (same product rule as /api/deals/nearby), and never the full feed: this
 * is a single-row teaser, not a way around the paywall.
 */

import { Router } from 'express';
import { getDb } from '../../db/client.js';
import { rateLimit, route } from '../middleware.js';
import { resolveZipAnchor, haversineMi } from '../../geo/nearby.js';

export const pennySpotlight = Router();

/** A "penny" find for this purpose — matches the penny page's literal $0.01. */
const PENNY_PRICE_MAX = 0.01;

/** Only surface something recent enough to still read as "just happened." */
const LOOKBACK_DAYS = 14;

function distanceBucket(mi: number): string {
  if (mi < 5) return 'under 5 miles away';
  if (mi < 25) return '5-25 miles away';
  if (mi < 100) return '25-100 miles away';
  return 'over 100 miles away';
}

pennySpotlight.get(
  '/public/penny-spotlight',
  rateLimit({ key: 'penny-spotlight', max: 30, windowMs: 60_000 }),
  route(async (req, res) => {
    const db = await getDb();

    const { rows } = await db.query<Record<string, unknown>>(
      `SELECT f.actual_price, f.recorded_at, f.product_id, f.store_id,
              p.title, st.lat, st.lng
         FROM finds f
         JOIN products p ON p.product_id = f.product_id
         JOIN stores  st ON st.store_id  = f.store_id
        WHERE f.outcome = 'found'
          AND f.actual_price IS NOT NULL
          AND f.actual_price <= $1
          AND f.recorded_at >= now() - ($2 || ' days')::interval
        ORDER BY f.recorded_at DESC
        LIMIT 1`,
      [PENNY_PRICE_MAX, String(LOOKBACK_DAYS)],
    );

    const find = rows[0];
    if (!find || !find.title) {
      return res.json({ found: false });
    }

    // Best-known list price for this product: prefer the same store, fall
    // back to any store, most recent either way. Used only to show the
    // discount — never returned as its own "shop here" price.
    const lp = await db.query<{ list_price: unknown }>(
      `SELECT list_price
         FROM price_observations
        WHERE product_id = $1 AND list_price IS NOT NULL
        ORDER BY (store_id = $2) DESC, observed_at DESC
        LIMIT 1`,
      [find.product_id, find.store_id],
    );
    const listPrice = lp.rows[0]?.list_price === undefined ? null : Number(lp.rows[0].list_price);
    const price = Number(find.actual_price);
    const discountPct =
      listPrice !== null && listPrice > 0
        ? Math.round((1 - price / listPrice) * 100)
        : null;

    // Distance is only ever a coarse bucket, and only when the visitor's ZIP
    // resolves to a real anchor — never a raw mile count, never the store.
    let distance: string | null = null;
    const zip = typeof req.query.zip === 'string' ? req.query.zip.trim() : '';
    const lat = find.lat === null || find.lat === undefined ? null : Number(find.lat);
    const lng = find.lng === null || find.lng === undefined ? null : Number(find.lng);
    if (/^\d{5}$/.test(zip) && lat !== null && lng !== null) {
      const anchor = await resolveZipAnchor(db, zip);
      if (anchor) distance = distanceBucket(haversineMi(anchor.lat, anchor.lng, lat, lng));
    }

    res.json({
      found: true,
      title: String(find.title),
      price,
      list_price: listPrice,
      discount_pct: discountPct,
      distance,
      recorded_at: find.recorded_at,
    });
  }),
);
