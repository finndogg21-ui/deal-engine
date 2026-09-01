/**
 * Blueprint D (read side) — what the notifications panel reads.
 *
 * `outcome` is not analytics decoration. It feeds the fair-queue rotation in
 * the matcher, so a user marking things "lost" genuinely changes what they
 * get sent next.
 */

import { Router } from 'express';
import { getDb } from '../../db/client.js';
import { requireAuth, requirePlan, route } from '../middleware.js';

export const alerts = Router();

// Alerts are a paid feature (owner decision, 2026-09-01): sending and reviewing
// deal alerts is part of the membership, not the free teaser. requirePlan also
// rejects the shared public-preview identity, so an anonymous visitor gets a
// 402 upgrade prompt here rather than the operator row's alert history.
const paid = [requireAuth, requirePlan('member')];

const OUTCOMES = ['won', 'lost', 'ignored'];

/* GET /api/alerts — last 50, newest first. */
alerts.get('/alerts', ...paid, route(async (req, res) => {
  const db = await getDb();
  const limit = Math.min(Number(req.query.limit ?? 50) || 50, 100);

  const { rows } = await db.query<Record<string, unknown>>(
    `SELECT a.alert_id, a.product_id, a.store_id, a.watch_id, a.reason,
            a.score_at_send, a.sent_at, a.opened_at, a.outcome,
            p.title, p.image_url, p.retailer,
            st.name AS store_name,
            s.last_price AS price, s.last_discount AS discount_pct, s.last_stock AS stock_qty,
            w.term AS watch_term
       FROM alerts a
       JOIN products p ON p.product_id = a.product_id
       LEFT JOIN stores st ON st.store_id = a.store_id
       LEFT JOIN sku_state s
              ON s.product_id = a.product_id AND s.store_id = a.store_id
       LEFT JOIN watchlists w ON w.watch_id = a.watch_id
      WHERE a.user_id = $1
      ORDER BY a.sent_at DESC
      LIMIT $2`,
    [req.user!.user_id, limit],
  );

  const unread = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM alerts WHERE user_id = $1 AND opened_at IS NULL`,
    [req.user!.user_id],
  );

  res.json({
    unread: Number(unread.rows[0]?.n ?? 0),
    alerts: rows.map((r) => ({
      alert_id: String(r.alert_id),
      product_id: r.product_id,
      store_id: r.store_id,
      watch_id: r.watch_id === null ? null : String(r.watch_id),
      watch_term: r.watch_term,
      reason: r.reason,
      title: r.title,
      image_url: r.image_url,
      retailer: r.retailer,
      store_name: r.store_name,
      price: r.price === null ? null : Number(r.price),
      discount_pct: r.discount_pct === null ? null : Number(r.discount_pct),
      stock_qty: r.stock_qty,
      score_at_send: r.score_at_send,
      sent_at: r.sent_at,
      opened_at: r.opened_at,
      outcome: r.outcome,
      // Deep link the panel row points at.
      href: `/app/deal/${r.product_id}/${r.store_id}`,
    })),
  });
}));

/* POST /api/alerts/read-all */
alerts.post('/alerts/read-all', ...paid, route(async (req, res) => {
  const db = await getDb();
  await db.query(
    `UPDATE alerts SET opened_at = now() WHERE user_id = $1 AND opened_at IS NULL`,
    [req.user!.user_id],
  );
  res.json({ ok: true });
}));

/* POST /api/alerts/:id/open */
alerts.post('/alerts/:id/open', ...paid, route(async (req, res) => {
  const db = await getDb();
  const { rowCount } = await db.query(
    `UPDATE alerts SET opened_at = COALESCE(opened_at, now())
      WHERE alert_id = $1 AND user_id = $2`,
    [req.params.id, req.user!.user_id],
  );
  if (rowCount === 0) return res.status(404).json({ error: 'No such alert.' });
  res.json({ ok: true });
}));

/* PATCH /api/alerts/:id — record what happened. */
alerts.patch('/alerts/:id', ...paid, route(async (req, res) => {
  const outcome = String((req.body ?? {}).outcome ?? '');
  if (!OUTCOMES.includes(outcome)) {
    return res.status(400).json({ error: `outcome must be one of ${OUTCOMES.join(', ')}` });
  }
  const db = await getDb();
  const { rowCount } = await db.query(
    `UPDATE alerts SET outcome = $3, opened_at = COALESCE(opened_at, now())
      WHERE alert_id = $1 AND user_id = $2`,
    [req.params.id, req.user!.user_id, outcome],
  );
  if (rowCount === 0) return res.status(404).json({ error: 'No such alert.' });
  res.json({ ok: true });
}));
