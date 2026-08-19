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
