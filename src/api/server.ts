/**
 * Operator API. JSON only — the dashboard is one client of it, and the mobile
 * app will be another. Nothing here renders HTML.
 *
 *   npm run dev
 */

import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { getDb, OPERATOR_USER_ID } from '../db/client.js';
import { confidenceLabel } from '../engine/score.js';

const here = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

const HOME_LAT = Number(process.env.HOME_LAT ?? 29.6047);
const HOME_LNG = Number(process.env.HOME_LNG ?? -98.4947);

/** Great-circle distance in miles. */
function distanceMi(lat: number, lng: number): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat - HOME_LAT);
  const dLng = toRad(lng - HOME_LNG);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(HOME_LAT)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.asin(Math.sqrt(a)) * 10) / 10;
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/* ---------------------------------------------------------------------------
 * GET /api/candidates
 * ------------------------------------------------------------------------- */
app.get('/api/candidates', async (req, res) => {
  try {
    const db = await getDb();
    const minScore = Number(req.query.min_score ?? 0);
    const minDiscount = Number(req.query.min_discount ?? 0);
    const stage = typeof req.query.stage === 'string' ? req.query.stage : null;
    const limit = Math.min(Number(req.query.limit ?? 100), 500);

    const { rows } = await db.query<Record<string, unknown>>(
      `SELECT s.product_id, s.store_id, s.stage, s.stage_entered_at,
              s.penny_score, s.last_price, s.last_discount, s.last_stock,
              s.last_seen_at,
              p.title, p.category, p.retailer,
              st.name AS store_name, st.lat, st.lng, st.zip
         FROM sku_state s
         JOIN products p ON p.product_id = s.product_id
         JOIN stores  st ON st.store_id  = s.store_id
        WHERE s.penny_score >= $1
          AND COALESCE(s.last_discount, 0) >= $2
          AND ($3::text IS NULL OR s.stage = $3)
        ORDER BY s.penny_score DESC, s.last_discount DESC
        LIMIT $4`,
      [minScore, minDiscount, stage, limit],
    );

    res.json(
      rows.map((r) => {
        const lat = num(r.lat);
        const lng = num(r.lng);
        const scoreVal = Number(r.penny_score ?? 0);
        return {
          product_id: r.product_id,
          store_id: r.store_id,
          title: r.title,
          category: r.category,
          retailer: r.retailer,
          store_name: r.store_name,
          zip: r.zip,
          distance_mi: lat !== null && lng !== null ? distanceMi(lat, lng) : null,
          stage: r.stage,
          stage_entered_at: r.stage_entered_at,
          penny_score: scoreVal,
          confidence: confidenceLabel(scoreVal),
          price: num(r.last_price),
          discount_pct: num(r.last_discount),
          stock_qty: r.last_stock,
          last_seen_at: r.last_seen_at,
        };
      }),
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'candidates query failed' });
  }
});

/* ---------------------------------------------------------------------------
 * GET /api/candidates/:productId/:storeId  — the decision screen
 * ------------------------------------------------------------------------- */
app.get('/api/candidates/:productId/:storeId', async (req, res) => {
  try {
    const db = await getDb();
    const { productId, storeId } = req.params;

    const head = await db.query<Record<string, unknown>>(
      `SELECT s.*, p.title, p.category, p.retailer, p.sku,
              st.name AS store_name, st.address, st.zip, st.lat, st.lng
         FROM sku_state s
         JOIN products p ON p.product_id = s.product_id
         JOIN stores  st ON st.store_id  = s.store_id
        WHERE s.product_id = $1 AND s.store_id = $2`,
      [productId, storeId],
    );
    const r = head.rows[0];
    if (!r) return res.status(404).json({ error: 'not found' });

    const history = await db.query<Record<string, unknown>>(
      `SELECT observed_at, price, list_price, discount_pct, stock_qty, availability
         FROM price_observations
        WHERE product_id = $1 AND store_id = $2
        ORDER BY observed_at`,
      [productId, storeId],
    );

    const finds = await db.query<Record<string, unknown>>(
      `SELECT outcome, actual_price, score_at_time, notes, recorded_at
         FROM finds
        WHERE product_id = $1 AND store_id = $2 AND user_id = $3
        ORDER BY recorded_at DESC`,
      [productId, storeId, OPERATOR_USER_ID],
    );

    const lat = num(r.lat);
    const lng = num(r.lng);
    const scoreVal = Number(r.penny_score ?? 0);

    res.json({
      product_id: r.product_id,
      store_id: r.store_id,
      title: r.title,
      sku: r.sku,
      category: r.category,
      retailer: r.retailer,
      store: {
        name: r.store_name,
        address: r.address,
        zip: r.zip,
        distance_mi: lat !== null && lng !== null ? distanceMi(lat, lng) : null,
        maps_url:
          lat !== null && lng !== null
            ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
            : null,
      },
      stage: r.stage,
      stage_entered_at: r.stage_entered_at,
      prev_stage: r.prev_stage,
      penny_score: scoreVal,
      confidence: confidenceLabel(scoreVal),
      price: num(r.last_price),
      discount_pct: num(r.last_discount),
      stock_qty: r.last_stock,
      last_seen_at: r.last_seen_at,
      price_history: history.rows.map((h) => ({
        observed_at: h.observed_at,
        price: num(h.price),
        list_price: num(h.list_price),
        discount_pct: num(h.discount_pct),
        stock_qty: h.stock_qty,
        availability: h.availability,
      })),
      prior_finds: finds.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'detail query failed' });
  }
});

