/**
 * ===========================================================
 *  ON-DEMAND STORE STOCK LOOKUP
 * ===========================================================
 *
 * Backs the "Find Stock" button. The sweep tells you WHAT is marked down;
 * this tells you whether it is on a shelf near a particular person.
 *
 * Why on-demand rather than scanned: scanning every ZIP daily costs money
 * proportional to the catalogue, forever, whether or not anyone looks. This
 * costs money proportional to user actions, which is both cheaper and a
 * natural place to put plan limits.
 *
 * Verified against the live actor on 2026-08-16:
 *   - ASYNC: first call returns { asyncId, status: 202|206 }; you re-submit
 *     the asyncId to collect. Sending zip/productId alongside asyncId is
 *     documented as invalid.
 *   - Returns ONE store — the nearest to that ZIP — not a list. "Your closest
 *     store has 4", not "here are five stores".
 *   - Carries address, city, state, zip, phone, distance, hours. That is
 *     store location data the sweep never provides.
 *   - Does NOT see clearance pricing: reported $29.98 for an item the sweep
 *     knows is $7.03 at 77% off. Treat price here as unreliable and keep the
 *     sweep as the source of truth for price.
 *   - Some ZIPs 500 consistently. 78232 failed three times while 78216 and
 *     10918 succeeded on the same product. Callers must handle that, not
 *     assume a spinner will resolve.
 */

import { notWired, isWired } from './contracts.js';

const ENV = 'APIFY_TOKEN';

export const stockLookupReady = () => isWired(ENV);

const ACTOR = (process.env.STOCK_ACTOR_ID ?? 'maplerope44/home-depot-product-lookup').replace('/', '~');

export interface StoreStockRow {
  storeId: string;
  storeName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  distanceMi: number | null;
  quantity: number | null;
  /** Vendor's price. Blind to clearance — never overwrite the sweep's price. */
  vendorPrice: number | null;
}

export interface StockLookupResult {
  stores: StoreStockRow[];
  /** True when the vendor answered but knows nothing about this SKU there. */
  empty: boolean;
}

/**
 * Product rule: a store more than 25 miles out is not "near you". Applied at
 * normalization — before anything is written to stock_lookups — so every
 * cached JSONB row is already radius-clean and no reader re-asks the question.
 *
 * A null distance means "the vendor did not say", which is a different claim
 * from "too far". Those stores are dropped only when at least one store DID
 * match the radius (next to a known-close store they are just noise); when
 * nothing matched, they are kept, because "no store within 25 miles" is not
 * something we can assert about a store whose distance we never learned.
 */
export const STOCK_RADIUS_MI = 25;

export function withinRadius(stores: StoreStockRow[]): StoreStockRow[] {
  const near = stores.filter((s) => s.distanceMi !== null && s.distanceMi <= STOCK_RADIUS_MI);
  if (near.length > 0) return near;
  return stores.filter((s) => s.distanceMi === null);
}

interface RawStore {
  id?: string | number | null;
  name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  phone?: string | null;
  distance?: number | null;
  products?: Record<string, {
    quantityAvailable?: number | null;
    priceCentsPerUnit?: number | null;
    salePriceCentsPerUnit?: number | null;
  }> | null;
}

/**
 * Measured 2026-08-18: identical requests resolved anywhere from 3s to 21s.
 * The wait was almost entirely our own sleep, not the vendor — a job ready
 * after 6s still cost 10s at a 5s interval. Short interval, more attempts,
 * same ceiling.
 */
const POLL_MS = Number(process.env.STOCK_POLL_MS ?? 1200);
const MAX_POLLS = Number(process.env.STOCK_MAX_POLLS ?? 25);

async function call(token: string, input: Record<string, unknown>): Promise<any[]> {
  const res = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) {
    throw new Error(`stock lookup transport error: HTTP ${res.status} ${res.statusText}`);
  }
  const body = await res.json();
  return Array.isArray(body) ? body : [body];
}

const isPending = (r: any) =>
  r && typeof r.asyncId === 'string' && (r.status === 202 || r.status === 206);

/**
 * @param productId retailer SKU / item id
 * @param zip       5-digit US ZIP to search around
 */
export async function lookupStock(productId: string, zip: string): Promise<StockLookupResult> {
  if (!stockLookupReady()) notWired('apify', ENV);
  const token = process.env.APIFY_TOKEN!;

  // Only the two documented fields on the opening call.
  let out = await call(token, { productId, zip });

  for (let i = 0; i < MAX_POLLS && out.length === 1 && isPending(out[0]); i++) {
    const asyncId = out[0].asyncId;
    await new Promise((r) => setTimeout(r, POLL_MS));
    // Documented: when asyncId is set, zip and productId must NOT be.
    out = await call(token, { asyncId });
  }

  const first = out[0];

  if (!first) throw new Error('stock lookup returned nothing');
  if (isPending(first)) throw new Error('stock lookup still pending after polling');

  if (first.status && first.status !== 200) {
    /**
     * Say what actually went wrong. An earlier version reported every failure
     * as "some ZIPs fail at this vendor", which sent us chasing a ZIP bug for
     * an hour when the real answer was a 429 from our own test traffic.
     * A wrong diagnosis in an error message costs more than no message.
     */
    const status = Number(first.status);
    const err = new Error(
      status === 429
        ? 'Too many stock checks in a short time. The lookup service is rate limiting us — wait a minute and try again.'
        : status === 404
          ? 'That product is not listed near this ZIP.'
          : status >= 500
            ? `The lookup service returned an error (${status}). This is usually temporary.`
            : `Stock lookup failed (status ${status}).`,
    );
    (err as Error & { vendorStatus?: number }).vendorStatus = status;
    throw err;
  }

  const rawStores = Object.values((first.stores ?? {}) as Record<string, RawStore>);
  const stores: StoreStockRow[] = [];

  for (const s of rawStores) {
    const product = Object.entries(s.products ?? {}).find(([pid]) => pid === productId)?.[1]
      ?? Object.values(s.products ?? {})[0];
    if (!s.id) continue;

    const cents = product?.salePriceCentsPerUnit ?? product?.priceCentsPerUnit ?? null;
    stores.push({
      storeId: String(s.id),
      storeName: s.name ?? null,
      address: s.address ?? null,
      city: s.city ?? null,
      state: s.state ?? null,
      zip: s.zip ?? null,
      phone: s.phone ?? null,
      // Comes back with absurd precision (2.113547014213912).
      distanceMi: typeof s.distance === 'number' ? Math.round(s.distance * 10) / 10 : null,
      quantity: product?.quantityAvailable ?? null,
      vendorPrice: cents === null ? null : Math.round(cents) / 100,
    });
  }

  stores.sort((a, b) => (a.distanceMi ?? 1e9) - (b.distanceMi ?? 1e9));
  const near = withinRadius(stores);
  return { stores: near, empty: near.length === 0 };
}
