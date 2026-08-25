/**
 * Best Buy, through its OFFICIAL Products API — the only retailer we carry
 * that hands out a real key instead of making us crack a site.
 *
 *   discovery  GET https://api.bestbuy.com/v1/products(<query>)
 *              ?apiKey=…&format=json&pageSize=100&cursorMark=…
 *
 * Free key from developer.bestbuy.com, 5 req/s, 50k calls/day. Because this
 * is a sanctioned API there is no Akamai, no browser handoff, no proxies —
 * this module fetches server-side, unlike every other retailer's sweep.
 *
 * The sweep asks one combined question:
 *
 *   clearance=true  OR  (onSale=true AND percentSavings >= floor)
 *
 * because Best Buy's own clearance flag misses deep percentage cuts, and the
 * percentage filter misses flagged clearance sitting at shallow discounts —
 * the same lesson as Home Depot's isClearanceItem coming back FALSE on a
 * $260.03 final-markdown item.
 *
 * ── WHAT WE DELIBERATELY DO NOT CLAIM ─────────────────────────────────────
 *
 * - Per-store stock. Best Buy retired store-level availability from the API
 *   years ago; `inStoreAvailability` is a national boolean, not a shelf
 *   count. store_id and quantity stay null and the ledger stays empty.
 * - Open-box offers. That is a separate beta feed we have not wired; nothing
 *   here implies open-box condition or pricing.
 *
 * First-party is free here: everything the Products API returns is sold by
 * Best Buy itself, so the marketplace-seller guard the Walmart module needs
 * has nothing to catch — but the >90% data-error ceiling still applies.
 */

import { meetsTieredFloor } from '../engine/deal-floor.js';

const API = 'https://api.bestbuy.com/v1';

const ENV = 'BESTBUY_API_KEY';

export const bestbuyReady = () => Boolean(process.env[ENV]?.trim());

/** Discount floor for the onSale side of the sweep. The cost dial: lower it
 *  and the page count (and daily quota burn) grows fast. */
const minSavingsPct = () => Number(process.env.BESTBUY_MIN_SAVINGS_PCT ?? 50);

/** Hard page cap per run. 100 items/page; 10 pages = 1,000 candidates. */
const maxPages = () => Number(process.env.BESTBUY_MAX_PAGES ?? 10);

export interface BestBuyHit {
  sku: string;
  upc: string | null;
  title: string;
  brand: string | null;
  /** Deepest category name — "Robot Vacuums", not "Appliances". */
  category: string | null;
  price: number | null;
  listPrice: number | null;
  discountPct: number | null;
  /** Best Buy's own flags, kept so the audit trail shows which gate matched. */
  clearance: boolean;
  onSale: boolean;
  imageUrl: string | null;
  productUrl: string;
  /** National boolean, never a shelf count. */
  onlineAvailability: boolean;
}

/* ---------------------------------------------------------------------------
 * The vendor's shape. Only the fields actually read are declared.
 * ------------------------------------------------------------------------- */

interface BbProduct {
  sku?: number | string | null;
  upc?: string | null;
  name?: string | null;
  manufacturer?: string | null;
  salePrice?: number | null;
  regularPrice?: number | null;
  percentSavings?: number | string | null;
  onSale?: boolean | null;
  clearance?: boolean | null;
  url?: string | null;
  image?: string | null;
  categoryPath?: { id?: string | null; name?: string | null }[] | null;
  onlineAvailability?: boolean | null;
  active?: boolean | null;
}

