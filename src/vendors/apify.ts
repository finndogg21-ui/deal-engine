/**
 * ===========================================================
 *  APIFY HOME DEPOT CLEARANCE ADAPTER
 * ===========================================================
 *
 * The daily clearance sweep. This is the only source with a real clock on it:
 * price history cannot be backfilled, so every day this does not run is a day
 * of the moat that is gone.
 *
 * Actor is configured, never hardcoded: APIFY_ACTOR_ID in .env.
 * Mapped against a real run on 2026-08-16 (ZIP 78232, 100 items).
 *
 * Vendor choice is unsettled. Measured that day:
 *   scrapyspider/home-depot-clearance-scraper  16 users, real HD GraphQL data,
 *                                              store-level stock   <- default
 *   pulsewatch/dealwatch-scraper                returned FABRICATED rows
 *                                              ("SAMPLE-SCREWDRIVER") — unusable
 *
 * Neither returns aisle/bay. Unwrangle is the only confirmed source for that.
 */

import { notWired, isWired, type DealEvent } from './contracts.js';
import { normalizeStoreNumber } from '../coverage.js';

const ENV = 'APIFY_TOKEN';

export const apifyReady = () => isWired(ENV);

/** Swapping vendors is a config change, not a code change. */
export const ACTOR_ID = process.env.APIFY_ACTOR_ID ?? 'scrapyspider/home-depot-clearance-scraper';

export interface ApifyOptions {
  zips: string[];
  retailer?: 'homedepot' | 'lowes';
  maxResults?: number;
}

/* ---------------------------------------------------------------------------
 * The vendor's shape. Only the fields actually read are declared; the payload
 * is Home Depot's own GraphQL response and carries far more.
 * ------------------------------------------------------------------------- */

interface HdInventory {
  isInStock?: boolean | null;
  isOutOfStock?: boolean | null;
  isLimitedQuantity?: boolean | null;
  isUnavailable?: boolean | null;
  quantity?: number | null;
}

interface HdLocation {
  locationId?: string | null;
  storeName?: string | null;
  state?: string | null;
  type?: string | null;
  distance?: number | null;
  inventory?: HdInventory | null;
}

