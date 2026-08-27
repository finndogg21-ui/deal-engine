/**
 * Generic REGULAR-deal ingest — the path every scraped non-HD retailer uses.
 *
 * Unlike the Home Depot pipeline (scrape -> verify against HD's own endpoint),
 * a retailer whose online price IS the price it charges has no separate truth
 * layer: the scraped price is the verdict, exactly like Best Buy's outlet feed.
 * So this seeds `discovery` with the claimed price and immediately records a
 * verdict carrying that same price, letting the tiered floor decide publish vs
 * reject. A row that clears the floor renders on the dashboard with no extra
 * step; a shallow one is rejected with an auditable reason.
 *
 * Real markdowns only: a deal without a was-price above the price is dropped at
 * the door — no invented discounts, per the constitution.
 */

import { getDb, type Db } from '../db/client.js';
import { recordVerdicts } from '../engine/discovery.js';

export interface RegularDeal {
  /** Unique per retailer — the dedupe/verify key (SKU, product id, or slug). */
  itemId: string;
  sku?: string | null;
  title: string;
  imageUrl?: string | null;
  productUrl?: string | null;
  /** The selling price now. */
  price: number;
  /** The was-price. Must be strictly greater than `price` or the row is dropped. */
  listPrice: number;
}

const pct = (price: number, list: number) => Math.round(((list - price) / list) * 1000) / 10;

export async function seedRegularDeals(
  db: Db,
  retailer: string,
  source: string,
  deals: RegularDeal[],
): Promise<{ seeded: number; published: number; rejected: number; unreachable: number }> {
  // Keep only real, well-formed markdowns.
  const clean = deals.filter(
    (d) => d.itemId && d.title && d.price > 0 && d.listPrice > d.price,
  );

  let seeded = 0;
  for (const d of clean) {
    await db.query(
      `INSERT INTO discovery
         (retailer, item_id, sku, title, image_url, product_url, source,
          claimed_price, claimed_list, claimed_discount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (retailer, item_id) DO UPDATE SET
         title = EXCLUDED.title, image_url = EXCLUDED.image_url,
         product_url = EXCLUDED.product_url, sku = COALESCE(EXCLUDED.sku, discovery.sku),
         claimed_price = EXCLUDED.claimed_price, claimed_list = EXCLUDED.claimed_list,
         claimed_discount = EXCLUDED.claimed_discount`,
      [
        retailer, d.itemId, d.sku ?? null, d.title, d.imageUrl ?? null,
        d.productUrl ?? null, source, d.price, d.listPrice, pct(d.price, d.listPrice),
      ],
    );
    seeded++;
  }

  // Map item_id -> discovery_id for the verdict pass.
  const items = clean.map((d) => d.itemId);
  const idBy = new Map<string, number>();
  if (items.length > 0) {
    const { rows } = await db.query<{ discovery_id: number; item_id: string }>(
      `SELECT discovery_id, item_id FROM discovery
        WHERE retailer = $1 AND item_id = ANY($2::text[])`,
      [retailer, items],
    );
    for (const r of rows) idBy.set(String(r.item_id), Number(r.discovery_id));
  }

  // The scrape is the truth: record each deal's own price as the verdict, in
  // stock, reachable. The tiered floor (in judge()) decides publish vs reject.
  const verdicts = clean
    .filter((d) => idBy.has(d.itemId))
    .map((d) => ({
      discovery_id: idBy.get(d.itemId)!,
      reachable: true,
      retailer,
      price: d.price,
      list_price: d.listPrice,
      discount_pct: pct(d.price, d.listPrice),
      in_stock: true,
    }));

  const out = await recordVerdicts(db, verdicts);
  return { seeded, published: out.published, rejected: out.rejected, unreachable: out.unreachable };
}

/** CLI helper: `tsx src/ingest/regular-deals.ts <retailer> <source> <deals.json>` */
import { pathToFileURL } from 'node:url';
const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const [retailer, source, file] = process.argv.slice(2);
  if (!retailer || !source || !file) {
    console.error('usage: tsx src/ingest/regular-deals.ts <retailer> <source> <deals.json>');
    process.exit(1);
  }
  const { readFileSync } = await import('node:fs');
  const deals = JSON.parse(readFileSync(file, 'utf8')) as RegularDeal[];
  const db = await getDb();
  const r = await seedRegularDeals(db, retailer, source, deals);
  console.log(`${retailer}: ${JSON.stringify(r)}`);
  await db.close();
}
