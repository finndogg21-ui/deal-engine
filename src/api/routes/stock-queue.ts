/**
 * Queue stock lookups instead of blocking on them.
 *
 * A reseller planning a route wants twenty answers, not one. Blocking cost up
 * to 21 seconds each; queueing returns immediately and the worker fills the
 * answers in. The vendor supports this directly via noWait, so this is its
 * intended contract rather than a workaround.
 */

import { Router } from 'express';
import { getDb } from '../../db/client.js';
import { requireAuth, requirePlan, rateLimit, route } from '../middleware.js';
import { submit, asyncLookupReady } from '../../vendors/store-lookup-async.js';
import type { StoreStockRow } from '../../vendors/store-lookup.js';

export const stockQueue = Router();

const paid = [requireAuth, requirePlan('consumer', 'reseller')];
const CACHE_HOURS = Number(process.env.STOCK_CACHE_HOURS ?? 6);
const DAILY_CAP: Record<string, number> = { none: 0, consumer: 10, reseller: 50 };
const capFor = (u: { plan: string; role: string }) =>
  u.role === 'operator' ? 1000 : (DAILY_CAP[u.plan] ?? 0);

/** How many a single request may enqueue. Stops one press queueing the world. */
const MAX_PER_REQUEST = 25;

/* ---------------------------------------------------------------------------
 * POST /api/stock/queue   { items: [{product_id}], zip }  — or a single item
 * ------------------------------------------------------------------------- */
stockQueue.post('/stock/queue', ...paid,
  rateLimit({ key: 'stock-queue', max: 20, windowMs: 60_000 }),
  route(async (req, res) => {
    const db = await getDb();
    const body = (req.body ?? {}) as Record<string, unknown>;
    const zip = String(body.zip ?? req.user!.zip ?? '').trim();

    if (!/^\d{5}$/.test(zip)) return res.status(400).json({ error: 'Enter a 5-digit ZIP code.' });

    const raw = Array.isArray(body.items) ? body.items : [body.product_id];
    const productIds = [...new Set(
      raw.map((x) => (typeof x === 'string' ? x : (x as any)?.product_id))
         .filter((x): x is string => typeof x === 'string' && x.length > 0),
    )].slice(0, MAX_PER_REQUEST);

    if (productIds.length === 0) return res.status(400).json({ error: 'Nothing to look up.' });

    const cap = capFor(req.user!);
    const usedRow = await db.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM stock_lookups
        WHERE user_id = $1 AND billed AND fetched_at >= date_trunc('day', now())`,
      [req.user!.user_id],
    );
    let budget = cap - Number(usedRow.rows[0]?.n ?? 0);

    const queued: string[] = [];
    const cached: { product_id: string; stores: StoreStockRow[] }[] = [];
    const skipped: { product_id: string; reason: string }[] = [];

    for (const productId of productIds) {
      // Cache first — a queued job that the cache could answer is money burnt.
      const hit = await db.query<{ stores: StoreStockRow[] }>(
        `SELECT stores FROM stock_lookups
          WHERE product_id = $1 AND zip = $2 AND status = 'ok'
            AND fetched_at >= now() - ($3 || ' hours')::interval
          ORDER BY fetched_at DESC LIMIT 1`,
        [productId, zip, String(CACHE_HOURS)],
      );
      if (hit.rows[0]) {
        cached.push({ product_id: productId, stores: hit.rows[0].stores });
        continue;
      }

      // Already queued for this product+zip? Don't pay twice for one answer.
      const inFlight = await db.query(
        `SELECT 1 FROM stock_lookups
          WHERE product_id = $1 AND zip = $2 AND status = 'pending' LIMIT 1`,
        [productId, zip],
      );
      if (inFlight.rows.length > 0) { queued.push(productId); continue; }

      if (budget <= 0) { skipped.push({ product_id: productId, reason: 'daily limit reached' }); continue; }
      if (!asyncLookupReady()) { skipped.push({ product_id: productId, reason: 'lookup not configured' }); continue; }

      const idRow = await db.query<{ item_id: string | null; sku: string }>(
        `SELECT item_id, sku FROM products WHERE product_id = $1`, [productId],
      );
      const itemId = idRow.rows[0]?.item_id
        ?? idRow.rows[0]?.sku
        ?? (productId.includes(':') ? productId.split(':').pop()! : productId);

      try {
        const asyncId = await submit(itemId, zip);
        await db.query(
          `INSERT INTO stock_lookups (user_id, product_id, zip, status, async_id, queued_at, billed)
           VALUES ($1,$2,$3,'pending',$4, now(), true)`,
          [req.user!.user_id, productId, zip, asyncId],
        );
        queued.push(productId);
        budget--;
      } catch (err) {
        skipped.push({ product_id: productId, reason: (err as Error).message.slice(0, 120) });
      }
    }

    res.json({
      queued, cached, skipped, zip,
      remaining: Math.max(budget, 0),
      cap,
    });
  }),
);

/* ---------------------------------------------------------------------------
 * GET /api/stock/jobs?zip=  — what the tray polls
 * ------------------------------------------------------------------------- */
stockQueue.get('/stock/jobs', ...paid, route(async (req, res) => {
  const db = await getDb();
  const zip = typeof req.query.zip === 'string' ? req.query.zip : null;

  const { rows } = await db.query<Record<string, unknown>>(
    `SELECT l.lookup_id, l.product_id, l.zip, l.status, l.stores, l.error,
            l.queued_at, l.fetched_at, p.title, p.image_url
       FROM stock_lookups l
       LEFT JOIN products p ON p.product_id = l.product_id
      WHERE l.user_id = $1
        AND ($2::text IS NULL OR l.zip = $2)
        AND (l.status = 'pending' OR l.fetched_at >= now() - INTERVAL '2 hours')
      ORDER BY COALESCE(l.queued_at, l.fetched_at) DESC
      LIMIT 60`,
    [req.user!.user_id, zip],
  );

  res.json({
    jobs: rows.map((r) => ({
      lookup_id: String(r.lookup_id),
      product_id: r.product_id,
      title: r.title,
      image_url: r.image_url,
      zip: r.zip,
      status: r.status,
      stores: (r.stores as StoreStockRow[]) ?? [],
      error: r.error,
      queued_at: r.queued_at,
      fetched_at: r.fetched_at,
    })),
    pending: rows.filter((r) => r.status === 'pending').length,
  });
}));
