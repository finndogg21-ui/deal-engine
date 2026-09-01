import { Outlet, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import ZipBar from '../components/ZipBar.js';
import Sidebar from '../components/Sidebar.js';
import { useAuth, isPreviewUser, api } from '../lib/auth.js';
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
  const nav = useNavigate();

  // "Cancel in one tap, from inside the app" — the copy promises it, so provide
  // it. A paying member goes to the Stripe billing portal (manage/cancel); a
  // signed-up free user has no subscription to manage, so send them to pricing.
  async function manageMembership() {
    if (me?.plan === 'member') {
      try {
        const { url } = await api<{ url: string }>('/api/billing/portal', { method: 'POST' });
        window.location.href = url;
        return;
      } catch { /* no billing account yet — fall through to pricing */ }
    }
    nav('/pricing');
  }

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
        {/* Auth actions match the actual session. A PUBLIC_PREVIEW visitor is the
            shared anonymous row, NOT a signed-in account — offering them "Sign
            out" was a contradiction a cold ad visitor sees immediately. They get
            "Create account" + "Sign in"; a real signed-in member gets "Sign out".
            (There is no trial — /faq says so, /signup asks only email+password.) */}
        {isPreviewUser(me) ? (
          <>
            <Link to="/signup" className="tape-trial">Create free account</Link>
            <Link to="/signin" className="tape-out">Sign in</Link>
          </>
        ) : (
          <>
            <button className="tape-out" onClick={() => void manageMembership()}>
              {me.plan === 'member' ? 'Membership' : 'Upgrade'}
            </button>
            <button className="tape-out" onClick={() => void signOut()}>Sign out</button>
          </>
        )}
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
