/**
 * Blueprint G — orders, and H — profit.
 *
 * Two rules hold this together:
 *   - Fees are *suggested* from the table and *stored* as confirmed. Profit is
 *     only ever computed from the stored number.
 *   - Recording a sale flips the linked inventory item to sold, in the same
 *     transaction. Two screens disagreeing about whether a thing sold is the
 *     bug that makes people stop trusting the numbers.
 */

import { Router } from 'express';
import { getDb } from '../../db/client.js';
import { requireAuth, requirePlan, rateLimit, idParam, route } from '../middleware.js';
import { FEE_TABLE, FEES_VERIFIED_ON, estimateFee, isMarketplace } from '../../resell/fees.js';

export const orders = Router();

// Reject a non-numeric :id with a clean 400 before it reaches a bigint query.
orders.param('id', (_req, res, next, val) =>
  idParam(val) ? next() : res.status(400).json({ error: 'Invalid id.' }));

const reseller = [requireAuth, requirePlan('member')];
const STATUSES = ['listed', 'sold', 'shipped', 'delivered', 'refunded'];

const money = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

/* GET /api/fees — the table plus a quote, so the client never hardcodes rates. */
orders.get('/fees', requireAuth, route(async (req, res) => {
  const salePrice = Number(req.query.sale_price ?? 0) || 0;
  const localPickup = String(req.query.local_pickup ?? '') === 'true';

  res.json({
    verified_on: FEES_VERIFIED_ON,
    // Said plainly so nobody treats a stale prefill as authoritative.
    disclaimer: 'Suggested from published rates. Always check your own payout and edit.',
    marketplaces: Object.entries(FEE_TABLE).map(([id, rule]) => ({
      id,
      label: rule.label,
      note: rule.note,
      suggested_fee: salePrice > 0 ? estimateFee(id as never, salePrice, localPickup) : null,
    })),
  });
}));

/* GET /api/orders */
orders.get('/orders', ...reseller, route(async (req, res) => {
  const db = await getDb();
  const { rows } = await db.query<Record<string, unknown>>(
    `SELECT o.order_id, o.item_id, o.marketplace, o.sale_price, o.fees,
            o.shipping_cost, o.sold_at, o.status, o.buyer_note,
            i.title, i.cost_basis, i.quantity
       FROM orders o
       LEFT JOIN inventory i ON i.item_id = o.item_id
      WHERE o.user_id = $1
      ORDER BY o.sold_at DESC, o.order_id DESC`,
    [req.user!.user_id],
  );

  res.json(rows.map((r) => {
    const sale = Number(r.sale_price);
    const fees = Number(r.fees);
    const ship = Number(r.shipping_cost);
    const cost = r.cost_basis === null ? null : Number(r.cost_basis);
    return {
      order_id: String(r.order_id),
      item_id: r.item_id === null ? null : String(r.item_id),
      title: r.title,
      marketplace: r.marketplace,
      sale_price: sale,
      fees,
      shipping_cost: ship,
      cost_basis: cost,
      // Null, not zero, when the order has no linked item — an unknown cost
      // basis is not a free item, and showing $0 would inflate every total.
      net: cost === null ? null : Math.round((sale - fees - ship - cost) * 100) / 100,
      sold_at: r.sold_at,
      status: r.status,
      buyer_note: r.buyer_note,
    };
  }));
}));