export interface HdItem {
  itemId?: string | null;
  isClearanceItem?: boolean | null;
  identifiers?: {
    storeSkuNumber?: string | null;
    itemId?: string | null;
    productLabel?: string | null;
    brandName?: string | null;
    canonicalUrl?: string | null;
    modelNumber?: string | null;
  } | null;
  info?: { categoryHierarchy?: string[] | null } | null;
  media?: { images?: { url?: string | null; subType?: string | null }[] | null } | null;
  pricing?: {
    value?: number | null;
    original?: number | null;
    clearance?: {
      value?: number | null;
      dollarOff?: number | null;
      percentageOff?: number | null;
    } | null;
  } | null;
  availabilityType?: { discontinued?: boolean | null } | null;
  fulfillment?: {
    fulfillmentOptions?: {
      type?: string | null;
      services?: { type?: string | null; locations?: HdLocation[] | null }[] | null;
    }[] | null;
  } | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Home Depot serves image URLs with a literal `<SIZE>` placeholder. Left as-is
 * the browser requests a URL containing angle brackets and renders nothing.
 */
function imageUrl(item: HdItem): string | null {
  const images = item.media?.images ?? [];
  const primary = images.find((i) => i.subType === 'PRIMARY') ?? images[0];
  const url = primary?.url;
  if (!url) return null;
  return url.replace('<SIZE>', '600');
}

/**
 * The real selling price.
 *
 * TRAP: on a clearance item, `pricing.value` and `pricing.original` are BOTH
 * the pre-markdown price, and the actual shelf price lives in
 * `pricing.clearance.value`. Observed 2026-08-16: value 29.98, original 29.98,
 * clearance.value 7.03 — a 77% markdown that reading `value` would miss
 * entirely. Recording the wrong number here does not throw; it silently
 * teaches the scorer that nothing is ever marked down.
 */
function prices(item: HdItem): { price: number | null; listPrice: number | null; discountPct: number | null } {
  const p = item.pricing;
  if (!p) return { price: null, listPrice: null, discountPct: null };

  const clearance = p.clearance;
  const listPrice = p.original ?? p.value ?? null;

  if (clearance?.value !== null && clearance?.value !== undefined) {
    const price = clearance.value;
    const pct = clearance.percentageOff
      ?? (listPrice && listPrice > 0 ? round2(((listPrice - price) / listPrice) * 100) : null);
    return { price: round2(price), listPrice, discountPct: pct };
  }

  const price = p.value ?? null;
  const pct = price !== null && listPrice !== null && listPrice > price && listPrice > 0
    ? round2(((listPrice - price) / listPrice) * 100)
    : null;
  return { price, listPrice, discountPct: pct };
}

/**
 * Store-level stock, deduplicated.
 *
 * One item repeats the same store across pickup and delivery services with
 * different quantities, and includes non-store locations (fulfillment centres
 * come back with a null `storeName`). Taking the first match would record a
 * warehouse's stock as a store's.
 */
function storeRows(item: HdItem): HdLocation[] {
  const out = new Map<string, HdLocation>();

  for (const option of item.fulfillment?.fulfillmentOptions ?? []) {
    for (const service of option.services ?? []) {
      for (const loc of service.locations ?? []) {
        const id = loc.locationId;
        if (!id) continue;

        /**
         * Select on LOCATION type, not fulfilment type.
         *
         * Home Depot reports the same store twice with different meanings:
         *   locType "store"  (bopis, express delivery) = units in that building
         *   locType "online" (boss, sth)               = network stock that
         *                                                could be SHIPPED there
         *
         * Measured 2026-08-16: store 582 reported quantity 74 via boss and 8
         * via express delivery for the same SKU. Only 8 are on the shelf.
         * Treating boss as shelf stock sends someone on a wasted drive and
         * feeds a false scarcity signal into the penny score, which is one of
         * the four things that score is made of.
         */
        if (loc.type !== 'store' || !loc.storeName) continue;

        const prev = out.get(id);
        // Same store from two services: keep the smaller, more conservative count.
        if (!prev || (loc.inventory?.quantity ?? 0) < (prev.inventory?.quantity ?? 0)) {
          out.set(id, loc);
        }
      }
    }
  }
  return [...out.values()];
}

function availabilityOf(inv: HdInventory | null | undefined, discontinued: boolean): DealEvent['availability'] {
  if (discontinued) return 'unavailable';
  if (inv?.isUnavailable) return 'unavailable';
  if (inv?.isOutOfStock) return 'out_of_stock';
  if (inv?.isInStock) return 'in_stock';
  return 'unknown';
}

/**
 * One vendor item becomes one DealEvent PER STORE.
 *
 * The unit of the whole product is (product, store): a penny item is a fact
 * about one shelf in one building, not about a SKU nationally.
 */
export function toDealEvents(item: HdItem, observedAt: Date, retailer = 'homedepot'): DealEvent[] {
  const ids = item.identifiers;
  const sku = ids?.storeSkuNumber ?? ids?.itemId ?? item.itemId;
  if (!sku) return [];

  const { price, listPrice, discountPct } = prices(item);
  const categories = item.info?.categoryHierarchy ?? [];
  const discontinued = Boolean(item.availabilityType?.discontinued);
  const canonical = ids?.canonicalUrl ?? null;

  const base = {
    retailer,
    sku: String(sku),
    // Kept alongside the SKU because the two differ and stock lookups need this one.
    itemId: ids?.itemId ?? item.itemId ?? null,
    title: ids?.productLabel ?? '',
    brand: ids?.brandName ?? null,
    // Deepest category is the useful one — "Under Cabinet Strip Lights"
    // matches a shopper's word far better than "Lighting".
    category: categories.length > 0 ? categories[categories.length - 1]! : null,
    imageUrl: imageUrl(item),
    productUrl: canonical ? `https://www.homedepot.com${canonical}` : null,
    price,
    listPrice,
    discountPct,
    observedAt,
    // Aisle/bay is not in this payload from any Apify actor checked.
    aisleBay: null,
  };

  const stores = storeRows(item);

  // No store breakdown still records the price. Losing an observation because
  // stock was missing would put a hole in history that cannot be refilled.
  if (stores.length === 0) {
    return [{
      ...base,
      storeNumber: null,
      storeName: null,
      zip: null,
      lat: null,
      lng: null,
      stockQty: null,
      availability: availabilityOf(null, discontinued),
      raw: item,
    }];
  }

  return stores.map((loc) => ({
    ...base,
    // "0582" and "582" are the same building. Without this they become two
    // rows and the shelf count is split across them.
    storeNumber: loc.locationId ? normalizeStoreNumber(loc.locationId) : null,
    storeName: loc.storeName ?? null,
    zip: null,
    lat: null,
    lng: null,
    stockQty: loc.inventory?.quantity ?? null,
    // Miles from the ZIP we queried, which is the only positional information
    // Home Depot returns — there are no coordinates anywhere in the payload.
    distanceMi: typeof loc.distance === 'number' ? loc.distance : null,
    availability: availabilityOf(loc.inventory, discontinued),
    // Untouched vendor payload, so a mapping fix can be replayed over history.
    raw: item,
  }));
}

/* ---------------------------------------------------------------------------
 * Apify run
 * ------------------------------------------------------------------------- */

const API = 'https://api.apify.com/v2';

/** Actor ids use a tilde in API paths, a slash in the UI. */
const actorPath = (id: string) => id.replace('/', '~');

export async function fetchDeals(opts: ApifyOptions): Promise<DealEvent[]> {
  if (!apifyReady()) notWired('apify', ENV);

  const token = process.env.APIFY_TOKEN!;
  const maxResults = opts.maxResults ?? Number(process.env.APIFY_MAX_RESULTS ?? 100);
  const observedAt = new Date();
  const events: DealEvent[] = [];

  // One run per ZIP: the actor takes a single zipcode, and per-ZIP runs mean
  // one blocked ZIP cannot take down the rest of the sweep.
  for (const zip of opts.zips) {
    const res = await fetch(
      `${API}/acts/${actorPath(ACTOR_ID)}/run-sync-get-dataset-items?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zipcode: zip, maxResults, parallelRequests: 3 }),
      },
    );

    if (!res.ok) {
      throw new Error(
        `Apify run failed for ZIP ${zip}: ${res.status} ${res.statusText}. ` +
        `Actor ${ACTOR_ID}.`,
      );
    }

    const items = (await res.json()) as HdItem[];
    if (!Array.isArray(items)) {
      throw new Error(`Apify returned a non-array payload for ZIP ${zip}.`);
    }

    for (const item of items) {
      for (const e of toDealEvents(item, observedAt, opts.retailer ?? 'homedepot')) {
        events.push({ ...e, zip });
      }
    }
  }

  return events;
}
