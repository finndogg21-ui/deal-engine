/**
 * Blueprint B — the watchlist.
 *
 * The live preview is the whole point of this screen. A watch that never
 * fires is indistinguishable from a product that does not work, and people
 * do not file bug reports about silence — they just leave. So the count runs
 * while you type, before you can save the thing.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/auth.js';
import '../../watchlist.css';

interface Watch {
  watch_id: string;
  term: string;
  category_ids: string[];
  min_discount: number;
  max_price: number | null;
  retailer: string | null;
  active: boolean;
  matched_last_week: number;
  alerts_7d: number;
  matching_on: 'category' | 'title';
}

interface Preview {
  term: string;
  category_ids: string[];
  source: string;
  confidence: number;
  matched_last_week: number;
  matching_on: 'category' | 'title';
}

const RETAILERS = [
  { value: '', label: 'Any store' },
  { value: 'homedepot', label: 'Home Depot' },
  { value: 'lowes', label: "Lowe's" },
];

/** What the preview count actually means, in words rather than a number alone. */
function verdict(p: Preview | null, loading: boolean): { tone: string; text: string } {
  if (loading) return { tone: 'muted', text: 'Checking last week…' };
  if (!p) return { tone: 'muted', text: 'Type a product to see how often this would fire.' };
  if (p.matched_last_week === 0) {
    return {
      tone: 'warn',
      text: 'Nothing matched this in the last week. Lower the discount or widen the price and it will fire more often.',
    };
  }
  if (p.matched_last_week > 40) {
    return {
      tone: 'warn',
      text: `${p.matched_last_week} deals matched last week. That is a lot of alerts — raise the minimum discount to cut it down.`,
    };
  }
  const n = p.matched_last_week;
  return {
    tone: 'good',
    text: n === 1
      ? '1 deal matched this in the last week.'
      : `${n} deals matched this in the last week.`,
  };
}

export default function Watchlist() {
  const [watches, setWatches] = useState<Watch[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [term, setTerm] = useState('');
  const [minDiscount, setMinDiscount] = useState(40);
  const [maxPrice, setMaxPrice] = useState('');
  const [retailer, setRetailer] = useState('');

  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setWatches(await api<Watch[]>('/api/watchlists'));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setWatches([]);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Debounced, and every in-flight preview is superseded by the next one —
  // otherwise a slow early response overwrites a fast later one and the count
  // on screen belongs to a filter the person already changed.
  const seq = useRef(0);
  useEffect(() => {
    const t = term.trim();
    if (t.length < 2) { setPreview(null); setPreviewing(false); return; }

    setPreviewing(true);
    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      try {
        const q = new URLSearchParams({ term: t, min_discount: String(minDiscount) });
        if (maxPrice) q.set('max_price', maxPrice);
        if (retailer) q.set('retailer', retailer);
        const p = await api<Preview>(`/api/watchlists/preview?${q}`);
        if (mine === seq.current) { setPreview(p); setPreviewing(false); }
      } catch {
        if (mine === seq.current) { setPreview(null); setPreviewing(false); }
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [term, minDiscount, maxPrice, retailer]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!term.trim() || saving) return;
    setSaving(true);
    try {
      await api('/api/watchlists', {
        method: 'POST',
        body: JSON.stringify({
          term: term.trim(),
          min_discount: minDiscount,
          max_price: maxPrice === '' ? null : Number(maxPrice),
          retailer: retailer || null,
        }),
      });
      setTerm(''); setMaxPrice(''); setRetailer(''); setPreview(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggle(w: Watch) {
    await api(`/api/watchlists/${w.watch_id}`, {
      method: 'PATCH', body: JSON.stringify({ active: !w.active }),
    });
    await load();
  }

  async function remove(w: Watch) {
    await api(`/api/watchlists/${w.watch_id}`, { method: 'DELETE' });
    await load();
  }

  const v = verdict(preview, previewing);

  return (
    <div className="wl">
      <div className="dash-eyebrow">Find</div>
      <h1 className="wl-title">My watchlist</h1>
      <p className="wl-lede">
        Type what you want, not a model number. Matching runs on categories, so every
        brand of the thing counts.
      </p>

      <form className="wl-form" onSubmit={add}>
        <div className="wl-row">
          <label className="wl-field wl-grow">
            <span>Watch for</span>
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="blender, drill, patio set"
              maxLength={60}
              autoComplete="off"
            />
          </label>

          <label className="wl-field">
            <span>At least</span>
            <select value={minDiscount} onChange={(e) => setMinDiscount(Number(e.target.value))}>
              {[0, 25, 40, 50, 70, 90].map((d) => (
                <option key={d} value={d}>{d}% off</option>
              ))}
            </select>
          </label>

          <label className="wl-field">
            <span>Under</span>
            <input
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value.replace(/[^\d.]/g, ''))}
              placeholder="any price"
              inputMode="decimal"
            />
          </label>

          <label className="wl-field">
            <span>Where</span>
            <select value={retailer} onChange={(e) => setRetailer(e.target.value)}>
              {RETAILERS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
        </div>

        <div className="wl-foot">
          <p className={`wl-verdict ${v.tone}`} aria-live="polite">{v.text}</p>
          <button className="btn" type="submit" disabled={!term.trim() || saving}>
            {saving ? 'Adding…' : 'Add watch'}
          </button>
        </div>

        {preview && preview.matching_on === 'title' && (
          <p className="wl-note">
            We do not have a category for “{preview.term}” yet, so this matches on the
            product name instead. It will get sharper as the scan sees more of the catalog.
          </p>
        )}
        {preview && preview.matching_on === 'category' && preview.category_ids.length > 0 && (
          <p className="wl-note">
            Matching every product in {preview.category_ids.map((c) => `“${c}”`).join(', ')}.
          </p>
        )}
      </form>

      {error && <p className="wl-error">{error}</p>}

      {watches === null && <p className="wl-lede">Loading your watches…</p>}

      {watches?.length === 0 && (
        <div className="wl-empty">
          <p>No watches yet.</p>
          <p className="wl-lede">
            Add one above and you will get told when it drops, at most a few
            times a day.
          </p>
        </div>
      )}

      {watches && watches.length > 0 && (
        <ul className="wl-list">
          {watches.map((w) => (
            <li key={w.watch_id} className={`wl-item${w.active ? '' : ' off'}`}>
              <div className="wl-item-main">
                <h2>{w.term}</h2>
                <p className="wl-meta">
                  {w.min_discount}%+ off
                  {w.max_price !== null && ` · under $${w.max_price.toFixed(2)}`}
                  {w.retailer && ` · ${w.retailer === 'lowes' ? "Lowe's" : 'Home Depot'}`}
                  {w.matching_on === 'title' && ' · matching on name'}
                </p>
              </div>

              <div className="wl-stats">
                <div>
                  <strong>{w.matched_last_week}</strong>
                  <span>matched, 7d</span>
                </div>
                <div>
                  <strong>{w.alerts_7d}</strong>
                  <span>alerts sent</span>
                </div>
              </div>

              <div className="wl-actions">
                <button className="wl-ghost" onClick={() => void toggle(w)}>
                  {w.active ? 'Pause' : 'Resume'}
                </button>
                <button className="wl-ghost danger" onClick={() => void remove(w)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
