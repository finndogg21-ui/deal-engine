/**
 * Blueprint G — orders.
 *
 * The fee field is prefilled and always editable, and it says where the
 * number came from. A fee estimate presented as fact is how a profit screen
 * quietly becomes wrong.
 */

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/auth.js';
import '../../resell.css';

interface Order {
  order_id: string;
  item_id: string | null;
  title: string | null;
  marketplace: string;
  sale_price: number;
  fees: number;
  shipping_cost: number;
  cost_basis: number | null;
  net: number | null;
  sold_at: string;
  status: string;
}

interface Item { item_id: string; title: string; status: string }

interface FeeInfo {
  verified_on: string;
  disclaimer: string;
  marketplaces: { id: string; label: string; note: string; suggested_fee: number | null }[];
}

const money = (n: number) => `$${n.toFixed(2)}`;

export default function Orders() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [fees, setFees] = useState<FeeInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [itemId, setItemId] = useState('');
  const [marketplace, setMarketplace] = useState('ebay');
  const [salePrice, setSalePrice] = useState('');
  const [feeValue, setFeeValue] = useState('');
  const [feeTouched, setFeeTouched] = useState(false);
  const [localPickup, setLocalPickup] = useState(false);
  const [shipping, setShipping] = useState('');

  const load = useCallback(async () => {
    try {
      const [o, i] = await Promise.all([
        api<Order[]>('/api/orders'),
        api<Item[]>('/api/inventory?status=held'),
      ]);
      setOrders(o);
      setItems(i);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setOrders([]);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Refresh the quote whenever the inputs it depends on change — but never
  // clobber a number the person typed themselves.
  useEffect(() => {
    const price = Number(salePrice) || 0;
    if (price <= 0) { setFees(null); return; }
    let live = true;
    void (async () => {
      try {
        const q = new URLSearchParams({ sale_price: String(price), local_pickup: String(localPickup) });
        const f = await api<FeeInfo>(`/api/fees?${q}`);
        if (!live) return;
        setFees(f);
        if (!feeTouched) {
          const m = f.marketplaces.find((x) => x.id === marketplace);
          if (m?.suggested_fee !== null && m?.suggested_fee !== undefined) {
            setFeeValue(m.suggested_fee.toFixed(2));
          }
        }
      } catch { /* the field stays editable regardless */ }
    })();
    return () => { live = false; };
  }, [salePrice, marketplace, localPickup, feeTouched]);

  const rule = fees?.marketplaces.find((m) => m.id === marketplace);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (salePrice === '' || busy) return;
    setBusy(true);
    try {
      await api('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          item_id: itemId || null,
          marketplace,
          sale_price: Number(salePrice),
          fees: feeValue === '' ? null : Number(feeValue),
          shipping_cost: shipping === '' ? 0 : Number(shipping),
          local_pickup: localPickup,
        }),
      });
      setItemId(''); setSalePrice(''); setFeeValue(''); setShipping('');
      setFeeTouched(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const preview =
    salePrice !== ''
      ? Number(salePrice) - Number(feeValue || 0) - Number(shipping || 0)
      : null;

  return (
    <div className="rs">
      <div className="dash-eyebrow">Resell</div>
      <h1 className="rs-title">Orders</h1>
      <p className="rs-lede">
        Sales across eBay, Facebook Marketplace, and anywhere else you move things.
        Recording a sale marks the item sold.
      </p>

      <form className="rs-add rs-add-wide" onSubmit={add}>
        <label className="rs-field rs-grow">
          <span>Item</span>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">Not from inventory</option>
            {items.map((i) => <option key={i.item_id} value={i.item_id}>{i.title}</option>)}
          </select>
        </label>

        <label className="rs-field">
          <span>Sold on</span>
          <select value={marketplace} onChange={(e) => { setMarketplace(e.target.value); setFeeTouched(false); }}>
            <option value="ebay">eBay</option>
            <option value="facebook">Facebook</option>
            <option value="mercari">Mercari</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label className="rs-field">
          <span>Sale price</span>
          <input value={salePrice} onChange={(e) => setSalePrice(e.target.value.replace(/[^\d.]/g, ''))}
            placeholder="0.00" inputMode="decimal" />
        </label>

        <label className="rs-field">
          <span>Fees</span>
          <input value={feeValue}
            onChange={(e) => { setFeeTouched(true); setFeeValue(e.target.value.replace(/[^\d.]/g, '')); }}
            placeholder="0.00" inputMode="decimal" />
        </label>

        <label className="rs-field">
          <span>Shipping</span>
          <input value={shipping} onChange={(e) => setShipping(e.target.value.replace(/[^\d.]/g, ''))}
            placeholder="0.00" inputMode="decimal" />
        </label>

        <button className="btn" type="submit" disabled={busy || salePrice === ''}>Record sale</button>

        {marketplace === 'facebook' && (
          <label className="rs-checkline">
            <input type="checkbox" checked={localPickup}
              onChange={(e) => { setLocalPickup(e.target.checked); setFeeTouched(false); }} />
            Local pickup — no selling fee
          </label>
        )}

        {rule && (
          <p className="rs-note">
            {feeTouched ? 'Using your number. ' : `Prefilled from ${rule.label}'s published rate. `}
            {rule.note} Rates checked {fees?.verified_on}; always confirm against your actual payout.
          </p>
        )}

        {preview !== null && (
          <p className="rs-preview">
            Proceeds after fees and shipping: <strong>{money(preview)}</strong>
            {itemId && ' — net profit shows once this is saved.'}
          </p>
        )}
      </form>

      {error && <p className="rs-error">{error}</p>}
      {orders === null && <p className="rs-lede">Loading…</p>}

      {orders?.length === 0 && (
        <div className="rs-empty">
          <p>No sales recorded.</p>
          <p className="rs-lede">Record one above and the profit page starts working.</p>
        </div>
      )}

      {orders && orders.length > 0 && (
        <div className="rs-tablewrap">
          <table className="rs-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Where</th>
                <th className="rs-num">Sold for</th>
                <th className="rs-num">Fees</th>
                <th className="rs-num">Shipping</th>
                <th className="rs-num">Cost</th>
                <th className="rs-num">Net</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.order_id}>
                  <td className="rs-item">{o.title ?? <span className="rs-dim">Not linked</span>}</td>
                  <td className="rs-dim">{o.marketplace}</td>
                  <td className="rs-num">{money(o.sale_price)}</td>
                  <td className="rs-num">{money(o.fees)}</td>
                  <td className="rs-num">{money(o.shipping_cost)}</td>
                  <td className="rs-num">{o.cost_basis === null ? '—' : money(o.cost_basis)}</td>
                  <td className={`rs-num rs-net${o.net !== null && o.net < 0 ? ' neg' : ''}`}>
                    {o.net === null ? '—' : money(o.net)}
                  </td>
                  <td className="rs-dim">{String(o.sold_at).slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
