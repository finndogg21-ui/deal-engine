/**
 * Woot scan — pull Woot's active events and publish the real markdowns.
 *   npm run scan:woot
 */
import 'dotenv/config';
import { getDb } from '../db/client.js';
import { fetchWootDeals } from '../vendors/woot.js';
import { seedRegularDeals } from './regular-deals.js';

export async function scanWoot() {
  const db = await getDb();
  const deals = await fetchWootDeals();
  const r = await seedRegularDeals(db, 'woot', 'woot-gql', deals);
  console.log(`woot scan: fetched ${deals.length}, ${JSON.stringify(r)}`);
  return r;
}

import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  scanWoot().then(async () => { (await getDb()).close(); })
    .catch((e) => { console.error('woot scan crashed:', e); process.exit(1); });
}
