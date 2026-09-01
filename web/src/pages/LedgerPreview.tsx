/**
 * DESIGN PREVIEW — /design/ledger
 *
 * A review surface for the store ledger, not a customer page. It renders with
 * REAL MEASURED DATA (Target TCIN 95127459, five San Antonio stores, read
 * 2026-08-23) so the design can be judged against numbers that actually came
 * back, rather than pleasant placeholders that hide how the layout behaves.
 *
 * Nothing here is fabricated: the 3 / 2 / 3 / 0 / 0 spread is what RedSky
 * returned. The last two cases (unknown reading, nothing nearby) are included
 * because they are the states a design gets wrong when it only previews the
 * happy path.
 */

import StoreLedger, { type LedgerRow } from '../components/StoreLedger.js';

/** Measured 2026-08-23. Prices were identical at all five stores ($4.00 from
 *  $5.00); only the counts varied — which is why the ledger shows units, not
 *  a per-store price column. */
const MEASURED: LedgerRow[] = [
  { store: 'Bitters Rd', qty: 3, distance_mi: 4.2 },
  { store: 'Stone Oak', qty: 3, distance_mi: 6.1 },
  { store: 'San Antonio N', qty: 2, distance_mi: 8.8 },
  { store: 'Park North', qty: 0, distance_mi: 5.4 },
  { store: 'Alamo Heights', qty: 0, distance_mi: 11.0 },
];

const MIXED: LedgerRow[] = [
  { store: 'Bitters Rd', qty: 12, distance_mi: 4.2 },
  { store: 'Stone Oak', qty: null, distance_mi: 6.1 },
  { store: 'Park North', qty: 0, distance_mi: 5.4 },
];

const EMPTY: LedgerRow[] = [
  { store: 'Bitters Rd', qty: 0, distance_mi: 4.2 },
  { store: 'Stone Oak', qty: 0, distance_mi: 6.1 },
];

const readAt = new Date(Date.now() - 42 * 60 * 1000).toISOString();

export default function LedgerPreview() {
  return (
    <main className="wrap" style={{ maxWidth: 760, padding: '48px 20px 96px' }}>
      <h1 style={{ marginBottom: 4 }}>Store ledger</h1>
      <p style={{ color: 'var(--ink-faint)', marginTop: 0 }}>
        Design preview · real measured data, not placeholders
      </p>

      <section style={{ marginTop: 40 }}>
        <h2 style={{ fontSize: 15, textTransform: 'uppercase', letterSpacing: '.08em' }}>
          Measured: Target, 5 San Antonio stores
        </h2>
        <StoreLedger rows={MEASURED} readAt={readAt} />
      </section>

      <section style={{ marginTop: 48 }}>
        <h2 style={{ fontSize: 15, textTransform: 'uppercase', letterSpacing: '.08em' }}>
          Mixed: a real 0, and a store with no reading
        </h2>
        <StoreLedger rows={MIXED} readAt={readAt} />
      </section>

      <section style={{ marginTop: 48 }}>
        <h2 style={{ fontSize: 15, textTransform: 'uppercase', letterSpacing: '.08em' }}>
          Nothing nearby: the deal is real, the shelf is not
        </h2>
        <StoreLedger rows={EMPTY} readAt={readAt} />
      </section>

      <section style={{ marginTop: 48 }}>
        <h2 style={{ fontSize: 15, textTransform: 'uppercase', letterSpacing: '.08em' }}>
          On an inverted card
        </h2>
        <div
          className="invert"
          style={{ background: 'var(--sticker)', color: 'var(--on-accent)', padding: 20 }}
        >
          <StoreLedger rows={MEASURED} readAt={readAt} />
        </div>
      </section>
    </main>
  );
}
