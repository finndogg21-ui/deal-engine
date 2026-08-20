/**
 * Accounts: sign up, sign in, sign out, password reset, setup, deletion.
 *
 * Two rules run through all of it:
 *  - Never reveal whether an email has an account. Signup, login and forgot
 *    all respond identically whether or not the address exists.
 *  - Rate limit by email and by IP, because limiting only one is limiting
 *    neither.
 */

import { Router } from 'express';
import { getDb } from '../../db/client.js';
import { hashPassword, verifyPassword, passwordProblem } from '../../auth/passwords.js';
import {
  COOKIE, createSession, destroySession, destroyAllSessions,
  issueActionToken, consumeActionToken, cookieOptions,
} from '../../auth/sessions.js';
import { requireAuth, rateLimit, route } from '../middleware.js';
import { send } from '../../vendors/mailer.js';

export const auth = Router();

const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';
const emailOk = (e: unknown): e is string =>
  typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length < 255;
const norm = (e: string) => e.trim().toLowerCase();

/* ------------------------------------------------------------------ signup */

auth.post('/signup', rateLimit({ key: 'signup', max: 5, windowMs: 15 * 60_000 }), route(async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!emailOk(email)) return res.status(400).json({ error: 'Enter a valid email address.' });

  const pwProblem = passwordProblem(String(password ?? ''));
  if (pwProblem) return res.status(400).json({ error: pwProblem });

  const db = await getDb();
  const hash = await hashPassword(password);

  // Deliberately NO operator promotion here. Signup has no email
  // verification, so promoting at signup would let whoever registers the
  // founder's (public) address first walk away with the operator role.
  // Promotion lives in migrate.ts only, run by the operator AFTER they have
  // personally created their account — tooling never handles their password.
  const { rows } = await db.query<{ user_id: number }>(
    `INSERT INTO users (email, password_hash, role, plan) VALUES ($1,$2,'member','none')
     ON CONFLICT (email) DO NOTHING RETURNING user_id`,
    [norm(email), hash],
  );

  // Address already registered. Say the same thing either way, and email the
  // real owner rather than telling the visitor an account exists.
  if (!rows[0]) {
    await send({
      to: norm(email),
      subject: 'Someone tried to sign up with your email',
      text: `Somebody tried to create an account with this address. You already have one.\n\nIf it was you, sign in instead: ${APP_URL}/signin`,
    });
    return res.status(201).json({ ok: true });
  }

  const { raw, expires } = await createSession(db, rows[0].user_id, req.headers['user-agent']);
  res.cookie(COOKIE, raw, cookieOptions(expires));
  res.status(201).json({ ok: true });
}));

/* ------------------------------------------------------------------- login */

auth.post('/login', rateLimit({ key: 'login', max: 5, windowMs: 15 * 60_000 }), route(async (req, res) => {
  const { email, password } = req.body ?? {};
  const db = await getDb();

  const { rows } = await db.query<{ user_id: number; password_hash: string | null }>(
    `SELECT user_id, password_hash FROM users WHERE email = $1`,
    [emailOk(email) ? norm(email) : '__none__'],
  );

  // Always run the hash comparison, even with no row, so response time does
  // not reveal whether the address is registered.
  const ok = await verifyPassword(String(password ?? ''), rows[0]?.password_hash ?? null);
  if (!ok || !rows[0]) return res.status(401).json({ error: 'Email or password is wrong.' });

  const { raw, expires } = await createSession(db, rows[0].user_id, req.headers['user-agent']);
  res.cookie(COOKIE, raw, cookieOptions(expires));
  res.json({ ok: true });
}));

auth.post('/logout', route(async (req, res) => {
  const db = await getDb();
  await destroySession(db, req.cookies?.[COOKIE]);
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
}));

/* ------------------------------------------------------------ password reset */

auth.post('/forgot', rateLimit({ key: 'forgot', max: 3, windowMs: 60 * 60_000 }), route(async (req, res) => {
  const { email } = req.body ?? {};
  if (emailOk(email)) {
    const db = await getDb();
    const { rows } = await db.query<{ user_id: number }>(
      `SELECT user_id FROM users WHERE email = $1`, [norm(email)],
    );
    if (rows[0]) {
      const token = await issueActionToken(db, rows[0].user_id, 'reset', 2);
      await send({
        to: norm(email),
        subject: 'Reset your password',
        text: `Reset it here, the link works once and expires in 2 hours:\n\n${APP_URL}/reset?token=${token}\n\nIf this was not you, ignore this.`,
      });
    }
  }
  // Same response either way.
  res.json({ ok: true });
}));

