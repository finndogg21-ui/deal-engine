/**
 * Fix F7 — the notifications bell.
 *
 * The bell was removed in the last pass rather than ship a control that did
 * nothing. It comes back here because there is now an `alerts` table behind
 * it with real rows in it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/auth.js';

interface Alert {
  alert_id: string;
  title: string | null;
  store_name: string | null;
  watch_term: string | null;
  reason: string;
  price: number | null;
  discount_pct: number | null;
  score_at_send: number | null;
  sent_at: string;
  opened_at: string | null;
  href: string;
}

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function Notifications() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  // The sidebar is `overflow-y: auto`, which clips absolutely-positioned
  // children on BOTH axes — an absolute panel gets cut off at the sidebar's
  // right edge. So the panel is fixed to the viewport and positioned from the
  // trigger's own rect, which also survives the mobile drawer.
  const [at, setAt] = useState<{ left: number; bottom: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  const place = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setAt({ left: r.left, bottom: window.innerHeight - r.top + 8 });
  }, []);

  const load = useCallback(async () => {
    try {
      const d = await api<{ unread: number; alerts: Alert[] }>('/api/alerts?limit=50');
      setUnread(d.unread);
      setAlerts(d.alerts);
    } catch {
      setAlerts([]);
    }
  }, []);

  // Badge count on mount. Not polled — a scan runs daily, so a live poll would
  // be a request every few seconds to watch a number that changes once a day.
  useEffect(() => { void load(); }, [load]);

  // Escape closes and focus returns to the trigger, which is the part people
  // skip and the part keyboard users actually notice.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); }
    }
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    // A fixed panel does not follow its trigger, so it has to be repositioned
    // when anything moves underneath it.
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  async function markAll() {
    await api('/api/alerts/read-all', { method: 'POST' });
    setUnread(0);
    setAlerts((prev) => prev?.map((a) => ({ ...a, opened_at: a.opened_at ?? new Date().toISOString() })) ?? null);
  }

  async function openAlert(a: Alert) {
    setOpen(false);
    if (!a.opened_at) {
      setUnread((n) => Math.max(n - 1, 0));
      void api(`/api/alerts/${a.alert_id}/open`, { method: 'POST' }).catch(() => {});
    }
    navigate(a.href);
  }

  return (
    <div className="nt" ref={wrapRef}>
      <button
        ref={btnRef}
        className="nt-bell"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        onClick={() => { place(); setOpen((v) => !v); if (!alerts) void load(); }}
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10 2a5 5 0 0 0-5 5v3l-1.5 3h13L15 10V7a5 5 0 0 0-5-5Zm-2 13a2 2 0 0 0 4 0" />
        </svg>
        <span>Notifications</span>
        {unread > 0 && <span className="nt-badge">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div
          className="nt-panel"
          role="dialog"
          aria-label="Notifications"
          style={at ? { left: at.left, bottom: at.bottom } : undefined}
        >
          <div className="nt-head">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button className="nt-link" onClick={() => void markAll()}>Mark all read</button>
            )}
          </div>

          {alerts === null && <p className="nt-empty">Loading…</p>}

          {alerts?.length === 0 && (
            <p className="nt-empty">
              Nothing yet. Alerts show up here when something on your watchlist drops.
            </p>
          )}

          <ul className="nt-list">
            {alerts?.map((a) => (
              <li key={a.alert_id}>
                <button
                  className={`nt-item${a.opened_at ? '' : ' unread'}`}
                  onClick={() => void openAlert(a)}
                >
                  <span className="nt-item-title">{a.title ?? 'A deal'}</span>
                  <span className="nt-item-meta">
                    {a.price !== null && `$${a.price.toFixed(2)}`}
                    {a.discount_pct !== null && ` · ${Math.round(a.discount_pct)}% off`}
                    {a.store_name && ` · ${a.store_name}`}
                  </span>
                  <span className="nt-item-foot">
                    {a.reason === 'verified_find'
                      ? 'Confirmed by a spotter'
                      : a.watch_term
                        ? `Matched “${a.watch_term}”`
                        : 'Penny candidate'}
                    {' · '}{ago(a.sent_at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
