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
import { getDb } from '../db/client.js';
import { confidenceLabel } from '../engine/score.js';
import { EXCLUDE_BUNDLES_SQL, EXCLUDE_HD_REJECTED_SQL } from '../engine/bundle.js';
import { tieredFloorSql } from '../engine/deal-floor.js';
import { cookies, loadUser, requireAuth, requirePlan, rateLimit, route } from './middleware.js';
import { auth } from './routes/auth.js';
import { contact } from './routes/contact.js';
import { watchlists } from './routes/watchlists.js';
import { alerts } from './routes/alerts.js';
import { finds } from './routes/finds.js';
import { inventory } from './routes/inventory.js';
import { orders } from './routes/orders.js';
import { stock } from './routes/stock.js';
import { stockFind } from './routes/stock-find.js';
import { stockQueue } from './routes/stock-queue.js';
import { nearbyDeals } from './routes/nearby-deals.js';
import { communityDeals } from './routes/community-deals.js';
import { publishedDealsRoute } from './routes/published-deals.js';
import { startStockWorker } from './stock-worker.js';
import { billing } from './routes/billing.js';
import { admin } from './routes/admin.js';
import { coverageFor } from '../coverage.js';

const here = dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

/**
 * Security headers on EVERY response (the API and the SPA HTML it serves). Set
 * directly rather than pulling in helmet for a handful of setHeader calls.
 * The CSP is permissive-but-real for a Vite/React SPA + Google Fonts + retailer
 * images: script 'self' (the built bundle is external, no inline script);
 * style 'unsafe-inline' for React style={{}} attributes and the Google Fonts
 * stylesheet; img https: because product photos come from many retailer CDNs;
 * connect 'self' for the same-origin API. Stripe Checkout is a full-page
 * redirect, so it needs no script/frame allowance here.
 */
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // Cross-origin isolation (OWASP Secure Headers baseline, 2025). COOP severs the
  // window.opener link to cross-origin popups (XS-Leaks / tabnabbing); CORP stops
  // other origins from embedding our resources (Spectre-class side channels / XSSI).
  // Safe here: the app opens no cross-origin popups (Stripe checkout is a full-page
  // redirect and deal buy-links use noopener), and nothing loads our bundle or API
  // cross-origin. Fonts/images come FROM other origins, governed by THEIR CORP.
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  // A private API response must never sit in a shared/browser cache. Only /api is
  // marked no-store; content-hashed static assets keep their normal long caching.
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self'",
    "upgrade-insecure-requests",
  ].join('; '));
  next();
});

/**
 * The Stripe webhook must see the exact bytes Stripe signed, so it is mounted
 * with express.raw BEFORE express.json. Order matters: json() marks the body
 * consumed, and a re-serialised body will never match the signature. Getting
 * this backwards produces a webhook that appears to work and can verify
 * nothing.
 */
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json', limit: '1mb' }));

app.use(express.json({ limit: '256kb' }));

/**
 * GET /api/health — for the host's health checker, so it is mounted before the
 * cookie/session middleware: probes send no cookies and should not pay for a
 * session lookup. No auth, no writes; one SELECT 1 proves the DB is reachable,
 * which is the difference between "process up" and "actually serving".
 */
app.get('/api/health', async (_req, res) => {
  try {
    const db = await getDb();
    await db.query('SELECT 1');
    res.json({ ok: true, db: db.driver });
  } catch (err) {
    console.error('health check failed', err);
    res.status(503).json({ ok: false });
  }
});

app.use(cookies);
app.use(loadUser);

app.use('/api/auth', auth);
app.use('/api', contact);
app.use('/api', watchlists);
app.use('/api', alerts);
app.use('/api', finds);
app.use('/api', inventory);
app.use('/api', orders);
app.use('/api', stock);
app.use('/api', stockFind);
app.use('/api', stockQueue);
app.use('/api', nearbyDeals);
app.use('/api', communityDeals);
app.use('/api', publishedDealsRoute);
app.use('/api', billing);
app.use('/api', admin);

/** Deal data is the product, so reading it is the paywall. Operators bypass. */
const paid = [requireAuth, requirePlan('member')];

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
 * GET /api/coverage — do we work where this person lives?
 *
 * Public, because the pricing page and onboarding both need to answer it
 * BEFORE taking money. Selling a plan into a metro with no price history is
 * the fastest possible refund.
 * ------------------------------------------------------------------------- */
app.get('/api/coverage', rateLimit({ key: 'coverage', max: 60, windowMs: 60_000 }), async (req, res) => {
  try {
    const db = await getDb();
    const zip = typeof req.query.zip === 'string' ? req.query.zip : (req.user?.zip ?? null);
    res.json(await coverageFor(db, zip));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'coverage check failed' });
  }
});

/* ---------------------------------------------------------------------------
 * GET /api/candidates
 * ------------------------------------------------------------------------- */
