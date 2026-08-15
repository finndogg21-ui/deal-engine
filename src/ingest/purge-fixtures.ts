/**
 * Removes every trace of fixture data.
 *
 *   npm run purge
 *
 * Fixtures were written with source='fixture' precisely so this is a clean
 * delete. Real scan data is never touched.
 */

import { getDb } from '../db/client.js';
import { pathToFileURL } from 'node:url';

export async function purgeFixtures() {
  const db = await getDb();

  // Order matters: children before parents.
  const obs = await db.query(`DELETE FROM price_observations WHERE source = 'fixture'`);
  const runs = await db.query(`DELETE FROM scan_runs WHERE source = 'fixture'`);

  // finds / sku_state referencing products that now have no observations left
  const finds = await db.query(
    `DELETE FROM finds WHERE product_id NOT IN (SELECT DISTINCT product_id FROM price_observations)`,
  );
  const state = await db.query(
    `DELETE FROM sku_state WHERE product_id NOT IN (SELECT DISTINCT product_id FROM price_observations)`,
  );
  const products = await db.query(
    `DELETE FROM products WHERE product_id NOT IN (SELECT DISTINCT product_id FROM price_observations)`,
  );
  const stores = await db.query(
    `DELETE FROM stores WHERE store_id NOT IN (SELECT DISTINCT store_id FROM price_observations WHERE store_id IS NOT NULL)`,
  );

  return {
    observations: obs.rowCount,
    runs: runs.rowCount,
    finds: finds.rowCount,
    sku_state: state.rowCount,
    products: products.rowCount,
    stores: stores.rowCount,
  };
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  purgeFixtures()
    .then(async (r) => {
      console.log('purged:', r);
      const db = await getDb();
      await db.close();
    })
    .catch((err) => {
      console.error('purge failed:', err);
      process.exit(1);
    });
}
