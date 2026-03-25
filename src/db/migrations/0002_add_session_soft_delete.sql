-- 0002_add_session_soft_delete.sql
-- Adds soft-delete support to demo_sessions.
-- NULL = active session. Set by cleanup cron for sessions older than 30 days.
-- All active-session queries must add: WHERE deleted_at IS NULL

ALTER TABLE demo_sessions ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_demo_sessions_deleted_at
  ON demo_sessions(deleted_at)
  WHERE deleted_at IS NULL;
