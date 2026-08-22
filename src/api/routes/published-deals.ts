/**
 * GET /api/deals/published — the HD-verified feed.
 *
 * Every row here was checked against Home Depot's own store-level endpoint:
 * real price, real markdown clearing the price-tiered floor, real units on a
 * store floor. Nothing reaches this endpoint on a scraper's word.
 */

import { Router } from 'express';
import { getDb } from '../../db/client.js';
import { requireAuth, requirePlan, rateLimit, route } from '../middleware.js';
import { publishedDeals } from '../../engine/discovery.js';

export const publishedDealsRoute = Router();

const paid = [requireAuth, requirePlan('consumer', 'reseller')];

publishedDealsRoute.get(
  '/deals/published',
  ...paid,
  rateLimit({ key: 'published', max: 60, windowMs: 60_000 }),
  route(async (req, res) => {
    const limitRaw = Number(req.query.limit ?? 200);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 200, 1), 200);
    const rows = await publishedDeals(await getDb(), limit);
    res.json({ count: rows.length, deals: rows });
  }),
);
