# Clara API Reference

**Version:** 1.0.0
**Base URLs:**

| Environment | URL |
|-------------|-----|
| Local dev | `http://localhost:3002` |
| Staging | `https://clara-staging.railway.app` |
| Production | `https://clara.railway.app` |

---

## Authentication

Two access levels exist.

**Operator endpoints** require a static bearer token:

```
Authorization: Bearer <CLARA_OPERATOR_API_KEY>
```

The key is set in the `CLARA_OPERATOR_API_KEY` environment variable. Generate one with
`openssl rand -base64 32`. The check uses `crypto.timingSafeEqual` — not plain string
equality — to prevent timing attacks.

**Visitor endpoints** require only a valid session UUID, passed in the request body or query
string. The UUID is a capability token: possession grants access to that session and nothing
else. There is no user login or account system.

Endpoints that require operator auth are marked **[OPERATOR]** below.
Endpoints that are public are marked **[PUBLIC]**.

---

## Rate Limits

All limits use an in-memory sliding window. Violations return `429 Too Many Requests` with
`Retry-After: 60`.

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /api/chat` | 10 requests/min/IP | 60 s |
| `GET /api/chat` | 30 requests/min/IP | 60 s |
| `POST /api/demo` | 10 requests/min/IP | 60 s |
| `GET /api/demo` | 30 requests/min/IP | 60 s |
| `POST /api/leads` | 5 requests/min/IP | 60 s |
| `GET /api/leads` | 20 requests/min/IP | 60 s |
| `DELETE /api/leads/{id}` | 20 requests/min/IP | 60 s |
| `POST /api/admin/cleanup` | 2 requests/min/IP | 60 s |

Additional per-session limits apply to `/api/chat`:
- 20 messages per session per hour (sliding window)
- 200 messages per session lifetime (hard cap)

---

## Error Response Shape

All errors return JSON with a single `error` field. Stack traces and internal IDs are never
included in error responses.

```json
{ "error": "Human-readable error message" }
```

---

## Endpoints

### POST /api/demo [OPERATOR]

Creates a new demo session linked to a HubSpot company ID. Returns the UUID to construct
the demo URL.

A new session is always created — sessions are not deduplicated per company. Multiple
sessions per company ID are intentional (enables manual A/B testing).

The business profile is **not** fetched at session creation. It is fetched lazily on the
visitor's first chat message to avoid wasted Hunter API calls for unopened links.

**Request body**

| Field | Type | Required | Constraints | Description |
|-------|------|:--------:|------------|-------------|
| `hubspot_company_id` | string | Yes | 1–64 chars, `[a-zA-Z0-9\-_]` | HubSpot company ID from Hunter |

```bash
curl -s -X POST https://clara.railway.app/api/demo \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <CLARA_OPERATOR_API_KEY>" \
  -d '{"hubspot_company_id": "123456789"}'
```

**Response 201**

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | UUID string | The new session UUID. Use this to build the demo URL. |
| `uuid` | UUID string | Alias for `sessionId`. Provided for URL construction clarity. |

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "uuid": "550e8400-e29b-41d4-a716-446655440000"
}
```

Demo URL: `https://clara.railway.app/demo/550e8400-e29b-41d4-a716-446655440000`

**Errors**

| Status | When |
|--------|------|
| 400 | Missing `hubspot_company_id`, invalid format, or non-JSON body |
| 401 | Missing or invalid `Authorization` header |
| 429 | IP rate limit exceeded (10 req/min) |
| 500 | Internal server error |

---

### GET /api/demo [PUBLIC]

Returns metadata for a demo session. Increments `view_count` on every call — use this to
track how many times a prospect has opened the link.

**Query parameters**

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `uuid` | UUID string | Yes | The demo session UUID from the `/demo/[uuid]` URL |

```bash
curl -s "https://clara.railway.app/api/demo?uuid=550e8400-e29b-41d4-a716-446655440000"
```

**Response 200**

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | UUID string | The session UUID |
| `businessName` | string | Cached business name from Hunter. `"This Business"` if Hunter was unreachable or first message not yet sent. |
| `viewCount` | integer | Times this session has been viewed (already incremented for this call) |
| `messageCount` | integer | Number of user messages sent in this session |
| `createdAt` | ISO-8601 UTC | Session creation timestamp |
| `lastActiveAt` | ISO-8601 UTC | Last chat message timestamp |

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "businessName": "Maria's Hair Studio",
  "viewCount": 3,
  "messageCount": 7,
  "createdAt": "2026-03-24T10:00:00.000Z",
  "lastActiveAt": "2026-03-24T10:15:00.000Z"
}
```

**Errors**

| Status | When |
|--------|------|
| 400 | Missing or malformed `uuid` parameter |
| 404 | Session UUID does not exist or has been soft-deleted |
| 429 | IP rate limit exceeded (30 req/min) |
| 500 | Internal server error |

---

### POST /api/chat [PUBLIC]

Sends a visitor message to Clara and returns the assistant's reply.

On the first message, Clara fetches the business profile from Hunter API (5 s timeout;
falls back to `"This Business"` if unreachable). Subsequent messages use the cached profile
from the session row — no additional Hunter API calls are made.

**Request body**

| Field | Type | Required | Constraints | Description |
|-------|------|:--------:|------------|-------------|
| `sessionId` | UUID string | Yes | Valid UUID v4 | The demo session UUID |
| `message` | string | Yes | 1–2000 chars | Visitor's message text. Whitespace-trimmed before processing. |

```bash
curl -s -X POST https://clara.railway.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "message": "What are your hours on Saturdays?"
  }'
