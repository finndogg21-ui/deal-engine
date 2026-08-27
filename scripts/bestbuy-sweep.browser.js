/**
 * BEST BUY OUTLET SWEEP — run this IN A BROWSER on https://www.bestbuy.com.
 *
 * Best Buy is browser-only for us. The sweep POSTs the same GraphQL gateway
 * their own listing uses (`PlpView_ProductList_Refresh`) with a minimal query
 * document — no page scraping, no virtualized-tile fights. Paste into the
 * console on any bestbuy.com page, wait for `window.__bb.done`, then write
 * `__bbResult()` to a file and hand it to:
 *
 *     DB_DRIVER=postgres npx tsx src/ingest/bestbuy-gateway-ingest.ts sweep.json
 *
 * Self-contained on purpose — a console has no module loader. Query, guards
 * and parse mirror src/vendors/bestbuy-direct.ts; change one, change both.
 *
 * TWO PASSES over the outlet universe (~10,898 items):
 *   1. currentoffers_facet "Clearance"        (~1,837) — Best Buy's own flag
 *   2. percentdiscount_facet "20% Off or More" (~3,729) — superset of every
 *      tiered-floor candidate (the floor's minimum is 25%)
 * Rows are deduped by SKU; a row found by pass 1 keeps sweep='clearance'.
 *
 * V1 IS NEW-CONDITION ONLY. Faceting to Open-Box still returns the NEW price
 * (measured), so open-box rows would quote a price for a condition we never
 * fetched. condition.type !== 'new' never leaves this script.
 *
 * PACING: 1.2s between POSTs, STOP on the first non-200 instead of retrying
 * into a block. ~112 calls for a full run.
 */

(() => {
  const DELAY_MS = 1200;
  const PAGE_SIZE = 50;
  const MAX_PAGES_PER_SWEEP = 80; // hard cap; numFound decides the real count
  const OUTLET = 'pcmcat1708045838024';

  const SWEEPS = [
    { label: 'clearance', facets: [
      { facetField: 'outlet_facet', value: 'Outlet Items' },
      { facetField: 'currentoffers_facet', value: 'Clearance' },
    ] },
    { label: 'discount20', facets: [
      { facetField: 'outlet_facet', value: 'Outlet Items' },
      { facetField: 'percentdiscount_facet', value: '20% Off or More' },
    ] },
  ];

  const QUERY = `query PlpView_ProductList_Refresh($detailedSearchInput: SearchInput!, $paginationForDetailedProductSearch: SearchPagination!, $filter: SearchFilter, $sort: SearchSort, $testing: SearchTesting!, $productPriceInput: ProductItemPriceInput!, $input: SearchInput!, $pagination: SearchPagination!) {
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

  const meetsFloor = (price, pct) =>
    price >= 100 ? pct >= 25 : price >= 50 ? pct >= 30 : pct >= 40;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const num = (v) => {
    if (v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const body = (facets, pageNumber) => {
    const input = { site: 'WWW', queryType: 'BROWSE', query: OUTLET + '_categoryid$cat00000' };
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
          browsedCategory: OUTLET,
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
  };

  function parseDocs(json, sweep) {
    const docs = (json && json.data && json.data.detailedProductSearch && json.data.detailedProductSearch.documents) || [];
    const numFound = num(json && json.data && json.data.search && json.data.search.numFound);
    const hits = [];
    for (const d of docs) {
      const p = d && d.product;
      if (!p || !p.skuId) continue;
      const pr = p.price || {};
      const price = num(pr.displayableCustomerPrice);
      const list = num(pr.displayableRegularPrice);
      const statedPct = num(pr.totalSavingsPercent);

      if (price === null || list === null || list <= price) continue;         // no was-price → never derive one
      if (((p.condition && p.condition.type) || null) !== 'new') continue;    // v1: new only

      const pct = Math.round(((list - price) / list) * 100);
      if (pct > 90) continue;                                                 // data-error ceiling
      if (statedPct !== null && statedPct > 0 && Math.abs(pct - statedPct) > 5) continue;
      if (!meetsFloor(price, pct)) continue;

      hits.push({
        skuId: String(p.skuId),
        title: String((p.name && p.name.short) || '').slice(0, 300) || ('SKU ' + p.skuId),
        brand: p.brand ? String(p.brand) : null,
        price, listPrice: list, discountPct: pct,
        condition: (p.condition && p.condition.type) || null,
        endsAt: pr.dealExpirationTimeStamp ? String(pr.dealExpirationTimeStamp) : null,
        imageUrl: (p.primaryImage && p.primaryImage.piscesHref) || null,
        productUrl: (p.url && p.url.skuSpecificUrl) || ('https://www.bestbuy.com/site/searchpage.jsp?st=' + p.skuId),
        sweep,
      });
    }
    return { hits, seen: docs.length, numFound };
  }

  const st = { done: false, calls: 0, scanned: 0, hits: [], errs: 0, stoppedOnBlock: false, numFound: {} };
  window.__bb = st;

  (async () => {
    const bySku = new Map();
    for (const sw of SWEEPS) {
      let pages = MAX_PAGES_PER_SWEEP;
      for (let p = 1; p <= pages; p++) {
        try {
          const r = await fetch('https://www.bestbuy.com/gateway/graphql', {
            method: 'POST', credentials: 'include',
            headers: { 'content-type': 'application/json' },
            body: body(sw.facets, p),
          });
          if (r.status !== 200) { st.errs++; st.stoppedOnBlock = true; break; }
          const { hits, seen, numFound } = parseDocs(await r.json(), sw.label);
          st.calls++;
          st.scanned += seen;
          if (numFound !== null) {
            st.numFound[sw.label] = numFound;
            pages = Math.min(MAX_PAGES_PER_SWEEP, Math.ceil(numFound / PAGE_SIZE));
          }
          for (const h of hits) if (!bySku.has(h.skuId)) bySku.set(h.skuId, h);
          st.hits = [...bySku.values()];
          if (seen === 0) break;
        } catch (e) { st.errs++; break; }
        await sleep(DELAY_MS);
      }
      if (st.stoppedOnBlock) break;
    }
    st.hits.sort((a, b) => (b.listPrice - b.price) - (a.listPrice - a.price));
    st.done = true;
    console.log('[bestbuy-sweep] calls ' + st.calls + ' · scanned ' + st.scanned + ' · kept ' + st.hits.length + ' · errors ' + st.errs + (st.stoppedOnBlock ? ' · STOPPED ON BLOCK' : ''));
  })();

  window.__bbResult = () => JSON.stringify(st.hits);
  return 'bestbuy sweep started — poll window.__bb.done';
})();
