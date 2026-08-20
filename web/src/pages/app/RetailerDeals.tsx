/**
 * Deals for one retailer.
 *
 * Same data as All deals, filtered. Exists because a reseller planning a trip
 * goes to one store, not to "retail in general".
 *
 * The honest part: a retailer with no source behind it shows why it is empty
 * rather than an empty grid. Right now the sweep is Home Depot only, so
 * Lowe's genuinely has nothing — saying so beats implying we looked and found
 * no deals.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/auth.js';
import '../../dashboard.css';
import '../../queue.css';

interface Deal {
  product_id: string;
  store_id: string;
  title: string;
  retailer: string;
  image_url: string | null;
  product_url: string | null;
  price: number | null;
  list_price: number | null;
  saves: number | null;
  discount_pct: number | null;
  penny_score: number;
  last_seen_at: string;
}

const RETAILERS: Record<string, { name: string; live: boolean; why: string }> = {
  homedepot: {
    name: 'Home Depot',
    live: true,
    why: '',
  },
  lowes: {
    name: "Lowe's",
    live: false,
    // Stated plainly. The sweep actor covers Home Depot only.
    why:
      'The daily sweep does not cover Lowe’s yet — the scraper behind it is Home Depot only. ' +
      'Nothing here is missing because prices were checked and came back full; it is missing because ' +
      'nothing has been checked. A Lowe’s source is a separate piece of work.',
  },
};

export default function RetailerDeals() {
  const { retailer = 'homedepot' } = useParams();
  const info = RETAILERS[retailer] ?? { name: retailer, live: false, why: 'This retailer is not covered yet.' };

  const [rows, setRows] = useState<Deal[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRows(null);
    try {
      const all = await api<Deal[]>('/api/candidates?limit=500');
      setRows(all.filter((d) => d.retailer === retailer));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setRows([]);
    }
  }, [retailer]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="qd">
      <div className="dash-eyebrow">By retailer</div>
      <h1 className="qd-title">{info.name} deals</h1>
      <p className="qd-lede">
        Everything marked down at least 25% at {info.name}, from the most recent sweep.
      </p>

      {error && <p className="qd-notice">{error}</p>}

      {rows !== null && rows.length === 0 && (
        <div className="qd-empty">
          <p style={{ fontSize: 21, fontWeight: 600, margin: '0 0 8px', color: 'var(--ink)' }}>
            {info.live ? `Nothing at ${info.name} right now` : `${info.name} is not covered yet`}
          </p>
          <p style={{ margin: '0 auto', maxWidth: '60ch' }}>
            {info.live
              ? 'The last sweep found no markdowns of 25% or more here. Deep clearance comes in waves.'
              : info.why}
          </p>
        </div>
      )}

      {rows !== null && rows.length > 0 && (
        <div className="deck">
          {rows.map((d) => (
            <article className="card-deal" key={`${d.product_id}|${d.store_id}`}>
              <div className="card-img">
                {d.discount_pct !== null && (
                  <span className="badge-off">{Math.round(d.discount_pct)}% off</span>
                )}
                {d.image_url
                  ? <img src={d.image_url} alt="" loading="lazy" decoding="async" />
                  : <svg className="ph" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="1.5" aria-hidden="true">
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="M3 15l5-4 4 3 3-2 6 4" />
                    </svg>}
              </div>
              <div className="card-body">
                <p className="card-title">{d.title}</p>
                <div className="card-price">
                  <span className="now">{d.price === null ? 'Unknown' : `$${d.price.toFixed(2)}`}</span>
                  {d.list_price !== null && (
                    <span className="was">Was <b>${d.list_price.toFixed(2)}</b></span>
                  )}
                </div>
                {d.saves !== null && d.saves > 0 && (
                  <div className="card-save">Save ${d.saves.toFixed(2)}</div>
                )}
                <div className="card-facts">
                  <span className="card-possible">Possible deal · check your store</span>
                </div>
                <Link className="btn" to={`/app/deal/${encodeURIComponent(d.product_id)}/${encodeURIComponent(d.store_id)}`}>See this deal</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
