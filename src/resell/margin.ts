/**
 * Resale margin — the v1 ranking dimension for spotter finds.
 *
 * A clearance find is only worth a drive if it flips for a profit. This turns
 * (in-store clearance cost, estimated resale, marketplace) into a net margin,
 * so the spotter feed can rank by "how much would this actually make" instead
 * of by raw discount %.
 *
 * The resale number is the SPOTTER'S estimate, not a live comp — Keepa is
 * stubbed and we have no eBay-sold integration yet (see vendors/keepa.ts). So
 * every margin here is explicitly an ESTIMATE and the UI must label it as one.
 * The fee side is real: it reuses the marketplace fee prefill in ./fees.ts.
 *
 * Like the rest of this schema, a margin is DERIVED and never stored — a saved
 * profit number drifts from the inputs it came from. Compute it at read time.
 */

import { FEE_TABLE, type Marketplace } from './fees.js';

export interface MarginInput {
  /** What you pay at the register — the in-store clearance price. */
  cost: number;
  /** Estimated resale price (spotter's estimate). */
  resale: number;
  /** Where it gets flipped. Default eBay — the reseller default. */
  marketplace?: Marketplace;
  /** Optional seller-paid shipping, if the spotter accounts for it. */
  shipping?: number;
}

export interface MarginResult {
  marketplace: Marketplace;
  /** Marketplace fee on the resale, from FEE_TABLE (rate + flat, min floor). */
  fee: number;
  /** resale − fee − shipping: what actually lands in your pocket. */
  netProceeds: number;
  /** netProceeds − cost: the profit on the flip. Can be negative. */
  margin: number;
  /** margin / cost — return on the money you tie up. null when cost is 0. */
  roi: number | null;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

const isMarketplace = (v: unknown): v is Marketplace =>
  typeof v === 'string' && v in FEE_TABLE;

/** Normalise an untrusted marketplace value to a known one (default eBay). */
export function toMarketplace(v: unknown): Marketplace {
  return isMarketplace(v) ? v : 'ebay';
}

export function estimateMargin(input: MarginInput): MarginResult {
  const marketplace = input.marketplace ?? 'ebay';
  const rule = FEE_TABLE[marketplace];
  const resale = Math.max(0, input.resale);
  const cost = Math.max(0, input.cost);
  const shipping = Math.max(0, input.shipping ?? 0);

  const fee = Math.max(rule.min, resale * rule.rate + rule.flat);
  const netProceeds = round2(resale - fee - shipping);
  const margin = round2(netProceeds - cost);
  const roi = cost > 0 ? round2(margin / cost) : null;

  return { marketplace, fee: round2(fee), netProceeds, margin, roi };
}
