// Full-site capture for the hostile-critic panel: every route at phone (375x812)
// and desktop (1280x800). Saves viewport + full-page PNGs, an ARIA snapshot, console
// errors, and hard mobile metrics (overflow, <44px tap targets, smallest font,
// chrome height above the first deal card). Output: out/capture/<viewport>/<slug>.*
import { launch } from 'cloakbrowser';
import fs from 'node:fs';
const BASE = 'https://summitclearance.com';
const ROUTES = [
  ['landing','/'],['app-all','/app'],['app-hidden','/app?tab=hidden'],['app-hd','/app?store=home-depot'],
  ['app-target','/app?store=target'],['app-hd-penny','/app?store=home-depot&tab=penny'],['app-near','/app?tab=near'],
  ['app-walmart','/app?store=walmart'],['pricing','/pricing'],['faq','/faq'],['how-it-works','/how-it-works'],
  ['about','/about'],['contact','/contact'],['signin','/signin'],['signup','/signup'],['forgot','/forgot'],
  ['amazon','/amazon'],['privacy','/privacy'],['terms','/terms'],['stores-hd','/stores/home-depot'],
  ['app-penny','/app/penny'],['app-report','/app/report'],['app-watchlist','/app/watchlist'],['welcome','/welcome'],['not-found','/nope-404'],
];
const VIEWPORTS = { m375: { width: 375, height: 812, isMobile: true, hasTouch: true }, d1280: { width: 1280, height: 800, isMobile: false, hasTouch: false } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const manifest = { startedAt: new Date().toISOString(), pages: [] };
const browser = await launch({ headless: true });
try {
  // Discover one real deal-detail URL from the feed so the panel sees the detail page too.
  const routes = [...ROUTES];
  try {
    const ctx0 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const p0 = await ctx0.newPage();
    await p0.goto(BASE + '/app', { waitUntil: 'load', timeout: 45000 });
    try { await p0.waitForSelector('.card-deal, .empty', { timeout: 20000 }); } catch {}
    await sleep(2000);
    const href = await p0.evaluate(() => { const a = document.querySelector('a[href*="/app/d/"], a[href*="/app/deal/"]'); return a ? a.getAttribute('href') : null; });
    if (href) routes.splice(2, 0, ['deal-detail', href]);
    manifest.dealDetailHref = href;
    await ctx0.close();
  } catch (e) { manifest.dealDetailErr = String(e.message).slice(0, 200); }

  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    const dir = `out/capture/${vpName}`; fs.mkdirSync(dir, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
    for (const [slug, path] of routes) {
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
      page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message).slice(0, 200)));
      const rec = { slug, path, viewport: vpName, url: BASE + path };
      try {
        const resp = await page.goto(BASE + path, { waitUntil: 'load', timeout: 45000 });
        rec.status = resp && resp.status();
        // App pages poll forever (stock worker / health), so networkidle never settles — wait for content instead.
        try { await page.waitForSelector('.card-deal, .empty, .deck, article, h1', { timeout: 15000 }); } catch {}
        await sleep(2500);
        rec.finalUrl = page.url();
        rec.title = await page.title();
        await page.screenshot({ path: `${dir}/${slug}.png`, scale: 'css' });
        await page.screenshot({ path: `${dir}/${slug}.full.png`, scale: 'css', fullPage: true });
        try { fs.writeFileSync(`${dir}/${slug}.aria.txt`, await page.locator('body').ariaSnapshot()); } catch (e) { rec.ariaErr = String(e.message).slice(0, 120); }
        rec.metrics = await page.evaluate(() => {
          const vw = window.innerWidth;
          const overflowX = document.documentElement.scrollWidth > vw + 1;
          const els = Array.from(document.querySelectorAll('a,button,[role="button"],input,select,[role="tab"]'));
          const small = [];
          for (const el of els) { const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue; if (r.width < 44 || r.height < 44) small.push({ tag: el.tagName.toLowerCase(), text: (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) }); }
          let minFont = 99; const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          let n; let checked = 0; while ((n = walker.nextNode()) && checked < 3000) { if (!n.textContent.trim()) continue; const el = n.parentElement; if (!el) continue; const r = el.getBoundingClientRect(); if (r.width === 0) continue; const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < minFont) minFont = fs; checked++; }
          const firstCard = document.querySelector('.card-deal, .deck > *, article');
          const chromeAboveFeed = firstCard ? Math.round(firstCard.getBoundingClientRect().top + window.scrollY) : null;
          const cardsInFirstViewport = Array.from(document.querySelectorAll('.card-deal')).filter((c) => { const r = c.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight; }).length;
          const h1 = document.querySelector('h1'); const h1fs = h1 ? parseFloat(getComputedStyle(h1).fontSize) : null;
          return { docHeight: document.documentElement.scrollHeight, overflowX, smallTapTargets: small.length, smallTapSample: small.slice(0, 12), minFontPx: minFont === 99 ? null : minFont, chromeAboveFeedPx: chromeAboveFeed, cardsFullyInFirstViewport: cardsInFirstViewport, h1FontPx: h1fs, cardCount: document.querySelectorAll('.card-deal').length };
        });
        rec.consoleErrors = errors.slice(0, 10);
      } catch (e) { rec.error = String(e.message).slice(0, 300); }
      manifest.pages.push(rec);
      console.log(vpName, slug, rec.status || rec.error, rec.metrics ? `overflowX=${rec.metrics.overflowX} small=${rec.metrics.smallTapTargets} minFont=${rec.metrics.minFontPx} chrome=${rec.metrics.chromeAboveFeedPx} cardsVis=${rec.metrics.cardsFullyInFirstViewport}` : '');
      await page.close();
    }
    await ctx.close();
  }
} finally { await browser.close(); }
manifest.endedAt = new Date().toISOString();
fs.writeFileSync('out/capture/manifest.json', JSON.stringify(manifest, null, 2));
console.log('DONE', manifest.pages.length, 'captures -> out/capture/manifest.json');
