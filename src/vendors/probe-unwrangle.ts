/**
 * One-off probe: does Unwrangle return store-local data when you actually
 * ask it to?
 *
 *   npm run probe:unwrangle
 *
 * Three earlier attempts through their web playground all came back with
 * store_no 8119 (Home Depot's online fulfilment node, not a building) and a
 * different city each time — Atlanta, Buffalo, Nashville. That is proxy
 * rotation being geolocated, not a store answer, because the playground has
 * no fields for store_no/zipcode and never sent them.
 *
 * A first explicit attempt (url + store_no=582 + zipcode=78232) returned
 * "Product not found" even though the item id parsed correctly — so the store
 * parameters are doing something, just not the documented thing. This walks
 * the combinations to find which one, if any, works.
 *
 * Ground truth from the scrapyspider run on 2026-08-16:
 *   item 324308361 @ store 582 (Bitters Rd) = 8 units, $7.03, 77% off
 */

import 'dotenv/config';

const KEY = process.env.UNWRANGLE_KEY;
if (!KEY) {
  console.error(
    'UNWRANGLE_KEY is not set.\n' +
    'Add it to .env as:  UNWRANGLE_KEY=your_key_here',
  );
  process.exit(1);
}

const ITEM = '324308361';
const PRODUCT_URL =
  'https://www.homedepot.com/p/EcoSmart-16-4-ft-RGBWIC-Dynamic-Color-Changing-Dimmable-Linkable-Plug-In-LED-Outdoor-Strip-Light-with-Remote-Control-LR1321-RGBWIC-U/324308361';

interface Variant { label: string; params: Record<string, string> }

const VARIANTS: Variant[] = [
  { label: 'item_id + store 582 + zip',   params: { item_id: ITEM, store_no: '582', zipcode: '78232' } },
  { label: 'item_id + store 0582 + zip',  params: { item_id: ITEM, store_no: '0582', zipcode: '78232' } },
  { label: 'url + store 0582 + zip',      params: { url: PRODUCT_URL, store_no: '0582', zipcode: '78232' } },
  { label: 'item_id + zip only',          params: { item_id: ITEM, zipcode: '78232' } },
  { label: 'url only (control)',          params: { url: PRODUCT_URL } },
];

function build(params: Record<string, string>): string {
  const q = new URLSearchParams({ platform: 'homedepot_detail', ...params, api_key: KEY! });
  return `https://data.unwrangle.com/api/getter/?${q}`;
}

let lastCredits: number | null = null;

for (const v of VARIANTS) {
  const res = await fetch(build(v.params));
  const data = (await res.json()) as Record<string, any>;

  if (!data.success) {
    console.log(`${v.label.padEnd(30)} FAILED: ${data.message}`);
    continue;
  }

  const d = data.detail ?? {};
  const stores: string[] = [];
  for (const opt of d.fulfillment_options ?? []) {
    for (const svc of opt.services ?? []) {
      for (const loc of svc.locations ?? []) {
        stores.push(`${loc.store_id}${loc.store_name ? `(${loc.store_name})` : ''}=${loc.inventory_quantity}`);
      }
    }
  }

  console.log(
    `${v.label.padEnd(30)} echo_store=${String(data.store_no).padEnd(5)} zip=${String(data.zipcode).padEnd(6)} ` +
    `aisle=${JSON.stringify(d.aisle_bay)} price=${d.price} list=${d.list_price} | ${stores.join(' ') || 'no locations'}`,
  );
  lastCredits = data.remaining_credits ?? lastCredits;
}

console.log(`\nremaining credits: ${lastCredits ?? 'unknown'}`);
console.log('Looking for: echo_store=582, a non-null aisle, or price 7.03 (the clearance price).');
