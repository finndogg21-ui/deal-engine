#!/usr/bin/env node
/**
 * HD IN-STORE (HIDDEN) CLEARANCE SCANNER — headless real-Chrome via residential proxy.
 *
 * WHY THIS EXISTS: HD exposes store-specific in-store clearance ONLINE (yellow CLEARANCE badge +
 * "See In-Store Clearance Price"), but it is (a) store-specific, (b) served behind HD's Akamai Bot
 * Manager, and (c) has no "list all clearance" feed — you must check items you already have, per store.
 * Proven live 2026-08-29: Dimex spikes itemId 205794807 @ store 0883 = $4.00 (90% off $39.97),
 * Aisle 38 Bay EC3. See company/hidden-clearance-scanner-spec.md.
 *
 * AKAMAI REALITY: residential proxies defeat the IP wall; Akamai ALSO fingerprints the browser via a
 * JS sensor (the _abck cookie). So we drive REAL Chrome (channel:'chrome') which executes that sensor,
 * routed through your proxy. Raw HTTP-through-proxy would still 403.
 *
 * DERISK FIRST — before trusting any scan, run:  node scripts/hd-clearance-scan.mjs --derisk
 * It checks the known $4 spikes at store 0883 and tells you PASS (read the price, no block) or BLOCKED.
 *
 * SETUP:
 *   npm i -D playwright && npx playwright install chrome
 *   export HD_PROXY="host:port:user:pass"      # or user:pass@host:port or http://user:pass@host:port
 *   node scripts/hd-clearance-scan.mjs --derisk
 *   node scripts/hd-clearance-scan.mjs --store 0883 --items 205794807,206040560 --out hits.json
 *   node scripts/hd-clearance-scan.mjs --crawl "https://www.homedepot.com/b/Outdoors-Garden-Center/N-5yc1vZbx82" --limit 240 --store 0883
 *
 * ENV: HD_PROXY (proxy string) · HD_HEADLESS ("0" for headful, most stealthy) · HD_STORE (default store)
 */
import { addExtra } from 'playwright-extra';
import { chromium as _chromium } from 'playwright-core'; // drives system Chrome via channel:'chrome'
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { writeFileSync } from 'node:fs';

// Wrap the Chrome driver with stealth evasions (patches navigator.webdriver, CDP/automation tells, etc.)
const chromium = addExtra(_chromium);
chromium.use(StealthPlugin());

const SPIKES = { itemId: '205794807', store: '0883', expectClearance: 4.0 }; // the proven known-good

/** Accept host:port:user:pass | user:pass@host:port | http(s)://user:pass@host:port | host:port */
function parseProxy(raw) {
  if (!raw) return null;
  raw = raw.trim();
  let scheme = 'http';
  const sm = raw.match(/^(https?|socks5):\/\//i);
  if (sm) { scheme = sm[1].toLowerCase(); raw = raw.slice(sm[0].length); }
  let host, port, username, password;
  if (raw.includes('@')) {
    const [cred, hp] = raw.split('@');
    [username, password] = cred.split(':');
    [host, port] = hp.split(':');
  } else {
    const parts = raw.split(':');
    if (parts.length === 4) [host, port, username, password] = parts;
    else if (parts.length === 2) [host, port] = parts;
    else throw new Error(`unrecognized HD_PROXY format: ${raw.slice(0, 12)}…`);
  }
  return { server: `${scheme}://${host}:${port}`, username, password };
}

/** A context that looks like a normal San Antonio shopper, with light anti-fingerprint touches. */
async function newContext(browser) {
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    viewport: { width: 1512, height: 900 },
    locale: 'en-US',
    timezoneId: 'America/Chicago',
    deviceScaleFactor: 2,
  });
  // Mask the most obvious headless tells. (If Akamai still flags us, upgrade to playwright-extra + stealth.)
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    // eslint-disable-next-line no-undef
    window.chrome = window.chrome || { runtime: {} };
  });
  return ctx;
}

