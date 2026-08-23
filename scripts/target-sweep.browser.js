/**
 * TARGET DISCOVERY SWEEP — run this IN A BROWSER on https://www.target.com.
 *
 * Target's RedSky answers a browser and refuses our server (403 + captcha), so
 * discovery cannot run in Node. Paste this into the console on any target.com
 * page (or let the scheduled browser agent evaluate it), wait for it to finish,
 * then copy `__sweepResult()` into a file and hand it to:
 *
 *     npx tsx src/ingest/target-ingest.ts sweep.json stores.json facts.json
 *
 * It is deliberately self-contained — no imports — because a console has no
 * module loader. The URL shape and the floor mirror src/vendors/target-search.ts
 * and src/engine/deal-floor.ts; change those and change this.
 *
 * TWO RULES, both learned by getting them wrong first:
 *   1. credentials:'include' — a plain cross-origin fetch omits cookies and
 *      RedSky answers 403. This is NOT a bot block and NOT a rate limit.
 *   2. include_sponsored=false — true fails the entire response on the
 *      sponsored backend even when the organic results are fine.
 *
 * Measured 2026-08-23: category 5q0ga holds ~3,666 clearance items; a 50-page
 * pass (1,200 items) produced 174 that clear the tiered floor.
 */

(() => {
  const KEY = '9f36aeafbe60771e321a7cc95a781407';
  const CATEGORY = '5q0ga';
  const BASE = 'https://redsky.target.com/redsky_aggregations/v1/web';

  // Tune per run. PAGES * 24 = items scanned.
  const PAGES = 50;
  const ZIP = '78232';
  const PRICING_STORE = '176';
  // Stores to count shelf units at. Get real ids from nearbyStores() below.
  const STORES = ['176', '1354', '2239', '2467', '2803'];
  // How many of the best hits to verify per-store. Verification is 1 + N calls
  // each, so this is the expensive half — keep it modest.
  const VERIFY_TOP = 24;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const get = async (url) => {
    const r = await fetch(url, { credentials: 'include' }); // rule 1
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    return r.json();
  };

  /** The same tiered floor the server enforces. Cheap things must be cut deeper. */
  const meetsFloor = (price, pct) =>
    price >= 100 ? pct >= 25 : price >= 50 ? pct >= 30 : pct >= 40;

  const decode = (s) =>
    String(s ?? '')
      .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"');

  const searchUrl = (offset) =>
    `${BASE}/plp_search_v2?key=${KEY}&category=${CATEGORY}&channel=WEB&count=24` +
    `&default_purchasability_filter=true&include_sponsored=false` + // rule 2
    `&offset=${offset}&page=%2Fc%2F${CATEGORY}&platform=desktop` +
    `&pricing_store_id=${PRICING_STORE}&store_ids=${PRICING_STORE}` +
    `&visitor_id=0193ABCDEF&zip=${ZIP}`;

  const priceUrl = (tcin, store) =>
    `${BASE}/pdp_client_v1?key=${KEY}&tcin=${tcin}&is_bot=false&store_id=${store}` +
    `&pricing_store_id=${store}&has_pricing_store_id=true&channel=WEB&page=%2Fp%2FA-${tcin}`;

  const fulfillUrl = (tcin, store) =>
    `${BASE}/product_fulfillment_v1?key=${KEY}&tcin=${tcin}&store_id=${store}` +
    `&zip=${ZIP}&state=TX&latitude=29.580&longitude=-98.480` +
    `&required_store_id=${store}&has_required_store_id=true`;

  /** Real store names/addresses for the ledger. location_name is null on the
   *  fulfillment payload, so names must come from here. */
  const nearbyStores = async () => {
    const j = await get(
      `${BASE}/nearby_stores_v1?key=${KEY}&limit=${STORES.length}&within=50&place=${ZIP}`,
    );
    return (j?.data?.nearby_stores?.stores ?? []).map((x) => ({
      id: String(x.store_id),
      name: x.location_name,
      addr: x.mailing_address?.address_line1 ?? null,
      city: x.mailing_address?.city ?? null,
      st: x.mailing_address?.region ?? null,
      zip: String(x.mailing_address?.postal_code ?? '').slice(0, 5),
    }));
  };

  const state = { phase: 'sweep', pages: 0, seen: 0, hits: [], facts: [], stores: [], errs: 0, done: false };
  window.__sweep = state;

  (async () => {
    // ---- 1. DISCOVER -----------------------------------------------------
    for (let off = 0; off < PAGES * 24; off += 24) {
      try {
        const j = await get(searchUrl(off));
        const products = j?.data?.search?.products ?? [];
        if (!products.length) break;
        state.pages++;
        state.seen += products.length;
        for (const p of products) {
          const pr = p.price ?? {};
          const cur = pr.current_retail ?? pr.current_retail_min ?? null;
          const reg = pr.reg_retail ?? pr.reg_retail_max ?? null;
          if (cur == null || reg == null || reg <= cur) continue;
          const isClr =
            String(pr.formatted_current_price_type ?? '').includes('clearance') ||
            String(pr.mixed_current_price_type ?? '').includes('clearance');
          if (!isClr) continue;
          const pct = Math.round(((reg - cur) / reg) * 100);
          if (!meetsFloor(cur, pct)) continue;
          const img = p.item?.enrichment?.image_info?.primary_image?.image_name;
          state.hits.push({
            tcin: String(p.tcin),
            title: decode(p.item?.product_description?.title),
            cur, reg, pct,
            url: `https://www.target.com/p/-/A-${p.tcin}`,
            img: img ? `https://target.scene7.com/is/image/Target/${img}` : null,
          });
        }
      } catch (e) {
        state.errs++;
      }
      await sleep(600);
    }

    // ---- 2. STORES -------------------------------------------------------
    state.phase = 'stores';
    try {
      state.stores = await nearbyStores();
    } catch (e) {
      state.errs++;
    }

    // ---- 3. VERIFY per store --------------------------------------------
    // Rank by absolute savings: that is the reseller's margin, not the percent.
    state.phase = 'verify';
    const picks = [...state.hits].sort((a, b) => (b.reg - b.cur) - (a.reg - a.cur)).slice(0, VERIFY_TOP);
    for (const h of picks) {
      let price = null, reg = null, isClr = false;
      try {
        const pd = (await get(priceUrl(h.tcin, PRICING_STORE)))?.data?.product;
        const p = pd?.price ?? {};
        price = p.current_retail ?? p.current_retail_min ?? null;
        reg = p.reg_retail ?? p.reg_retail_max ?? null;
        isClr =
          String(p.formatted_current_price_type ?? '').includes('clearance') ||
          String(p.mixed_current_price_type ?? '').includes('clearance');
        const img = pd?.item?.enrichment?.image_info?.primary_image?.url;
        if (img) h.img = img;
        const t = pd?.item?.product_description?.title;
        if (t) h.title = decode(t);
      } catch (e) {
        state.errs++;
      }
      await sleep(500);

      for (const s of STORES) {
        try {
          const so = (await get(fulfillUrl(h.tcin, s)))?.data?.product?.fulfillment?.store_options?.[0];
          state.facts.push({
            tcin: h.tcin, storeId: s, price, regPrice: reg, isClearance: isClr,
            // A missing field is NOT zero stock. Zero is a reading; absent is not.
            quantity: so?.location_available_to_promise_quantity ?? null,
            availability: so?.in_store_only?.availability_status ?? null,
          });
        } catch (e) {
          state.errs++;
        }
        await sleep(450);
      }
    }

    state.phase = 'done';
    state.done = true;
    console.log(
      `[target-sweep] pages ${state.pages} · scanned ${state.seen} · hits ${state.hits.length} · facts ${state.facts.length} · errors ${state.errs}`,
    );
    console.log('[target-sweep] copy the three files with __sweepResult()');
  })();

  /** Returns the three JSON blobs target-ingest.ts expects. */
  window.__sweepResult = () => ({
    sweep: JSON.stringify(state.hits),
    stores: JSON.stringify(state.stores),
    facts: JSON.stringify(state.facts),
  });

  return 'target sweep started — poll window.__sweep.done';
})();
