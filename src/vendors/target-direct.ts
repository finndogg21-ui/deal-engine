/**
 * Target, direct from RedSky — the store-level price and the exact shelf count.
 *
 * Two calls per (item, store):
 *   pdp_client_v1          -> price, regular price, and the clearance TYPE
 *   product_fulfillment_v1 -> location_available_to_promise_quantity (exact units)
 *
 * MEASURED 2026-08-23, TCIN 95127459 across five San Antonio stores:
 *
 *   store          price   reg   type        qty  status
 *   176  Bitters    4.00   5.00  clearance    3   LIMITED_STOCK
 *   1354 SA North   4.00   5.00  clearance    2   LIMITED_STOCK
 *   2239 Stone Oak  4.00   5.00  clearance    3   LIMITED_STOCK
 *   2467 Park North 4.00   5.00  clearance    0   OUT_OF_STOCK
 *   2803 Alamo Hts  4.00   5.00  clearance    0   OUT_OF_STOCK
 *
 * Three things that measurement settled, each of which had been guessed wrong:
 *
 *   1. PRICE DID NOT VARY BY STORE. All five read 4.00/5.00. Do not build a
 *      per-store price column; there is no data under it. Only COUNTS varied.
 *   2. THE 403s WERE NOT A BOT BLOCK. A cross-origin `fetch()` defaults to
 *      credentials:'omit', and RedSky answers 403 without cookies and 200 with
 *      them. There is no rate limit at ~1.8s spacing. Any browser-side caller
 *      MUST pass credentials:'include'.
 *   3. `location_name` CAME BACK NULL. Store names must come from our own store
 *      table. Never print a raw store number (product rule).
 *
 * Like Home Depot, Target refuses our SERVER (403 + captcha) and answers a
 * browser, so these helpers build the URLs and parse the payloads while the
 * scheduled browser agent performs the actual fetch. Keeping the URL and parse
 * logic here means the browser path and the server path cannot drift.
 */

/** RedSky's public web key. Not a secret — it ships in Target's own page JS. */
export const REDSKY_KEY = '9f36aeafbe60771e321a7cc95a781407';

const BASE = 'https://redsky.target.com/redsky_aggregations/v1/web';

export interface TargetStoreFact {
  tcin: string;
  storeId: string;
  title: string | null;
  price: number | null;
  regPrice: number | null;
  discountPct: number | null;
  /** True when RedSky labels this a clearance price, not a promo. */
  isClearance: boolean;
  /** Exact units on that store's floor. null = no reading (never "zero"). */
  quantity: number | null;
  availability: string | null;
}

/** Price + clearance type for ONE store. Requires credentials:'include'. */
export function priceUrl(tcin: string, storeId: string): string {
  const q = new URLSearchParams({
    key: REDSKY_KEY,
    tcin,
    is_bot: 'false',
    store_id: storeId,
    pricing_store_id: storeId,
    has_pricing_store_id: 'true',
    channel: 'WEB',
    page: `/p/A-${tcin}`,
  });
  return `${BASE}/pdp_client_v1?${q.toString()}`;
}

/** Exact shelf quantity for ONE store. Requires credentials:'include'. */
export function fulfillmentUrl(
  tcin: string,
  storeId: string,
  geo: { zip: string; state: string; lat: number; lng: number },
): string {
  const q = new URLSearchParams({
    key: REDSKY_KEY,
    tcin,
    store_id: storeId,
    zip: geo.zip,
    state: geo.state,
    latitude: String(geo.lat),
    longitude: String(geo.lng),
    required_store_id: storeId,
    has_required_store_id: 'true',
  });
  return `${BASE}/product_fulfillment_v1?${q.toString()}`;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Parse the two payloads into one fact.
 *
 * Price arrives as `current_retail`/`reg_retail` on some items and
 * `current_retail_min`/`reg_retail_max` on others (the measured TCIN used the
 * min/max pair). Accept both or the price silently reads null.
 */
export function parseTargetFact(
  tcin: string,
  storeId: string,
  priceJson: unknown,
  fulfillmentJson: unknown,
): TargetStoreFact | null {
  const pd = (priceJson as Record<string, any>)?.data?.product;
  if (!pd) return null;

  const p = pd.price ?? {};
  const price = num(p.current_retail) ?? num(p.current_retail_min);
  const regPrice = num(p.reg_retail) ?? num(p.reg_retail_max);

  // RedSky flags clearance in two places; either is sufficient, and neither is
  // a price on its own.
  const isClearance =
    String(p.mixed_current_price_type ?? '').includes('clearance') ||
    String(p.formatted_current_price_type ?? '').includes('clearance');

  const discountPct =
    price !== null && regPrice !== null && regPrice > price
      ? Math.round(((regPrice - price) / regPrice) * 100)
      : 0;

  const so = (fulfillmentJson as Record<string, any>)?.data?.product?.fulfillment
    ?.store_options?.[0];

  return {
    tcin,
    storeId,
    title: typeof pd.item?.product_description?.title === 'string'
      ? pd.item.product_description.title
      : null,
    price,
    regPrice,
    discountPct,
    isClearance,
    // A missing field is NOT zero stock. Zero is a reading; absent is not.
    quantity: so ? num(so.location_available_to_promise_quantity) : null,
    availability:
      typeof so?.in_store_only?.availability_status === 'string'
        ? so.in_store_only.availability_status
        : null,
  };
}
