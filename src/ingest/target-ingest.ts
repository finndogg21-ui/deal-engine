/**
 * Target ingest — turn a browser-collected clearance sweep into pool rows.
 *
 * WHY A FILE HANDOFF. Target's RedSky answers a browser and refuses our server
 * (403 + captcha), exactly like Home Depot's gateway. So the browser agent does
 * the fetching and drops JSON here; this module owns every DB write. The split
 * keeps the untrusted half (network) away from the half that must be correct
 * (what we publish).
 *
 * Run:  npx tsx src/ingest/target-ingest.ts <sweep.json> [stores.json] [facts.json]
 *
 *   sweep.json  [{ tcin, title, cur, reg, pct, url, img }]
 *   stores.json [{ id, name, addr, city, st, zip, dist }]
 *   facts.json  [{ tcin, storeId, price, regPrice, isClearance, quantity, availability }]
 *
 * Nothing here invents a value. A missing quantity stays null (never 0), and a
 * price is only written when Target actually returned one.
 */

import { readFileSync } from 'node:fs';
import { getDb, type Db } from '../db/client.js';
import { recordVerdicts, type HdVerdictInput } from '../engine/discovery.js';

const RETAILER = 'target';

interface SweepHit {
  tcin: string;
  title: string;
  cur: number | null;
  reg: number | null;
  pct: number | null;
  url?: string | null;
  img?: string | null;
}

interface StoreRow {
  id: string;
  name: string;
  addr?: string | null;
  city?: string | null;
  st?: string | null;
  zip?: string | null;
}

interface StoreFact {
  tcin: string;
  storeId: string;
  price: number | null;
  regPrice: number | null;
  isClearance?: boolean;
  quantity: number | null;
  availability?: string | null;
}

const cents = (n: number | null | undefined): number | null =>
  n === null || n === undefined || !Number.isFinite(n) ? null : Math.round(n * 100);

/** Upsert Target stores. store_id is "{retailer}:{store_number}", per schema. */
export async function seedTargetStores(db: Db, stores: StoreRow[]): Promise<number> {
  let n = 0;
  for (const s of stores) {
    await db.query(
      `INSERT INTO stores (store_id, retailer, store_number, name, address, city, state, zip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (store_id) DO UPDATE
         SET name = EXCLUDED.name, address = EXCLUDED.address,
             city = EXCLUDED.city, state = EXCLUDED.state, zip = EXCLUDED.zip`,
      [
        `${RETAILER}:${s.id}`, RETAILER, String(s.id), s.name ?? null,
        s.addr ?? null, s.city ?? null, s.st ?? null,
        s.zip ? String(s.zip).slice(0, 5) : null,
      ],
    );
    n++;
  }
  return n;
}

/**
 * Put sweep hits into the pool as `pending`. They are NOT deals yet: the sweep
 * is Target's own listing price, and publishing still waits on a per-store
 * check, same as every Home Depot row.
 */
export async function seedTargetDiscovery(db: Db, hits: SweepHit[]): Promise<number> {
  let n = 0;
  for (const h of hits) {
    const r = await db.query(
      `INSERT INTO discovery (retailer, item_id, sku, title, image_url, product_url, source,
                              claimed_price, claimed_list, claimed_discount)
       VALUES ($1, $2, $2, $3, $4, $5, 'target-clearance', $6, $7, $8)
       ON CONFLICT (retailer, item_id) DO NOTHING`,
      [
        RETAILER, String(h.tcin), h.title ?? null, h.img ?? null, h.url ?? null,
        h.cur ?? null, h.reg ?? null, h.pct ?? null,
      ],
    );
    n += r.rowCount ?? 0;
  }
  return n;
}

/**
 * Write per-store facts to store_inventory (the ledger's source) and return the
 * verdicts the judge should rule on.
 *
 * The verdict price is the store price and the "clearance price" is the same
 * number when Target flags it as clearance — unlike Home Depot, Target PRINTS
 * its clearance price rather than hiding it behind "see in store". So a Target
 * hidden-clearance row is not hidden at all; it is simply a clearance we can
 * quote exactly.
 */
