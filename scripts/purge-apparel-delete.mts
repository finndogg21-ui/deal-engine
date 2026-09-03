/**
 * EXECUTE the Target apparel cut — deletes the exact discovery_ids captured by
 * scripts/purge-apparel-preview.mts (scripts/out/target-apparel-delete-set.json).
 *
 * Keys on precise ids (not the regex) so what is deleted === what was previewed.
 * Guarded to retailer='target' + status='published' so a stale file cannot
 * remove anything unexpected. Runs in a transaction; bounded timeout + retry.
 *
 *   cd deal-engine && npx tsx scripts/purge-apparel-delete.mts --yes
 */
import 'dotenv/config';
import pg from 'pg';
import { readFileSync } from 'node:fs';

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try { return await fn(); }
  catch (e) {
    console.error(`[retry] ${label} failed once (${(e as Error).message}); retrying in 1.5s…`);
    await new Promise((r) => setTimeout(r, 1500));
    return await fn();
  }
}

async function main() {
  if (!process.argv.includes('--yes')) {
    console.error('refusing to delete without --yes. Run: npx tsx scripts/purge-apparel-delete.mts --yes');
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is empty — set it in deal-engine/.env');

  const setPath = new URL('./out/target-apparel-delete-set.json', import.meta.url);
  const set = JSON.parse(readFileSync(setPath, 'utf8')) as { delete_ids: number[] };
  const ids = set.delete_ids ?? [];
  if (!ids.length) throw new Error('delete set is empty — re-run the preview first');
  console.log(`loaded ${ids.length} discovery_ids from target-apparel-delete-set.json`);

  const pool = new pg.Pool({
    connectionString: url, max: 3,
    connectionTimeoutMillis: 8000, idleTimeoutMillis: 5000,
    query_timeout: 30000, statement_timeout: 30000,
  });

  const deleted = await withRetry('DELETE apparel', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query(
        `DELETE FROM discovery
          WHERE discovery_id = ANY($1::bigint[])
            AND retailer = 'target'
            AND status = 'published'`,
        [ids],
      );
      await client.query('COMMIT');
      return res.rowCount ?? 0;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });

  console.log(`DELETED ${deleted} rows (expected ${ids.length}).`);
  if (deleted !== ids.length) console.warn('⚠ count mismatch — some ids were already gone or no longer published target rows.');

  const { rows } = await pool.query<{ n: string }>(
    `SELECT count(*) n FROM discovery WHERE retailer='target' AND status='published'`);
  console.log(`Target published feed now: ${rows[0].n} rows.`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
