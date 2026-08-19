/**
 * The matching predicate, defined exactly once.
 *
 * Two callers need it and they must never disagree:
 *   - the watchlist form's "this would have matched N deals last week"
 *   - the matcher that actually sends alerts
 *
 * If those two drift, the preview becomes a lie, and the preview exists
 * specifically so nobody saves a filter that never fires.
 */

import type { Db } from '../db/client.js';

export interface WatchCriteria {
  term: string;
  categoryIds: string[] | null;
  minDiscount: number;
  maxPrice: number | null;
  retailer: string | null;
}

export interface GeoScope {
  lat: number | null;
  lng: number | null;
  radiusMi: number | null;
}

/**
 * Great-circle distance in miles, in SQL. No PostGIS dependency — the whole
 * schema stays plain Postgres so PGlite and Neon run the identical file.
 */
const DISTANCE_MI = `
  3958.8 * 2 * asin(sqrt(
    power(sin(radians(st.lat - $LAT) / 2), 2) +
    cos(radians($LAT)) * cos(radians(st.lat)) *
    power(sin(radians(st.lng - $LNG) / 2), 2)
  ))`;

/**
 * Shared WHERE fragment. Parameter numbers are passed in rather than
 * hardcoded so the same text works in queries with different leading params.
 *
 * Nothing here is interpolated from user input — only integers naming bind
 * positions. The values themselves always travel as bound parameters.
 */
export function criteriaSql(p: {
  minDiscount: number;
  maxPrice: number;
  retailer: number;
  categoryIds: number;
  titleLike: number;
  lat: number;
  lng: number;
  radius: number;
}): string {
  const dist = DISTANCE_MI.replaceAll('$LAT', `$${p.lat}`).replaceAll('$LNG', `$${p.lng}`);
  return `
      COALESCE(o.discount_pct, 0) >= $${p.minDiscount}
  AND ($${p.maxPrice}::numeric IS NULL OR o.price <= $${p.maxPrice})
  AND ($${p.retailer}::text IS NULL OR p.retailer = $${p.retailer})
  AND (
        (cardinality($${p.categoryIds}::text[]) > 0 AND p.category = ANY($${p.categoryIds}::text[]))
        -- Term never resolved to a category: fall back to the title so the
        -- watch does something, and say so in the UI rather than pretending.
     OR (cardinality($${p.categoryIds}::text[]) = 0 AND p.title ILIKE $${p.titleLike})
  )
  AND (
        $${p.lat}::float8 IS NULL OR $${p.lng}::float8 IS NULL
     OR $${p.radius}::float8 IS NULL
     OR st.lat IS NULL OR st.lng IS NULL
     OR (${dist}) <= $${p.radius}
  )`;
}

/** Bind values in the order `criteriaSql` names them. */
function criteriaParams(c: WatchCriteria, geo: GeoScope): unknown[] {
  return [
    c.minDiscount,
    c.maxPrice,
    c.retailer,
    c.categoryIds ?? [],
    `%${c.term}%`,
    geo.lat,
    geo.lng,
    geo.radiusMi,
  ];
}

/**
 * How many distinct deals this watch would have caught in the last N days.
 *
 * Counts against `price_observations` rather than the `sku_state` cache,
 * because the honest answer to "would this have fired last week" is history,
 * not the current snapshot.
 */
export async function countRecentMatches(
  db: Db,
  criteria: WatchCriteria,
  geo: GeoScope,
  days = 7,
): Promise<number> {
  const where = criteriaSql({
    minDiscount: 1, maxPrice: 2, retailer: 3, categoryIds: 4,
    titleLike: 5, lat: 6, lng: 7, radius: 8,
  });

  const { rows } = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM (
       SELECT DISTINCT o.product_id, o.store_id
         FROM price_observations o
         JOIN products p ON p.product_id = o.product_id
         LEFT JOIN stores st ON st.store_id = o.store_id
        WHERE o.observed_at >= now() - ($9 || ' days')::interval
          AND ${where}
     ) t`,
    [...criteriaParams(criteria, geo), String(days)],
  );
  return Number(rows[0]?.n ?? 0);
}

export interface MatchRow {
  product_id: string;
  store_id: string;
  watch_id: string | null;
  title: string | null;
  penny_score: number | null;
  price: number | null;
  discount_pct: number | null;
  store_name: string | null;
}

/**
 * Current deals matching one watch, newest state, best score first.
 * Reads the `sku_state` cache — here the question really is "what is true
 * right now", which is exactly what that table holds.
 */
export async function currentMatches(
  db: Db,
  watchId: string | null,
  criteria: WatchCriteria,
  geo: GeoScope,
  sinceHours = 26,
  limit = 200,
): Promise<MatchRow[]> {
  const where = criteriaSql({
    minDiscount: 1, maxPrice: 2, retailer: 3, categoryIds: 4,
    titleLike: 5, lat: 6, lng: 7, radius: 8,
  });

  // `o` is aliased onto sku_state so the shared fragment reads the same
  // column names in both callers.
  const { rows } = await db.query<MatchRow>(
    `SELECT o.product_id, o.store_id, $10::bigint AS watch_id,
            p.title, o.penny_score, o.price, o.discount_pct, st.name AS store_name
       FROM (
         SELECT product_id, store_id, penny_score,
                last_price    AS price,
                last_discount AS discount_pct,
                last_seen_at
           FROM sku_state
       ) o
       JOIN products p ON p.product_id = o.product_id
       LEFT JOIN stores st ON st.store_id = o.store_id
      WHERE o.last_seen_at >= now() - ($9 || ' hours')::interval
        AND ${where}
      ORDER BY o.penny_score DESC NULLS LAST, o.discount_pct DESC NULLS LAST
      LIMIT ${Number(limit)}`,
    [...criteriaParams(criteria, geo), String(sinceHours), watchId],
  );
  return rows;
}