app.get('/api/candidates', ...paid, rateLimit({ key: 'candidates', max: 60, windowMs: 60_000 }), async (req, res) => {
  try {
    const db = await getDb();
    const minScore = Number(req.query.min_score ?? 0);
    /**
     * A "deal" means a HEAVY markdown, not any markdown. 25% is the floor:
     * 5-10% off is ordinary retail noise, and a feed full of it trains people
     * to ignore the feed. The sweep still records everything, because history
     * is the asset — this is a display decision, not an ingest one.
     */
    const minDiscount = Number(req.query.min_discount ?? 25);
    const stage = typeof req.query.stage === 'string' ? req.query.stage : null;
    /**
     * Penny view. This means PENNY, not "close to it".
     *
     * Two things qualify and nothing else: a price that is literally $X.01, or
     * `penny_candidate` stage, which is the real definition of the thing — an
     * item that walked the whole markdown ladder, vanished from the site, and
     * still has stock sitting on the floor.
     *
     * A .03 is the final markdown, so it is genuinely the step before a penny,
     * and the tempting move is to let it in so the page has something on it.
     * That is exactly the mistake. If this page lists $7.03 items, "penny" stops
     * meaning anything, and the one page where the promise has to be literal is
     * the one carrying the whole product's credibility. An honest empty page is
     * worth more than a padded one, and the .03 items are still on All deals.
     */
    const pennyOnly = String(req.query.penny ?? '') === '1';
    const limit = Math.min(Number(req.query.limit ?? 100), 500);
    // Blueprint I. Applied after distance is computed, since the great-circle
    // maths already lives in JS here.
    const radius = req.query.radius ? Number(req.query.radius) : null;

    const { rows } = await db.query<Record<string, unknown>>(
      `SELECT s.product_id, s.store_id, s.stage, s.stage_entered_at,
              s.penny_score, s.last_price, s.last_discount, s.last_stock,
              s.last_seen_at, s.aisle_bay,
              s.score_ladder, s.score_divergence, s.score_dwell, s.score_scarcity, s.score_price_code,
              -- Has anyone actually stood there and confirmed it?
              (SELECT COUNT(DISTINCT f.user_id)::int FROM finds f
                WHERE f.product_id = s.product_id AND f.store_id = s.store_id
                  AND f.outcome = 'found'
                  AND f.recorded_at >= now() - INTERVAL '7 days') AS verified_by,
              p.title, p.category, p.retailer, p.image_url, p.product_url,
              st.name AS store_name, st.store_number, st.lat, st.lng, st.zip,
              -- How many other stores carry this SKU, for "compare N stores".
              (SELECT COUNT(*) - 1 FROM sku_state o WHERE o.product_id = s.product_id)::int
                AS other_stores
         FROM sku_state s
         JOIN products p ON p.product_id = s.product_id
         JOIN stores  st ON st.store_id  = s.store_id
        WHERE s.penny_score >= $1
          AND COALESCE(s.last_discount, 0) >= $2
          AND ($3::text IS NULL OR s.stage = $3)
          -- Price-tiered floor: cheap items must be marked down harder to be a
          -- real reseller deal. See deal-floor.ts.
          AND ${tieredFloorSql('s.last_price', 's.last_discount')}
          -- Delivery-only bundles have no real shelf stock; hide them. See bundle.ts.
          AND ${EXCLUDE_BUNDLES_SQL}
          -- Home Depot said no; see bundle.ts + discovery pool.
          AND ${EXCLUDE_HD_REJECTED_SQL}
          AND ($5::boolean IS NOT TRUE
               -- Walked the ladder, delisted, stock still on the shelf.
               OR s.stage = 'penny_candidate'
               -- Or the price is literally a penny. 20 is the score for a .01
               -- ending; .03 (18), .02 (15) and .06 (8) are NOT pennies and are
               -- deliberately shut out, however close .03 gets.
               OR COALESCE(s.score_price_code, 0) = 20)
        ORDER BY s.penny_score DESC, s.last_discount DESC
        LIMIT $4`,
      [minScore, minDiscount, stage, limit, pennyOnly],
    );

    const mapped = rows.map((r) => {
        const lat = num(r.lat);
        const lng = num(r.lng);
        const scoreVal = Number(r.penny_score ?? 0);
        const price = num(r.last_price);
        const disc = num(r.last_discount);
        // Derived, not stored: what it was before the markdown. Only shown
        // when we have both numbers to derive it from.
        const listPrice =
          price !== null && disc !== null && disc > 0 && disc < 100
            ? Math.round((price / (1 - disc / 100)) * 100) / 100
            : null;
        return {
          product_id: r.product_id,
          store_id: r.store_id,
          title: r.title,
          category: r.category,
          retailer: r.retailer,
          image_url: r.image_url,
          product_url: r.product_url,
          store_name: r.store_name,
          store_number: r.store_number,
          aisle_bay: r.aisle_bay,
          other_stores: Number(r.other_stores ?? 0),
          /* In-store only when the site no longer lists it but units remain. */
          in_store_only: r.stage === 'penny_candidate' || r.stage === 'delisted',
          zip: r.zip,
          distance_mi: lat !== null && lng !== null ? distanceMi(lat, lng) : null,
          stage: r.stage,
          stage_entered_at: r.stage_entered_at,
          penny_score: scoreVal,
          confidence: confidenceLabel(scoreVal),
          price,
          list_price: listPrice,
          saves: price !== null && listPrice !== null
            ? Math.round((listPrice - price) * 100) / 100
            : null,
          discount_pct: disc,
          stock_qty: r.last_stock,
          last_seen_at: r.last_seen_at,
          verified_by: Number(r.verified_by ?? 0),
          // Blueprint I: the breakdown has to explain why a number is 98,
          // not just assert it.
          score_breakdown: {
            ladder: Number(r.score_ladder ?? 0),
            divergence: Number(r.score_divergence ?? 0),
            dwell: Number(r.score_dwell ?? 0),
            scarcity: Number(r.score_scarcity ?? 0),
            price_code: Number(r.score_price_code ?? 0),
          },
        };
      });

    res.json(
      radius === null
        ? mapped
        // Unknown distance is kept rather than dropped: a store with no
        // coordinates is a data gap, not a store that is far away.
        : mapped.filter((r) => r.distance_mi === null || r.distance_mi <= radius),
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'candidates query failed' });
  }
});

