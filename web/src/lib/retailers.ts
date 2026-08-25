/**
 * Retailer content. One place, used by the nav, the footer, the store pages
 * and the app sidebar, so a retailer can never be live in one and missing in
 * another.
 *
 * `coverage` is deliberately honest. In-store hunting needs per-store stock,
 * which only some retailers publish. Saying otherwise would be a promise we
 * cannot keep.
 */

export type Coverage = 'in-store' | 'online' | 'planned';

export interface Retailer {
  slug: string;
  name: string;
  badge: string;
  coverage: Coverage;
  /** One line, plain. Shown on the store page under the title. */
  lede: string;
  /** How markdowns actually work at this retailer. */
  howItWorks: string[];
  /** What we can and cannot see. Honesty here is the whole point. */
  weSee: string[];
  weCannot: string[];
}

export const RETAILERS: Retailer[] = [
  {
    slug: 'home-depot',
    name: 'Home Depot',
    badge: 'HD',
    coverage: 'in-store',
    lede: 'The best penny hunting in the country, and the reason this app exists.',
    howItWorks: [
      'Clearance moves down a ladder. An item gets marked down, sits, gets marked down again, and eventually drops to one cent in the register.',
      'A penny item is supposed to be pulled from the shelf. Plenty are not, which is why people find them.',
      'The price never appears online. It only exists at the register, so the only way to predict it is to watch the whole markdown history.',
    ],
    weSee: [
      'Every discounted item, store by store, updated daily',
      'How many units a specific store has left',
      'Aisle and bay, so you are not walking the building',
      'When an item disappears from the site while stock remains, which is the strongest penny signal there is',
    ],
    weCannot: [
      'See the penny price itself. Nobody outside the register can.',
      'Promise the item is still there. Stock counts are a snapshot, not a reservation.',
    ],
  },
  {
    slug: 'lowes',
    name: "Lowe's",
    badge: 'LW',
    /* Not 'in-store'. That badge reads "Live, with in-store stock" two inches
       above this page's own weCannot line saying Lowe's returned the same
       count at every store and we will not print it as one. 'online' renders
       "Live, online prices only", which is what we actually have. */
    coverage: 'online',
    lede: 'Live. Dated markdowns from the Back Aisle, priced the same chain-wide.',
    howItWorks: [
      "Lowe's publishes its markdowns through a clearance browse it calls the Back Aisle.",
      'Every discount carries an end date, so these are time-limited sales rather than the permanent clearance Home Depot hides in store.',
      "The price is the same at every store we checked, so there is no cheaper location to drive to — what you see is what any Lowe's charges.",
    ],
    weSee: [
      "The marked-down price, the original, and the percentage — all published by Lowe's itself.",
      'When the markdown ends, so a deal is never shown as if it lasts forever.',
    ],
    weCannot: [
      "Tell you units on a specific shelf. Lowe's returned the same count at every store we tested, so it is not real per-store stock and we will not print it as one.",
      'Give you an aisle. The same caveat applies — the aisle came back identical in four states.',
      'See in-store-only markdowns that never reach the website.',
    ],
  },
  {
    slug: 'walmart',
    name: 'Walmart',
    badge: 'WM',
    coverage: 'online',
    lede: "Live. Walmart's own Clearance-badged markdowns, first-party only.",
    howItWorks: [
      'Walmart badges true clearance on its site; rollbacks and "reduced price" are different animals and are left out.',
      'The clearance browse is dominated by third-party marketplace sellers with invented was-prices. We publish only items sold by Walmart itself.',
      'The famous in-app "hidden clearance" price only exists on a phone standing in the store — no website, ours included, can see it.',
    ],
    weSee: [
      "The marked-down price, the original, and the percentage — Walmart's own numbers, from its own Clearance badge.",
      'Only first-party listings. The marketplace fake-discount soup is filtered before it ever reaches the pool.',
    ],
    weCannot: [
      'See per-store stock. No Walmart payload we probed carries a shelf count, so the ledger stays empty rather than inventing one.',
      'See the in-app hidden clearance price. It is gated to a device in the aisle — scan the item in the app when you get there.',
    ],
  },
  {
    slug: 'target',
    name: 'Target',
    badge: 'TG',
    coverage: 'in-store',
    lede: 'Live. Clearance price and exact shelf counts, per store.',
    howItWorks: [
      'Target runs clearance on a weekly schedule by department, and the percentages step down predictably.',
      'End caps and seasonal resets drive most of the deep markdowns.',
      'A clearance sticker is store-specific. The same item can be cleared at one store and sit at full price at another.',
    ],
    weSee: [
      'The clearance price itself — marked as clearance by Target, not guessed from a discount.',
      'The exact number of units on a given store shelf: a real count, not "in stock".',
      'Which nearby stores have none, so a zero is visible instead of quietly dropped.',
    ],
    weCannot: [
      'Promise the count is live. It is the number we last read, and it is always stamped with when.',
      'See the aisle or endcap. Target does not publish a location inside the store.',
    ],
  },
  {
    slug: 'best-buy',
    name: 'Best Buy',
    badge: 'BB',
    /* 'planned' until the API key exists and the first sweep publishes.
       The module is built and waiting; the badge flips to 'online' the day
       real rows land, not the day the code does. */
    coverage: 'planned',
    lede: 'Next up. The one retailer with an official API — no scraping, straight from the source.',
    howItWorks: [
      'Best Buy publishes its catalog through a real developer API, so our sweep will read prices directly instead of cracking a site. It cannot be blocked and it does not miss days.',
      'Clearance is where the deep cuts live. Sale prices step down over weeks, and the last step before delisting is often 70% or more off.',
      'Deals here are national: one price online, the same everywhere.',
    ],
    weSee: [
      'Nothing yet. This retailer is not live — the sweep is built and waiting on our API credentials.',
    ],
    weCannot: [
      'See per-store shelf stock, ever. Best Buy retired store-level availability from its API years ago, so deals here will be about price, not about a shelf near you.',
      'See open-box offers. That is a separate feed we have not wired.',
    ],
  },
];

export const getRetailer = (slug?: string) => RETAILERS.find((r) => r.slug === slug);

export const COVERAGE_LABEL: Record<Coverage, string> = {
  'in-store': 'Live, with in-store stock',
  online: 'Live, online prices only',
  planned: 'Not live yet',
};

/** Retailers actually live today, in `retailers.ts` order. Copy that states
 * coverage should read this instead of hand-writing a retailer list. */
export const LIVE_RETAILERS = RETAILERS.filter((r) => r.coverage !== 'planned');

/** "A", "A and B", "A, B, and C" — plain-English join for retailer-name lists. */
export const joinNames = (names: string[]): string => {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  const last = names[names.length - 1];
  return `${names.slice(0, -1).join(', ')}, and ${last}`;
};
