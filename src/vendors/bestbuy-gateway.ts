/**
 * Best Buy, through the same GraphQL gateway their own PLP uses.
 *
 * COMPANION to bestbuy-direct.ts, not a replacement. The direct module speaks
 * the official Products API and is the better path the day BESTBUY_API_KEY
 * exists; it was built 2026-08-25 and is still waiting on that key. This
 * module is what put Best Buy rows on the site the same day: cracked
 * in-browser, no key, no quota. When the key lands, both can run — they write
 * the same pool rows and ON CONFLICT keeps them honest.
 *
 * Cracked in-browser 2026-08-25. Server-side requests are blocked like every
 * other retailer here; the browser agent POSTs, this module owns the query,
 * the variables, and the parsing.
 *
 * THE ENDPOINT: POST https://www.bestbuy.com/gateway/graphql with
 * `credentials: 'include'` and a JSON body. The gateway executes arbitrary
 * query documents — no persisted-query whitelist — so we send a minimal
 * document (~1.4KB) instead of the PLP's full 21.7KB one. Responses drop from
 * ~200KB to ~33KB per page of 50.
 *
 * HOW THE PLP ACTUALLY LOADS (why scraping the page failed): searchpage.jsp
 * SSRs only the first ~4 tiles with prices; the rest are virtualized widgets
 * that hydrate through `PlpView_ProductList_Refresh` as they scroll into
 * view. The `paginationForDetailedProductSearch` variable is the real page
 * control — their client asks for 4 docs at a time; the gateway happily
 * serves 50.
 *
 * THE FACETS THAT MATTER (read off the live facet list, not guessed):
 *   outlet_facet          "Outlet Items"          the outlet universe (~10,898)
 *   percentdiscount_facet "20% Off or More"       3,729 — superset of every
 *                                                 tiered-floor candidate (floor
 *                                                 minimum is 25%)
 *   currentoffers_facet   "Clearance"             1,837 — Best Buy's own flag,
 *                                                 used to label deal_kind
 *   condition_facet       New / Open-Box / Refurbished / Pre-Owned
 *
 * ── V1 IS NEW-CONDITION ONLY ──────────────────────────────────────────────
 *
 * Faceting to Open-Box still returns each product's NEW-condition price
 * (measured: condition_facet=Open-Box docs came back condition.type "new"
 * with the new price and 0 savings). The facet selects products that HAVE
 * open-box variants; it does not price them. Publishing those rows as
 * open-box finds would quote a price for a condition we never fetched — the
 * same fabrication the Lowe's units guard exists to stop. Open-box needs a
 * per-SKU buying-options query; until that is built and verified, only
 * condition.type === 'new' rows pass.
 *
 * PRICING IS TREATED AS CHAIN-WIDE ('online'), like Target and Walmart. The
 * query pins zip 75201 / store 58 because their client requires the context,
 * but no per-store claim is made and store_id stays null.
 *
 * TRAP: displayableRegularPrice CAN BE NULL on rows that still carry a
 * savings percent (seen on the Clearance facet). A card must show both
 * prices, and deriving the was-price from the percent would be inventing a
 * number — those rows are skipped, not repaired.
 */

import { meetsTieredFloor } from '../engine/deal-floor.js';

export const GATEWAY_URL = 'https://www.bestbuy.com/gateway/graphql';

/** All-Outlet browse category — the master outlet listing. */
export const OUTLET_CATEGORY = 'pcmcat1708045838024';

export const PAGE_SIZE = 50;

/** Facet sets the sweep runs. Floor candidates + Best Buy's own clearance flag. */
export const SWEEPS: Array<{ label: string; facets: Array<{ facetField: string; value: string }> }> = [
  {
    label: 'discount20',
    facets: [
      { facetField: 'outlet_facet', value: 'Outlet Items' },
      { facetField: 'percentdiscount_facet', value: '20% Off or More' },
    ],
  },
  {
    label: 'clearance',
    facets: [
      { facetField: 'outlet_facet', value: 'Outlet Items' },
      { facetField: 'currentoffers_facet', value: 'Clearance' },
    ],
  },
];

/**
 * Minimal replacement for the PLP's own PlpView_ProductList_Refresh document.
 * Kept to the fields the judge needs; the second `search` selection exists
 * only for numFound (page-count control). Field names verified against a live
 * 200 on 2026-08-25.
 */
