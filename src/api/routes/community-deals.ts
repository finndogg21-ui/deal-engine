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
import { tieredFloorSql, meetsTieredFloor } from '../../engine/deal-floor.js';
import { recordReport } from '../../engine/reputation.js';
import { estimateMargin, toMarketplace } from '../../resell/margin.js';

export const communityDeals = Router();

const paid = [requireAuth, requirePlan('consumer', 'reseller')];

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : null;
};

/** Only https links reach an href/img src. Never a javascript:/data: URL. */
function httpsOrNull(v: unknown): string | null {
  if (!v) return null;
  const raw = String(v).slice(0, 500);
  return /^https:\/\//i.test(raw) ? raw : null;
}

/* ---------------------------------------------------------------------------
 * POST /api/community-deals/report — a member's own Dollar General penny find.
 *
 * This is the ONLY sanctioned DG source. DG's penny price is register-only, so
 * there is nothing to scrape; the crowd IS the sensor. A report is one person's
 * confirmed shelf scan, written to community_reports as hearsay and always
 * labelled as such — never presented as verified stock. Sourcing rule (see
 * company/routines/dollar-general-reports.md): member scans, never leaked lists.
 * ------------------------------------------------------------------------- */
communityDeals.post(
  '/community-deals/report',
  ...paid,
  rateLimit({ key: 'community-report', max: 30, windowMs: 60_000 }),
  route(async (req, res) => {
    const b = (req.body ?? {}) as Record<string, unknown>;

    // Which retailers accept member reports, and the source tag each writes.
    // These are all retailers whose deep markdowns live only in the aisle — DG's
    // penny, TSC's red-tag clearance, and (v1) the big-box in-store clearances
    // Akamai walls us out of scraping at scale, so the spotter IS the sensor.
    // Every tag ends '-members' to mark it member-submitted, apart from ingested
    // crowd feeds. Defaults to DG for the original DG-only form.
    const REPORT_SOURCES: Record<string, string> = {
      dollargeneral: 'dg-members',
      tractorsupply: 'tsc-members',
      costco: 'costco-members',
      homedepot: 'hd-members',
      lowes: 'lowes-members',
      target: 'target-members',
      walmart: 'walmart-members',
      bestbuy: 'bestbuy-members',
    };
    const retailer = REPORT_SOURCES[String(b.retailer ?? 'dollargeneral')]
      ? String(b.retailer ?? 'dollargeneral')
      : null;
    if (!retailer) {
      return res.status(400).json({ error: 'That retailer does not take member reports.' });
    }
    const source = REPORT_SOURCES[retailer]!;

    const kind = b.kind === 'clearance' ? 'clearance' : 'penny';

    const title = String(b.title ?? '').trim();
    if (title.length < 3) return res.status(400).json({ error: 'What is it? A product name is required.' });

    // Store: a number, or at least the state, so a find is never location-less.
    const storeNumber = b.store_number ? String(b.store_number).replace(/\D/g, '').slice(0, 6) : null;
    const state = b.state ? String(b.state).trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) : null;
    const city = b.city ? String(b.city).trim().slice(0, 80) : null;
    if (!storeNumber && !state) {
      return res.status(400).json({ error: 'Which store? Give a store number, or at least the state.' });
    }

    const sku = b.sku ? String(b.sku).replace(/[^0-9]/g, '').slice(0, 20) : null;
    const productUrl = httpsOrNull(b.product_url);
    const imageUrl = httpsOrNull(b.image_url);

    let price: number | null;
    let listPrice = num(b.list_price);
    let discountPct: number | null;
    if (kind === 'penny') {
      // A penny is $0.01, ~100% off whatever it was. list_price is optional
      // context (so a margin can be shown), never required.
      price = 0.01;
      discountPct = 100;
    } else {
      price = num(b.price);
      if (price === null || listPrice === null || listPrice <= price) {
        return res.status(400).json({ error: 'For a clearance find, give both the price and what it was, with the price lower.' });
      }
      discountPct = Math.round(((listPrice - price) / listPrice) * 100);
      if (!meetsTieredFloor(price, discountPct)) {
        return res.status(400).json({ error: 'That discount is below the floor we publish — it would not clear as a deal.' });
      }
    }

    // v1 resale-margin inputs. resale_estimate is the SPOTTER'S OWN estimate of
    // what it flips for (no live comp — Keepa is stubbed); stored so the feed can
    // rank by profit, but always labelled an estimate, never a looked-up value.
    // aisle_bay is the shelf hint so the next person can walk straight to it.
    const resaleEstimate = num(b.resale_estimate ?? b.resale);
    const marketplace = toMarketplace(b.marketplace);
    const aisleBay = b.aisle_bay ? String(b.aisle_bay).trim().slice(0, 40) : null;

    const userId = req.user!.user_id;
    // One member's find of one SKU at one store is one report; re-reporting it
    // refreshes the row instead of stacking duplicates.
    const dedupeKey = `u${userId}:${retailer}:${sku ?? title.toLowerCase().slice(0, 40)}:${storeNumber ?? state}`;

    const conn = await getDb();
    const inserted = await conn.query<{ report_id: string }>(
      `INSERT INTO community_reports
         (source, kind, retailer, dedupe_key, sku, item_id, title, price, list_price,
          discount_pct, state, city, store_number, product_url, source_url, image_url,
          reported_at, fetched_at, raw)
       VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10,$11,$12,$13,NULL,$14,now(),now(),$15)
       ON CONFLICT (source, dedupe_key) DO UPDATE SET
         kind = EXCLUDED.kind, title = EXCLUDED.title, price = EXCLUDED.price,
         list_price = EXCLUDED.list_price, discount_pct = EXCLUDED.discount_pct,
         state = EXCLUDED.state, city = EXCLUDED.city, store_number = EXCLUDED.store_number,
         product_url = EXCLUDED.product_url, image_url = EXCLUDED.image_url,
         reported_at = now(), fetched_at = now()
       RETURNING report_id`,
      [
        source, kind, retailer, dedupeKey, sku, title, price, listPrice, discountPct,
        state, city, storeNumber, productUrl, imageUrl,
        JSON.stringify({ reported_by: userId, resale_estimate: resaleEstimate, marketplace, aisle_bay: aisleBay }),
      ],
    );

    // Credit the reporter — this is exactly the reciprocity the reputation
    // system rewards, the same recordReport a verified find calls.
    await recordReport(conn, userId);

    res.status(201).json({ report_id: String(inserted.rows[0]!.report_id) });
  }),
);

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
      `SELECT report_id, source, kind, retailer, sku, item_id, title, price, list_price,
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

    // Optional retailer scope. Slugs arrive dashless ('dollargeneral') to match
    // the stored column; a dashed slug is normalised so the client can pass
    // either form.
    const retailerParam = req.query.retailer ? String(req.query.retailer).replace(/-/g, '') : null;
    const retailerFilter = retailerParam ? 'AND retailer = $3' : '';

    // v1: rank clearance finds by estimated resale margin, not just recency.
    // Gross margin (resale estimate − price) orders the same way net margin does
    // and is expressible in SQL, so LIMIT stays correct; the exact net margin
    // (after marketplace fees) is computed per row below for display.
    const sort = req.query.sort === 'margin' && kind === 'clearance' ? 'margin' : 'recent';
    const orderBy = sort === 'margin'
      ? `ORDER BY (NULLIF(raw->>'resale_estimate','')::numeric - price) DESC NULLS LAST,
                  COALESCE(reported_at, fetched_at) DESC`
      : `ORDER BY COALESCE(reported_at, fetched_at) DESC`;

    const params: unknown[] = [kind, limit];
    if (retailerParam) params.push(retailerParam);

    const { rows } = await db.query<Record<string, unknown>>(
      `SELECT report_id, source, kind, retailer, sku, item_id, title, price, list_price,
              discount_pct, state, city, store_number, product_url, source_url,
              image_url, reported_at, fetched_at,
              -- Reported shelf count at the reported store (rebelsavings rows).
              NULLIF(raw->>'stock', '')::int AS stock_reported,
              -- v1 resale-margin inputs (spotter-submitted, stored in raw).
              NULLIF(raw->>'resale_estimate','')::numeric AS resale_estimate,
              raw->>'aisle_bay' AS aisle_bay,
              raw->>'marketplace' AS marketplace
         FROM community_reports
        WHERE kind = $1 ${floor} ${retailerFilter}
        ${orderBy}
        LIMIT $2`,
      params,
    );

    // Attach the exact estimated margin (after marketplace fees) at read time —
    // derived, never stored, and always an ESTIMATE the client must label as one.
    const reports = rows.map((r) => {
      const cost = r.price != null ? Number(r.price) : NaN;
      const resale = r.resale_estimate != null ? Number(r.resale_estimate) : NaN;
      if (!Number.isFinite(cost) || !Number.isFinite(resale)) {
        return { ...r, est_margin: null, est_roi: null, est_net_proceeds: null };
      }
      const m = estimateMargin({ cost, resale, marketplace: toMarketplace(r.marketplace) });
      return { ...r, est_margin: m.margin, est_roi: m.roi, est_net_proceeds: m.netProceeds };
    });

    res.json({ kind, sort, count: reports.length, reports });
  }),
);
