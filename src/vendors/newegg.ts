/**
 * NEWEGG adapter — free, server-rendered, no bot wall.
 *
 * Verified 2026-08-27 (two independent probes): newegg.com fronts with
 * Cloudflare in PASSIVE cache mode, not challenge mode — a plain GET with a
 * browser UA returns full HTML (no _abck/datadome/px markers). Deal/clearance
 * listing pages carry per-item prices in server HTML under the `goods-*`
 * classes, so no JS render and no key are needed.
 *
 * Structure (per item, inside a `goods-info` block):
 *   <a href="...newegg.com/.../p/N82E...?Item=N82E..." class="goods-title">TITLE</a>
 *   <div class="goods-price-current"> ... <strong>100</strong><sup>.00</sup>
 *   <div class="goods-price-was">$296.99</div>
 *   image in the preceding `goods-img` block.
 *
 * Politeness: a handful of listing pages, low frequency, one UA. If Cloudflare
 * ever flips to challenge mode, fall back to the ~$4/1k Apify actor (on standby,
 * not wired).
 */

import type { RegularDeal } from '../ingest/regular-deals.js';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

/** Deal/clearance listing pages. Shell Shocker + refurb/clearance event stores. */
export const NEWEGG_FEEDS = [
  'https://www.newegg.com/Refurbished-Products/EventSaleStore/ID-9447',
  'https://www.newegg.com/todays-deals',
];

/** Titles that are not resellable goods — gift cards, warranties, services. */
const JUNK = /\bgift card\b|\be-?gift\b|\bwarranty\b|\bprotection plan\b|\bsubscription\b|\bdigital download\b|\bsoftware download\b/i;

const clean = (s: string) =>
  s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();

/** Parse one Newegg listing page's HTML into deals. Exported for offline tests. */
export function parseNewegg(html: string): RegularDeal[] {
  const blocks = html.split('class="goods-info"').slice(1);
  const deals: RegularDeal[] = [];

  for (const b of blocks) {
    const titleM = b.match(/class="goods-title"[^>]*>(.*?)<\/a>/s);
    const hrefM = b.match(/href="(https:\/\/www\.newegg\.com\/[^"]+)"[^>]*class="goods-title"/s)
      ?? b.match(/<a[^>]+href="(https:\/\/www\.newegg\.com\/[^"]+)"[^>]*class="goods-title"/s);
    const idM = b.match(/[?&]Item=([0-9A-Za-z]+)/) ?? b.match(/\/p\/(N82E[0-9A-Z]+)/);
    const curM = b.match(/goods-price-current[\s\S]{0,160}?goods-price-value"><strong>([\d,]+)<\/strong><sup>(\.\d{2})/);
    const wasM = b.match(/goods-price-was">\s*\$?([\d,]+\.\d{2})/);

    if (!titleM || !curM || !idM) continue;
    const title = clean(titleM[1]!);
    if (!title || JUNK.test(title)) continue;

    const price = Number(curM[1]!.replace(/,/g, '') + curM[2]!);
    const listPrice = wasM ? Number(wasM[1]!.replace(/,/g, '')) : NaN;
    if (!(price > 0) || !(listPrice > price)) continue; // real markdown only

    const imgM = b.match(/<img[^>]+src="(https:[^"]+)"/);
    deals.push({
      itemId: idM[1]!,
      sku: idM[1]!,
      title,
      imageUrl: imgM ? imgM[1]! : null,
      productUrl: hrefM ? hrefM[1]!.split('?')[0]! : `https://www.newegg.com/p/${idM[1]}`,
      price,
      listPrice,
    });
  }
  return deals;
}

async function get(url: string): Promise<string> {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
  });
  if (!res.ok) throw new Error(`Newegg ${url}: ${res.status} ${res.statusText}`);
  return res.text();
}

export async function fetchNeweggDeals(): Promise<RegularDeal[]> {
  const byId = new Map<string, RegularDeal>();
  for (const url of NEWEGG_FEEDS) {
    try {
      const html = await get(url);
      for (const d of parseNewegg(html)) if (!byId.has(d.itemId)) byId.set(d.itemId, d);
    } catch (err) {
      console.error(`  newegg feed failed: ${(err as Error).message}`);
    }
  }
  return [...byId.values()];
}
