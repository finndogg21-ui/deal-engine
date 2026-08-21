/**
 * Blueprint 1 — public freshness proof.
 *
 * Crowdsourced competitors (Penny, PennyCentral, Rebel Savings) market
 * community-confirmed leads in language that reads as automated scanning.
 * This is the one thing they cannot fake: a live, per-store, timestamped
 * scan number, readable by anyone before they sign up. Reuses the same
 * scan_runs data and >26h stale threshold Admin.tsx already tracks — no new
 * backend logic, just a public read stripped to non-sensitive counts.
 */

import { Router } from 'express';
import { getDb } from '../../db/client.js';
import { route } from '../middleware.js';

export const scanStatus = Router();

scanStatus.get('/scan/freshness', route(async (_req, res) => {
  const db = await getDb();

  const last = await db.query<Record<string, unknown>>(
    `SELECT run_id, started_at, rows_written
       FROM scan_runs
      WHERE status IN ('ok','partial')
      ORDER BY started_at DESC LIMIT 1`,
  );
  const run = last.rows[0] ?? null;

  const stores = run
    ? await db.query<{ count: string }>(
        `SELECT COUNT(DISTINCT store_id)::int AS count
           FROM price_observations WHERE run_id = $1`,
        [run.run_id],
      )
    : null;

  const startedAt = run?.started_at ? new Date(run.started_at as string) : null;
  const hoursSince = startedAt
    ? Math.round(((Date.now() - startedAt.getTime()) / 3_600_000) * 10) / 10
    : null;

  res.json({
    last_scan_at: run?.started_at ?? null,
    hours_since: hoursSince,
    // Same threshold Admin.tsx uses: daily scan, silence past 26 hours means
    // something broke, and this number is now the public-facing proof of that.
    stale: hoursSince === null || hoursSince > 26,
    stores_checked: stores ? Number(stores.rows[0]?.count ?? 0) : 0,
    skus_checked: run ? Number(run.rows_written ?? 0) : 0,
  });
}));
