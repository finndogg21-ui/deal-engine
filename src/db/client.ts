/**
 * Database adapter.
 *
 * Local dev runs PGlite — real Postgres compiled to WASM, file-backed, no
 * install and no account. PGlite is alpha and offers no durability warranty,
 * which is fine while the data is seed/fixture and reproducible.
 *
 * The day the first real Apify scan runs, that stops being true: every
 * observation becomes irreplaceable. Set DB_DRIVER=postgres and DATABASE_URL
 * to a Neon connection string. Nothing else changes — the SQL is identical
 * because PGlite *is* Postgres.
 */

import 'dotenv/config';

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  /**
   * Runs a multi-statement SQL script with no parameters (migrations only).
   * PGlite's query() speaks the extended protocol and takes one statement at
   * a time; exec() speaks the simple protocol and takes a whole script.
   *
   * NEVER pass user input here — it cannot bind parameters, so anything
   * interpolated into the string is executed as SQL. Migration files read
   * from disk only. All runtime queries go through query() with params.
   */
  exec(sql: string): Promise<void>;
  /** Runs fn inside a transaction, rolling back on throw. */
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  driver: 'pglite' | 'postgres';
}

const driver = (process.env.DB_DRIVER ?? 'pglite') as 'pglite' | 'postgres';

async function createPglite(): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  const { mkdir } = await import('node:fs/promises');
  const { dirname, resolve } = await import('node:path');

  const path = resolve(process.env.PGLITE_PATH ?? './.data/deal-engine');
  // PGlite's node filesystem layer calls a non-recursive mkdir, so the parent
  // has to exist before it starts.
  await mkdir(dirname(path), { recursive: true });

  const pg = new PGlite(path);
  await pg.waitReady;

  const wrap = (): Db => ({
    driver: 'pglite',
    async query<T>(sql: string, params: unknown[] = []) {
      const res = await pg.query<T>(sql, params as never[]);
      // affectedRows is what INSERT/UPDATE/DELETE report; rows.length only
      // covers SELECT. Using rows.length for a DELETE always reads as zero.
      return {
        rows: res.rows as T[],
        rowCount: res.affectedRows ?? res.rows.length,
      };
    },
    async exec(sql: string) {
      await pg.exec(sql);
    },
    async tx<T>(fn: (db: Db) => Promise<T>) {
      // PGlite is single-connection, so a plain BEGIN/COMMIT is the whole story.
      await pg.query('BEGIN');
      try {
        const out = await fn(wrap());
        await pg.query('COMMIT');
        return out;
      } catch (err) {
        await pg.query('ROLLBACK');
        throw err;
      }
    },
    async close() {
      await pg.close();
    },
  });

  return wrap();
}

async function createPostgres(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DB_DRIVER=postgres but DATABASE_URL is empty. Set it to your Neon connection string.',
    );
  }
  const pgMod = await import('pg');
  const pool = new pgMod.default.Pool({ connectionString: url, max: 10 });

  const wrapPool = (): Db => ({
    driver: 'postgres',
    async query<T>(sql: string, params: unknown[] = []) {
      const res = await pool.query(sql, params);
      return { rows: res.rows as T[], rowCount: res.rowCount ?? res.rows.length };
    },
    async exec(sql: string) {
      // node-postgres runs a multi-statement string fine when no params are bound.
      await pool.query(sql);
    },
    async tx<T>(fn: (db: Db) => Promise<T>) {
      const client = await pool.connect();
      const scoped: Db = {
        driver: 'postgres',
        async query<U>(sql: string, params: unknown[] = []) {
          const res = await client.query(sql, params);
          return { rows: res.rows as U[], rowCount: res.rowCount ?? res.rows.length };
        },
        async exec(sql: string) {
          await client.query(sql);
        },
        tx: () => {
          throw new Error('Nested transactions are not supported.');
        },
        close: async () => {},
      };
      try {
        await client.query('BEGIN');
        const out = await fn(scoped);
        await client.query('COMMIT');
        return out;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  });

  return wrapPool();
}

let singleton: Promise<Db> | null = null;

export function getDb(): Promise<Db> {
  if (!singleton) {
    singleton = driver === 'postgres' ? createPostgres() : createPglite();
  }
  return singleton;
}

/** The single operator, until there are real users. Every query still takes
 *  user_id as a parameter so user scoping is never retrofitted — that is the
 *  bug class that leaks one customer's inventory to another. */
export const OPERATOR_USER_ID = Number(process.env.OPERATOR_USER_ID ?? 1);