```

**Response 200**

| Field | Type | Description |
|-------|------|-------------|
| `reply` | string | Clara's response. Plain text, no HTML or Markdown. |
| `messageId` | UUID string | UUID of the assistant message row in `chat_messages` (for client-side keying) |

```json
{
  "reply": "We're open Saturdays from 9am to 6pm! Want to book an appointment?",
  "messageId": "660e8400-e29b-41d4-a716-446655440001"
}
```

**Rate limit responses (429)**

| Condition | `error` value |
|-----------|---------------|
| IP limit exceeded | `"Rate limit exceeded. Try again in 60 seconds."` |
| Per-session hourly limit (20 msg/hr) | `"This session has reached its hourly message limit. Please try again in an hour."` |
| Per-session lifetime cap (200 messages) | `"This demo has reached its message limit. Please contact us directly."` |

**Errors**

| Status | When |
|--------|------|
| 400 | Missing `sessionId` or `message`; message exceeds 2000 chars; non-JSON body |
| 404 | Session UUID does not exist or has been soft-deleted |
| 429 | IP rate limit, hourly session limit, or lifetime session cap |
| 500 | LLM inference failed or internal server error |

---

### GET /api/chat [PUBLIC]

Returns the full message history for a session, ordered oldest-first. Used by the frontend
to restore conversation state on page reload.

**Query parameters**

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `sessionId` | UUID string | Yes | The demo session UUID |

```bash
curl -s "https://clara.railway.app/api/chat?sessionId=550e8400-e29b-41d4-a716-446655440000"
```

**Response 200**

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | UUID string | The session UUID |
| `messages` | array | Full history ordered oldest-first |
| `messages[].id` | UUID string | Message row UUID |
| `messages[].role` | `"user"` or `"assistant"` | Who sent the message |
| `messages[].content` | string | Message text |
| `messages[].createdAt` | ISO-8601 UTC | Message timestamp |

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "messages": [
    {
      "id": "aaa-111-222",
      "role": "user",
      "content": "What are your hours?",
      "createdAt": "2026-03-24T10:10:00.000Z"
    },
    {
      "id": "bbb-333-444",
      "role": "assistant",
      "content": "We're open Monday to Saturday, 9am to 7pm!",
      "createdAt": "2026-03-24T10:10:02.000Z"
    }
  ]
}
```

**Errors**

| Status | When |
|--------|------|
| 400 | Missing or malformed `sessionId` parameter |
| 404 | Session not found or soft-deleted |
| 429 | IP rate limit exceeded |
| 500 | Internal server error |

---

### POST /api/leads [PUBLIC]

Records a visitor's contact information as a lead capture event.

The `hubspot_company_id` is **never** accepted from the client — it is read from the
session row. This prevents cross-tenant data injection.

One session can have multiple lead rows (visitor submits more than once, or multiple
visitors use the same link). Per-session cap: 10 lead captures per session lifetime.

**Request body**

