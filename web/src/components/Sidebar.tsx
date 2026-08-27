/**
 * THE RAIL — the app's navigation, grouped.
 *
 * The five core retailers we run our own verified sweeps for lead the rail as
 * "Main". Everything added since — the free regular-deal sources (Newegg, Woot,
 * Ollie's, Grove, Staples) and the community penny/markdown lists (Dollar
 * General, Tractor Supply, Costco) — sits under "Other Retailers" so the five
 * that carry the product are not diluted by the long tail.
 *
 * QUERY links, not routes: `?store=` scopes the feed, `tab=` picks the track
 * (community penny retailers open on Penny; everyone else on All).
 */

import { Link, useLocation } from 'react-router-dom';

const STORE_ICON =
  'M3 7l1.5-4h11L17 7M3 7v10h14V7M3 7h14M7.5 17v-5h5v5';

interface Retailer { slug: string; name: string; badge: string; tab?: 'penny' }

const GROUPS: { label: string; items: Retailer[] }[] = [
  {
    label: 'Main',
    items: [
      { slug: 'home-depot', name: 'Home Depot', badge: 'HD' },
      { slug: 'target', name: 'Target', badge: 'TG' },
      { slug: 'lowes', name: "Lowe's", badge: 'LW' },
      { slug: 'walmart', name: 'Walmart', badge: 'WM' },
      { slug: 'best-buy', name: 'Best Buy', badge: 'BB' },
    ],
  },
  {
    label: 'Other Retailers',
    items: [
      // Free regular-deal sources (national online pricing).
      { slug: 'newegg', name: 'Newegg', badge: 'NE' },
      { slug: 'woot', name: 'Woot', badge: 'WO' },
      { slug: 'ollies', name: "Ollie's", badge: 'OL' },
      { slug: 'grove', name: 'Grove', badge: 'GR' },
      { slug: 'staples', name: 'Staples', badge: 'ST' },
      // Community penny / markdown lists (member-reported).
      { slug: 'dollar-general', name: 'Dollar General', badge: 'DG', tab: 'penny' },
      { slug: 'tractor-supply', name: 'Tractor Supply', badge: 'TS' },
      { slug: 'costco', name: 'Costco', badge: 'CO' },
    ],
  },
];

export default function Sidebar() {
  /* Both entries share the /app path and differ only by ?store=, and NavLink's
     own isActive ignores the query — it would light BOTH rows at once. Read the
     param directly instead. */
  const active = new URLSearchParams(useLocation().search).get('store');

  return (
    <nav className="rail" aria-label="Retailers">
      {GROUPS.map((group) => (
        <div className="rail-group" key={group.label}>
          <div className="rail-sec">{group.label}</div>
          {group.items.map((r) => (
            <Link
              key={r.slug}
              to={`/app?store=${r.slug}&tab=${r.tab ?? 'all'}`}
              className={`rail-item${active === r.slug ? ' on' : ''}`}
              aria-current={active === r.slug ? 'page' : undefined}
            >
              <svg
                className="rail-icon"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d={STORE_ICON} />
              </svg>
              <span className="rail-name">{r.name}</span>
              <span className="rail-badge">{r.badge}</span>
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
