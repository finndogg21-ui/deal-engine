/**
 * Lowe's, direct from the site's own product feed.
 *
 * Measured in-browser 2026-08-23. Everything here was read off real responses.
 *
 * TWO ENDPOINTS, BOTH FREE, BOTH BROWSER-ONLY:
 *
 *   discovery  GET /pl/Clearance/4294857977?offset=N
 *              "The Back Aisle" — Lowe's own clearance browse. Serves 24 items
 *              per page with price AND stock inline in the HTML, so one fetch
 *              yields a full page of candidates with no follow-up calls.
 *
 *   detail     GET /wpd/{itemNumber}/productdetail/{storeNumber}/Guest/{zip}
 *              ~30KB JSON per item. Only needed for fields the list omits.
 *
 * A server-side request with a normal User-Agent gets 403 (verified), same as
 * Home Depot's 206 and Target's 403 + captcha. The browser agent does the
 * fetching; this module owns the URLs and the parsing.
 *
 * ── THE THING THAT DECIDES HOW WE LABEL THESE ─────────────────────────────
 *
 * Every markdown carries an EXPIRY:
 *
 *     "savings": { "totalPercentage": 30, "endDateTime": "2026-08-26T23:59:00" }
 *
 * A dated was/now is a TEMPORARY SALE, not the permanent in-store clearance
 * this product is named after. Home Depot's `pricing.clearance` has no Lowe's
 * equivalent that we could find. So Lowe's rows are published as markdowns
 * with an end date and never as clearance — calling a two-week promo a
 * clearance find would be the same lie as inventing a price.
 *
 * ── WHAT WE DELIBERATELY DO NOT USE ───────────────────────────────────────
 *
 * The payload also carries `itemInventory.pickupQuantity` and
 * `productLocation: {aisle, bay}` — which would be the best in-store data of
 * any retailer we have, since neither HD nor Target publishes an aisle.
 *
 * IT IS NOT USED, because it did not survive testing. The same item returned
 * qty 5 / aisle 14 / bay 12 at four stores in four states, by URL path AND by
 * `sn` cookie, while storeName changed correctly. A diff of the clearance list
 * across two stores found 23 shared items with ZERO differing in quantity and
 * ZERO in price. Identical aisle numbers nationwide is not real per-store
 * data, and shipping it would repeat the "138 in stock" fabrication.
 *
 * Revisit only when an item is found that is genuinely priced differently at
 * two stores. Until then Lowe's is treated as CHAIN-WIDE, like Target.
 */

import { meetsTieredFloor } from '../engine/deal-floor.js';

const ORIGIN = 'https://www.lowes.com';

/**
 * THE REAL BACK AISLE — Lowe's site-wide clearance browse.
 *
 * Found on Lowe's own /l/savings landing, verified by its title tag
 * ("The Back Aisle at Lowes.com") and a genuinely mixed category spread:
 * DeWalt saws, microwaves, vinyl fencing, Trex decking, Pergo flooring,
 * lumber. 24 items per page with price inline in the HTML.
 *
 * TRAP, paid for once already: /pl/Clearance/4294857977 also returns 200 and
 * has "Clearance" in the path, but the path text is COSMETIC — the numeric id
 * routes, and 4294857977 is "Washing Machines for Front & Top Load Laundry".
 * A 20-page sweep of it returned 62 washers out of 63 hits. Verify a Lowe's
 * list by its <title>, never by its path.
 */
export const CLEARANCE_PATH = '/pl/The-back-aisle/2021454685607';

/**
 * The OTHER deal lists Lowe's exposes on /l/savings (verified 2026-08-25).
 * Category-scoped, so sweeping them alongside the Back Aisle gives spread a
 * single list cannot. Every one goes through the same parser and the same
 * units guard in lowes-ingest.
 */
export const DEAL_LISTS: Array<{ path: string; label: string }> = [
  { path: '/pl/The-back-aisle/2021454685607', label: 'back-aisle' },
  { path: '/pl/Deals/1611079983848', label: 'deals' },
  { path: '/pl/Deals-on-tools-and-outdoor-power-equipment/3411464183736', label: 'tools' },
  { path: '/pl/Lighting-deals/2590540003', label: 'lighting' },
  { path: '/pl/Major-appliance-special-values/2920130986014', label: 'appliances' },
  { path: '/pl/Deals-on-select-patio-furniture/3021376198016', label: 'patio' },
  { path: '/pl/SHOP-BATHROOM-DEALS/2220627017920', label: 'bathroom' },
];
export const PAGE_SIZE = 24;

/** Lowe's default pricing store. Chain-wide pricing makes the choice cosmetic. */
export const DEFAULT_STORE = '1155';

export interface LowesHit {
  itemNumber: string;
  title: string;
  brand: string | null;
  /** What you pay. */
  price: number | null;
  /** The was-price. */
  listPrice: number | null;
  discountPct: number | null;
  /** When the markdown ends. This is why these are sales, not clearance. */
  endsAt: string | null;
  imageUrl: string | null;
  productUrl: string;
}

