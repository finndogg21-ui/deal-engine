#!/usr/bin/env -S npx tsx
/**
 * HD HIDDEN-CLEARANCE SCANNER v2 — Scrapfly + HD federation-gateway GraphQL.
 *
 * THE CRACK (verified live 2026-08-30). Home Depot's per-store shelf price is NOT
 * in the product page HTML (that's the online catalog price, store 8119). It comes
 * from HD's own pricing API, which we can replay directly:
 *
 *   POST https://apionline.homedepot.com/federation-gateway/graphql?opname=product
 *   headers: content-type: application/json
 *            x-experience-name: general-merchandise
 *   body:    {"query": <product query>, "variables": {"itemId","storeId"}}
 *
 * sent THROUGH Scrapfly with asp=true (clears Akamai Bot Manager). Result: HTTP 200,
 * a small JSON, ~25 Scrapfly credits, and NO api-key required. `storeId` is a query
 * variable, so we read ANY store's price for ANY item.
 *
 * TWO KINDS OF DEAL, both in `pricing` (schema confirmed via introspection 2026-08-30):
 *   - MARKDOWN        — pricing.value < pricing.original (an advertised was→now cut)
 *   - HIDDEN CLEARANCE — pricing.clearance.value below the shelf value, with
 *                        alternatePriceDisplay=true. This is the number HD hides
 *                        behind "See In-Store Clearance Price" — the whole point.
 * Clearance type = { value, percentageOff, dollarOff }.
 *
 * This REPLACES the Playwright/real-Chrome scanner (hd-clearance-scan.mjs), which had
 * to fight Akamai's browser fingerprint per request. No browser, no proxy pool.
 *
 * ECONOMICS (verified scrapfly.io/pricing + measured): Discovery $30/mo = 200,000
 * credits = 8,000 reads/mo @ 25cr. TRIAGE mode stretches it: read each candidate at
 * ONE store, fan out to all stores only when that store shows a deal signal.
 *
 * USAGE (default store = the biggest HD, #0915 Vauxhall NJ — no --stores needed):
 *   npx tsx scripts/hd-clearance-scan-gql.mts --crawl Tools --limit 200 --out out/hd-reads.json
 *   npx tsx scripts/hd-clearance-scan-gql.mts --items 342880227,205794807 --out out/hd-reads.json
 *   npx tsx scripts/hd-clearance-scan-gql.mts --crawl Tools --limit 96 --stores SA --triage   # opt into SA metro
 * Then publish:
 *   DB_DRIVER=postgres npx tsx src/ingest/hd-clearance-ingest.ts out/hd-reads.json
 *
 * ENV: SCRAPFLY_API_KEY (process.env or .env). --concurrency (default 4).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const SCRAPFLY = 'https://api.scrapfly.io/scrape';
const GQL = 'https://apionline.homedepot.com/federation-gateway/graphql?opname=product';
const PRODUCT_QUERY =
  'query product($itemId:String!,$storeId:String){product(itemId:$itemId){itemId ' +
  'identifiers{brandName modelNumber storeSkuNumber productLabel} ' +
  'pricing(storeId:$storeId){value original message alternatePriceDisplay ' +
  'clearance{value percentageOff dollarOff}}}}';

/**
 * DEFAULT TARGET: the LARGEST Home Depot in the US — the Union/Vauxhall, NJ
 * superstore, store #0915 (2445 Springfield Ave, 07088), 217,000 sq ft, ~2× an
 * average store. Biggest store ⇒ most clearance inventory ⇒ most hits per read.
 * Verified via homedepot.com/l/Union-Vauxhall/NJ/Vauxhall/07088/915 (2026-08-30).
 */
const BIGGEST_STORE = '0915';
/** San Antonio metro HD stores (HD storesearch, ZIP 78232). Opt in with --stores SA. */
const SA_STORES = ['0580', '0581', '0582', '0588', '6544', '6547', '6550', '6551'];

/** Special-Values category → HD nav base (for --crawl discovery). */
const CATEGORY_BASE: Record<string, string> = {
  Appliances: '5yc1vZbv1w', 'Smart-Home': '5yc1vZc1jw', Bath: '5yc1vZbzb3',
  Tools: '5yc1vZc1xy', Lighting: '5yc1vZbvn5', 'Home-Decor': '5yc1vZas6p',
  HVAC: '5yc1vZc4k8', Kitchen: '5yc1vZar4i', Outdoors: '5yc1vZbx82',
  'Storage-Organization': '5yc1vZas7e',
};

