import { Outlet, NavLink, Link } from 'react-router-dom';
import { BRAND } from '../App.js';
import { RETAILERS } from '../lib/retailers.js';
import '../site.css';

/** Every public page shares this frame, so spacing and navigation cannot
 *  drift apart between pages. */
export default function SiteLayout() {
  const year = new Date().getFullYear();

  return (
    <div className="site">
      <header className="nav">
        <div className="wrap nav-in">
          <Link to="/" className="wordmark">{BRAND}</Link>
          <nav className="nav-links" aria-label="Main">
            <NavLink to="/how-it-works">How it works</NavLink>
            <NavLink to="/pricing">Pricing</NavLink>
            <NavLink to="/stores/home-depot">Stores</NavLink>
            <NavLink to="/faq">FAQ</NavLink>
            <Link to="/app" className="btn btn-quiet">Open the app</Link>
          </nav>
        </div>
      </header>

      <main className="site-main">
        <Outlet />
      </main>

      <footer className="foot">
        <div className="wrap foot-in">
          <div>
            <h4>Product</h4>
            <ul>
              <li><Link to="/how-it-works">How it works</Link></li>
              <li><Link to="/pricing">Pricing</Link></li>
              <li><Link to="/faq">Questions</Link></li>
              <li><Link to="/app">Open the app</Link></li>
            </ul>
          </div>

          <div>
            <h4>Stores</h4>
            <ul>
              {RETAILERS.map((r) => (
                <li key={r.slug}><Link to={`/stores/${r.slug}`}>{r.name}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h4>Company</h4>
            <ul>
              <li><Link to="/about">About</Link></li>
              <li><Link to="/contact">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h4>Legal</h4>
            <ul>
              <li><Link to="/privacy">Privacy</Link></li>
              <li><Link to="/terms">Terms</Link></li>
              <li><Link to="/delete-account">Delete your account</Link></li>
            </ul>
          </div>
        </div>

        <div className="wrap foot-base">
          <span>{BRAND}, San Antonio, Texas. &copy; {year}</span>
          <span>
            Prices change constantly. We report what we last saw, not what you will pay.
          </span>
        </div>
      </footer>
    </div>
  );
}
