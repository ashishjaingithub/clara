-- 0006: Cache the full business profile JSON at session creation time.
-- This allows Clara to serve demo sessions without needing Hunter to be
-- reachable at chat time — critical because Hunter runs on a laptop while
-- Clara is deployed to Railway.
ALTER TABLE demo_sessions ADD COLUMN business_profile_json TEXT;
