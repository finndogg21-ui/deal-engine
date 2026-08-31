/**
 * Blueprint F — inventory.
 *
 * The "done when" that matters: a deal becomes an inventory row in one click
 * with nothing retyped. That is why POST accepts a product_id + store_id and
 * fills the rest from what the scan already knows.
 */

import { Router } from 'express';
import { getDb } from '../../db/client.js';
import { requireAuth, requirePlan, rateLimit, route } from '../middleware.js';

export const inventory = Router();

// Inventory is the reseller half of the product; a consumer plan has no use
// for it and it is not what they are paying for.
const reseller = [requireAuth, requirePlan('member')];

const STATUSES = ['held', 'listed', 'sold', 'returned'];
const CONDITIONS = ['new', 'open-box', 'damaged', 'used'];

const money = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

/* GET /api/inventory?status= */
inventory.get('/inventory', ...reseller, route(async (req, res) => {
  const db = await getDb();
  const status = STATUSES.includes(String(req.query.status)) ? String(req.query.status) : null;

  const { rows } = await db.query<Record<string, unknown>>(
    `SELECT i.item_id, i.product_id, i.title, i.cost_basis, i.quantity, i.condition,
            i.location, i.source_store_id, i.acquired_at, i.status, i.notes, i.created_at,
            st.name AS store_name, p.image_url, p.retailer,
            -- Sold rows carry their order so the table can show what happened.
            (SELECT COUNT(*)::int FROM orders o WHERE o.item_id = i.item_id) AS order_count,
            (SELECT SUM(o.sale_price - o.fees - o.shipping_cost)
               FROM orders o WHERE o.item_id = i.item_id) AS proceeds
       FROM inventory i
       LEFT JOIN stores st ON st.store_id = i.source_store_id
       LEFT JOIN products p ON p.product_id = i.product_id
      WHERE i.user_id = $1 AND ($2::text IS NULL OR i.status = $2)
      ORDER BY i.acquired_at DESC, i.item_id DESC`,
    [req.user!.user_id, status],
  );

  res.json(rows.map((r) => ({
    item_id: String(r.item_id),
    product_id: r.product_id,
    title: r.title,
    cost_basis: Number(r.cost_basis),
    quantity: Number(r.quantity),
    condition: r.condition,
    location: r.location,
    source_store_id: r.source_store_id,
    store_name: r.store_name,
    image_url: r.image_url,
    retailer: r.retailer,
    acquired_at: r.acquired_at,
    status: r.status,
    notes: r.notes,
    order_count: Number(r.order_count ?? 0),
    proceeds: r.proceeds === null ? null : Number(r.proceeds),
  })));
}));

/* POST /api/inventory — free-form, or "add from deal" via product_id. */
inventory.post('/inventory', ...reseller, rateLimit({ key: 'inv-write', max: 120, windowMs: 60_000 }), route(async (req, res) => {
  const db = await getDb();
  const b = (req.body ?? {}) as Record<string, unknown>;

  const productId = b.product_id ? String(b.product_id) : null;
  const storeId = b.source_store_id ? String(b.source_store_id) : null;

  let title = String(b.title ?? '').trim();
  let cost = money(b.cost_basis);

  // Add-from-deal: fill anything the client did not send from the scan data,
  // so the button really is one click.
  if (productId && (!title || cost === null)) {
    const { rows } = await db.query<{ title: string | null; last_price: string | null }>(
      `SELECT p.title, s.last_price
         FROM products p
         LEFT JOIN sku_state s
                ON s.product_id = p.product_id
               AND ($2::text IS NULL OR s.store_id = $2)
        WHERE p.product_id = $1
        LIMIT 1`,
      [productId, storeId],
    );
    const found = rows[0];
    if (!title) title = found?.title?.trim() ?? '';
    if (cost === null && found?.last_price !== null && found?.last_price !== undefined) {
      cost = Number(found.last_price);
    }
  }

  if (!title) return res.status(400).json({ error: 'Give the item a name.' });
  if (cost === null || cost < 0) return res.status(400).json({ error: 'Enter what you paid.' });

  const quantity = Math.max(Math.floor(Number(b.quantity ?? 1)) || 1, 1);
  const status = STATUSES.includes(String(b.status)) ? String(b.status) : 'held';
  const condition = CONDITIONS.includes(String(b.condition)) ? String(b.condition) : null;
  const acquired = String(b.acquired_at ?? '').match(/^\d{4}-\d{2}-\d{2}$/)
    ? String(b.acquired_at)
    : new Date().toISOString().slice(0, 10);

  const { rows } = await db.query<{ item_id: string }>(
    `INSERT INTO inventory
       (user_id, product_id, title, cost_basis, quantity, condition, location,
        source_store_id, acquired_at, status, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING item_id`,
    [
      req.user!.user_id, productId, title.slice(0, 300), cost, quantity, condition,
      b.location ? String(b.location).slice(0, 120) : null,
      storeId, acquired, status,
      b.notes ? String(b.notes).slice(0, 2000) : null,
    ],
  );

  res.status(201).json({ item_id: String(rows[0]!.item_id), title, cost_basis: cost });
}));

