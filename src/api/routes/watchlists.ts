/**
 * Blueprint B — watchlists.
 *
 * The one design rule here: a watch you save must be a watch that can fire.
 * The preview endpoint exists so nobody saves "blender under $5 at 90% off"
 * and then quietly concludes the product is broken three weeks later.
 */

import { Router } from 'express';
import { getDb, type Db } from '../../db/client.js';
import { requireAuth, requirePlan, rateLimit, idParam, route } from '../middleware.js';
import { resolveTerm, normalizeTerm } from '../../engine/terms.js';
import { countRecentMatches, type GeoScope, type WatchCriteria } from '../../engine/match.js';

export const watchlists = Router();

// Reject a non-numeric :id with a clean 400 before it reaches a bigint query.
// ('/watchlists/preview' is a static route, not :id, so it is unaffected.)
watchlists.param('id', (_req, res, next, val) =>
  idParam(val) ? next() : res.status(400).json({ error: 'Invalid id.' }));

const paid = [requireAuth, requirePlan('member')];

/** Home point and radius for this user, for the distance filter. */
export async function geoFor(db: Db, userId: number): Promise<GeoScope> {
  const { rows } = await db.query<{ home_lat: number | null; home_lng: number | null; radius_mi: number | null }>(
    `SELECT home_lat, home_lng, radius_mi FROM users WHERE user_id = $1`,
    [userId],
  );
  const r = rows[0];
  return {
    lat: r?.home_lat ?? null,
    lng: r?.home_lng ?? null,
    radiusMi: r?.radius_mi ?? null,
  };
}

const RETAILERS = ['homedepot', 'lowes'];

/** Shape and clamp whatever the client sent. */
function readBody(body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>;
  const term = normalizeTerm(String(b.term ?? ''));

  const minDiscount = Math.min(Math.max(Number(b.min_discount ?? 40) || 0, 0), 99);
  const rawMax = b.max_price;
  const maxPrice =
    rawMax === null || rawMax === undefined || rawMax === ''
      ? null
      : Math.max(Number(rawMax) || 0, 0);
  const retailer = RETAILERS.includes(String(b.retailer)) ? String(b.retailer) : null;

  return { term, minDiscount, maxPrice, retailer };
}

/* ---------------------------------------------------------------------------
 * GET /api/watchlists/preview — before you save it, does it fire?
 * Declared before /:id so "preview" is never read as an id.
 * ------------------------------------------------------------------------- */
watchlists.get('/watchlists/preview', ...paid, rateLimit({ key: 'preview', max: 60, windowMs: 60_000 }), route(async (req, res) => {
  const db = await getDb();
  const term = normalizeTerm(String(req.query.term ?? ''));
  if (!term) return res.status(400).json({ error: 'Type something to watch for.' });

  // The form is the right place to spend an LLM call: it happens once per new
  // term, a person is waiting for the answer, and the result is cached forever.
  const resolved = await resolveTerm(db, term, true);
  const criteria: WatchCriteria = {
    term,
    categoryIds: resolved.categoryIds,
    minDiscount: Math.min(Math.max(Number(req.query.min_discount ?? 40) || 0, 0), 99),
    maxPrice: req.query.max_price ? Number(req.query.max_price) : null,
    retailer: RETAILERS.includes(String(req.query.retailer)) ? String(req.query.retailer) : null,
  };

  const geo = await geoFor(db, req.user!.user_id);
  const matched = await countRecentMatches(db, criteria, geo, 7);

  res.json({
    term,
    category_ids: resolved.categoryIds,
    source: resolved.source,
    confidence: resolved.confidence,
    matched_last_week: matched,
    // The UI says something different when we are guessing from the title.
    matching_on: resolved.categoryIds.length > 0 ? 'category' : 'title',
  });
}));

/* ---------------------------------------------------------------------------
 * GET /api/watchlists
 * ------------------------------------------------------------------------- */
