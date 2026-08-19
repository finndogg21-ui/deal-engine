/**
 * Blueprint G — marketplace fee prefill.
 *
 * These rates come from the build blueprint, where they were verified on
 * 2026-08-15. They are NOT re-checked at runtime and they WILL go stale:
 * marketplaces change take rates, category exceptions exist, promoted-listing
 * fees stack on top, and store subscriptions change eBay's number outright.
 *
 * So this is a prefill and nothing more. Every computed fee lands in an
 * editable field, the stored `fees` column is whatever the user confirmed,
 * and no profit figure is ever derived from this table — only from what was
 * actually saved on the order.
 */

export type Marketplace = 'ebay' | 'facebook' | 'mercari' | 'other';

export interface FeeRule {
  label: string;
  /** Percentage of sale price, as a fraction. */
  rate: number;
  /** Flat amount added per order. */
  flat: number;
  /** Floor on the total fee, where the marketplace enforces one. */
  min: number;
  note: string;
}

export const FEE_TABLE: Record<Marketplace, FeeRule> = {
  ebay: {
    label: 'eBay',
    rate: 0.136,
    flat: 0.4,
    min: 0,
    note: 'Most categories. A store subscription or a promoted listing changes this.',
  },
  facebook: {
    label: 'Facebook Marketplace',
    rate: 0.1,
    flat: 0,
    min: 0.8,
    note: 'Shipped orders only. Local pickup is free — switch the toggle for local.',
  },
  mercari: {
    label: 'Mercari',
    rate: 0.1,
    flat: 0,
    min: 0,
    note: 'Flat selling fee.',
  },
  other: {
    label: 'Other',
    rate: 0,
    flat: 0,
    min: 0,
    note: 'Enter the fee yourself.',
  },
};

export const FEES_VERIFIED_ON = '2026-08-15';

export function isMarketplace(v: unknown): v is Marketplace {
  return typeof v === 'string' && v in FEE_TABLE;
}

/**
 * Suggested fee for a sale. `localPickup` zeroes Facebook, which is the one
 * case where the same marketplace has two completely different answers.
 */
export function estimateFee(
  marketplace: Marketplace,
  salePrice: number,
  localPickup = false,
): number {
  if (marketplace === 'facebook' && localPickup) return 0;
  const rule = FEE_TABLE[marketplace];
  const raw = salePrice * rule.rate + rule.flat;
  const fee = Math.max(raw, salePrice > 0 ? rule.min : 0);
  return Math.round(fee * 100) / 100;
}

/** net = sale − fees − shipping − cost basis. The only profit formula here. */
export function net(
  salePrice: number,
  fees: number,
  shippingCost: number,
  costBasis: number,
): number {
  return Math.round((salePrice - fees - shippingCost - costBasis) * 100) / 100;
}
