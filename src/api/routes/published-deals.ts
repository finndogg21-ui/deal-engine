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
    const db = await getDb();
    const rows = await publishedDeals(db, limit);

    // THE LEDGER: exact units per store, attached per deal.
    //
    // Zeros are included on purpose — a store with none is what makes a store
    // with three mean anything. A store we have never counted is simply absent
    // from the list (the UI prints "—" for it), because unknown is not zero.
    const keys = rows
      .map((r) => ({
        retailer: String(r.retailer ?? 'homedepot'),
        sku: String(r.sku ?? r.item_id ?? ''),
      }))
      .filter((k) => k.sku !== '');

    const ledger = new Map<
      string,
      Array<{ store: string; qty: number | null; distance_mi: number | null }>
    >();

    if (keys.length > 0) {
      const inv = await db.query<Record<string, unknown>>(
        `SELECT si.retailer, si.sku, si.quantity,
                COALESCE(s.name, s.city) AS store_name
           FROM store_inventory si
           JOIN stores s ON s.store_id = si.store_id
          WHERE si.state IN ('live', 'aging')
            AND si.retailer = ANY($1::text[])
            AND si.sku = ANY($2::text[])`,
        [
          [...new Set(keys.map((k) => k.retailer))],
          [...new Set(keys.map((k) => k.sku))],
        ],
      );
      for (const r of inv.rows) {
        const key = `${String(r.retailer)}:${String(r.sku)}`;
        const list = ledger.get(key) ?? [];
        list.push({
          store: String(r.store_name ?? 'Store'),
          qty: r.quantity === null || r.quantity === undefined ? null : Number(r.quantity),
          distance_mi: null,
        });
        ledger.set(key, list);
      }
    }

    const deals = rows.map((r) => ({
      ...r,
      stores:
        ledger.get(`${String(r.retailer ?? 'homedepot')}:${String(r.sku ?? r.item_id ?? '')}`) ?? [],
    }));

    res.json({ count: deals.length, deals });
  }),
);
