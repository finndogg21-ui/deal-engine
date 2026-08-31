/**
 * Stripe billing — Hosted Checkout + subscription webhooks for the single
 * membership.
 *
 * We never touch a card number (PCI stays out of scope): Checkout runs on
 * Stripe's domain, and the signature-verified webhook — not the success
 * redirect — is what actually moves a user onto the plan. The webhook handler
 * lives in src/api/routes/billing.ts; this file is only the Stripe SDK edge.
 *
 * Requires two env vars, named EXACTLY (Railway → web service → Variables):
 *   STRIPE_SECRET_KEY      sk_live_… / sk_test_…
 *   STRIPE_WEBHOOK_SECRET  whsec_…  (the signing secret of the webhook endpoint)
 *
 * Optional: PUBLIC_BASE_URL for the Checkout redirect origin (defaults to prod).
 */
import Stripe from 'stripe';
import { notWired } from './contracts.js';

const ENV = 'STRIPE_SECRET_KEY';
const HOOK_ENV = 'STRIPE_WEBHOOK_SECRET';

/**
 * Resolve the Stripe keys by VALUE, not just by variable name.
 *
 * The keys live in Railway under non-standard names ("stripe key", "webhook
 * key 2") that the operator would rather not rename. Stripe keys carry fixed
 * prefixes — secret keys start `sk_`, webhook signing secrets `whsec_` — so we
 * prefer the canonical env var, then fall back to scanning every env value for
 * the right prefix. That finds the key whatever the variable is named.
 *
 * Caveat: if Railway never exposes a space-named variable to the process at
 * all, nothing here can read it and it must be renamed — but this catches every
 * case where the value IS present under some name.
 */
function byPrefix(...prefixes: string[]): string | undefined {
  for (const v of Object.values(process.env)) {
    const t = v?.trim();
    if (t && prefixes.some((p) => t.startsWith(p))) return t;
  }
  return undefined;
}
const secretKey = (): string | undefined => process.env[ENV]?.trim() || byPrefix('sk_', 'rk_');
const webhookSecret = (): string | undefined => process.env[HOOK_ENV]?.trim() || byPrefix('whsec_');

export const stripeReady = (): boolean => Boolean(secretKey() && webhookSecret());

/** One membership. $20/mo, unlocks everything. */
export const PLANS = {
  member: { label: 'Membership', price: 20, founding: false },
} as const;

export type PlanId = keyof typeof PLANS;

let _client: Stripe | null = null;
function client(): Stripe {
  const key = secretKey();
  if (!key) notWired('stripe', `${ENV} (or any var holding an sk_… value)`);
  if (!_client) _client = new Stripe(key);
  return _client;
}

/** Absolute origin for Checkout redirects. */
function baseUrl(): string {
  const raw = process.env.PUBLIC_BASE_URL?.trim().replace(/\/+$/, '');
  return raw || 'https://web-production-cc975.up.railway.app';
}

export async function createCheckoutSession(
  userId: number,
  plan: PlanId,
  email: string,
): Promise<{ url: string }> {
  if (!stripeReady()) notWired('stripe', `${ENV} and ${HOOK_ENV}`);
  const p = PLANS[plan];
  const base = baseUrl();
  const session = await client().checkout.sessions.create({
    mode: 'subscription',
    customer_email: email,
    client_reference_id: String(userId),
    metadata: { user_id: String(userId), plan },
    // Copied onto the subscription so the customer.subscription.* webhooks —
    // the authoritative activation — carry who and which plan.
    subscription_data: { metadata: { user_id: String(userId), plan } },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          product_data: { name: p.label },
          recurring: { interval: 'month' },
          unit_amount: Math.round(p.price * 100),
        },
      },
    ],
    success_url: `${base}/app?checkout=success`,
    cancel_url: `${base}/pricing?checkout=cancel`,
  });
  if (!session.url) throw new Error('stripe: checkout session had no url');
  return { url: session.url };
}

export async function createPortalSession(customerId: string): Promise<{ url: string }> {
  if (!stripeReady()) notWired('stripe', ENV);
  const session = await client().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${baseUrl()}/app`,
  });
  return { url: session.url };
}

/** Verify + parse a webhook. Throws if the signature does not check out. */
export async function verifyWebhook(rawBody: Buffer, signature: string): Promise<Stripe.Event> {
  const secret = webhookSecret();
  if (!secret) notWired('stripe', `${HOOK_ENV} (or any var holding a whsec_… value)`);
  return client().webhooks.constructEvent(rawBody, signature, secret);
}
