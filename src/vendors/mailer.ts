/**
 * ===========================================================
 *  EMAIL SENDER GOES HERE
 * ===========================================================
 *
 * Auth emails, alert digests, contact replies.
 *
 * Without MAIL_URL set, this logs to the console instead of throwing. That is
 * deliberate and it is the one exception to the loud-failure rule: a dev
 * signing up locally should not be blocked by a missing mail provider, and
 * the reset link is printed so the flow can be completed by hand.
 */

import { isWired, type OutboundEmail } from './contracts.js';

const ENV = 'MAIL_URL';

export const mailerReady = () => isWired(ENV);

export async function send(mail: OutboundEmail): Promise<void> {
  if (!mailerReady()) {
    // The body can contain a one-time reset/deletion TOKEN. In production, never
    // print it to the logs — a missing MAIL_URL is a real misconfiguration, so
    // log the recipient only and withhold the body. (Do not throw: /forgot must
    // still answer {ok:true} to stay enumeration-safe.)
    if (process.env.NODE_ENV === 'production') {
      console.error(`[MAIL NOT WIRED] refused to send to ${mail.to} — set ${ENV}. Body withheld (may contain a token).`);
      return;
    }
    // Dev only: the full body is useful locally and no real token is at risk.
    console.log(
      `\n[MAIL NOT WIRED] would send to ${mail.to}\n` +
      `  subject: ${mail.subject}\n` +
      `  ${mail.text.split('\n').join('\n  ')}\n` +
      `  (set ${ENV} in .env to send for real)\n`,
    );
    return;
  }

  // ---- REAL SENDER GOES HERE ----
  throw new Error(`${ENV} is set but src/vendors/mailer.ts is not implemented.`);
}
