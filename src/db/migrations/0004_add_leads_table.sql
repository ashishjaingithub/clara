-- 0004_add_leads_table.sql
-- Lead capture events. Each row is a visitor who provided contact info during a demo.
-- One session can generate multiple lead rows (see data-model adversarial challenge).
-- PII table: hard-delete on GDPR erasure, no soft delete.
-- hubspot_company_id is denormalised from the session for direct tenant-scoped queries.

CREATE TABLE IF NOT EXISTS leads (
  id                  TEXT PRIMARY KEY,
  session_id          TEXT NOT NULL REFERENCES demo_sessions(id),
  hubspot_company_id  TEXT NOT NULL,
  name                TEXT NOT NULL,
  contact             TEXT NOT NULL,
  message             TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_leads_session_id
  ON leads(session_id);

CREATE INDEX IF NOT EXISTS idx_leads_company_created
  ON leads(hubspot_company_id, created_at DESC);
