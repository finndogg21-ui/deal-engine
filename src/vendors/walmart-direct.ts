/**
 * Walmart, direct from the site's own clearance browse.
 *
 * Measured in-browser 2026-08-24. Every claim below was read off real
 * responses; nothing is inferred from documentation.
 *
 *   discovery  GET /shop/deals/clearance?page=N
 *              Next.js page whose `__NEXT_DATA__` script embeds 200-300
 *              unique products per page as structured JSON: current price,
 *              was-price, savings, an explicit `flag: "Clearance"`, seller
 *              name, availability, and a store-contextual `storeId`.
 *              Pagination via ?page=N verified (pages 1-3, distinct sets).
 *
 * Browser-only, like every other retailer we carry: fetch it same-origin from
 * a walmart.com tab. ~10 requests ran clean with no Akamai/PerimeterX
 * challenge; sweep-volume behavior is UNTESTED — pace politely and stop on the
 * first challenge rather than retrying into a block.
 *
 * ── THE LOAD-BEARING RULE: FIRST-PARTY ONLY ───────────────────────────────
 *
 * Only 6 of 71 items on the measured clearance page were sold by Walmart
 * itself. The rest were marketplace listings with invented was-prices — a
 * "$199.99 -> $24" no-name smartwatch claiming 88% off. Publishing those
 * would be the RebelSavings fabrication with extra steps.
 *
 * `sellerName` is present on every item, so the guard is one strict match.
 * A marketplace seller could name itself something Walmart-ish, so the match
 * is exact ("Walmart.com" / "Walmart"), not a substring.
 *
 * ── WHAT WE DELIBERATELY DO NOT CLAIM ─────────────────────────────────────
 *
 * - The in-app "hidden clearance" price. It is physically gated to a device
 *   standing in the store (location services / in-store WiFi) and is NOT
 *   reachable from any endpoint. We never imply we can see it.
 * - Per-store stock. No availableQuantity field surfaced in any payload
 *   probed. The page's storeId is CONTEXT (which store priced the page), not
 *   a shelf count, and the ledger stays empty for Walmart.
 */

import { meetsTieredFloor } from '../engine/deal-floor.js';

const ORIGIN = 'https://www.walmart.com';

export const CLEARANCE_PATH = '/shop/deals/clearance';

export interface WalmartHit {
  usItemId: string;
  title: string;
  /** What you pay / what it was. Parsed from Walmart's "$9.29"-style strings. */
  price: number | null;
  listPrice: number | null;
  discountPct: number | null;
  /** Walmart's own badge. Only rows flagged Clearance are treated as such. */
  flag: string | null;
  sellerName: string | null;
  imageUrl: string | null;
  productUrl: string;
  /** The store that priced this page — context, never a stock claim. */
  contextStoreId: string | null;
}

export function clearanceUrl(page = 1): string {
  return `${ORIGIN}${CLEARANCE_PATH}?page=${page}`;
}

/** "$1,299.99" -> 1299.99. Walmart serves prices as display strings. */
export function parseMoney(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string' || !v) return null;
  const n = Number(v.replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Exact-match first-party check. Substring matching would let a marketplace
 * seller named "Walmart Deals Outlet" through the one gate that matters.
 */
export function isFirstParty(sellerName: unknown): boolean {
  return typeof sellerName === 'string' && /^walmart(\.com)?$/i.test(sellerName.trim());
}

/**
 * Pull floor-clearing, first-party clearance out of one page's __NEXT_DATA__.
 *
 * Takes the PARSED JSON (the harness does `JSON.parse` on the script tag) and
 * walks it for the item stack — the array of objects carrying `usItemId` —
 * rather than regexing HTML. Lowe's taught that lesson: position-based
 * extraction against a served page silently pairs the wrong fields.
 */
export function parseClearancePage(nextData: unknown): {
  hits: WalmartHit[];
  seen: number;
  firstParty: number;
} {
  let items: Array<Record<string, any>> | null = null;
  (function walk(o: any) {
    if (items || !o || typeof o !== 'object') return;
    if (Array.isArray(o) && o.length > 10 && o[0] && typeof o[0] === 'object' && 'usItemId' in o[0]) {
      items = o;
      return;
    }
    for (const k of Object.keys(o)) walk(o[k]);
  })(nextData);

  if (!items) return { hits: [], seen: 0, firstParty: 0 };

  const hits: WalmartHit[] = [];
  const seenIds = new Set<string>();
  let firstParty = 0;

  for (const it of items as Array<Record<string, any>>) {
    const id = String(it.usItemId ?? '');
    if (!id || seenIds.has(id)) continue;
    seenIds.add(id);

    if (!isFirstParty(it.sellerName)) continue;
    firstParty++;

    // Walmart's own badge decides what counts as clearance. "Reduced price"
    // and "Best seller" rows are not clearance and are left out.
    if (it.flag !== 'Clearance') continue;

    const price = parseMoney(it.priceInfo?.linePrice) ?? parseMoney(it.priceInfo?.itemPrice);
    const was = parseMoney(it.priceInfo?.wasPrice);
    if (price === null || was === null || was <= price) continue;

    const pct = Math.round(((was - price) / was) * 100);
    // A >90% cut on a first-party row with no corroboration reads as a data
    // error, not a deal — same ceiling the Lowe's units guard uses.
    if (pct > 90) continue;
    if (!meetsTieredFloor(price, pct)) continue;

    hits.push({
      usItemId: id,
      title: String(it.name ?? '').slice(0, 200) || `Item ${id}`,
      price,
      listPrice: was,
      discountPct: pct,
      flag: it.flag ?? null,
      sellerName: it.sellerName ?? null,
      imageUrl: typeof it.image === 'string' ? it.image : (it.imageInfo?.thumbnailUrl ?? null),
      productUrl: it.canonicalUrl
        ? `${ORIGIN}${String(it.canonicalUrl).split('?')[0]}`
        : `${ORIGIN}/ip/${id}`,
      contextStoreId: it.fulfillmentSummary?.[0]?.storeId
        ? String(it.fulfillmentSummary[0].storeId)
        : null,
    });
  }

  return { hits, seen: seenIds.size, firstParty };
}
