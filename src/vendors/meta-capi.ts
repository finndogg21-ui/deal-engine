/**
 * Meta Conversions API (CAPI) — server-to-server conversion events.
 *
 * The money event lives HERE, not in the browser. iOS + ad-blockers gut the
 * browser pixel (the exact mobile-Safari traffic a Meta ad buys), so reporting
 * a Purchase from the page would undercount revenue by ~20-30% and the AI ad
 * creator would optimize against a lie. This fires from the Stripe
 * subscription.created webhook — a fact the server already trusts enough to
 * grant membership, so it is the most reliable possible conversion signal.
 *
 * Env-gated on META_PIXEL_ID + META_CAPI_TOKEN. Unset → no-op (returns false),
 * never throws into the webhook path: a CAPI hiccup must not make Stripe retry
 * a subscription we already recorded.
 *
 * Dedup: we send an event_id. If a browser Purchase is ever added later, give
 * it the SAME id and Meta de-duplicates. Today only the server fires Purchase,
 * so there is nothing to double-count.
 *
 * No SDK — CAPI is one JSON POST to the Graph API.
 */

import { createHash } from 'node:crypto';

const PIXEL_ID = process.env.META_PIXEL_ID ?? '';
const TOKEN = process.env.META_CAPI_TOKEN ?? '';
const API_VERSION = process.env.META_GRAPH_VERSION ?? 'v21.0';

export function capiConfigured(): boolean {
  return Boolean(PIXEL_ID && TOKEN);
}

/** Meta requires SHA-256 lowercased-trimmed hashes for PII match keys. */
function sha256(v: string): string {
  return createHash('sha256').update(v.trim().toLowerCase()).digest('hex');
}

export interface PurchaseEvent {
  /** Idempotency + browser-dedup key. Use the Stripe subscription id. */
  eventId: string;
  /** For match quality — hashed before send, never sent raw. */
  email?: string | null;
  valueUsd: number;
  /** Unix seconds; defaults to now. Pass the Stripe event time when you have it. */
  eventTime?: number;
}

/**
 * Report a confirmed purchase. Returns true on a 2xx from Meta, false on
 * not-configured or any failure — the caller logs and moves on; this never
 * throws into the webhook.
 */
export async function reportPurchase(ev: PurchaseEvent): Promise<boolean> {
  if (!capiConfigured()) return false;
  try {
    const user_data: Record<string, string> = {};
    if (ev.email) user_data.em = sha256(ev.email);

    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(TOKEN)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [
            {
              event_name: 'Purchase',
              event_time: ev.eventTime ?? Math.floor(Date.now() / 1000),
              event_id: ev.eventId,
              action_source: 'website',
              user_data,
              custom_data: { value: ev.valueUsd, currency: 'USD' },
            },
          ],
        }),
      },
    );
    if (!res.ok) {
      console.error(`meta capi ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('meta capi send failed', err);
    return false;
  }
}
