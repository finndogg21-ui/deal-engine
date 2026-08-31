/**
 * Blueprint D — the matcher.
 *
 * Runs after each scan. Everything here exists to answer one question well:
 * of all the deals that technically match, which few are worth interrupting
 * someone for today?
 *
 * The failure mode this is built against is not "missed a deal". It is
 * "sent 40 alerts, got muted, never heard from again". Every rule below
 * costs recall on purpose.
 */

import type { Db } from '../db/client.js';
import { currentMatches, type GeoScope, type MatchRow } from '../engine/match.js';

export interface MatcherResult {
  users_considered: number;
  alerts_written: number;
  skipped_quiet_hours: number;
  skipped_cap: number;
  skipped_duplicate: number;
}

/** Hour 0–23 on the user's own wall clock. */
export function localHour(tz: string, at = new Date()): number {
  try {
    return Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hour: 'numeric', hourCycle: 'h23',
      }).format(at),
    );
  } catch {
    return at.getUTCHours();
  }
}

/** YYYY-MM-DD on the user's own wall clock — the key the daily cap counts on. */
export function localDate(tz: string, at = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}

const QUIET_START = 22;
const QUIET_END = 7;

export function inQuietHours(tz: string, at = new Date()): boolean {
  const h = localHour(tz, at);
  return h >= QUIET_START || h < QUIET_END;
}

interface Recipient {
  user_id: number;
  email: string;
  plan: string;
  role: string;
  tz: string;
  alerts_per_day: number;
  quiet_hours: boolean;
  home_lat: number | null;
  home_lng: number | null;
  radius_mi: number | null;
}

interface Watch {
  watch_id: string;
  term: string;
  category_ids: string[] | null;
  min_discount: number;
  max_price: number | null;
  retailer: string | null;
}

/**
 * Fair-queue rotation.
 *
 * Someone who has ignored their last twenty alerts is telling us something.
 * Rather than keep spending their attention at full rate, the cap shrinks —
 * and recovers on its own the moment they engage with one. Never below 1,
 * because a silent product is indistinguishable from a broken one.
 */
async function effectiveCap(db: Db, user: Recipient): Promise<number> {
  const base = Math.max(Number(user.alerts_per_day ?? 5), 1);

  const { rows } = await db.query<{ total: number; engaged: number }>(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (
              WHERE opened_at IS NOT NULL OR outcome IN ('won','lost')
            )::int AS engaged
       FROM (SELECT opened_at, outcome FROM alerts
              WHERE user_id = $1 ORDER BY sent_at DESC LIMIT 20) t`,
    [user.user_id],
  );

  const total = Number(rows[0]?.total ?? 0);
  // Not enough history to judge. Give them the full cap.
  if (total < 10) return base;

  const rate = Number(rows[0]?.engaged ?? 0) / total;
  if (rate >= 0.25) return base;
  if (rate > 0) return Math.max(Math.floor(base / 2), 1);
  return 1;
}

/**
 * Round-robin across a user's watches.
 *
 * Taking the globally best-scored matches would let one broad watch
 * ("tools", 40% off) eat every slot while the specific one someone actually
 * cares about never fires.
 */
function rotate(byWatch: Map<string, MatchRow[]>, take: number): MatchRow[] {
  const queues = [...byWatch.values()].map((rows) =>
    [...rows].sort((a, b) => Number(b.penny_score ?? 0) - Number(a.penny_score ?? 0)),
  );
  const out: MatchRow[] = [];
  let i = 0;
  while (out.length < take && queues.some((q) => q.length > 0)) {
    const q = queues[i % queues.length]!;
    const next = q.shift();
    if (next) out.push(next);
    i++;
  }
  return out;
}

export async function runMatcher(db: Db, now = new Date()): Promise<MatcherResult> {
  const result: MatcherResult = {
    users_considered: 0,
    alerts_written: 0,
    skipped_quiet_hours: 0,
    skipped_cap: 0,
    skipped_duplicate: 0,
  };

  const { rows: users } = await db.query<Recipient>(
    `SELECT u.user_id, u.email, u.plan, u.role, u.tz, u.alerts_per_day,
            u.quiet_hours, u.home_lat, u.home_lng, u.radius_mi
       FROM users u
      WHERE u.email IS NOT NULL
        AND (u.plan = 'member' OR u.role = 'operator')
        AND EXISTS (SELECT 1 FROM watchlists w
                     WHERE w.user_id = u.user_id AND w.active)`,
  );

  for (const user of users) {
    result.users_considered++;

    const tz = user.tz || 'America/Chicago';
    if (user.quiet_hours && inQuietHours(tz, now)) {
      result.skipped_quiet_hours++;
      continue;
    }

    const today = localDate(tz, now);

    const sentToday = await db.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM alerts WHERE user_id = $1 AND sent_on = $2`,
      [user.user_id, today],
    );
    const cap = await effectiveCap(db, user);
    const remaining = cap - Number(sentToday.rows[0]?.n ?? 0);
    if (remaining <= 0) {
      result.skipped_cap++;
      continue;
    }

    const { rows: watches } = await db.query<Watch>(
      `SELECT watch_id, term, category_ids, min_discount, max_price, retailer
         FROM watchlists WHERE user_id = $1 AND active`,
      [user.user_id],
    );

    const geo: GeoScope = {
      lat: user.home_lat,
      lng: user.home_lng,
      // Members get the radius they set.
      radiusMi: user.radius_mi ?? 25,
    };

    const byWatch = new Map<string, MatchRow[]>();
    for (const w of watches) {
      const matches = await currentMatches(
        db,
        String(w.watch_id),
        {
          term: w.term,
          categoryIds: w.category_ids ?? [],
          minDiscount: Number(w.min_discount ?? 0),
          maxPrice: w.max_price === null ? null : Number(w.max_price),
          retailer: w.retailer,
        },
        geo,
      );
      if (matches.length > 0) byWatch.set(String(w.watch_id), matches);
    }
    if (byWatch.size === 0) continue;

    // Over-fetch, because the unique index will reject anything already sent
    // for this product/store today and those rejections should not eat slots.
    for (const m of rotate(byWatch, remaining * 3)) {
      if (result.alerts_written >= Number.MAX_SAFE_INTEGER) break;

      const ins = await db.query(
        `INSERT INTO alerts (user_id, product_id, store_id, watch_id, reason, score_at_send, sent_on)
         VALUES ($1,$2,$3,$4,'watch_match',$5,$6)
         ON CONFLICT (user_id, product_id, store_id, sent_on) DO NOTHING`,
        [user.user_id, m.product_id, m.store_id, m.watch_id, m.penny_score, today],
      );

      if (ins.rowCount === 0) {
        result.skipped_duplicate++;
        continue;
      }
      result.alerts_written++;

      const used = await db.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM alerts WHERE user_id = $1 AND sent_on = $2`,
        [user.user_id, today],
      );
      if (Number(used.rows[0]?.n ?? 0) >= cap) break;
    }
  }

  return result;
}