export const QUERY = `query PlpView_ProductList_Refresh($detailedSearchInput: SearchInput!, $paginationForDetailedProductSearch: SearchPagination!, $filter: SearchFilter, $sort: SearchSort, $testing: SearchTesting!, $productPriceInput: ProductItemPriceInput!, $input: SearchInput!, $pagination: SearchPagination!) {
  detailedProductSearch: search(input: $detailedSearchInput, pagination: $paginationForDetailedProductSearch, filter: $filter, sort: $sort, testing: $testing) {
    documents {
      ... on SearchProduct {
        product {
          skuId
          brand
          condition { type }
          name { short }
          url { skuSpecificUrl }
          primaryImage { piscesHref }
          dotComDisplayStatus
          price(input: $productPriceInput) {
            displayableCustomerPrice
            displayableRegularPrice
            totalSavings
            totalSavingsPercent
            dealExpirationTimeStamp
            skuId
          }
        }
      }
    }
  }
  search(input: $input, pagination: $pagination, filter: $filter, sort: $sort, testing: $testing) { numFound }
}`;

/**
 * Build one request body. The variables mirror what their client sends with
 * the sponsored-placement machinery stripped; `search`'s own pagination stays
 * at page 1 because only numFound is read from it.
 */
export function buildRequestBody(
  facets: Array<{ facetField: string; value: string }>,
  pageNumber: number,
): string {
  const browseQuery = `${OUTLET_CATEGORY}_categoryid$cat00000`;
  const input = { site: 'WWW', queryType: 'BROWSE', query: browseQuery };
  return JSON.stringify({
    operationName: 'PlpView_ProductList_Refresh',
    query: QUERY,
    variables: {
      input,
      detailedSearchInput: input,
      pagination: { pageNumber: 1, offset: 18 },
      paginationForDetailedProductSearch: { pageNumber, offset: PAGE_SIZE },
      filter: {
        enableMarketplace: true,
        browsedCategory: OUTLET_CATEGORY,
        facets,
        deviceClass: 'l',
        removeCombos: false,
        availability: {
          enableDeliveryFacet: false,
          inventoryType: 'storepickup,instore',
          zipCode: '75201',
          preferredStore: '58',
          availableStoresList: '58',
        },
        collapse: true,
        enableNestedFacet: true,
        autoFacet: true,
      },
      sort: { sort: 'Best-Selling' },
      testing: {},
      productPriceInput: {
        customerId: '',
        salesChannel: 'LargeView',
        usePriceWithCart: false,
        cartTimestamp: '',
        useSuco: false,
        useCabo: false,
        visitorId: '',
        context: 'plp',
        displayLocation: 'medium-plp',
      },
    },
  });
}

export interface BestBuyGatewayHit {
  skuId: string;
  title: string;
  brand: string | null;
  /** What you pay (new condition — the only one v1 publishes). */
  price: number | null;
  /** The was-price. Null happens; those rows never publish. */
  listPrice: number | null;
  discountPct: number | null;
  /** Best Buy's own condition.type — anything but 'new' is dropped in v1. */
  condition: string | null;
  /** When the deal expires, when Best Buy says so. */
  endsAt: string | null;
  imageUrl: string | null;
  productUrl: string;
  /** Which sweep found it — 'clearance' marks Best Buy's own Clearance flag. */
  sweep: string;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Parse one gateway response. Guards are structural, not stylistic: no
 * was-price → skip; not new condition → skip; >90% → data-error ceiling
 * (same rule as Walmart); computed-vs-stated percent must agree within 5.
 */
export function parseSearchResponse(
  json: unknown,
  sweep: string,
): { hits: BestBuyGatewayHit[]; seen: number; numFound: number | null } {
  const root = json as Record<string, any>;
  const docs: any[] = root?.data?.detailedProductSearch?.documents ?? [];
  const numFound = num(root?.data?.search?.numFound);
  const hits: BestBuyGatewayHit[] = [];

  for (const d of docs) {
    const p = d?.product;
    if (!p?.skuId) continue;
    const pr = p.price ?? {};
    const price = num(pr.displayableCustomerPrice);
    const list = num(pr.displayableRegularPrice);
    const statedPct = num(pr.totalSavingsPercent);

    if (price === null || list === null || list <= price) continue;
    if ((p.condition?.type ?? null) !== 'new') continue;

    const pct = Math.round(((list - price) / list) * 100);
    if (pct > 90) continue;
    if (statedPct !== null && statedPct > 0 && Math.abs(pct - statedPct) > 5) continue;
    if (!meetsTieredFloor(price, pct)) continue;

    hits.push({
      skuId: String(p.skuId),
      title: String(p.name?.short ?? '').slice(0, 300),
      brand: p.brand ? String(p.brand) : null,
      price,
      listPrice: list,
      discountPct: pct,
      condition: p.condition?.type ?? null,
      endsAt: pr.dealExpirationTimeStamp ? String(pr.dealExpirationTimeStamp) : null,
      imageUrl: p.primaryImage?.piscesHref ? String(p.primaryImage.piscesHref) : null,
      productUrl: String(p.url?.skuSpecificUrl ?? `https://www.bestbuy.com/site/searchpage.jsp?st=${p.skuId}`),
      sweep,
    });
  }

  return { hits, seen: docs.length, numFound };
}
