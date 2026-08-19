/**
 * Match, then deliver. The step that runs after every scan.
 *
 *   npm run alerts
 *
 * Deliberately a separate entry point from the scan: a matcher bug must never
 * be able to take down the collection of price history, which is the one
 * thing that cannot be recovered later.
 */

import 'dotenv/config';
import { getDb } from '../db/client.js';
import { runMatcher } from './matcher.js';
import { deliverPending } from './deliver.js';

const db = await getDb();

const matched = await runMatcher(db);
console.log(
  `matcher: ${matched.alerts_written} written from ${matched.users_considered} users ` +
  `(quiet hours ${matched.skipped_quiet_hours}, at cap ${matched.skipped_cap}, ` +
  `already sent ${matched.skipped_duplicate})`,
);

const delivered = await deliverPending(db);
console.log(
  `delivery: ${delivered.alerts_delivered} alerts in ${delivered.digests_sent} messages` +
  (delivered.failed > 0 ? `, ${delivered.failed} failed and left queued for retry` : ''),
);

await db.close();
