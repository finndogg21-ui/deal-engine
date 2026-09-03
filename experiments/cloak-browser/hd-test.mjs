// Experiment: can a FREE stealth Chromium (cloakbrowser) read Home Depot's per-store
// price with NO paid unlocker? Front door = /p/ page (Akamai). Then replay the
// federation-gateway GraphQL FROM the page context (same cookies + real TLS).
import { launch } from 'cloakbrowser';
import fs from 'node:fs';
const out = { startedAt: new Date().toISOString(), steps: [] };
const log = (s, extra = {}) => { out.steps.push({ s, ...extra }); console.log(s, JSON.stringify(extra).slice(0, 400)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let browser;
try {
  browser = await launch({ headless: true });
  const page = await browser.newPage();
  log('launched');
  const fp = await page.evaluate(() => ({ webdriver: navigator.webdriver, ua: navigator.userAgent, plugins: navigator.plugins.length, lang: navigator.language }));
  log('fingerprint', fp);
  const resp = await page.goto('https://www.homedepot.com/p/205794807', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(5000);
  const title = await page.title();
  const bodyText = await page.evaluate(() => (document.body && document.body.innerText ? document.body.innerText.slice(0, 500) : ''));
  const blocked = /access denied|reference #|pardon our interruption|blocked/i.test(bodyText + ' ' + title);
  const cookies = await page.context().cookies();
  const abck = cookies.find((c) => c.name === '_abck');
  log('hd-page', { status: resp && resp.status(), title, blocked, abck: !!abck, abckLen: abck && abck.value.length, bodyPeek: bodyText.slice(0, 160) });
  const gql = (itemId, storeId) => page.evaluate(async ({ itemId, storeId }) => {
    const r = await fetch('https://apionline.homedepot.com/federation-gateway/graphql?opname=product', {
      method: 'POST', credentials: 'include',
      headers: { 'content-type': 'application/json', 'x-experience-name': 'general-merchandise' },
      body: JSON.stringify({ query: 'query product($itemId:String!,$storeId:String){product(itemId:$itemId){identifiers{brandName modelNumber productLabel} pricing(storeId:$storeId){value original alternatePriceDisplay clearance{value percentageOff dollarOff}}}}', variables: { itemId, storeId }, operationName: 'product' }),
    });
    const t = await r.text();
    return { status: r.status, body: t.slice(0, 700) };
  }, { itemId, storeId });
  log('gql-342880227@0582', await gql('342880227', '0582')); await sleep(2500);
  log('gql-342880227@0915', await gql('342880227', '0915')); await sleep(2500);
  log('gql-205794807@0883', await gql('205794807', '0883'));
} catch (e) { log('ERROR', { msg: String((e && e.message) || e).slice(0, 600) }); }
finally { try { if (browser) await browser.close(); } catch {} }
out.endedAt = new Date().toISOString();
fs.mkdirSync('out', { recursive: true });
fs.writeFileSync('out/hd-test-1.json', JSON.stringify(out, null, 2));
console.log('DONE -> out/hd-test-1.json');