/* POST /api/orders */
orders.post('/orders', ...reseller, rateLimit({ key: 'order-write', max: 120, windowMs: 60_000 }), route(async (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;

  if (!isMarketplace(b.marketplace)) {
    return res.status(400).json({ error: 'Pick where it sold.' });
  }
  const sale = money(b.sale_price);
  if (sale === null || sale < 0) return res.status(400).json({ error: 'Enter the sale price.' });

  // Client sends the confirmed fee. Only fall back to the estimate when it
  // sent nothing at all.
  const fees = money(b.fees) ?? estimateFee(b.marketplace, sale, b.local_pickup === true);
  const shipping = money(b.shipping_cost) ?? 0;
  const soldAt = String(b.sold_at ?? '').match(/^\d{4}-\d{2}-\d{2}$/)
    ? String(b.sold_at)
    : new Date().toISOString().slice(0, 10);
  const status = STATUSES.includes(String(b.status)) ? String(b.status) : 'sold';
  const itemId = b.item_id ? String(b.item_id) : null;

  const db = await getDb();
  const out = await db.tx(async (tx) => {
    // Ownership check inside the transaction: without it, anyone could attach
    // an order to another account's inventory row by guessing an id.
    if (itemId) {
      const owns = await tx.query(
        `SELECT 1 FROM inventory WHERE item_id = $1 AND user_id = $2`,
        [itemId, req.user!.user_id],
      );
      if (owns.rows.length === 0) return { error: 'No such item.' as const };
    }

    const ins = await tx.query<{ order_id: string }>(
      `INSERT INTO orders
         (user_id, item_id, marketplace, sale_price, fees, shipping_cost, sold_at, status, buyer_note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING order_id`,
      [
        req.user!.user_id, itemId, b.marketplace, sale, fees, shipping, soldAt, status,
        b.buyer_note ? String(b.buyer_note).slice(0, 1000) : null,
      ],
    );

    // A sale is what makes an item sold. Refunds put it back on the shelf.
    if (itemId) {
      const next = status === 'refunded' ? 'held' : status === 'listed' ? 'listed' : 'sold';
      await tx.query(
        `UPDATE inventory SET status = $3 WHERE item_id = $1 AND user_id = $2`,
        [itemId, req.user!.user_id, next],
      );
    }

    return { order_id: String(ins.rows[0]!.order_id) };
  });

  if ('error' in out) return res.status(404).json({ error: out.error });
  res.status(201).json({ ...out, fees });
}));

/* PATCH /api/orders/:id */
orders.patch('/orders/:id', ...reseller, route(async (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const status = b.status === undefined
    ? null
    : (STATUSES.includes(String(b.status)) ? String(b.status) : null);
  if (b.status !== undefined && status === null) {
    return res.status(400).json({ error: `status must be one of ${STATUSES.join(', ')}` });
  }

  const db = await getDb();
  const { rowCount } = await db.query(
    `UPDATE orders
        SET sale_price    = COALESCE($3, sale_price),
            fees          = COALESCE($4, fees),
            shipping_cost = COALESCE($5, shipping_cost),
            status        = COALESCE($6, status),
            buyer_note    = COALESCE($7, buyer_note)
      WHERE order_id = $1 AND user_id = $2`,
    [
      req.params.id, req.user!.user_id,
      money(b.sale_price), money(b.fees), money(b.shipping_cost), status,
      b.buyer_note === undefined ? null : String(b.buyer_note).slice(0, 1000),
    ],
  );
  if (rowCount === 0) return res.status(404).json({ error: 'No such order.' });
  res.json({ ok: true });
}));

/* DELETE /api/orders/:id */
orders.delete('/orders/:id', ...reseller, route(async (req, res) => {
  const db = await getDb();
  const { rowCount } = await db.query(
    `DELETE FROM orders WHERE order_id = $1 AND user_id = $2`,
    [req.params.id, req.user!.user_id],
  );
  if (rowCount === 0) return res.status(404).json({ error: 'No such order.' });
  res.json({ ok: true });
}));

/* ---------------------------------------------------------------------------
 * Blueprint H — GET /api/profit?from=&to=
 * No table. Derived from inventory and orders every time it is asked.
 * ------------------------------------------------------------------------- */
