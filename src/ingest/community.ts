/**
 * Community deal ingest — the crowd's output, from PUBLIC pages only.
 *
 *   npm run community          fetch all sources, upsert into community_reports
 *
 * Why this exists: $0.01 penny prices are a register-only state that no
 * scraper can see, and full-catalog store scans are economically impossible.
 * The people already walking the aisles ARE the sensor network — and the
 * biggest crowds publish their finds on open pages:
 *
 *   pennycentral   penny list, server-embedded JSON, robots.txt allows, no
 *                  login (verified 2026-08-22). ~155k-member Facebook crowd.
 *   slickdeals     RSS search feed, HD clearance 50-90% off, same-day fresh
 *                  (verified 2026-08-22). Keep to 1-2 polls/day — their robots
 *                  guidance is ambiguous, so stay polite.
 *   rebelsavings   deep clearance 35-99%, no login, robots fully open
 *                  (verified 2026-08-22). Page structure undocumented, so this
 *                  adapter is EXPERIMENTAL: it parses what it can and returns
 *                  [] gracefully when the shape changes.
 *
 * HARD RULES: one polite GET per source per run. Public pages only — never a
 * login-walled competitor (that's a ToS breach and a canary-trap risk; see
 * company/architecture-verdict.md). Reports are hearsay, stored apart from
 * price_observations and always labeled community-reported in the UI.
 */

import 'dotenv/config';
import { getDb, type Db } from '../db/client.js';
import { meetsTieredFloor } from '../engine/deal-floor.js';

const UA = 'deal-engine-community-reader/1.0 (polite; 1-2 fetches/day)';

export interface CommunityReport {
  source: 'pennycentral' | 'slickdeals' | 'rebelsavings' | 'dg-members' | 'tsc-members';
  /** Which retailer the find is at. Defaults to homedepot for the HD-only
   *  sources that predate multi-retailer crowd reports. Dollar General penny
   *  finds ride this same path — $0.01 is register-only at DG too. */
  retailer?: string;
  kind: 'penny' | 'clearance';
  dedupeKey: string;
  sku?: string | null;
  itemId?: string | null;
  title: string;
  price?: number | null;
  listPrice?: number | null;
  discountPct?: number | null;
  state?: string | null;
  city?: string | null;
  storeNumber?: string | null;
  productUrl?: string | null;
  sourceUrl?: string | null;
  imageUrl?: string | null;
  reportedAt?: Date | null;
  raw?: unknown;
}

async function get(url: string): Promise<string> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30_000);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : null;
};

/** HD product URL from an internet number/item id. */
const hdUrl = (itemId: string | null | undefined) =>
  itemId ? `https://www.homedepot.com/p/${itemId}` : null;

/* ------------------------------------------------------------ pennycentral */

/**
 * The penny list ships as server-embedded JSON (Next.js-style state blob).
 * The exact shape is theirs to change, so instead of hardcoding a path we
 * deep-search the embedded JSON for arrays of penny-record-looking objects
 * (sku / internetNumber + a seen/state field). Verified present 2026-08-22.
 */
function deepFindPennyRecords(node: unknown, out: Record<string, unknown>[] = [], depth = 0): Record<string, unknown>[] {
  if (depth > 12 || node === null || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    const objs = node.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x));
    const looksPenny = objs.length >= 3 && objs.every((o) =>
      ('sku' in o || 'internetNumber' in o || 'internet_number' in o) &&
      ('lastSeenAt' in o || 'last_seen' in o || 'state' in o || 'lastSeen' in o));
    if (looksPenny) { out.push(...objs); return out; }
    for (const x of node) deepFindPennyRecords(x, out, depth + 1);
    return out;
  }
  for (const v of Object.values(node)) deepFindPennyRecords(v, out, depth + 1);
  return out;
}

/**
 * The list ships inside Next.js FLIGHT chunks — `self.__next_f.push([1,"…"])`
 * script tags whose payload is an escaped JS string, not clean JSON (probed
 * 2026-08-22: the 50KB chunk carries `"initialItems":[{"sku":…,"price":0.01,
 * "retailPrice":…,"internetNumber":…,"homeDepotUrl":…,"lastSeenAt":…}]`).
 * Decode every chunk's string literal, join, then cut the balanced
 * `initialItems` array out and parse it.
 */
function extractBalancedArray(s: string, from: number): string | null {
  const start = s.indexOf('[', from);
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i]!;
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (depth === 0) return s.slice(start, i + 1); }
  }
  return null;
}

