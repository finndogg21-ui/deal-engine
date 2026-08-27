/**
 * Grove scan — Grove Collaborative (grove.co) home/personal-care markdowns via
 * its open Shopify storefront.
 *   npm run scan:grove
 */
import 'dotenv/config';
import { getDb } from '../db/client.js';
import { fetchShopifyDeals } from '../vendors/shopify.js';
import { seedRegularDeals } from './regular-deals.js';

export async function scanGrove() {
  const db = await getDb();
  const deals = await fetchShopifyDeals({ domain: 'www.grove.co', retailer: 'grove' });
  const r = await seedRegularDeals(db, 'grove', 'grove-shopify', deals);
  console.log(`grove scan: fetched ${deals.length}, ${JSON.stringify(r)}`);
  return r;
}

import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  scanGrove().then(async () => { (await getDb()).close(); })
    .catch((e) => { console.error('grove scan crashed:', e); process.exit(1); });
}
