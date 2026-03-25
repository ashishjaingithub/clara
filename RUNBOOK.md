# Clara — Operations Runbook

This runbook covers the failure modes most likely to occur in v1 (demo tool, Railway
single-dyno, SQLite, < 50 sessions). Scenarios are ordered by frequency of occurrence.

---

## Failure 1: App won't start — missing environment variables

**Symptom**

The Railway deploy log shows:
```
[Clara] Missing required production environment variables:
  - GROQ_API_KEY
  - LANGSMITH_API_KEY
  ...
[Clara] Set the above variables and restart.
Process exited with code 1
```

Or the app starts but immediately crashes with an unhandled error referencing `process.env`.

**Diagnosis**

`checkProductionEnv()` in `src/lib/startup.ts` enforces the following in production:

| Variable | Requirement |
|----------|-------------|
| `GROQ_API_KEY` | Must be set and non-empty |
| `LANGSMITH_API_KEY` | Must be set and non-empty |
| `CLARA_OPERATOR_API_KEY` | Must be set and non-empty |
| `NEXT_PUBLIC_BASE_URL` | Must be set and non-empty |
| `LANGSMITH_TRACING` | Must be exactly `"true"` |

**Fix**

1. In Railway: **Service → Variables** — verify all five variables are set.
2. For `LANGSMITH_TRACING`, confirm the value is the exact lowercase string `true`, not `1`,
   `True`, or `yes`.
3. Trigger a redeploy after correcting the variables.

**Prevention**

Run locally with `NODE_ENV=production` before deploying to catch missing vars early:
```bash
NODE_ENV=production npm run start
```

---

## Failure 2: Groq API errors — LLM calls failing

**Symptom**

`POST /api/chat` returns HTTP 500:
```json
{ "error": "Agent failed to generate a response" }
```

Railway logs show:
```
[Clara] Groq API error: 401 Unauthorized
```
or:
```
[Clara] Groq API error: 429 Too Many Requests
```

**Diagnosis**

Check LangSmith for the failing trace: look for `clara-receptionist` runs with error status.
The trace will show the exact Groq response code and body.

Common causes:

