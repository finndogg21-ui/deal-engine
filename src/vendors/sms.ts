/**
 * SMS vendor — the only file that knows which provider we use.
 *
 * Twilio-shaped because that is the launch plan, but the rest of the app only
 * ever touches queueSms()/flushSmsOutbox(): swap the HTTP call here and the
 * provider changes without touching a matcher rule or a route.
 *
 * UNCONFIGURED IS A FIRST-CLASS STATE. Until TWILIO_ACCOUNT_SID,
 * TWILIO_AUTH_TOKEN and TWILIO_FROM are set, every send lands in sms_outbox
 * as 'awaiting_config' and the first configured run flushes the backlog.
 * The owner turns SMS on by setting three env vars — no code change, no
 * message lost in between.
 *
 * No SDK: Twilio's Messages endpoint is one form-encoded POST, and one less
 * dependency is one less supply-chain surface.
 */

import type { Db } from '../db/client.js';

const SID = process.env.TWILIO_ACCOUNT_SID ?? '';
const TOKEN = process.env.TWILIO_AUTH_TOKEN ?? '';
const FROM = process.env.TWILIO_FROM ?? '';

export function smsConfigured(): boolean {
  return Boolean(SID && TOKEN && FROM);
}

/**
 * Normalize a US phone number to E.164. Returns null when it isn't one —
 * callers turn that into a 400, never a half-saved number.
 */
export function normalizeUsPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

/** One provider send. Throws on non-2xx so callers can mark the row failed. */
async function providerSend(to: string, body: string): Promise<string> {
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${SID}:${TOKEN}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: FROM, Body: body }),
    },
  );
  const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
  if (!res.ok) throw new Error(`twilio ${res.status}: ${json.message ?? 'send failed'}`);
  return json.sid ?? '';
}

/**
 * Queue a message and try to send it right away. The outbox row is written
 * FIRST so a crash between queue and send retries instead of vanishing.
 */
export async function queueSms(db: Db, userId: number, to: string, body: string): Promise<void> {
  const status = smsConfigured() ? 'queued' : 'awaiting_config';
  const { rows } = await db.query<{ sms_id: string }>(
    `INSERT INTO sms_outbox (user_id, to_phone, body, status)
     VALUES ($1, $2, $3, $4) RETURNING sms_id`,
    [userId, to, body, status],
  );
  if (smsConfigured()) await flushOne(db, rows[0]!.sms_id, to, body);
}

async function flushOne(db: Db, smsId: string, to: string, body: string): Promise<boolean> {
  try {
    const sid = await providerSend(to, body);
    await db.query(
      `UPDATE sms_outbox SET status = 'sent', provider_sid = $2, sent_at = now(), error = NULL
        WHERE sms_id = $1`,
      [smsId, sid],
    );
    return true;
  } catch (err) {
    await db.query(
      `UPDATE sms_outbox SET status = 'failed', error = $2 WHERE sms_id = $1`,
      [smsId, String(err instanceof Error ? err.message : err).slice(0, 500)],
    );
    return false;
  }
}

/**
 * Send everything still waiting (awaiting_config backlog + queued + failed
 * retries). Run after every alert cycle; a no-op while unconfigured.
 */
export async function flushSmsOutbox(db: Db): Promise<{ sent: number; failed: number }> {
  const out = { sent: 0, failed: 0 };
  if (!smsConfigured()) return out;
  const { rows } = await db.query<{ sms_id: string; to_phone: string; body: string }>(
    `SELECT sms_id, to_phone, body FROM sms_outbox
      WHERE status IN ('queued', 'awaiting_config', 'failed')
      ORDER BY created_at
      LIMIT 100`,
  );
  for (const r of rows) {
    (await flushOne(db, r.sms_id, r.to_phone, r.body)) ? out.sent++ : out.failed++;
  }
  return out;
}
