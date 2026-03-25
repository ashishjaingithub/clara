-- 0003_add_langsmith_trace_id.sql
-- Stores the LangSmith run ID on each assistant-role chat message.
-- NULL for user-role messages and for any messages written before this migration.
-- Enables trace → message correlation in the LangSmith UI.

ALTER TABLE chat_messages ADD COLUMN langsmith_trace_id TEXT;