function scrapflyKey(): string {
  if (process.env.SCRAPFLY_API_KEY) return process.env.SCRAPFLY_API_KEY;
  try {
    const m = readFileSync(resolve(process.cwd(), '.env'), 'utf8').match(/^SCRAPFLY_API_KEY=(.+)$/m);
    if (m) return m[1].trim();
  } catch { /* fall through */ }
  console.error('SCRAPFLY_API_KEY not set (process.env or .env). Aborting.');
  process.exit(1);
}
const KEY = scrapflyKey();
let creditsSpent = 0;

/** One (item, store) reading — the raw fact, classification happens at ingest. */
export interface ScanRecord {
  itemId: string;
  storeId: string;
  brand: string | null;
  label: string | null;
  model: string | null;
  imageUrl: string | null;
  value: number | null;
  original: number | null;
  alt: boolean | null;
  clearanceValue: number | null;
  clearancePct: number | null;
  error?: string;
}

/** True if this reading shows any kind of deal (used for triage fan-out + summary). */
export function dealSignal(r: ScanRecord): boolean {
  if (r.value != null && r.original != null && r.value < r.original) return true;         // markdown
  if (r.clearanceValue != null && r.value != null && r.clearanceValue < r.value) return true; // hidden
  return false;
}

/** One federation-gateway pricing read for (itemId, storeId), via Scrapfly ASP. */
async function readStorePrice(itemId: string, storeId: string): Promise<ScanRecord> {
  const body = JSON.stringify({ query: PRODUCT_QUERY, variables: { itemId, storeId }, operationName: 'product' });
  const params = new URLSearchParams({
    key: KEY, url: GQL, asp: 'true', country: 'us', method: 'POST',
    'headers[content-type]': 'application/json',
    'headers[x-experience-name]': 'general-merchandise',
  });
  const blank: ScanRecord = {
    itemId, storeId, brand: null, label: null, model: null, imageUrl: null,
    value: null, original: null, alt: null, clearanceValue: null, clearancePct: null,
  };
  try {
    const r = await fetch(`${SCRAPFLY}?${params}`, { method: 'POST', body });
    creditsSpent += Number(r.headers.get('x-scrapfly-api-cost') || 0);
    const j: any = await r.json();
    const product = (() => { try { return JSON.parse(j.result.content).data.product; } catch { return null; } })();
    if (!product) return { ...blank, error: (j.result?.content || '').slice(0, 80) };
    const ids = product.identifiers || {};
    const p = product.pricing || {};
    const clr = p.clearance || {};
    return {
      itemId, storeId,
      brand: ids.brandName ?? null, label: ids.productLabel ?? null, model: ids.modelNumber ?? null,
      imageUrl: product.media?.image?.url ?? null,
      value: p.value ?? null, original: p.original ?? null, alt: p.alternatePriceDisplay ?? null,
      clearanceValue: clr.value ?? null, clearancePct: clr.percentageOff ?? null,
    };
  } catch (e) {
    return { ...blank, error: String(e).slice(0, 80) };
  }
}

