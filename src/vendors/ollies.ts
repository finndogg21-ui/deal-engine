/**
 * OLLIE'S BARGAIN OUTLET adapter — free, structured, no bot wall.
 *
 * Verified 2026-08-27: ollies.com runs a public Shopify storefront whose
 * standard JSON endpoints are wide open (plain GET, HTTP 200, no auth, no
 * challenge). `/products.json?limit=250&page=N` enumerates the national
 * catalog; EVERY variant carries a real `compare_at_price` > `price`, so the
 * discount is computable per item.
 *
 * Honest caveats (surfaced in the store-page copy, not here): Ollie's is
 * in-store-only (no online cart), the catalog is a national SAMPLE not per-store
 * stock, and `compare_at_price` is Ollie's own claimed "fancy store price."
 * That is why it publishes as regular deals but the UI must never promise stock.
 *
 * "Not food deals" (founder): Food / Candy / Grocery product_types are excluded.
 */

import type { RegularDeal } from '../ingest/regular-deals.js';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const EXCLUDE_TYPES = /^(food|candy|grocery|beverages?|snacks?)$/i;

interface ShopifyVariant { id: number; price: string; compare_at_price: string | null; }
interface ShopifyProduct {
  id: number; title: string; handle: string; product_type: string;
  variants: ShopifyVariant[]; images: { src: string }[];
}

export function toDeal(p: ShopifyProduct): RegularDeal | null {
  if (EXCLUDE_TYPES.test(p.product_type ?? '')) return null;
  // Best in-stock markdown across variants: lowest price that still has a
  // compare_at above it.
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
    productUrl: `https://www.ollies.com/products/${p.handle}`,
    price: best.price,
    listPrice: best.list,
  };
}

async function getPage(page: number): Promise<ShopifyProduct[]> {
  const res = await fetch(`https://www.ollies.com/products.json?limit=250&page=${page}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Ollie's page ${page}: ${res.status}`);
  const body = (await res.json()) as { products: ShopifyProduct[] };
  return body.products ?? [];
}

export async function fetchOlliesDeals(maxPages = 6): Promise<RegularDeal[]> {
  const out: RegularDeal[] = [];
  for (let page = 1; page <= maxPages; page++) {
    let products: ShopifyProduct[] = [];
    try {
      products = await getPage(page);
    } catch (err) {
      console.error(`  ollies page ${page} failed: ${(err as Error).message}`);
      break;
    }
    if (products.length === 0) break; // past the end
    for (const p of products) {
      const d = toDeal(p);
      if (d) out.push(d);
    }
    await new Promise((r) => setTimeout(r, 200)); // polite
  }
  return out;
}