interface BbPage {
  nextCursorMark?: string | null;
  total?: number;
  products?: BbProduct[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** percentSavings has been observed as both a number and a string ("38.0")
 *  depending on endpoint era; normalise defensively, fall back to computing. */
function pct(p: BbProduct): number | null {
  const v = p.percentSavings;
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n === 'number' && Number.isFinite(n) && n > 0) return round2(n);
  const { salePrice, regularPrice } = p;
  if (
    typeof salePrice === 'number' && typeof regularPrice === 'number' &&
    regularPrice > salePrice && regularPrice > 0
  ) {
    return round2(((regularPrice - salePrice) / regularPrice) * 100);
  }
  return null;
}

export function toHit(p: BbProduct): BestBuyHit | null {
  if (p.sku === null || p.sku === undefined || p.sku === '') return null;
  const id = String(p.sku);

  const categories = p.categoryPath ?? [];
  return {
    sku: id,
    upc: p.upc ?? null,
    title: String(p.name ?? '').slice(0, 300) || `SKU ${id}`,
    brand: p.manufacturer ?? null,
    category: categories.length > 0 ? categories[categories.length - 1]?.name ?? null : null,
    price: typeof p.salePrice === 'number' ? round2(p.salePrice) : null,
    listPrice: typeof p.regularPrice === 'number' ? round2(p.regularPrice) : null,
    discountPct: pct(p),
    clearance: Boolean(p.clearance),
    onSale: Boolean(p.onSale),
    imageUrl: p.image ?? null,
    productUrl: p.url ?? `https://www.bestbuy.com/site/${id}.p`,
    onlineAvailability: Boolean(p.onlineAvailability),
  };
}

/**
 * Row-level guard, same shape as the Walmart one. The source is the retailer's
 * own API, but "official" is not "consistent" — and one bad row in the pool is
 * one bad row too many.
 */
export function bestbuyRowSound(h: BestBuyHit): boolean {
  if (!h.clearance && !h.onSale) return false;
  if (h.price === null || h.listPrice === null || h.listPrice <= h.price) return false;
  const pct = Math.round(((h.listPrice - h.price) / h.listPrice) * 100);
  // A >90% cut with no corroboration reads as a data error, not a deal —
  // the same ceiling every other retailer's guard uses.
  if (pct > 90) return false;
  if (h.discountPct !== null && Math.abs(pct - Math.round(h.discountPct)) > 5) return false;
  if (!meetsTieredFloor(h.price, pct)) return false;
  return true;
}

const SHOW_FIELDS = [
  'sku', 'upc', 'name', 'manufacturer', 'salePrice', 'regularPrice',
  'percentSavings', 'onSale', 'clearance', 'url', 'image',
  'categoryPath.name', 'onlineAvailability',
].join(',');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The whole sweep, paginated with cursorMark — the API's documented method
 * for walking a result set that shifts under the sweep.
 */
export async function fetchBestBuyClearance(): Promise<{ hits: BestBuyHit[]; seen: number }> {
  const apiKey = process.env[ENV]?.trim();
  if (!apiKey) {
    throw new Error(
      `${ENV} is not set. Get a free key at developer.bestbuy.com and put it in the environment.`,
    );
  }

  // active=true drops delisted catalog ghosts the API otherwise returns.
  const query =
    `((clearance=true)|(onSale=true&percentSavings>=${minSavingsPct()}))&active=true&salePrice>0`;

  const hits: BestBuyHit[] = [];
  const seenIds = new Set<string>();
  let cursor = '*';

  for (let page = 0; page < maxPages(); page++) {
    const url =
      `${API}/products(${query})` +
      `?apiKey=${apiKey}&format=json&pageSize=100&cursorMark=${encodeURIComponent(cursor)}` +
      `&show=${SHOW_FIELDS}`;

    const res = await fetch(url);
    if (!res.ok) {
      // 403 is almost always the key (unactivated or over quota); say so
      // instead of surfacing a bare status code at 6am.
      const hint = res.status === 403
        ? ' (403 from Best Buy usually means the key is invalid, not yet activated, or over its daily quota)'
        : '';
      throw new Error(`Best Buy products query failed: ${res.status} ${res.statusText}${hint}`);
    }

    const body = (await res.json()) as BbPage;
    const products = body.products ?? [];

    for (const p of products) {
      const h = toHit(p);
      if (!h || seenIds.has(h.sku)) continue;
      seenIds.add(h.sku);
      if (bestbuyRowSound(h)) hits.push(h);
    }

    const next = body.nextCursorMark;
    // An unchanged cursor or an empty page is the end, whatever `total` says.
    if (!next || next === cursor || products.length === 0) break;
    cursor = next;

    // Key allows 5 req/s; 250ms leaves room for anything else on the key.
    await sleep(250);
  }

  return { hits, seen: seenIds.size };
}
