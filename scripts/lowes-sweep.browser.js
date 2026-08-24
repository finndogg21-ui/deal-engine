/**
 * LOWE'S CLEARANCE SWEEP — run this IN A BROWSER on https://www.lowes.com.
 *
 * Lowe's answers a browser and refuses our server (403 with a normal
 * User-Agent, verified 2026-08-23), so discovery cannot run in Node. Paste
 * this into the console on any lowes.com page, wait for it to finish, then
 * copy `__lowesResult()` into a file and hand it to:
 *
 *     npx tsx src/ingest/lowes-ingest.ts sweep.json
 *
 * Self-contained on purpose — a console has no module loader. The URL shape,
 * the field paths and the floor mirror src/vendors/lowes-direct.ts; change one
 * and change the other.
 *
 * WHAT MAKES THIS CHEAP: "The Back Aisle" serves 24 items per page with price
 * embedded in the HTML, so one fetch yields a whole page of candidates. No
 * per-item follow-up call is needed, unlike Home Depot.
 *
 * WHAT THIS DELIBERATELY DOES NOT COLLECT: per-store quantity and aisle/bay.
 * They are in the payload and would be the best in-store data we have, but the
 * same item returned qty 5 / aisle 14 at four stores in four states and a
 * two-store list diff found zero differing quantities. It is not real
 * per-store data; collecting it would ship a fabrication.
 */

(() => {
  // The REAL Back Aisle (site-wide clearance). /pl/Clearance/4294857977 looks
  // right but is washing machines — the numeric id routes, not the path text.
  const CLEARANCE = '/pl/The-back-aisle/2021454685607';
  const PAGES = 30;          // 30 x 24 = ~720 items
  const DELAY_MS = 900;

  /** The same tiered floor the server enforces. */
  const meetsFloor = (price, pct) =>
    price >= 100 ? pct >= 25 : price >= 50 ? pct >= 30 : pct >= 40;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

  // Slugs hyphenate words AND decimals: "3-5-cu-ft" is "3.5 cu ft".
  const titleFromSlug = (slug) => decodeURIComponent(slug)
    .replace(/-/g, ' ')
    .replace(/(\d)\s+(\d)(?=\s*(cu|in|ft|oz|lb|qt|gal|amp|volt|watt|hp))/gi, '$1.$2')
    .replace(/\s+While Supplies Last\s*$/i, '')
    .replace(/\s+/g, ' ').trim().slice(0, 160);

  /**
   * ANCHOR ON `finalPrice`, NOT ON THE PRODUCT LINK.
   *
   * The obvious approach — find /pd/ links and read the price beside them —
   * silently returns NOTHING. The /pd/ hrefs near the top of the document are
   * navigation (offset ~5k); the product data blob does not begin until ~417k.
   * A parser built that way reported 0 hits from 96 products and looked like
   * "no deals today" rather than a bug. `finalPrice` appears exactly once per
   * product (24 per page, verified), so it is the reliable anchor.
   */
  function parsePage(html) {
    const hits = [];
    let seen = 0;
    const re = /"finalPrice"\s*:\s*([0-9.]+)/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      seen++;
      const fwd = html.slice(m.index, m.index + 2500);
      const back = html.slice(Math.max(0, m.index - 4000), m.index);

      const final = num(m[1]);
      const base = num((fwd.match(/"basePrice"\s*:\s*([0-9.]+)/) ||
                        back.match(/"basePrice"\s*:\s*([0-9.]+)/) || [])[1]);
      const pctRaw = num((fwd.match(/"totalPercentage"\s*:\s*([0-9.]+)/) || [])[1]);
      const ends = (fwd.match(/"endDateTime"\s*:\s*"([^"]+)"/) || [])[1] || null;

      // THE ID MUST BE THE 10-DIGIT ONE FROM THE /pd/ LINK. The `itemNumber`
      // beside the price is 7 digits and returns 404 from the detail endpoint;
      // the 10-digit id in the preceding /pd/ link returns 200. The link also
      // carries the slug, which is the product name — so no enrichment call.
      const link = [...back.matchAll(/\/pd\/([^"'\\]{0,140}?)\/(\d{10})/g)].pop();
      if (!link || base === null || final === null || final >= base) continue;

      const pct = pctRaw !== null ? pctRaw : Math.round(((base - final) / base) * 100);
      if (!meetsFloor(final, pct)) continue;

      const slug = link[1] || '';
      hits.push({
        itemNumber: link[2],
        title: titleFromSlug(slug),
        brand: null,
        price: final,
        listPrice: base,
        discountPct: pct,
        endsAt: ends,             // every Lowe's markdown expires — it is a SALE
        imageUrl: null,
        productUrl: 'https://www.lowes.com/pd/' + slug + '/' + link[2],
      });
    }
    return { hits, seen };
  }

  const state = { done: false, pages: 0, scanned: 0, hits: [], errs: 0 };
  window.__lowes = state;

  (async () => {
    const byId = new Map();
    for (let p = 0; p < PAGES; p++) {
      try {
        const r = await fetch(`${CLEARANCE}?offset=${p * 24}`, { credentials: 'include' });
        if (r.status !== 200) { state.errs++; await sleep(1500); continue; }
        const html = await r.text();
        const { hits, seen } = parsePage(html);
        if (seen === 0) break;                 // ran off the end of the list
        state.pages++;
        state.scanned += seen;
        for (const h of hits) if (!byId.has(h.itemNumber)) byId.set(h.itemNumber, h);
        state.hits = [...byId.values()];
      } catch (e) {
        state.errs++;
      }
      await sleep(DELAY_MS);
    }
    // Best first by absolute saving — that is the reseller's margin.
    state.hits.sort((a, b) => (b.listPrice - b.price) - (a.listPrice - a.price));

    state.done = true;
    console.log(`[lowes-sweep] pages ${state.pages} · scanned ${state.scanned} · hits ${state.hits.length} · errors ${state.errs}`);
    console.log('[lowes-sweep] copy __lowesResult() into sweep.json');
  })();

  /** The JSON lowes-ingest.ts expects. */
  window.__lowesResult = () => JSON.stringify(state.hits);

  return 'lowes sweep started — poll window.__lowes.done';
})();