/* ---------------------------------------------------------------------------
 * POST /api/finds — ground truth. The most important endpoint here.
 * ------------------------------------------------------------------------- */
app.post('/api/finds', async (req, res) => {
  try {
    const db = await getDb();
    const { product_id, store_id, outcome, actual_price, notes } = req.body ?? {};

    if (!product_id || !store_id) {
      return res.status(400).json({ error: 'product_id and store_id are required' });
    }
    const allowed = ['found', 'not_found', 'wrong_price'];
    if (!allowed.includes(outcome)) {
      return res.status(400).json({ error: `outcome must be one of ${allowed.join(', ')}` });
    }

    // Capture the score that sent them there — this is what makes finds an
    // answer key rather than just a log.
    const st = await db.query<{ penny_score: number }>(
      `SELECT penny_score FROM sku_state WHERE product_id = $1 AND store_id = $2`,
      [product_id, store_id],
    );

    const { rows } = await db.query<{ find_id: string }>(
      `INSERT INTO finds (user_id, product_id, store_id, outcome, actual_price, score_at_time, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING find_id`,
      [
        OPERATOR_USER_ID,
        product_id,
        store_id,
        outcome,
        actual_price ?? null,
        st.rows[0]?.penny_score ?? null,
        notes ?? null,
      ],
    );

    res.status(201).json({ find_id: rows[0]?.find_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'could not record find' });
  }
});

/* ---------------------------------------------------------------------------
 * GET /api/scan/health — the alarm for silent failure
 * ------------------------------------------------------------------------- */
app.get('/api/scan/health', async (_req, res) => {
  try {
    const db = await getDb();
    const last = await db.query<Record<string, unknown>>(
      `SELECT run_id, source, started_at, finished_at, status, rows_written, canary_ok
         FROM scan_runs ORDER BY started_at DESC LIMIT 1`,
    );
    const avg = await db.query<{ avg: string | null }>(
      `SELECT AVG(rows_written)::numeric(10,1) AS avg FROM (
         SELECT rows_written FROM scan_runs
          WHERE status IN ('ok','partial') ORDER BY started_at DESC LIMIT 7) t`,
    );

    const run = last.rows[0] ?? null;
    const startedAt = run?.started_at ? new Date(run.started_at as string) : null;
    const hoursSince = startedAt
      ? Math.round(((Date.now() - startedAt.getTime()) / 3_600_000) * 10) / 10
      : null;

    res.json({
      last_run: run,
      trailing_avg_rows: num(avg.rows[0]?.avg ?? null),
      hours_since: hoursSince,
      // The scan is daily. Silence past 26 hours means something broke, and a
      // broken scan looks exactly like a quiet day.
      stale: hoursSince === null || hoursSince > 26,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'health query failed' });
  }
});

/* ---------------------------------------------------------------------------
 * Hit rate — is the whole premise real?
 * ------------------------------------------------------------------------- */
app.get('/api/stats/hit-rate', async (_req, res) => {
  try {
    const db = await getDb();
    const { rows } = await db.query<Record<string, unknown>>(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE outcome = 'found')::int AS found,
              AVG(score_at_time) FILTER (WHERE outcome = 'found')::numeric(5,1) AS avg_score_found,
              AVG(score_at_time) FILTER (WHERE outcome = 'not_found')::numeric(5,1) AS avg_score_missed
         FROM finds WHERE user_id = $1`,
      [OPERATOR_USER_ID],
    );
    const r = rows[0] ?? {};
    const total = Number(r.total ?? 0);
    const found = Number(r.found ?? 0);
    res.json({
      total,
      found,
      hit_rate: total > 0 ? Math.round((found / total) * 1000) / 10 : null,
      avg_score_found: num(r.avg_score_found ?? null),
      avg_score_missed: num(r.avg_score_missed ?? null),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'stats query failed' });
  }
});

// Serve the built dashboard if it exists, so one process runs everything.
const webDist = join(here, '../../web/dist');
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get('*', (_req, res) => res.sendFile(join(webDist, 'index.html')));
}

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log(`deal-engine api  http://localhost:${port}`);
});
