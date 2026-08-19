/**
 * Probe the on-demand stock lookup that would sit behind a "Find Stock" button.
 *
 *   npm run probe:stock                 (defaults: the 77%-off item, ZIP 78232)
 *   npm run probe:stock 324308361 75201 (any item, any ZIP)
 *
 * The question: given a product id and ANY zip, do we get nearby stores with a
 * real per-store quantity? If yes, coverage stops being a scanning problem —
 * deals show everywhere, stock resolves per click, and cost scales with user
 * actions instead of catalogue size.
 *
 * This actor is ASYNC. A first call returns { asyncId, status: 202|206 } and
 * you re-submit the asyncId to collect the result. 202 = not started,
 * 206 = in progress, and a full payload means it is done.
 *
 * Ground truth from the scrapyspider sweep on 2026-08-16:
 *   item 324308361 @ store 582 (Bitters Rd) = 8 on the shelf
 * Anything claiming 74 there is reporting network stock, which is the trap
 * that already caught Unwrangle.
 */

import 'dotenv/config';

const TOKEN = process.env.APIFY_TOKEN;
if (!TOKEN) {
  console.error('APIFY_TOKEN is not set in .env');
  process.exit(1);
}

const ACTOR = (process.env.STOCK_ACTOR_ID ?? 'maplerope44/home-depot-product-lookup').replace('/', '~');
const ITEM = process.argv[2] ?? '324308361';
const ZIP = process.argv[3] ?? '78232';

const ENDPOINT = `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${TOKEN}`;

async function call(input: Record<string, unknown>): Promise<any[]> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status} ${res.statusText}\n${body.slice(0, 400)}`);
  }
  return (await res.json()) as any[];
}

const pending = (r: any) => r && typeof r.asyncId === 'string' && (r.status === 202 || r.status === 206);

console.log(`${ACTOR.replace('~', '/')}\n  item ${ITEM} near ${ZIP}\n`);

// Only the two documented fields. Extra keys are what produced a bare 202
// before — `zip` and `productId` must not be sent alongside an asyncId.
let out = await call({ productId: ITEM, zip: ZIP });
let attempt = 0;

while (out.length === 1 && pending(out[0]) && attempt < 8) {
  const id = out[0].asyncId;
  attempt++;
  console.log(`  status ${out[0].status} — polling (${attempt}/8)…`);
  await new Promise((r) => setTimeout(r, 5000));
  out = await call({ asyncId: id });
}

if (out.length === 1 && pending(out[0])) {
  console.error(`\nstill ${out[0].status} after ${attempt} polls. Try again shortly.`);
  process.exit(1);
}

console.log(`\nreturned ${out.length} item(s)\n`);
console.log(JSON.stringify(out, null, 2).slice(0, 3500));

/* A quick read on the two things that decide whether this is usable. */
const flat = JSON.stringify(out);
console.log('\n--- quick read ---');
console.log(`  mentions store 582 / Bitters : ${/582|Bitters/i.test(flat)}`);
console.log(`  shelf qty 8 present          : ${/\b8\b/.test(flat)}`);
console.log(`  network qty 74 present       : ${/\b74\b/.test(flat)}  (74 = network, the wrong number)`);
console.log(`  clearance price 7.03 present : ${/7\.03/.test(flat)}`);
console.log(`  full retail 29.98 present    : ${/29\.98/.test(flat)}`);
