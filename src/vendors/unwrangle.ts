/**
 * ===========================================================
 *  UNWRANGLE STORE-STOCK LOOKUP GOES HERE
 * ===========================================================
 *
 * Stage two of the funnel. Only called for SKUs that already went delisted
 * after deep discount, and only in ZIPs we care about. Calling this per SKU
 * per store across the country is the version that costs a thousand a day.
 *
 * Confirmed fields on their Home Depot API (checked 2026-08-15):
 *   images[], inventory_quantity, aisle_bay,
 *   inventory.status.discontinued, inventory.status.limited_quantity
 *
 * WARNING: store_no and store_name are DEPRECATED. Use
 *   fulfillment_options.services.locations.store_id
 *   fulfillment_options.services.locations.store_name
 *
 * Unconfirmed: whether per-store stock exists for Lowe's, Walmart, Target.
 * That answer decides which retailers can do in-store hunting at all.
 */

import { notWired, isWired, type StoreStock } from './contracts.js';

const ENV = 'UNWRANGLE_KEY';

export const unwrangleReady = () => isWired(ENV);

export async function stockForSku(
  _retailer: string, _sku: string, _zip: string,
): Promise<StoreStock[]> {
  if (!unwrangleReady()) notWired('unwrangle', ENV);

  // ---- UNWRANGLE LOOKUP GOES HERE ----
  // Map fulfillment_options.services.locations[] -> StoreStock[]
  notWired('unwrangle', ENV);
}
