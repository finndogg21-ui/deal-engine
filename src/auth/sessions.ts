/**
 * Sessions and single-use action tokens.
 *
 * The raw token goes to the browser in an HttpOnly cookie. Only its SHA-256
 * hash is stored, so a database leak does not hand out live sessions.
 */

import { randomBytes, createHash } from 'node:crypto';
import type { Db } from '../db/client.js';

export const COOKIE = 'de_session';
const DAYS = 30;

const sha = (raw: string) => createHash('sha256').update(raw).digest('hex');
const newToken = () => randomBytes(32).toString('base64url');

export async function createSession(db: Db, userId: number, userAgent?: string) {
  const raw = newToken();
  const expires = new Date(Date.now() + DAYS * 86_400_000);
  await db.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at, user_agent) VALUES ($1,$2,$3,$4)`,
    [sha(raw), userId, expires, userAgent?.slice(0, 300) ?? null],
  );
  return { raw, expires };
}

export interface SessionUser {
  user_id: number;
  email: string;
  plan: string;
  role: string;
  path: string | null;
  zip: string | null;
  radius_mi: number;
  alerts_per_day: number;
  quiet_hours: boolean;
  will_report: boolean;
  setup_done_at: string | null;
}

export async function userForToken(db: Db, raw: string | undefined): Promise<SessionUser | null> {
  if (!raw) return null;
  const { rows } = await db.query<SessionUser>(
    `SELECT u.user_id, u.email, u.plan, u.role, u.path, u.zip, u.radius_mi,
            u.alerts_per_day, u.quiet_hours, u.will_report, u.setup_done_at
       FROM sessions s JOIN users u ON u.user_id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [sha(raw)],
  );
  return rows[0] ?? null;
}

export async function destroySession(db: Db, raw: string | undefined) {
  if (!raw) return;
  await db.query(`DELETE FROM sessions WHERE token_hash = $1`, [sha(raw)]);
}

export async function destroyAllSessions(db: Db, userId: number) {
  await db.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
}

/** Single-use token for password reset or account deletion. */
export async function issueActionToken(
  db: Db, userId: number, purpose: 'reset' | 'delete', hours = 24,
) {
  const raw = newToken();
  await db.query(
    `INSERT INTO action_tokens (token_hash, user_id, purpose, expires_at) VALUES ($1,$2,$3,$4)`,
    [sha(raw), userId, purpose, new Date(Date.now() + hours * 3_600_000)],
  );
  return raw;
}

/** Consumes the token. A second call with the same token returns null. */
export async function consumeActionToken(db: Db, raw: string, purpose: 'reset' | 'delete') {
  const { rows } = await db.query<{ user_id: number }>(
    `UPDATE action_tokens SET used_at = now()
      WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now()
      RETURNING user_id`,
    [sha(raw), purpose],
  );
  return rows[0]?.user_id ?? null;
}

export function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    expires,
    path: '/',
  };
}
