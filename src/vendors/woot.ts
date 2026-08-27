/**
 * WOOT adapter — Amazon-owned daily-deal / liquidation site.
 *
 * Verified 2026-08-27: woot.com ships its AppSync GraphQL endpoint and a public
 * read key in cleartext in the homepage HTML (`window.__WOOT_GQL__`). The
 * endpoint is CloudFront-cached and answers a plain GET — no bot wall, no
 * account. Introspection is open.
 *
 * Data path (confirmed): getActiveEventsByCategoryName(<key>) returns event
 * STUBS (Offers empty); getEvent(Id) returns the event with its Offers fully
 * populated, each Item carrying ListPrice / SalePrice. So we fan category keys
 * into a de-duped set of event Ids, fetch each event once, and read the offers.
 *
 * The embedded key can rotate; if it 403s, re-read it from the homepage HTML.
 */

import type { RegularDeal } from '../ingest/regular-deals.js';

const ENDPOINT = 'https://d24qg5zsx8xdc4.cloudfront.net/graphql';
const KEY = 'da2-gdf6f2cxpnb3xikqgzzhfhovem';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

/** Non-food category keys (grocery/wine deliberately excluded). */
const CATEGORY_KEYS = ['sellout', 'tech', 'pc', 'home', 'sport', 'tools'];

/** Cap events fetched per run so the sweep stays polite. */
const MAX_EVENTS = 40;

const JUNK =
  // food-ish
  /\bwine\b|\bchocolate\b|\bcoffee\b|\bsnack\b|\bcandy\b|\bjerky\b|\bsauce\b|\bcookie\b|\bgift card\b/i;
/** Event/category "offers" that are not a single product — their titles are
 *  merchandising labels ("Over $50", "…Week", "…Stuff", "Hobbies"), and they
 *  carry placeholder $1/$10 prices. Never a real deal. */
const EVENT_TITLE = /\bover \$\d|\bweek\b|\bhobbies\b|\bstuff\b|\bround-?up\b|\bblowout\b|\bclearance event\b/i;
/** Woot doesn't sell real goods below this; a lower "sale" is a placeholder. */
const MIN_SALE = 3;

interface WootItem { Title: string; ListPrice: number | null; SalePrice: number | null; SoldOut: boolean }
interface WootOffer { Id: string; FullTitle: string; Slug: string; Items: WootItem[]; Photos: { Url: string }[] }

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const url = new URL(ENDPOINT);
  url.searchParams.set('query', query);
  if (variables) url.searchParams.set('variables', JSON.stringify(variables));
  const res = await fetch(url, { headers: { 'x-api-key': KEY, 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`woot gql ${res.status}`);
  const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length) throw new Error(`woot gql: ${body.errors[0]!.message.slice(0, 80)}`);
  return body.data as T;
}

const EVENT_IDS_Q =
  'query($c:String!){ getActiveEventsByCategoryName(CategoryName:$c){ Id } }';
const EVENT_Q =
  'query($id:ID!){ getEvent(Id:$id){ Id Offers { Id FullTitle Slug Items { Title ListPrice SalePrice SoldOut } Photos { Url } } } }';

function offerToDeal(o: WootOffer): RegularDeal | null {
  if (!o.FullTitle || JUNK.test(o.FullTitle) || EVENT_TITLE.test(o.FullTitle)) return null;
  // Pair each item's OWN sale+list — never min-sale-of-one-item against
  // max-list-of-another, which invented 90%-off "$1.00 was $10.00" deals.
  let best: { price: number; list: number } | null = null;
  for (const i of o.Items ?? []) {
    if (i.SoldOut || !i.SalePrice || !i.ListPrice) continue;
    if (i.SalePrice < MIN_SALE || i.ListPrice <= i.SalePrice) continue;
    if (!best || i.SalePrice < best.price) best = { price: i.SalePrice, list: i.ListPrice };
  }
  if (!best) return null;
  return {
    itemId: o.Id,
    sku: o.Id,
    title: o.FullTitle.trim(),
    imageUrl: o.Photos?.[0]?.Url ?? null,
    productUrl: `https://www.woot.com/offers/${o.Slug}`,
    price: Math.round(best.price * 100) / 100,
    listPrice: Math.round(best.list * 100) / 100,
  };
}

export async function fetchWootDeals(): Promise<RegularDeal[]> {
  // 1. category keys -> de-duped event ids
  const eventIds = new Set<string>();
  for (const c of CATEGORY_KEYS) {
    try {
      const d = await gql<{ getActiveEventsByCategoryName: { Id: string }[] }>(EVENT_IDS_Q, { c });
      for (const e of d.getActiveEventsByCategoryName ?? []) eventIds.add(e.Id);
    } catch (err) {
      console.error(`  woot category ${c}: ${(err as Error).message}`);
    }
  }

  // 2. fetch each event once, collect offers (bounded)
  const byId = new Map<string, RegularDeal>();
  let fetched = 0;
  for (const id of eventIds) {
    if (fetched >= MAX_EVENTS) break;
    fetched++;
    try {
      const d = await gql<{ getEvent: { Offers: WootOffer[] } | null }>(EVENT_Q, { id });
      for (const o of d.getEvent?.Offers ?? []) {
        const deal = offerToDeal(o);
        if (deal && !byId.has(deal.itemId)) byId.set(deal.itemId, deal);
      }
    } catch (err) {
      console.error(`  woot event ${id}: ${(err as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 120)); // polite
  }
  return [...byId.values()];
}
