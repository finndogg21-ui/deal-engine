/**
 * Blueprint E — verified finds.
 *
 * The most important endpoint in the product. Everything else predicts;
 * this is the only place reality gets written down.
 */

import { Router } from 'express';
import { getDb } from '../../db/client.js';
import { requireAuth, requireRealUser, requirePlan, rateLimit, route } from '../middleware.js';
import {
  applyCorroboration, canSeeVerified, currentReputation, recordReport,
} from '../../engine/reputation.js';

export const finds = Router();

const paid = [requireAuth, requirePlan('member')];
const OUTCOMES = ['found', 'not_found', 'wrong_price'];

/* ---------------------------------------------------------------------------
 * POST /api/finds — record what actually happened at the register.
 * ------------------------------------------------------------------------- */
finds.post('/finds', ...paid, rateLimit({ key: 'finds', max: 60, windowMs: 60_000 }), route(async (req, res) => {
  const db = await getDb();
  const { product_id, store_id, outcome, actual_price, notes, evidence_url } = req.body ?? {};

  if (!product_id || !store_id) {
    return res.status(400).json({ error: 'product_id and store_id are required' });
  }
  if (!OUTCOMES.includes(outcome)) {
    return res.status(400).json({ error: `outcome must be one of ${OUTCOMES.join(', ')}` });
  }

  // Only accept evidence we can actually render, and never a javascript: or
  // data: URL — this string ends up in an href.
  let evidence: string | null = null;
  if (evidence_url) {
    const raw = String(evidence_url).slice(0, 500);
    if (!/^https:\/\//i.test(raw)) {
      return res.status(400).json({ error: 'Evidence has to be an https link.' });
    }
    evidence = raw;
  }

  const userId = req.user!.user_id;

  // The score that sent them there, captured before anything recalibrates —
  // this is what makes finds an answer key rather than a log.
  const st = await db.query<{ penny_score: number }>(
    `SELECT penny_score FROM sku_state WHERE product_id = $1 AND store_id = $2`,
    [product_id, store_id],
  );

  const weight = await currentReputation(db, userId);

  const { rows } = await db.query<{ find_id: string }>(
    `INSERT INTO finds
       (user_id, product_id, store_id, outcome, actual_price, score_at_time, notes, evidence_url, weight)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING find_id`,
    [
      userId, product_id, store_id, outcome, actual_price ?? null,
      st.rows[0]?.penny_score ?? null,
      notes ? String(notes).slice(0, 2000) : null,
      evidence, weight,
    ],
  );

  await recordReport(db, userId);
  const agreement = await applyCorroboration(db, userId, String(product_id), String(store_id), outcome);

  res.status(201).json({
    find_id: String(rows[0]!.find_id),
    weight,
    ...agreement,
    reputation: await currentReputation(db, userId),
  });
}));

/* ---------------------------------------------------------------------------
 * GET /api/finds/verified — the reciprocity-gated feed.
 * ------------------------------------------------------------------------- */
