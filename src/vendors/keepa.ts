/**
 * ===========================================================
 *  KEEPA AMAZON FEED GOES HERE
 * ===========================================================
 *
 * Powers the consumer tier. Amazon has no cold start because Keepa's price
 * history is retroactive, so this can be wired the week the consumer tier
 * ships rather than months early.
 *
 * Numbers below came from Keepa's community forum, NOT their docs, because
 * keepa.com/api-docs blocks automated fetching. VERIFY ON SIGNUP:
 *   - Browsing Deals: reportedly 5 tokens, returns up to 150 deals
 *   - Entry tier: EUR49/mo, 20 tokens/min, tokens expire after 60 minutes
 *   - Product lookup: 1 token per ASIN, offers parameter +6 per page of 10
 *
 * The whole "EUR49 is enough" conclusion rests on those figures.
 */

import { notWired, isWired, type DealEvent } from './contracts.js';

const ENV = 'KEEPA_KEY';

export const keepaReady = () => isWired(ENV);

export interface KeepaDealQuery {
  categoryIds?: number[];
  minDiscountPct?: number;
  /** Warehouse (used/returned) as well as new-condition price drops. */
  includeWarehouse?: boolean;
  page?: number;
}

export async function browseDeals(_q: KeepaDealQuery): Promise<DealEvent[]> {
  if (!keepaReady()) notWired('keepa', ENV);

  // ---- KEEPA BROWSING DEALS GOES HERE ----
  notWired('keepa', ENV);
}

export async function priceHistory(_asin: string): Promise<DealEvent[]> {
  if (!keepaReady()) notWired('keepa', ENV);
  notWired('keepa', ENV);
}
