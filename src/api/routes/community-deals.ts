/**
 * Community-reported deals — GET /api/community-deals?kind=penny|clearance
 *
 * Serves community_reports (see schema.sql): crowd finds ingested from public
 * sources. These are HEARSAY, not our sweep's observations — the client must
 * always label them "reported by the community" and never present them as
 * verified stock. The penny tab is the main consumer: $0.01 is register-only,
 * so community reports are the only penny leads that exist.
 */

import { Router } from 'express';
import { getDb } from '../../db/client.js';
import { requireAuth, requirePlan, rateLimit, route } from '../middleware.js';
import { tieredFloorSql } from '../../engine/deal-floor.js';

export const communityDeals = Router();

const paid = [requireAuth, requirePlan('consumer', 'reseller')];

communityDeals.get(
  '/community-deals',
  ...paid,
  rateLimit({ key: 'community', max: 60, windowMs: 60_000 }),
  route(async (req, res) => {
    const db = await getDb();
    const kind = req.query.kind === 'clearance' ? 'clearance' : 'penny';
    const limit = Math.min(Number(req.query.limit ?? 100) || 100, 200);

    // Clearance hearsay still clears the tiered floor at read time (belt and
    // suspenders with the ingest-time check); pennies are 100%-off by nature.
    const floor = kind === 'clearance' ? `AND ${tieredFloorSql('price', 'discount_pct')}` : '';

    const { rows } = await db.query<Record<string, unknown>>(
      `SELECT report_id, source, kind, sku, item_id, title, price, list_price,
              discount_pct, state, city, store_number, product_url, source_url,
              image_url, reported_at, fetched_at
         FROM community_reports
        WHERE kind = $1 ${floor}
        ORDER BY COALESCE(reported_at, fetched_at) DESC
        LIMIT $2`,
      [kind, limit],
    );

    res.json({ kind, count: rows.length, reports: rows });
  }),
);
