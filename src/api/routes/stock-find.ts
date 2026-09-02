/**
 * "Find Stock" — resolve real store stock for one product, near one ZIP.
 *
 * This is the endpoint that makes coverage a non-problem. Deals are shown
 * everywhere from the sweep; stock is resolved per click, for the ZIP the
 * person actually typed. Cost therefore scales with USER ACTIONS rather than
 * with catalogue size or number of metros.
 *
 * Because every uncached call spends money, three things are enforced here and
 * not in the client:
 *   1. a cache, so repeat presses on the same product+ZIP are free
 *   2. a per-plan daily cap, counted from what was actually billed
 *   3. an honest error when the vendor fails, rather than "no stock" — those
 *      are completely different claims and one of them sends someone home
 */

import { Router } from 'express';
import { getDb } from '../../db/client.js';
import { requireAuth, requireRealUser, requirePlan, rateLimit, route } from '../middleware.js';
import { lookupStock, stockLookupReady, withinRadius, type StoreStockRow } from '../../vendors/store-lookup.js';

export const stockFind = Router();

const paid = [requireAuth, requirePlan('member')];

/** How long a stock answer stays believable. Stock moves; a day-old count is
 *  a guess. Six hours keeps cost down without pretending to be live. */
const CACHE_HOURS = Number(process.env.STOCK_CACHE_HOURS ?? 6);

/** Daily caps. Each uncached lookup is real money, so this is a spend limit
 *  as much as a product tier. */
const DAILY_CAP: Record<string, number> = {
  none: 0,
  consumer: 10,
  reseller: 50,
};

function capFor(user: { plan: string; role: string }): number {
  if (user.role === 'operator') return 1000;
  return DAILY_CAP[user.plan] ?? 0;
}

