/**
 * Penny scoring, 0-100.
 *
 * This is a guess until real finds grade it. Every alert records the score
 * that sent you there, so `finds` becomes the answer key. When the weights
 * change, bump SCORE_VERSION and replay over full history — never tune by
 * feel, tune against measured hit rate.
 */

import type { StageHistory } from './stages.js';

export const SCORE_VERSION = 'v1';

export interface ScoreBreakdown {
  ladderProgress: number; // 0-45  did it walk the whole markdown ladder
  divergence: number; // 0-30  gone online, stock still on the shelf
  dwell: number; // 0-15  time sitting in its final stage
  scarcity: number; // 0-10  few units left
  total: number; // 0-100
}

const DAY_MS = 86_400_000;

/**
 * @param now injected rather than read from the clock, so scoring a recorded
 *        history yields the same number every time it's replayed.
 */
export function score(history: StageHistory, now: Date): ScoreBreakdown {
  // --- Ladder progress. Walking 20 -> 50 -> 90 is the core evidence. --------
  let ladderProgress = 0;
  if (history.laddersHit.includes('s20')) ladderProgress += 10;
  if (history.laddersHit.includes('s50')) ladderProgress += 15;
  if (history.laddersHit.includes('s90')) ladderProgress += 20;

  // --- Divergence. Pulled from the site while units remain in store. -------
  let divergence = 0;
  if (history.stockDivergence) {
    divergence = 30;
  } else if (history.stage === 'delisted') {
    // Delisted with no stock signal either way. Weaker, not worthless.
    divergence = 12;
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
    dwell = Math.round(Math.max(0, 15 - distance * 0.7));
  } else if (daysInStage > 35) {
    dwell = 3;
  }

  // --- Scarcity. Low remaining stock is what makes it a penny, and also
  //     what makes it a race.
  let scarcity = 0;
  const stock = history.lastStock;
  if (stock !== null) {
    if (stock <= 2) scarcity = 10;
    else if (stock <= 5) scarcity = 7;
    else if (stock <= 12) scarcity = 4;
    else scarcity = 1;
  }

  const total = Math.min(100, ladderProgress + divergence + dwell + scarcity);
  return { ladderProgress, divergence, dwell, scarcity, total };
}

/** Rough label for the UI. Deliberately hedged — these are predictions. */
export function confidenceLabel(total: number): string {
  if (total >= 80) return 'Strong candidate';
  if (total >= 60) return 'Worth a look';
  if (total >= 40) return 'Long shot';
  return 'Weak';
}
