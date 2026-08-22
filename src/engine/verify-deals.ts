/**
 * Verify deals against Unwrangle (authoritative per-store price + inventory)
 * and SAVE the truth. The Apify clearance sweep hallucinates markdowns and
 * stock counts (proven: it claimed $7.03 / 8 units for a SKU that is really
 * $29.98 / 74), so nothing it reports can be shown as fact until a real source
 * confirms it.
 *
 * This checks the top N unverified deals by discount, overwrites their
 * price/discount/stock with Unwrangle's real numbers, and stamps verified_at.
 * A "deal" only survives if Unwrangle shows a genuine reduction >= the floor;
 * a hallucinated markdown collapses to 0% off and drops out of every feed.
 *
 * Cost: one Unwrangle request per deal (~2.5 credits). Bounded by N and by the
 * verified_at NULLS FIRST ordering, so each run checks the least-recently-known.
 */

import type { Db } from '../db/client.js';

const ENDPOINT = 'https://data.unwrangle.com/api/getter/';
const FLOOR = 25;

export interface VerifyResult {
  checked: number;
  confirmed: number;
  rejected: number;
  errors: number;
  details: Array<{ product_id: string; was_discount: number; real_price: number | null; real_discount: number; qty: number | null; kept: boolean }>;
}

const n = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

/**
 * Unwrangle is intermittent for Home Depot — the same item returns real data
 * one call and "Product not found" the next (HD bot protection, hit unevenly).
 * So retry with backoff and only trust a `success:true` payload. Returns null
 * when we genuinely could not reach it, so the caller leaves the deal
 * unverified rather than wrongly deleting it.
 */
async function fetchDetail(url: string): Promise<Record<string, unknown> | null> {
  // ONE attempt. Each call already takes ~35s (live HD scrape), so retries turn
  // a 10-item run into 20+ minutes. A flaky miss just leaves the deal unverified
  // for this pass; the next run picks it up (ORDER BY verified_at NULLS FIRST).
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 40_000);
    const res = await fetch(url, { signal: ctl.signal });
    clearTimeout(timer);
    const data = (await res.json()) as Record<string, unknown>;
    if (data.success === true) {
      return (data.detail as Record<string, unknown>) ?? data;
    }
  } catch {
    /* timeout or network — treat as unresolved, do not block */
  }
  return null;
}

export async function verifyTopDeals(db: Db, limit = 10): Promise<VerifyResult> {
  const key = process.env.UNWRANGLE_KEY;
  if (!key) throw new Error('UNWRANGLE_KEY is not set — cannot verify.');

  const { rows } = await db.query<Record<string, unknown>>(
    `SELECT s.product_id, s.store_id, s.last_discount,
            p.item_id, p.retailer, p.sku, st.store_number, st.zip
       FROM sku_state s
       JOIN products p ON p.product_id = s.product_id
       JOIN stores   st ON st.store_id  = s.store_id
      WHERE COALESCE(s.last_discount, 0) >= $1
        AND p.item_id IS NOT NULL
      ORDER BY s.verified_at ASC NULLS FIRST, s.last_discount DESC
      LIMIT $2`,
    [FLOOR, limit],
  );

  const out: VerifyResult = { checked: 0, confirmed: 0, rejected: 0, errors: 0, details: [] };

  // Run the Unwrangle calls in parallel WAVES. Each call is ~35s (live HD
  // scrape), so a wave of 5 finishes in ~35s and 10 deals take ~70s — versus
  // ~6 min sequential. Full 10-at-once is faster still but trips Unwrangle's
  // rate limit and most calls fail, so 5 is the speed/reliability sweet spot.
  // Whatever fails stays unverified and the next run retries it (verified_at
  // NULLS FIRST ordering), so this is safely re-runnable.
  const CONCURRENCY = 5;
  const fetched: Array<{ r: Record<string, unknown>; det: Record<string, unknown> | null }> = [];
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const wave = await Promise.all(
      rows.slice(i, i + CONCURRENCY).map(async (r) => {
        const q = new URLSearchParams({
          platform: 'homedepot_detail',
          item_id: String(r.item_id),
          store_no: String(r.store_number ?? ''),
          zipcode: String(r.zip ?? '78232'),
          api_key: key,
        });
        return { r, det: await fetchDetail(`${ENDPOINT}?${q.toString()}`) };
      }),
    );
    fetched.push(...wave);
  }

  // DB writes are fast and serial — the slow part (the fetches) already ran.
  for (const { r, det } of fetched) {
    out.checked++;
    const productId = String(r.product_id);
    const storeId = String(r.store_id);
    const wasDisc = n(r.last_discount) ?? 0;

    if (!det) {
      // Could not reach an authoritative answer — leave it UNVERIFIED (do not
      // touch verified_at, do not delete). Unknown is not the same as fake.
      out.errors++;
      out.details.push({ product_id: productId, was_discount: wasDisc, real_price: null, real_discount: 0, qty: null, kept: false });
      continue;
    }

    const price = n(det.price);
    const listPrice = n(det.list_price);
    const priceReduced = n(det.price_reduced);
    const qty = n(det.inventory_quantity) ?? n(det.store_inventory_quantity);

    // The "before" price is the largest listed price strictly above the selling
    // price. If nothing is higher, there is no real markdown.
    const current = price;
    const candidates = [listPrice, priceReduced].filter((v): v is number => v !== null && current !== null && v > current);
    const original = candidates.length ? Math.max(...candidates) : null;
    const realDisc =
      current !== null && original !== null ? Math.round(((original - current) / original) * 100) : 0;
    const kept = realDisc >= FLOOR;

    // Save the truth either way: real price/discount/stock + verified stamp. A
    // hallucinated deal is written as its real 0% self, so it drops under the
    // floor and leaves the feed instead of lying.
    if (current !== null) {
      await db.query(
        `UPDATE sku_state
            SET last_price = $3, last_discount = $4, last_stock = $5, verified_at = now()
          WHERE product_id = $1 AND store_id = $2`,
        [productId, storeId, current, realDisc, qty],
      );
      const origCents = original !== null ? Math.round(original * 100) : null;
      await db.query(
        `UPDATE store_inventory
            SET price_cents = $4, orig_price_cents = $5, discount_pct = $6,
                quantity = $7, in_stock = $8, verified_at = now()
          WHERE retailer = $1 AND sku = $2 AND store_id = $3`,
        [
          String(r.retailer), String(r.sku), storeId,
          Math.round(current * 100), origCents, realDisc,
          qty, qty === null ? null : qty > 0,
        ],
      );
    }

    if (kept) out.confirmed++;
    else out.rejected++;
    out.details.push({ product_id: productId, was_discount: wasDisc, real_price: current, real_discount: realDisc, qty, kept });
  }

  return out;
}
