/**
 * Blueprint D — delivery.
 *
 * One service, email first, push later. The matcher decides *what* to send;
 * this decides *how it leaves*. Keeping them apart means the send channel can
 * change without touching a single matching rule.
 *
 * Batching: watch matches go out as one digest per user per run, because six
 * separate emails in four minutes is how someone learns to filter you.
 * Verified finds bypass batching entirely — a spotter standing in the aisle
 * confirming a penny item is worth exactly one interruption, immediately.
 */

import type { Db } from '../db/client.js';
import { send } from '../vendors/mailer.js';

const APP_URL = process.env.APP_URL ?? 'http://localhost:8787';
const BRAND = process.env.BRAND_NAME ?? "Summit Clearance";

interface Pending {
  alert_id: string;
  user_id: number;
  email: string;
  product_id: string;
  store_id: string;
  reason: string;
  score_at_send: number | null;
  title: string | null;
  price: number | null;
  discount_pct: number | null;
  store_name: string | null;
}

export interface DeliveryResult {
  digests_sent: number;
  alerts_delivered: number;
  failed: number;
}

function line(a: Pending): string {
  const bits = [a.title ?? a.product_id];
  if (a.price !== null) bits.push(`$${Number(a.price).toFixed(2)}`);
  if (a.discount_pct !== null) bits.push(`${Math.round(Number(a.discount_pct))}% off`);
  if (a.store_name) bits.push(`at ${a.store_name}`);
  if (a.score_at_send !== null) bits.push(`score ${a.score_at_send}`);
  return `- ${bits.join(' · ')}\n  ${APP_URL}/app/deal/${encodeURIComponent(a.product_id)}/${encodeURIComponent(a.store_id)}`;
}

/**
 * Sends everything written but not yet delivered.
 *
 * Marks delivered per user rather than per alert, in one statement, so a
 * crash mid-run cannot leave a user half-notified about their own digest.
 */
export async function deliverPending(db: Db): Promise<DeliveryResult> {
  const result: DeliveryResult = { digests_sent: 0, alerts_delivered: 0, failed: 0 };

  const { rows } = await db.query<Pending>(
    `SELECT a.alert_id, a.user_id, u.email, a.product_id, a.store_id, a.reason,
            a.score_at_send, p.title, s.last_price AS price,
            s.last_discount AS discount_pct, st.name AS store_name
       FROM alerts a
       JOIN users u ON u.user_id = a.user_id
       JOIN products p ON p.product_id = a.product_id
       LEFT JOIN stores st ON st.store_id = a.store_id
       LEFT JOIN sku_state s
              ON s.product_id = a.product_id AND s.store_id = a.store_id
      WHERE a.delivered_at IS NULL AND u.email IS NOT NULL
      ORDER BY a.user_id, a.reason, a.score_at_send DESC NULLS LAST`,
  );
  if (rows.length === 0) return result;

  const byUser = new Map<number, Pending[]>();
  for (const r of rows) {
    const list = byUser.get(r.user_id) ?? [];
    list.push(r);
    byUser.set(r.user_id, list);
  }

  for (const [userId, alerts] of byUser) {
    const email = alerts[0]!.email;
    const urgent = alerts.filter((a) => a.reason === 'verified_find');
    const batched = alerts.filter((a) => a.reason !== 'verified_find');

    // Verified finds first, each on its own, immediately.
    for (const a of urgent) {
      try {
        await send({
          to: email,
          subject: `Confirmed at the register: ${a.title ?? 'a penny item'}`,
          text:
            `Someone just bought this and confirmed the price.\n\n${line(a)}\n\n` +
            `Stock moves fast on confirmed finds.\n\n${BRAND}\n${APP_URL}/app/penny`,
        });
        await db.query(`UPDATE alerts SET delivered_at = now() WHERE alert_id = $1`, [a.alert_id]);
        result.alerts_delivered++;
        result.digests_sent++;
      } catch (err) {
        console.error(`alert delivery failed for user ${userId}`, err);
        result.failed++;
      }
    }

    if (batched.length === 0) continue;

    const subject =
      batched.length === 1
        ? `${batched[0]!.title ?? 'A deal'} just dropped`
        : `${batched.length} deals matched your watchlist`;

    try {
      await send({
        to: email,
        subject,
        text:
          `${batched.map(line).join('\n\n')}\n\n` +
          `Fewer of these? Change your daily limit: ${APP_URL}/app/watchlist\n\n${BRAND}`,
      });
      await db.query(
        `UPDATE alerts SET delivered_at = now()
          WHERE alert_id = ANY($1::bigint[])`,
        [batched.map((a) => a.alert_id)],
      );
      result.digests_sent++;
      result.alerts_delivered += batched.length;
    } catch (err) {
      // Left undelivered on purpose: the next run retries, and the backlog is
      // visible in the admin panel instead of disappearing.
      console.error(`digest failed for user ${userId}`, err);
      result.failed++;
    }
  }

  return result;
}