export async function fetchPennyCentral(): Promise<CommunityReport[]> {
  const html = await get('https://www.pennycentral.com/penny-list');
  const reports: CommunityReport[] = [];

  // Decode all flight chunks into one stream.
  const chunks = [...html.matchAll(/__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)]
    .map((m) => { try { return JSON.parse(m[1]!) as string; } catch { return ''; } });
  const flight = chunks.join('');
  const idx = flight.indexOf('"initialItems":');
  const blobs: string[] = [];
  if (idx >= 0) {
    const arr = extractBalancedArray(flight, idx);
    if (arr) blobs.push(arr);
  }
  // Fallback: any clean application/json script (older embed styles).
  blobs.push(...[...html.matchAll(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1]!));

  for (const blob of blobs) {
    try {
      const parsed = JSON.parse(blob);
      const records = Array.isArray(parsed) && parsed.every((x) => x && typeof x === 'object')
        ? (parsed as Record<string, unknown>[])
        : deepFindPennyRecords(parsed);
      for (const r of records) {
        const sku = r.sku != null ? String(r.sku) : null;
        const itemId = (r.internetNumber ?? r.internet_number) != null ? String(r.internetNumber ?? r.internet_number) : null;
        const title = String(r.title ?? r.name ?? r.productName ?? '').trim() || `HD SKU ${sku ?? itemId ?? '?'}`;
        const seen = r.lastSeenAt ?? r.last_seen ?? r.lastSeen ?? null;
        if (!sku && !itemId) continue;
        // Sighting locations: a nested {STATE: {City: count}} object under a
        // key we don't hardcode — detect it structurally and keep the state
        // list in the state column ("MN,TX"); the full breakdown stays in raw.
        let locStates: string | null = null;
        for (const v of Object.values(r)) {
          if (v && typeof v === 'object' && !Array.isArray(v)) {
            const entries = Object.entries(v as Record<string, unknown>);
            if (entries.length > 0 && entries.every(([k, sub]) => k.length <= 3 && !!sub && typeof sub === 'object' && !Array.isArray(sub))) {
              locStates = entries.map(([k]) => k).join(',');
              break;
            }
          }
        }
        reports.push({
          source: 'pennycentral', kind: 'penny',
          dedupeKey: sku ?? itemId!,
          sku, itemId, title,
          price: 0.01,
          listPrice: num(r.originalPrice ?? r.retailPrice),
          // A penny IS ~100% off whatever it was; recorded so feed floors pass.
          discountPct: 100,
          state: locStates ?? (r.state != null ? String(r.state) : null),
          city: r.city != null ? String(r.city) : null,
          storeNumber: r.storeNumber != null ? String(r.storeNumber) : null,
          productUrl: typeof r.homeDepotUrl === 'string' ? r.homeDepotUrl : hdUrl(itemId),
          sourceUrl: 'https://www.pennycentral.com/penny-list',
          imageUrl: typeof r.imageUrl === 'string' ? r.imageUrl : null,
          reportedAt: seen ? new Date(String(seen)) : null,
          raw: r,
        });
      }
      if (reports.length > 0) break; // first matching blob wins
    } catch { /* not JSON or not the blob we want — keep scanning */ }
  }
  return reports;
}

/* -------------------------------------------------------------- slickdeals */

