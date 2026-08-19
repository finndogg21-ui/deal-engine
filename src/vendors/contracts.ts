/**
 * Shared vendor contracts.
 *
 * Every source normalises onto these shapes. The engine and API never see a
 * vendor-specific field, which is what makes vendors swappable.
 */

export interface DealEvent {
  retailer: string;
  sku: string;
  title: string;
  /** Both optional: not every source returns them, and `products` allows null. */
  upc?: string | null;
  /** Retailer's URL-facing id. Lookup vendors want this, not the store SKU. */
  itemId?: string | null;
  brand?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  productUrl?: string | null;
  storeNumber?: string | null;
  /** Miles from the queried ZIP. The only positional data HD returns. */
  distanceMi?: number | null;
  storeName?: string | null;
  zip?: string | null;
  lat?: number | null;
  lng?: number | null;
  price: number | null;
  listPrice: number | null;
  discountPct: number | null;
  stockQty: number | null;
  availability: 'in_stock' | 'out_of_stock' | 'unavailable' | 'unknown';
  aisleBay?: string | null;
  observedAt: Date;
  /** Untouched vendor response, so a parser fix can be replayed over history. */
  raw: unknown;
}

export interface StoreStock {
  storeNumber: string;
  storeName: string;
  quantity: number | null;
  aisleBay: string | null;
  price: number | null;
  discontinued: boolean;
  limitedQuantity: boolean;
  distanceMi?: number | null;
}

export interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Loud, specific failure. A stub that returns [] is indistinguishable from a
 *  working scan that found nothing, which is the expensive failure here. */
export function notWired(vendor: string, envVar: string): never {
  throw new Error(
    `${vendor.toUpperCase()} ADAPTER NOT WIRED. ` +
    `Set ${envVar} in .env and implement src/vendors/${vendor}.ts. ` +
    `See src/vendors/README.md.`,
  );
}

export const isWired = (envVar: string) => Boolean(process.env[envVar]?.trim());
