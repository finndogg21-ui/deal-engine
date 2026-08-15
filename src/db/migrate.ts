/**
 * Applies schema.sql. Idempotent — run it as often as you like.
 *
 *   npm run migrate
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getDb } from './client.js';

const here = dirname(fileURLToPath(import.meta.url));

async function main() {
  const db = await getDb();
  const sql = await readFile(join(here, 'schema.sql'), 'utf8');

  await db.exec(sql);

  const { rows } = await db.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name`,
  );

  console.log(`migrated via ${db.driver}`);
  console.log(`tables: ${rows.map((r) => r.table_name).join(', ')}`);
  await db.close();
}

main().catch((err) => {
  console.error('migration failed:', err);
  process.exit(1);
});
