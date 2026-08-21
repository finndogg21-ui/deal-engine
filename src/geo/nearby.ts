/**
 * ===========================================================================
 *  ZIP -> nearby stores, by great-circle distance over stores.lat/lng.
 * ===========================================================================
 *
 * Backs GET /api/deals/nearby. Given a ZIP, it finds the stores around it and
 * orders them by real distance, so the in-store feed can be filtered to "near
 * this person" without a live call to anyone.
 *
 * ---------------------------------------------------------------------------
 * OPEN QUESTION (blocking, documented in docs/nationwide-zip-deals-plan.md):
 *   There is NO US ZIP -> lat/lng source in this repo or in node_modules. To
 *   measure distance FROM a ZIP we need that ZIP's centroid, and we refuse to
 *   invent one — a made-up coordinate produces confidently wrong distances,
 *   which is the exact failure that sends someone on a wasted drive.
 *
 *   Until a real reference is wired in, this module ANCHORS a ZIP using only
 *   coordinates we already trust: the stores we have recorded. If we know a
 *   store in that ZIP (or, failing that, in that 3-digit ZIP prefix), we anchor
 *   on it. If we know nothing near that ZIP, resolveZipAnchor returns null and
 *   the caller must say so honestly rather than guess.
 *
 *   The proper fix is one of:
 *     - a static ZIP-centroid table shipped with the app (US Census ZCTA
 *       Gazetteer, ~33k rows, public domain) loaded into a `zip_centroids`
 *       table, OR
 *     - a tiny dependency (e.g. a zip->latlng package) if licensing is fine.
 *   Either makes resolveZipAnchor exact for every ZIP and is a drop-in: only
 *   the body of resolveZipAnchor changes.
 * ---------------------------------------------------------------------------
 */

import type { Db } from '../db/client.js';

const EARTH_RADIUS_MI = 3958.8;

/** Great-circle distance in miles, rounded to 0.1. Matches the haversine the
 *  API already uses inline in server.ts / finds.ts — kept here so there is one
 *  copy the moment more than one endpoint needs it. */
export function haversineMi(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(EARTH_RADIUS_MI * 2 * Math.asin(Math.sqrt(s)) * 10) / 10;
}

export interface ZipAnchor {
  lat: number;
  lng: number;
  /**
   * How the anchor was resolved, so the caller can be honest about precision:
   *   store_zip_exact  — a store we know sits in exactly this ZIP.
   *   store_zip_prefix — no exact match; averaged the stores in this 3-digit
   *                      ZIP prefix (a rough metro proxy, same idea as
   *                      coverage.ts's prefix logic).
   */
  source: 'zip_centroid' | 'store_zip_exact' | 'store_zip_prefix';
}

export interface NearbyStore {
  store_id: string;
  retailer: string;
  /** Present for server-side use (joins, ops). MUST NOT be put on a card — see
   *  the product rule in routes/nearby-deals.ts. */
  store_number: string | null;
  name: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number;
  lng: number;
  distance_mi: number;
}

/** Coerces DOUBLE PRECISION coming back as number | string | null to a number
 *  or null. node-postgres and PGlite disagree on float text vs number, so this
 *  normalises both without pretending a null is a 0. */
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Resolve a ZIP to a coordinate using ONLY store rows we already trust.
 * Returns null when we have no store near that ZIP — the caller must treat that
 * as "we can't place this ZIP yet", not as "no deals". Never invents a point.
 */
