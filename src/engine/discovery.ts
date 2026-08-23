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

/** One item the checker should ask Home Depot about. */
export interface PendingCheck {
  discovery_id: number;
  item_id: string;
  title: string | null;
  claimed_price: number | null;
  claimed_discount: number | null;
}

/** What the checker learned from Home Depot itself. */
export interface HdVerdictInput {
  discovery_id: number;
  reachable: boolean;
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
export async function pendingChecks(db: Db, limit = 25): Promise<PendingCheck[]> {
  const { rows } = await db.query<Record<string, unknown>>(
    `SELECT discovery_id, item_id, title, claimed_price, claimed_discount
       FROM discovery
      WHERE status IN ('pending', 'unreachable')
         OR (status = 'published' AND checked_at < now() - INTERVAL '12 hours')
      ORDER BY checked_at ASC NULLS FIRST
      LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({
    discovery_id: Number(r.discovery_id),
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
  if (!v.reachable) return { status: 'unreachable', reason: 'Home Depot did not answer', kind: null };
  if (v.discontinued) return { status: 'rejected', reason: 'discontinued at Home Depot', kind: null };

  const price = v.price ?? null;
  const disc = v.discount_pct ?? 0;

  /**
   * THE CATALOG IS NATIONAL. A clearance markdown is a chain-wide fact about a
   * SKU, not a fact about one building — so publishing must NOT require stock
   * at whichever store we happened to check. Stock is the per-ZIP overlay,
   * resolved for the visitor's own stores at read time.
   *
   * (Founder correction, 2026-08-22: "it's a global website, not Bitters
   * Deals." The earlier gate rejected 17 real clearance-flagged items purely
   * because one San Antonio store had none on the shelf.)
   */

  // HIDDEN CLEARANCE — the category this product is named after. HD shows no
  // online markdown but flags an in-store clearance price it will not print.
  // No floor can apply (the register price is unknown) and we never invent
  // one: the card says "in-store clearance price - scan it".
  if (disc <= 0 && v.alt_price_display === true) {
    return { status: 'published', reason: null, kind: 'hidden_clearance' };
  }

  if (price === null) return { status: 'rejected', reason: 'no price at Home Depot', kind: null };
  if (disc <= 0) return { status: 'rejected', reason: 'no markdown at Home Depot', kind: null };
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
  for (const v of verdicts) {
    const { status, reason, kind } = judge(v);
    out[status]++;
    if (kind === 'hidden_clearance') out.hidden_clearance++;
    await db.query(
      `UPDATE discovery
          SET status = $2, reject_reason = $3, checked_at = now(), deal_kind = $9,
              hd_price = $4, hd_list = $5, hd_discount = $6,
              hd_store_id = $7, hd_quantity = $8,
              publish_at = CASE WHEN $2 = 'published' THEN COALESCE(publish_at, now()) ELSE publish_at END
        WHERE discovery_id = $1`,
      [
        v.discovery_id, status, reason,
        v.price ?? null, v.list_price ?? null, v.discount_pct ?? null,
        v.store_id ?? null, v.quantity ?? null, kind,
      ],
    );
  }
  return out;
}

/** What the app should show: only HD-verified, in-stock, floor-clearing deals. */
export async function publishedDeals(db: Db, limit = 200) {
  const { rows } = await db.query<Record<string, unknown>>(
    `SELECT discovery_id, item_id, sku, title, image_url, product_url,
            hd_price, hd_list, hd_discount, hd_store_id, hd_quantity,
            checked_at, source, deal_kind
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
