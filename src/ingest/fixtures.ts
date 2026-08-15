/**
 * Synthetic data so the dashboard has something to render before Apify is
 * subscribed. Deterministic — same seed, same data, every time.
 *
 *   npm run fixtures
 *
 * Everything it writes carries source='fixture', so one DELETE removes it all
 * once real scan data arrives. It is never mixed into the real history.
 */

import { getDb } from '../db/client.js';

// Deterministic PRNG so fixtures are reproducible and diffs are meaningful.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const DAY = 86_400_000;

const STORES = [
  { n: '6535', r: 'homedepot', name: 'Home Depot — San Pedro', zip: '78216', lat: 29.5216, lng: -98.4861 },
  { n: '6543', r: 'homedepot', name: 'Home Depot — Bandera', zip: '78238', lat: 29.4869, lng: -98.6083 },
  { n: '6571', r: 'homedepot', name: 'Home Depot — Stone Oak', zip: '78258', lat: 29.6303, lng: -98.4783 },
  { n: '0466', r: 'lowes', name: "Lowe's — Thousand Oaks", zip: '78232', lat: 29.5738, lng: -98.4472 },
  { n: '1120', r: 'lowes', name: "Lowe's — Blanco Rd", zip: '78248', lat: 29.5878, lng: -98.5106 },
];

const CATALOG = [
  ['Milwaukee M18 Cordless Impact Driver', 'Tools', 199.0],
  ['Ryobi 40V Brushless Mower', 'Outdoor', 449.0],
  ['DeWalt 20V Circular Saw', 'Tools', 179.0],
  ['Husky 52in Tool Chest', 'Storage', 649.0],
  ['Behr Marquee Interior Paint 5gal', 'Paint', 219.0],
  ['Hampton Bay Patio Set 4pc', 'Outdoor', 799.0],
  ['Ring Floodlight Cam Wired Pro', 'Smart Home', 249.0],
  ['Werner 24ft Fiberglass Ladder', 'Tools', 329.0],
  ['Glacier Bay Vanity 36in', 'Bath', 399.0],
  ['Toro 21in Self-Propelled Mower', 'Outdoor', 429.0],
  ['Kohler Elongated Toilet', 'Bath', 289.0],
  ['ClosetMaid Shelving Kit', 'Storage', 89.0],
  ['Rubbermaid Deck Box 120gal', 'Outdoor', 149.0],
  ['Philips Hue Starter Kit', 'Smart Home', 199.0],
  ['Char-Broil 4-Burner Gas Grill', 'Outdoor', 349.0],
  ['Everbilt Sump Pump 1/2HP', 'Plumbing', 179.0],
  ['Defiant Smart Deadbolt', 'Smart Home', 129.0],
  ['Vigoro Mulch Pallet', 'Garden', 259.0],
] as const;

/**
 * Four archetypes, so the dashboard shows the full range instead of one shape:
 *  - full ladder then delisted with stock  -> the high scorers
 *  - full ladder, still listed             -> mid, worth watching
 *  - shallow discount only                 -> low
 *  - delisted with no stock signal         -> ambiguous
 */
type Arc = 'penny' | 'walking' | 'shallow' | 'ambiguous';

