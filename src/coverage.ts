/**
 * Where the product actually works.
 *
 * Coverage is NOT "do we have a store row near you" — it is "have we been
 * collecting price history near you, for long enough that a score means
 * something".
 *
 * That distinction is the whole go-to-market constraint. Penny detection reads
 * a markdown LADDER: 20% -> 50% -> 90% -> delisted. A ZIP scanned for the first
 * time this morning has one observation per SKU and therefore no ladder, no
 * dwell, and no divergence — three of the four score components sit at zero.
 * The scores would be not just weak but misleading, and misleading scores are
 * worse than no coverage because they burn the trust the whole verification
 * model depends on.
 *
 * So a new metro needs the scan running for weeks BEFORE anyone is sold a plan
 * there. Expansion is a lead time, not a config change.
 */

import type { Db } from './db/client.js';

/** ZIPs the daily sweep actually queries. */
export function scanZips(): string[] {
  return (process.env.SCAN_ZIPS ?? '')
    .split(',')
    .map((z) => z.trim())
    .filter((z) => /^\d{5}$/.test(z));
}

/**
 * ZIP prefixes counted as inside a covered metro.
 *
 * A 3-digit prefix is a rough metro proxy — 782xx is San Antonio. It is not
 * precise, and it deliberately errs toward saying "covered" for someone on the
 * edge of the metro rather than turning away a real customer twenty minutes
 * from a store we watch.
 *
 * Deriving this from ZIP coordinates would need a geocoding dependency for a
 * question that a config line answers well enough at one metro.
 */
export function coveragePrefixes(): string[] {
  const explicit = (process.env.COVERAGE_ZIP_PREFIXES ?? '')
    .split(',').map((p) => p.trim()).filter((p) => /^\d{3}$/.test(p));
  if (explicit.length > 0) return explicit;
  // Fall back to the prefixes of whatever we scan.
  return [...new Set(scanZips().map((z) => z.slice(0, 3)))];
}

export interface CoverageAnswer {
  covered: boolean;
  /** Days of history at the nearest covered ZIP. Under ~14 the scores are weak. */
  history_days: number;
  /** True once there is enough history for a score to mean anything. */
  scores_meaningful: boolean;
  metro: string | null;
  message: string;
}

const MEANINGFUL_DAYS = 14;

export async function coverageFor(db: Db, zip: string | null): Promise<CoverageAnswer> {
  const prefixes = coveragePrefixes();
  const metroName = process.env.COVERAGE_METRO_NAME ?? 'San Antonio';

  // How long the sweep has actually been collecting. This is the number that
  // decides whether scores are worth showing, so it is measured, not assumed.
  const { rows } = await db.query<{ days: number | null }>(
    `SELECT EXTRACT(DAY FROM (now() - MIN(observed_at)))::int AS days
       FROM price_observations`,
  );
  const historyDays = Number(rows[0]?.days ?? 0);
  const meaningful = historyDays >= MEANINGFUL_DAYS;

  if (!zip || !/^\d{5}$/.test(zip)) {
    return {
      covered: false, history_days: historyDays, scores_meaningful: meaningful,
      metro: null,
      message: 'Add your ZIP code and we will tell you whether we cover your area yet.',
    };
  }

  const covered = prefixes.includes(zip.slice(0, 3));

  if (!covered) {
    return {
      covered: false, history_days: historyDays, scores_meaningful: meaningful,
      metro: null,
      message:
        `We only watch ${metroName} stores right now, so there is nothing near ${zip} yet. ` +
        'Clearance prices have to be recorded for weeks before we can tell which items ' +
        'are heading for a penny, so a new city takes a while to switch on rather than ' +
        'happening the day someone asks.',
    };
  }

  if (!meaningful) {
    return {
      covered: true, history_days: historyDays, scores_meaningful: false,
      metro: metroName,
      message:
        `We are watching ${metroName}, but only ${historyDays} ${historyDays === 1 ? 'day' : 'days'} ` +
        'of price history so far. Penny predictions read a markdown over weeks, so the scores ' +
        'stay unreliable until there is more behind them. Deals and prices are real now; the ' +
        'predictions get sharper.',
    };
  }

  return {
    covered: true, history_days: historyDays, scores_meaningful: true,
    metro: metroName,
    message: `Watching ${metroName} stores with ${historyDays} days of price history.`,
  };
}

/**
 * Home Depot writes store numbers both ways — "0582" on some surfaces, "582"
 * on others. Without normalising, the same building becomes two rows and its
 * stock is split across them.
 */
export function normalizeStoreNumber(raw: string): string {
  const trimmed = String(raw).trim();
  const stripped = trimmed.replace(/^0+/, '');
  return stripped.length > 0 ? stripped : trimmed;
}
