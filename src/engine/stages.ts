/**
 * Markdown stage detection.
 *
 * Clearance walks a ladder: 20% -> 50% -> 90% -> pulled from the site while
 * stock still sits on the shelf -> $0.01 in the register. The last step is
 * never visible online, so we infer it from the walk.
 *
 * Pure functions over observations. No database, no clock, no randomness —
 * which is what makes the whole engine replayable against recorded history.
 */

export type Stage = 's20' | 's50' | 's90' | 'delisted' | 'penny_candidate' | 'none';

export interface Observation {
  observed_at: Date;
  price: number | null;
  list_price: number | null;
  discount_pct: number | null;
  stock_qty: number | null;
  availability: string | null;
  /** Shelf location at the time of the observation, where published. */
  aisle_bay?: string | null;
}

const DEEP = 75;
const MID = 50;
const SHALLOW = 20;

/** Stage implied by a single observation, ignoring history. */
export function stageOf(obs: Observation): Stage {
  const gone = obs.availability === 'unavailable' || obs.availability === 'out_of_stock';
  if (gone) return 'delisted';

  const d = obs.discount_pct ?? 0;
  if (d >= DEEP) return 's90';
  if (d >= MID) return 's50';
  if (d >= SHALLOW) return 's20';
  return 'none';
}

export interface StageHistory {
  stage: Stage;
  stageEnteredAt: Date;
  prevStage: Stage | null;
  /** Distinct rungs of the ladder this SKU has been observed on. */
  laddersHit: Stage[];
  lastSeenAt: Date;
  lastPrice: number | null;
  lastDiscount: number | null;
  lastStock: number | null;
  /** Went unavailable online while the store still reported stock. */
  stockDivergence: boolean;
}

/**
 * Walks a SKU's observations at one store, oldest first, and returns where it
 * currently sits plus the path it took to get there.
 */
export function walk(observations: Observation[]): StageHistory | null {
  if (observations.length === 0) return null;

  const obs = [...observations].sort(
    (a, b) => a.observed_at.getTime() - b.observed_at.getTime(),
  );

  const laddersHit: Stage[] = [];
  let current: Stage = 'none';
  let enteredAt = obs[0]!.observed_at;
  let prev: Stage | null = null;
  let lastKnownStock: number | null = null;

  for (const o of obs) {
    const s = stageOf(o);
    if (s !== 'none' && s !== 'delisted' && !laddersHit.includes(s)) {
      laddersHit.push(s);
    }
    if (o.stock_qty !== null && o.stock_qty > 0) {
      lastKnownStock = o.stock_qty;
    }
    if (s !== current) {
      prev = current === 'none' && laddersHit.length === 0 ? null : current;
      current = s;
      enteredAt = o.observed_at;
    }
  }

  const last = obs[obs.length - 1]!;

  // The signal that matters: pulled from the site, but the store still has units.
  const stockDivergence =
    current === 'delisted' && lastKnownStock !== null && lastKnownStock > 0;

  // Deep-discounted, then delisted, with stock remaining. That's the candidate.
  if (stockDivergence && laddersHit.includes('s90')) {
    current = 'penny_candidate';
  }

  return {
    stage: current,
    stageEnteredAt: enteredAt,
    prevStage: prev,
    laddersHit,
    lastSeenAt: last.observed_at,
    lastPrice: last.price,
    lastDiscount: last.discount_pct,
    lastStock: last.stock_qty ?? lastKnownStock,
    stockDivergence,
  };
}
