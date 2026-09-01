/**
 * Retailer content. One place, used by the nav, the footer, the store pages
 * and the app sidebar, so a retailer can never be live in one and missing in
 * another.
 *
 * `coverage` is deliberately honest. In-store hunting needs per-store stock,
 * which only some retailers publish. Saying otherwise would be a promise we
 * cannot keep.
 */

export type Coverage = 'in-store' | 'online' | 'planned' | 'community';

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
      "The price is the same at every store we checked, so there is no cheaper location to drive to. What you see is what any Lowe's charges.",
    ],
    weSee: [
      "The marked-down price, the original, and the percentage: all published by Lowe's itself.",
      'When the markdown ends, so a deal is never shown as if it lasts forever.',
    ],
    weCannot: [
      "Tell you units on a specific shelf. Lowe's returned the same count at every store we tested, so it is not real per-store stock and we will not print it as one.",
      'Give you an aisle. The same caveat applies. The aisle came back identical in four states.',
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
      'The famous in-app "hidden clearance" price only exists on a phone standing in the store. No website, ours included, can see it.',
    ],
    weSee: [
      "The marked-down price, the original, and the percentage: Walmart's own numbers, from its own Clearance badge.",
      'Only first-party listings. The marketplace fake-discount soup is filtered before it ever reaches the pool.',
    ],
    weCannot: [
      'See per-store stock. No Walmart payload we probed carries a shelf count, so the ledger stays empty rather than inventing one.',
      'See the in-app hidden clearance price. It is gated to a device in the aisle. Scan the item in the app when you get there.',
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
      'The clearance price itself: marked as clearance by Target, not guessed from a discount.',
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
    coverage: 'online',
    lede: 'Live. Outlet markdowns on new-condition items, from Best Buy’s own listing feed.',
    howItWorks: [
      'Best Buy runs an Outlet across every department: clearance, open-box, refurbished and pre-owned in one place.',
      'We publish the new-condition markdowns: items Best Buy itself discounts, including its own Clearance-flagged rows.',
      'Deals here are national: one price online, the same everywhere.',
    ],
    weSee: [
      'The marked-down price, the original, and the percentage: Best Buy’s own numbers from its own listing.',
      'Which deals carry Best Buy’s Clearance flag versus an ordinary outlet discount.',
      'An expiration stamp when Best Buy publishes one, so dated deals are never shown as permanent.',
    ],
    weCannot: [
      'Quote open-box, refurbished or pre-owned prices. Their listing returns the new-condition price even when filtered to open-box, so those conditions are excluded rather than mislabeled.',
      'See per-store shelf stock, ever. Best Buy retired store-level availability years ago, so deals here are about price, not about a shelf near you.',
    ],
  },
  {
    slug: 'dollar-general',
    name: 'Dollar General',
    badge: 'DG',
    /* Not 'online' and not 'in-store'. DG's penny/clearance price is a
       register-only state — it exists on no web surface, exactly like Home
       Depot's penny. The only way it becomes visible is a person scanning the
       barcode in the DG app while standing in the aisle. So DG can only ever be
       a COMMUNITY-reported retailer: we publish what members confirmed on a
       shelf, never a price we measured. Ships as 'community' the day member
       reports exist; until then the page states plainly that nothing is live. */
    coverage: 'community',
    lede: 'Reported by hunters, not scraped. DG’s penny price lives only in the register. The crowd is the only sensor there is.',
    howItWorks: [
      'DG marks discontinued items down a ladder (10, 25, 50, 75, 90 percent) and finally to one cent, which is the register’s signal for staff to pull the item. Penny day is Tuesday.',
      'That one-cent price appears on no website and no shelf tag. The only way to see it is to scan the barcode in the DG app while standing in the store.',
      'So there is nothing to scrape. Every DG penny lead here is a find a real shopper confirmed at a register and reported back: hearsay, labelled as hearsay, never presented as verified stock.',
    ],
    weSee: [
      'Penny and deep-clearance finds that members confirmed on a shelf, with the store and when it was seen.',
      'The markdown ladder for an item, so you can tell what is one or two Tuesdays from a penny.',
    ],
    weCannot: [
      'Promise the item is still there, or there at your store. A penny at one DG is full price at the next, and staff may have already pulled it. A report is one person’s find, not live stock.',
      'Promise the store will sell it. DG’s own policy says to honour a found penny item, but plenty of registers refuse. Bring it to the counter, and if they say no, just have them take it off the sale.',
      'Show a price we measured. There is no DG price feed; if it is not a member report, we do not have it.',
    ],
  },
  {
    slug: 'tractor-supply',
    name: 'Tractor Supply',
    badge: 'TS',
    /* Community, like Dollar General — but for a different reason. TSC's site
       is walled by Akamai (we get "Access Denied" even from a real browser),
       and its deepest markdowns are in-store red-tag remnants that never touch
       the website. So the reachable, valuable tier is what members find on the
       shelf. Unlike DG there is no penny: TSC clearance is plain percent
       markdowns, and the price is NATIONAL — the same at every store. */
    coverage: 'community',
    lede: 'Reported by hunters. TSC’s deep markdowns are in-store red-tag remnants. The crowd is the only way to see them.',
    howItWorks: [
      'Tractor Supply clears seasonal, farm, pet and tool stock in plain percent markdowns, 40 to 80 percent off on a “was” tag. There is no penny and no secret price-ending code; that is Home Depot folklore, not TSC.',
      'The online clearance price is national, the same at every store, but the deepest red-tag markdowns are set by the store and never appear on the website.',
      'So the deals worth driving for are the ones a member found on a shelf and reported. Availability is store-by-store and never guaranteed.',
    ],
    weSee: [
      'Red-tag and clearance finds that members confirmed on a shelf, with the store and when it was seen.',
      'The marked price and what it was, so the depth of the cut is plain.',
    ],
    weCannot: [
      'Promise it is at your store. The price is national but the stock is not. Every clearance find here is YMMV, one person’s shelf, not live inventory.',
      'Show the deep in-store markdowns from the website. TSC hides those behind Akamai and keeps the deepest ones off the site entirely. A report is the only way they surface.',
      'Show a price we measured. There is no TSC feed we can reach; if it is not a member report, we do not have it.',
    ],
  },
  {
    slug: 'costco',
    name: 'Costco',
    badge: 'CO',
    /* Community, like DG and TSC. Costco's manager markdowns — the famous .97
       prices and the asterisk/'death star' tags — exist only in the warehouse
       and never appear on costco.com. There is no penny mechanic; these are
       percent markdowns on discontinued stock. So the crowd is the only sensor. */
    coverage: 'community',
    lede: 'Reported by members. Costco’s markdowns live only in the warehouse. The .97 prices and asterisk tags never reach the website.',
    howItWorks: [
      'Costco marks discontinued stock down in the warehouse, not online. A price ending in .97 is a manager markdown; .00 or .88 is the final closeout, the deepest it goes; and an asterisk in the top-right corner of the sign means the item is not being reordered. Once it is gone, it is gone. (A plain .99 is just the regular price.)',
      'These markdowns never appear on costco.com, and they vary warehouse to warehouse. There is no penny here: just real percent cuts on the way out the door.',
      'So the deals worth chasing are the ones a member spotted on the shelf and reported. Stock is warehouse-by-warehouse and never guaranteed.',
    ],
    weSee: [
      'Markdown finds (the .97 and asterisk tags) that members confirmed in a warehouse, with the location and when it was seen.',
      'The marked price and what it was, so the depth of the cut is plain.',
    ],
    weCannot: [
      'Promise it is at your warehouse. Manager markdowns are local and sell through fast. Every find here is one member’s shelf, not live stock.',
      'Show these from the website. Costco keeps warehouse markdowns off costco.com entirely. A member report is the only way they surface.',
      'Show a price we measured. There is no Costco markdown feed anywhere online; if it is not a member report, we do not have it.',
    ],
  },
];

export const getRetailer = (slug?: string) => RETAILERS.find((r) => r.slug === slug);

export const COVERAGE_LABEL: Record<Coverage, string> = {
  'in-store': 'Live, with in-store stock',
  online: 'Live, online prices only',
  planned: 'Not live yet',
  community: 'Community-reported finds',
};
