/**
 * Home Depot appliance PACKAGES and washer/dryer SETS are delivery-only bundles,
 * not single in-store SKUs. HD never puts a per-store shelf count on a bundle, so
 * the clearance sweep's "N in stock" for one is fabricated.
 *
 * Proven on 2026-08-22 against Home Depot's own pages (ZIP 78232):
 *   - "$2,196 fridge, 138 in stock" was really a GE 4-appliance Kitchen Package,
 *     "Available by Aug 26" with NO shelf count. The 138 was invented.
 *   - "$1,858 washer, 1,156 in stock" was an LG washer+dryer SET, delivery-only.
 *     The 1,156 was invented.
 * Meanwhile every single-SKU row checked (e.g. the Honeywell air purifier, 2 in
 * stock) matched HD exactly. So the fix is not "distrust everything" — it is
 * "drop the bundles", which is where the fabricated stock comes from.
 *
 * Signature: every HD bundle page lives under the `/p/sets/` URL segment; single
 * products are `/p/<brand>-...`. Category is the backup signal ("Kitchen
 * Appliance Packages", "Front Load Washer & Dryer Sets"). We match the category
 * narrowly so a legitimate "Tool Set" (a real, shelf-stocked single purchase) is
 * NOT caught.
 *
 * Applied in two places: dropped at ingest (src/ingest/run-scan.ts) so future
 * scans never store them, and excluded at read time (the deal feeds) so any that
 * already slipped in stop showing.
 */

/** The URL segment HD uses for its package/set builder. Bundles only. */
export function isBundleUrl(url: string | null | undefined): boolean {
  return !!url && /\/p\/sets\//i.test(url);
}

/** Narrow category match — the two real bundle categories, not "Tool Sets". */
export function isBundleCategory(category: string | null | undefined): boolean {
  return !!category && /appliance package|washer\s*&?\s*dryer set/i.test(category);
}

/** True when a deal event / product row is a delivery-only bundle. */
export function isBundle(e: {
  productUrl?: string | null;
  product_url?: string | null;
  category?: string | null;
}): boolean {
  const url = e.productUrl ?? e.product_url ?? null;
  return isBundleUrl(url) || isBundleCategory(e.category);
}

/**
 * SQL predicate (no bound params — the literal is a constant) to exclude bundles
 * from any query that joins `products AS p`. The URL segment is 100% reliable in
 * our data, so read-time filtering keys off it alone.
 */
export const EXCLUDE_BUNDLES_SQL = `p.product_url NOT LIKE '%/p/sets/%'`;

/**
 * Anything Home Depot's own store-level check rejected must never appear in a
 * feed again. The discovery pool records WHY (no markdown at HD, under the
 * floor, nothing on the shelf); this predicate simply keeps those items out.
 * Verified need, 2026-08-22: 20 of 23 live "deals" failed the HD check — the
 * sweep had invented 50%-off tool deals by halving the real price.
 */
export const EXCLUDE_HD_REJECTED_SQL = `NOT EXISTS (
  SELECT 1 FROM discovery d
   WHERE d.item_id = p.item_id AND d.status = 'rejected')`;
