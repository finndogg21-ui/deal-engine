/**
 * THE STORE LEDGER — exact units per store, printed as a receipt.
 *
 * Why this exists: a deal's real question is not "does it exist" but "how many
 * can I take, and in what order do I drive." Exact per-store counts answer
 * both. Sorted by units descending, that ordering IS the drive order.
 *
 * RETAILER-AGNOSTIC ON PURPOSE. The first draft of this was scoped to Target,
 * on the belief that Home Depot could not produce per-store counts. That was
 * backwards: HD's own query already asks for `locations { storeName inventory
 * { quantity } }` — plural, ZIP-scoped, in ONE call — and the parser throws
 * every non-anchor store away (src/vendors/hd-direct.ts:123). Target needs one
 * call PER store. So the ledger is cheaper on HD, and both feed this component.
 *
 * HONESTY RULES BAKED IN, not left to the caller:
 *   - PRINT THE ZEROS. A store with 0 is information — it is what makes 3 mean
 *     something. Zero rows print struck through, never hidden.
 *   - Never a raw store NUMBER. Store names only (product rule). The number is
 *     an internal key and reads as false precision.
 *   - Counts are STAMPED with when they were read. A count with no time on it
 *     reads as live, which we are not.
 *   - `qty: null` means we have no reading for that store — it prints "—" and
 *     is excluded from the total. Unknown is not zero.
 */

import { useMemo } from 'react';

export interface LedgerRow {
  /** Store display name. Never a raw store number. */
  store: string;
  /** Units on that store's floor. 0 is real and printed; null = no reading. */
  qty: number | null;
  distance_mi?: number | null;
}

interface Props {
  rows: LedgerRow[];
  /** ISO timestamp of the reading, so the count is never shown as live. */
  readAt?: string | null;
  /** Cap the printed lines; the rest roll into an "other stores" line. */
  max?: number;
}

const ago = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'just now';
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export default function StoreLedger({ rows, readAt, max = 6 }: Props) {
  // Sort by units descending — this ordering is the drive order. Unknown
  // readings sink below real zeros: a known 0 is more useful than no reading.
  const sorted = useMemo(
    () => [...rows].sort((a, b) => (b.qty ?? -1) - (a.qty ?? -1)),
    [rows],
  );

  if (sorted.length === 0) return null;

  const shown = sorted.slice(0, max);
  const rest = sorted.slice(max);
  // Unknown rows are excluded — summing them as 0 would understate the total
  // and dressing them as stock would overstate it.
  const known = sorted.filter((r) => typeof r.qty === 'number');
  const total = known.reduce((n, r) => n + (r.qty as number), 0);
  const anyStock = known.some((r) => (r.qty as number) > 0);

  return (
    <div className="ledger" role="table" aria-label="Units by store">
      <div className="ledger-head" role="row">
        <span role="columnheader">Store</span>
        <span role="columnheader">Units</span>
      </div>

      {shown.map((r) => {
        const unknown = typeof r.qty !== 'number';
        const out = !unknown && r.qty === 0;
        return (
          <div
            key={r.store}
            className={`ledger-row${out ? ' out' : ''}${unknown ? ' unknown' : ''}`}
            role="row"
          >
            <span className="ledger-store" role="cell">
              {r.store}
              {typeof r.distance_mi === 'number' && (
                /* The leading space is deliberate: without it a screen reader
                   reads "Bitters Rd4.2mi" as one token. */
                <i className="ledger-mi"> {r.distance_mi.toFixed(1)} mi</i>
              )}
            </span>
            <span className="ledger-dots" aria-hidden="true" />
            <span className="ledger-qty" role="cell">
              {unknown ? '—' : r.qty}
            </span>
          </div>
        );
      })}

      {rest.length > 0 && (
        <div className="ledger-row more" role="row">
          <span className="ledger-store" role="cell">
            +{rest.length} more store{rest.length === 1 ? '' : 's'}
          </span>
          <span className="ledger-dots" aria-hidden="true" />
          <span className="ledger-qty" role="cell">
            {rest.filter((r) => typeof r.qty === 'number').reduce((n, r) => n + (r.qty as number), 0)}
          </span>
        </div>
      )}

      <div className="ledger-total" role="row">
        <span role="cell">{anyStock ? 'Total nearby' : 'None nearby'}</span>
        <span className="ledger-dots" aria-hidden="true" />
        <span className="ledger-qty" role="cell">
          {total} unit{total === 1 ? '' : 's'}
        </span>
      </div>

      {/* A count with no time on it reads as live. Always stamp it. */}
      {readAt && <p className="ledger-stamp">Counted {ago(readAt)} · not live</p>}
    </div>
  );
}
