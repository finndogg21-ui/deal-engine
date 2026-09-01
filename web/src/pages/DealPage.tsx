/**
 * THE DEAL PAGE — /app/d/:retailer/:itemId
 *
 * Every verified deal is its own page, not a side panel. A panel could not show
 * the whole story at once, and it could not be shared, bookmarked, or opened in
 * a second tab while standing in an aisle — which is exactly when a reseller
 * wants it.
 *
 * The page leads with the two numbers that decide whether to drive: what it
 * costs and what it saves. Everything else supports that.
 */

import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { money, ago, displayTitle } from '../lib/deal-ui.js';
import { RETAILERS } from '../lib/retailers.js';
import StoreLedger, { type LedgerRow } from '../components/StoreLedger.js';

interface Row {
  retailer: string;
  item_id: string;
  sku: string | null;
  title: string | null;
  image_url: string | null;
  product_url: string | null;
  hd_price: string | number | null;
  hd_list: string | number | null;
  hd_discount: string | number | null;
  deal_kind: string | null;
  clearance_price: string | number | null;
  clearance_pct: string | number | null;
  clearance_store?: string | null;
  clearance_stores_checked?: number | null;
  checked_at: string | null;
  source: string | null;
  stores?: LedgerRow[];
}

const n = (v: unknown): number | null =>
  v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);

const retailerName = (slug: string) =>
  RETAILERS.find((r) => r.slug === slug || r.slug.replace(/-/g, '') === slug)?.name ?? slug;

/* "Lowe's" + "'s" printed "Lowe's's". A brand name already ending in s
   absorbs the genitive — "Lowe's own data" is what a copywriter writes —
   so those take the name unchanged. Home Depot and Target keep the 's. */
const possessive = (name: string) => (name.endsWith('s') ? name : `${name}'s`);

