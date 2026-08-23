/**
 * Target clearance DISCOVERY — the free firehose.
 *
 * This is the piece Home Depot never gave us. HD's `searchModel` was never
 * cracked, so HD discovery still rides a paid Apify sweep. Target publishes its
 * entire clearance category through the same public RedSky endpoint the website
 * uses, and it costs nothing:
 *
 *   MEASURED 2026-08-23 — category 5q0ga returned total_results 3666.
 *   A 50-page sweep (1,200 items) yielded 174 clearing the tiered floor.
 *
 * HOW THE CATEGORY ID WAS FOUND (worth recording — it is not documented):
 * a keyword search for "clearance" fails with a sponsored-search backend error,
 * but the failure body still carries the redirect metadata, which names the
 * category: `/c/clearance/-/N-5q0ga`. Passing `category=5q0ga` with
 * `include_sponsored=false` returns clean results.
 *
 * TWO RULES FOR ANY CALLER, both learned the hard way:
 *
 *   1. `credentials: 'include'`. A plain cross-origin fetch() defaults to
 *      omitting cookies and RedSky answers 403. With cookies it answers 200.
 *      An earlier read of those 403s as a "durable bot block" was simply wrong
 *      — there is no rate limit at ~600ms spacing.
 *   2. `include_sponsored=false`, or the whole response fails on the sponsored
 *      backend even though the organic products would have been fine.
 *
 * Target refuses our SERVER (403 + captcha), so the fetching happens in the
 * browser agent. This module owns the URL and the parse so the browser half
 * stays a thin loop that cannot invent a number.
 */

import { REDSKY_KEY } from './target-direct.js';
import { meetsTieredFloor } from '../engine/deal-floor.js';

/** Target's site-wide clearance category. See the header for how this was found. */
export const CLEARANCE_CATEGORY = '5q0ga';

const BASE = 'https://redsky.target.com/redsky_aggregations/v1/web';

/** Results per page. Target's own PLP uses 24; larger values are not honored. */
export const PAGE_SIZE = 24;

export interface SweepHit {
  tcin: string;
  title: string;
  /** Current (clearance) price at the pricing store. */
  cur: number | null;
  /** Regular price, for the "was" line. */
  reg: number | null;
  pct: number | null;
  url: string;
  img: string | null;
}

/**
 * One page of the clearance category, priced for a specific store.
 *
 * `storeId` matters: clearance is a per-store fact, so the same TCIN can carry
 * a different price at a different building.
 */
export function searchUrl(offset: number, storeId: string, zip: string): string {
  const q = new URLSearchParams({
    key: REDSKY_KEY,
    category: CLEARANCE_CATEGORY,
    channel: 'WEB',
    count: String(PAGE_SIZE),
    default_purchasability_filter: 'true',
    // Non-negotiable: true makes the sponsored backend fail the whole response.
    include_sponsored: 'false',
    offset: String(offset),
    page: `/c/${CLEARANCE_CATEGORY}`,
    platform: 'desktop',
    pricing_store_id: storeId,
    store_ids: storeId,
    visitor_id: '0193ABCDEF',
    zip,
  });
  return `${BASE}/plp_search_v2?${q.toString()}`;
}

/** Target HTML-escapes titles in this payload; undo it rather than shipping "&#39;". */
export function decodeTitle(s: unknown): string {
  return String(s ?? '')
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Turn one search page into floor-clearing hits.
 *
 * Applies the SAME tiered floor the rest of the product uses, so a 20%-off tee
 * never reaches the pool just because it is technically on clearance. Anything
 * Target does not explicitly flag as clearance is dropped: a plain promo is not
 * the in-store markdown this product is about.
 */
export function parseSearchPage(json: unknown): { hits: SweepHit[]; seen: number; total: number | null } {
  const search = (json as Record<string, any>)?.data?.search;
  const products = (search?.products ?? []) as Array<Record<string, any>>;
  const total =
    num(search?.search_response?.metadata?.total_results) ?? num(search?.metadata?.total_results);

  const hits: SweepHit[] = [];
  for (const p of products) {
    const price = p.price ?? {};
    const cur = num(price.current_retail) ?? num(price.current_retail_min);
    const reg = num(price.reg_retail) ?? num(price.reg_retail_max);
    if (cur === null || reg === null || reg <= cur) continue;

    const isClearance =
      String(price.formatted_current_price_type ?? '').includes('clearance') ||
      String(price.mixed_current_price_type ?? '').includes('clearance');
    if (!isClearance) continue;

    const pct = Math.round(((reg - cur) / reg) * 100);
    if (!meetsTieredFloor(cur, pct)) continue;

    const imageName = p.item?.enrichment?.image_info?.primary_image?.image_name;

    hits.push({
      tcin: String(p.tcin),
      title: decodeTitle(p.item?.product_description?.title),
      cur,
      reg,
      pct,
      // /p/-/A-<tcin> resolves without the slug, so no need to carry buy_url.
      url: `https://www.target.com/p/-/A-${String(p.tcin)}`,
      img: imageName ? `https://target.scene7.com/is/image/Target/${String(imageName)}` : null,
    });
  }

  return { hits, seen: products.length, total };
}
