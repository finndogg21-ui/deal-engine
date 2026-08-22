import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getLocalZip } from '../lib/zip.js';
import { ago, displayTitle, hdStoreUrl, money } from '../lib/deal-ui.js';
import '../dashboard.css';

/**
 * The penny detail PAGE — /app/p/:reportId (founder-mandated: a page, not a
 * side panel). Every penny is now a shareable URL: the $0.01 replay runs on
 * load, the whole record prints below, and an inbound visitor (no ZIP, no
 * account) gets the one trial CTA the Find page deliberately keeps quiet.
 */

interface CommunityDetail {
  report_id: number;
  source: string;
  kind: string;
  sku: string | null;
  item_id: string | null;
  title: string;
  price: string | number | null;
  list_price: string | number | null;
  state: string | null;
  city: string | null;
  store_number: string | null;
  product_url: string | null;
  source_url: string | null;
  image_url: string | null;
  reported_at: string | null;
  extras: {
    brand: string | null;
    model_number: string | null;
    upc: string | null;
    tier: string | null;
    first_reported_at: string | null;
    date_added: string | number | null;
    locations: Record<string, Record<string, number>> | null;
  };
}

export default function PennyDealPage() {
  const { reportId } = useParams();
  const nav = useNavigate();
  const [r, setR] = useState<CommunityDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nearestStore, setNearestStore] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/community-deals/${reportId}`);
        const body = await res.json().catch(() => null);
        if (!res.ok || !body) { setErr('This report is gone or the link is wrong.'); return; }
        setR(body as CommunityDetail);
      } catch {
        setErr('Could not load this report. Try again.');
      }
    })();
  }, [reportId]);

  // The HD link opens in the visitor's nearest store's mode when we know it.
  useEffect(() => {
    const zip = getLocalZip();
    if (!zip) return;
    void (async () => {
      try {
        const res = await fetch(`/api/deals/nearby?zip=${encodeURIComponent(zip)}&limit=1`);
        const body = await res.json().catch(() => null);
        if (res.ok && body && typeof body.nearest_store_number === 'string') {
          setNearestStore(body.nearest_store_number);
        }
      } catch { /* plain HD link still works */ }
    })();
  }, []);

  const back = () => {
    // Browser back restores the spool + scroll when we came from Find;
    // a cold inbound visitor gets sent to the penny spool instead.
    if (window.history.length > 1) nav(-1);
    else nav('/app?tab=penny');
  };

  if (err) {
    return (
      <div className="dash penny-page">
        <div className="empty" style={{ marginTop: 'var(--s6)' }}>
          <h2>No report here</h2>
          <p>{err}</p>
          <Link className="btn" to="/app?tab=penny">See today's penny reports</Link>
        </div>
      </div>
    );
  }

  if (!r) return <div className="dash penny-page"><p className="pp-loading">Printing…</p></div>;

  const title = displayTitle(r.title);
  const brand = r.extras.brand && !title.toLowerCase().startsWith(r.extras.brand.toLowerCase())
    ? `${r.extras.brand} ` : '';

  return (
    <div className="dash penny-page">
      <button className="pp-back" onClick={back}>← Back to the tape</button>

      <div className="detail pp-detail">
        <h2>{brand}{title}</h2>
        <p className="sub">
          Home Depot penny report
          {r.extras.tier ? ` · ${r.extras.tier}` : ''}
          {' · via '}{r.source}
        </p>

        {r.image_url && (
          <img src={r.image_url} alt="" style={{ maxWidth: '100%', margin: '8px 0' }} />
        )}

        {/* The $0.01 replay — real data only, printed in sequence. */}
        <div className="ring-replay">
          {r.list_price !== null && (
            <div className="rr-line">RETAIL {money(Number(r.list_price))}</div>
          )}
          <div className="rr-line rr-dots">REPORTED AT REGISTER</div>
          <div className="rr-slam">$0.01</div>
        </div>

        <div className="grid">
          <div className="cell"><div className="k">SKU</div><div className="v">{r.sku ?? '—'}</div></div>
          <div className="cell"><div className="k">Internet #</div><div className="v">{r.item_id ?? '—'}</div></div>
          <div className="cell"><div className="k">Model</div><div className="v">{r.extras.model_number ?? '—'}</div></div>
          <div className="cell"><div className="k">UPC</div><div className="v">{r.extras.upc ?? '—'}</div></div>
          <div className="cell"><div className="k">First reported</div><div className="v">{r.extras.first_reported_at ? ago(r.extras.first_reported_at) : '—'}</div></div>
          <div className="cell"><div className="k">Last seen</div><div className="v">{r.reported_at ? ago(r.reported_at) : '—'}</div></div>
        </div>

        {r.extras.locations && Object.keys(r.extras.locations).length > 0 && (
          <>
            <h3 style={{ margin: '14px 0 6px' }}>Where it's been found</h3>
            <p className="sub" style={{ margin: 0 }}>
              {Object.entries(r.extras.locations).map(([st, cities]) =>
                `${st}: ${Object.entries(cities).map(([city, n]) => `${city} ×${n}`).join(', ')}`
              ).join(' · ')}
            </p>
          </>
        )}

        <p className="sub" style={{ marginTop: 12 }}>
          Penny status is store-specific and never guaranteed. It won't show as
          $0.01 online — scan the SKU or UPC in store to confirm.
        </p>

        <p style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
          {r.product_url && (
            <a className="btn" href={hdStoreUrl(r.product_url, nearestStore) ?? r.product_url}
              target="_blank" rel="noreferrer">Open at your store on Home Depot</a>
          )}
        </p>

        {/* The one trial pitch, where an inbound visitor actually lands. */}
        <div className="pp-cta">
          <p className="pp-cta-line">
            Pennies vanish in hours. Get the next one near you the moment it's reported.
          </p>
          <Link className="btn pp-cta-btn" to="/signup">Get penny alerts — start free</Link>
        </div>
      </div>
    </div>
  );
}
