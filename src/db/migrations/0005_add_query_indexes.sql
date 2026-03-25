-- 0005_add_query_indexes.sql
-- Indexes supporting the known query patterns for Clara v1.
-- See data-model.md section 4 (Indexing Strategy) for justification.

-- "All sessions for this SMB" — used by GET /api/leads?company=X and v2 multi-tenant
CREATE INDEX IF NOT EXISTS idx_demo_sessions_company
  ON demo_sessions(hubspot_company_id);

-- "Sessions ordered by newest" — used by admin listing
CREATE INDEX IF NOT EXISTS idx_demo_sessions_created_at
  ON demo_sessions(created_at DESC);

-- "Full conversation history for a session, in order" — primary read path for every inference call
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created
  ON chat_messages(session_id, created_at ASC);
