/**
 * Blueprint E — spotter reputation.
 *
 * Finds are the answer key the scorer gets graded against, which makes them
 * worth faking: a competitor poisoning the ground truth degrades the product
 * for everyone. Reputation is the defense, and it is deliberately asymmetric —
 * a contradiction costs far more than a corroboration earns, because the cost
 * of trusting a bad report is higher than the cost of under-weighting a good
 * one.
 */

import type { Db } from '../db/client.js';

/** Corroboration only counts inside this window. Prices move. */
export const CORROBORATION_HOURS = 48;

const MIN_REPUTATION = 0.15;
const MAX_REPUTATION = 2.0;

export function reputationFrom(corroborated: number, contradicted: number): number {
  const r = 1.0 + 0.15 * corroborated - 0.4 * contradicted;
  return Math.round(Math.min(Math.max(r, MIN_REPUTATION), MAX_REPUTATION) * 100) / 100;
}

export async function currentReputation(db: Db, userId: number): Promise<number> {
  const { rows } = await db.query<{ reputation: number }>(
    `SELECT reputation FROM spotter_stats WHERE user_id = $1`,
    [userId],
  );
  return rows[0] ? Number(rows[0].reputation) : 1.0;
}

async function recompute(db: Db, userId: number): Promise<void> {
  await db.query(
    `UPDATE spotter_stats
        SET reputation = GREATEST($2, LEAST($3, 1.0 + 0.15 * corroborated - 0.4 * contradicted))
      WHERE user_id = $1`,
    [userId, MIN_REPUTATION, MAX_REPUTATION],
  );
}

/**
 * Called after a find is recorded. Compares it against other spotters' reports
 * on the same product and store inside the window, and moves both sides.
 *
 * Only *other* users count. Reporting the same thing twice yourself is not
 * corroboration, and letting it be is the cheapest possible attack.
 */
export async function applyCorroboration(
  db: Db,
  userId: number,
  productId: string,
  storeId: string,
  outcome: string,
): Promise<{ corroborated: number; contradicted: number }> {
  const { rows: peers } = await db.query<{ user_id: number; outcome: string }>(
    `SELECT DISTINCT ON (user_id) user_id, outcome
       FROM finds
      WHERE product_id = $1 AND store_id = $2 AND user_id <> $3
        AND recorded_at >= now() - ($4 || ' hours')::interval
      ORDER BY user_id, recorded_at DESC`,
    [productId, storeId, userId, String(CORROBORATION_HOURS)],
  );

  let corroborated = 0;
  let contradicted = 0;

  for (const peer of peers) {
    const agrees = peer.outcome === outcome;
    if (agrees) corroborated++; else contradicted++;

    // Both sides move: the peer's record is evidence about them too.
    await db.query(
      `UPDATE spotter_stats
          SET corroborated = corroborated + $2, contradicted = contradicted + $3
        WHERE user_id = $1`,
      [peer.user_id, agrees ? 1 : 0, agrees ? 0 : 1],
    );
    await recompute(db, peer.user_id);
  }

  if (corroborated > 0 || contradicted > 0) {
    await db.query(
      `UPDATE spotter_stats
          SET corroborated = corroborated + $2, contradicted = contradicted + $3
        WHERE user_id = $1`,
      [userId, corroborated, contradicted],
    );
    await recompute(db, userId);
  }

  return { corroborated, contradicted };
}

/** Ensures the row exists and counts the report. */
export async function recordReport(db: Db, userId: number): Promise<void> {
  await db.query(
    `INSERT INTO spotter_stats (user_id, reports, last_report_at)
     VALUES ($1, 1, now())
     ON CONFLICT (user_id) DO UPDATE
       SET reports = spotter_stats.reports + 1, last_report_at = now()`,
    [userId],
  );
}

/**
 * The reciprocity gate. Reading other people's confirmed finds requires
 * having agreed to report and having actually reported inside 30 days.
 *
 * This is the whole social contract of the product in one function: the
 * verified feed is not a feature you buy, it is one you contribute to.
 */
export async function canSeeVerified(
  db: Db,
  userId: number,
): Promise<{ ok: boolean; reason?: string }> {
  const { rows } = await db.query<{ will_report: boolean; reports: number | null; last_report_at: string | null }>(
    `SELECT u.will_report, s.reports, s.last_report_at
       FROM users u LEFT JOIN spotter_stats s ON s.user_id = u.user_id
      WHERE u.user_id = $1`,
    [userId],
  );
  const r = rows[0];
  if (!r) return { ok: false, reason: 'No account.' };

  if (!r.will_report) {
    return { ok: false, reason: 'Turn on reporting to see finds other people confirmed.' };
  }
  if (!r.last_report_at) {
    return { ok: false, reason: 'Report one find and this opens up.' };
  }
  const days = (Date.now() - new Date(r.last_report_at).getTime()) / 86_400_000;
  if (days > 30) {
    return { ok: false, reason: 'Report a find in the last 30 days to keep this open.' };
  }
  return { ok: true };
}
