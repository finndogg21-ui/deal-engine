import { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import Sidebar, { icons } from '../components/Sidebar.js';
import { readSetup } from '../lib/setup.js';
import '../sidebar.css';

export default function AppShell() {
  const [open, setOpen] = useState(false);

  // First visit goes to setup. Once it's done this never fires again.
  if (!readSetup()) return <Navigate to="/welcome" replace />;

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

      {/* Tapping outside closes the drawer. Only rendered on mobile widths. */}
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
