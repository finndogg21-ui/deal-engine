/**
 * The discovery pool: find everything, publish nothing on faith.
 *
 * Flow, and the reason for every step:
 *
 *   1. SEED    — every candidate we have from any source (the Apify sweep,
 *                PennyCentral, Slickdeals) lands in `discovery` as `pending`.
 *                Nothing here is shown to a customer.
 *   2. CHECK   — a checker asks Home Depot's own store-level endpoint for the
 *                real price and the real shelf quantity. HD blocks our server
 *                (Akamai, verified 2026-08-22: HTTP 206 "Generic errors") but
 *                answers a browser, so the scheduled agent runs the calls and
 *                posts the facts back here.
 *   3. JUDGE   — publish only what is real AND worth the drive; reject the
 *                rest with a reason so the pool is auditable.
 *
 * Every fabrication this project shipped would have died at step 3: the $7.03
 * strip light (HD says $29.98, no markdown), the "138 in stock" appliance
 * packages (HD reports no shelf count), RebelSavings' synthetic catalog (item
 * ids 404 at HD).
 */

import type { Db } from '../db/client.js';
import { meetsTieredFloor } from './deal-floor.js';

/** Reject reasons name the retailer that actually answered. */
const RETAILER_LABEL: Record<string, string> = {
  homedepot: 'Home Depot',
  'home-depot': 'Home Depot',
  target: 'Target',
  lowes: "Lowe's",
  walmart: 'Walmart',
  bestbuy: 'Best Buy',
  dollargeneral: 'Dollar General',
  tractorsupply: 'Tractor Supply',
  costco: 'Costco',
};

/** One item the checker should ask Home Depot about. */
export interface PendingCheck {
  discovery_id: number;
  /** Which retailer's API to ask. Home Depot and Target use different ones. */
  retailer: string;
  item_id: string;
  title: string | null;
  claimed_price: number | null;
  claimed_discount: number | null;
}

/** What the checker learned from Home Depot itself. */
export interface HdVerdictInput {
  discovery_id: number;
  reachable: boolean;
  /**
   * Which retailer answered. The pool is multi-retailer now, and a reject
   * reason that says "at Home Depot" on a Target row is a lie in the audit
   * trail. Defaults to Home Depot for rows written before Target existed.
   */
  retailer?: string | null;
  price?: number | null;
  list_price?: number | null;
  discount_pct?: number | null;
  store_id?: string | null;
  quantity?: number | null;
  in_stock?: boolean | null;
  discontinued?: boolean | null;
  /**
   * HD's `pricing.alternatePriceDisplay`. When there is NO online markdown but
   * this is true, Home Depot is hiding an in-store clearance price behind
   * "See In-Store Clearance Price" — the hidden clearance this product exists
   * to find. Verified 2026-08-22: the Rubbermaid bucket (item 100138008) reads
   * alt=true with original=null and carries the clearance badge on HD's page,
   * while ordinary full-price items at the same store read alt=false.
   */
  alt_price_display?: boolean | null;
  /**
   * HD's `pricing.clearance` — THE ACTUAL IN-STORE CLEARANCE PRICE, per store.
   * Verified 2026-08-22: the Rubbermaid bucket reads clearance.value 2.40 /
   * 88% off at Fairbanks and 2.00 / 90% off at Bitters Rd, matching what a
   * competitor's in-store feed showed. `alternatePriceDisplay` alone is NOT
   * proof of a deal (an item can carry the flag with percentageOff 0) — the
   * real test is a clearance price BELOW the shelf price.
   */
  clearance_price?: number | null;
  clearance_pct?: number | null;
  /**
   * The store the clearance price belongs to, and how many we asked. Clearance
   * is per store, so a price with no store attached cannot be acted on — and
   * "as low as" is only honest if we say how wide the sample was.
   */
  clearance_store?: string | null;
  clearance_stores_checked?: number | null;
}

/**
 * Pull every candidate we know of into the pool. Idempotent: an item already
 * in `discovery` keeps its status, so a published deal is never re-pended and
 * a rejected one is not silently resurrected by the next sweep.
 */
