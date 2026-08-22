/**
 * Blueprint L — admin.
 *
 * "Done when a broken scan is visible here before a customer notices."
 * Everything on this page is chosen against that sentence: scan history with
 * row counts against the trailing average, the delivery backlog, and the
 * message queue.
 */

import { Router } from 'express';
import { getDb } from '../../db/client.js';
import { requireOperator, route } from '../middleware.js';
import { apifyReady } from '../../vendors/apify.js';
import { keepaReady } from '../../vendors/keepa.js';
import { unwrangleReady } from '../../vendors/unwrangle.js';
import { stripeReady } from '../../vendors/stripe.js';
import { mailerReady } from '../../vendors/mailer.js';
import { llmReady } from '../../vendors/llm.js';
import { PLANS } from '../../vendors/stripe.js';

export const admin = Router();

const n = (v: unknown) => Number(v ?? 0);

admin.get('/admin/overview', requireOperator, route(async (_req, res) => {
  const db = await getDb();

  const runs = await db.query<Record<string, unknown>>(
    `SELECT run_id, source, started_at, finished_at, status, rows_written, canary_ok, error
       FROM scan_runs ORDER BY started_at DESC LIMIT 14`,
  );

  const avg = await db.query<{ avg: string | null }>(
    `SELECT AVG(rows_written)::numeric(10,1) AS avg FROM (
       SELECT rows_written FROM scan_runs
        WHERE status IN ('ok','partial') ORDER BY started_at DESC LIMIT 7) t`,
  );

  const counts = await db.query<Record<string, unknown>>(
    `SELECT
       (SELECT COUNT(*)::int FROM users WHERE email IS NOT NULL)          AS users,
       (SELECT COUNT(*)::int FROM users WHERE plan <> 'none')             AS paying,
       (SELECT COUNT(*)::int FROM subscriptions
         WHERE founding AND status IN ('active','trialing'))              AS founding_taken,
       (SELECT COUNT(*)::int FROM products)                               AS products,
       (SELECT COUNT(*)::int FROM price_observations)                     AS observations,
       (SELECT COUNT(*)::int FROM sku_state)                              AS sku_state,
       (SELECT COUNT(*)::int FROM watchlists WHERE active)                AS watches,
       (SELECT COUNT(*)::int FROM alerts
         WHERE sent_at >= now() - INTERVAL '7 days')                      AS alerts_7d,
       -- A backlog here means the mailer is failing silently.
       (SELECT COUNT(*)::int FROM alerts WHERE delivered_at IS NULL)      AS alerts_undelivered,
       (SELECT COUNT(*)::int FROM messages WHERE handled_at IS NULL)      AS messages_open`,
  );

  const hit = await db.query<Record<string, unknown>>(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE outcome = 'found')::int AS found,
            AVG(score_at_time) FILTER (WHERE outcome = 'found')::numeric(5,1)     AS avg_found,
            AVG(score_at_time) FILTER (WHERE outcome = 'not_found')::numeric(5,1) AS avg_missed
       FROM finds`,
  );

  // Hit rate over time is the only number that says whether the premise holds.
  const hitByWeek = await db.query<Record<string, unknown>>(
    `SELECT to_char(date_trunc('week', recorded_at), 'YYYY-MM-DD') AS week,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE outcome = 'found')::int AS found
       FROM finds
      WHERE recorded_at >= now() - INTERVAL '12 weeks'
      GROUP BY 1 ORDER BY 1`,
  );

  const recentFinds = await db.query<Record<string, unknown>>(
    `SELECT f.find_id, f.outcome, f.actual_price, f.score_at_time, f.weight, f.recorded_at,
            p.title, st.name AS store_name, u.email
       FROM finds f
       JOIN products p ON p.product_id = f.product_id
       LEFT JOIN stores st ON st.store_id = f.store_id
       LEFT JOIN users u ON u.user_id = f.user_id
      ORDER BY f.recorded_at DESC LIMIT 20`,
  );

  const messages = await db.query<Record<string, unknown>>(
    `SELECT message_id, name, email, topic, body, created_at
       FROM messages WHERE handled_at IS NULL
      ORDER BY created_at DESC LIMIT 20`,
  );

  const last = runs.rows[0] ?? null;
  const startedAt = last?.started_at ? new Date(last.started_at as string) : null;
  const hoursSince = startedAt
    ? Math.round(((Date.now() - startedAt.getTime()) / 3_600_000) * 10) / 10
    : null;

  const c = counts.rows[0] ?? {};
  const h = hit.rows[0] ?? {};
  const total = n(h.total);

  res.json({
    scan: {
      last_run: last,
      hours_since: hoursSince,
      // Daily scan. Silence past 26 hours means something broke, and a broken
      // scan looks exactly like a quiet day.
      stale: hoursSince === null || hoursSince > 26,
      trailing_avg_rows: avg.rows[0]?.avg === null || avg.rows[0]?.avg === undefined
        ? null : Number(avg.rows[0].avg),
      runs: runs.rows.map((r) => ({
        ...r,
        rows_written: n(r.rows_written),
        // Flagged rather than judged: a low-row run may be a real quiet day,
        // but it should never pass unnoticed.
        below_average:
          avg.rows[0]?.avg != null && n(r.rows_written) < Number(avg.rows[0].avg) * 0.5,
      })),
    },
    counts: {
      users: n(c.users),
      paying: n(c.paying),
      founding_taken: n(c.founding_taken),
      founding_left: Math.max(PLANS.reseller.seatCap - n(c.founding_taken), 0),
      products: n(c.products),
      observations: n(c.observations),
      sku_state: n(c.sku_state),
      watches: n(c.watches),
      alerts_7d: n(c.alerts_7d),
      alerts_undelivered: n(c.alerts_undelivered),
      messages_open: n(c.messages_open),
    },
    hit_rate: {
      total,
      found: n(h.found),
      pct: total > 0 ? Math.round((n(h.found) / total) * 1000) / 10 : null,
      avg_score_found: h.avg_found === null ? null : Number(h.avg_found),
      avg_score_missed: h.avg_missed === null ? null : Number(h.avg_missed),
      by_week: hitByWeek.rows.map((r) => ({
        week: r.week,
        total: n(r.total),
        found: n(r.found),
        pct: n(r.total) > 0 ? Math.round((n(r.found) / n(r.total)) * 1000) / 10 : null,
      })),
    },
    // Vendor spend needs each provider's billing API. Until those are wired,
    // this reports what is connected rather than inventing a dollar figure.
    vendors: {
      apify: apifyReady(),
      keepa: keepaReady(),
      unwrangle: unwrangleReady(),
      stripe: stripeReady(),
      mailer: mailerReady(),
      llm: llmReady(),
      spend_note: 'VENDOR SPEND TRACKER GOES HERE — needs each provider billing API.',
    },
    recent_finds: recentFinds.rows,
    messages: messages.rows,
  });
}));

/* POST /api/admin/messages/:id/handled — clears the queue. */
admin.post('/admin/messages/:id/handled', requireOperator, route(async (req, res) => {
  const db = await getDb();
  const { rowCount } = await db.query(
    `UPDATE messages SET handled_at = now() WHERE message_id = $1 AND handled_at IS NULL`,
    [req.params.id],
  );
  if (rowCount === 0) return res.status(404).json({ error: 'No such message.' });
  res.json({ ok: true });
}));

/* ----------------------------------------------------------------- scan now */

import { timingSafeEqual } from 'node:crypto';
import { runScan } from '../../ingest/run-scan.js';
import { rebuild } from '../../engine/rebuild.js';
import { refreshNearbyFeed } from '../../engine/project-inventory.js';
import { verifyTopDeals } from '../../engine/verify-deals.js';

/**
 * Triggers the daily pipeline (scan, then score rebuild) inside THIS process.
 *
 * This exists because PGlite is single-connection: while the server is up, a
 * cron job running `npm run scan` in a second process would corrupt the
 * database. The scheduled task (scripts/daily-scan.ps1) therefore calls this
 * endpoint first and only falls back to the standalone scan when nothing is
 * listening on the API port.
 *
 * Auth: an operator session, or the SCAN_TRIGGER_TOKEN shared secret — cron
 * has no session, and the token lives only in .env on this machine.
 */
function scanAuthorized(req: import('express').Request): boolean {
  if (req.user?.role === 'operator') return true;
  const expect = process.env.SCAN_TRIGGER_TOKEN ?? '';
  const got = String(req.headers['x-scan-token'] ?? '');
  if (expect.length < 32 || got.length !== expect.length) return false;
  // Constant-time compare: a plain === leaks match length through timing.
  return timingSafeEqual(Buffer.from(got), Buffer.from(expect));
}

/** Only one pipeline run at a time; a second trigger while busy is a no-op. */
let scanInFlight = false;

admin.post('/admin/scan', route(async (req, res) => {
  if (!scanAuthorized(req)) return res.status(401).json({ error: 'Not available.' });
  if (scanInFlight) return res.status(409).json({ error: 'A scan is already running.' });

  scanInFlight = true;

  // Run the pipeline DETACHED and answer immediately (202). The full sweep
  // (Apify crawl + rebuild + nearby projection) runs several minutes — longer
  // than the platform's HTTP edge timeout — so answering synchronously 502s the
  // caller even on success. Worse, the cron's `curl --retry` would then fire a
  // SECOND scan (double Apify spend) once the first finishes. Detaching fixes
  // both: the caller gets an instant, clean success and the request never hangs
  // (so the platform won't recycle the container mid-run), while progress and
  // results land in scan_runs, visible on the admin overview. The scanInFlight
  // guard still turns a concurrent trigger into a safe 409, not a double run.
  void (async () => {
    try {
      const scan = await runScan();
      // Pages read sku_state, not raw history, so a scan is invisible until this.
      const scored = await rebuild();
      // Project current state into store_inventory so the "Closest to me" feed
      // reflects this scan without a live call.
      const nearby = await refreshNearbyFeed(await getDb());
      console.log(`[scan] pipeline complete: ${JSON.stringify({ scan, scored, nearby })}`);
    } catch (err) {
      console.error('[scan] pipeline failed:', err);
    } finally {
      scanInFlight = false;
    }
  })();

  res.status(202).json({ status: 'started' });
}));

/**
 * Verify the top-N deals against Unwrangle and save the truth. Same auth as the
 * scan. Costs Unwrangle credits (one per deal), so it is a separate, explicit
 * call — not part of every scan.
 */
admin.post('/admin/verify', route(async (req, res) => {
  if (!scanAuthorized(req)) return res.status(401).json({ error: 'Not available.' });
  const nRaw = Number(req.query.n ?? 10);
  const n = Math.min(Math.max(Number.isFinite(nRaw) ? nRaw : 10, 1), 50);
  const result = await verifyTopDeals(await getDb(), n);
  res.json(result);
}));