/** Bounded-concurrency map — Scrapfly caps parallel requests. */
async function pool<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (idx < items.length) { const i = idx++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

/** DISCOVERY: harvest itemIds from a Special-Values category page (SSR, via Scrapfly ASP). */
async function harvestSpecialValues(category: string, limit: number): Promise<string[]> {
  const base = CATEGORY_BASE[category];
  if (!base) throw new Error(`unknown category "${category}" (known: ${Object.keys(CATEGORY_BASE).join(', ')})`);
  const ids = new Set<string>();
  for (let nao = 0; ids.size < limit && nao <= 480; nao += 48) {
    const target = `https://www.homedepot.com/b/${category}/Special-Values/N-${base}Z7?Nao=${nao}`;
    const r = await fetch(`${SCRAPFLY}?${new URLSearchParams({ key: KEY, url: target, asp: 'true', country: 'us' })}`);
    creditsSpent += Number(r.headers.get('x-scrapfly-api-cost') || 0);
    const html = ((await r.json()).result?.content as string) || '';
    const before = ids.size;
    for (const m of html.matchAll(/"itemId":"(\d{9,10})"/g)) ids.add(m[1]);
    if (ids.size === before) break;
  }
  return [...ids].slice(0, limit);
}

function parseArgs(argv: string[]) {
  const a = { items: [] as string[], stores: [BIGGEST_STORE], crawl: null as string | null,
    limit: 96, triage: false, concurrency: 4, out: null as string | null };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--items') a.items = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (k === '--stores') {
      const v = argv[++i]; const u = v.toUpperCase();
      a.stores = u === 'SA' ? SA_STORES : u === 'BIG' || u === 'BIGGEST' ? [BIGGEST_STORE] : v.split(',').map((s) => s.trim()).filter(Boolean);
    }
    else if (k === '--crawl') a.crawl = argv[++i];
    else if (k === '--limit') a.limit = Number(argv[++i]);
    else if (k === '--triage') a.triage = true;
    else if (k === '--concurrency') a.concurrency = Number(argv[++i]);
    else if (k === '--out') a.out = argv[++i];
  }
  return a;
}

async function main() {
  const args = parseArgs(process.argv);
  let items = args.items;
  if (args.crawl) {
    console.log(`[crawl] harvesting itemIds from ${args.crawl} Special-Values (limit ${args.limit})…`);
    items = await harvestSpecialValues(args.crawl, args.limit);
    console.log(`[crawl] found ${items.length} candidate itemIds (${creditsSpent} credits so far)`);
  }
  if (!items.length) { console.error('nothing to scan — pass --items or --crawl'); process.exit(1); }

  const stores = args.stores;
  const records: ScanRecord[] = [];

  if (args.triage && stores.length > 1) {
    const anchor = stores[0];
    console.log(`[triage] ${items.length} items @ anchor ${anchor}; fan out on a deal signal to ${stores.length - 1} more`);
    const triaged = await pool(items, args.concurrency, (id) => readStorePrice(id, anchor));
    records.push(...triaged);
    const promising = triaged.filter(dealSignal).map((r) => r.itemId);
    console.log(`[triage] ${promising.length}/${items.length} show a deal at anchor; fanning out`);
    const pairs = promising.flatMap((id) => stores.slice(1).map((s) => ({ id, s })));
    records.push(...await pool(pairs, args.concurrency, (p) => readStorePrice(p.id, p.s)));
  } else {
    const pairs = items.flatMap((id) => stores.map((s) => ({ id, s })));
    console.log(`[grid] ${items.length} items × ${stores.length} stores = ${pairs.length} reads`);
    records.push(...await pool(pairs, args.concurrency, (p, i) => {
      if (i && i % 20 === 0) console.log(`  …${i}/${pairs.length} (${creditsSpent} credits)`);
      return readStorePrice(p.id, p.s);
    }));
  }

  const deals = records.filter(dealSignal);
  const dollars = (creditsSpent / 200_000) * 30;
  console.log(`\nDONE: ${records.length} reads, ${deals.length} with a deal signal.`);
  console.log(`Scrapfly credits: ${creditsSpent} (~$${dollars.toFixed(3)}; ${Math.round(creditsSpent / 25)} reads @ 25cr)`);
  for (const r of deals.slice(0, 15)) {
    const hidden = r.clearanceValue != null && r.value != null && r.clearanceValue < r.value;
    const price = hidden ? r.clearanceValue! : r.value!;
    const was = hidden ? r.value! : r.original!;
    const pct = Math.round(((was - price) / was) * 100);
    console.log(`  ${hidden ? '🔒HIDDEN' : '🎯MARK  '} ${r.itemId} @ ${r.storeId}  $${price.toFixed(2)}/$${was.toFixed(2)} (-${pct}%)  ${r.brand ?? ''} ${(r.label ?? '').slice(0, 36)}`);
  }
  if (args.out) {
    const path = resolve(process.cwd(), args.out);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(records, null, 2));
    console.log(`\nwrote ${records.length} reads -> ${args.out}`);
    console.log(`publish: DB_DRIVER=postgres npx tsx src/ingest/hd-clearance-ingest.ts ${args.out}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