export async function fetchSlickdeals(): Promise<CommunityReport[]> {
  const xml = await get(
    'https://slickdeals.net/newsearch.php?rss=1&pp=25&sort=newest&q=home+depot+clearance&searcharea=deals&searchin=first',
  );
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]!);
  const field = (item: string, tag: string) => {
    const m = item.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`));
    return m ? m[1]!.trim() : null;
  };
  const reports: CommunityReport[] = [];
  for (const item of items) {
    const title = field(item, 'title');
    const link = field(item, 'link');
    const pub = field(item, 'pubDate');
    if (!title || !link) continue;
    // Titles carry the price ("... $39.50") and sometimes the original.
    const prices = [...title.matchAll(/\$\s?([\d,]+(?:\.\d{1,2})?)/g)].map((m) => num(m[1]));
    const price: number | null = prices[0] ?? null;
    const listPrice: number | null = prices.length > 1 ? (prices[prices.length - 1] ?? null) : null;
    const pctMatch = title.match(/(\d{2})%\s*off/i);
    const discountPct = pctMatch
      ? num(pctMatch[1])
      : price !== null && listPrice !== null && listPrice > price
        ? Math.round(((listPrice - price) / listPrice) * 100)
        : null;
    reports.push({
      source: 'slickdeals', kind: 'clearance',
      dedupeKey: link,
      title: title.replace(/&amp;/g, '&'),
      price, listPrice, discountPct,
      sourceUrl: link,
      reportedAt: pub ? new Date(pub) : null,
      raw: { title, link, pub },
    });
  }
  return reports;
}

/* ------------------------------------------------------------ rebelsavings */

/**
 * RebelSavings runs an open, unauthenticated search API (found by reading the
 * public JS bundle 2026-08-22): POST /api/search with
 * {retailer:'home-depot', query:'*', sortBy:'dateAdded:desc', page, perPage}
 * → {hits:[{document:{...}}]}. ~3.3M records; each carries STORE-SPECIFIC
 * data — store number, city/state, lat/lng, shelf `stock` count, `discount`,
 * `price`, `is_clearance`, UPC, image, and a link whose `url` param is the HD
 * product page already in ?store= mode.
 *
 * We take a bounded, polite slice per run: the newest 2 pages (500 rows),
 * tiered-floor-filtered downstream. Their robots.txt is fully open and the
 * site is free/no-paywall; still, cache-don't-hammer — this runs once per
 * scan cadence. Attribution: cards show "via rebelsavings".
 */
export async function fetchRebelSavings(): Promise<CommunityReport[]> {
  const reports: CommunityReport[] = [];
  for (let page = 1; page <= 2; page++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 30_000);
    let json: { hits?: Array<{ document?: Record<string, unknown> }> };
    try {
      const res = await fetch('https://www.rebelsavings.com/api/search', {
        method: 'POST',
        signal: ctl.signal,
        headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
        body: JSON.stringify({
          retailer: 'home-depot', query: '*', sortBy: 'dateAdded:desc', page, perPage: 250,
        }),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      json = (await res.json()) as typeof json;
    } finally {
      clearTimeout(timer);
    }
    const hits = json.hits ?? [];
    for (const h of hits) {
      const d = (h.document ?? h) as Record<string, unknown>;
      const title = String(d.title ?? '').trim();
      const itemId = d.id != null ? String(d.id) : null;
      if (!title || !itemId) continue;
      const price = num(d.price);
      const discountPct = num(d.discount);
      // Their price is the CURRENT price and discount is %; derive the "was".
      const listPrice = price !== null && discountPct !== null && discountPct > 0 && discountPct < 100
        ? Math.round((price / (1 - discountPct / 100)) * 100) / 100
        : null;
      // Their link wraps the HD product URL (already ?store=NNN) in a tracking
      // redirect; store the DIRECT HD url for the card, theirs as source_url.
      let productUrl = hdUrl(itemId);
      const link = typeof d.link === 'string' ? d.link : null;
      if (link) {
        try {
          const wrapped = new URL(link).searchParams.get('url');
          if (wrapped && /homedepot\.com/i.test(wrapped)) productUrl = wrapped;
        } catch { /* keep hdUrl fallback */ }
      }
      reports.push({
        source: 'rebelsavings', kind: 'clearance',
        // Store-specific rows: the same SKU at two stores is two reports.
        dedupeKey: `${itemId}:${d.store ?? ''}`,
        sku: itemId, itemId, title, price, listPrice, discountPct,
        state: d.state != null ? String(d.state) : null,
        city: d.city != null ? String(d.city) : null,
        storeNumber: d.store != null ? String(d.store) : null,
        productUrl,
        sourceUrl: link ?? 'https://www.rebelsavings.com/home-depot',
        imageUrl: typeof d.image_url === 'string' ? d.image_url : null,
        reportedAt: typeof d.dateAdded === 'number' ? new Date(d.dateAdded * 1000) : null,
        raw: { ...d, stock: d.stock ?? null },
      });
    }
    if (hits.length < 250) break;
  }
  return reports;
}

/* ------------------------------------------------------------------- runner */

/**
 * looksFabricated, community edition. RebelSavings passed every surface check
 * (open robots, free site, plausible-looking records) and was still 100%
 * synthetic — proven 2026-08-22: its item IDs 404 on Home Depot, the brand in
 * each product URL contradicts the brand in the title ("Husky" wrench linking
 * to /p/Glacier-Bay-…), cities are paired with wrong states, coordinates plot
 * in Mexico. The tell that needs no HD call: on a REAL record the product-URL
 * slug is built from the product's own title, so their tokens overlap; on the
 * fake they share nothing. Require overlap on every HD-linked row, and if most
 * of a batch fails, reject the whole source.
 */
function slugMatchesTitle(productUrl: string | null | undefined, title: string): boolean | null {
  if (!productUrl || !/homedepot\.com\/p\//i.test(productUrl)) return null; // not checkable
  const m = productUrl.match(/\/p\/(?:[^/]*\/)?([A-Za-z0-9-]+?)(?:\/\d+)?(?:[?#]|$)/);
  if (!m) return null;
  const slugTokens = new Set(m[1]!.toLowerCase().split('-').filter((t) => t.length >= 3 && !/^\d+$/.test(t)));
  if (slugTokens.size === 0) return null; // bare-id URL (our own hdUrl fallback) — nothing to compare
  const titleTokens = title.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  const overlap = titleTokens.filter((t) => slugTokens.has(t)).length;
  return overlap >= Math.min(2, slugTokens.size);
}

export async function ingestCommunity(db: Db): Promise<Array<{ source: string; fetched: number; kept: number; error?: string }>> {
  const sources: Array<[string, () => Promise<CommunityReport[]>]> = [
    ['pennycentral', fetchPennyCentral],
    ['slickdeals', fetchSlickdeals],
    // rebelsavings REMOVED 2026-08-22: its entire dataset is synthetic (see
    // slugMatchesTitle above). The adapter stays in the file as evidence and
    // in case they ever ship real data, but it must not feed the app.
  ];
  const out: Array<{ source: string; fetched: number; kept: number; error?: string }> = [];

  for (const [name, fetcher] of sources) {
    try {
      let reports = await fetcher();

      // Batch-level fabrication gate: score checkable rows; if most fail the
      // slug↔title consistency test, the SOURCE is lying — drop everything.
      const checks = reports.map((r) => slugMatchesTitle(r.productUrl, r.title)).filter((v): v is boolean => v !== null);
      const failRate = checks.length > 0 ? checks.filter((v) => !v).length / checks.length : 0;
      if (checks.length >= 5 && failRate > 0.5) {
        out.push({ source: name, fetched: reports.length, kept: 0, error: `REFUSED — ${Math.round(failRate * 100)}% of product URLs contradict their titles (fabrication signature)` });
        continue;
      }
      // Row-level: drop individual rows that fail the same test.
      reports = reports.filter((r) => slugMatchesTitle(r.productUrl, r.title) !== false);

      let kept = 0;
      for (const r of reports) {
        // Clearance hearsay must still clear the tiered floor; unknown-discount
        // clearance is junk risk and is dropped. Pennies always pass (100%).
        if (r.kind === 'clearance' && !meetsTieredFloor(r.price ?? null, r.discountPct ?? null)) continue;
        await db.query(
          `INSERT INTO community_reports
             (source, kind, retailer, dedupe_key, sku, item_id, title, price, list_price,
              discount_pct, state, city, store_number, product_url, source_url, image_url,
              reported_at, fetched_at, raw)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now(),$18)
           ON CONFLICT (source, dedupe_key) DO UPDATE SET
             retailer = EXCLUDED.retailer,
             price = EXCLUDED.price, list_price = EXCLUDED.list_price,
             discount_pct = EXCLUDED.discount_pct, state = EXCLUDED.state,
             city = EXCLUDED.city, store_number = EXCLUDED.store_number,
             reported_at = COALESCE(EXCLUDED.reported_at, community_reports.reported_at),
             fetched_at = now()`,
          [
            // retailer was hardcoded 'homedepot' here — correct the moment a
            // second retailer (Dollar General) uses this path.
            r.source, r.kind, r.retailer ?? 'homedepot', r.dedupeKey,
            r.sku ?? null, r.itemId ?? null, r.title,
            r.price ?? null, r.listPrice ?? null, r.discountPct ?? null,
            r.state ?? null, r.city ?? null, r.storeNumber ?? null,
            r.productUrl ?? null, r.sourceUrl ?? null, r.imageUrl ?? null,
            r.reportedAt ?? null, JSON.stringify(r.raw ?? null),
          ],
        );
        kept++;
      }
      out.push({ source: name, fetched: reports.length, kept });
    } catch (err) {
      // One dead source must not kill the others.
      out.push({ source: name, fetched: 0, kept: 0, error: (err as Error).message });
    }
  }
  return out;
}

import { pathToFileURL } from 'node:url';
const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  ingestCommunity(await getDb())
    .then(async (r) => {
      console.log('community ingest:', JSON.stringify(r));
      const db = await getDb();
      await db.close();
    })
    .catch((err) => { console.error('community ingest crashed:', err); process.exit(1); });
}