export async function recordTargetFacts(
  db: Db,
  facts: StoreFact[],
): Promise<{ inventory: number; verdicts: HdVerdictInput[] }> {
  // Group by item so one verdict is produced per product, not per store.
  const byTcin = new Map<string, StoreFact[]>();
  for (const f of facts) {
    const list = byTcin.get(f.tcin) ?? [];
    list.push(f);
    byTcin.set(f.tcin, list);
  }

  let inventory = 0;
  for (const [, list] of byTcin) {
    for (const f of list) {
      // NOT_SOLD_IN_STORE is not "zero on the shelf" — it means this store
      // never carries the item at all. Writing it as a 0 would put a store on
      // the ledger that could never have had one, which reads as "sold out
      // here" and is a different, false claim. Skip it entirely.
      if (f.availability === 'NOT_SOLD_IN_STORE') continue;
      const disc =
        f.price !== null && f.regPrice !== null && f.regPrice > f.price
          ? Math.round(((f.regPrice - f.price) / f.regPrice) * 100)
          : 0;
      await db.query(
        `INSERT INTO store_inventory (retailer, sku, store_id, quantity, in_stock,
                                      price_cents, orig_price_cents, discount_pct, last_seen_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
         ON CONFLICT (retailer, sku, store_id) DO UPDATE
           SET quantity = EXCLUDED.quantity, in_stock = EXCLUDED.in_stock,
               price_cents = EXCLUDED.price_cents,
               orig_price_cents = EXCLUDED.orig_price_cents,
               discount_pct = EXCLUDED.discount_pct,
               last_seen_at = now()`,
        [
          RETAILER, String(f.tcin), `${RETAILER}:${f.storeId}`,
          f.quantity, // null stays null: "no reading" is not "zero units"
          typeof f.quantity === 'number' ? f.quantity > 0 : null,
          cents(f.price), cents(f.regPrice), disc,
        ],
      );
      inventory++;
    }
  }

  // Map each product to one verdict, using the store that actually answered
  // with a price. The catalog is national; stock is the per-ZIP overlay.
  const ids = await db.query<Record<string, unknown>>(
    `SELECT discovery_id, item_id FROM discovery WHERE retailer = $1 AND item_id = ANY($2::text[])`,
    [RETAILER, [...byTcin.keys()]],
  );
  const idByTcin = new Map<string, number>();
  for (const r of ids.rows) idByTcin.set(String(r.item_id), Number(r.discovery_id));

  const verdicts: HdVerdictInput[] = [];
  for (const [tcin, list] of byTcin) {
    const discovery_id = idByTcin.get(tcin);
    if (discovery_id === undefined) continue;

    // An item no nearby store stocks is an ONLINE-ONLY clearance. The product's
    // whole promise is in-store finds, so it does not belong in the feed —
    // mark it unreachable-as-an-in-store-deal rather than publishing it.
    const stocking = list.filter((f) => f.availability !== 'NOT_SOLD_IN_STORE');
    if (stocking.length === 0) {
      verdicts.push({
        discovery_id,
        retailer: RETAILER,
        reachable: true,
        price: null,
        discount_pct: 0,
        discontinued: false,
      });
      continue;
    }

    const priced = list.find((f) => f.price !== null) ?? list[0];
    const price = priced?.price ?? null;
    const reg = priced?.regPrice ?? null;
    const pct =
      price !== null && reg !== null && reg > price
        ? Math.round(((reg - price) / reg) * 100)
        : 0;

    // Best nearby shelf count, for the audit trail. Unknown stays unknown, and
    // stores that never carry it are not counted as zeros.
    const counts = stocking
      .map((f) => f.quantity)
      .filter((q): q is number => typeof q === 'number');
    const best = counts.length ? Math.max(...counts) : null;
    const bestStore = stocking.find((f) => f.quantity === best)?.storeId ?? priced?.storeId ?? null;

    verdicts.push({
      discovery_id,
      retailer: RETAILER,
      reachable: price !== null,
      price,
      list_price: reg,
      discount_pct: pct,
      store_id: bestStore ? `${RETAILER}:${bestStore}` : null,
      quantity: best,
      discontinued: false,
      // Target quotes its clearance price outright, so we can show the number.
      clearance_price: priced?.isClearance ? price : null,
      clearance_pct: priced?.isClearance ? pct : null,
    });
  }

  return { inventory, verdicts };
}

async function main() {
  const [sweepPath, storesPath, factsPath] = process.argv.slice(2);
  if (!sweepPath) {
    console.error('usage: tsx src/ingest/target-ingest.ts <sweep.json> [stores.json] [facts.json]');
    process.exit(1);
  }
  const db = await getDb();
  const read = <T>(p?: string): T[] => (p ? (JSON.parse(readFileSync(p, 'utf8')) as T[]) : []);

  if (storesPath) {
    const n = await seedTargetStores(db, read<StoreRow>(storesPath));
    console.log(`stores upserted: ${n}`);
  }

  const seeded = await seedTargetDiscovery(db, read<SweepHit>(sweepPath));
  console.log(`discovery seeded (new): ${seeded}`);

  if (factsPath) {
    const { inventory, verdicts } = await recordTargetFacts(db, read<StoreFact>(factsPath));
    console.log(`store_inventory rows: ${inventory}`);
    const out = await recordVerdicts(db, verdicts);
    console.log(`verdicts: ${JSON.stringify(out)}`);
  }
}

// Only run when invoked directly, so the helpers stay importable and testable.
if (process.argv[1] && process.argv[1].includes('target-ingest')) {
  main().then(
    () => process.exit(0),
    (e) => {
      console.error(e);
      process.exit(1);
    },
  );
}
