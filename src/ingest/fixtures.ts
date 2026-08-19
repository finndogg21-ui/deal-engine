/**
 * Demo data: ten real Home Depot clearance finds, transcribed from a live
 * screenshot, so the interface is exercised against believable products rather
 * than invented ones.
 *
 *   npm run fixtures      load
 *   npm run purge         remove every trace
 *
 * Images are generated SVG data URIs. Real product photos live on retailer
 * CDNs, and hotlinking those into seed data would break the moment a URL
 * rotated. These never expire and need no network.
 */

import { getDb } from '../db/client.js';
import { pathToFileURL } from 'node:url';

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** A flat product silhouette, tinted per item, as a data URI. */
function svg(bg: string, fg: string, shape: string): string {
  const body = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
<rect width="120" height="120" fill="${bg}"/>${shape.replace(/FG/g, fg)}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(body)}`;
}

const BOTTLE = '<rect x="46" y="30" width="28" height="62" rx="5" fill="FG"/><rect x="54" y="18" width="12" height="14" rx="2" fill="FG"/><rect x="50" y="48" width="20" height="22" rx="2" fill="#fff" opacity=".85"/>';
const BAG = '<path d="M34 42h52l-6 52H40z" fill="FG"/><rect x="42" y="52" width="36" height="20" rx="2" fill="#fff" opacity=".85"/>';
const CAN = '<rect x="36" y="38" width="48" height="52" rx="4" fill="FG"/><rect x="32" y="30" width="56" height="10" rx="3" fill="FG" opacity=".7"/><rect x="44" y="54" width="32" height="18" rx="2" fill="#fff" opacity=".85"/>';
const BOARD = '<rect x="20" y="48" width="80" height="24" rx="3" fill="FG"/><rect x="20" y="56" width="80" height="3" fill="#fff" opacity=".5"/>';
const BOX = '<path d="M28 44l32-14 32 14v34L60 92 28 78z" fill="FG"/><path d="M28 44l32 14 32-14M60 58v34" stroke="#fff" stroke-width="2.5" fill="none" opacity=".7"/>';
const JUG = '<path d="M42 34h30a6 6 0 016 6v46a6 6 0 01-6 6H42a6 6 0 01-6-6V40a6 6 0 016-6z" fill="FG"/><rect x="72" y="44" width="12" height="18" rx="4" fill="FG"/><rect x="44" y="52" width="24" height="20" rx="2" fill="#fff" opacity=".85"/>';
const PLATE = '<rect x="34" y="34" width="52" height="52" rx="5" fill="FG"/><circle cx="60" cy="60" r="12" fill="#fff" opacity=".85"/>';
const TIP = '<path d="M56 24h8v48h-8z" fill="FG"/><path d="M52 72h16l-8 26z" fill="FG"/>';

/** Transcribed from a real deals feed. Prices, savings, stores, aisles and
 *  stock are as observed. */
const DEALS = [
  { sku: '312894001', title: 'Outdoor Carpenter Bee Hanging Insect Trap with Wooden House',
    cat: 'Outdoor', price: 2.00, list: 19.97, store: '0582', aisle: 'Aisle 48 - Bay 6',
    stock: 37, hrs: 5, others: 9, img: svg('#f0ece2', '#c99a5b', BOX) },

  { sku: '203234891', title: 'Polyblend Plus #381 Bright White 25 lb. Sanded Grout',
    cat: 'Flooring', price: 2.00, list: 19.48, store: '0582', aisle: 'Aisle PR - Bay 3',
    stock: 8, hrs: 5, others: 4, img: svg('#eef0f2', '#d8dade', BAG) },

  { sku: '205889231', title: '1 Gal. #PFC-63 Slate Gray Low-Lustre Porch and Patio Floor Paint',
    cat: 'Paint', price: 3.90, list: 39.98, store: '6989', aisle: 'Customer Service Desk - Bay 1',
    stock: 17, hrs: 8, others: 0, img: svg('#e8ebe9', '#5d6b70', CAN) },

  { sku: '100177201', title: '0.09 in. x 8 in. x 12.5 ft. White Vinyl Fascia',
    cat: 'Building Materials', price: 6.25, list: 24.98, store: '8995', aisle: 'Aisle 20 - Bay 16',
    stock: 23, hrs: 4, others: 0, img: svg('#f2f2f0', '#cfd3d6', BOARD) },

  { sku: '206110455', title: 'Prism #165 Delorean Gray 17 lb. Ultimate Performance Grout',
    cat: 'Flooring', price: 4.10, list: 40.87, store: '6529', aisle: 'Back Wall - Bay 30',
    stock: 5, hrs: 8, others: 0, img: svg('#eceef0', '#9aa3a9', BAG) },

  { sku: '304556712', title: 'Bleach-Free Outdoor Cleaner 64 oz. Spray Concentrate',
    cat: 'Cleaning', price: 2.00, list: 19.98, store: '6550', aisle: 'Aisle 16 - Side of Endcap',
    stock: 40, hrs: 6, others: 6, img: svg('#e9f0ec', '#4f9d76', BOTTLE) },

  { sku: '301882440', title: '128 fl. oz. Outdoor Glass Cleaner Refill',
    cat: 'Cleaning', price: 2.20, list: 18.48, store: '8995', aisle: 'Aisle 12 - Bay 4',
    stock: 12, hrs: 3, others: 0, img: svg('#eaf0f4', '#4a8fbf', JUG) },

  { sku: '203234115', title: 'Polyblend Plus #115 Platinum 10 lb. Sanded Grout',
    cat: 'Flooring', price: 1.90, list: 18.48, store: '0582', aisle: 'Aisle PR - Bay 3',
    stock: 9, hrs: 5, others: 3, img: svg('#eef0f2', '#c2c6cb', BAG) },

  { sku: '100655321', title: '6 in. x 7.5 in. Split Recessed Mounting Block',
    cat: 'Electrical', price: 3.75, list: 14.98, store: '8437', aisle: 'Aisle 34 - Bay 9',
    stock: 6, hrs: 9, others: 0, img: svg('#f1f1ef', '#dcdedc', PLATE) },

  { sku: '314778902', title: '12-Watt Tip Bundle (2-Piece)',
    cat: 'Tools', price: 8.09, list: 31.97, store: '6818', aisle: 'Aisle 7 - Bay 22',
    stock: 4, hrs: 7, others: 0, img: svg('#f0eeea', '#b1663a', TIP) },
];

const STORES: Record<string, { name: string; zip: string; lat: number; lng: number }> = {
  '0582': { name: 'Bitters Rd', zip: '78216', lat: 29.5559, lng: -98.4869 },
  '6989': { name: 'Bulverde', zip: '78163', lat: 29.7444, lng: -98.4586 },
  '8995': { name: 'Dripping Springs', zip: '78620', lat: 30.1902, lng: -98.0867 },
  '6529': { name: 'Military Dr', zip: '78221', lat: 29.3527, lng: -98.5178 },
  '6550': { name: 'Stone Oak', zip: '78258', lat: 29.6303, lng: -98.4783 },
  '8437': { name: 'Seguin', zip: '78155', lat: 29.5688, lng: -97.9647 },
  '6818': { name: 'New Braunfels', zip: '78130', lat: 29.7030, lng: -98.1245 },
};

export async function loadFixtures(): Promise<{ products: number; observations: number }> {
  const db = await getDb();
  const now = Date.now();
  const runId = 'fixture-real10';

  await db.query(`DELETE FROM price_observations WHERE source = 'fixture'`);

  for (const [no, s] of Object.entries(STORES)) {
    await db.query(
      `INSERT INTO stores (store_id, retailer, store_number, name, address, city, state, zip, lat, lng)
       VALUES ($1,'homedepot',$2,$3,$4,'San Antonio','TX',$5,$6,$7)
       ON CONFLICT (store_id) DO UPDATE SET name = EXCLUDED.name, lat = EXCLUDED.lat, lng = EXCLUDED.lng`,
      [`homedepot:${no}`, no, `Store #${no} · ${s.name}`, s.name, s.zip, s.lat, s.lng],
    );
  }

  let observations = 0;

  for (const d of DEALS) {
    const productId = `homedepot:${d.sku}`;
    const storeId = `homedepot:${d.store}`;

    await db.query(
      `INSERT INTO products (product_id, retailer, sku, title, category, image_url)
       VALUES ($1,'homedepot',$2,$3,$4,$5)
       ON CONFLICT (product_id) DO UPDATE SET title = EXCLUDED.title, image_url = EXCLUDED.image_url`,
      [productId, d.sku, d.title, d.cat, d.img],
    );

    // A believable markdown walk ending at the observed price. Deep discounts
    // reached the bottom rung; shallower ones are still descending.
    const finalPct = Math.round((1 - d.price / d.list) * 100);
    const walk = finalPct >= 85
      ? [
          { daysAgo: 58, pct: 22, avail: 'in_stock', stock: d.stock + 40 },
          { daysAgo: 41, pct: 24, avail: 'in_stock', stock: d.stock + 28 },
          { daysAgo: 29, pct: 52, avail: 'in_stock', stock: d.stock + 15 },
          { daysAgo: 18, pct: 55, avail: 'in_stock', stock: d.stock + 6 },
          { daysAgo: 11, pct: finalPct, avail: 'in_stock', stock: d.stock + 1 },
          { daysAgo: 4, pct: finalPct, avail: 'unavailable', stock: d.stock },
        ]
      : [
          { daysAgo: 34, pct: 21, avail: 'in_stock', stock: d.stock + 22 },
          { daysAgo: 20, pct: 50, avail: 'in_stock', stock: d.stock + 11 },
          { daysAgo: 8, pct: finalPct, avail: 'in_stock', stock: d.stock + 3 },
        ];

    for (const step of walk) {
      const price = Number((d.list * (1 - step.pct / 100)).toFixed(2));
      await db.query(
        `INSERT INTO price_observations
           (product_id, store_id, observed_at, price, list_price, discount_pct,
            stock_qty, availability, aisle_bay, source, run_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'fixture',$10)`,
        [productId, storeId, new Date(now - step.daysAgo * DAY), price, d.list,
          step.pct, step.stock, step.avail, d.aisle, runId],
      );
      observations++;
    }

    // Latest sighting, at the freshness shown on the card.
    await db.query(
      `INSERT INTO price_observations
         (product_id, store_id, observed_at, price, list_price, discount_pct,
          stock_qty, availability, aisle_bay, source, run_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'fixture',$10)`,
      [productId, storeId, new Date(now - d.hrs * HOUR), d.price, d.list, finalPct,
        d.stock, finalPct >= 85 ? 'unavailable' : 'in_stock', d.aisle, runId],
    );
    observations++;
  }

  await db.query(
    `INSERT INTO scan_runs (run_id, source, started_at, finished_at, status, rows_written, zips, canary_ok)
     VALUES ($1,'fixture',$2,$3,'ok',$4,'78216,78258,78232',true)
     ON CONFLICT (run_id) DO UPDATE SET rows_written = EXCLUDED.rows_written, finished_at = EXCLUDED.finished_at`,
    [runId, new Date(now - 2 * HOUR), new Date(now - 2 * HOUR + 60_000), observations],
  );

  return { products: DEALS.length, observations };
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  loadFixtures()
    .then(async (r) => {
      console.log(`fixtures: ${r.products} products, ${r.observations} observations`);
      const db = await getDb();
      await db.close();
    })
    .catch((err) => {
      console.error('fixtures failed:', err);
      process.exit(1);
    });
}
