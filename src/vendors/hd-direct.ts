/**
 * Home Depot, asked directly.
 *
 * HD's own storefront is drawn by an internal GraphQL gateway. The same
 * endpoint answers us: given an item id and a store id it returns that
 * STORE's price and that STORE's shelf quantity — the two numbers every paid
 * vendor in this project has either fabricated (Apify) or fumbled (Unwrangle
 * returned the wrong city), for $0.
 *
 * Verified live 2026-08-22 from a browser session:
 *   item 312232605 @ store 582 -> value 208.00, original 289.00, quantity 2,
 *   isInStock true — matching Home Depot's own product page exactly.
 *
 * HONEST CAVEATS (read before trusting this in prod):
 *   - Undocumented internal endpoint. HD can change or gate it at any time;
 *     every caller must treat failure as "unknown", never as "no stock".
 *   - Verified from a BROWSER context. Server-side calls may be challenged by
 *     bot protection; `hdReady()` and the unreachable path exist so the
 *     pipeline degrades to "unverified" instead of inventing numbers.
 *   - HD's terms prohibit automated collection. Same posture as the paid
 *     vendors we already use; keep volume low and cache aggressively.
 */

const GATEWAY = 'https://www.homedepot.com/federation-gateway/graphql';

export interface HdStoreFact {
  itemId: string;
  title: string | null;
  sku: string | null;
  modelNumber: string | null;
  price: number | null;
  listPrice: number | null;
  discountPct: number | null;
  /** The store the quantity belongs to. */
  storeId: string | null;
  storeName: string | null;
  /** Units on that store's floor. null = HD did not say (never "zero"). */
  quantity: number | null;
  inStock: boolean | null;
  discontinued: boolean | null;
  /**
   * HD's `alternatePriceDisplay` — the "See In-Store Clearance Price" tell.
   * TRUE ALONE IS NOT A DEAL: an item can carry the flag with percentageOff 0.
   */
  altPriceDisplay: boolean | null;
  /**
   * `pricing.clearance` — THE ACTUAL REGISTER PRICE, per store. This is the
   * number the card prints. Without it the UI can only say the word
   * "clearance", which the founder correctly called useless.
   */
  clearancePrice: number | null;
  clearancePct: number | null;
}

/**
 * The exact query shape accepted by the gateway (field names verified).
 *
 * EXPORTED because the server cannot run it: HD's Akamai answers our server
 * with HTTP 206 "Generic errors" and answers a real browser normally, so the
 * scheduled browser agent executes this same string. One definition, so the
 * browser path and the server path can never drift apart.
 */
export const PRODUCT_QUERY = `query productClientOnlyProduct($itemId: String!, $storeId: String, $zipCode: String) {
  product(itemId: $itemId, dataSource: "catalog") {
    itemId
    identifiers { productLabel storeSkuNumber modelNumber }
    pricing(storeId: $storeId) {
      value
      original
      alternatePriceDisplay
      clearance { value percentageOff dollarOff }
    }
    availabilityType { discontinued status type }
    fulfillment(storeId: $storeId, zipCode: $zipCode) {
      fulfillmentOptions {
        type
        services {
          type
          locations { locationId storeName inventory { quantity isInStock isLimitedQuantity } isAnchor type }
        }
      }
    }
  }
}`;

const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Ask HD for one item at one store.
 *
 * Returns null when HD could not be reached or refused — the caller MUST treat
 * that as "unknown" and leave the deal unpublished, never as a fact.
 */
export async function hdStoreFact(
  itemId: string,
  storeId: string,
  zipCode: string,
): Promise<HdStoreFact | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20_000);
  try {
    const res = await fetch(`${GATEWAY}?opname=productClientOnlyProduct`, {
      method: 'POST',
      signal: ctl.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-experience-name': 'general-merchandise',
        'x-current-url': `/p/${itemId}`,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        operationName: 'productClientOnlyProduct',
        variables: { itemId: String(itemId), storeId: String(storeId), zipCode },
        query: PRODUCT_QUERY,
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: { product?: Record<string, unknown> | null };
      errors?: unknown[];
    };
    const p = json.data?.product;
    if (!p || json.errors) return null;

    const ids = (p.identifiers ?? {}) as Record<string, unknown>;
    const pricing = (p.pricing ?? {}) as Record<string, unknown>;
    const avail = (p.availabilityType ?? {}) as Record<string, unknown>;

    // Shelf quantity: the BOPIS/store location, never the delivery network
    // number. Prior burn: the network figure read 74 while the shelf held 8.
    let quantity: number | null = null;
    let inStock: boolean | null = null;
    let storeName: string | null = null;
    const options = ((p.fulfillment ?? {}) as Record<string, unknown>).fulfillmentOptions;
    if (Array.isArray(options)) {
      for (const opt of options as Array<Record<string, unknown>>) {
        if (opt.type !== 'pickup') continue;
        for (const svc of (opt.services ?? []) as Array<Record<string, unknown>>) {
          for (const loc of (svc.locations ?? []) as Array<Record<string, unknown>>) {
            if (loc.type !== 'store') continue;
            if (String(loc.locationId).replace(/^0+/, '') !== String(storeId).replace(/^0+/, '')) continue;
            const inv = (loc.inventory ?? {}) as Record<string, unknown>;
            quantity = num(inv.quantity);
            inStock = typeof inv.isInStock === 'boolean' ? inv.isInStock : null;
            storeName = typeof loc.storeName === 'string' ? loc.storeName : null;
          }
        }
      }
    }

    // The hidden-clearance pair. `clearance.value` is the register price; the
    // flag on its own proves nothing, so both are carried and the judge decides.
    const clearance = (pricing.clearance ?? {}) as Record<string, unknown>;
    const clearancePrice = num(clearance.value);
    const clearancePct = num(clearance.percentageOff);
    const altPriceDisplay =
      typeof pricing.alternatePriceDisplay === 'boolean' ? pricing.alternatePriceDisplay : null;

    const price = num(pricing.value);
    const listPrice = num(pricing.original);
    const discountPct =
      price !== null && listPrice !== null && listPrice > price
        ? Math.round(((listPrice - price) / listPrice) * 100)
        : 0;

    return {
      itemId: String(p.itemId ?? itemId),
      title: typeof ids.productLabel === 'string' ? ids.productLabel : null,
      sku: typeof ids.storeSkuNumber === 'string' ? ids.storeSkuNumber : null,
      modelNumber: typeof ids.modelNumber === 'string' ? ids.modelNumber : null,
      price,
      listPrice,
      discountPct,
      storeId: String(storeId),
      storeName,
      quantity,
      inStock,
      altPriceDisplay,
      clearancePrice,
      clearancePct,
      discontinued: typeof avail.discontinued === 'boolean' ? avail.discontinued : null,
    };
  } catch {
    return null; // unreachable — the caller leaves the deal unverified
  } finally {
    clearTimeout(timer);
  }
}
