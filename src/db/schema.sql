-- Deal Engine schema. Postgres dialect — runs identically on PGlite (local,
-- dev-only) and Neon (production). Idempotent: safe to run repeatedly.
--
-- The one rule: price_observations is APPEND-ONLY. Never UPDATE, never DELETE.
-- It is the compounding asset and it cannot be backfilled.

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  user_id     BIGSERIAL PRIMARY KEY,
  email       TEXT UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  home_lat    DOUBLE PRECISION,
  home_lng    DOUBLE PRECISION,
  radius_mi   INTEGER NOT NULL DEFAULT 30
);

-- Account + setup columns. Added as idempotent ALTERs so existing databases
-- pick them up without a destructive migration.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'none';
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';
ALTER TABLE users ADD COLUMN IF NOT EXISTS path TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS zip TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS alerts_per_day INTEGER NOT NULL DEFAULT 5;
ALTER TABLE users ADD COLUMN IF NOT EXISTS quiet_hours BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS will_report BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS setup_done_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Quiet hours are a wall-clock promise ("nothing between 22:00 and 07:00"),
-- so they need the user's own clock. Defaulting to the launch metro rather
-- than UTC, because UTC quiet hours would silence the wrong nine hours.
ALTER TABLE users ADD COLUMN IF NOT EXISTS tz TEXT NOT NULL DEFAULT 'America/Chicago';

-- Seed the single operator so every query can scope by user_id from day one.
INSERT INTO users (user_id, email, role, plan)
VALUES (1, 'operator@local', 'operator', 'reseller')
ON CONFLICT (user_id) DO NOTHING;

-- Inserting an explicit user_id does NOT advance the BIGSERIAL sequence, so
-- without this the first real signup tries to generate id 1 and collides with
-- the operator row. Idempotent, and safe to run on a populated database.
SELECT setval(
  pg_get_serial_sequence('users', 'user_id'),
  GREATEST((SELECT COALESCE(MAX(user_id), 1) FROM users), 1)
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  user_agent  TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);

-- Single-use tokens for password reset and account deletion.
CREATE TABLE IF NOT EXISTS action_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  purpose    TEXT NOT NULL,          -- reset | delete
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ
);

