/**
 * ===========================================================
 *  LLM CATEGORY MAPPER GOES HERE
 * ===========================================================
 *
 * The last resort in term resolution: a shopper types "blender" and the
 * catalog has never carried that word in a category name, so something has to
 * decide which retailer categories the word means.
 *
 * This runs at most ONCE per unseen term, ever. The answer is cached in
 * `term_categories` forever, so cost is bounded by vocabulary size, not by
 * traffic. If this ever shows up as a per-request cost, the cache is broken.
 *
 * To wire:
 *   1. ANTHROPIC_API_KEY in .env
 *   2. Send the term plus the live category list from `products`
 *   3. Constrain the answer to categories that actually exist — a category
 *      the catalog has never seen matches nothing and looks like a silent bug
 *
 * Docs: https://docs.claude.com/en/api/messages
 */

import { notWired, isWired } from './contracts.js';

const ENV = 'ANTHROPIC_API_KEY';

export const llmReady = () => isWired(ENV);

export interface TermMapping {
  categoryIds: string[];
  confidence: number;
}

/**
 * Map a shopper's word onto retailer categories.
 *
 * @param term       lowercased, trimmed search word
 * @param catalog    every category currently present in `products`
 */
export async function mapTermToCategories(
  _term: string,
  _catalog: string[],
): Promise<TermMapping> {
  if (!llmReady()) notWired('llm', ENV);

  // ---- LLM CATEGORY MAPPER IMPLEMENTATION GOES HERE ----
  // Ask for strict JSON, and reject any category not present in `catalog`:
  //
  //   const res = await fetch('https://api.anthropic.com/v1/messages', {
  //     method: 'POST',
  //     headers: {
  //       'x-api-key': process.env.ANTHROPIC_API_KEY!,
  //       'anthropic-version': '2023-06-01',
  //       'content-type': 'application/json',
  //     },
  //     body: JSON.stringify({
  //       model: 'claude-haiku-4-5-20251001',
  //       max_tokens: 256,
  //       messages: [{ role: 'user', content: prompt(term, catalog) }],
  //     }),
  //   });
  //
  // Then: categoryIds.filter(c => catalog.includes(c))
  notWired('llm', ENV);
}
