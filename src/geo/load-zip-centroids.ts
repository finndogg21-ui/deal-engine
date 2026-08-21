/**
 * Loads data/zip_centroids.csv (US Census 2024 ZCTA Gazetteer, public domain)
 * into the zip_centroids table, so the nearby resolver can place ANY US ZIP.
 *
 * Idempotent: skips the work if the table already looks loaded, and every row
 * is ON CONFLICT DO NOTHING, so re-running migrate is cheap and safe.
 *
 * Path is resolved relative to this module (not cwd) so it works from a local
 * run and from the Docker image alike, as long as data/ ships with the code.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Db } from '../db/client.js';

const here = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(here, '..', '..', 'data', 'zip_centroids.csv');

const BATCH = 1000;

export async function loadZipCentroids(db: Db, csvPath = CSV_PATH): Promise<number> {
  // ~33k ZCTAs; if most are already present, this is a no-op.
  const have = await db.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM zip_centroids`);
  const already = Number(have.rows[0]?.n ?? 0);
  if (already >= 30000) return already;

  const text = await readFile(csvPath, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.shift(); // drop "zip,lat,lng" header

  let batch: Array<[string, number, number]> = [];
  let total = 0;

  const flush = async () => {
    if (batch.length === 0) return;
    const values: string[] = [];
    const params: Array<string | number> = [];
    batch.forEach((row, i) => {
      const b = i * 3;
      values.push(`($${b + 1}, $${b + 2}, $${b + 3})`);
      params.push(row[0], row[1], row[2]);
    });
    await db.query(
      `INSERT INTO zip_centroids (zip, lat, lng) VALUES ${values.join(',')}
       ON CONFLICT (zip) DO NOTHING`,
      params,
    );
    total += batch.length;
    batch = [];
  };

  for (const line of lines) {
    if (!line) continue;
    const parts = line.split(',');
    const zip = parts[0];
    const lat = Number(parts[1]);
    const lng = Number(parts[2]);
    if (!zip || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    batch.push([zip, lat, lng]);
    if (batch.length >= BATCH) await flush();
  }
  await flush();
  return total;
}
