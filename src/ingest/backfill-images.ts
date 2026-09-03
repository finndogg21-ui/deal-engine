/**
 * IMAGE BACKFILL — set image_url on published discovery rows that came in null.
 *
 * Some scrapers don't capture a product image (Lowe's Back Aisle sweep hardcodes
 * imageUrl: null; the Home Depot browse verify and the Staples ingest never
 * grabbed one). Those rows publish with a blank card. This takes a JSON array of
 * { retailer, item_id, image_url } — collected by fetching each product page's
 * real image in a genuine browser session — and fills ONLY the still-empty ones,
 * so a real image already on the row is never overwritten.
 *
 *   DB_DRIVER=postgres npx tsx src/ingest/backfill-images.ts pairs.json
 */
import { readFileSync } from 'node:fs';
import { getDb } from '../db/client.js';

interface Pair {
  retailer: string;
  item_id: string;
  image_url: string;
}

async function main() {
  const [path] = process.argv.slice(2);
  if (!path) {
    console.error('usage: backfill-images.ts <pairs.json>');
    process.exit(1);
  }
  const pairs = JSON.parse(readFileSync(path, 'utf8')) as Pair[];
  const db = await getDb();

  let updated = 0;
  const byRetailer: Record<string, number> = {};
  const skipped: string[] = [];

  for (const p of pairs) {
    if (!p.image_url || !p.retailer || !p.item_id) {
      skipped.push(`${p.retailer}/${p.item_id} (missing field)`);
      continue;
    }
    // Only fill genuinely empty images — never overwrite a real one.
    const { rows } = await db.query<{ item_id: string }>(
      `UPDATE discovery
          SET image_url = $1
        WHERE retailer = $2 AND item_id = $3
          AND (image_url IS NULL OR image_url = '')
      RETURNING item_id`,
      [p.image_url, p.retailer, p.item_id],
    );
    const n = rows.length;
    updated += n;
    byRetailer[p.retailer] = (byRetailer[p.retailer] ?? 0) + n;
    if (n === 0) skipped.push(`${p.retailer}/${p.item_id} (no empty row matched)`);
  }

  console.log('image backfill —', updated, 'rows updated', JSON.stringify(byRetailer));
  if (skipped.length) console.log('  not updated:', skipped.join(', '));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
