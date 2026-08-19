/**
 * The daily sweep. The one job that must never silently stop.
 *
 *   npm run scan              real run against the configured source
 *   npm run scan -- --dry     fetch and report, write nothing
 *
 * Design rules, all of them learned from how this kind of job fails:
 *
 *   1. `price_observations` is APPEND-ONLY. A scan never updates or deletes an
 *      observation. Getting yesterday's number wrong is recoverable; losing it
 *      is not, because the history cannot be backfilled from anywhere.
 *
 *   2. Every run writes a `scan_runs` row, including runs that crash. A run
 *      that leaves no trace is indistinguishable from a run that never
 *      started, which is exactly the failure that costs the moat.
 *
 *   3. A zero-row run is a FAILURE, not an empty day. Retailers do not stop
 *      having clearance. Zero rows means the adapter broke or we got blocked.
 *
 *   4. Partial failure still writes what it got. One bad ZIP must not discard
 *      four good ones.
 */

import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { getDb, type Db } from '../db/client.js';
import type { DealEvent } from '../vendors/contracts.js';
import { fetchDeals, apifyReady } from '../vendors/apify.js';

const DRY = process.argv.includes('--dry');

/** ZIPs to sweep. Comma-separated in .env, because this is the cost dial. */
function zips(): string[] {
  const raw = process.env.SCAN_ZIPS ?? '';
  const list = raw.split(',').map((z) => z.trim()).filter((z) => /^\d{5}$/.test(z));
  if (list.length === 0) {
    throw new Error(
      'SCAN_ZIPS is empty or invalid. Set it in .env, e.g. SCAN_ZIPS=78232,78216,78258',
    );
  }
  return list;
}

/**
 * Below this, treat the run as broken rather than quiet. Tuned against the
 * trailing average once there is one; until then any zero is suspicious.
 */
const MIN_PLAUSIBLE_ROWS = Number(process.env.SCAN_MIN_ROWS ?? 1);

/**
 * Reject demo/placeholder payloads before they reach the database.
 *
 * This is not hypothetical. On 2026-08-16 a paid Apify actor
 * (pulsewatch/dealwatch-scraper) returned rows titled "SCREWDRIVER - Sample
 * Product" with SKU "SAMPLE-SCREWDRIVER", identical prices across every item,
 * and search URLs instead of product URLs — while reporting a successful run.
 *
 * `price_observations` is append-only and is the whole moat. Fabricated rows
 * carrying a real timestamp are indistinguishable from good history after the
 * fact, so they have to be caught here, at the door.
 */
