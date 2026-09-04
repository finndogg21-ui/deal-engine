/**
 * THE REGISTER RECEIPT — Summit's signature artifact.
 *
 * A real register-tape slip: the shelf price struck through to the register-only
 * price no free tool can show, a spotter-verified chip, and the Stamp-Red
 * "MARKDOWN — NOT ON SHELF" stamp. It is the moat, the proof, and the one thing
 * a template never ships — so it, not the dark/orange list, is what stops Summit
 * reading as the free competitor. Reused as: landing proof, unlock reveal, detail
 * body. Pure presentation — every value is passed in, and must be a REAL,
 * spotter-verified markdown (a fabricated receipt would poison the whole trust
 * strategy — see company/haste-blueprint.md risks).
 */

import '../receipt.css';

export interface ReceiptProps {
  store: string;        // "Home Depot #6574"
  location: string;     // "San Antonio, TX 78232"
  item: string;         // product name
  sku: string;          // "1001-234-567"
  shelf: string;        // "$89.00"  (struck through)
  register: string;     // "$12.03"  (the register-only price)
  offPct: number;       // 86
  when: string;         // "verified in-store 2 days ago"
  /** false = the locked/teaser state: the register line is withheld. */
  revealed?: boolean;
}

export default function Receipt({
  store, location, item, sku, shelf, register, offPct, when, revealed = true,
}: ReceiptProps) {
  return (
    <div className={`receipt${revealed ? ' is-revealed' : ''}`} role="img"
      aria-label={`Register receipt: ${item} at ${store}, shelf ${shelf}, register ${register}, ${offPct}% off, ${when}`}>
      <div className="receipt-perf" aria-hidden="true" />

      <div className="receipt-head">
        <span className="receipt-store">{store}</span>
        <span className="receipt-loc">{location}</span>
      </div>

      <div className="receipt-rule" aria-hidden="true" />

      <div className="receipt-item">{item}</div>
      <div className="receipt-sku">SKU {sku}</div>

      <dl className="receipt-lines">
        <div className="receipt-line">
          <dt>Shelf tag</dt>
          <dd><s>{shelf}</s></dd>
        </div>
        <div className="receipt-line receipt-line--register">
          <dt>At the register</dt>
          <dd>{revealed ? register : '•••••'}</dd>
        </div>
      </dl>

      <div className="receipt-rule receipt-rule--heavy" aria-hidden="true" />

      <div className="receipt-foot">
        <span className="receipt-off">{offPct}% OFF</span>
        <span className="receipt-verified">✓ spotter-verified</span>
      </div>
      <div className="receipt-when">{when}</div>

      {/* The stamp lands on the revealed receipt — the proof that this price is
          real and not on the shelf tag. */}
      <span className="receipt-stamp" aria-hidden="true">MARKDOWN<br />NOT ON SHELF</span>
    </div>
  );
}
