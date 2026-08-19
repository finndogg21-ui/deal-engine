/**
 * Finishes queued stock lookups in the background.
 *
 * Runs inside the API process on a timer. That is the right size for this:
 * the work is a handful of HTTP calls a minute, and a separate worker process
 * would be more moving parts than the job deserves. If throughput ever needs
 * more than one process, this same loop runs standalone unchanged — it holds
 * no state beyond the database.
 *
 * Every job is one row in `stock_lookups` with status='pending' and an
 * async_id. The worker asks the vendor whether each is done and writes the
 * answer. Nothing is lost on restart, because the queue IS the table.
 */

import { getDb } from '../db/client.js';
import { collect, asyncLookupReady } from '../vendors/store-lookup-async.js';

const TICK_MS = Number(process.env.STOCK_WORKER_MS ?? 3000);
/** Give up rather than poll a stuck job forever. ~25 ticks at 3s = 75s. */
const MAX_ATTEMPTS = Number(process.env.STOCK_MAX_ATTEMPTS ?? 25);
const BATCH = 8;

let running = false;

async function tick(): Promise<void> {
  if (running || !asyncLookupReady()) return;
  running = true;
  try {
    const db = await getDb();
    const { rows } = await db.query<{ lookup_id: string; async_id: string; attempts: number }>(
      `SELECT lookup_id, async_id, attempts
         FROM stock_lookups
        WHERE status = 'pending' AND async_id IS NOT NULL
        ORDER BY queued_at
        LIMIT $1`,
      [BATCH],
    );

    for (const job of rows) {
      // Count the attempt first, so a job that throws every time still ages
      // out instead of being retried forever.
      await db.query(
        `UPDATE stock_lookups SET attempts = attempts + 1 WHERE lookup_id = $1`,
        [job.lookup_id],
      );

      if (job.attempts + 1 > MAX_ATTEMPTS) {
        await db.query(
          `UPDATE stock_lookups
              SET status = 'vendor_error',
                  error = 'Gave up waiting for the lookup service.'
            WHERE lookup_id = $1`,
          [job.lookup_id],
        );
        continue;
      }

      try {
        const r = await collect(job.async_id);
        if (r.state === 'pending') continue;

        if (r.state === 'done') {
          await db.query(
            `UPDATE stock_lookups
                SET status = $2, stores = $3, fetched_at = now()
              WHERE lookup_id = $1`,
            [job.lookup_id, r.stores.length > 0 ? 'ok' : 'empty', JSON.stringify(r.stores)],
          );
        } else {
          await db.query(
            `UPDATE stock_lookups
                SET status = 'vendor_error', error = $2,
                    -- A rate-limit rejection is our traffic problem, not the
                    -- user's; it must not consume their daily allowance.
                    billed = CASE WHEN $3::int = 429 THEN false ELSE billed END
              WHERE lookup_id = $1`,
            [job.lookup_id, r.message, r.vendorStatus ?? 0],
          );
        }
      } catch (err) {
        console.error(`stock worker: job ${job.lookup_id}`, (err as Error).message);
      }
    }
  } catch (err) {
    console.error('stock worker tick failed', (err as Error).message);
  } finally {
    running = false;
  }
}

export function startStockWorker(): void {
  if (!asyncLookupReady()) {
    console.log('stock worker idle — APIFY_TOKEN not set');
    return;
  }
  setInterval(() => { void tick(); }, TICK_MS).unref();
  console.log(`stock worker running every ${TICK_MS}ms`);
}
