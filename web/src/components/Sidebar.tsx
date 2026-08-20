import { NavLink, Link } from 'react-router-dom';
import { BRAND } from '../App.js';
import { useTheme, isDark } from '../lib/theme.js';
import { useAuth } from '../lib/auth.js';
import Notifications from './Notifications.js';
import '../notifications.css';

/* Inline icons, a whole icon library is not worth the weight for nine glyphs. */
const I = {
  tag: 'M3 3h7l8 8-7 7-8-8V3Zm3.5 3.5a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8Z',
  penny: 'M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm0 3.2v9.6M7.4 7.6h4.2a1.8 1.8 0 0 1 0 3.6H7.4',
  bell: 'M10 2a5 5 0 0 0-5 5v3l-1.5 3h13L15 10V7a5 5 0 0 0-5-5Zm-2 13a2 2 0 0 0 4 0',
  store: 'M3 7l1.5-4h11L17 7M3 7v10h14V7M3 7h14M7.5 17v-5h5v5',
  box: 'M10 2 3 5.5v9L10 18l7-3.5v-9L10 2Zm0 0v16M3 5.5l7 3.5 7-3.5',
  cart: 'M2 3h2.5l2 10h9l2-7H5M8 17a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm7 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  chart: 'M3 17V9m5 8V4m5 13v-6m5 6V7',
  discord: 'M7 8.5a1 1 0 1 1 0 .01M13 8.5a1 1 0 1 1 0 .01M5 5.5A13 13 0 0 1 10 4.5a13 13 0 0 1 5 1c2 3 2.5 6.5 2 10a13 13 0 0 1-4 1.5l-1-1.5m-4 0-1 1.5A13 13 0 0 1 3 15.5c-.5-3.5 0-7 2-10Z',
  sun: 'M10 5.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9ZM10 1v2m0 14v2M1 10h2m14 0h2M3.6 3.6l1.4 1.4m10 10 1.4 1.4m0-12.8-1.4 1.4m-10 10-1.4 1.4',
  moon: 'M16 11.5A6.5 6.5 0 0 1 8.5 4a6.5 6.5 0 1 0 7.5 7.5Z',
  menu: 'M3 5h14M3 10h14M3 15h14',
};

function Icon({ d }: { d: string }) {
  return (
    <svg className="sb-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const cls = ({ isActive }: { isActive: boolean }) => `sb-item${isActive ? ' active' : ''}`;

/** Retailers we can actually check store-level stock for. `soon` means the
 *  vendor is wired but the retailer isn't live yet, never a fake link. */
const RETAILERS = [
  { slug: 'home-depot', name: 'Home Depot', badge: 'HD', live: true },
  { slug: 'lowes', name: "Lowe's", badge: 'LW', live: true },
  { slug: 'walmart', name: 'Walmart', badge: 'WM', live: false },
  { slug: 'target', name: 'Target', badge: 'TG', live: false },
];

export default function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const { theme, toggle } = useTheme();
  const { me, signOut } = useAuth();
  const dark = isDark(theme);

  return (
    <aside className={`sb${open ? ' open' : ''}`} aria-label="Main">
      <div className="sb-head">
        <Link to="/" className="sb-brand"><span>{BRAND}</span></Link>
      </div>

      <nav className="sb-nav" onClick={onNavigate}>
        <div className="sb-sec">Find</div>
        <NavLink to="/app" end className={cls}><Icon d={I.tag} />All deals</NavLink>
        {/* Retailers sit under All deals because they are the same list
            filtered, not a different feature. */}
        <div className="sb-sub">
          <NavLink to="/app/deals/homedepot" className={cls}><Icon d={I.store} />Home Depot</NavLink>
          <NavLink to="/app/deals/lowes" className={cls}><Icon d={I.store} />Lowe&apos;s</NavLink>
        </div>
        <NavLink to="/app/penny" className={cls}><Icon d={I.penny} />Penny deals</NavLink>

        <div className="sb-sec">Stock check</div>
        {RETAILERS.map((r) => (
          <NavLink key={r.slug} to={`/app/stock/${r.slug}`} className={cls}>
            <Icon d={I.store} />
            {r.name}
            {r.live ? <span className="sb-badge">{r.badge}</span> : <span className="sb-soon">soon</span>}
          </NavLink>
        ))}

        <div className="sb-sec">Resell</div>
        <NavLink to="/app/watchlist" className={cls}><Icon d={I.bell} />My watchlist</NavLink>
        <NavLink to="/app/inventory" className={cls}><Icon d={I.box} />Inventory</NavLink>
        <NavLink to="/app/orders" className={cls}><Icon d={I.cart} />Orders</NavLink>
        <NavLink to="/app/profit" className={cls}><Icon d={I.chart} />Profit</NavLink>

        {me?.role === 'operator' && (
          <>
            <div className="sb-sec">Operator</div>
            <NavLink to="/app/admin" className={cls}><Icon d={I.chart} />Admin</NavLink>
          </>
        )}
      </nav>

      <div className="sb-foot">
        <Notifications />

        {import.meta.env.VITE_DISCORD_INVITE && (
        <a className="sb-discord" href={import.meta.env.VITE_DISCORD_INVITE} target="_blank" rel="noreferrer">
          <svg className="sb-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor"
            strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d={I.discord} /></svg>
          Join the Discord
        </a>)}

        <button className="sb-user" onClick={toggle}>
          <svg className="sb-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d={dark ? I.sun : I.moon} />
          </svg>
          {dark ? 'Light mode' : 'Dark mode'}
        </button>

        <button className="sb-user" onClick={() => void signOut()}>
          <span className="sb-avatar">{(me?.email ?? '?')[0]!.toUpperCase()}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {me?.email ?? 'Account'}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 14, color: 'var(--ink-faint)' }}>Sign out</span>
        </button>
      </div>
    </aside>
  );
}

export { I as icons };