auth.post('/reset', rateLimit({ key: 'reset', max: 5, windowMs: 15 * 60_000 }), route(async (req, res) => {
  const { token, password } = req.body ?? {};
  const problem = passwordProblem(String(password ?? ''));
  if (problem) return res.status(400).json({ error: problem });
  if (typeof token !== 'string') return res.status(400).json({ error: 'That link is not valid.' });

  const db = await getDb();
  const userId = await consumeActionToken(db, token, 'reset');
  if (!userId) return res.status(400).json({ error: 'That link has expired or was already used.' });

  await db.query(`UPDATE users SET password_hash = $1 WHERE user_id = $2`,
    [await hashPassword(password), userId]);
  // Changing a password ends every other session.
  await destroyAllSessions(db, userId);

  const { raw, expires } = await createSession(db, userId, req.headers['user-agent']);
  res.cookie(COOKIE, raw, cookieOptions(expires));
  res.json({ ok: true });
}));

/* --------------------------------------------------------------------- me */

auth.get('/me', route(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not signed in.' });
  res.json({ user: req.user });
}));

/**
 * Setup, written by onboarding. Also the landing point for answers that were
 * collected in localStorage before the account existed.
 */
auth.patch('/me/setup', requireAuth, route(async (req, res) => {
  const b = req.body ?? {};
  const path = b.path === 'reseller' ? 'reseller' : b.path === 'consumer' ? 'consumer' : null;
  const zip = typeof b.zip === 'string' && /^\d{5}$/.test(b.zip) ? b.zip : null;
  const radius = [10, 25, 50, 100].includes(Number(b.radiusMi)) ? Number(b.radiusMi) : 25;
  const perDay = Math.min(Math.max(Number(b.alertsPerDay) || 5, 1), 60);

  const db = await getDb();
  await db.query(
    `UPDATE users SET path = COALESCE($1, path), zip = COALESCE($2, zip),
            radius_mi = $3, alerts_per_day = $4, quiet_hours = $5,
            will_report = $6, setup_done_at = COALESCE(setup_done_at, now())
      WHERE user_id = $7`,
    [path, zip, radius, perDay, b.quietHours !== false, b.willReport === true, req.user!.user_id],
  );
  res.json({ ok: true });
}));

/* -------------------------------------------------------- account deletion */

auth.post('/account/delete-request', rateLimit({ key: 'del', max: 3, windowMs: 60 * 60_000 }), route(async (req, res) => {
  const { email } = req.body ?? {};
  if (emailOk(email)) {
    const db = await getDb();
    const { rows } = await db.query<{ user_id: number }>(
      `SELECT user_id FROM users WHERE email = $1`, [norm(email)],
    );
    if (rows[0]) {
      const token = await issueActionToken(db, rows[0].user_id, 'delete', 24);
      await send({
        to: norm(email),
        subject: 'Confirm deleting your account',
        text: `This permanently deletes your account and cannot be undone.\n\n${APP_URL}/account/delete/confirm?token=${token}\n\nCancel your subscription first, or billing continues.\n\nIf this was not you, ignore this and nothing happens.`,
      });
    }
  }
  // 202 whether or not the address exists.
  res.status(202).json({ ok: true });
}));

auth.post('/account/delete/confirm', route(async (req, res) => {
  const { token } = req.body ?? {};
  if (typeof token !== 'string') return res.status(400).json({ error: 'That link is not valid.' });

  const db = await getDb();
  const userId = await consumeActionToken(db, token, 'delete');
  if (!userId) return res.status(400).json({ error: 'That link has expired or was already used.' });
  if (userId === 1) return res.status(403).json({ error: 'The operator account cannot be deleted.' });

  await db.tx(async (tx) => {
    // Keep the outcome, drop the authorship: accuracy stats stay honest and
    // stop being about a person.
    await tx.query(`UPDATE finds SET user_id = 1 WHERE user_id = $1`, [userId]);
    await tx.query(`DELETE FROM users WHERE user_id = $1`, [userId]);
  });

  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
}));
