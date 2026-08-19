/**
 * ===========================================================
 *  STRIPE BILLING GOES HERE
 * ===========================================================
 *
 * Hosted Checkout only. Never handle a card number, which keeps PCI scope
 * almost entirely out of this codebase.
 *
 * NON-NEGOTIABLE when wiring the webhook: verify the signature. Without it,
 * anyone can POST "subscription created" and grant themselves a founding seat
 * with a curl command.
 *
 * Founding seats are capped at 30 and the count must be enforced inside a
 * transaction on the server, never in the client.
 *
 * Fees, verified 2026-08: Stripe 2.9% + 30c, plus 0.7% for Billing.
 * Apple takes 15% under $1M in proceeds, which is why plans are sold on the
 * web and the phone only signs in.
 */

import { notWired, isWired } from './contracts.js';

const ENV = 'STRIPE_SECRET_KEY';
const HOOK_ENV = 'STRIPE_WEBHOOK_SECRET';

export const stripeReady = () => isWired(ENV) && isWired(HOOK_ENV);

export const PLANS = {
  consumer: { label: 'Saving money', price: 9.99, founding: false },
  reseller: { label: 'Making money', price: 19, founding: true, seatCap: 30 },
} as const;

export type PlanId = keyof typeof PLANS;

export async function createCheckoutSession(
  _userId: number, _plan: PlanId, _email: string,
): Promise<{ url: string }> {
  if (!stripeReady()) notWired('stripe', `${ENV} and ${HOOK_ENV}`);
  notWired('stripe', ENV);
}

export async function createPortalSession(_customerId: string): Promise<{ url: string }> {
  if (!stripeReady()) notWired('stripe', ENV);
  notWired('stripe', ENV);
}

/**
 * MUST verify the signature before trusting anything in the body.
 * Returns the parsed event, or throws.
 */
export async function verifyWebhook(_rawBody: Buffer, _signature: string): Promise<unknown> {
  if (!stripeReady()) notWired('stripe', HOOK_ENV);
  notWired('stripe', HOOK_ENV);
}
