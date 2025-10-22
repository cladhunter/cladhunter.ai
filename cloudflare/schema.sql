-- Cloudflare D1 schema for Cladhunter

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  energy INTEGER NOT NULL DEFAULT 0,
  boost_level INTEGER NOT NULL DEFAULT 0,
  last_watch_at TEXT,
  boost_expires_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS watch_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  ad_id TEXT NOT NULL,
  reward INTEGER NOT NULL,
  base_reward INTEGER NOT NULL,
  multiplier REAL NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS daily_watch_counts (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  boost_level INTEGER NOT NULL,
  ton_amount REAL NOT NULL,
  status TEXT NOT NULL,
  payload TEXT NOT NULL,
  tx_hash TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reward_claims (
  user_id TEXT NOT NULL,
  partner_id TEXT NOT NULL,
  partner_name TEXT,
  reward INTEGER NOT NULL,
  claimed_at TEXT NOT NULL,
  PRIMARY KEY (user_id, partner_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reward_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  partner_id TEXT NOT NULL,
  reward INTEGER NOT NULL,
  claimed_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_watch_logs_user_created_at
  ON watch_logs (user_id, datetime(created_at) DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_user
  ON sessions (user_id, datetime(timestamp) DESC);

CREATE INDEX IF NOT EXISTS idx_reward_logs_user
  ON reward_logs (user_id, datetime(claimed_at) DESC);