stockFind.post(
  '/stock/find',
  ...paid,
  // Burst guard on top of the daily cap: stops a stuck button from spending
  // a day's allowance in ten seconds.
  rateLimit({ key: 'stock-find', max: 10, windowMs: 60_000 }),
  route(async (req, res) => {
    const db = await getDb();
    const body = (req.body ?? {}) as Record<string, unknown>;

    const productId = String(body.product_id ?? '').trim();
    const zip = String(body.zip ?? req.user!.zip ?? '').trim();

    if (!productId) return res.status(400).json({ error: 'product_id is required.' });
    if (!/^\d{5}$/.test(zip)) return res.status(400).json({ error: 'Enter a 5-digit ZIP code.' });

    /**
     * Home Depot carries TWO ids and the lookup vendor accepts only one.
     * The sweep keys products on `storeSkuNumber` (e.g. 1009485107); this
     * vendor wants `itemId` (e.g. 324308361), the number in the product URL.
     * Sending the store SKU fails with a vendor 500 that looks like an outage.
     */
    const idRow = await db.query<{ item_id: string | null; sku: string }>(
      `SELECT item_id, sku FROM products WHERE product_id = $1`,
      [productId],
    );
    const fallback = productId.includes(':') ? productId.split(':').pop()! : productId;
    const sku = idRow.rows[0]?.item_id ?? idRow.rows[0]?.sku ?? fallback;

    /* ---- cache ---------------------------------------------------------- */
    const cached = await db.query<{ stores: StoreStockRow[]; fetched_at: string }>(
      `SELECT stores, fetched_at FROM stock_lookups
        -- 'empty' is a real answer too: with the 25-mile rule, "no store in
          -- range" is the common outcome for remote ZIPs, and refusing to
          -- cache it would bill the vendor on every repeat press.
          WHERE product_id = $1 AND zip = $2 AND status IN ('ok','empty')
          AND fetched_at >= now() - ($3 || ' hours')::interval
        ORDER BY fetched_at DESC LIMIT 1`,
      [productId, zip, String(CACHE_HOURS)],
    );

    if (cached.rows[0]) {
      // New rows are radius-clean at write time; filtering here only covers
      // rows cached before the 25-mile rule, until they age out.
      const stores = withinRadius(cached.rows[0].stores);
      // Logged as billed=false so the cache-hit rate is measurable rather than
      // assumed, and so a cached read never counts against the daily cap.
      await db.query(
        `INSERT INTO stock_lookups (user_id, product_id, zip, status, stores, billed)
         VALUES ($1,$2,$3,$4,$5,false)`,
        // 'ok' must always mean "has stores" — a pre-rule row filtered to
        // nothing is mirrored as 'empty', not as a store-less 'ok'.
        [req.user!.user_id, productId, zip, stores.length > 0 ? 'ok' : 'empty', JSON.stringify(stores)],
      );
      return res.json({
        stores,
        cached: true,
        checked_at: cached.rows[0].fetched_at,
      });
    }

    /* ---- daily cap ------------------------------------------------------ */
    const cap = capFor(req.user!);
    const used = await db.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM stock_lookups
        WHERE user_id = $1 AND billed AND fetched_at >= date_trunc('day', now())`,
      [req.user!.user_id],
    );
    const spent = Number(used.rows[0]?.n ?? 0);

    if (spent >= cap) {
      return res.status(429).json({
        error: cap === 0
          ? 'Stock lookups need a plan.'
          : `That is all ${cap} stock checks for today. They reset at midnight.`,
        used: spent, cap,
      });
    }

    if (!stockLookupReady()) {
      // Keep the env-var name and file path in the SERVER log, not the client
      // response (they are an internal fingerprint of no use to a caller).
      console.warn('stock lookup not configured: APIFY_TOKEN missing (see src/vendors/store-lookup.ts)');
      return res.status(503).json({ error: 'Stock lookup is not available right now.' });
    }

    /* ---- vendor --------------------------------------------------------- */
    try {
      const result = await lookupStock(sku, zip);

      await db.query(
        `INSERT INTO stock_lookups (user_id, product_id, zip, status, stores, billed)
         VALUES ($1,$2,$3,$4,$5,true)`,
        [
          req.user!.user_id, productId, zip,
          result.empty ? 'empty' : 'ok',
          JSON.stringify(result.stores),
        ],
      );

      return res.json({
        stores: result.stores,
        cached: false,
        checked_at: new Date().toISOString(),
        used: spent + 1,
        cap,
        // Said out loud, because the vendor is blind to clearance pricing and
        // the sweep is not. Showing its price would contradict the deal card.
        note: 'Quantity and store are live. Price comes from the deal, not this check.',
      });
    } catch (err) {
      const message = (err as Error).message;
      const vendorStatus = (err as Error & { vendorStatus?: number }).vendorStatus;

      /**
       * A rate-limit rejection is not a lookup. Charging someone a daily check
       * for our own traffic problem is billing them for our mistake.
       * Everything else stays billed, because the call happened.
       */
      const chargeable = vendorStatus !== 429;

      await db.query(
        `INSERT INTO stock_lookups (user_id, product_id, zip, status, error, billed)
         VALUES ($1,$2,$3,'vendor_error',$4,$5)`,
        [req.user!.user_id, productId, zip, message.slice(0, 500), chargeable],
      );

      console.error(`stock lookup failed ${productId} @ ${zip}:`, message);
      // The raw vendor `message` is logged above and stored in stock_lookups;
      // do NOT echo it to the client (it can carry internal URLs/detail).
      return res.status(vendorStatus === 429 ? 429 : 502).json({
        error: vendorStatus === 429 ? 'Too many checks right now.' : 'Could not check stock right now.',
        // Verified 2026-08-16: some ZIPs fail every time at this vendor while
        // neighbouring ones succeed on the same product.
        retryable: true,
      });
    }
  }),
);

/** GET /api/stock/quota — so the button can show what is left before spending.
    requireRealUser (not requireAuth): the shared public-preview identity is the
    operator row, so requireAuth here leaked the operator's stock-lookup usage to
    anonymous visitors. The frontend already treats a non-200 as "no quota". */
stockFind.get('/stock/quota', requireRealUser, route(async (req, res) => {
  const db = await getDb();
  const cap = capFor(req.user!);
  const { rows } = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM stock_lookups
      WHERE user_id = $1 AND billed AND fetched_at >= date_trunc('day', now())`,
    [req.user!.user_id],
  );
  const used = Number(rows[0]?.n ?? 0);
  res.json({ used, cap, remaining: Math.max(cap - used, 0) });
}));
