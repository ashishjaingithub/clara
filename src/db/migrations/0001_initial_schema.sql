-- 0001_initial_schema.sql
-- Retroactive baseline: captures the tables created by the inline DDL in db/index.ts.
-- No-op against any database that already has these tables (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS demo_sessions (
  id                  TEXT PRIMARY KEY,
  hubspot_company_id  TEXT NOT NULL,
  business_name       TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  last_active_at      TEXT NOT NULL DEFAULT (datetime('now')),
  view_count          INTEGER NOT NULL DEFAULT 0,
  message_count       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES demo_sessions(id),
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