finds.get('/finds/verified', ...paid, route(async (req, res) => {
  const db = await getDb();
  const userId = req.user!.user_id;

  const gate = await canSeeVerified(db, userId);
  if (!gate.ok) {
    // 403 with a reason the UI can show verbatim. This is a social gate, not
    // an error, so it explains how to open it.
    return res.status(403).json({ error: gate.reason, gated: true });
  }

  const radius = Number(req.query.radius ?? 0) || null;
  const hours = Math.min(Number(req.query.hours ?? 72) || 72, 336);

  const { rows } = await db.query<Record<string, unknown>>(
    `SELECT f.find_id, f.product_id, f.store_id, f.outcome, f.actual_price,
            f.score_at_time, f.recorded_at, f.evidence_url, f.weight,
            p.title, p.image_url, p.retailer, p.category,
            st.name AS store_name, st.lat, st.lng,
            s.penny_score, s.last_price, s.last_stock,
            -- How many distinct spotters agree, which is the number that
            -- actually justifies driving there.
            (SELECT COUNT(DISTINCT g.user_id)::int FROM finds g
              WHERE g.product_id = f.product_id AND g.store_id = f.store_id
                AND g.outcome = f.outcome
                AND g.recorded_at >= now() - ($2 || ' hours')::interval) AS agreeing_spotters,
            (SELECT ROUND(SUM(g.weight)::numeric, 2) FROM finds g
              WHERE g.product_id = f.product_id AND g.store_id = f.store_id
                AND g.outcome = f.outcome
                AND g.recorded_at >= now() - ($2 || ' hours')::interval) AS agreeing_weight
       FROM finds f
       JOIN products p ON p.product_id = f.product_id
       JOIN stores  st ON st.store_id  = f.store_id
       LEFT JOIN sku_state s
              ON s.product_id = f.product_id AND s.store_id = f.store_id
      WHERE f.outcome = 'found'
        AND f.recorded_at >= now() - ($2 || ' hours')::interval
      ORDER BY f.recorded_at DESC
      LIMIT 200`,
    [userId, String(hours)],
  );

  const me = await db.query<{ home_lat: number | null; home_lng: number | null }>(
    `SELECT home_lat, home_lng FROM users WHERE user_id = $1`,
    [userId],
  );
  const home = me.rows[0];

  const miles = (lat: number, lng: number) => {
    if (home?.home_lat == null || home?.home_lng == null) return null;
    const R = 3958.8;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat - home.home_lat!);
    const dLng = toRad(lng - home.home_lng!);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(home.home_lat!)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
    return Math.round(R * 2 * Math.asin(Math.sqrt(a)) * 10) / 10;
  };

  const out = rows
    .map((r) => {
      const lat = r.lat === null ? null : Number(r.lat);
      const lng = r.lng === null ? null : Number(r.lng);
      return {
        find_id: String(r.find_id),
        product_id: r.product_id,
        store_id: r.store_id,
        title: r.title,
        image_url: r.image_url,
        retailer: r.retailer,
        category: r.category,
        store_name: r.store_name,
        distance_mi: lat !== null && lng !== null ? miles(lat, lng) : null,
        actual_price: r.actual_price === null ? null : Number(r.actual_price),
        score_at_time: r.score_at_time,
        penny_score: r.penny_score,
        last_price: r.last_price === null ? null : Number(r.last_price),
        stock_qty: r.last_stock,
        recorded_at: r.recorded_at,
        evidence_url: r.evidence_url,
        agreeing_spotters: Number(r.agreeing_spotters ?? 1),
        // Sum of reporter reputations. Three trusted spotters and three fresh
        // accounts are not the same claim, and this is where that shows.
        agreeing_weight: Number(r.agreeing_weight ?? 1),
      };
    })
    .filter((r) => radius === null || r.distance_mi === null || r.distance_mi <= radius);

  res.json(out);
}));

/* GET /api/me/spotter — your own standing, and what the gate wants.
   requireRealUser (not requireAuth): the shared public-preview identity is the
   operator row, so requireAuth here leaked the operator's private spotter stats
   to anonymous visitors. */
finds.get('/me/spotter', requireRealUser, route(async (req, res) => {
  const db = await getDb();
  const userId = req.user!.user_id;
  const { rows } = await db.query<Record<string, unknown>>(
    `SELECT reports, corroborated, contradicted, reputation, last_report_at
       FROM spotter_stats WHERE user_id = $1`,
    [userId],
  );
  const gate = await canSeeVerified(db, userId);
  const s = rows[0];
  res.json({
    reports: Number(s?.reports ?? 0),
    corroborated: Number(s?.corroborated ?? 0),
    contradicted: Number(s?.contradicted ?? 0),
    reputation: s ? Number(s.reputation) : 1.0,
    last_report_at: s?.last_report_at ?? null,
    verified_access: gate.ok,
    gate_reason: gate.reason ?? null,
  });
}));