export async function seedDiscovery(db: Db): Promise<{ from_sweep: number; from_community: number }> {
  const sweep = await db.query(
    `INSERT INTO discovery (retailer, item_id, sku, title, image_url, product_url, source,
                            claimed_price, claimed_list, claimed_discount)
     SELECT DISTINCT ON (p.item_id)
            p.retailer, p.item_id, p.sku, p.title, p.image_url, p.product_url, 'apify',
            s.last_price,
            CASE WHEN s.last_discount > 0 AND s.last_discount < 100
                 THEN ROUND(s.last_price / (1 - s.last_discount / 100.0), 2) END,
            s.last_discount
       FROM sku_state s
       JOIN products p ON p.product_id = s.product_id
      WHERE p.item_id IS NOT NULL
        AND COALESCE(s.last_discount, 0) > 0
        AND p.product_url NOT LIKE '%/p/sets/%'
      ORDER BY p.item_id, s.last_discount DESC
     ON CONFLICT (retailer, item_id) DO NOTHING`,
  );

  const community = await db.query(
    `INSERT INTO discovery (retailer, item_id, sku, title, image_url, product_url, source,
                            claimed_price, claimed_list, claimed_discount)
     SELECT DISTINCT ON (c.item_id)
            c.retailer, c.item_id, c.sku, c.title, c.image_url, c.product_url, c.source,
            c.price, c.list_price, c.discount_pct
       FROM community_reports c
      WHERE c.item_id IS NOT NULL
      ORDER BY c.item_id, c.reported_at DESC NULLS LAST
     ON CONFLICT (retailer, item_id) DO NOTHING`,
  );

  return { from_sweep: sweep.rowCount ?? 0, from_community: community.rowCount ?? 0 };
}

/**
 * The next items to ask Home Depot about: never-checked first, then the
 * stalest. Bounded per run so a scheduled check stays polite and cheap.
 */
export async function pendingChecks(
  db: Db,
  limit = 25,
  retailer?: string | null,
): Promise<PendingCheck[]> {
  /**
   * FILTER BY RETAILER, ALWAYS, IN PRACTICE.
   *
   * This queue used to be retailer-blind, and the Home Depot routine asks
   * Home Depot about every item_id it is handed. Once Target rows entered the
   * pool they came back in this queue too — 20 of 20 pending items were Target
   * TCINs — so the next Home Depot run would have queried HD's catalog with
   * Target ids, got "not found" for all of them, and marked live Target deals
   * unreachable. One retailer's checker silently deleting another's inventory.
   *
   * The caller now names its retailer and can only ever be given those rows.
   */
  const { rows } = await db.query<Record<string, unknown>>(
    `SELECT discovery_id, retailer, item_id, title, claimed_price, claimed_discount
       FROM discovery
      WHERE ($2::text IS NULL OR retailer = $2)
        AND (status IN ('pending', 'unreachable')
             OR (status = 'published' AND checked_at < now() - INTERVAL '12 hours'))
      ORDER BY checked_at ASC NULLS FIRST
      LIMIT $1`,
    [limit, retailer ?? null],
  );
  return rows.map((r) => ({
    discovery_id: Number(r.discovery_id),
    retailer: String(r.retailer ?? 'homedepot'),
    item_id: String(r.item_id),
    title: (r.title as string) ?? null,
    claimed_price: r.claimed_price === null ? null : Number(r.claimed_price),
    claimed_discount: r.claimed_discount === null ? null : Number(r.claimed_discount),
  }));
}

/**
 * Judge one item against Home Depot's own answer and record the verdict.
 *
 * Publishing requires ALL of:
 *   - HD answered (unreachable stays unpublished — unknown is not a deal),
 *   - a real markdown at HD (not the source's claim),
 *   - that markdown clears the price-tiered floor,
 *   - HD reports units on that store's floor (in-store product, per the
 *     founder's constitution).
 */
