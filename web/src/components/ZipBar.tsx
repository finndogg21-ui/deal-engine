/**
 * The one ZIP the whole app uses, shown in the shell's top bar on every page.
 *
 * Every "Find stock" press reads this instead of asking again, so it lives in
 * the shell rather than on any one page. It is the same users.zip the Welcome
 * survey fills — one stored value, mirrored here — and saving writes it back
 * to the account, so it survives reloads and follows the person across devices.
 */

import { useEffect, useRef, useState } from 'react';
import { api, useAuth } from '../lib/auth.js';
import { getLocalZip, setLocalZip, onZipChange } from '../lib/zip.js';

export default function ZipBar() {
  const { me, refresh } = useAuth();
  // Account ZIP wins; fall back to the locally-saved ZIP so a preview visitor
  // with no persistable account still keeps the ZIP they entered.
  const saved = me?.zip ?? getLocalZip() ?? '';

  const [zip, setZip] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, forceTick] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // `saved` reads getLocalZip(), which isn't reactive. Re-render when the local
  // ZIP changes so `dirty` clears and the "Saved" badge shows after a preview save.
  useEffect(() => onZipChange(() => forceTick((t) => t + 1)), []);

  // Another surface (the Welcome survey, the FindStock fallback) can change
  // the account ZIP; mirror it here — but never while the person is mid-edit,
  // or a background refresh() would eat their half-typed ZIP.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) setZip(saved);
  }, [saved]);

  const dirty = zip !== saved;

  async function save() {
    if (!dirty || busy || !/^\d{5}$/.test(zip)) return;
    setBusy(true);
    setError(null);
    // Keep the ZIP client-side first, so the nearby feed works even when the
    // account can't persist it (PUBLIC_PREVIEW). This also drives the same-tab
    // 'zip-changed' event the feed listens for.
    setLocalZip(zip);
    try {
      // Best-effort account write. In preview this no-ops server-side; the local
      // ZIP above already made the change take, so a failure here is not fatal.
      await api('/api/auth/me/zip', { method: 'PATCH', body: JSON.stringify({ zip }) });
      // refresh() re-reads /me, which resets `saved` and clears the dirty state.
      await refresh();
    } catch {
      /* preview / offline — local ZIP still applied, so don't surface an error */
    } finally {
      setConfirmed(true);
      window.setTimeout(() => setConfirmed(false), 2500);
      setBusy(false);
    }
  }

  return (
    <div className="zb">
      {/* Only when there is nothing saved yet — a one-time nudge, not chrome. */}
      {!saved && !dirty && <span className="zb-hint">Set once; every stock check uses it</span>}
      {dirty && zip.length > 0 && zip.length < 5 && (
        <span className="zb-hint" role="status">Enter all 5 digits</span>
      )}
      {error && <span className="zb-err" role="alert">{error}</span>}
      {confirmed && !dirty && <span className="zb-ok" role="status">Saved</span>}

      <label className="zb-field">
        <span>Stores near</span>
        <input
          ref={inputRef}
          value={zip}
          onChange={(e) => { setZip(e.target.value.replace(/\D/g, '').slice(0, 5)); setConfirmed(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter') void save(); }}
          placeholder="ZIP code"
          inputMode="numeric"
          aria-label="ZIP code used for every stock check"
        />
      </label>

      {dirty && (
        <button className="zb-save" onClick={() => void save()} disabled={busy || zip.length !== 5}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      )}
    </div>
  );
}
