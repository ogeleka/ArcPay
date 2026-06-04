CREATE TABLE IF NOT EXISTS merchants (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  email            TEXT UNIQUE NOT NULL,
  wallet_address   TEXT NOT NULL,
  webhook_url      TEXT,
  webhook_secret   TEXT,
  password_hash    TEXT,
  markup_bps       INTEGER NOT NULL DEFAULT 0,
  default_currency TEXT    NOT NULL DEFAULT 'NGN',
  business_type    TEXT,
  website          TEXT,
  use_case         TEXT,
  created_at       TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS api_keys (
  id          TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  key_hash    TEXT UNIQUE NOT NULL,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id             TEXT PRIMARY KEY,
  merchant_id    TEXT NOT NULL REFERENCES merchants(id),
  amount         INTEGER NOT NULL,
  currency       TEXT    NOT NULL DEFAULT 'USDC',
  amount_ngn     INTEGER,
  rate           REAL,
  markup_bps     INTEGER,
  mid_rate       REAL,
  status         TEXT    NOT NULL DEFAULT 'pending',
  payer          TEXT,
  order_id       TEXT,
  customer_email TEXT,
  callback_url   TEXT,
  metadata       TEXT,
  expires_at     TEXT,
  paid_at        TEXT,
  tx_hash        TEXT,
  created_at     TEXT DEFAULT (datetime('now')),
  updated_at     TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id           TEXT PRIMARY KEY,
  payment_id   TEXT NOT NULL REFERENCES payments(id),
  tx_hash      TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  block_number INTEGER,
  created_at   TEXT DEFAULT (datetime('now')),
  UNIQUE (tx_hash, event_type)
);