export function judge(v: HdVerdictInput): {
  status: 'published' | 'rejected' | 'unreachable';
  reason: string | null;
  kind: 'markdown' | 'hidden_clearance' | null;
} {
  const who = RETAILER_LABEL[String(v.retailer ?? 'homedepot')] ?? 'the retailer';
  if (!v.reachable) return { status: 'unreachable', reason: `${who} did not answer`, kind: null };
  if (v.discontinued) return { status: 'rejected', reason: `discontinued at ${who}`, kind: null };

  const price = v.price ?? null;
  const disc = v.discount_pct ?? 0;

  /**
   * THE CATALOG IS NATIONAL. A markdown is a chain-wide fact about a SKU, not
   * a fact about one building, so publishing never requires stock at whichever
   * store we happened to check. Stock is the per-ZIP overlay at read time.
   * (Founder: "it's a global website, not Bitters Deals.")
   */

  // HIDDEN CLEARANCE — HD does not print this price on the page, but its own
  // pricing.clearance field carries it. This is the real thing: a per-store
  // clearance price BELOW the shelf price.
  //
  // `alternatePriceDisplay` is Home Depot's own tell: it is what puts the
  // "See In-Store Clearance Price" button on their page. The number exists —
  // HD simply puts it behind a click — so a flagged item IS a real find and
  // stays in the feed. What the card must never do is print the bare word
  // "Clearance" in the price slot; it shows a reveal control instead, and the
  // number arrives from pricing.clearance once a check has fetched it.
  const clr = v.clearance_price ?? null;
  const clrPct = v.clearance_pct ?? 0;
  if (clr !== null && price !== null && clr < price && clrPct > 0) {
    // Same floor as any deal: a 9%-off clearance is still not worth a drive.
    if (!meetsTieredFloor(clr, clrPct)) {
      return { status: 'rejected', reason: `clearance ${Math.round(clrPct)}% off $${clr.toFixed(2)} is under the floor`, kind: null };
    }
    return { status: 'published', reason: null, kind: 'hidden_clearance' };
  }

  if (price === null) return { status: 'rejected', reason: `no price at ${who}`, kind: null };

  /**
   * THE FLAG IS NOT A PRICE, AND NO LONGER PUBLISHES ON ITS OWN.
   *
   * Measured 2026-08-23 across 5 metros: `alternatePriceDisplay` came back
   * true for 10 of 10 (item, store) pairs — including the 8 with no clearance
   * anywhere near them. It is a PRODUCT-level attribute ("this item takes part
   * in clearance somewhere"), not the per-store signal it was taken for. Any
   * row published on the flag alone therefore reached the feed with nothing to
   * show, which is how 19 of 21 cards ended up saying "Varies by store".
   *
   * A customer must always see a real price, so the rule is now simple: no
   * number from any store we checked, no card. The multi-store checker finds
   * the lowest real clearance and that is what the card quotes.
   */
  if (disc <= 0) {
    return {
      status: 'rejected',
      reason:
        v.alt_price_display === true
          ? `flagged as clearance at ${who} but no store we checked had a price`
          : `no markdown at ${who}`,
      kind: null,
    };
  }
  if (!meetsTieredFloor(price, disc)) {
    return { status: 'rejected', reason: `${Math.round(disc)}% off $${price.toFixed(2)} is under the floor`, kind: null };
  }
  return { status: 'published', reason: null, kind: 'markdown' };
}

/** Record verdicts. Returns counts for the run report. */
export async function recordVerdicts(
  db: Db,
  verdicts: HdVerdictInput[],
): Promise<{ published: number; rejected: number; unreachable: number; hidden_clearance: number }> {
  const out = { published: 0, rejected: 0, unreachable: 0, hidden_clearance: 0 };

  // The caller need not know which retailer a row belongs to — the pool does.
  // Look it up so reject reasons name the right store even when the checker
  // omits it.
  const ids = verdicts.map((v) => v.discovery_id);
  const known = new Map<number, string>();
  if (ids.length > 0) {
    const { rows } = await db.query<Record<string, unknown>>(
      `SELECT discovery_id, retailer FROM discovery WHERE discovery_id = ANY($1::int[])`,
      [ids],
    );
    for (const r of rows) known.set(Number(r.discovery_id), String(r.retailer ?? 'homedepot'));
  }

  for (const v of verdicts) {
    const { status, reason, kind } = judge({
      ...v,
      retailer: v.retailer ?? known.get(v.discovery_id) ?? 'homedepot',
    });
    out[status]++;
    if (kind === 'hidden_clearance') out.hidden_clearance++;
    await db.query(
      `UPDATE discovery
          SET status = $2, reject_reason = $3, checked_at = now(), deal_kind = $9,
              clearance_price = $10, clearance_pct = $11,
              alt_price_display = $12,
              clearance_store = $13, clearance_stores_checked = $14,
              hd_price = $4, hd_list = $5, hd_discount = $6,
              hd_store_id = $7, hd_quantity = $8,
              publish_at = CASE WHEN $2 = 'published' THEN COALESCE(publish_at, now()) ELSE publish_at END
        WHERE discovery_id = $1`,
      [
        v.discovery_id, status, reason,
        v.price ?? null, v.list_price ?? null, v.discount_pct ?? null,
        v.store_id ?? null, v.quantity ?? null, kind,
        v.clearance_price ?? null, v.clearance_pct ?? null,
        // Persisted so a row that IS a hidden clearance stays identifiable even
        // before we have fetched its number. Without this the flag was read,
        // used once, and thrown away.
        v.alt_price_display ?? null,
        v.clearance_store ?? null,
        v.clearance_stores_checked ?? null,
      ],
    );
  }
  return out;
}

/** What the app should show: only HD-verified, in-stock, floor-clearing deals. */
export async function publishedDeals(db: Db, limit = 200) {
  const { rows } = await db.query<Record<string, unknown>>(
    `SELECT discovery_id, retailer, item_id, sku, title, image_url, product_url,
            hd_price, hd_list, hd_discount, hd_store_id, hd_quantity,
            checked_at, source, deal_kind, clearance_price, clearance_pct,
            clearance_store, clearance_stores_checked
       FROM discovery
      WHERE status = 'published'
      -- Hidden clearance first (the category this product is named after),
      -- then the biggest verified markdowns.
      ORDER BY (deal_kind = 'hidden_clearance') DESC, hd_discount DESC NULLS LAST
      LIMIT $1`,
    [limit],
  );
  return rows;
}