orders.get('/profit', ...reseller, route(async (req, res) => {
  const db = await getDb();
  const uid = req.user!.user_id;
  const from = String(req.query.from ?? '').match(/^\d{4}-\d{2}-\d{2}$/) ? String(req.query.from) : null;
  const to = String(req.query.to ?? '').match(/^\d{4}-\d{2}-\d{2}$/) ? String(req.query.to) : null;

  // Refunded orders are excluded everywhere: counting a refund as revenue is
  // how a profit screen ends up flattering and useless.
  const window = `o.user_id = $1 AND o.status <> 'refunded'
                  AND ($2::date IS NULL OR o.sold_at >= $2)
                  AND ($3::date IS NULL OR o.sold_at <= $3)`;
  const params = [uid, from, to];

  const totals = await db.query<Record<string, unknown>>(
    `SELECT COUNT(*)::int AS orders,
            COALESCE(SUM(o.sale_price),0)                       AS revenue,
            COALESCE(SUM(o.fees),0)                             AS fees,
            COALESCE(SUM(o.shipping_cost),0)                    AS shipping,
            COALESCE(SUM(i.cost_basis),0)                       AS cost,
            COALESCE(SUM(o.sale_price - o.fees - o.shipping_cost - COALESCE(i.cost_basis,0)),0) AS net,
            COUNT(*) FILTER (WHERE i.item_id IS NULL)::int       AS orders_without_cost
       FROM orders o LEFT JOIN inventory i ON i.item_id = o.item_id
      WHERE ${window}`,
    params,
  );

  const rows = await db.query<Record<string, unknown>>(
    `SELECT o.order_id, o.sold_at, o.marketplace, o.sale_price, o.fees, o.shipping_cost,
            i.title, i.cost_basis, st.name AS store_name, p.category,
            (o.sale_price - o.fees - o.shipping_cost - COALESCE(i.cost_basis,0)) AS net
       FROM orders o
       LEFT JOIN inventory i ON i.item_id = o.item_id
       LEFT JOIN stores st ON st.store_id = i.source_store_id
       LEFT JOIN products p ON p.product_id = i.product_id
      WHERE ${window}
      ORDER BY o.sold_at DESC, o.order_id DESC`,
    params,
  );

  const byStore = await db.query<Record<string, unknown>>(
    `SELECT COALESCE(st.name, 'Unknown store') AS label, COUNT(*)::int AS n,
            SUM(o.sale_price - o.fees - o.shipping_cost - COALESCE(i.cost_basis,0)) AS net
       FROM orders o
       LEFT JOIN inventory i ON i.item_id = o.item_id
       LEFT JOIN stores st ON st.store_id = i.source_store_id
      WHERE ${window}
      GROUP BY 1 ORDER BY net DESC NULLS LAST`,
    params,
  );

  const byCategory = await db.query<Record<string, unknown>>(
    `SELECT COALESCE(p.category, 'Uncategorised') AS label, COUNT(*)::int AS n,
            SUM(o.sale_price - o.fees - o.shipping_cost - COALESCE(i.cost_basis,0)) AS net
       FROM orders o
       LEFT JOIN inventory i ON i.item_id = o.item_id
       LEFT JOIN products p ON p.product_id = i.product_id
      WHERE ${window}
      GROUP BY 1 ORDER BY net DESC NULLS LAST`,
    params,
  );

  const byMonth = await db.query<Record<string, unknown>>(
    `SELECT to_char(date_trunc('month', o.sold_at), 'YYYY-MM') AS month,
            COUNT(*)::int AS n,
            SUM(o.sale_price - o.fees - o.shipping_cost - COALESCE(i.cost_basis,0)) AS net
       FROM orders o LEFT JOIN inventory i ON i.item_id = o.item_id
      WHERE ${window}
      GROUP BY 1 ORDER BY 1`,
    params,
  );

  // Money currently sitting on shelves. Not profit, and not a loss — but the
  // number that explains why net looks thin in a month with heavy buying.
  const held = await db.query<{ items: number; tied_up: string }>(
    `SELECT COUNT(*)::int AS items, COALESCE(SUM(cost_basis),0) AS tied_up
       FROM inventory WHERE user_id = $1 AND status IN ('held','listed')`,
    [uid],
  );

  const t = totals.rows[0] ?? {};
  const n = (v: unknown) => Math.round(Number(v ?? 0) * 100) / 100;
  const cost = n(t.cost);

  res.json({
    totals: {
      orders: Number(t.orders ?? 0),
      revenue: n(t.revenue),
      fees: n(t.fees),
      shipping: n(t.shipping),
      cost,
      net: n(t.net),
      // Return on the money actually spent, which is the number resellers
      // quote each other. Null rather than 0 when nothing was spent.
      roi_pct: cost > 0 ? Math.round((n(t.net) / cost) * 1000) / 10 : null,
      orders_without_cost: Number(t.orders_without_cost ?? 0),
    },
    inventory_held: {
      items: Number(held.rows[0]?.items ?? 0),
      tied_up: n(held.rows[0]?.tied_up),
    },
    by_month: byMonth.rows.map((r) => ({ month: r.month, orders: Number(r.n), net: n(r.net) })),
    by_store: byStore.rows.map((r) => ({ label: r.label, orders: Number(r.n), net: n(r.net) })),
    by_category: byCategory.rows.map((r) => ({ label: r.label, orders: Number(r.n), net: n(r.net) })),
    rows: rows.rows.map((r) => ({
      order_id: String(r.order_id),
      sold_at: r.sold_at,
      title: r.title,
      marketplace: r.marketplace,
      store_name: r.store_name,
      category: r.category,
      sale_price: n(r.sale_price),
      fees: n(r.fees),
      shipping_cost: n(r.shipping_cost),
      cost_basis: r.cost_basis === null ? null : n(r.cost_basis),
      net: n(r.net),
    })),
  });
}));
