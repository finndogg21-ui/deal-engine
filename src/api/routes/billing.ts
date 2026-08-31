/**
 * Blueprint K — billing.
 *
 * Three rules, and the first one is the only one that is genuinely
 * non-negotiable:
 *
 *   1. The webhook signature is verified before anything in the body is read.
 *      Without it, `curl -d '{"type":"customer.subscription.created"}'` grants
 *      the caller a founding seat.
 *   2. The founding-seat count is taken inside the transaction that claims the
 *      seat. Counting first and inserting after is a race that oversells.
 *   3. Every event id is recorded. Stripe retries deliveries, and a retried
 *      "subscription created" must not consume a second seat.
 *
 * Plan changes are applied ONLY from webhook events. A checkout redirect
 * landing on a success page proves the browser got there, not that money moved.
 */

import { Router } from 'express';
import { getDb } from '../../db/client.js';
import { requireAuth, rateLimit, route } from '../middleware.js';
import {
  PLANS, createCheckoutSession, createPortalSession, stripeReady, verifyWebhook,
  type PlanId,
} from '../../vendors/stripe.js';

export const billing = Router();

// Dormant with a single non-founding membership; retained so the seat-cap
// machinery below still compiles and can be switched back on for a founding tier.
const FOUNDING_SEATS = 30;
const ACTIVE = ['active', 'trialing'];

/* GET /api/billing/plans — public, so pricing can render without a session. */
billing.get('/billing/plans', route(async (_req, res) => {
  const db = await getDb();
  const { rows } = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM subscriptions
      WHERE founding AND status = ANY($1)`,
    [ACTIVE],
  );
  const taken = Number(rows[0]?.n ?? 0);

  res.json({
    wired: stripeReady(),
    // Lets the pricing page offer the dev path instead of a dead button when
    // Stripe is not connected. False in production, always.
    dev_activation: process.env.NODE_ENV !== 'production'
      && process.env.ALLOW_DEV_PLAN_ACTIVATION === 'true',
    plans: Object.entries(PLANS).map(([id, p]) => ({
      id,
      label: p.label,
      price: p.price,
      founding: p.founding,
      ...(p.founding
        ? { seats_total: FOUNDING_SEATS, seats_left: Math.max(FOUNDING_SEATS - taken, 0) }
        : {}),
    })),
  });
}));

/* POST /api/billing/checkout */
billing.post('/billing/checkout', requireAuth, rateLimit({ key: 'checkout', max: 10, windowMs: 60_000 }), route(async (req, res) => {
  const plan = String((req.body ?? {}).plan ?? '') as PlanId;
  if (!(plan in PLANS)) return res.status(400).json({ error: 'Pick a plan.' });

  if (!stripeReady()) {
    return res.status(503).json({
      error: 'Checkout is not wired up yet.',
      detail: 'STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are not set. See src/vendors/stripe.ts.',
    });
  }

  // Advisory only — the authoritative check happens when the webhook claims
  // the seat. Refusing here just avoids taking money for a seat that is gone.
  if (PLANS[plan].founding) {
    const db = await getDb();
    const { rows } = await db.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM subscriptions WHERE founding AND status = ANY($1)`,
      [ACTIVE],
    );
    if (Number(rows[0]?.n ?? 0) >= FOUNDING_SEATS) {
      return res.status(409).json({ error: 'All founding seats are taken.' });
    }
  }

  const session = await createCheckoutSession(req.user!.user_id, plan, req.user!.email);
  res.json({ url: session.url });
}));

/* POST /api/billing/portal — cancel lives here. One tap, no retention flow. */
billing.post('/billing/portal', requireAuth, route(async (req, res) => {
  if (!stripeReady()) {
    return res.status(503).json({ error: 'Billing is not wired up yet.' });
  }
  const db = await getDb();
  const { rows } = await db.query<{ stripe_customer_id: string | null }>(
    `SELECT stripe_customer_id FROM users WHERE user_id = $1`,
    [req.user!.user_id],
  );
  const customer = rows[0]?.stripe_customer_id;
  if (!customer) return res.status(400).json({ error: 'No billing account yet.' });

  const session = await createPortalSession(customer);
  res.json({ url: session.url });
}));

/**
 * POST /api/billing/dev-activate — local development only.
 *
 * Stripe is stubbed, so without this there is no way to reach a paid plan and
 * the entire product is unreachable behind its own paywall. That makes the app
 * impossible to develop against or demo.
 *
 * Two independent locks, BOTH required:
 *   - NODE_ENV must not be 'production'
 *   - ALLOW_DEV_PLAN_ACTIVATION must be explicitly 'true'
 *
 * A single flag is not enough here: forgetting one env var in a deploy would
 * otherwise hand every visitor a free reseller plan. It also writes no
 * subscription row and never consumes a founding seat, so it cannot corrupt
 * the seat count that real billing depends on.
 */
billing.post('/billing/dev-activate', requireAuth, route(async (req, res) => {
  const devAllowed =
    process.env.NODE_ENV !== 'production' &&
    process.env.ALLOW_DEV_PLAN_ACTIVATION === 'true';

  if (!devAllowed) {
    return res.status(404).json({ error: 'Not found.' });
  }

  const plan = String((req.body ?? {}).plan ?? '');
  if (!(plan in PLANS)) return res.status(400).json({ error: 'Pick a plan.' });

  const db = await getDb();
  await db.query(`UPDATE users SET plan = $2 WHERE user_id = $1`, [req.user!.user_id, plan]);

  console.warn(
    `[dev] activated plan "${plan}" for user ${req.user!.user_id} without payment. ` +
    'This endpoint is disabled unless ALLOW_DEV_PLAN_ACTIVATION=true and NODE_ENV is not production.',
  );

  res.json({ ok: true, plan, dev: true });
}));