export function looksFabricated(events: DealEvent[]): string | null {
  if (events.length === 0) return null;

  const sampleish = events.filter((e) =>
    /\bsample\b|\bdemo\b|\btest\b|\bplaceholder\b|\bexample\b/i.test(`${e.sku} ${e.title}`),
  );
  if (sampleish.length > 0) {
    return `${sampleish.length}/${events.length} events look like sample data ` +
      `(e.g. sku "${sampleish[0]!.sku}", title "${sampleish[0]!.title}")`;
  }

  // Real clearance never has one identical price across a whole batch.
  if (events.length >= 3) {
    const prices = new Set(events.map((e) => `${e.price}|${e.listPrice}`));
    if (prices.size === 1) {
      return `all ${events.length} events share the identical price ` +
        `${events[0]!.price}/${events[0]!.listPrice} — placeholder data`;
    }
  }

  // A source that never returns a product URL never reached a product page.
  const withProductUrl = events.filter((e) => e.productUrl && !/\/s\//.test(e.productUrl));
  if (withProductUrl.length === 0) {
    return 'no event carries a real product URL — the source returned search pages, not products';
  }

  return null;
}

async function upsertStore(db: Db, e: DealEvent): Promise<string | null> {
  if (!e.storeNumber) return null;
  const storeId = `${e.retailer}:${e.storeNumber}`;
  await db.query(
    `INSERT INTO stores (store_id, retailer, store_number, name, zip, lat, lng)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (store_id) DO UPDATE SET
       name = COALESCE(EXCLUDED.name, stores.name),
       zip  = COALESCE(EXCLUDED.zip,  stores.zip),
       lat  = COALESCE(EXCLUDED.lat,  stores.lat),
       lng  = COALESCE(EXCLUDED.lng,  stores.lng)`,
    [storeId, e.retailer, e.storeNumber, e.storeName ?? null, e.zip ?? null, e.lat ?? null, e.lng ?? null],
  );
  return storeId;
}

async function upsertProduct(db: Db, e: DealEvent): Promise<string> {
  const productId = `${e.retailer}:${e.sku}`;
  await db.query(
    `INSERT INTO products (product_id, retailer, sku, item_id, upc, title, brand, category, image_url, product_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (product_id) DO UPDATE SET
       item_id   = COALESCE(products.item_id, EXCLUDED.item_id),
       title     = COALESCE(EXCLUDED.title,     products.title),
       category  = COALESCE(EXCLUDED.category,  products.category),
       image_url = COALESCE(EXCLUDED.image_url, products.image_url),
       -- first_seen is never touched: it is the age of our knowledge of this
       -- SKU, and overwriting it would erase that.
       product_url = COALESCE(EXCLUDED.product_url, products.product_url)`,
    [
      productId, e.retailer, e.sku, e.itemId ?? null, e.upc ?? null, e.title ?? null,
      e.brand ?? null, e.category ?? null, e.imageUrl ?? null, e.productUrl ?? null,
    ],
  );
  return productId;
}

/** Writes one observation. Append only — no ON CONFLICT, no update path. */
async function writeObservation(
  db: Db, productId: string, storeId: string | null, e: DealEvent, runId: string, source: string,
) {
  await db.query(
    `INSERT INTO price_observations
       (product_id, store_id, observed_at, price, list_price, discount_pct,
        stock_qty, availability, aisle_bay, source, run_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      productId, storeId, e.observedAt, e.price, e.listPrice, e.discountPct,
      e.stockQty, e.availability, e.aisleBay ?? null, source, runId,
    ],
  );
}

export async function runScan(): Promise<{ runId: string; rows: number; status: string }> {
  const db = await getDb();
  const runId = randomUUID();
  const source = 'apify:dealwatch';
  const targetZips = zips();
  const startedAt = new Date();

  // Heartbeat opens BEFORE any vendor call, so a crash mid-fetch still leaves
  // a visible 'running' row that the admin page flags as stale.
  if (!DRY) {
    await db.query(
      `INSERT INTO scan_runs (run_id, source, started_at, status, zips)
       VALUES ($1,$2,$3,'running',$4)`,
      [runId, source, startedAt, targetZips.join(',')],
    );
  }

  let events: DealEvent[] = [];
  let fetchError: string | null = null;

  try {
    if (!apifyReady()) {
      throw new Error(
        'APIFY_TOKEN is not set. The scan cannot run without a data source. ' +
        'See src/vendors/apify.ts.',
      );
    }
    events = await fetchDeals({ zips: targetZips });
  } catch (err) {
    fetchError = (err as Error).message;
  }

  // Quarantine before any write. A poisoned append-only table cannot be undone.
  const fabricated = fetchError ? null : looksFabricated(events);
  if (fabricated) {
    fetchError = `REFUSED TO WRITE — ${fabricated}. Nothing was saved.`;
    events = [];
  }

  let rows = 0;
  const failures: string[] = [];

  if (!DRY && events.length > 0) {
    for (const e of events) {
      try {
        // Each event is its own transaction. One malformed record must not
        // roll back a whole day of good observations.
        await db.tx(async (tx) => {
          const storeId = await upsertStore(tx, e);
          const productId = await upsertProduct(tx, e);
          await writeObservation(tx, productId, storeId, e, runId, source);
        });
        rows++;
      } catch (err) {
        failures.push(`${e.retailer}:${e.sku} — ${(err as Error).message}`);
      }
    }
  }

  // A scan that returns nothing is broken until proven otherwise.
  const canaryOk = events.length >= MIN_PLAUSIBLE_ROWS;
  const status = fetchError
    ? 'failed'
    : !canaryOk
      ? 'failed'
      : failures.length > 0
        ? 'partial'
        : 'ok';

  const errorText = fetchError
    ?? (!canaryOk ? `only ${events.length} events returned, expected at least ${MIN_PLAUSIBLE_ROWS}` : null)
    ?? (failures.length > 0 ? `${failures.length} rows failed: ${failures.slice(0, 3).join(' | ')}` : null);

  if (!DRY) {
    await db.query(
      `UPDATE scan_runs
          SET finished_at = now(), status = $2, rows_written = $3, canary_ok = $4, error = $5
        WHERE run_id = $1`,
      [runId, status, rows, canaryOk, errorText],
    );
  }

  console.log(
    `${DRY ? '[dry] ' : ''}scan ${status}: ${events.length} events, ${rows} rows written, ` +
    `${targetZips.length} ZIPs${errorText ? `\n  ${errorText}` : ''}`,
  );

  return { runId, rows, status };
}

import { pathToFileURL } from 'node:url';

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  runScan()
    .then(async (r) => {
      const db = await getDb();
      await db.close();
      // Non-zero exit so cron/systemd and any monitor treat a bad scan as a
      // failure rather than a successful no-op.
      if (r.status === 'failed') process.exit(1);
    })
    .catch(async (err) => {
      console.error('scan crashed:', err);
      process.exit(1);
    });
}