export async function resolveZipAnchor(db: Db, zip: string): Promise<ZipAnchor | null> {
  if (!/^\d{5}$/.test(zip)) return null;

  // Real ZIP centroid — the correct, universal anchor. Placed for EVERY US ZIP
  // (US Census ZCTA Gazetteer, loaded into zip_centroids). This is what lets an
  // arbitrary ZIP resolve instead of only ZIPs where we happen to have a store.
  const centroid = await db.query<{ lat: unknown; lng: unknown }>(
    `SELECT lat, lng FROM zip_centroids WHERE zip = $1`,
    [zip],
  );
  const cLat = num(centroid.rows[0]?.lat);
  const cLng = num(centroid.rows[0]?.lng);
  if (cLat !== null && cLng !== null) {
    return { lat: cLat, lng: cLng, source: 'zip_centroid' };
  }

  // Fallbacks below only matter for a ZIP not in the centroid table (rare —
  // ZCTAs miss a few PO-box-only ZIPs). Anchor on stores we already trust.
  const exact = await db.query<{ lat: unknown; lng: unknown }>(
    `SELECT AVG(lat) AS lat, AVG(lng) AS lng
       FROM stores
      WHERE zip = $1 AND lat IS NOT NULL AND lng IS NOT NULL`,
    [zip],
  );
  const eLat = num(exact.rows[0]?.lat);
  const eLng = num(exact.rows[0]?.lng);
  if (eLat !== null && eLng !== null) {
    return { lat: eLat, lng: eLng, source: 'store_zip_exact' };
  }

  // Fall back to the 3-digit prefix (rough metro). LIKE on a prefix uses the
  // idx_stores_zip index for the anchored literal.
  const prefix = zip.slice(0, 3);
  const near = await db.query<{ lat: unknown; lng: unknown }>(
    `SELECT AVG(lat) AS lat, AVG(lng) AS lng
       FROM stores
      WHERE zip LIKE $1 AND lat IS NOT NULL AND lng IS NOT NULL`,
    [`${prefix}%`],
  );
  const pLat = num(near.rows[0]?.lat);
  const pLng = num(near.rows[0]?.lng);
  if (pLat !== null && pLng !== null) {
    return { lat: pLat, lng: pLng, source: 'store_zip_prefix' };
  }

  return null;
}

export interface NearbyOptions {
  zip: string;
  /** Radius in miles. */
  radiusMi: number;
  /** Optional retailer slug filter (e.g. 'homedepot'). */
  retailer?: string | null;
  /** Cap on returned stores. */
  limit?: number;
}

/**
 * Stores within `radiusMi` of `zip`, nearest first.
 *
 * Two-step, so it stays fast at national scale: a lat/lng bounding-box
 * prefilter in SQL (served by idx_stores_latlng) narrows to a small candidate
 * set, then the exact haversine runs in JS — the same split the rest of the
 * API already uses. Returns anchor:null when the ZIP can't be placed; the
 * store list is then empty by definition.
 */
export async function nearbyStores(
  db: Db,
  opts: NearbyOptions,
): Promise<{ anchor: ZipAnchor | null; stores: NearbyStore[] }> {
  const anchor = await resolveZipAnchor(db, opts.zip);
  if (!anchor) return { anchor: null, stores: [] };

  const radius = Math.max(1, opts.radiusMi);
  const limit = Math.max(1, Math.min(opts.limit ?? 200, 500));

  // Bounding box around the anchor. ~69 miles per degree of latitude; a degree
  // of longitude shrinks with latitude, so scale by cos(lat). Guard the cosine
  // near the poles (never happens for US ZIPs, but cheap insurance).
  const latDelta = radius / 69;
  const cosLat = Math.max(Math.cos((anchor.lat * Math.PI) / 180), 0.01);
  const lngDelta = radius / (69 * cosLat);

  const retailer = opts.retailer?.trim().toLowerCase() || null;

  const { rows } = await db.query<Record<string, unknown>>(
    `SELECT store_id, retailer, store_number, name, city, state, zip, lat, lng
       FROM stores
      WHERE lat IS NOT NULL AND lng IS NOT NULL
        AND lat BETWEEN $1 AND $2
        AND lng BETWEEN $3 AND $4
        AND ($5::text IS NULL OR retailer = $5)`,
    [
      anchor.lat - latDelta,
      anchor.lat + latDelta,
      anchor.lng - lngDelta,
      anchor.lng + lngDelta,
      retailer,
    ],
  );

  const stores: NearbyStore[] = [];
  for (const r of rows) {
    const lat = num(r.lat);
    const lng = num(r.lng);
    if (lat === null || lng === null) continue;
    const distance = haversineMi(anchor.lat, anchor.lng, lat, lng);
    if (distance > radius) continue; // box is square; haversine trims the corners
    stores.push({
      store_id: String(r.store_id),
      retailer: String(r.retailer),
      store_number: r.store_number === null || r.store_number === undefined ? null : String(r.store_number),
      name: r.name === null || r.name === undefined ? null : String(r.name),
      city: r.city === null || r.city === undefined ? null : String(r.city),
      state: r.state === null || r.state === undefined ? null : String(r.state),
      zip: r.zip === null || r.zip === undefined ? null : String(r.zip),
      lat,
      lng,
      distance_mi: distance,
    });
  }

  stores.sort((a, b) => a.distance_mi - b.distance_mi);
  return { anchor, stores: stores.slice(0, limit) };
}