const BLOCK_RE = /Access Denied|Pardon Our Interruption|Bot Manager|Reference #\d|unusual traffic|are you a human/i;

/** Warm up the session on a CLEAN IP: hit the homepage so Akamai's JS sensor sets a valid _abck
 *  cookie before we request product pages. Won't rescue an already-flagged IP — that needs a fresh proxy. */
async function warmup(page) {
  try {
    const r = await page.goto('https://www.homedepot.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2500 + Math.floor(Math.random() * 1500));
    return { status: r ? r.status() : 0 };
  } catch (e) { return { status: -1, error: String(e).slice(0, 80) }; }
}

/** Navigate to a product localized to a store, detecting an Akamai block. */
async function gotoProduct(page, itemId, storeId) {
  const url = `https://www.homedepot.com/p/${itemId}?store=${storeId}`;
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const status = resp ? resp.status() : 0;
  // let client-side pricing/fulfillment render
  await page.waitForTimeout(2500);
  const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 3000) || '');
  if (status === 403 || status === 429 || BLOCK_RE.test(bodyText)) {
    return { blocked: true, status };
  }
  return { blocked: false, status };
}

/** Read the in-store clearance for the currently-loaded product page. Returns null if not on clearance. */
async function extractClearance(page, itemId, storeId) {
  // Reveal the clearance popup if the link is present.
  const link = page.getByText('See In-Store Clearance Price', { exact: false }).first();
  const hasLink = (await link.count()) > 0;
  if (hasLink) {
    try { await link.click({ timeout: 4000 }); await page.waitForTimeout(700); } catch { /* popup may render inline */ }
  }
  return await page.evaluate(({ itemId, storeId }) => {
    const t = document.body.innerText;
    const badge = /In-Store Clearance/i.test(t) || document.querySelector('[alt*="Clearance" i]') != null;
    if (!badge) return { itemId, storeId, onClearance: false };
    const online = (t.match(/Online Price\s*\$([\d,]+\.\d{2})/) || [])[1];
    const save = t.match(/Save\s*\$([\d,]+\.\d{2})\s*\((\d+)%\)/);
    const storeName = (t.match(/Visit\s+([A-Za-z0-9 .,'-]+?)\s+to purchase/) || [])[1] || null;
    const aisle = t.match(/Aisle\s+([\w-]+),?\s*Bay\s+([\w-]+)/i);
    const qty = (t.match(/(\d+)\s+in stock/i) || [])[1];
    const onlineP = online ? parseFloat(online.replace(/,/g, '')) : null;
    const saveP = save ? parseFloat(save[1].replace(/,/g, '')) : null;
    const clearance = onlineP != null && saveP != null ? Math.round((onlineP - saveP) * 100) / 100 : null;
    return {
      itemId, storeId, onClearance: clearance != null,
      clearancePrice: clearance, onlinePrice: onlineP,
      savings: saveP, pct: save ? Number(save[2]) : null,
      store: storeName, aisle: aisle ? aisle[1] : null, bay: aisle ? aisle[2] : null,
      qty: qty ? Number(qty) : null,
    };
  }, { itemId, storeId });
}

/** Check one item at one store. Throws {blocked:true} info up so the caller can slow down / rotate. */
async function checkItem(page, itemId, storeId) {
  const nav = await gotoProduct(page, itemId, storeId);
  if (nav.blocked) return { itemId, storeId, blocked: true, status: nav.status };
  return await extractClearance(page, itemId, storeId);
}

/** DISCOVERY: pull itemIds from an HD category/browse URL (paginate with ?Nao=0,24,48,…). */
async function crawlCategory(page, baseUrl, limit) {
  const ids = new Set();
  for (let nao = 0; ids.size < limit && nao <= 480; nao += 24) {
    const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + `Nao=${nao}`;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(1200);
      const html = await page.content();
      let m; const re = /"itemId":"(\d{9,10})"/g;
      const before = ids.size;
      while ((m = re.exec(html)) !== null) ids.add(m[1]);
      if (ids.size === before) break; // no new ids -> end of catalog
    } catch { break; }
  }
  return [...ids].slice(0, limit);
}

function parseArgs(argv) {
  const a = { store: process.env.HD_STORE || '0883', items: [], crawl: null, limit: 240, out: null, derisk: false };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--derisk') a.derisk = true;
    else if (k === '--store') a.store = argv[++i];
    else if (k === '--items') a.items = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (k === '--crawl') a.crawl = argv[++i];
    else if (k === '--limit') a.limit = Number(argv[++i]);
    else if (k === '--out') a.out = argv[++i];
  }
  return a;
}

async function main() {
  const args = parseArgs(process.argv);
  const proxy = parseProxy(process.env.HD_PROXY);
  if (!proxy && !args.derisk) console.warn('[warn] no HD_PROXY set — running on your raw IP (Akamai will likely block at volume).');
  const headless = process.env.HD_HEADLESS !== '0';

  const browser = await chromium.launch({ headless, channel: 'chrome', proxy: proxy || undefined });
  const ctx = await newContext(browser);
  const page = await ctx.newPage();
  try {
    const w = await warmup(page); // establish Akamai session before product hits
    console.log('[warmup] homepage status', w.status, w.error || '');

    if (args.derisk) {
      console.log(`[derisk] proxy=${proxy ? proxy.server : 'NONE'} headless=${headless} — checking spikes ${SPIKES.itemId} @ store ${SPIKES.store}`);
      const r = await checkItem(page, SPIKES.itemId, SPIKES.store);
      if (r.blocked) { console.log(`[derisk] ❌ BLOCKED (status ${r.status}). Akamai fingerprinted us — try headful (HD_HEADLESS=0), a fresh proxy, or add playwright-extra stealth.`); process.exit(2); }
      const ok = r.onClearance && Math.abs((r.clearancePrice ?? -1) - SPIKES.expectClearance) < 0.5;
      console.log('[derisk] result:', JSON.stringify(r));
      console.log(ok ? '[derisk] ✅ PASS — headless+proxy read the hidden clearance. The rig gets through Akamai. Scale it.'
                     : '[derisk] ⚠️  got through but did not read the expected $4 — extraction or store-localization needs a tweak.');
      process.exit(ok ? 0 : 1);
    }

    let items = args.items;
    if (args.crawl) {
      console.log(`[crawl] discovering itemIds from ${args.crawl} (limit ${args.limit})`);
      items = await crawlCategory(page, args.crawl, args.limit);
      console.log(`[crawl] found ${items.length} itemIds`);
    }
    if (!items.length) { console.error('nothing to scan — pass --items or --crawl'); process.exit(1); }

    const hits = [];
    let blocked = 0;
    for (let i = 0; i < items.length; i++) {
      const r = await checkItem(page, items[i], args.store);
      if (r.blocked) { blocked++; console.warn(`[${i + 1}/${items.length}] BLOCKED on ${items[i]} — back off / rotate proxy`); await page.waitForTimeout(4000); continue; }
      if (r.onClearance) { hits.push(r); console.log(`[${i + 1}/${items.length}] 🎯 ${items[i]} $${r.clearancePrice}/$${r.onlinePrice} (${r.pct}% off) @ ${r.store} Aisle ${r.aisle} Bay ${r.bay} qty ${r.qty}`); }
      else console.log(`[${i + 1}/${items.length}] – ${items[i]} not on clearance @ ${args.store}`);
      await page.waitForTimeout(600 + Math.floor(Math.random() * 700)); // polite jitter
    }
    hits.sort((x, y) => (y.savings ?? 0) - (x.savings ?? 0));
    console.log(`\nDONE: ${hits.length} clearance hits / ${items.length} checked (${blocked} blocked).`);
    if (args.out) { writeFileSync(args.out, JSON.stringify(hits, null, 2)); console.log(`wrote ${args.out}`); }
    else console.log(JSON.stringify(hits, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
