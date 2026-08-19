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
