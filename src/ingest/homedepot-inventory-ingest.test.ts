/**
 * Phase 0 verification: the HD multi-store harvest.
 *   npx tsx --test src/ingest/homedepot-inventory-ingest.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseHdStoreLocations } from '../vendors/hd-direct.js';

/** A realistic productClientOnlyProduct fulfillment payload: three nearby
 *  stores (one anchor) plus a delivery/online location that MUST be ignored. */
const PAYLOAD = {
  itemId: '312232605',
  fulfillment: {
    fulfillmentOptions: [
      { type: 'delivery', services: [{ type: 'shipping', locations: [
        { type: 'online', inventory: { quantity: 74 } }, // network number — never a shelf
      ] }] },
      { type: 'pickup', services: [{ type: 'bopis', locations: [
        { type: 'store', locationId: '0582', storeName: 'Bitters Rd', isAnchor: true, inventory: { quantity: 2, isInStock: true } },
        { type: 'store', locationId: '6912', storeName: 'Miami (Calle Ocho)', isAnchor: false, inventory: { quantity: 0, isInStock: false } },
        { type: 'store', locationId: '1234', storeName: 'Lander', isAnchor: false, inventory: { quantity: null } },
      ] }] },
    ],
  },
};

test('parseHdStoreLocations keeps EVERY store, not just the anchor', () => {
  const locs = parseHdStoreLocations(PAYLOAD);
  assert.equal(locs.length, 3, 'all three stores kept (the bug kept only 1)');
  const byId = Object.fromEntries(locs.map((l) => [l.storeId, l]));
  assert.deepEqual(Object.keys(byId).sort(), ['1234', '582', '6912'], "'0582' normalizes to '582'");
  assert.equal(byId['582']!.quantity, 2);
  assert.equal(byId['582']!.inStock, true);
  assert.equal(byId['582']!.isAnchor, true);
  assert.equal(byId['6912']!.quantity, 0, 'a real zero is preserved');
  assert.equal(byId['6912']!.inStock, false);
  assert.equal(byId['1234']!.quantity, null, 'unknown stays null, never 0');
});

test('parseHdStoreLocations ignores non-store + empty payloads', () => {
  assert.deepEqual(parseHdStoreLocations(null), []);
  assert.deepEqual(parseHdStoreLocations({}), []);
  assert.ok(parseHdStoreLocations(PAYLOAD).every((l) => l.storeId !== ''), 'the online location never leaks in');
});

test('recordHdStoreInventory persists every store (FK + null-stays-null + idempotent)', async () => {
  process.env.DB_DRIVER = 'pglite';
  process.env.PGLITE_PATH = 'memory://';
  const { getDb } = await import('../db/client.js');
  const { recordHdStoreInventory } = await import('./homedepot-inventory-ingest.js');
  const db = await getDb();
  await db.exec(readFileSync(fileURLToPath(new URL('../db/schema.sql', import.meta.url)), 'utf8'));

  const hits = parseHdStoreLocations(PAYLOAD).map((l) => ({
    itemId: '312232605', storeId: l.storeId, storeName: l.storeName,
    quantity: l.quantity, inStock: l.inStock,
    priceCents: 20800, origPriceCents: 28900, discountPct: 28,
  }));
  const out = await recordHdStoreInventory(db, hits);
  assert.equal(out.stores, 3, 'three stores upserted (FK satisfied)');
  assert.equal(out.inventory, 3, 'three inventory rows written');

  const { rows } = await db.query<{ store_id: string; quantity: number | null; in_stock: boolean | null }>(
    `SELECT store_id, quantity, in_stock FROM store_inventory
      WHERE retailer='homedepot' AND sku='312232605' ORDER BY store_id`);
  assert.equal(rows.length, 3, 'three stores persisted for the one item');
  assert.equal(rows.find((r) => r.store_id === 'homedepot:1234')?.quantity, null, 'null quantity stays null');
  assert.equal(rows.find((r) => r.store_id === 'homedepot:582')?.quantity, 2);

  await recordHdStoreInventory(db, hits); // re-run
  const again = await db.query<{ n: number }>(`SELECT count(*)::int n FROM store_inventory WHERE sku='312232605'`);
  assert.equal(again.rows[0]!.n, 3, 'upsert, not insert-duplicate');
});
