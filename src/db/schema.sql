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

-- Seed the single operator so every query can scope by user_id from day one.
INSERT INTO users (user_id, email)
VALUES (1, 'operator@local')
ON CONFLICT (user_id) DO NOTHING;

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
