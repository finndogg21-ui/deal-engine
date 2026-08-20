/**
 * The vendor's async contract, used as intended.
 *
 * `lookupStock` blocks while polling, which cost 3-21s per call. This splits
 * that into the two halves the vendor actually offers:
 *
 *   submit()  -> noWait:true, returns an asyncId in well under a second
 *   collect() -> re-submit the asyncId, returns results or "still working"
 *
 * A worker walks pending rows and calls collect(), so nobody waits on a
 * request thread and a reseller can queue twenty items at once.
 */

import { notWired, isWired } from './contracts.js';
import { withinRadius, type StoreStockRow } from './store-lookup.js';

const ENV = 'APIFY_TOKEN';
const ACTOR = (process.env.STOCK_ACTOR_ID ?? 'maplerope44/home-depot-product-lookup').replace('/', '~');

export const asyncLookupReady = () => isWired(ENV);

async function call(input: Record<string, unknown>): Promise<any[]> {
  if (!asyncLookupReady()) notWired('apify', ENV);
  const res = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${process.env.APIFY_TOKEN}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) },
  );
  if (!res.ok) throw new Error(`stock lookup transport error: HTTP ${res.status} ${res.statusText}`);
  const body = await res.json();
  return Array.isArray(body) ? body : [body];
}

const pending = (r: any) => r && typeof r.asyncId === 'string' && (r.status === 202 || r.status === 206);

/** Hand the job to the vendor and return immediately. */
export async function submit(itemId: string, zip: string): Promise<string> {
  const out = await call({ productId: itemId, zip, noWait: true });
  const first = out[0];
  if (first?.asyncId) return String(first.asyncId);
  // Occasionally it answers straight away; treat that as a job that is done.
  if (first?.status === 200) return '';
  throw new Error(`vendor did not return an asyncId (status ${first?.status ?? 'none'})`);
}

export type CollectResult =
  | { state: 'pending' }
  | { state: 'done'; stores: StoreStockRow[] }
  | { state: 'failed'; message: string; vendorStatus?: number };

/** Ask whether a submitted job has finished. Never blocks or sleeps. */
export async function collect(asyncId: string): Promise<CollectResult> {
  // Documented: when asyncId is set, zip and productId must NOT be.
  const out = await call({ asyncId });
  const first = out[0];

  if (!first) return { state: 'failed', message: 'vendor returned nothing' };
  if (pending(first)) return { state: 'pending' };

  const status = Number(first.status ?? 200);
  if (status !== 200) {
    return {
      state: 'failed',
      vendorStatus: status,
      message:
        status === 429
          ? 'Rate limited by the lookup service.'
          : status === 404
            ? 'Not listed near this ZIP.'
            : `Lookup service error (${status}).`,
    };
  }

  const stores: StoreStockRow[] = [];
  for (const s of Object.values((first.stores ?? {}) as Record<string, any>)) {
    if (!s?.id) continue;
    const product = Object.values(s.products ?? {})[0] as any;
    const cents = product?.salePriceCentsPerUnit ?? product?.priceCentsPerUnit ?? null;
    stores.push({
      storeId: String(s.id),
      storeName: s.name ?? null,
      address: s.address ?? null,
      city: s.city ?? null,
      state: s.state ?? null,
      zip: s.zip ?? null,
      phone: s.phone ?? null,
      distanceMi: typeof s.distance === 'number' ? Math.round(s.distance * 10) / 10 : null,
      quantity: product?.quantityAvailable ?? null,
      vendorPrice: cents === null ? null : Math.round(cents) / 100,
    });
  }
  stores.sort((a, b) => (a.distanceMi ?? 1e9) - (b.distanceMi ?? 1e9));
  // 25-mile radius, applied before the worker writes the row — the cache only
  // ever holds stores that are actually near. See withinRadius for the rule.
  return { state: 'done', stores: withinRadius(stores) };
}
