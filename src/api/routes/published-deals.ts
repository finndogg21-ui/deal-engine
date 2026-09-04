/**
 * GET /api/deals/published — the HD-verified feed.
 *
 * Every row here was checked against Home Depot's own store-level endpoint:
 * real price, real markdown clearing the price-tiered floor, real units on a
 * store floor. Nothing reaches this endpoint on a scraper's word.
 */

import { Router } from 'express';
import { getDb } from '../../db/client.js';
import { requireAuth, isPaidMember, TEASER_LIMIT, rateLimit, route } from '../middleware.js';
import { publishedDeals } from '../../engine/discovery.js';

export const publishedDealsRoute = Router();

// Browsing the deal feed is the hook — free to any visitor (anonymous preview
// or a signed-up account, paid or not). The $20 membership gates the value-add
// (alerts, watchlists, stock checks, tracking), not looking at deals. Signing up
// must never REMOVE access a stranger already had. (Product call, overnight run 1.)
const browse = [requireAuth];

publishedDealsRoute.get(
  '/deals/published',
  ...browse,
  rateLimit({ key: 'published', max: 60, windowMs: 60_000 }),
  route(async (req, res) => {
    const limitRaw = Number(req.query.limit ?? 200);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 200, 1), 200);
    // Optional retailer scope (dashless slug), so a small retailer's deals are
    // reachable instead of being crowded out of the global top-N by discount.
    const retailer = req.query.retailer ? String(req.query.retailer).replace(/-/g, '') : null;
    const db = await getDb();
    const rows = await publishedDeals(db, limit, retailer);

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

    const all = rows.map((r) => ({
      ...r,
      stores:
        ledger.get(`${String(r.retailer ?? 'homedepot')}:${String(r.sku ?? r.item_id ?? '')}`) ?? [],
    }));

    const dollarsSaved = (r: Record<string, unknown>): number => {
      const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
      const clr = num(r.clearance_price);   // register-only price, if hidden clearance
      const list = num(r.hd_list);          // shelf/list price
      const price = num(r.hd_price);         // current online/markdown price
      if (clr !== null) {                    // hidden clearance: drop from shelf → register
        const from = list ?? price;
        return from !== null ? Math.max(0, from - clr) : 0;
      }
      if (list !== null && price !== null) return Math.max(0, list - price); // regular markdown
      return 0;
    };
    const pct = (r: Record<string, unknown>): number => {
      const n = r.clearance_pct ?? r.hd_discount;
      return n === null || n === undefined ? 0 : Math.round(Number(n));
    };

    // TEASER PAYWALL (council-directed 2026-09-04). GATE the crown jewels, don't
    // give them away. A non-member sees many deals with the SAVINGS visible
    // ($ and %) but the LOCATOR stripped SERVER-SIDE — no price, store, aisle,
    // SKU, item_id or stock leaves the server for a locked deal, so the paywall
    // can't be read out of the payload. Exactly ONE mid-ranked deal rotates fully
    // unlocked as live proof; the biggest deals stay locked. Sells access +
    // volume + proximity, never the best deal itself.
    const paid = isPaidMember(req);
    if (paid) {
      res.json({ count: all.length, total: all.length, locked: false, deals: all });
      return;
    }
    const SHOWN = Math.min(all.length, 40);
    const shown = all.slice(0, SHOWN);
    // Rotate the single unlocked deal hourly, always mid-pack (never the top 8),
    // so the crown jewels are never the free one.
    const unlockedIdx = shown.length > 9
      ? 8 + (new Date().getHours() % Math.max(1, shown.length - 8))
      : Math.min(shown.length - 1, 0);
    const deals = shown.map((d, i) => {
      if (i === unlockedIdx) return { ...d, locked: false };
      const r = d as Record<string, unknown>;
      // Locked: keep only what's safe to advertise; strip every locator field.
      return {
        locked: true,
        lock_id: `lk${i}`,
        retailer: r.retailer ?? 'homedepot',
        title: r.title ?? '',
        image_url: r.image_url ?? null,
        discount_pct: pct(r),
        saved_dollars: Math.round(dollarsSaved(r)),
        deal_kind: r.deal_kind ?? null,
      };
    });
    res.json({ count: deals.length, total: all.length, locked: true, deals });
  }),
);
