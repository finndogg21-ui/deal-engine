/**
 * Newegg scan — fetch Newegg's server-rendered deal pages and publish the
 * real markdowns through the generic regular-deals pipeline.
 *
 *   npm run scan:newegg
 */

import 'dotenv/config';
import { getDb } from '../db/client.js';
import { fetchNeweggDeals } from '../vendors/newegg.js';
import { seedRegularDeals } from './regular-deals.js';

export async function scanNewegg() {
  const db = await getDb();
  const deals = await fetchNeweggDeals();
  const r = await seedRegularDeals(db, 'newegg', 'newegg-web', deals);
  console.log(`newegg scan: fetched ${deals.length}, ${JSON.stringify(r)}`);
  return r;
}

import { pathToFileURL } from 'node:url';
const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  scanNewegg()
    .then(async () => { (await getDb()).close(); })
    .catch((e) => { console.error('newegg scan crashed:', e); process.exit(1); });
}
