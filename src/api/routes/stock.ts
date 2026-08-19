/**
 * Blueprint J — store-level stock check.
 *
 * This is the expensive endpoint. Unwrangle bills per lookup, so the cache is
 * not an optimisation, it is the cost control: without it, one person holding
 * down refresh is a real bill.
 *
 * Retailers without per-store stock get an explicit "not available for this
 * retailer" answer. An empty table would read as "nothing in stock nearby",
 * which is a different and much worse claim.
 */

import { Router } from 'express';
import { requireAuth, requirePlan, rateLimit, route } from '../middleware.js';
import { stockForSku, unwrangleReady } from '../../vendors/unwrangle.js';
import type { StoreStock } from '../../vendors/contracts.js';

export const stock = Router();

const paid = [requireAuth, requirePlan('consumer', 'reseller')];

/**
 * Which retailers we can actually answer for. Marked `false` until a real
 * lookup has been confirmed against the vendor — guessing here means shipping
 * a screen that is silently wrong for two of four retailers.
 */
const RETAILERS: Record<string, { label: string; perStoreStock: boolean }> = {
  homedepot: { label: 'Home Depot', perStoreStock: true },
  lowes: { label: "Lowe's", perStoreStock: false },
  walmart: { label: 'Walmart', perStoreStock: false },
  target: { label: 'Target', perStoreStock: false },
};

const TTL_MS = 60 * 60_000;
const cache = new Map<string, { at: number; data: StoreStock[] }>();

/** Keeps the process from growing without bound on a long-running server. */
function prune(now: number) {
  if (cache.size < 500) return;
  for (const [k, v] of cache) if (now - v.at > TTL_MS) cache.delete(k);
}

stock.get('/stock', ...paid, rateLimit({ key: 'stock', max: 30, windowMs: 60_000 }), route(async (req, res) => {
  const retailer = String(req.query.retailer ?? '').toLowerCase();
  const sku = String(req.query.sku ?? '').trim();
  const zip = String(req.query.zip ?? req.user!.zip ?? '').trim();

  const info = RETAILERS[retailer];
  if (!info) {
    return res.status(400).json({ error: 'Pick a retailer we cover.' });
  }
  if (!info.perStoreStock) {
    // 200, not an error: the honest answer to a valid question.
    return res.json({
      retailer,
      label: info.label,
      supported: false,
      reason: `${info.label} does not publish per-store stock through our data source, so we cannot show quantities for it. Home Depot works today.`,
      stores: [],
    });
  }
  if (!/^\d{3,}$/.test(sku)) return res.status(400).json({ error: 'Enter a SKU or UPC.' });
  if (!/^\d{5}$/.test(zip)) return res.status(400).json({ error: 'Enter a 5-digit ZIP.' });

  if (!unwrangleReady()) {
    return res.status(503).json({
      error: 'Stock lookup is not wired up yet.',
      detail: 'UNWRANGLE_KEY is not set. See src/vendors/unwrangle.ts.',
      retailer,
      label: info.label,
      supported: true,
      stores: [],
    });
  }

  const key = `${retailer}:${sku}:${zip}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) {
    return res.json({
      retailer, label: info.label, supported: true, cached: true,
      checked_at: new Date(hit.at).toISOString(),
      stores: hit.data,
    });
  }

  const data = await stockForSku(retailer, sku, zip);
  prune(now);
  cache.set(key, { at: now, data });

  res.json({
    retailer, label: info.label, supported: true, cached: false,
    checked_at: new Date(now).toISOString(),
    stores: data,
  });
}));
