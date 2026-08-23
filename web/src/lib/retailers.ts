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
    coverage: 'in-store',
    lede: 'Same markdown ladder, different store, usually less picked over.',
    howItWorks: [
      "Lowe's runs clearance on its own cycle, and the stages are not identical to Home Depot's.",
      'Because fewer people hunt here, deep discounts often sit longer before someone takes them.',
      'Store to store variation is high. An item at full price at one location can be on final clearance ten miles away.',
    ],
    weSee: [
      'Discounted inventory per store, refreshed daily',
      'Units remaining at each location',
      'The full markdown history for an item, so you can see where it is heading',
    ],
    weCannot: [
      'Guarantee shelf location. Aisle data is less consistent here than at Home Depot.',
      'See in-store only markdowns that never touch the website.',
    ],
  },
  {
    slug: 'walmart',
    name: 'Walmart',
    badge: 'WM',
    coverage: 'planned',
    lede: 'Planned. Store-level stock is the blocker, not the deals.',
    howItWorks: [
      'Walmart marks clearance down in stages and the endings on price tags tell you roughly where an item sits.',
      'Rollbacks are not clearance. They come back up, and treating them as finds wastes trips.',
    ],
    weSee: [
      'Nothing yet. This retailer is not live.',
    ],
    weCannot: [
      'Confirm per-store quantity yet. Until a data source gives us reliable stock counts, an alert here would be a guess with a store name attached, which is worse than no alert.',
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
];

export const getRetailer = (slug?: string) => RETAILERS.find((r) => r.slug === slug);

export const COVERAGE_LABEL: Record<Coverage, string> = {
  'in-store': 'Live, with in-store stock',
  online: 'Live, online prices only',
  planned: 'Not live yet',
};