| Field | Type | Required | Constraints | Description |
|-------|------|:--------:|------------|-------------|
| `sessionId` | UUID string | Yes | Valid UUID v4 | Session in which the lead was triggered |
| `name` | string | Yes | 1–200 chars | Visitor's self-reported name |
| `contact` | string | Yes | 1–200 chars | Email address or phone number (visitor's choice; not validated as either in v1) |
| `message` | string | No | max 1000 chars | Optional note from the visitor |

```bash
curl -s -X POST https://clara.railway.app/api/leads \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "James Chen",
    "contact": "james@example.com",
    "message": "Interested in beard trim pricing"
  }'
```

**Response 201**

| Field | Type | Description |
|-------|------|-------------|
| `leadId` | UUID string | UUID of the new lead record |

```json
{
  "leadId": "770e8400-e29b-41d4-a716-446655440002"
}
```

**Errors**

| Status | When |
|--------|------|
| 400 | Missing `sessionId`, `name`, or `contact`; fields exceed max length |
| 404 | Session not found or soft-deleted |
| 429 | IP rate limit (5 req/min) or per-session lead cap (10 per session) |
| 500 | Internal server error |

---

### GET /api/leads [OPERATOR]

Returns all lead capture events for a given HubSpot company ID, ordered most-recent-first.
This endpoint is operator-only because lead data contains PII (name and contact info).

**Query parameters**

| Parameter | Type | Required | Constraints | Description |
|-----------|------|:--------:|------------|-------------|
| `company` | string | Yes | max 64 chars | HubSpot company ID to query leads for |

```bash
curl -s "https://clara.railway.app/api/leads?company=123456789" \
  -H "Authorization: Bearer <CLARA_OPERATOR_API_KEY>"
```

**Response 200**

| Field | Type | Description |
|-------|------|-------------|
| `leads` | array | Lead capture events, most-recent-first |
| `leads[].id` | UUID string | Lead record UUID |
| `leads[].sessionId` | UUID string | Session in which the lead was captured |
| `leads[].name` | string | Visitor's name |
| `leads[].contact` | string | Visitor's email or phone |
| `leads[].message` | string or null | Optional note |
| `leads[].createdAt` | ISO-8601 UTC | Capture timestamp |

```json
{
  "leads": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "sessionId": "550e8400-e29b-41d4-a716-446655440000",
      "name": "James Chen",
      "contact": "james@example.com",
      "message": "Interested in beard trim pricing",
      "createdAt": "2026-03-24T10:20:00.000Z"
    }
  ]
}
```

**Errors**

| Status | When |
|--------|------|
| 400 | Missing `company` parameter |
| 401 | Missing or invalid `Authorization` header |
| 429 | IP rate limit exceeded |
| 500 | Internal server error |

---

### DELETE /api/leads/{id} [OPERATOR]

Hard-deletes a single lead row by ID. This is the GDPR Article 17 right-to-erasure
implementation for individual lead records.

This is a **hard delete** — the row is permanently removed. There is no recovery after
this operation. Returns 404 if the lead does not exist (idempotent-safe: a second call
to delete an already-deleted lead returns 404, not an error).

**Path parameters**

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `id` | UUID string | Yes | Lead UUID to delete |

```bash
curl -s -X DELETE \
  "https://clara.railway.app/api/leads/770e8400-e29b-41d4-a716-446655440002" \
  -H "Authorization: Bearer <CLARA_OPERATOR_API_KEY>"
```

**Response 200**

| Field | Type | Description |
|-------|------|-------------|
| `deleted` | `true` | Confirms the operation succeeded |
| `id` | UUID string | The deleted lead's UUID |

```json
{
  "deleted": true,
  "id": "770e8400-e29b-41d4-a716-446655440002"
}
```

**Errors**

| Status | When |
|--------|------|
| 401 | Missing or invalid `Authorization` header |
| 404 | Lead UUID does not exist (already deleted or never created) |
| 429 | IP rate limit exceeded |
| 500 | Internal server error |

---

### POST /api/admin/cleanup [OPERATOR]

Soft-deletes demo sessions that have been inactive for more than 30 days. Sets `deleted_at`
on eligible sessions. Does **not** hard-delete `chat_messages` or `leads` — those rows are
retained for analytics.

Idempotent: running multiple times on the same day has no additional effect. Intended to be
called by a Railway cron job or GitHub Actions scheduled workflow on a daily schedule.

**Request body**

None required. No body.

```bash
curl -s -X POST https://clara.railway.app/api/admin/cleanup \
  -H "Authorization: Bearer <CLARA_OPERATOR_API_KEY>"
```

**Response 200**

| Field | Type | Description |
|-------|------|-------------|
| `archivedCount` | integer | Number of sessions soft-deleted in this run |
| `cutoffDate` | ISO-8601 UTC | The 30-day threshold date used for this run |

```json
{
  "archivedCount": 3,
  "cutoffDate": "2026-02-22T00:00:00.000Z"
}
```

**Errors**

| Status | When |
|--------|------|
| 401 | Missing or invalid `Authorization` header |
| 429 | IP rate limit exceeded (2 req/min) |
| 500 | Internal server error |

---

## Database Schema Reference

The three tables backing the API:

**`demo_sessions`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | text (UUID PK) | `crypto.randomUUID()` |
| `hubspot_company_id` | text NOT NULL | Identifier linking session to Hunter CRM |
| `business_name` | text nullable | Populated on first chat message from Hunter |
| `created_at` | text (ISO-8601) | Session creation time |
| `last_active_at` | text (ISO-8601) | Last message time |
| `view_count` | integer (default 0) | Incremented on every `GET /api/demo` call |
| `message_count` | integer (default 0) | Incremented on every `POST /api/chat` call |
| `deleted_at` | text nullable | Non-null = soft-deleted; active sessions have NULL |

**`chat_messages`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | text (UUID PK) | |
| `session_id` | text FK → `demo_sessions.id` | |
| `role` | `"user"` or `"assistant"` | |
| `content` | text NOT NULL | |
| `langsmith_trace_id` | text nullable | LangSmith run ID for assistant turns |
| `created_at` | text (ISO-8601) | |

**`leads`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | text (UUID PK) | |
| `session_id` | text FK → `demo_sessions.id` | |
| `hubspot_company_id` | text NOT NULL | Denormalised for tenant-scoped queries |
| `name` | text NOT NULL | Visitor's self-reported name |
| `contact` | text NOT NULL | Email or phone — single field |
| `message` | text nullable | Optional visitor note |
| `created_at` | text (ISO-8601) | |

---

*Clara API Reference v1.0.0 — 2026-03-24*
