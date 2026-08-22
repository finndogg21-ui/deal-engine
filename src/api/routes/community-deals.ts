/**
 * Community-reported deals — GET /api/community-deals?kind=penny|clearance
 *
 * Serves community_reports (see schema.sql): crowd finds ingested from public
 * sources. These are HEARSAY, not our sweep's observations — the client must
 * always label them "reported by the community" and never present them as
 * verified stock. The penny tab is the main consumer: $0.01 is register-only,
 * so community reports are the only penny leads that exist.
 */

import { Router } from 'express';
import { getDb } from '../../db/client.js';
import { requireAuth, requirePlan, rateLimit, route } from '../middleware.js';
import { tieredFloorSql } from '../../engine/deal-floor.js';

export const communityDeals = Router();

const paid = [requireAuth, requirePlan('consumer', 'reseller')];

/**
 * GET /api/community-deals/:id — EVERYTHING we know about one report, for the
 * in-app detail page: the stored columns plus the extras that live only in
 * the raw source blob (brand, model, UPC, rarity tier, first-reported date,
 * and the per-state/city sighting breakdown).
 */
communityDeals.get(
  '/community-deals/:id',
  ...paid,
  rateLimit({ key: 'community', max: 60, windowMs: 60_000 }),
  route(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Bad report id.' });
    const db = await getDb();
    const { rows } = await db.query<Record<string, unknown>>(
      `SELECT report_id, source, kind, sku, item_id, title, price, list_price,
              discount_pct, state, city, store_number, product_url, source_url,
              image_url, reported_at, fetched_at, raw
         FROM community_reports WHERE report_id = $1`,
      [id],
    );
    const r = rows[0];
    if (!r) return res.status(404).json({ error: 'No such report.' });

    // raw is JSONB (object from pg) but may round-trip as a string on PGlite.
    let raw: Record<string, unknown> = {};
    try {
      raw = (typeof r.raw === 'string' ? JSON.parse(r.raw) : (r.raw as Record<string, unknown>)) ?? {};
    } catch { /* leave empty */ }

    // The sighting breakdown is a nested {STATE:{City:count}} object under a
    // source-defined key — same structural detection as the ingest.
    let locations: Record<string, unknown> | null = null;
    for (const v of Object.values(raw)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const entries = Object.entries(v as Record<string, unknown>);
        if (entries.length > 0 && entries.every(([k, sub]) => k.length <= 3 && !!sub && typeof sub === 'object' && !Array.isArray(sub))) {
          locations = v as Record<string, unknown>;
          break;
        }
      }
    }

    const { raw: _raw, ...cols } = r;
    res.json({
      ...cols,
      extras: {
        brand: raw.brand ?? null,
        model_number: raw.modelNumber ?? null,
        upc: raw.upc ?? null,
        tier: raw.tier ?? null,
        first_reported_at: raw.firstReportedAt ?? null,
        date_added: raw.dateAdded ?? null,
        locations,
      },
    });
  }),
);

communityDeals.get(
  '/community-deals',
  ...paid,
  rateLimit({ key: 'community', max: 60, windowMs: 60_000 }),
  route(async (req, res) => {
    const db = await getDb();
    const kind = req.query.kind === 'clearance' ? 'clearance' : 'penny';
    const limit = Math.min(Number(req.query.limit ?? 100) || 100, 200);

    // Clearance hearsay still clears the tiered floor at read time (belt and
    // suspenders with the ingest-time check); pennies are 100%-off by nature.
    const floor = kind === 'clearance' ? `AND ${tieredFloorSql('price', 'discount_pct')}` : '';

    const { rows } = await db.query<Record<string, unknown>>(
      `SELECT report_id, source, kind, sku, item_id, title, price, list_price,
              discount_pct, state, city, store_number, product_url, source_url,
              image_url, reported_at, fetched_at,
              -- Reported shelf count at the reported store (rebelsavings rows).
              NULLIF(raw->>'stock', '')::int AS stock_reported
         FROM community_reports
        WHERE kind = $1 ${floor}
        ORDER BY COALESCE(reported_at, fetched_at) DESC
        LIMIT $2`,
      [kind, limit],
    );

    res.json({ kind, count: rows.length, reports: rows });
  }),
);
