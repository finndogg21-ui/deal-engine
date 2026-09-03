/**
 * Cloak volume probe — how many per-store Home Depot pricing reads can a FREE stealth
 * Chromium (cloakbrowser) do from the home IP, no proxy, before Akamai pushes back?
 * Warm up on one /p/ page (acquire _abck), then replay the federation-gateway GraphQL
 * from the page context (real cookies + real TLS). Emits ingest-compatible ScanRecord[].
 *
 *   npx tsx scripts/hd-cloak-probe.mts --seed experiments/cloak-browser/out/seed-items.json \
 *     --stores 0582,0915 --spacing 1800 --out experiments/cloak-browser/out
 *   DB_DRIVER=postgres npx tsx src/ingest/hd-clearance-ingest.ts experiments/cloak-browser/out/hd-cloak-reads.json
 */
// @ts-ignore — cloakbrowser ships JS; types optional
import { launch } from 'cloakbrowser';
import fs from 'node:fs';
import path from 'node:path';

/** Mirrors ScanRecord in scripts/hd-clearance-scan-gql.mts (kept in sync by hand). */
interface ScanRecord { itemId: string; storeId: string; brand: string | null; label: string | null; model: string | null; imageUrl: string | null; value: number | null; original: number | null; alt: boolean | null; clearanceValue: number | null; clearancePct: number | null; error?: string }
const arg = (k: string, d: string) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const seedPath = arg('--seed', 'experiments/cloak-browser/out/seed-items.json');
const stores = arg('--stores', '0582,0915').split(',');
const spacing = Number(arg('--spacing', '1800'));
const outDir = arg('--out', 'experiments/cloak-browser/out');
const maxReads = Number(arg('--max', '10000'));
const seed: Array<{ item_id: string }> = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
const items = [...new Set(seed.map((s) => String(s.item_id)))];
const QUERY = 'query product($itemId:String!,$storeId:String){product(itemId:$itemId){itemId identifiers{brandName modelNumber productLabel} pricing(storeId:$storeId){value original message alternatePriceDisplay clearance{value percentageOff dollarOff}}}}';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const records: ScanRecord[] = []; const log: any[] = []; const hist: Record<string, number> = {};
let consecutiveBad = 0; let firstFailAt: number | null = null;
const browser = await launch({ headless: true });
try {
  const page = await browser.newPage();
  const warm = await page.goto(`https://www.homedepot.com/p/${items[0]}`, { waitUntil: 'load', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 15000 }); } catch { /* HD keeps polling */ }
  await sleep(3000);
  const cookies = await page.context().cookies();
  console.log('warm-up', warm && warm.status(), 'abck', !!cookies.find((c: any) => c.name === '_abck'), 'items', items.length, 'stores', stores.join('/'));
  let n = 0;
  outer: for (const itemId of items) {
    for (const storeId of stores) {
      if (n >= maxReads) break outer;
      const started = Date.now();
      const readOnce = () => page.evaluate(async ({ itemId, storeId, QUERY }: any) => {
        try {
          const r = await fetch('https://apionline.homedepot.com/federation-gateway/graphql?opname=product', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json', 'x-experience-name': 'general-merchandise' }, body: JSON.stringify({ query: QUERY, variables: { itemId, storeId }, operationName: 'product' }) });
          const t = await r.text(); return { status: r.status, text: t.slice(0, 2000) };
        } catch (e) { return { status: 0, text: String(e) }; }
      }, { itemId, storeId, QUERY });
      let res: { status: number; text: string } = { status: -1, text: 'retry-exhausted' };
      for (let attempt = 0; attempt < 3; attempt++) {
        try { res = await readOnce(); break; }
        catch (e) { const m = String(e); if (attempt < 2 && /context was destroyed|navigation|Target closed/i.test(m)) { await sleep(2500); continue; } res = { status: -1, text: m.slice(0, 200) }; break; }
      }
      const ms = Date.now() - started; n++;
      hist[res.status] = (hist[res.status] || 0) + 1;
      const blank: ScanRecord = { itemId, storeId, brand: null, label: null, model: null, imageUrl: null, value: null, original: null, alt: null, clearanceValue: null, clearancePct: null };
      let rec: ScanRecord = blank; let product: any = null;
      try { product = JSON.parse(res.text).data?.product; } catch { /* non-JSON = block page */ }
      if (res.status === 200 && product) {
        consecutiveBad = 0;
        const ids = product.identifiers || {}; const p = product.pricing || {}; const clr = p.clearance || {};
        rec = { itemId, storeId, brand: ids.brandName ?? null, label: ids.productLabel ?? null, model: ids.modelNumber ?? null, imageUrl: null, value: p.value ?? null, original: p.original ?? null, alt: p.alternatePriceDisplay ?? null, clearanceValue: clr.value ?? null, clearancePct: clr.percentageOff ?? null };
      } else { consecutiveBad++; if (firstFailAt === null) firstFailAt = n; rec = { ...blank, error: `${res.status} ${res.text.slice(0, 120)}` }; }
      records.push(rec);
      const hidden = rec.clearanceValue != null && rec.value != null && rec.clearanceValue < rec.value;
      const markdown = rec.value != null && rec.original != null && rec.value < rec.original;
      log.push({ n, itemId, storeId, status: res.status, ms, hidden, markdown });
      if (n % 10 === 0 || hidden || res.status !== 200) console.log(`#${n} ${itemId}@${storeId} ${res.status} ${ms}ms${hidden ? ` HIDDEN ${rec.clearanceValue}/${rec.value}` : markdown ? ` md ${rec.value}/${rec.original}` : ''}`);
      if (consecutiveBad >= 3) { console.log('STOP: 3 consecutive non-200 at read', n, res.status, res.text.slice(0, 200)); break outer; }
      await sleep(spacing + Math.floor(Math.random() * 700));
    }
  }
} finally { await browser.close(); }
const elapsed = Math.round((Date.now() - t0) / 1000);
const hiddenN = records.filter((r) => r.clearanceValue != null && r.value != null && r.clearanceValue < r.value).length;
const mdN = records.filter((r) => r.value != null && r.original != null && r.value < r.original).length;
const summary = { reads: records.length, ok: records.filter((r) => !r.error).length, statusHistogram: hist, hidden: hiddenN, markdown: mdN, elapsedSec: elapsed, readsPerMin: +(records.length / Math.max(1, elapsed / 60)).toFixed(1), firstFailAt, stores, items: items.length, spacingMs: spacing };
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'hd-cloak-reads.json'), JSON.stringify(records, null, 1));
fs.writeFileSync(path.join(outDir, 'hd-cloak-probe-summary.json'), JSON.stringify({ summary, log }, null, 1));
console.log('SUMMARY', JSON.stringify(summary));
