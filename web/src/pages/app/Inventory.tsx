/**
 * Blueprint F — inventory.
 *
 * A table, because this is the one screen in the product where people are
 * doing bookkeeping rather than browsing. Cards would be worse here and the
 * consistency argument does not outrank being able to scan forty rows.
 */

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/auth.js';
import '../../resell.css';

interface Item {
  item_id: string;
  title: string;
  cost_basis: number;
  quantity: number;
  condition: string | null;
  location: string | null;
  store_name: string | null;
  acquired_at: string;
  status: string;
  order_count: number;
  proceeds: number | null;
}

const STATUSES = ['held', 'listed', 'sold', 'returned'] as const;
const money = (n: number) => `$${n.toFixed(2)}`;

export default function Inventory() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [filter, setFilter] = useState<string>('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState('');
  const [cost, setCost] = useState('');
  const [qty, setQty] = useState('1');

  const load = useCallback(async () => {
    try {
      const q = filter ? `?status=${filter}` : '';
      setItems(await api<Item[]>(`/api/inventory${q}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setItems([]);
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || cost === '' || busy) return;
    setBusy(true);
    try {
      await api('/api/inventory', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), cost_basis: Number(cost), quantity: Number(qty) || 1 }),
      });
      setTitle(''); setCost(''); setQty('1');
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function bulk(status: string) {
    if (picked.size === 0) return;
    await api('/api/inventory/bulk-status', {
      method: 'POST',
      body: JSON.stringify({ item_ids: [...picked], status }),
    });
    setPicked(new Set());
    await load();
  }

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const spent = items?.reduce((s, i) => s + i.cost_basis * i.quantity, 0) ?? 0;
  const onShelf = items?.filter((i) => i.status === 'held' || i.status === 'listed').length ?? 0;

  return (
    <div className="rs">
      <div className="dash-eyebrow">Resell</div>
      <h1 className="rs-title">Inventory</h1>
      <p className="rs-lede">
        What you bought, what it cost, and where it is. Add straight from a deal and
        nothing gets retyped.
      </p>

      <div className="rs-stats">
        <div><strong>{items?.length ?? 0}</strong><span>items</span></div>
        <div><strong>{onShelf}</strong><span>still on the shelf</span></div>
        <div><strong>{money(spent)}</strong><span>tied up</span></div>
      </div>

      <form className="rs-add" onSubmit={add}>
        <label className="rs-field rs-grow">
          <span>Item</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="What is it?" maxLength={300} />
        </label>
        <label className="rs-field">
          <span>Paid</span>
          <input value={cost} onChange={(e) => setCost(e.target.value.replace(/[^\d.]/g, ''))}
            placeholder="0.00" inputMode="decimal" />
        </label>
        <label className="rs-field rs-narrow">
          <span>Qty</span>
          <input value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
        </label>
        <button className="btn" type="submit" disabled={busy || !title.trim() || cost === ''}>
          Add item
        </button>
      </form>

      <div className="rs-bar">
        <div className="rs-tabs" role="tablist">
          <button role="tab" aria-selected={filter === ''} className={`rs-tab${filter === '' ? ' on' : ''}`}
            onClick={() => setFilter('')}>All</button>
          {STATUSES.map((s) => (
            <button key={s} role="tab" aria-selected={filter === s}
              className={`rs-tab${filter === s ? ' on' : ''}`} onClick={() => setFilter(s)}>
              {s[0]!.toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {picked.size > 0 && (
          <div className="rs-bulk">
            <span>{picked.size} selected</span>
            {STATUSES.map((s) => (
              <button key={s} className="rs-ghost" onClick={() => void bulk(s)}>Mark {s}</button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="rs-error">{error}</p>}
      {items === null && <p className="rs-lede">Loading…</p>}

      {items?.length === 0 && (
        <div className="rs-empty">
          <p>Nothing here yet.</p>
          <p className="rs-lede">
            Add an item above, or hit “Add to inventory” on any deal and it arrives
            with the price and store already filled in.
          </p>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="rs-tablewrap">
          <table className="rs-table">
            <thead>
              <tr>
                <th className="rs-check"><span className="rs-sr">Select</span></th>
                <th>Item</th>
                <th className="rs-num">Paid</th>
                <th className="rs-num">Qty</th>
                <th>From</th>
                <th>Acquired</th>
                <th>Status</th>
                <th className="rs-num">Proceeds</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.item_id} className={picked.has(i.item_id) ? 'on' : undefined}>
                  <td className="rs-check">
                    <input type="checkbox" checked={picked.has(i.item_id)}
                      onChange={() => toggle(i.item_id)}
                      aria-label={`Select ${i.title}`} />
                  </td>
                  <td className="rs-item">{i.title}</td>
                  <td className="rs-num">{money(i.cost_basis)}</td>
                  <td className="rs-num">{i.quantity}</td>
                  <td className="rs-dim">{i.store_name ?? '—'}</td>
                  <td className="rs-dim">{String(i.acquired_at).slice(0, 10)}</td>
                  <td><span className={`rs-pill ${i.status}`}>{i.status}</span></td>
                  <td className="rs-num">{i.proceeds === null ? '—' : money(i.proceeds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
