/**
 * Penny scoring, 0-100.
 *
 * This is a guess until real finds grade it. Every alert records the score
 * that sent you there, so `finds` becomes the answer key. When the weights
 * change, bump SCORE_VERSION and replay over full history — never tune by
 * feel, tune against measured hit rate.
 */

import type { StageHistory } from './stages.js';

export const SCORE_VERSION = 'v2';

export interface ScoreBreakdown {
  ladderProgress: number; // 0-35  did it walk the whole markdown ladder
  divergence: number; // 0-25  gone online, stock still on the shelf
  priceCode: number; // 0-20  the cent ending, which encodes markdown stage
  dwell: number; // 0-12  time sitting in its final stage
  scarcity: number; // 0-8   few units left
  total: number; // 0-100
}

/**
 * Home Depot encodes the markdown stage in the CENTS of the price.
 * Documented consistently across retail-hack sources and confirmed against a
 * real scan on 2026-08-16:
 *
 *   .06  second markdown, 30-50% off, roughly six weeks to the next drop
 *   .03  FINAL markdown, 50-70% off, roughly three weeks before it goes
 *   .01  penny item
 *
 * Why this matters more than its 20 points suggest: every other component
 * needs HISTORY. Ladder, divergence and dwell are all differences measured
 * over weeks, which is why a newly-scanned ZIP scores nothing for a month.
 * The price ending is readable from a SINGLE observation, so it is the only
 * signal that works on day one in a new metro.
 *
 * It also catches what the retailer's own flag misses. In that scan, a $260.03
 * item — final-markdown ending — came back with isClearanceItem FALSE.
 */
export function priceCodePoints(price: number | null): number {
  if (price === null || price <= 0) return 0;
  // Work in integer cents; 7.03 * 100 is 703.0000000000001 in floating point.
  const cents = Math.round(price * 100) % 100;
  if (cents === 1) return 20; // already a penny
  if (cents === 3) return 18; // final markdown — the one worth driving for
  if (cents === 2) return 15;
  if (cents === 6) return 8; // second markdown, still weeks out
  return 0;
}

const DAY_MS = 86_400_000;

/**
 * @param now injected rather than read from the clock, so scoring a recorded
 *        history yields the same number every time it's replayed.
 */
export function score(history: StageHistory, now: Date): ScoreBreakdown {
  // --- Ladder progress. Walking 20 -> 50 -> 90 is the core evidence. --------
  let ladderProgress = 0;
  if (history.laddersHit.includes('s20')) ladderProgress += 8;
  if (history.laddersHit.includes('s50')) ladderProgress += 12;
  if (history.laddersHit.includes('s90')) ladderProgress += 15;

  // --- Divergence. Pulled from the site while units remain in store. -------
  let divergence = 0;
  if (history.stockDivergence) {
    divergence = 25;
  } else if (history.stage === 'delisted') {
    // Delisted with no stock signal either way. Weaker, not worthless.
    divergence = 10;
  }

  // --- Dwell. Fresh transitions are noise; very old ones are probably gone.
  const daysInStage = Math.max(
    0,
    (now.getTime() - history.stageEnteredAt.getTime()) / DAY_MS,
  );
  let dwell = 0;
  if (daysInStage >= 3 && daysInStage <= 35) {
    // Peaks around two weeks after the item stops appearing.
    const peak = 14;
    const distance = Math.abs(daysInStage - peak);
    dwell = Math.round(Math.max(0, 12 - distance * 0.6));
  } else if (daysInStage > 35) {
    dwell = 3;
  }

  // --- Scarcity. Low remaining stock is what makes it a penny, and also
  //     what makes it a race.
  let scarcity = 0;
  const stock = history.lastStock;
  if (stock !== null) {
    if (stock <= 2) scarcity = 8;
    else if (stock <= 5) scarcity = 6;
    else if (stock <= 12) scarcity = 3;
    else scarcity = 1;
  }

  // The only component that needs no history at all.
  const priceCode = priceCodePoints(history.lastPrice);

  const total = Math.min(100, ladderProgress + divergence + priceCode + dwell + scarcity);
  return { ladderProgress, divergence, priceCode, dwell, scarcity, total };
}

/** Rough label for the UI. Deliberately hedged — these are predictions. */
export function confidenceLabel(total: number): string {
  if (total >= 80) return 'Strong candidate';
  if (total >= 60) return 'Worth a look';
  if (total >= 40) return 'Long shot';
  return 'Weak';
}