/* PATCH /api/inventory/:id */
inventory.patch('/inventory/:id', ...reseller, route(async (req, res) => {
  const db = await getDb();
  const b = (req.body ?? {}) as Record<string, unknown>;

  const status = b.status === undefined
    ? null
    : (STATUSES.includes(String(b.status)) ? String(b.status) : null);
  if (b.status !== undefined && status === null) {
    return res.status(400).json({ error: `status must be one of ${STATUSES.join(', ')}` });
  }

  const { rowCount } = await db.query(
    `UPDATE inventory
        SET title      = COALESCE($3, title),
            cost_basis = COALESCE($4, cost_basis),
            quantity   = COALESCE($5, quantity),
            condition  = COALESCE($6, condition),
            location   = COALESCE($7, location),
            status     = COALESCE($8, status),
            notes      = COALESCE($9, notes)
      WHERE item_id = $1 AND user_id = $2`,
    [
      req.params.id, req.user!.user_id,
      b.title ? String(b.title).slice(0, 300) : null,
      money(b.cost_basis),
      b.quantity === undefined ? null : Math.max(Math.floor(Number(b.quantity)) || 1, 1),
      CONDITIONS.includes(String(b.condition)) ? String(b.condition) : null,
      b.location === undefined ? null : String(b.location).slice(0, 120),
      status,
      b.notes === undefined ? null : String(b.notes).slice(0, 2000),
    ],
  );

  if (rowCount === 0) return res.status(404).json({ error: 'No such item.' });
  res.json({ ok: true });
}));

/* POST /api/inventory/bulk-status — the table's bulk action. */
inventory.post('/inventory/bulk-status', ...reseller, route(async (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const status = String(b.status ?? '');
  const ids = Array.isArray(b.item_ids) ? b.item_ids.map(String) : [];

  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${STATUSES.join(', ')}` });
  }
  if (ids.length === 0) return res.status(400).json({ error: 'Select something first.' });

  const db = await getDb();
  const { rowCount } = await db.query(
    `UPDATE inventory SET status = $3
      WHERE user_id = $1 AND item_id = ANY($2::bigint[])`,
    [req.user!.user_id, ids, status],
  );
  res.json({ ok: true, updated: rowCount });
}));

/* DELETE /api/inventory/:id */
inventory.delete('/inventory/:id', ...reseller, route(async (req, res) => {
  const db = await getDb();
  const { rowCount } = await db.query(
    `DELETE FROM inventory WHERE item_id = $1 AND user_id = $2`,
    [req.params.id, req.user!.user_id],
  );
  if (rowCount === 0) return res.status(404).json({ error: 'No such item.' });
  res.json({ ok: true });
}));
