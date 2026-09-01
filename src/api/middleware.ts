/**
 * Request plumbing: cookie parsing, session loading, access gates, rate limits.
 *
 * The gates matter more here than in most products. Our data IS the product,
 * so the paywall and access control are the same mechanism. A tier check that
 * only exists in the client is not a paywall.
 */

import type { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/client.js';
import { COOKIE, userForToken, type SessionUser } from '../auth/sessions.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
      cookies: Record<string, string>;
    }
  }
}

/** Minimal cookie parsing, so there is no extra dependency. */
export function cookies(req: Request, _res: Response, next: NextFunction) {
  const out: Record<string, string> = {};
  const raw = req.headers.cookie;
  if (raw) {
    for (const part of raw.split(';')) {
      const i = part.indexOf('=');
      if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    }
  }
  req.cookies = out;
  next();
}

/** Attaches req.user when a valid session cookie is present. Never rejects. */
/**
 * TEMPORARY public-preview identity. When PUBLIC_PREVIEW=1, anonymous visitors
 * are treated as this logged-in reseller so the deals are browsable without an
 * account or a plan. To restore the paywall, unset PUBLIC_PREVIEW and redeploy.
 *
 * Deliberate choices: role is 'member', so the operator/admin surface stays
 * protected. It reuses the operator row (user_id 1) so any per-user write is
 * FK-safe and every preview visitor shares one daily stock-lookup cap, which
 * bounds vendor spend no matter how much anonymous traffic arrives.
 */
/** The shared public-preview identity's email — the one source of truth for
 *  "is this the anonymous preview, not a real account". Mirrors web isPreviewUser. */
export const PREVIEW_EMAIL = 'preview@deal-engine.local';

const PREVIEW_USER: SessionUser = {
  user_id: 1,
  email: PREVIEW_EMAIL,
  plan: 'member',
  role: 'member',
  path: 'reseller',
  zip: null,
  radius_mi: 25,
  alerts_per_day: 5,
  quiet_hours: true,
  will_report: false,
  setup_done_at: '2026-01-01T00:00:00.000Z',
};

export async function loadUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const db = await getDb();
    const u = await userForToken(db, req.cookies?.[COOKIE]);
    if (u) req.user = u;
  } catch {
    /* a broken session must not take the request down */
  }
  // Public preview: no session + flag on => browse as a reseller. See above.
  if (!req.user && process.env.PUBLIC_PREVIEW === '1') {
    req.user = { ...PREVIEW_USER };
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Sign in to continue.' });
  next();
}

/**
 * Rejects anonymous AND the shared public-preview identity. Use on every
 * per-user WRITE (setup, zip, checkout, portal) so a preview visitor can never
 * mutate the shared operator row (user_id 1) or start checkout/billing as it.
 */
export function requireRealUser(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.email === PREVIEW_EMAIL) {
    return res.status(401).json({ error: 'Sign in to continue.' });
  }
  next();
}

export function requireOperator(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Sign in to continue.' });
  if (req.user.role !== 'operator') return res.status(403).json({ error: 'Not available.' });
  next();
}

/**
 * Plan gate. Deal data is the product, so this is the paywall.
 * `none` can see their own account and nothing else.
 */
export function requirePlan(...allowed: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Sign in to continue.' });
    if (req.user.role === 'operator') return next();
    if (!allowed.includes(req.user.plan)) {
      return res.status(402).json({ error: 'This needs a plan.', upgrade: true });
    }
    next();
  };
}

/**
 * In-memory fixed-window limiter. Fine for one process; swap for a shared
 * store when there is more than one.
 */
const buckets = new Map<string, { n: number; resetAt: number }>();

export function rateLimit(opts: { key: string; max: number; windowMs: number }) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Never key on the shared preview identity — that collapses every anonymous
    // visitor's signup/login limit into one global bucket (5 attempts locks out
    // the whole internet). Preview and anon are limited by client IP instead.
    const real = req.user && req.user.email !== PREVIEW_EMAIL;
    const id = `${opts.key}:${real ? req.user!.user_id : (req.ip ?? 'anon')}`;
    const now = Date.now();
    const b = buckets.get(id);
    if (!b || b.resetAt < now) {
      buckets.set(id, { n: 1, resetAt: now + opts.windowMs });
      return next();
    }
    if (b.n >= opts.max) {
      const secs = Math.ceil((b.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(secs));
      return res.status(429).json({ error: `Too many attempts. Try again in ${secs}s.` });
    }
    b.n++;
    next();
  };
}

/** Wraps an async handler so a rejection becomes a 500 instead of a hang. */
export function route(
  fn: (req: Request, res: Response) => Promise<unknown>,
) {
  return (req: Request, res: Response) => {
    fn(req, res).catch((err) => {
      console.error(`${req.method} ${req.path}`, err);
      if (!res.headersSent) res.status(500).json({ error: 'Something went wrong.' });
    });
  };
}
