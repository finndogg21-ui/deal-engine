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
    ],
  },
  {
    // Member-reported penny/markdown lists — no scanned feed, so kept apart
    // from the retailers we actually sweep. These open on the All track (they
    // have no Penny tab; their finds ARE the feed).
    label: 'Community Reported',
    items: [
      { slug: 'dollar-general', name: 'Dollar General', badge: 'DG' },
      { slug: 'tractor-supply', name: 'Tractor Supply', badge: 'TS' },
      { slug: 'costco', name: 'Costco', badge: 'CO' },
    ],
  },
];

export default function Sidebar() {
  /* Both entries share the /app path and differ only by ?store=, and NavLink's
     own isActive ignores the query — it would light BOTH rows at once. Read the
     param directly instead. */
  const params = new URLSearchParams(useLocation().search);
  const active = params.get('store');
  const activeTab = params.get('tab') ?? 'all';

  return (
    <nav className="rail" aria-label="Retailers">
      {/* TRACKS — cross-retailer views. Hidden clearance is the moat, so it gets
          a permanent home at the top of the rail, reachable from any screen and
          any store. These scope by ?tab=, not ?store=. */}
      <div className="rail-group">
        <div className="rail-sec">Tracks</div>
        <Link
          to="/app?tab=all"
          className={`rail-item${!active && activeTab === 'all' ? ' on' : ''}`}
          aria-current={!active && activeTab === 'all' ? 'page' : undefined}
        >
          <svg className="rail-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={STORE_ICON} />
          </svg>
          <span className="rail-name">All deals</span>
        </Link>
        <Link
          to="/app?tab=hidden"
          className={`rail-item rail-hidden${activeTab === 'hidden' ? ' on' : ''}`}
          aria-current={activeTab === 'hidden' ? 'page' : undefined}
        >
          <svg className="rail-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {/* An eye-off glyph: the price the store keeps off the web. */}
            <path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5a9 9 0 0 1-5-1.6" />
            <circle cx="10" cy="10" r="2.2" />
            <path d="M3 3l14 14" />
          </svg>
          <span className="rail-name">Hidden clearance</span>
        </Link>
      </div>

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