watchlists.get('/watchlists', ...paid, route(async (req, res) => {
  const db = await getDb();
  const { rows } = await db.query<Record<string, unknown>>(
    `SELECT w.watch_id, w.term, w.category_ids, w.min_discount, w.max_price,
            w.retailer, w.active, w.created_at,
            (SELECT COUNT(*)::int FROM alerts a
              WHERE a.watch_id = w.watch_id
                AND a.sent_at >= now() - INTERVAL '7 days') AS alerts_7d
       FROM watchlists w
      WHERE w.user_id = $1
      ORDER BY w.created_at DESC`,
    [req.user!.user_id],
  );

  const geo = await geoFor(db, req.user!.user_id);

  // Match counts are per-watch queries. Fine at watchlist scale — nobody has
  // 400 watches — and it keeps the count honest rather than cached and stale.
  const out = [];
  for (const w of rows) {
    const matched = await countRecentMatches(
      db,
      {
        term: String(w.term),
        categoryIds: (w.category_ids as string[]) ?? [],
        minDiscount: Number(w.min_discount ?? 0),
        maxPrice: w.max_price === null ? null : Number(w.max_price),
        retailer: (w.retailer as string) ?? null,
      },
      geo,
      7,
    );
    out.push({
      watch_id: String(w.watch_id),
      term: w.term,
      category_ids: w.category_ids ?? [],
      min_discount: Number(w.min_discount ?? 0),
      max_price: w.max_price === null ? null : Number(w.max_price),
      retailer: w.retailer,
      active: w.active,
      created_at: w.created_at,
      matched_last_week: matched,
      alerts_7d: Number(w.alerts_7d ?? 0),
      matching_on: ((w.category_ids as string[]) ?? []).length > 0 ? 'category' : 'title',
    });
  }

  res.json(out);
}));

/* ---------------------------------------------------------------------------
 * POST /api/watchlists
 * ------------------------------------------------------------------------- */
watchlists.post('/watchlists', ...paid, rateLimit({ key: 'watch-write', max: 30, windowMs: 60_000 }), route(async (req, res) => {
  const db = await getDb();
  const { term, minDiscount, maxPrice, retailer } = readBody(req.body);
  if (!term) return res.status(400).json({ error: 'Type something to watch for.' });

  const existing = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM watchlists WHERE user_id = $1`,
    [req.user!.user_id],
  );
  if (Number(existing.rows[0]?.n ?? 0) >= 50) {
    return res.status(400).json({ error: 'That is the limit on watches. Delete one first.' });
  }

  const resolved = await resolveTerm(db, term, true);

  const { rows } = await db.query<{ watch_id: string }>(
    `INSERT INTO watchlists (user_id, term, category_ids, min_discount, max_price, retailer)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING watch_id`,
    [req.user!.user_id, term, resolved.categoryIds, minDiscount, maxPrice, retailer],
  );

  res.status(201).json({
    watch_id: String(rows[0]!.watch_id),
    term,
    category_ids: resolved.categoryIds,
    matching_on: resolved.categoryIds.length > 0 ? 'category' : 'title',
  });
}));

/* ---------------------------------------------------------------------------
 * PATCH /api/watchlists/:id
 * ------------------------------------------------------------------------- */
watchlists.patch('/watchlists/:id', ...paid, route(async (req, res) => {
  const db = await getDb();
  const b = (req.body ?? {}) as Record<string, unknown>;
  const { term, minDiscount, maxPrice, retailer } = readBody(req.body);

  // Re-resolve only when the term itself changed; toggling `active` should
  // never cost a vendor call.
  const termChanged = typeof b.term === 'string' && term.length > 0;
  const categoryIds = termChanged ? (await resolveTerm(db, term, true)).categoryIds : null;

  const { rowCount } = await db.query(
    `UPDATE watchlists
        SET term         = COALESCE($3, term),
            category_ids = COALESCE($4, category_ids),
            min_discount = COALESCE($5, min_discount),
            max_price    = CASE WHEN $6::boolean THEN $7 ELSE max_price END,
            retailer     = CASE WHEN $8::boolean THEN $9 ELSE retailer END,
            active       = COALESCE($10, active)
      WHERE watch_id = $1 AND user_id = $2`,
    [
      req.params.id,
      req.user!.user_id,
      termChanged ? term : null,
      categoryIds,
      b.min_discount === undefined ? null : minDiscount,
      Object.prototype.hasOwnProperty.call(b, 'max_price'),
      maxPrice,
      Object.prototype.hasOwnProperty.call(b, 'retailer'),
      retailer,
      typeof b.active === 'boolean' ? b.active : null,
    ],
  );

  if (rowCount === 0) return res.status(404).json({ error: 'No such watch.' });
  res.json({ ok: true });
}));

/* ---------------------------------------------------------------------------
 * DELETE /api/watchlists/:id
 * ------------------------------------------------------------------------- */
watchlists.delete('/watchlists/:id', ...paid, route(async (req, res) => {
  const db = await getDb();
  const { rowCount } = await db.query(
    `DELETE FROM watchlists WHERE watch_id = $1 AND user_id = $2`,
    [req.params.id, req.user!.user_id],
  );
  if (rowCount === 0) return res.status(404).json({ error: 'No such watch.' });
  res.json({ ok: true });
}));
