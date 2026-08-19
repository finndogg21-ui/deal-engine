/**
 * Blueprint H — profit.
 *
 * "The number worth filming." Net, not revenue, not gross. Every figure here
 * is derived from stored orders and inventory at request time, so it cannot
 * drift from the rows it came from.
 */

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/auth.js';
import '../../resell.css';

interface Profit {
  totals: {
    orders: number; revenue: number; fees: number; shipping: number;
    cost: number; net: number; roi_pct: number | null; orders_without_cost: number;
  };
  inventory_held: { items: number; tied_up: number };
  by_month: { month: string; orders: number; net: number }[];
  by_store: { label: string; orders: number; net: number }[];
  by_category: { label: string; orders: number; net: number }[];
  rows: {
    order_id: string; sold_at: string; title: string | null; marketplace: string;
    store_name: string | null; sale_price: number; fees: number;
    shipping_cost: number; cost_basis: number | null; net: number;
  }[];
}

const money = (n: number) => `$${n.toFixed(2)}`;

/** Month label from YYYY-MM without constructing a Date, which would shift
 *  the month backwards for anyone west of UTC. */
function monthLabel(ym: string): string {
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [y, m] = ym.split('-');
  return `${names[Number(m) - 1] ?? ym} ${String(y).slice(2)}`;
}

export default function Profit() {
  const [data, setData] = useState<Profit | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<Profit>('/api/profit'));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (error) return <div className="rs"><p className="rs-error">{error}</p></div>;
  if (!data) return <div className="rs"><p className="rs-lede">Loading…</p></div>;

  const { totals, inventory_held: held, by_month: months } = data;
  const thisMonth = months[months.length - 1];
  const peak = Math.max(...months.map((m) => Math.abs(m.net)), 1);

  return (
    <div className="rs">
      <div className="dash-eyebrow">Resell</div>
      <h1 className="rs-title">Profit</h1>
      <p className="rs-lede">
        What you actually made, after fees. Refunded orders are left out.
      </p>

      {totals.orders === 0 ? (
        <div className="rs-empty">
          <p>Nothing sold yet.</p>
          <p className="rs-lede">Record a sale on the orders page and this fills in.</p>
        </div>
      ) : (
        <>
          <div className="rs-headline">
            <div className="rs-big">
              <span>Net, this month</span>
              <strong className={thisMonth && thisMonth.net < 0 ? 'neg' : undefined}>
                {money(thisMonth?.net ?? 0)}
              </strong>
            </div>
            <div className="rs-big">
              <span>Net, all time</span>
              <strong className={totals.net < 0 ? 'neg' : undefined}>{money(totals.net)}</strong>
            </div>
            <div className="rs-big">
              <span>Return on money spent</span>
              <strong>{totals.roi_pct === null ? '—' : `${totals.roi_pct}%`}</strong>
            </div>
          </div>

          <div className="rs-stats">
            <div><strong>{money(totals.revenue)}</strong><span>revenue</span></div>
            <div><strong>{money(totals.fees)}</strong><span>fees</span></div>
            <div><strong>{money(totals.shipping)}</strong><span>shipping</span></div>
            <div><strong>{money(totals.cost)}</strong><span>cost of goods</span></div>
            <div><strong>{money(held.tied_up)}</strong><span>tied up in {held.items} unsold</span></div>
          </div>

          {totals.orders_without_cost > 0 && (
            <p className="rs-note">
              {totals.orders_without_cost} {totals.orders_without_cost === 1 ? 'order is' : 'orders are'} not
              linked to an inventory item, so {totals.orders_without_cost === 1 ? 'its' : 'their'} cost
              basis counts as zero. Net is overstated by whatever those actually cost.
            </p>
          )}

          {months.length > 1 && (
            <section className="rs-chart">
              <h2>Net by month</h2>
              <div className="rs-bars">
                {months.map((m) => (
                  <div className="rs-bar-col" key={m.month}>
                    <div className="rs-bar-track">
                      <div
                        className={`rs-bar-fill${m.net < 0 ? ' neg' : ''}`}
                        style={{ height: `${Math.max((Math.abs(m.net) / peak) * 100, 2)}%` }}
                      />
                    </div>
                    <span className="rs-bar-val">{money(m.net)}</span>
                    <span className="rs-bar-lab">{monthLabel(m.month)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="rs-split">
            <section>
              <h2>Best stores</h2>
              <ul className="rs-rank">
                {data.by_store.slice(0, 5).map((s) => (
                  <li key={s.label}>
                    <span>{s.label}</span>
                    <em>{money(s.net)}</em>
                    <small>{s.orders} {s.orders === 1 ? 'sale' : 'sales'}</small>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h2>Best categories</h2>
              <ul className="rs-rank">
                {data.by_category.slice(0, 5).map((c) => (
                  <li key={c.label}>
                    <span>{c.label}</span>
                    <em>{money(c.net)}</em>
                    <small>{c.orders} {c.orders === 1 ? 'sale' : 'sales'}</small>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="rs-tablewrap">
            <table className="rs-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Where</th>
                  <th className="rs-num">Sold</th>
                  <th className="rs-num">Fees</th>
                  <th className="rs-num">Ship</th>
                  <th className="rs-num">Cost</th>
                  <th className="rs-num">Net</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.order_id}>
                    <td className="rs-item">{r.title ?? <span className="rs-dim">Not linked</span>}</td>
                    <td className="rs-dim">{r.marketplace}</td>
                    <td className="rs-num">{money(r.sale_price)}</td>
                    <td className="rs-num">{money(r.fees)}</td>
                    <td className="rs-num">{money(r.shipping_cost)}</td>
                    <td className="rs-num">{r.cost_basis === null ? '—' : money(r.cost_basis)}</td>
                    <td className={`rs-num rs-net${r.net < 0 ? ' neg' : ''}`}>{money(r.net)}</td>
                    <td className="rs-dim">{String(r.sold_at).slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="rs-note">
            This is recorded profit. Predicted profit at alert time needs a resale comps
            source and is deliberately not guessed at here.
          </p>
        </>
      )}
    </div>
  );
}
