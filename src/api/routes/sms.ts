/**
 * SMS settings + verification.
 *
 * The frame the owner asked for: alerts must be able to leave by SMS. A member
 * saves a phone, proves they hold it (6-digit code, 10-minute window), and
 * flips sms_alerts on. Delivery itself lives in src/alerts/deliver.ts; the
 * provider lives in src/vendors/sms.ts. While Twilio is unconfigured the
 * verification code parks in sms_outbox as 'awaiting_config', so the flow is
 * testable end-to-end today and goes live the moment the env vars are set.
 *
 * Paid-members only, same as every other alert surface (owner decision
 * 2026-09-01), and rate-limited: phone verification endpoints are a classic
 * SMS-pumping target.
 */

import { randomInt, createHash } from 'node:crypto';
import { Router } from 'express';
import { getDb } from '../../db/client.js';
import { requireAuth, requirePlan, rateLimit, route } from '../middleware.js';
import { normalizeUsPhone, queueSms, smsConfigured } from '../../vendors/sms.js';

export const sms = Router();

const paid = [requireAuth, requirePlan('member')];
const hash = (code: string) => createHash('sha256').update(code).digest('hex');

/* GET /api/sms — current settings for the panel. */
sms.get('/sms', ...paid, route(async (req, res) => {
  const db = await getDb();
  const { rows } = await db.query<{ phone: string | null; phone_verified_at: string | null; sms_alerts: boolean }>(
    `SELECT phone, phone_verified_at, sms_alerts FROM users WHERE user_id = $1`,
    [req.user!.user_id],
  );
  const u = rows[0];
  res.json({
    phone: u?.phone ?? null,
    verified: Boolean(u?.phone_verified_at),
    sms_alerts: Boolean(u?.sms_alerts),
    // The panel says "texts start once SMS goes live" instead of pretending.
    provider_live: smsConfigured(),
  });
}));

/* POST /api/sms/phone { phone } — save a number and text a code to it.
   Saving a NEW number always un-verifies: the code proves possession. */
sms.post('/sms/phone',
  ...paid,
  rateLimit({ key: 'sms-phone', max: 5, windowMs: 60 * 60_000 }),
  route(async (req, res) => {
    const phone = normalizeUsPhone(String(req.body?.phone ?? ''));
    if (!phone) return res.status(400).json({ error: 'Enter a US phone number (10 digits).' });

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const db = await getDb();
    await db.query(
      `UPDATE users SET phone = $2, phone_verified_at = NULL,
              phone_verify_code = $3, phone_verify_expires = now() + interval '10 minutes'
        WHERE user_id = $1`,
      [req.user!.user_id, phone, hash(code)],
    );
    await queueSms(db, req.user!.user_id, phone,
      `Summit Clearance: your verification code is ${code}. It expires in 10 minutes.`);
    res.json({ ok: true, provider_live: smsConfigured() });
  }),
);

/* POST /api/sms/verify { code } — prove possession, enable the channel. */
sms.post('/sms/verify',
  ...paid,
  rateLimit({ key: 'sms-verify', max: 10, windowMs: 60 * 60_000 }),
  route(async (req, res) => {
    const code = String(req.body?.code ?? '').trim();
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Enter the 6-digit code.' });

    const db = await getDb();
    const { rowCount } = await db.query(
      `UPDATE users SET phone_verified_at = now(), sms_alerts = true,
              phone_verify_code = NULL, phone_verify_expires = NULL
        WHERE user_id = $1 AND phone_verify_code = $2 AND phone_verify_expires > now()`,
      [req.user!.user_id, hash(code)],
    );
    if (!rowCount) return res.status(400).json({ error: 'Wrong or expired code. Request a new one.' });
    res.json({ ok: true });
  }),
);

/* POST /api/sms/prefs { sms_alerts } — the on/off switch (verified numbers only). */
sms.post('/sms/prefs', ...paid, route(async (req, res) => {
  const on = Boolean(req.body?.sms_alerts);
  const db = await getDb();
  const { rowCount } = await db.query(
    `UPDATE users SET sms_alerts = $2
      WHERE user_id = $1 AND (NOT $2 OR phone_verified_at IS NOT NULL)`,
    [req.user!.user_id, on],
  );
  if (!rowCount) return res.status(400).json({ error: 'Verify your phone first.' });
  res.json({ ok: true, sms_alerts: on });
}));