/* ---------------------------------------------------------------------------
 * GET /api/candidates/:productId/:storeId  — the decision screen
 * ------------------------------------------------------------------------- */
app.get('/api/candidates/:productId/:storeId', ...paid, rateLimit({ key: 'candidate-detail', max: 60, windowMs: 60_000 }), async (req, res) => {
  try {
    const db = await getDb();
    const { productId, storeId } = req.params;

    const head = await db.query<Record<string, unknown>>(
      `SELECT s.*, p.title, p.category, p.retailer, p.sku, p.product_url,
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
      [productId, storeId, req.user!.user_id],
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
      product_url: r.product_url,
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
 * GET /api/scan/health — the alarm for silent failure
 * ------------------------------------------------------------------------- */
app.get('/api/scan/health', ...paid, async (_req, res) => {
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
app.get('/api/stats/hit-rate', ...paid, async (req, res) => {
  try {
    const db = await getDb();
    const { rows } = await db.query<Record<string, unknown>>(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE outcome = 'found')::int AS found,
              AVG(score_at_time) FILTER (WHERE outcome = 'found')::numeric(5,1) AS avg_score_found,
              AVG(score_at_time) FILTER (WHERE outcome = 'not_found')::numeric(5,1) AS avg_score_missed
         FROM finds WHERE user_id = $1`,
      [req.user!.user_id],
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
  app.all('*', (req, res) => {
    // An unmatched /api path is a typo or a stale client, not a page. Handing
    // it index.html would return 200 + HTML to code expecting JSON, which
    // reads as data corruption instead of the 404 it actually is.
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found.' });
    res.sendFile(join(webDist, 'index.html'));
  });
}

/**
 * API_PORT wins over PORT.
 *
 * In dev the API and Vite are two processes, and any tool that launches
 * `npm run dev` with a PORT set (preview harnesses, IDE runners) would
 * otherwise hand the API Vite's port. The API then binds it, Vite's proxy
 * gets ECONNREFUSED, and every request 500s with an empty body — which reads
 * like a broken API rather than a port collision.
 *
 * PORT is still honoured second, because that is what hosts set in production.
 *
 * `||` rather than `??`: a .env copied from the example often leaves
 * `API_PORT=` blank, and Number('') is 0 — which binds a random port and
 * makes the health check miss a server that is otherwise fine.
 */
const port = Number(process.env.API_PORT || process.env.PORT || 8787);

/**
 * Misconfiguration that must not be quiet. Neither of these crashes the boot —
 * the dev-activate endpoint is already double-locked and PGlite still runs —
 * but both mean a production deploy is not what the operator thinks it is.
 */
if (process.env.NODE_ENV === 'production') {
  if (process.env.ALLOW_DEV_PLAN_ACTIVATION === 'true') {
    console.warn(
      '*** ALLOW_DEV_PLAN_ACTIVATION=true in production. The endpoint stays disabled '
      + '(NODE_ENV lock), but this flag hands out free plans in any non-production '
      + 'process sharing this env. Remove it from the production environment. ***',
    );
  }
  if ((process.env.DB_DRIVER ?? 'pglite') !== 'postgres') {
    console.warn(
      '*** NODE_ENV=production but DB_DRIVER is not "postgres". PGlite is a local '
      + 'dev file with no durability warranty — production data belongs in Neon. ***',
    );
  }
}

startStockWorker();

app.listen(port, () => {
  console.log(`deal-engine api  http://localhost:${port}`);
});
