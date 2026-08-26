/**
 * Blueprint J — stock check.
 *
 * The important case here is the unsupported retailer. An empty results table
 * reads as "none nearby", which is a claim we cannot make for Lowe's, Walmart
 * or Target — so those get an explicit answer instead of a blank grid.
 */

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, useAuth } from '../../lib/auth.js';
import '../../resell.css';
import '../../penny.css';

interface StoreRow {
  storeNumber: string;
  storeName: string;
  quantity: number | null;
  aisleBay: string | null;
  price: number | null;
  discontinued: boolean;
  limitedQuantity: boolean;
  distanceMi?: number | null;
}

interface Result {
  retailer: string;
  label: string;
  supported: boolean;
  reason?: string;
  cached?: boolean;
  checked_at?: string;
  stores: StoreRow[];
}

const SLUGS: Record<string, string> = {
  'home-depot': 'homedepot',
  lowes: 'lowes',
  walmart: 'walmart',
  target: 'target',
  'best-buy': 'bestbuy',
  'dollar-general': 'dollargeneral',
  'tractor-supply': 'tractorsupply',
  costco: 'costco',
};

export default function StockCheck() {
  const { retailer: slug } = useParams();
  const { me } = useAuth();
  const retailer = SLUGS[slug ?? ''] ?? 'homedepot';

  const [sku, setSku] = useState('');
  const [zip, setZip] = useState(me?.zip ?? '');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const q = new URLSearchParams({ retailer, sku: sku.trim(), zip: zip.trim() });
      setResult(await api<Result>(`/api/stock?${q}`));
    } catch (err) {
      const e2 = err as Error & { data?: Result & { detail?: string } };
      setError(e2.data?.detail ?? e2.message);
      setResult(e2.data?.supported !== undefined ? (e2.data as Result) : null);
    } finally {
      setBusy(false);
    }
  }

  const label = result?.label ?? (slug ?? '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="rs">
      <div className="dash-eyebrow">Stock check</div>
      <h1 className="rs-title">{label} stock check</h1>
      <p className="rs-lede">
        Look up a SKU or UPC and see which nearby stores have it, how many are left,
        and where on the floor it sits.
      </p>

      <form className="rs-add" onSubmit={lookup}>
        <label className="rs-field rs-grow">
          <span>SKU or UPC</span>
          <input value={sku} onChange={(e) => setSku(e.target.value.replace(/\D/g, ''))}
            placeholder="1000420531" inputMode="numeric" />
        </label>
        <label className="rs-field">
          <span>Near ZIP</span>
          <input value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="78232" inputMode="numeric" />
        </label>
        <button className="btn" type="submit" disabled={busy || sku.length < 3 || zip.length !== 5}>
          {busy ? 'Checking…' : 'Check stock'}
        </button>
      </form>

      {result && !result.supported && (
        <div className="rs-empty">
          <p>Not available for {result.label}</p>
          <p className="rs-lede">{result.reason}</p>
        </div>
      )}

      {error && result?.supported !== false && (
        <div className="rs-empty">
          <p>Could not check stock</p>
          <p className="rs-lede">{error}</p>
        </div>
      )}

      {result?.supported && result.stores.length > 0 && (
        <>
          <p className="rs-note">
            Checked {result.checked_at ? new Date(result.checked_at).toLocaleTimeString() : 'just now'}
            {result.cached && ' — cached, refreshes hourly'}. Quantities are what the
            retailer publishes and can be wrong on the floor.
          </p>
          <div className="rs-tablewrap">
            <table className="rs-table">
              <thead>
                <tr>
                  <th>Store</th>
                  <th className="rs-num">Qty</th>
                  <th>Aisle</th>
                  <th className="rs-num">Price</th>
                  <th className="rs-num">Distance</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {result.stores.map((s) => (
                  <tr key={s.storeNumber}>
                    <td className="rs-item">{s.storeName}</td>
                    <td className="rs-num">{s.quantity ?? '—'}</td>
                    <td className="rs-dim">{s.aisleBay ?? '—'}</td>
                    <td className="rs-num">{s.price === null ? '—' : `$${s.price.toFixed(2)}`}</td>
                    <td className="rs-num">{s.distanceMi == null ? '—' : `${s.distanceMi} mi`}</td>
                    <td>
                      {s.discontinued && <span className="rs-pill returned">discontinued</span>}
                      {s.limitedQuantity && <span className="rs-pill">limited</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {result?.supported && result.stores.length === 0 && !error && (
        <div className="rs-empty">
          <p>No nearby store carries it</p>
          <p className="rs-lede">Nothing within range has that SKU on hand right now.</p>
        </div>
      )}
    </div>
  );
}