export function clearanceUrl(offset = 0): string {
  return `${ORIGIN}${CLEARANCE_PATH}?offset=${offset}`;
}

export function detailUrl(itemNumber: string, storeNumber = DEFAULT_STORE, zip = '78232'): string {
  return `${ORIGIN}/wpd/${itemNumber}/productdetail/${storeNumber}/Guest/${zip}`;
}

/**
 * Lowe's slugs hyphenate both words AND decimals, so "3-5-cu-ft" means
 * "3.5 cu ft". Rejoin digits that sit either side of a unit word.
 */
function titleFromSlug(slug: string): string {
  return decodeURIComponent(slug)
    .replace(/-/g, ' ')
    .replace(/(\d)\s+(\d)(?=\s*(cu|in|ft|oz|lb|qt|gal|amp|volt|watt|hp))/gi, '$1.$2')
    .replace(/\s+While Supplies Last\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Pull floor-clearing hits out of one clearance page's HTML.
 *
 * The item objects are embedded in the served HTML rather than fetched, so we
 * slice around each product id and read the fields that sit beside it. Regex
 * over HTML is ugly; it is also the only option when the payload is not exposed
 * as a parseable global (`__PRELOADED_STATE__` is NOT present — verified).
 */
export function parseClearancePage(html: string): { hits: LowesHit[]; seen: number } {
  const hits: LowesHit[] = [];

  /**
   * ANCHOR ON `finalPrice`, NOT ON THE PRODUCT LINK.
   *
   * The obvious approach — find /pd/ links and read the price beside them —
   * silently yields nothing. The /pd/ hrefs near the top of the document are
   * NAVIGATION (offset ~5k); the product data blob does not start until
   * ~417k, and the two never sit near each other. A parser built that way
   * returns 0 hits from 96 products and looks like "no deals today" rather
   * than a bug.
   *
   * `finalPrice` occurs exactly once per product (24 per page, verified), so
   * it is the reliable anchor. The item number sits BEHIND it in the same
   * object; the savings fields sit ahead of it.
   */
  const priceRe = /"finalPrice"\s*:\s*([0-9.]+)/g;
  let m: RegExpExecArray | null;
  let seen = 0;

  while ((m = priceRe.exec(html)) !== null) {
    seen++;
    const fwd = html.slice(m.index, m.index + 2500);
    const back = html.slice(Math.max(0, m.index - 4000), m.index);

    const final = num(m[1]);
    const base = num(fwd.match(/"basePrice"\s*:\s*([0-9.]+)/)?.[1] ??
                     back.match(/"basePrice"\s*:\s*([0-9.]+)/)?.[1]);
    const pctRaw = num(fwd.match(/"totalPercentage"\s*:\s*([0-9.]+)/)?.[1]);
    const ends = fwd.match(/"endDateTime"\s*:\s*"([^"]+)"/)?.[1] ?? null;

    /**
     * THE ID MUST BE THE 10-DIGIT ONE FROM THE /pd/ LINK.
     *
     * Lowe's carries two id formats and only one works. The `itemNumber`
     * beside the price is 7 digits (5684052) and returns **404** from the
     * detail endpoint. The usable product id is 10 digits (1000064061) and
     * lives in the /pd/ link that precedes each price by ~1,500 chars inside
     * the data blob — verified 200 against the detail endpoint.
     *
     * The link also carries the product SLUG, which is the human title. That
     * removes the per-item enrichment call entirely: one page fetch yields id,
     * price, percentage, expiry AND name for 24 products.
     */
    const link = [...back.matchAll(/\/pd\/([^"'\\]{0,140}?)\/(\d{10})/g)].pop();
    if (!link || base === null || final === null || final >= base) continue;

    const pct = pctRaw ?? Math.round(((base - final) / base) * 100);
    if (!meetsTieredFloor(final, pct)) continue;

    const slug = link[1] ?? '';
    hits.push({
      itemNumber: link[2]!,
      title: titleFromSlug(slug),
      brand: null,
      price: final,
      listPrice: base,
      discountPct: pct,
      endsAt: ends,
      imageUrl: null,
      productUrl: `${ORIGIN}/pd/${slug}/${link[2]}`,
    });
  }

  return { hits, seen };
}

/** Parse the per-item detail payload. Price only — see the header on stock. */
export function parseDetail(json: unknown, itemNumber: string) {
  const node = (json as Record<string, any>)?.productDetails?.[itemNumber];
  const row = node?.location?.price?.pricingDataList?.[0];
  if (!row) return null;

  const base = num(row.basePrice);
  const final = num(row.finalPrice);
  return {
    itemNumber,
    price: final,
    listPrice: base,
    discountPct:
      num(row.savings?.totalPercentage) ??
      (base !== null && final !== null && base > final
        ? Math.round(((base - final) / base) * 100)
        : 0),
    endsAt: (row.savings?.endDateTime as string) ?? null,
    /** "WAS" = marked down, "REGULAR" = full price. */
    isMarkdown: row.displayType === 'WAS',
    storeName: (json as Record<string, any>)?.storeDetails?.storeName ?? null,
  };
}
