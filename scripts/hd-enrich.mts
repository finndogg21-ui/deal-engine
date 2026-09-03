/** Fill image_url + title + product_url on HD published rows so no card ships bare.
 *  DB_DRIVER=postgres npx tsx scripts/hd-enrich.mts [pairs.json]
 *  pairs.json (optional): [{item_id, image_url?, title?}] from a browser og:image/og:title fetch.
 *  product_url is filled deterministically (HD /p/{itemId} always resolves) — no fetch needed. */
import { getDb } from '../src/db/client.js';
import { readFileSync } from 'node:fs';

async function main() {
  const db = await getDb();

  // 1) product_url — every HD row that lacks one gets the canonical /p/{itemId}.
  const purl = await db.query(
    `UPDATE discovery SET product_url = 'https://www.homedepot.com/p/' || item_id
       WHERE retailer='homedepot' AND status='published' AND (product_url IS NULL OR product_url='')
     RETURNING 1`);
  console.log(`product_url filled: ${purl.rows.length}`);

  // 2) image_url + title — from the browser og-fetch pairs, if provided.
  const path = process.argv[2];
  if (path) {
    const rows = JSON.parse(readFileSync(path, 'utf8')) as {
      item_id: string; image_url?: string | null; title?: string | null;
    }[];
    let img = 0, ttl = 0;
    for (const r of rows) {
      if (r.image_url) { const x = await db.query(`UPDATE discovery SET image_url=$1 WHERE retailer='homedepot' AND item_id=$2 AND (image_url IS NULL OR image_url='') RETURNING 1`, [r.image_url, String(r.item_id)]); img += x.rows.length; }
      if (r.title) { const x = await db.query(`UPDATE discovery SET title=$1 WHERE retailer='homedepot' AND item_id=$2 AND (title IS NULL OR title='') RETURNING 1`, [r.title, String(r.item_id)]); ttl += x.rows.length; }
    }
    console.log(`image_url filled: ${img}, title filled: ${ttl}`);
  }

  // 3) Report what's still bare (must trend to zero).
  const { rows } = await db.query(
    `SELECT count(*) FILTER (WHERE image_url IS NULL OR image_url='')::int noimg,
            count(*) FILTER (WHERE title IS NULL OR title='')::int notitle,
            count(*) FILTER (WHERE product_url IS NULL OR product_url='')::int nourl
       FROM discovery WHERE retailer='homedepot' AND status='published'`);
  const r = rows[0] as any;
  console.log(`HD still bare -> image:${r.noimg} title:${r.notitle} url:${r.nourl}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
