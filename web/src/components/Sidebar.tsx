/**
 * THE RAIL — the app's entire sidebar. Two retailers, nothing else.
 *
 * Only retailers we actually publish verified deals for appear here. Lowe's and
 * Walmart were dropped rather than greyed out: a "soon" row is a promise, and
 * an empty nav slot is not worth one.
 *
 * These are QUERY links, not routes. THE TAPE redesign culled
 * /app/deals/:retailer and /app/stock/:retailer — both now redirect to /app —
 * so the previous sidebar's retailer links silently bounced to the unfiltered
 * feed. `?store=` scopes the feed for real. `tab=all` rides along because the
 * bare app opens on the Penny track, which reads as empty for a retailer with
 * no penny rows.
 *
 * "All" is deliberately NOT a third entry: it is the same list unfiltered, and
 * the wordmark in the header already goes there.
 */

import { Link, useLocation } from 'react-router-dom';

const STORE_ICON =
  'M3 7l1.5-4h11L17 7M3 7v10h14V7M3 7h14M7.5 17v-5h5v5';

const RETAILERS = [
  { slug: 'home-depot', name: 'Home Depot', badge: 'HD' },
  { slug: 'target', name: 'Target', badge: 'TG' },
  // Lowe's is built but not seeded yet — adding it here before the first sweep
  // lands would ship a nav entry that opens an empty feed.
];

export default function Sidebar() {
  /* Both entries share the /app path and differ only by ?store=, and NavLink's
     own isActive ignores the query — it would light BOTH rows at once. Read the
     param directly instead. */
  const active = new URLSearchParams(useLocation().search).get('store');

  return (
    <nav className="rail" aria-label="Retailers">
      {RETAILERS.map((r) => (
        <Link
          key={r.slug}
          to={`/app?store=${r.slug}&tab=all`}
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
    </nav>
  );
}