export async function loadFixtures(seed = 42): Promise<{ products: number; observations: number }> {
  const db = await getDb();
  const rand = rng(seed);
  const now = Date.now();
  const runId = `fixture-${seed}`;

  await db.query(`DELETE FROM price_observations WHERE source = 'fixture'`);

  for (const s of STORES) {
    await db.query(
      `INSERT INTO stores (store_id, retailer, store_number, name, address, city, state, zip, lat, lng)
       VALUES ($1,$2,$3,$4,$5,'San Antonio','TX',$6,$7,$8)
       ON CONFLICT (store_id) DO NOTHING`,
      [`${s.r}:${s.n}`, s.r, s.n, s.name, `${s.name} address`, s.zip, s.lat, s.lng],
    );
  }

  let products = 0;
  let observations = 0;

  for (let i = 0; i < CATALOG.length; i++) {
    const [title, category, list] = CATALOG[i]!;
    const store = STORES[Math.floor(rand() * STORES.length)]!;
    const retailer = store.r;
    const sku = `${100000 + i * 37}`;
    const productId = `${retailer}:${sku}`;
    const storeId = `${retailer}:${store.n}`;

    await db.query(
      `INSERT INTO products (product_id, retailer, sku, title, category, image_url, product_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (product_id) DO NOTHING`,
      [productId, retailer, sku, title, category, null, null],
    );
    products++;

    const arcs: Arc[] = ['penny', 'walking', 'shallow', 'ambiguous'];
    const arc = arcs[i % arcs.length]!;

    // Build a discount path back in time, then emit one observation per step.
    let path: { daysAgo: number; discount: number; avail: string; stock: number | null }[];

    if (arc === 'penny') {
      path = [
        { daysAgo: 60, discount: 22, avail: 'in_stock', stock: 14 },
        { daysAgo: 45, discount: 24, avail: 'in_stock', stock: 11 },
        { daysAgo: 32, discount: 52, avail: 'in_stock', stock: 6 },
        { daysAgo: 24, discount: 55, avail: 'in_stock', stock: 4 },
        { daysAgo: 16, discount: 88, avail: 'in_stock', stock: 2 },
        { daysAgo: 13, discount: 91, avail: 'in_stock', stock: 2 },
        { daysAgo: 11, discount: 91, avail: 'unavailable', stock: 2 },
        { daysAgo: 2, discount: 91, avail: 'unavailable', stock: 2 },
      ];
    } else if (arc === 'walking') {
      path = [
        { daysAgo: 40, discount: 21, avail: 'in_stock', stock: 22 },
        { daysAgo: 26, discount: 51, avail: 'in_stock', stock: 15 },
        { daysAgo: 9, discount: 78, avail: 'in_stock', stock: 7 },
        { daysAgo: 1, discount: 82, avail: 'in_stock', stock: 5 },
      ];
    } else if (arc === 'shallow') {
      path = [
        { daysAgo: 20, discount: 20, avail: 'in_stock', stock: 40 },
        { daysAgo: 8, discount: 25, avail: 'in_stock', stock: 33 },
        { daysAgo: 1, discount: 25, avail: 'in_stock', stock: 30 },
      ];
    } else {
      path = [
        { daysAgo: 30, discount: 55, avail: 'in_stock', stock: 9 },
        { daysAgo: 18, discount: 60, avail: 'in_stock', stock: 3 },
        { daysAgo: 6, discount: 60, avail: 'unavailable', stock: null },
      ];
    }

    for (const step of path) {
      const price = Number((list * (1 - step.discount / 100)).toFixed(2));
      await db.query(
        `INSERT INTO price_observations
           (product_id, store_id, observed_at, price, list_price, discount_pct,
            stock_qty, availability, source, run_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'fixture',$9)`,
        [
          productId,
          storeId,
          new Date(now - step.daysAgo * DAY),
          price,
          list,
          step.discount,
          step.stock,
          step.avail,
          runId,
        ],
      );
      observations++;
    }
  }

  await db.query(
    `INSERT INTO scan_runs (run_id, source, started_at, finished_at, status, rows_written, zips, canary_ok)
     VALUES ($1,'fixture',$2,$3,'ok',$4,'78232,78216,78248,78258',true)
     ON CONFLICT (run_id) DO UPDATE SET rows_written = EXCLUDED.rows_written`,
    [runId, new Date(now - 60_000), new Date(), observations],
  );

  return { products, observations };
}

import { pathToFileURL } from 'node:url';

// Windows produces file:///C:/... so string-building the URL by hand doesn't
// match. pathToFileURL gets it right on every platform.
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