/* GET /api/billing/me */
billing.get('/billing/me', requireAuth, route(async (req, res) => {
  const db = await getDb();
  const { rows } = await db.query<Record<string, unknown>>(
    `SELECT sub_id, plan, status, current_period_end, founding, created_at
       FROM subscriptions WHERE user_id = $1
      ORDER BY created_at DESC LIMIT 1`,
    [req.user!.user_id],
  );
  res.json({ plan: req.user!.plan, subscription: rows[0] ?? null });
}));

/* ---------------------------------------------------------------------------
 * POST /api/webhooks/stripe
 *
 * Mounted with express.raw upstream — signature verification needs the exact
 * bytes Stripe signed, and JSON.parse followed by re-serialisation does not
 * reproduce them.
 * ------------------------------------------------------------------------- */
billing.post('/webhooks/stripe', route(async (req, res) => {
  const signature = req.headers['stripe-signature'];
  if (typeof signature !== 'string') {
    return res.status(400).json({ error: 'Missing signature.' });
  }
  if (!Buffer.isBuffer(req.body)) {
    // Loud, because the failure mode is a webhook route that "works" in tests
    // and cannot verify anything in production.
    console.error('stripe webhook did not receive a raw body — check the express.raw mount order');
    return res.status(500).json({ error: 'Webhook misconfigured.' });
  }
  if (!stripeReady()) return res.status(503).json({ error: 'Billing is not wired up yet.' });

  let event: { id: string; type: string; data: { object: Record<string, unknown> } };
  try {
    event = (await verifyWebhook(req.body, signature)) as unknown as typeof event;
  } catch (err) {
    // 400 and nothing else. Never log the body of an unverified request.
    console.error('stripe webhook signature rejected', (err as Error).message);
    return res.status(400).json({ error: 'Bad signature.' });
  }

  const db = await getDb();

  const outcome = await db.tx(async (tx) => {
    // Idempotency gate. A retried delivery stops here.
    const seen = await tx.query(
      `INSERT INTO webhook_events (event_id, type) VALUES ($1,$2)
       ON CONFLICT (event_id) DO NOTHING`,
      [event.id, event.type],
    );
    if (seen.rowCount === 0) return 'duplicate';

    const obj = event.data.object;
    const userId = Number(obj.client_reference_id ?? (obj.metadata as Record<string, unknown>)?.user_id ?? 0);
    const subId = String(obj.id ?? '');
    const plan = String((obj.metadata as Record<string, unknown>)?.plan ?? 'member');
    const status = String(obj.status ?? 'active');

    switch (event.type) {
      case 'checkout.session.completed':
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        if (!userId || !subId) return 'ignored';

        let founding = false;
        if (PLANS[plan as PlanId]?.founding) {
          // The authoritative cap. Counted and claimed in one transaction, so
          // two simultaneous checkouts cannot both read 29 and both insert.
          const { rows } = await tx.query<{ n: number }>(
            `SELECT COUNT(*)::int AS n FROM subscriptions
              WHERE founding AND status = ANY($1) AND sub_id <> $2`,
            [ACTIVE, subId],
          );
          founding = Number(rows[0]?.n ?? 0) < FOUNDING_SEATS;
        }

        await tx.query(
          `INSERT INTO subscriptions (sub_id, user_id, plan, status, current_period_end, founding)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (sub_id) DO UPDATE SET
             status = EXCLUDED.status,
             plan = EXCLUDED.plan,
             current_period_end = EXCLUDED.current_period_end`,
          [
            subId, userId, plan, status,
            obj.current_period_end ? new Date(Number(obj.current_period_end) * 1000) : null,
            founding,
          ],
        );

        if (obj.customer) {
          await tx.query(`UPDATE users SET stripe_customer_id = $2 WHERE user_id = $1`,
            [userId, String(obj.customer)]);
        }

        // Access follows the subscription, and only an active one grants it.
        // checkout.session.completed carries the SESSION status ('complete'),
        // not a subscription status — treat its arrival as active so it cannot
        // race ahead of subscription.created and knock the user back to 'none'.
        const active =
          event.type === 'checkout.session.completed'
            ? String(obj.status ?? 'complete') === 'complete'
            : ACTIVE.includes(status);
        await tx.query(`UPDATE users SET plan = $2 WHERE user_id = $1`,
          [userId, active ? plan : 'none']);
        return 'applied';
      }

      case 'customer.subscription.deleted': {
        const { rows } = await tx.query<{ user_id: number }>(
          `UPDATE subscriptions SET status = 'canceled' WHERE sub_id = $1 RETURNING user_id`,
          [subId],
        );
        const uid = rows[0]?.user_id;
        // Cancelling frees the founding seat. Holding it would quietly shrink
        // the cohort below 30 with nobody paying for the difference.
        if (uid) {
          await tx.query(`UPDATE subscriptions SET founding = false WHERE sub_id = $1`, [subId]);
          await tx.query(`UPDATE users SET plan = 'none' WHERE user_id = $1`, [uid]);
        }
        return 'applied';
      }

      default:
        return 'ignored';
    }
  });

  // Always 200 once verified: a non-2xx makes Stripe retry an event we have
  // already recorded.
  res.json({ received: true, outcome });
}));
