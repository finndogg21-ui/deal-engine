import { useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import Sidebar, { icons } from '../components/Sidebar.js';
import { useAuth } from '../lib/auth.js';
import '../sidebar.css';

export default function AppShell() {
  const [open, setOpen] = useState(false);
  const { me, loading } = useAuth();
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
    <div className="app-shell">
      <button
        className="sb-toggle"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg className="sb-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor"
          strokeWidth="1.8" strokeLinecap="round"><path d={icons.menu} /></svg>
      </button>

      <button
        className={`sb-scrim${open ? ' show' : ''}`}
        aria-label="Close menu"
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
      />

      <Sidebar open={open} onNavigate={() => setOpen(false)} />

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
