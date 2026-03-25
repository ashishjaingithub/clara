# Clara — AI Receptionist

**Phase:** Iterate

## Project Overview

Clara is a chat-based AI receptionist for local SMBs. It reads business profile data from Hunter's
API (`GET /api/business/:hubspot_company_id/profile`) and serves a personalized, chat-based demo
experience at `/demo/[uuid]`.

**Use case:** After Hunter sources and enriches a lead, a demo link can be generated for that
business showing what their AI receptionist would look like. The prospect can interact with Clara
live, which demonstrates value before any sales call.

**Key identifier:** `hubspot_company_id` is the universal identifier linking Clara demo sessions
back to Hunter's CRM data. See ADR-0011 for the rationale.

---

## Getting Started

**Prerequisites:** Node.js 20+, npm

```bash
cd clara
cp .env.example .env
# Fill in:
#   GROQ_API_KEY     — free at console.groq.com (powers the chat agent)
#   HUNTER_API_URL   — URL of running Hunter backend (default: http://localhost:3001)
#   HUNTER_API_KEY   — Hunter API key (if auth is enabled)
npm install
npm run db:migrate
npm run dev
```

App runs at: **http://localhost:3002**

Verify:
```bash
# Create a demo session
curl -X POST http://localhost:3002/api/demo \
  -H "Content-Type: application/json" \
  -d '{"hubspot_company_id": "123456"}'

# Opens the demo in browser
open http://localhost:3002/demo/<sessionId>
```

> **Note:** Clara requires Hunter to be running at `HUNTER_API_URL` to fetch business profiles.
> If Hunter is unreachable, Clara falls back to a minimal "This Business" persona.

---

## Test Commands

```bash
# Unit tests (fast, all externals mocked)
npm run test

# With coverage (thresholds enforced)
npm run test -- --coverage

# Watch mode
npm run test:watch

# TypeScript check
npm run typecheck
```

**Coverage thresholds (Iterate phase):** statements 70%, branches 60%, functions 70%, lines 70%.
CI blocks merge if thresholds are not met.

---

## Architecture

```
clara/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── api/
│   │   │   ├── chat/route.ts       # POST/GET chat messages
│   │   │   └── demo/route.ts       # POST create session, GET session meta
│   │   ├── demo/[uuid]/page.tsx    # Chat UI (client component)
│   │   ├── layout.tsx
│   │   └── page.tsx                # Home / redirect
│   ├── agent/
│   │   └── receptionist.ts         # LangGraph chat agent (Groq llama-3.1-8b-instant)
│   └── db/
│       ├── index.ts                # Drizzle + better-sqlite3
│       ├── migrate.ts              # DDL migration runner
│       └── schema.ts               # demo_sessions + chat_messages tables
├── vitest.config.ts
├── tailwind.config.ts
├── next.config.ts
└── .env.example
```

### Data Flow

1. Hunter generates a demo link: `POST /api/demo { hubspot_company_id }`
2. A UUID session is created in `demo_sessions`
3. Prospect visits `/demo/[uuid]`
4. On first message, Clara fetches the business profile from Hunter API
5. Business profile is cached in `demo_sessions.business_name` for subsequent messages
6. Each message pair (user + assistant) is stored in `chat_messages`

### Key Design Decisions

- **No auth on demo pages** — demos are intentionally public. The UUID provides obscurity.
- **Graceful Hunter API fallback** — if Hunter is down, Clara uses "This Business" as the name and answers generically. Better to degrade than to fail.
- **Profile cached after first fetch** — avoids repeated Hunter API calls per message turn.
- **Groq (llama-3.1-8b-instant)** — fast and free-tier friendly. Override with `GROQ_MODEL` env var.

---

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `GROQ_API_KEY` | Yes | — | Powers the chat LLM |
| `ANTHROPIC_API_KEY` | No | — | Reserved for future Haiku fallback |
| `HUNTER_API_URL` | Yes | `http://localhost:3001` | Where Hunter backend is running |
| `HUNTER_API_KEY` | No | — | Auth header for Hunter API (if enabled) |
| `DATABASE_PATH` | No | `./clara.db` | SQLite file path |
| `GROQ_MODEL` | No | `llama-3.1-8b-instant` | Override the Groq model |
| `PORT` | No | `3002` | App port |
| `NODE_ENV` | No | `development` | Environment |
| `SIMULATE_APIS` | No | `false` | Set `true` in tests to mock all external APIs |
| `HUBSPOT_ACCESS_TOKEN` | No* | — | HubSpot private app token (shared from root `.env`) |
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | No* | — | Path to Google service account JSON (shared from root `.env`) |
| `GOOGLE_CALENDAR_ID` | No* | — | Target calendar for bookings (shared from root `.env`) |
| `BUSINESS_TIMEZONE` | No | `America/Los_Angeles` | Default timezone for slot generation |
| `CLARA_CONFIRM_BOOKING` | No* | — | Set `true` to enable calendar booking outside local dev (Tier 3 HITL gate) |
| `CLARA_CONFIRM_HUBSPOT_WRITE` | No* | — | Set `true` to enable HubSpot writes outside local dev (Tier 3 HITL gate) |

> *Required in production. In development (`NODE_ENV=development`), HITL gates are bypassed automatically.
> Set `SIMULATE_APIS=true` in tests — all external API calls are mocked.

> **Shared credentials** (`HUBSPOT_ACCESS_TOKEN`, `GOOGLE_SERVICE_ACCOUNT_KEY_PATH`, `GOOGLE_CALENDAR_ID`)
> are defined once in the root `.env` and symlinked or copied to each project.

---

## API Reference

### `POST /api/demo`
Create a new demo session.

```json
// Request
{ "hubspot_company_id": "12345" }

// Response 201
{ "sessionId": "uuid-here", "uuid": "uuid-here" }
```

### `GET /api/demo?uuid=<sessionId>`
Get session metadata. Also increments `view_count`.

### `POST /api/chat`
Send a message and get Clara's reply.

```json
// Request
{ "sessionId": "uuid-here", "message": "What are your hours?" }

// Response
{ "reply": "We're open Monday to Friday...", "messageId": "msg-uuid" }
```

### `GET /api/chat?sessionId=<id>`
Get full message history for a session.

---

## Definition of Done (Iterate Phase)

- [ ] Unit tests pass with coverage thresholds met: `npm run test -- --coverage`
- [ ] No TypeScript errors: `npm run typecheck`
- [ ] New agent logic has at least one happy path + one error path test
- [ ] No hardcoded secrets
- [ ] All external API calls behind `SIMULATE_APIS` guard in tests
- [ ] New Tier 3 actions registered in `.claude/rules/hitl-gate-exact-string.md`

---

## Production Gaps (tracked)

- No rate limiting on `/api/chat` or `/api/demo` endpoints
- No session expiry / cleanup for old demo sessions
- No analytics / engagement tracking beyond `view_count` and `message_count`
- LangSmith tracing not wired (Explore phase — add before Live promotion)
- Hunter API auth (`HUNTER_API_KEY`) is passed as Bearer token but Hunter may not support this yet

---

*Clara CLAUDE.md v2.0 — 2026-03-24 (Iterate phase promotion — ADR-0017)*
