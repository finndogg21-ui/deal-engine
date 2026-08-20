/**
 * "Find Stock" — the button that answers "is it near ME?"
 *
 * The sweep only knows the stores it happened to see. This asks, for whatever
 * ZIP the person types, right now.
 *
 * Every uncached press costs real money, so the UI is deliberate about it:
 * the remaining daily allowance is shown BEFORE pressing, a cached answer says
 * so, and a vendor failure says "could not check" rather than "none nearby" —
 * those are different claims and one of them sends someone home empty-handed.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/auth.js';

interface StoreRow {
  storeId: string;
  storeName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  distanceMi: number | null;
  quantity: number | null;
}

interface FindResult {
  stores: StoreRow[];
  cached: boolean;
  checked_at: string;
  used?: number;
  cap?: number;
  note?: string;
}

interface Quota { used: number; cap: number; remaining: number }

export default function FindStock({ productId, defaultZip }: { productId: string; defaultZip?: string | null }) {
  const [zip, setZip] = useState(defaultZip ?? '');
  const [result, setResult] = useState<FindResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [quota, setQuota] = useState<Quota | null>(null);
  /**
   * The vendor is async and slow — measured 3s to 21s for identical requests.
   * A bare "Checking…" for twenty seconds is indistinguishable from a hang,
   * so the button counts out loud.
   */
  const [elapsed, setElapsed] = useState(0);
  const [queued, setQueued] = useState(false);

  useEffect(() => {
    if (!busy) { setElapsed(0); return; }
    const t = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  const loadQuota = useCallback(async () => {
    try { setQuota(await api<Quota>('/api/stock/quota')); } catch { /* non-critical */ }
  }, []);

  useEffect(() => { void loadQuota(); }, [loadQuota]);

  // A new product means the previous store answer is about something else.
  useEffect(() => { setResult(null); setError(null); setQueued(false); }, [productId]);

  async function find() {
    if (busy || !/^\d{5}$/.test(zip)) return;
    setBusy(true);
    setError(null);
    try {
      /**
       * Queue rather than block. The vendor takes 3-21 seconds, and holding
       * the button hostage for that long taught people it was broken. The
       * answer appears on My watchlist when the worker finishes.
       */
      const r = await api<{ queued: string[]; cached: { stores: StoreRow[] }[] }>(
        '/api/stock/queue',
        { method: 'POST', body: JSON.stringify({ product_id: productId, zip }) },
      );
      if (r.cached.length > 0) {
        // Already known, so show it here instead of sending them elsewhere.
        setResult({ stores: r.cached[0]!.stores, cached: true, checked_at: new Date().toISOString() });
      } else {
        setQueued(true);
      }
      void loadQuota();
    } catch (e) {
      const err = e as Error & { data?: { detail?: string } };
      setError(err.data?.detail ?? err.message);
      void loadQuota();
    } finally {
      setBusy(false);
    }
  }

  const outOfQuota = quota !== null && quota.remaining <= 0;

  return (
    <div className="fs">
      <div className="fs-head">
        <strong>Find stock near you</strong>
        {quota !== null && quota.cap > 0 && (
          <span className="fs-quota">{quota.remaining} of {quota.cap} checks left today</span>
        )}
      </div>

      <div className="fs-row">
        <label className="fs-field">
          <span className="fs-sr">ZIP code</span>
          <input
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="ZIP code"
            inputMode="numeric"
            onKeyDown={(e) => { if (e.key === 'Enter') void find(); }}
          />
        </label>
        <button
          className="btn"
          onClick={() => void find()}
          disabled={busy || zip.length !== 5 || outOfQuota}
        >
          {busy ? 'Adding…' : 'Find stock'}
        </button>
      </div>

      {queued && (
        <p className="fs-note">
          Finding stock near {zip}. The answer appears under{' '}
          <Link to="/app/watchlist">My watchlist</Link> in a few seconds — you can keep browsing.
        </p>
      )}

      {outOfQuota && (
        <p className="fs-note">
          That is all your stock checks for today. They reset at midnight.
        </p>
      )}

      {/* A failure is stated as a failure. "None nearby" would be a lie that
          costs someone a drive, or costs them a deal they could have had. */}
      {error && (
        <p className="fs-error">
          Could not check stock. {error}
          {' '}<button className="fs-link" onClick={() => void find()}>Try again</button>
        </p>
      )}

      {result && result.stores.length === 0 && !error && (
        <p className="fs-note">
          No store near {zip} shows this in stock right now.
        </p>
      )}

      {result && result.stores.length > 0 && (
        <>
          <ul className="fs-list">
            {result.stores.map((s) => (
              <li key={s.storeId}>
                <div className="fs-store">
                  <strong>{s.storeName ?? `Store #${s.storeId}`}</strong>
                  {s.distanceMi !== null && <span className="fs-dim"> · {s.distanceMi} mi</span>}
                </div>
                {s.address && (
                  <div className="fs-dim">
                    {s.address}{s.city && `, ${s.city}`}{s.state && `, ${s.state}`} {s.zip}
                  </div>
                )}
                <div className={`fs-qty${s.quantity === 0 ? ' none' : ''}`}>
                  {s.quantity === null
                    ? 'Quantity not published'
                    : s.quantity === 0
                      ? 'None on the shelf'
                      : `${s.quantity} on the shelf`}
                  {s.phone && <a className="fs-call" href={`tel:${s.phone.replace(/\D/g, '')}`}>Call {s.phone}</a>}
                </div>
              </li>
            ))}
          </ul>
          <p className="fs-note">
            {result.cached ? 'From a check in the last few hours. ' : 'Checked just now. '}
            Quantity is what the store reports and can be wrong on the floor.
            The price above comes from our own scan, not this check.
          </p>
        </>
      )}
    </div>
  );
}
