/**
 * Applies schema.sql. Idempotent — run it as often as you like.
 *
 *   npm run migrate
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getDb } from './client.js';
import { loadZipCentroids } from '../geo/load-zip-centroids.js';

const here = dirname(fileURLToPath(import.meta.url));

async function main() {
  const db = await getDb();
  const sql = await readFile(join(here, 'schema.sql'), 'utf8');

  await db.exec(sql);

  // Load the US ZIP centroid table (idempotent) so nearby resolves any ZIP.
  const zips = await loadZipCentroids(db);
  console.log(`zip_centroids ready (${zips} rows)`);

  // Founder promotion, idempotent — and the ONLY place promotion happens.
  // Signup deliberately does not promote: with no email verification, a
  // signup-time grant would hand the operator role to whoever registers the
  // founder's (public) address first. Sequence instead: the founder signs up
  // personally (credentials never touch tooling), THEN the operator runs
  // migrate with OPERATOR_EMAIL set, promoting the account they now own.
  const operatorEmail = (process.env.OPERATOR_EMAIL ?? '').trim().toLowerCase();
  if (operatorEmail) {
    const { rowCount } = await db.query(
      `UPDATE users SET role = 'operator', plan = 'reseller'
        WHERE lower(email) = $1 AND (role <> 'operator' OR plan <> 'reseller')`,
      [operatorEmail],
    );
    if (rowCount > 0) console.log(`promoted ${operatorEmail} to operator/reseller`);
  }

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