| Log message | Cause |
|-------------|-------|
| `401 Unauthorized` | `GROQ_API_KEY` is invalid or expired |
| `429 Too Many Requests` | Groq free-tier rate limit hit (requests per minute or tokens per day) |
| `Connection timeout` | Groq service degraded; check [status.groq.com](https://status.groq.com) |

**Fix — 401 Invalid key**

1. Log in to [console.groq.com](https://console.groq.com), generate a new API key.
2. In Railway: **Variables → GROQ_API_KEY** → replace the value.
3. Redeploy (or Railway hot-reloads env vars — check if a restart is required).

**Fix — 429 Rate limited**

The Groq free tier allows approximately 30 requests/minute and 6,000 tokens/minute. For
v1 demo scale this is unlikely unless a prospect is being unusually active.

1. Wait 60 seconds — Groq's rate limit windows are per-minute.
2. If sustained: check the active session's `message_count` in the database. If it is
   close to the 20/hour or 200/session cap, Clara's own rate limiting should kick in
   before Groq does.
3. If you need higher limits: upgrade to a paid Groq plan.

**Fix — Connection timeout / Groq outage**

1. Check [status.groq.com](https://status.groq.com).
2. While Groq is down, all `/api/chat` calls will return 500. Demo sessions opened
   during an outage will show an error to the visitor — this is expected degraded behavior.
3. To temporarily switch models: set `GROQ_MODEL=llama-3.1-70b-versatile` (a different
   Groq model that may be on a separate infrastructure path). Redeploy.
4. If you need a full fallback to Anthropic Haiku: this is not wired in v1. Add
   `ANTHROPIC_API_KEY` and update `receptionist.ts` to use `@langchain/anthropic` as
   a fallback — this is a v2 feature.

---

## Failure 3: Rate limit triggering unexpectedly

**Symptom**

A legitimate user receives:
```json
{ "error": "Rate limit exceeded. Try again in 60 seconds." }
```

Or a prospect reports being unable to chat with Clara after a few messages.

**Diagnosis**

There are three distinct rate limit conditions on `/api/chat`:

| Error message | Condition | Limit |
|---------------|-----------|-------|
| `"Rate limit exceeded. Try again in 60 seconds."` | IP-level limit | 10 req/min/IP |
| `"This session has reached its hourly message limit..."` | Per-session hourly | 20 msg/hr/session |
| `"This demo has reached its message limit. Please contact us directly."` | Per-session lifetime | 200 messages |

Check the session's `message_count` in the database:
```sql
SELECT id, message_count, created_at FROM demo_sessions WHERE id = '<session_uuid>';
```

**Fix — IP rate limit**

The in-memory rate limiter resets on app restart. If a prospect is behind a corporate NAT
and shares an IP with many other requests, this can trigger unexpectedly.

Options:
1. Wait 60 seconds — the sliding window expires.
2. If this is a real prospect you need to keep engaged: restart the Railway service
   (clears the in-memory limit state). This is a last resort.
3. Long-term: increase the IP limit or implement session-ID-based limits that are more
   forgiving on shared IPs (v2 improvement).

**Fix — Session hourly limit (20 msg/hr)**

This is working as intended. Tell the prospect to continue in an hour, or:
1. Create a new session for the same `hubspot_company_id`: `POST /api/demo` with the
   same company ID generates a new session with a fresh limit.
2. Send the new link to the prospect.

**Fix — Lifetime cap (200 messages)**

This session is exhausted. Create a new session as above.

---

## Failure 4: Session not found (404)

**Symptom**

`POST /api/chat` or `GET /api/demo` returns:
```json
{ "error": "Demo session not found" }
```
or:
```json
{ "error": "Session not found" }
```

**Diagnosis**

Two possible causes:

1. **The UUID is wrong** — typo in the demo link, or the URL was modified.
2. **The session was soft-deleted** — the cleanup job ran and marked the session as deleted
   because it was older than 30 days.

Check the database:
```sql
-- Check if the session exists at all
SELECT id, deleted_at, created_at FROM demo_sessions WHERE id = '<uuid>';
```

If the row exists but `deleted_at` is set, the session was archived.

**Fix — Wrong UUID**

Verify the URL: the path should be `/demo/<uuid>` where `<uuid>` is the exact string
returned by `POST /api/demo`. Re-generate a new session if needed.

**Fix — Session archived**

The session was soft-deleted by the cleanup job. The chat history and leads are retained
in the database, but the session is no longer accessible to visitors.

To restore access: update `deleted_at` back to NULL directly in the database:
```sql
UPDATE demo_sessions SET deleted_at = NULL WHERE id = '<uuid>';
```

Or create a new session for the same company and send the updated link.

---

## Failure 5: Hunter API unreachable — generic fallback responses

**Symptom**

Clara's first response in a session does not mention the prospect's business name —
she says "Hi, I'm Clara, your AI receptionist" instead of "Hi, I'm Clara, Maria's Hair
Studio's AI receptionist."

Railway logs show:
```
[Clara] Could not reach Hunter API: fetch failed
```
or:
```
[Clara] Hunter API returned 503 for company 123456789
```

**Diagnosis**

On the first chat message, Clara calls `GET <HUNTER_API_URL>/business/<id>/profile` with
a 5-second timeout. If Hunter is unreachable or returns a non-2xx status, Clara falls back
to a minimal `{ companyName: "This Business" }` profile.

Check:
1. Is Hunter running? `curl -s <HUNTER_API_URL>/health`
2. Is `HUNTER_API_URL` set correctly in Railway? Confirm the value does not have a
   trailing slash or incorrect port.
3. Is there a network policy or firewall blocking Clara → Hunter traffic?

**Fix**

1. Restore the Hunter backend if it is down.
2. Correct `HUNTER_API_URL` in Railway variables if it points to the wrong host.
3. Once Hunter is reachable again, create a **new session** for the affected company —
   the old session has `business_name = NULL` cached in the row, and subsequent messages
   will still serve generic responses. A new session will fetch the profile fresh on the
   first message.

**Note:** The fallback is intentional behavior (ADR-003). A Hunter outage should not
cause Clara to return 500 errors to prospects. The degraded experience (generic responses)
is the correct outcome.

---

## Failure 6: Database errors — SQLite locked or corrupt

**Symptom**

Any API route returns 500 with Railway logs showing:
```
SQLITE_BUSY: database is locked
```
or:
```
SQLITE_CORRUPT: database disk image is malformed
```

**Diagnosis**

**SQLITE_BUSY** occurs when two processes are trying to write simultaneously. This should
not happen on a single-dyno Railway deployment unless:
- Two concurrent requests hit the same write path (rare but possible under load)
- A Railway health check or background job is holding a connection

**SQLITE_CORRUPT** is a more serious failure indicating filesystem or storage issues on
the Railway volume.

**Fix — SQLITE_BUSY**

1. These errors are usually transient. The request will retry from the client side.
2. If sustained: check Railway volume health in the Railway dashboard.
3. Restart the service — `better-sqlite3` (synchronous driver) releases locks on process exit.

**Fix — SQLITE_CORRUPT**

1. Stop the service immediately to prevent further writes to a corrupt file.
2. Restore from the most recent backup dump:
   ```bash
   # On the Railway volume (via Railway CLI shell)
   sqlite3 /data/clara-production.db < backup-YYYYMMDD.sql
   ```
3. If no backup exists: the database must be rebuilt from scratch. Session history is lost.
   This is why daily backups are non-negotiable before the first real prospect session.
4. After restoration, restart the service and verify with a test session.

**Prevention**

- Set up daily SQLite dumps before sending any real prospect their demo link.
  See DEPLOYMENT.md for the backup command.

---

## Failure 7: Wrong operator API key rejected (401)

**Symptom**

`POST /api/demo` or `GET /api/leads` returns:
```json
{ "error": "Unauthorized" }
```

**Diagnosis**

The `requireOperatorAuth` function in `src/lib/auth.ts` uses `crypto.timingSafeEqual` to
compare the `Authorization: Bearer <token>` header against `CLARA_OPERATOR_API_KEY`.

Common causes:
1. The key was rotated in Railway but the calling script was not updated.
2. The `Authorization` header format is wrong (must be `Bearer <key>` with a space).
3. The key contains trailing whitespace from copy-paste.

**Fix**

1. Confirm the key in Railway: **Service → Variables → CLARA_OPERATOR_API_KEY**.
2. Test directly:
   ```bash
   curl -v -X POST https://<your-url>/api/demo \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <exact_key_from_railway>" \
     -d '{"hubspot_company_id": "test"}'
   ```
3. If the key in Railway looks correct but the request still fails: check for invisible
   characters. Regenerate the key with `openssl rand -base64 32` and update both Railway
   and your calling scripts.

---

## Quick Reference: Common Checks

```bash
# Check if the app is responding
curl -s -o /dev/null -w "%{http_code}" https://<your-url>/

# Check a specific session
curl -s "https://<your-url>/api/demo?uuid=<session_uuid>"

# Create a test session (operator)
curl -s -X POST https://<your-url>/api/demo \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <OPERATOR_KEY>" \
  -d '{"hubspot_company_id": "runbook-test-001"}'

# Run cleanup manually
curl -s -X POST https://<your-url>/api/admin/cleanup \
  -H "Authorization: Bearer <OPERATOR_KEY>"

# Check leads for a company
curl -s "https://<your-url>/api/leads?company=<company_id>" \
  -H "Authorization: Bearer <OPERATOR_KEY>"

# Direct DB query (Railway CLI)
railway run sqlite3 /data/clara-production.db \
  "SELECT id, hubspot_company_id, message_count, deleted_at FROM demo_sessions ORDER BY created_at DESC LIMIT 20;"
```

---

## Escalation Path

All incidents at v1 scale are handled by the operator (Ashish).

1. Check Railway logs first — most failures are visible there.
2. Check LangSmith traces for LLM-related failures.
3. If the database is involved, use the Railway CLI to open a shell and inspect directly.
4. If an incident results in a new error pattern being resolved, add it to this runbook.

---

*Clara RUNBOOK.md v1.0 — 2026-03-24*