-- Contact form.
CREATE TABLE IF NOT EXISTS messages (
  message_id BIGSERIAL PRIMARY KEY,
  name       TEXT,
  email      TEXT NOT NULL,
  topic      TEXT,
  body       TEXT NOT NULL,
  ip         TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  handled_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS products (
  product_id  TEXT PRIMARY KEY,          -- "{retailer}:{sku}"
  retailer    TEXT NOT NULL,
  sku         TEXT NOT NULL,
  upc         TEXT,
  title       TEXT,
  brand       TEXT,
  category    TEXT,
  image_url   TEXT,
  product_url TEXT,
  first_seen  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (retailer, sku)
);

-- Home Depot carries TWO ids per product: storeSkuNumber (what the sweep
-- keys on) and itemId (what appears in the product URL). Stock-lookup vendors
-- want the itemId, so it has to be stored, not derived.
ALTER TABLE products ADD COLUMN IF NOT EXISTS item_id TEXT;
CREATE INDEX IF NOT EXISTS idx_products_item_id ON products (item_id);

CREATE TABLE IF NOT EXISTS stores (
  store_id     TEXT PRIMARY KEY,         -- "{retailer}:{store_number}"
  retailer     TEXT NOT NULL,
  store_number TEXT NOT NULL,
  name         TEXT,
  address      TEXT,
  city         TEXT,
  state        TEXT,
  zip          TEXT,
  lat          DOUBLE PRECISION,
  lng          DOUBLE PRECISION,
  UNIQUE (retailer, store_number)
);

-- ---------------------------------------------------------------------------
-- The asset — append only
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS price_observations (
  id           BIGSERIAL PRIMARY KEY,
  product_id   TEXT NOT NULL REFERENCES products(product_id),
  store_id     TEXT REFERENCES stores(store_id),
  observed_at  TIMESTAMPTZ NOT NULL,
  price        NUMERIC(10,2),
  list_price   NUMERIC(10,2),
  discount_pct NUMERIC(5,2),
  stock_qty    INTEGER,
  availability TEXT,                     -- in_stock|out_of_stock|unavailable|unknown
  source       TEXT NOT NULL,            -- apify:dealwatch|keepa|seed
  run_id       TEXT NOT NULL
);

-- Shelf location, where the retailer publishes it. Added after the fact, so
-- these run as idempotent ALTERs rather than sitting in the CREATE above.
ALTER TABLE price_observations ADD COLUMN IF NOT EXISTS aisle_bay TEXT;

CREATE INDEX IF NOT EXISTS idx_obs_product_store_time
  ON price_observations (product_id, store_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_obs_run ON price_observations (run_id);
CREATE INDEX IF NOT EXISTS idx_obs_observed_at ON price_observations (observed_at DESC);

-- ---------------------------------------------------------------------------
-- Derived cache — rebuildable from price_observations at any time.
-- Never treat as source of truth. Improving the scorer means replaying it
-- over full history and measuring against finds.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sku_state (
  product_id       TEXT NOT NULL REFERENCES products(product_id),
  store_id         TEXT NOT NULL REFERENCES stores(store_id),
  stage            TEXT,                 -- s20|s50|s90|delisted|penny_candidate
  stage_entered_at TIMESTAMPTZ,
  prev_stage       TEXT,
  penny_score      INTEGER,              -- 0-100
  score_version    TEXT,
  score_updated_at TIMESTAMPTZ,
  last_seen_at     TIMESTAMPTZ,
  last_price       NUMERIC(10,2),
  last_discount    NUMERIC(5,2),
  last_stock       INTEGER,
  PRIMARY KEY (product_id, store_id)
);

ALTER TABLE sku_state ADD COLUMN IF NOT EXISTS aisle_bay TEXT;

-- The score components, stored alongside the total. The penny page has to
-- explain *why* a number is 98 rather than assert it, and recomputing the
-- breakdown at read time would mean two code paths that can disagree.
ALTER TABLE sku_state ADD COLUMN IF NOT EXISTS score_ladder     INTEGER;
ALTER TABLE sku_state ADD COLUMN IF NOT EXISTS score_divergence INTEGER;
ALTER TABLE sku_state ADD COLUMN IF NOT EXISTS score_dwell      INTEGER;
ALTER TABLE sku_state ADD COLUMN IF NOT EXISTS score_scarcity   INTEGER;
-- v2: the cent ending, which encodes markdown stage and needs no history.
ALTER TABLE sku_state ADD COLUMN IF NOT EXISTS score_price_code INTEGER;

CREATE INDEX IF NOT EXISTS idx_state_score ON sku_state (penny_score DESC);
CREATE INDEX IF NOT EXISTS idx_state_stage ON sku_state (stage, stage_entered_at);

-- ---------------------------------------------------------------------------
-- Ground truth — what the scorer gets graded against
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS finds (
  find_id       BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(user_id),
  product_id    TEXT NOT NULL REFERENCES products(product_id),
  store_id      TEXT NOT NULL REFERENCES stores(store_id),
  outcome       TEXT NOT NULL,           -- found|not_found|wrong_price
  actual_price  NUMERIC(10,2),
  score_at_time INTEGER,                 -- what we predicted, for calibration
  notes         TEXT,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finds_user ON finds (user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_finds_target ON finds (product_id, store_id);

-- ---------------------------------------------------------------------------
-- Matching layer — terms, watchlists, alerts
--
-- Why terms map to categories rather than matching titles: "blender" against
-- titles returns blender bottles and 3D-software books. A category contains
-- every brand by definition, which is the whole promise.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS term_categories (
  term         TEXT PRIMARY KEY,        -- lowercased, trimmed
  category_ids TEXT[] NOT NULL,
  source       TEXT NOT NULL,           -- catalog | llm | manual
  confidence   REAL,
  resolved_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS watchlists (
  watch_id     BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  term         TEXT NOT NULL,
  category_ids TEXT[],                  -- resolved by the mapping layer
  min_discount INTEGER NOT NULL DEFAULT 40,
  max_price    NUMERIC(10,2),
  retailer     TEXT,                    -- null = any
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_watch_user ON watchlists (user_id) WHERE active;

CREATE TABLE IF NOT EXISTS alerts (
  alert_id      BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  product_id    TEXT NOT NULL REFERENCES products(product_id),
  store_id      TEXT NOT NULL REFERENCES stores(store_id),
  watch_id      BIGINT REFERENCES watchlists(watch_id) ON DELETE SET NULL,
  reason        TEXT NOT NULL,          -- watch_match | penny_candidate | verified_find
  score_at_send INTEGER,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- The blueprint asked for UNIQUE (user_id, product_id, store_id, sent_at::date).
  -- Postgres will not index that expression: casting TIMESTAMPTZ to DATE is
  -- STABLE, not IMMUTABLE, because the answer depends on the session timezone.
  -- Storing the day the matcher decided on, in the user's zone, as its own
  -- column is both indexable and more correct.
  sent_on       DATE NOT NULL,
  -- Written when the alert is decided; delivered_at when it actually left the
  -- building. Separating them means a mailer outage is visible as a backlog
  -- rather than as alerts that quietly never arrived.
  delivered_at  TIMESTAMPTZ,
  opened_at     TIMESTAMPTZ,
  outcome       TEXT                    -- won | lost | ignored
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_alerts_daily
  ON alerts (user_id, product_id, store_id, sent_on);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts (user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_unread ON alerts (user_id) WHERE opened_at IS NULL;

-- ---------------------------------------------------------------------------
-- Verified finds — the moat.
--
-- A find is a claim. Reputation is what turns a pile of claims into ground
-- truth the scorer can actually be calibrated against.
-- ---------------------------------------------------------------------------

ALTER TABLE finds ADD COLUMN IF NOT EXISTS evidence_url TEXT;
ALTER TABLE finds ADD COLUMN IF NOT EXISTS weight REAL NOT NULL DEFAULT 1.0;

CREATE TABLE IF NOT EXISTS spotter_stats (
  user_id       BIGINT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  reports       INTEGER NOT NULL DEFAULT 0,
  corroborated  INTEGER NOT NULL DEFAULT 0,
  contradicted  INTEGER NOT NULL DEFAULT 0,
  reputation    REAL NOT NULL DEFAULT 1.0,
  last_report_at TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- Reseller workflow — inventory, orders. Profit is derived from these two and
-- deliberately has no table of its own: a stored profit number drifts from the
-- rows it came from, and then nobody knows which one is true.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS inventory (
  item_id         BIGSERIAL PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  product_id      TEXT REFERENCES products(product_id),
  title           TEXT NOT NULL,          -- free text; product_id optional
  cost_basis      NUMERIC(10,2) NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 1,
  condition       TEXT,
  location        TEXT,
  source_store_id TEXT REFERENCES stores(store_id),
  acquired_at     DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'held',  -- held | listed | sold | returned
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inv_user ON inventory (user_id, status);

CREATE TABLE IF NOT EXISTS orders (
  order_id      BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  item_id       BIGINT REFERENCES inventory(item_id) ON DELETE SET NULL,
  marketplace   TEXT NOT NULL,            -- ebay | facebook | mercari | other
  sale_price    NUMERIC(10,2) NOT NULL,
  fees          NUMERIC(10,2) NOT NULL DEFAULT 0,
  shipping_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  sold_at       DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'sold', -- listed|sold|shipped|delivered|refunded
  buyer_note    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders (user_id, sold_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_item ON orders (item_id);

-- ---------------------------------------------------------------------------
-- Billing
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS subscriptions (
  sub_id             TEXT PRIMARY KEY,       -- stripe subscription id
  user_id            BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  plan               TEXT NOT NULL,
  status             TEXT NOT NULL,
  current_period_end TIMESTAMPTZ,
  founding           BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subs_user ON subscriptions (user_id);
-- The founding-seat count is read under this index inside a transaction.
CREATE INDEX IF NOT EXISTS idx_subs_founding
  ON subscriptions (founding) WHERE founding AND status IN ('active','trialing');

-- Webhook idempotency. Stripe retries, and it is explicit that a handler may
-- see the same event more than once — without this, two deliveries of one
-- "subscription created" can consume two founding seats.
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id     TEXT PRIMARY KEY,
  type         TEXT NOT NULL,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Heartbeat — the defense against silent failure, which is the failure mode
-- that actually costs you the moat
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS scan_runs (
  run_id       TEXT PRIMARY KEY,
  source       TEXT NOT NULL,
  started_at   TIMESTAMPTZ NOT NULL,
  finished_at  TIMESTAMPTZ,
  status       TEXT NOT NULL,            -- running|ok|partial|failed
  rows_written INTEGER NOT NULL DEFAULT 0,
  zips         TEXT,
  canary_ok    BOOLEAN,
  error        TEXT
);

CREATE INDEX IF NOT EXISTS idx_runs_started ON scan_runs (started_at DESC);

-- ---------------------------------------------------------------------------
-- On-demand stock lookups ("Find Stock")
--
-- Doubles as cache AND spend ledger. Every row that hit the vendor has
-- billed=true, so "how many lookups has this user cost me today" is a count
-- rather than an estimate. Cache hits are recorded too, with billed=false, so
-- the cache-hit rate is measurable rather than assumed.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS stock_lookups (
  lookup_id  BIGSERIAL PRIMARY KEY,
  user_id    BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
  product_id TEXT NOT NULL,
  zip        TEXT NOT NULL,
  status     TEXT NOT NULL,          -- ok | empty | vendor_error
  stores     JSONB,                  -- normalised StoreStockRow[]
  error      TEXT,
  billed     BOOLEAN NOT NULL DEFAULT true,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Cache reads: newest successful row for this product+zip.
CREATE INDEX IF NOT EXISTS idx_stock_cache
  ON stock_lookups (product_id, zip, fetched_at DESC);
-- Daily caps: what this user actually cost today.
CREATE INDEX IF NOT EXISTS idx_stock_user_day
  ON stock_lookups (user_id, fetched_at DESC) WHERE billed;

-- Queued stock lookups. The vendor is async by design (noWait -> asyncId), so
-- blocking a request for up to 21 seconds was us ignoring the contract.
-- A queued job is a row here that a worker finishes later.
ALTER TABLE stock_lookups ADD COLUMN IF NOT EXISTS async_id   TEXT;
ALTER TABLE stock_lookups ADD COLUMN IF NOT EXISTS queued_at  TIMESTAMPTZ;
ALTER TABLE stock_lookups ADD COLUMN IF NOT EXISTS attempts   INTEGER NOT NULL DEFAULT 0;
-- status: ok | empty | vendor_error | pending
CREATE INDEX IF NOT EXISTS idx_stock_pending
  ON stock_lookups (queued_at) WHERE status = 'pending';

-- ===========================================================================
-- Nationwide in-store clearance feed  ("enter any US ZIP, see nearby deals")
--
-- Everything below backs GET /api/deals/nearby. It matches the shape of the
-- competitor's in-store feed (Hidden Clearances /leads/nearby): a fast,
-- DB-served list of possible in-store clearance finds around a ZIP, NOT a live
-- scrape. See docs/nationwide-zip-deals-plan.md for the full design and the
-- open questions this migration deliberately leaves to a later decision
-- (ZIP-centroid reference data, and which vendor sources the leads).
--
-- Pattern reuse: this is the SAME append-only-log -> current-state-projection
-- shape the price sweep already uses. The append-only log stays
-- price_observations (the one compounding asset — see the top of this file);
-- lead/stock rows land there tagged with a `source` like 'leads:<vendor>'.
-- store_inventory below is the projection those observations materialise into,
-- exactly as sku_state is the projection for the scorer. The difference is
-- deliberate and explained on the table.
-- ===========================================================================

-- --- (a) stores: make the directory nationwide-ready ----------------------
-- These columns already exist in the CREATE TABLE above on a fresh database.
-- They are re-declared as idempotent ALTERs so an OLDER database that predates
-- them picks them up without a destructive migration — the same belt-and-
-- suspenders the users and products tables use. All are no-ops when present.
ALTER TABLE stores ADD COLUMN IF NOT EXISTS city    TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS state   TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS lat     DOUBLE PRECISION;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS lng     DOUBLE PRECISION;
-- How this store row was learned: seed | scan | teaser | directory. A national
-- directory is assembled from several sources and needs to know which, so a
-- low-trust row (e.g. a competitor teaser lookup) can be re-verified later.
ALTER TABLE stores ADD COLUMN IF NOT EXISTS source  TEXT;

-- Distance queries prefilter by a lat/lng bounding box before the haversine
-- runs in JS (src/geo/nearby.ts). A plain btree cannot do great-circle, but it
-- serves the box scan, which is what keeps "nearby" fast at national scale.
CREATE INDEX IF NOT EXISTS idx_stores_latlng ON stores (lat, lng);
CREATE INDEX IF NOT EXISTS idx_stores_state  ON stores (state);
-- ZIP-exact and ZIP-prefix anchor resolution both look stores up by zip.
CREATE INDEX IF NOT EXISTS idx_stores_zip    ON stores (zip);

-- --- (b) store_inventory: the in-store current-state projection ------------
--
-- Keyed (retailer, sku, store_id) — the same grain as sku_state's
-- (product_id, store_id), just decomposed, because a lead arrives as
-- retailer + SKU (Home Depot Internet #) and must be able to land BEFORE a
-- catalog `products` row exists. So there is intentionally NO foreign key to
-- products here; display fields are joined in at read time on (retailer, sku).
-- store_id DOES reference stores, because a row with no coordinates cannot
-- appear in a nearby feed at all.
--
-- Why this projection is not just rebuilt like sku_state:
--   sku_state is a pure function of price_observations and is dropped-and-
--   rebuilt. This feed's source is EVENT-DRIVEN and sparse (community reports,
--   per-store stock checks), not a daily full sweep, so decay has to be
--   carried as explicit state on the row rather than re-derived from a dense
--   history that does not exist. That is what the three clocks and miss_streak
--   are for.
--
-- THE THREE CLOCKS — do not collapse them, they answer three different
-- questions and the product's honesty depends on the distinction:
--   last_seen_at    — last time we OBSERVED IT PRESENT (units on the shelf).
--   last_checked_at — last time we LOOKED, hit OR miss. "checked 2h ago,
--                     still nothing" is a real, useful answer.
--   last_changed_at — last time a stored VALUE actually changed. Powers "this
--                     price has held for 9 days" without walking history.
--
-- TWO RULES burned into this table, because getting them wrong sends a person
-- on a wasted drive:
--   1. A VENDOR ERROR IS NOT AN OBSERVATION. A 500/429/timeout from a lead or
--      stock source updates NOTHING here — it never nulls a quantity, never
--      advances a clock, never increments miss_streak. It is logged elsewhere
--      (stock_lookups) as a failed CHECK. Only a real "looked and it was gone"
--      answer is a miss. Conflating the two silently deletes good inventory.
--   2. ONLY AN ARCHIVER EVER DELETES. Normal ingest and decay NEVER issue a
--      DELETE. When stock dries up the row is TOMBSTONED (state='archived'),
--      never removed, so its history and any pending finds survive. A single
--      dedicated archiver job is the only writer permitted to hard-delete, and
--      only archived tombstones past the retention window. Tombstone, never
--      delete.
CREATE TABLE IF NOT EXISTS store_inventory (
  retailer        TEXT NOT NULL,          -- slug, matches products.retailer / stores.retailer
  sku             TEXT NOT NULL,          -- retailer SKU (HD Internet #); joins products on (retailer, sku)
  store_id        TEXT NOT NULL REFERENCES stores(store_id),

  -- Last OBSERVED values. Nullable, and null means "never counted", never
  -- "vendor failed" (see rule 1). quantity is stored but is an OPERATIONS
  -- signal only — see the aisle/shelf-count note; the API must never put it on
  -- a card.
  quantity        INTEGER,
  in_stock        BOOLEAN,                -- last observed presence, independent of an exact count
  price_cents     INTEGER,                -- clearance price, integer cents (no float drift)
  -- Pre-markdown price + discount are stored, not derived at read time, so the
  -- nearby feed can filter on the 25% floor in SQL and show "was / now"
  -- without a second code path that can disagree with the stored number.
  orig_price_cents INTEGER,
  discount_pct    NUMERIC(5,2),

  -- Shelf location, as the competitor surfaces it. aisle_source records WHO
  -- said so (community | vendor | retailer), because a staff-verified aisle and
  -- a shopper guess are not the same claim and the UI grades them differently.
  aisle           TEXT,
  bay             TEXT,
  aisle_source    TEXT,

  -- Consecutive real misses (looked, genuinely gone). Vendor errors never
  -- touch this. Drives the live -> presumed_gone transition.
  miss_streak     INTEGER NOT NULL DEFAULT 0,

  -- Decay state machine. Free TEXT + documented values, matching sku_state.stage
  -- and stock_lookups.status (this schema does not use CHECK constraints for
  -- enums). Allowed: live | aging | stale | presumed_gone | archived.
  --   live          fresh, recently confirmed present
  --   aging         no re-confirmation in a while, still probably there
  --   stale         old enough that presence is a guess, dropped from the feed
  --   presumed_gone miss_streak crossed the threshold; hidden from the feed
  --   archived      tombstone; only the archiver writes this, and only it may
  --                 later hard-delete such rows past retention
  state           TEXT NOT NULL DEFAULT 'live',

  -- The three clocks (see the table header).
  last_seen_at    TIMESTAMPTZ,            -- last observed PRESENT
  last_checked_at TIMESTAMPTZ,            -- last looked, hit or miss
  last_changed_at TIMESTAMPTZ,            -- last stored value change

  -- Which pluggable lead source produced this (e.g. 'leads:hiddenclearances',
  -- 'apify:home-depot-clearance'). The source is deliberately left open — a
  -- parallel research lane is choosing the cheapest one — so nothing here is
  -- coupled to a specific vendor.
  source          TEXT,
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (retailer, sku, store_id)
);

-- The hot read path: "inventory at these nearby store_ids that is still worth
-- showing". Partial on the two feed-visible states so the index stays small
-- and only covers rows the feed can actually return.
CREATE INDEX IF NOT EXISTS idx_store_inv_store_live
  ON store_inventory (store_id)
  WHERE state IN ('live', 'aging');
-- The decay/archiver sweep scans by how long ago we last looked, skipping
-- rows already tombstoned.
CREATE INDEX IF NOT EXISTS idx_store_inv_checked
  ON store_inventory (last_checked_at)
  WHERE state <> 'archived';
-- Optional retailer filter on the feed.
CREATE INDEX IF NOT EXISTS idx_store_inv_retailer
  ON store_inventory (retailer, discount_pct DESC)
  WHERE state IN ('live', 'aging');

-- ---------------------------------------------------------------------------
-- ZIP centroids — every US ZIP -> a coordinate, so the nearby resolver can
-- place ANY ZIP on the map instead of only ZIPs where we already have a store.
-- Source: US Census 2024 ZCTA Gazetteer (public domain), loaded from
-- data/zip_centroids.csv by src/geo/load-zip-centroids.ts. ~33k rows.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS zip_centroids (
  zip  TEXT PRIMARY KEY,
  lat  DOUBLE PRECISION NOT NULL,
  lng  DOUBLE PRECISION NOT NULL
);

-- Deal verification: when a deal's price/stock was confirmed against an
-- authoritative source (Unwrangle), not just the hallucination-prone sweep.
-- NULL = never verified (show cautiously); a timestamp = these numbers are real
-- as of then. See src/engine/verify-deals.ts.
ALTER TABLE sku_state       ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE store_inventory ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- Community-reported deals — the crowd's output, ingested from public sources
-- (PennyCentral penny list, Slickdeals RSS, RebelSavings). Kept SEPARATE from
-- price_observations on purpose: that table is what OUR sweep saw (the moat);
-- this one is hearsay from other people's crowds, always labeled as such in
-- the UI ("reported by the community — scan in store"). Pennies only ever
-- come from here or from ladder inference, never from the sweep ($0.01 is a
-- register-only state that no scraper can see).
-- dedupe_key is computed in the adapter (sku, item id, or source URL) so a
-- re-fetch updates the row instead of duplicating it.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_reports (
  report_id    BIGSERIAL PRIMARY KEY,
  source       TEXT NOT NULL,             -- 'pennycentral' | 'slickdeals' | 'rebelsavings'
  kind         TEXT NOT NULL,             -- 'penny' | 'clearance'
  retailer     TEXT NOT NULL DEFAULT 'homedepot',
  dedupe_key   TEXT NOT NULL,
  sku          TEXT,
  item_id      TEXT,
  title        TEXT NOT NULL,
  price        NUMERIC(10,2),
  list_price   NUMERIC(10,2),
  discount_pct NUMERIC(5,2),
  state        TEXT,
  city         TEXT,
  store_number TEXT,
  product_url  TEXT,
  source_url   TEXT,
  image_url    TEXT,
  reported_at  TIMESTAMPTZ,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw          JSONB,
  UNIQUE (source, dedupe_key)
);
CREATE INDEX IF NOT EXISTS idx_community_kind ON community_reports (kind, reported_at DESC);

-- ---------------------------------------------------------------------------
-- DISCOVERY POOL — every deal we have ever found, from any source, BEFORE it
-- is allowed in front of a customer.
--
-- The rule this table enforces: nothing reaches the feed on a scraper's word.
-- A row lands here as `pending`, a checker later asks Home Depot's own
-- store-level endpoint what the price and shelf quantity really are, and only
-- then does the row become `published` (real + worth a drive) or `rejected`
-- (the markdown was fabricated, or it is not worth the gas).
--
-- Every prior fabrication this project shipped — the $7.03 strip light, the
-- "138 in stock" fridge packages, the 1,006-unit washer, RebelSavings' whole
-- synthetic catalog — would have died in this table instead of on the site.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS discovery (
  discovery_id BIGSERIAL PRIMARY KEY,
  retailer     TEXT NOT NULL DEFAULT 'homedepot',
  item_id      TEXT NOT NULL,              -- HD internet number: the verify key
  sku          TEXT,
  title        TEXT,
  image_url    TEXT,
  product_url  TEXT,
  source       TEXT NOT NULL,              -- 'apify' | 'pennycentral' | 'slickdeals' | 'hd-search'
  found_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- What the SOURCE claimed (never shown as fact).
  claimed_price     NUMERIC(10,2),
  claimed_list      NUMERIC(10,2),
  claimed_discount  NUMERIC(5,2),

  -- What HOME DEPOT said, per store (the truth layer).
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending | published | rejected | unreachable
  checked_at    TIMESTAMPTZ,
  hd_price      NUMERIC(10,2),
  hd_list       NUMERIC(10,2),
  hd_discount   NUMERIC(5,2),
  hd_store_id   TEXT,                      -- the store the quantity belongs to
  hd_quantity   INTEGER,
  reject_reason TEXT,
  publish_at    TIMESTAMPTZ,
  UNIQUE (retailer, item_id)
);
CREATE INDEX IF NOT EXISTS idx_discovery_status ON discovery (status, found_at DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_pending ON discovery (checked_at NULLS FIRST) WHERE status = 'pending';
