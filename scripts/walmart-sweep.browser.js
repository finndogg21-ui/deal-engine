/**
 * WALMART CLEARANCE SWEEP — run this IN A BROWSER on https://www.walmart.com.
 *
 * Walmart is browser-only for us (Akamai + PerimeterX face servers; a real
 * browser session ran clean in testing). Paste this into the console on any
 * walmart.com page, wait for `window.__wm.done`, then write `__wmResult()`
 * to a file and hand it to:
 *
 *     DB_DRIVER=postgres npx tsx src/ingest/walmart-ingest.ts sweep.json
 *
 * Self-contained on purpose — a console has no module loader. The parse and
 * the guards mirror src/vendors/walmart-direct.ts; change one, change both.
 *
 * THE LOAD-BEARING RULE: FIRST-PARTY ONLY. Only 6 of 71 items on the measured
 * clearance page were sold by Walmart itself; the rest were marketplace
 * listings with invented was-prices ("$199.99 -> $24" smartwatches). The
 * seller match is EXACT — a substring match would let "Walmart Deals Outlet"
 * through the one gate that matters.
 *
 * PACING: ~10 requests ran with zero challenges, but sweep volume is UNTESTED
 * against Walmart's bot stack. 1.2s between pages, and STOP on the first
 * non-200 rather than retrying into a block.
 */

(() => {
  const PAGES = 12;          // ~200-300 unique items/page; overlap across pages
  const DELAY_MS = 1200;

  const meetsFloor = (price, pct) =>
    price >= 100 ? pct >= 25 : price >= 50 ? pct >= 30 : pct >= 40;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const money = (v) => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v !== 'string' || !v) return null;
    const n = Number(v.replace(/[$,\s]/g, ''));
    return Number.isFinite(n) ? n : null;
  };

  const firstParty = (s) => typeof s === 'string' && /^walmart(\.com)?$/i.test(s.trim());

  function parsePage(html) {
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) return { hits: [], seen: 0, blocked: /robot|captcha|press.*hold/i.test(html.slice(0, 3000)) };
    let nd;
    try { nd = JSON.parse(m[1]); } catch (e) { return { hits: [], seen: 0, blocked: false }; }

    let items = null;
    (function walk(o) {
      if (items || !o || typeof o !== 'object') return;
      if (Array.isArray(o) && o.length > 10 && o[0] && typeof o[0] === 'object' && 'usItemId' in o[0]) { items = o; return; }
      for (const k of Object.keys(o)) walk(o[k]);
    })(nd);
    if (!items) return { hits: [], seen: 0, blocked: false };

    const hits = [];
    const seen = new Set();
    for (const it of items) {
      const id = String(it.usItemId || '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      if (!firstParty(it.sellerName)) continue;
      if (it.flag !== 'Clearance') continue;

      const price = money(it.priceInfo && (it.priceInfo.linePrice || it.priceInfo.itemPrice));
      const was = money(it.priceInfo && it.priceInfo.wasPrice);
      if (price === null || was === null || was <= price) continue;

      const pct = Math.round(((was - price) / was) * 100);
      if (pct > 90) continue;                    // data-error ceiling
      if (!meetsFloor(price, pct)) continue;

      hits.push({
        usItemId: id,
        title: String(it.name || '').slice(0, 200) || ('Item ' + id),
        price, listPrice: was, discountPct: pct,
        flag: it.flag || null,
        sellerName: it.sellerName || null,
        imageUrl: typeof it.image === 'string' ? it.image : ((it.imageInfo && it.imageInfo.thumbnailUrl) || null),
        productUrl: it.canonicalUrl
          ? 'https://www.walmart.com' + String(it.canonicalUrl).split('?')[0]
          : 'https://www.walmart.com/ip/' + id,
        contextStoreId: (it.fulfillmentSummary && it.fulfillmentSummary[0] && it.fulfillmentSummary[0].storeId)
          ? String(it.fulfillmentSummary[0].storeId) : null,
      });
    }
    return { hits, seen: seen.size, blocked: false };
  }

  const st = { done: false, pages: 0, scanned: 0, firstPartyKept: 0, hits: [], errs: 0, stoppedOnBlock: false };
  window.__wm = st;

  (async () => {
    const byId = new Map();
    for (let p = 1; p <= PAGES; p++) {
      try {
        const r = await fetch(`/shop/deals/clearance?page=${p}`, { credentials: 'include' });
        if (r.status !== 200) { st.errs++; st.stoppedOnBlock = true; break; }   // stop, don't retry into a block
        const { hits, seen, blocked } = parsePage(await r.text());
        if (blocked) { st.stoppedOnBlock = true; break; }
        if (seen === 0) break;
        st.pages++;
        st.scanned += seen;
        for (const h of hits) if (!byId.has(h.usItemId)) byId.set(h.usItemId, h);
        st.hits = [...byId.values()];
        st.firstPartyKept = st.hits.length;
      } catch (e) { st.errs++; break; }
      await sleep(DELAY_MS);
    }
    st.hits.sort((a, b) => (b.listPrice - b.price) - (a.listPrice - a.price));
    st.done = true;
    console.log(`[walmart-sweep] pages ${st.pages} · scanned ${st.scanned} · kept ${st.hits.length} · errors ${st.errs}${st.stoppedOnBlock ? ' · STOPPED ON BLOCK' : ''}`);
  })();

  window.__wmResult = () => JSON.stringify(st.hits);
  return 'walmart sweep started — poll window.__wm.done';
})();
