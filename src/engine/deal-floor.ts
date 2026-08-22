/**
 * Price-tiered discount floor — "a $37.50 'deal' is not a deal."
 *
 * The flat 25% floor let junk through at low prices: 25% off $50 leaves $37.50,
 * which no reseller drives for. The floor now scales with price, per the
 * founder's rule (2026-08-22):
 *
 *   under $50    →  needs ≥ 40% off
 *   $50–$99.99   →  needs ≥ 30% off   (interpolated tier)
 *   $100 and up  →  needs ≥ 25% off
 *
 * A null price gets the strictest tier — no price means we can't justify the
 * deal, so it must earn its place.
 *
 * One definition, used by every feed query (candidates + nearby). The SQL and
 * the TS predicate MUST stay in sync; both live here so a change is one edit.
 */

/** SQL predicate. Interpolate with the price/discount column expressions. */
export function tieredFloorSql(priceCol: string, discCol: string): string {
  return `(CASE
    WHEN COALESCE(${priceCol}, 0) >= 100 THEN COALESCE(${discCol}, 0) >= 25
    WHEN COALESCE(${priceCol}, 0) >= 50  THEN COALESCE(${discCol}, 0) >= 30
    ELSE COALESCE(${discCol}, 0) >= 40
  END)`;
}

/** Same rule for in-process checks. */
export function meetsTieredFloor(price: number | null, discountPct: number | null): boolean {
  const d = discountPct ?? 0;
  const p = price ?? 0;
  if (p >= 100) return d >= 25;
  if (p >= 50) return d >= 30;
  return d >= 40;
}
