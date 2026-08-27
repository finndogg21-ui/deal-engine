/**
 * Generic Shopify storefront adapter — any store that leaves its standard
 * `/products.json` open (most do) becomes a $0 structured deal source.
 *
 * Verified against Ollie's (ollies.com) and Grove (grove.co) 2026-08-27: plain
 * GET, HTTP 200, no auth, every variant may carry `compare_at_price` > `price`.
 * We publish only variants that do (real markdowns), and exclude food-ish
 * product_types per the founder's "not food" rule.
 */

import type { RegularDeal } from '../ingest/regular-deals.js';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const FOOD_TYPES = /^(food|candy|grocery|beverages?|snacks?|coffee|tea|wine|pantry|supplements?)$/i;

interface ShopifyVariant { id: number; price: string; compare_at_price: string | null; }
interface ShopifyProduct {
  id: number; title: string; handle: string; product_type: string;
  variants: ShopifyVariant[]; images: { src: string }[];
}

export interface ShopifyOptions {
  /** e.g. "www.ollies.com" */
  domain: string;
  /** How the retailer is keyed in our pool (e.g. "ollies", "grove"). */
  retailer: string;
  maxPages?: number;
  /** Extra product_type exclusions on top of the food defaults. */
  excludeTypes?: RegExp;
}

export function shopifyToDeal(p: ShopifyProduct, domain: string, extraExclude?: RegExp): RegularDeal | null {
  const type = p.product_type ?? '';
  if (FOOD_TYPES.test(type) || (extraExclude && extraExclude.test(type))) return null;
  let best: { price: number; list: number } | null = null;
  for (const v of p.variants ?? []) {
    const price = Number(v.price);
    const list = v.compare_at_price ? Number(v.compare_at_price) : NaN;
    if (price > 0 && list > price && (!best || price < best.price)) best = { price, list };
  }
  if (!best) return null;
  return {
    itemId: String(p.id),
    sku: String(p.id),
    title: p.title.trim(),
    imageUrl: p.images?.[0]?.src ?? null,
    productUrl: `https://${domain}/products/${p.handle}`,
    price: best.price,
    listPrice: best.list,
  };
}

export async function fetchShopifyDeals(opts: ShopifyOptions): Promise<RegularDeal[]> {
  const maxPages = opts.maxPages ?? 6;
  const out: RegularDeal[] = [];
  for (let page = 1; page <= maxPages; page++) {
    let products: ShopifyProduct[] = [];
    try {
      const res = await fetch(`https://${opts.domain}/products.json?limit=250&page=${page}`, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`${opts.domain} page ${page}: ${res.status}`);
      products = ((await res.json()) as { products: ShopifyProduct[] }).products ?? [];
    } catch (err) {
      console.error(`  ${opts.retailer} page ${page} failed: ${(err as Error).message}`);
      break;
    }
    if (products.length === 0) break;
    for (const p of products) {
      const d = shopifyToDeal(p, opts.domain, opts.excludeTypes);
      if (d) out.push(d);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return out;
}
