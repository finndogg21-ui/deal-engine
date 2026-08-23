import { Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import ZipBar from '../components/ZipBar.js';
import Sidebar from '../components/Sidebar.js';
import { useAuth } from '../lib/auth.js';
import { BRAND } from '../App.js';
import '../sidebar.css';

/**
 * THE TAPE shell: no sidebar, no menu — the app is one Find page, so the
 * chrome is one slim header: wordmark, the ZIP (every stock line reads it),
 * and sign-out. The header's bottom edge is the receipt perforation; the
 * serration is drawn in CSS (.tape-head), not an image.
 */
export default function AppShell() {
  const { me, loading, signOut } = useAuth();
  const { pathname } = useLocation();

  // Avoid flashing the sign-in page while the session is still being checked.
  if (loading) {
    return (
      <div className="wrap page-head">
        <p className="lede">Loading</p>
      </div>
    );
  }

  if (!me) return <Navigate to={`/signin?next=${encodeURIComponent(pathname)}`} replace />;

  // Signed in but never finished onboarding.
  if (!me.setup_done_at) return <Navigate to="/welcome" replace />;

  return (
    <div className="tape-shell">
      <header className="tape-head">
        <Link to="/app" className="tape-mark">{BRAND.toUpperCase()}</Link>
        <div className="tape-zip"><ZipBar /></div>
        {/* The one standing pitch — quiet, bordered, inverts on hover. It says
            "account", not "trial": there is no trial, /faq says so plainly, and
            /signup asks for an email and a password and nothing else. Promising
            a trial here made four surfaces contradict each other. */}
        <Link to="/signup" className="tape-trial">Create free account</Link>
        <button className="tape-out" onClick={() => void signOut()}>Sign out</button>
      </header>
      {/* The rail is the only nav: Home Depot and Target. On a phone it lies
          flat under the header instead of eating a third of the width. */}
      <div className="tape-body">
        <Sidebar />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