export default function DealPage() {
  const { retailer, itemId } = useParams();
  const navigate = useNavigate();
  const [row, setRow] = useState<Row | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Scope to the retailer, or a small retailer's item is crowded out of
        // the global top-200 by the huge high-discount retailers and the detail
        // page 404s a deal that IS published. (Same fix as the list feed.)
        const scope = retailer ? `&retailer=${encodeURIComponent(retailer)}` : '';
        const r = await fetch(`/api/deals/published?limit=200${scope}`);
        if (!r.ok) { if (alive) setState('missing'); return; }
        const body = await r.json();
        const found = (body.deals as Row[] | undefined)?.find(
          (d) => String(d.item_id) === String(itemId) && String(d.retailer) === String(retailer),
        );
        if (!alive) return;
        if (!found) { setState('missing'); return; }
        setRow(found);
        setState('ready');
      } catch {
        if (alive) setState('missing');
      }
    })();
    return () => { alive = false; };
  }, [retailer, itemId]);

  if (state === 'loading') {
    return <main className="wrap page-head"><p className="lede">Loading</p></main>;
  }

  if (state === 'missing' || !row) {
    return (
      <main className="wrap page-head">
        <h1>Deal not found</h1>
        <p className="lede">
          This deal is no longer published. It may have been re-checked and pulled
          because the markdown ended.
        </p>
        <button className="btn" onClick={() => navigate('/app?tab=all')}>Back to all deals</button>
      </main>
    );
  }

  const price = n(row.hd_price);
  const listPrice = n(row.hd_list);
  const clearance = n(row.clearance_price);
  const clearancePct = n(row.clearance_pct);
  const isHidden = row.deal_kind === 'hidden_clearance';

  // A clearance price only counts when it is genuinely below the shelf price.
  const realClearance =
    isHidden && clearance !== null && price !== null && clearance < price ? clearance : null;

  const payNow = realClearance ?? price;
  const compareAt = realClearance !== null ? price : listPrice;
  const saves =
    payNow !== null && compareAt !== null && compareAt > payNow
      ? Math.round((compareAt - payNow) * 100) / 100
      : null;
  const pct =
    realClearance !== null
      ? clearancePct
      : n(row.hd_discount);

  return (
    <main className="wrap deal-page">
      <Link to="/app?tab=all" className="deal-back">← All deals</Link>

      <div className="deal-top">
        <div className="deal-shot">
          {row.image_url
            ? <img src={row.image_url} alt="" />
            : <div className="deal-noshot" aria-hidden="true" />}
        </div>

        <div className="deal-facts">
          <span className="retailer">{retailerName(row.retailer)}</span>
          <h1>{displayTitle(row.title ?? '')}</h1>

          {/* THE TWO NUMBERS THAT DECIDE THE DRIVE. */}
          {isHidden && realClearance === null ? (
            <>
              <div className="deal-now clr-unknown">Varies by store</div>
              <p className="deal-was">Regular price <b>{money(price)}</b></p>
              <p className="deal-note">
                Home Depot flags this as an in-store clearance but does not publish a
                price for the store we checked. Clearance is set per store, so it can
                still be marked down at yours. Scan the SKU to see it.
              </p>
            </>
          ) : (
            <>
              {(
                <>
                  {/* "As low as" for clearance: this is the cheapest real price
                      we found, not one every store honors. Shown outright — a
                      price we already have is not worth hiding behind a click. */}
                  {/* Same ink-density tiering as the card, at page scale, so
                      the two surfaces read as one system. */}
                  {pct !== null && pct > 0 && (
                    <div
                      className={`card-off deal-off tier-${
                        pct >= 80 ? 'grail' : pct >= 60 ? 'deep' : pct >= 40 ? 'mid' : 'light'
                      }`}
                    >
                      <span className="off-n">{Math.round(pct)}</span>
                      <span className="off-u">% off</span>
                      {pct >= 80 && <span className="grail-mark">◆ Grail</span>}
                    </div>
                  )}
                  {realClearance !== null && <span className="as-low">As low as</span>}
                  <div className="deal-now">{money(payNow)}</div>
                  {compareAt !== null && compareAt !== payNow && (
                    <p className="deal-was">
                      was <s>{money(compareAt)}</s>{isHidden ? ' in store' : ''}
                    </p>
                  )}
                  {/* The dollar magnitude only — the percentage is already the
                      hero above, and saying it twice weakens both. */}
                  {saves !== null && (
                    <>
                      <div className="deal-save">Margin up to {money(saves)}</div>
                      <p className="deal-margin-note">
                        Retail minus your cost: the ceiling on a flip, not a forecast.
                        Real resale usually lands below retail, and fees come out of
                        whatever you sell for.
                      </p>
                    </>
                  )}
                  {realClearance !== null && row.clearance_store && (
                    <p className="deal-where">
                      Cheapest at <b>{row.clearance_store}</b>
                      {row.clearance_stores_checked
                        ? ` · ${row.clearance_stores_checked} stores checked`
                        : ''}
                      . Clearance is set per store, so yours may differ. Scan the SKU.
                    </p>
                  )}
                </>
              )}
            </>
          )}

          <dl className="deal-meta">
            <div><dt>Retailer</dt><dd>{retailerName(row.retailer)}</dd></div>
            <div><dt>SKU</dt><dd>{row.sku ?? row.item_id}</dd></div>
            <div><dt>Kind</dt><dd>{isHidden ? 'In-store clearance' : 'Markdown'}</dd></div>
            <div><dt>Checked</dt><dd>{row.checked_at ? ago(row.checked_at) : 'unknown'}</dd></div>
          </dl>

          {row.product_url && (
            <a className="btn" href={row.product_url} target="_blank" rel="noreferrer">
              View on {retailerName(row.retailer)}
            </a>
          )}
        </div>
      </div>

      {/* Units per store — only when we actually counted. */}
      {row.stores && row.stores.length > 0 && (
        <section className="deal-section">
          <h2>Units by store</h2>
          <StoreLedger rows={row.stores} readAt={row.checked_at ?? undefined} />
        </section>
      )}

      <section className="deal-section">
        <h2>What we can and cannot promise</h2>
        <ul className="deal-honest">
          <li>
            This price is the one we last read{row.checked_at ? ` (${ago(row.checked_at)})` : ''},
            not a live feed. It can change or sell out before you arrive.
          </li>
          {isHidden && (
            <li>
              Clearance is set per store. A price here is what that store showed; the
              register is the final word.
            </li>
          )}
          <li>
            {/* "Lowe's" + "&apos;s" printed "Lowe's's". And "store-level" was
                the one false word in this sentence for Lowe's: retailers.ts
                already says on the record that Lowe's returns the same count
                at every store and "we will not print it as one". Home Depot
                and Target rows really are store-level, so they keep it. */}
            Verified against {possessive(retailerName(row.retailer))} own{' '}
            {row.retailer === 'lowes'
              ? 'published markdown data'
              : isHidden
                ? 'store-level clearance data'
                : 'current online price'}, not a
            third-party list.
          </li>
        </ul>
      </section>
    </main>
  );
}
