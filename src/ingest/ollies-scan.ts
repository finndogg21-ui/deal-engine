/**
 * Ollie's scan — pull Ollie's Shopify catalog and publish real markdowns.
 *   npm run scan:ollies
 */
import 'dotenv/config';
import { getDb } from '../db/client.js';
import { fetchOlliesDeals } from '../vendors/ollies.js';
import { seedRegularDeals } from './regular-deals.js';

export async function scanOllies() {
  const db = await getDb();
  const deals = await fetchOlliesDeals();
  const r = await seedRegularDeals(db, 'ollies', 'ollies-shopify', deals);
  console.log(`ollies scan: fetched ${deals.length}, ${JSON.stringify(r)}`);
  return r;
}

import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  scanOllies().then(async () => { (await getDb()).close(); })
    .catch((e) => { console.error('ollies scan crashed:', e); process.exit(1); });
}
