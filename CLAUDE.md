# Clara — AI Receptionist

**Phase:** Explore

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

# Watch mode
npm run test:watch

# TypeScript check
npm run typecheck
```

**No coverage thresholds** — Explore phase. Tests exist to give confidence, not enforce gates.

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

> **`HUNTER_API_URL` and `HUNTER_API_KEY` are required for the chat agent to return personalized
> responses.** Without them, Clara operates in generic fallback mode.

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

## Definition of Done (Explore Phase)

- [ ] Unit tests pass: `npm run test`
- [ ] No TypeScript errors: `npm run typecheck`
- [ ] New agent logic has at least one happy path + one error path test
- [ ] No hardcoded secrets

---

## Production Gaps (tracked)

- No rate limiting on `/api/chat` or `/api/demo` endpoints
- No session expiry / cleanup for old demo sessions
- No analytics / engagement tracking beyond `view_count` and `message_count`
- LangSmith tracing not wired (Explore phase — add before Live promotion)
- Hunter API auth (`HUNTER_API_KEY`) is passed as Bearer token but Hunter may not support this yet

---

*Clara CLAUDE.md v1.0 — 2026-03-23*
