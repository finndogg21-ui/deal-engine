/**
 * Blueprint C — term to category mapping.
 *
 * Matching a watchlist on titles is what makes a deal app feel broken:
 * "blender" returns blender bottles and a 3D-software book, and the one
 * Ninja on clearance never fires. Categories contain every brand by
 * definition, so a term resolves to categories once and matching runs on
 * those forever after.
 *
 * Resolution order, cheapest first:
 *   1. cache      — `term_categories`, exact hit, zero cost
 *   2. catalog    — what the retailer's own category names already say
 *   3. LLM        — one call, once per term, then cached forever
 *
 * A term that resolves to nothing is deliberately NOT cached. The catalog
 * grows every scan, and a "no categories" row written on day one would
 * silently keep that watchlist dead after the category appears.
 */

import type { Db } from '../db/client.js';
import { llmReady, mapTermToCategories } from '../vendors/llm.js';

export interface ResolvedTerm {
  term: string;
  categoryIds: string[];
  source: 'catalog' | 'llm' | 'manual' | 'cache';
  confidence: number;
}

/** Lowercase, collapse whitespace, strip surrounding punctuation. */
export function normalizeTerm(raw: string): string {
  return String(raw ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s&'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

/** "blenders" -> "blender". Crude on purpose; it only widens the net. */
function singular(term: string): string | null {
  if (term.endsWith('ies') && term.length > 4) return `${term.slice(0, -3)}y`;
  if (term.endsWith('es') && term.length > 3) return term.slice(0, -2);
  if (term.endsWith('s') && !term.endsWith('ss') && term.length > 3) return term.slice(0, -1);
  return null;
}

/**
 * What the catalog itself says. Counts how many products in each category
 * mention the term, then keeps the categories carrying real weight.
 */
async function fromCatalog(db: Db, term: string): Promise<ResolvedTerm | null> {
  const variants = [term, singular(term)].filter(Boolean) as string[];

  for (const v of variants) {
    const { rows } = await db.query<{ category: string; n: number }>(
      `SELECT category, COUNT(*)::int AS n
         FROM products
        WHERE category IS NOT NULL
          AND (category ILIKE $1 OR title ILIKE $1)
        GROUP BY category
        ORDER BY n DESC
        LIMIT 8`,
      [`%${v}%`],
    );
    if (rows.length === 0) continue;

    const total = rows.reduce((sum, r) => sum + Number(r.n), 0);
    // Drop the long tail: a category holding under a tenth of the hits is
    // usually one mis-titled product, and including it is how "blender"
    // starts alerting on books again.
    const kept = rows.filter((r) => Number(r.n) / total >= 0.1);
    if (kept.length === 0) continue;

    const covered = kept.reduce((sum, r) => sum + Number(r.n), 0);
    return {
      term,
      categoryIds: kept.map((r) => r.category),
      source: 'catalog',
      confidence: Math.round((covered / total) * 100) / 100,
    };
  }
  return null;
}

/** Every category the catalog currently knows, for constraining the LLM. */
async function catalogCategories(db: Db): Promise<string[]> {
  const { rows } = await db.query<{ category: string }>(
    `SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category`,
  );
  return rows.map((r) => r.category);
}

/**
 * Resolve a term, using and filling the cache.
 *
 * @param allowLlm  false on hot paths (the matcher) so a scan can never stall
 *                  on a vendor call. The watchlist form passes true.
 */
export async function resolveTerm(
  db: Db,
  rawTerm: string,
  allowLlm = false,
): Promise<ResolvedTerm> {
  const term = normalizeTerm(rawTerm);
  if (!term) return { term, categoryIds: [], source: 'catalog', confidence: 0 };

  const cached = await db.query<{ category_ids: string[]; source: string; confidence: number }>(
    `SELECT category_ids, source, confidence FROM term_categories WHERE term = $1`,
    [term],
  );
  if (cached.rows[0]) {
    return {
      term,
      categoryIds: cached.rows[0].category_ids ?? [],
      source: 'cache',
      confidence: Number(cached.rows[0].confidence ?? 0),
    };
  }

  let resolved = await fromCatalog(db, term);

  if (!resolved && allowLlm && llmReady()) {
    const catalog = await catalogCategories(db);
    const mapping = await mapTermToCategories(term, catalog);
    // Trust nothing the model invents: a category the catalog has never seen
    // matches zero products and looks exactly like a silent bug.
    const valid = mapping.categoryIds.filter((c) => catalog.includes(c));
    if (valid.length > 0) {
      resolved = { term, categoryIds: valid, source: 'llm', confidence: mapping.confidence };
    }
  }

  if (!resolved) return { term, categoryIds: [], source: 'catalog', confidence: 0 };

  await db.query(
    `INSERT INTO term_categories (term, category_ids, source, confidence)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (term) DO UPDATE
       SET category_ids = EXCLUDED.category_ids,
           source       = EXCLUDED.source,
           confidence   = EXCLUDED.confidence,
           resolved_at  = now()`,
    [resolved.term, resolved.categoryIds, resolved.source, resolved.confidence],
  );

  return resolved;
}

/** Operator override, and the escape hatch when the catalog is wrong. */
export async function setTermMapping(db: Db, rawTerm: string, categoryIds: string[]) {
  const term = normalizeTerm(rawTerm);
  await db.query(
    `INSERT INTO term_categories (term, category_ids, source, confidence)
     VALUES ($1,$2,'manual',1.0)
     ON CONFLICT (term) DO UPDATE
       SET category_ids = EXCLUDED.category_ids,
           source = 'manual', confidence = 1.0, resolved_at = now()`,
    [term, categoryIds],
  );
}
