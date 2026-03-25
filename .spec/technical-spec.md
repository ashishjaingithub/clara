# Technical Specification

**Tech Lead:** Tech Lead Agent
**Date:** 2026-03-24
**Phase:** Explore (v1 Demo Tool)

---

## Part 1 — What I Received (Summary)

Clara is a Next.js 14 App Router chat receptionist. It creates UUID-keyed demo sessions linked
to HubSpot company IDs, runs a single-node Groq LLM chain (LangChain messages, no LangGraph),
and stores sessions + messages in SQLite via Drizzle ORM. Three gaps exist between spec and
current code:

1. `demo/route.ts` deduplicates sessions by `hubspot_company_id` — the PRD requires a new
   session per call (A/B use case). This is a behavioral divergence from the spec.
2. `chat/route.ts` increments `message_count` by 2 per turn (counts user + assistant both);
   the spec counts user messages only (enforces the 200-message visitor cap).
3. `schema.ts` is missing `deleted_at`, `langsmith_trace_id`, and the `leads` table — all
   required by the data model and security spec before any production deployment.

These gaps are resolved in Sprint 0 tasks.

---

## Part 2 — Assumptions

1. Backend (API routes, agent, DB) and Frontend (React components, page) are developed in
   parallel after the shared type contract is established in Sprint 0.
2. The project root is `/Users/ashishjain/agenticLearning/Clara` — all paths in this spec
   are relative to that root unless stated otherwise.
3. Tests are written alongside implementation (same PR, same task) — not after.
4. LangSmith SDK is added alongside the Groq LangChain integration — not a separate sprint.
5. The `@langchain/langgraph` dependency will be removed as part of Sprint 0 (ADR-002).
6. All operator API key comparisons use `crypto.timingSafeEqual` — never `===`.
7. The in-memory rate limiter accepts a `getNow: () => number` parameter for testability.
8. `npm run db:migrate` runs Drizzle Kit migrations (replacing the inline DDL in `db/index.ts`).
9. Railway is the deployment target — single-dyno, SQLite on persistent volume.

---

## Part 3 — Adversarial Challenge

### The LangSmith integration has no specified flow for retrieving the trace ID.

The data model specifies that `langsmith_trace_id` is stored on every assistant `chat_messages`
row. The architecture says to use a "LangChain CallbackHandler." But no spec document defines:
- Which specific callback to use (`LangSmithTracer`, `Client` + `traceable`, or `traceable` wrapper)
- How the trace run ID is extracted from the callback after the Groq call completes
- Whether the LLM is reinstantiated per-request (current code creates a new `ChatGroq` on every
  call) or is a module-level singleton (affects how callbacks are attached)

This is blocking: if two engineers implement this independently, one will attach the callback
at instantiation and one at invocation, with different extraction patterns.

**Resolution defined here (Section 7 — LangSmith Integration Spec):** Use the `traceable`
wrapper from `langsmith/traceable`. This eliminates the `CallbackHandler` pattern entirely,
is compatible with any SDK, and returns a standard LangSmith run ID via `getCurrentRunTree()`.
The `runReceptionist` function is wrapped with `traceable` at the module export boundary.

---

## Part 4 — Decisions Required (and Resolved)

```
PARALLELISM
1. Yes — Backend and Frontend develop in parallel after Sprint 0 establishes shared types.
   Dependency: shared types in src/types/index.ts exist before FE-001 starts.

SHARED TYPES
2. Types live in src/types/index.ts (read-only contract for both agents).
   See Section 4 for the complete list.

TESTING STRATEGY
3. Coverage thresholds: Explore phase — no enforced gate. Target: unit tests for all
   service functions and API route handlers. E2E tests: out of scope.
4. E2E: out of scope for Explore phase. Vitest + jsdom for component tests.

TURN BUDGETS
5. See Section 5.
```

---

## 1. Coding Standards

### TypeScript

- `strict: true` in `tsconfig.json` — already set. No exceptions.
- No `any` — use `unknown` with type guards or Zod schemas.
- Async/await over Promise chains.
- Named exports everywhere except Next.js page/route files (which use default exports per
  Next.js convention).
- Custom error classes: extend `Error` and include a `code` string field.
- All external HTTP calls wrapped in try/catch with a typed fallback (never let a Hunter or
  Groq failure propagate as an unhandled rejection).
- No `dangerouslySetInnerHTML` anywhere — Hunter-supplied business names are untrusted strings
  and must be React JSX text content only.

### File Conventions

- Route handlers: `src/app/api/[route]/route.ts` (Next.js App Router convention)
- Middleware: `src/lib/middleware/[name].ts`
- Services (business logic): `src/lib/services/[name].ts`
- Rate limiter: `src/lib/rate-limiter.ts`
- Shared types: `src/types/index.ts` (read-only — no agent writes here except the types task)
- DB schema: `src/db/schema.ts`
- DB migrations: `src/db/migrations/NNNN_description.sql`
- Tests: co-located, `[name].test.ts` alongside the file under test

### React Component Conventions

- All interactive UI components have a `data-testid` attribute.
- No inline styles — Tailwind classes only.
- Server Components where possible; `"use client"` only when the component needs `useState`,
  `useEffect`, or browser event handlers.
- Skeleton loading states for all async data (no blank screens).

---

## 2. File Ownership Map

Agents MUST NOT write outside their scope.

| Agent | Owns (write) | Reads (does not write) |
|-------|-------------|----------------------|
| Backend Agent | `src/app/api/`, `src/lib/middleware/`, `src/lib/services/`, `src/db/`, `src/agent/` | `src/types/` |
| Frontend Agent | `src/app/demo/`, `src/components/`, `src/hooks/`, `src/app/layout.tsx`, `src/app/page.tsx` | `src/types/`, `src/app/api/` (reads for type inference only) |
| Both (Sprint 0 setup) | `src/types/index.ts` (shared type contract — written once, then read-only) | — |
| DevOps Agent | `package.json`, `tsconfig.json`, `next.config.ts`, `.env.example`, `vitest.config.ts`, `.github/`, `drizzle.config.ts` | Everything |

**No agent writes to `src/types/index.ts` after Sprint 0.** If a type change is needed,
it must be coordinated as a separate task with both agents acknowledging the change.

---

## 3. Environment Variables

Complete list. All must appear in `.env.example` with `REPLACE_ME` placeholder values.

| Variable | Type | Required | Default | Purpose | Startup Enforcement |
|----------|------|----------|---------|---------|---------------------|
| `GROQ_API_KEY` | string | Yes (all envs) | — | Groq LLM inference | Exit(1) if missing |
| `LANGSMITH_API_KEY` | string | Yes (production) | — | LangSmith trace emission | Exit(1) in production |
| `LANGSMITH_TRACING` | `"true"` | Yes (production) | `"false"` | Enables LangSmith SDK | Exit(1) in production if not `"true"` |
| `LANGSMITH_PROJECT` | string | No | `"clara-development"` | LangSmith project name | Auto-set to `clara-${NODE_ENV}` |
| `HUNTER_API_URL` | string (URL) | Yes (all envs) | `"http://localhost:3001"` | Hunter profile API base URL | Warning if missing |
| `HUNTER_API_KEY` | string | No | — | Bearer token for Hunter API | None (optional) |
| `CLARA_OPERATOR_API_KEY` | string | Yes (production) | — | Operator bearer token (timing-safe) | Exit(1) in production |
| `DATABASE_PATH` | string (path) | No | `"./clara.db"` | SQLite file path | None |
| `GROQ_MODEL` | string | No | `"llama-3.1-8b-instant"` | LLM model override | None |
| `PORT` | number | No | `3002` | HTTP port | None |
| `NODE_ENV` | `"development"` \| `"test"` \| `"production"` | Yes | `"development"` | Gates production enforcement | — |
| `NEXT_PUBLIC_BASE_URL` | string (URL) | Yes (production) | — | Full deployment URL for CORS header | Exit(1) in production |

### Startup Enforcement Location

`src/lib/startup-check.ts` — imported at the top of `src/app/layout.tsx` (server component)
so it runs on every cold start in production.

```typescript
// src/lib/startup-check.ts
export function checkProductionEnv(): void {
  if (process.env.NODE_ENV !== 'production') return
  const required = [
    'GROQ_API_KEY',
    'LANGSMITH_API_KEY',
    'CLARA_OPERATOR_API_KEY',
    'NEXT_PUBLIC_BASE_URL',
  ] as const
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`[Clara] ${key} is required in production`)
      process.exit(1)
    }
  }
  if (process.env.LANGSMITH_TRACING !== 'true') {
    console.error('[Clara] LANGSMITH_TRACING=true is required in production')
    process.exit(1)
  }
}
```

---

## 4. Shared Type Contract

Location: `src/types/index.ts`. Read-only for all agents after Sprint 0.
These types are the contract between Frontend, Backend, and the API.

```typescript
// src/types/index.ts

// ─── Domain entities (mirror Drizzle infer types) ────────────────────────────

export interface DemoSession {
  id: string
  hubspotCompanyId: string
  businessName: string | null
  createdAt: string        // ISO-8601
  lastActiveAt: string     // ISO-8601
  viewCount: number
  messageCount: number
  deletedAt: string | null // ISO-8601 or null
}

export interface ChatMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  langsmithTraceId: string | null
  createdAt: string        // ISO-8601
}

export interface Lead {
  id: string
  sessionId: string
  hubspotCompanyId: string
  name: string
  contact: string
  message: string | null
  createdAt: string        // ISO-8601
}

// ─── Agent types ─────────────────────────────────────────────────────────────

export interface MessageHistoryItem {
  role: 'user' | 'assistant'
  content: string
}

export interface PainPoint {
  problem: string
  aiSolution: string
}

export interface BusinessProfile {
  companyId: string
  companyName: string
  industry?: string
  services?: string[]
  phone?: string
  website?: string
  address?: string
  hours?: string
  painPoints?: PainPoint[]
  pitchAngle?: string
  techMaturity?: string
}

// ─── API request/response shapes ─────────────────────────────────────────────

// POST /api/demo
export interface CreateDemoRequest {
  hubspot_company_id: string
}
export interface CreateDemoResponse {
  sessionId: string
  uuid: string   // alias of sessionId for URL construction
}

// GET /api/demo?uuid=
export interface GetDemoResponse {
  sessionId: string
  businessName: string      // never null — fallback is "This Business"
  viewCount: number
  messageCount: number
  createdAt: string
  lastActiveAt: string
}

// POST /api/chat
export interface SendMessageRequest {
  sessionId: string
  message: string
}
export interface SendMessageResponse {
  reply: string
  messageId: string
}

// GET /api/chat?sessionId=
export interface GetChatHistoryResponse {
  sessionId: string
  messages: Array<{
    id: string
    role: 'user' | 'assistant'
    content: string
    createdAt: string
  }>
}

// POST /api/leads
export interface CaptureLeadRequest {
  sessionId: string
  name: string
  contact: string
  message?: string
}
export interface CaptureLeadResponse {
  leadId: string
}

// GET /api/leads?company=
export interface GetLeadsResponse {
  leads: Array<{
    id: string
    sessionId: string
    name: string
    contact: string
    message: string | null
    createdAt: string
  }>
}

// DELETE /api/leads/:id
export interface DeleteLeadResponse {
  deleted: true
  id: string
}

// POST /api/admin/cleanup
export interface CleanupResponse {
  archivedCount: number
  cutoffDate: string   // ISO-8601 — the threshold date used
}

// ─── Error shape (all endpoints use this) ────────────────────────────────────

export interface ApiError {
  error: string
}

// ─── Rate limit shape ────────────────────────────────────────────────────────

export interface RateLimitConfig {
  limit: number
  windowMs: number
  hardCap?: number  // absolute per-session cap (not a sliding window)
}
```

---

## 5. Agent Turn Budgets

| Agent | Budget | Scope |
|-------|--------|-------|
| Backend Agent | 10 turns | Per sprint task |
| Frontend Agent | 8 turns | Per component group |
| QA Agent | 5 turns | Per failing test |
| Code Review | 6 turns | Full pass |
| DevOps Agent | 6 turns | Per setup task |

---

## 6. Testing Strategy

### Philosophy

Explore phase — no coverage gate enforced. Tests exist to give confidence and catch
regressions. Every new function gets at least: one happy path test and one error path test.

### What to Test

| Layer | Tool | Scope | What to Mock |
|-------|------|-------|-------------|
| Route handlers | Vitest + `@testing-library/react` for components | All API routes — happy path + validation errors + auth errors | `db` module, `runReceptionist`, rate limiter |
| Agent logic | Vitest | `fetchBusinessProfile` (Hunter fallback), `buildSystemPrompt` | `fetch` (Hunter HTTP call), `ChatGroq.invoke` |
| Rate limiter | Vitest | All threshold conditions, IP extraction | `Date.now()` (inject via `getNow` param) |
| Middleware | Vitest | `requireOperatorAuth` — correct key, missing header, wrong key | None |
| DB operations | Vitest + better-sqlite3 in-memory | Schema migrations run on `:memory:` DB | None (real SQLite) |
| React components | Vitest + jsdom + `@testing-library/react` | ChatArea, MessageBubble, LeadCaptureCard | `fetch` (API calls) |

### What NOT to Test

- LangSmith SDK integration — test that the trace ID is stored, not that LangSmith received
  the trace (that is an external service contract).
- Groq API response quality — that is a model evaluation problem, not a unit test.
- Railway deployment configuration.

### Test File Conventions

```
src/
  agent/
    receptionist.ts
    receptionist.test.ts          # co-located
  lib/
    rate-limiter.ts
    rate-limiter.test.ts
    middleware/
      operator-auth.ts
      operator-auth.test.ts
  app/api/
    chat/
      route.ts
      route.test.ts
    demo/
      route.ts
      route.test.ts
    leads/
      route.ts
      route.test.ts
```

### Vitest Config (reference)

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
})
```

Test setup file (`src/__tests__/setup.ts`) sets `process.env.NODE_ENV = 'test'` and
`process.env.GROQ_API_KEY = 'test-key'` so startup checks do not exit(1) in test.

---

## 7. LangSmith Integration Spec

### Decision: `traceable` wrapper over `CallbackHandler`

Using `langsmith/traceable` instead of a LangChain `CallbackHandler` because:
- It wraps any async function, not just LangChain objects
- The run ID is available after the call completes via `getCurrentRunTree()`
- Compatible with the direct Groq SDK if we ever drop `@langchain/groq`
- No per-request callback attachment boilerplate

### Implementation Pattern

```typescript
// src/agent/receptionist.ts (modified)
import { traceable } from 'langsmith/traceable'
import { getCurrentRunTree } from 'langsmith'

export const runReceptionist = traceable(
  async (input: ReceptionistInput): Promise<ReceptionistResult> => {
    // ... existing logic ...
    const runTree = getCurrentRunTree()
    const traceId = runTree?.id ?? null
    return { reply, businessProfile: profile, langsmithTraceId: traceId }
  },
  {
    name: 'clara-receptionist',
    project_name: process.env.LANGSMITH_PROJECT ?? `clara-${process.env.NODE_ENV ?? 'development'}`,
    tags: ['v1', 'chat'],
  }
)
```

### Result Type Extension

`ReceptionistResult` must include `langsmithTraceId: string | null`.

The route handler writes this value to the `langsmith_trace_id` column on the assistant
`chat_messages` row. The trace ID is written even if it is `null` (SDK not configured or
test environment) — do not gate the DB write on trace ID presence.

### Environment Behavior

| `NODE_ENV` | `LANGSMITH_TRACING` | Behavior |
|------------|--------------------|-|
| `production` | `"true"` | Traces emitted; startup exits(1) if not set |
| `staging` | `"true"` | Traces emitted |
| `development` | any | Traces emitted if `LANGSMITH_API_KEY` is set; skipped if not |
| `test` | any | Tracing disabled; `langsmithTraceId` is `null` |

LangSmith project naming: `clara-production`, `clara-staging`, `clara-development`.

---

## 8. Error Handling Contract

Every external call follows this pattern. No exceptions.

### Hunter API Calls

```typescript
// Pattern: fetch with AbortSignal.timeout, catch all errors, return typed fallback
try {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
  if (!response.ok) {
    console.warn(`[Clara] Hunter API ${response.status}`)
    return FALLBACK_PROFILE
  }
  return parseProfile(await response.json())
} catch (err) {
  console.warn(`[Clara] Hunter unreachable: ${err instanceof Error ? err.message : String(err)}`)
  return FALLBACK_PROFILE
}
// Never re-throw — degraded mode is correct behavior
```

### Groq API Calls

```typescript
// Pattern: let errors propagate to the route handler which returns 500
// The route handler is responsible for the catch, not the agent
try {
  result = await runReceptionist(input)
} catch (err) {
  console.error('[Clara] Receptionist error:', err)
  return NextResponse.json({ error: 'Agent failed to generate a response' }, { status: 500 })
}
```

### DB Errors

```typescript
// Pattern: let Drizzle errors propagate — they are programming errors, not expected states
// Do NOT catch DB errors in route handlers except for constraint violations
// Rate limit and session existence checks happen before any DB write
```

### HTTP Response Error Shape

All error responses use `ApiError` from the shared type contract:
```json
{ "error": "Human-readable message" }
```

Never include stack traces, internal IDs, or env var names in error responses.

### Status Code Convention

| Condition | Status | Notes |
|-----------|--------|-------|
| Missing required field | 400 | Include field name in message |
| Validation format failure | 400 | Include constraint in message |
| Invalid/missing operator key | 401 | Body: `{"error":"Unauthorized"}` only — no detail |
| Session not found or soft-deleted | 404 | Never return 403 (avoid leaking existence info) |
| Rate limit exceeded | 429 | Include `Retry-After: 60` header |
| Agent/LLM failure | 500 | Generic message only |
| DB connection failure | 500 | Generic message only |

---

## 9. Operator Auth Middleware

```typescript
// src/lib/middleware/operator-auth.ts
import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual, createHash } from 'crypto'

export function requireOperatorAuth(
  req: NextRequest
): NextResponse | null {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const provided = authHeader.slice(7)
  const expected = process.env.CLARA_OPERATOR_API_KEY ?? ''
  if (!expected) {
    // In development, allow if key is not set (warn)
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return null // allow in dev
  }
  // Timing-safe comparison — pad to equal length
  const a = Buffer.from(createHash('sha256').update(provided).digest('hex'))
  const b = Buffer.from(createHash('sha256').update(expected).digest('hex'))
  if (!timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null // null = auth passed
}
```

Usage in route handlers:
```typescript
export async function POST(req: NextRequest) {
  const authError = requireOperatorAuth(req)
  if (authError) return authError
  // ... handler logic
}
```

---

## 10. Rate Limiter Interface

```typescript
// src/lib/rate-limiter.ts
// Inject getNow for testability — tests pass a mock clock function

export interface RateLimiterOptions {
  limit: number
  windowMs: number
  getNow?: () => number  // defaults to Date.now
}

export class InMemoryRateLimiter {
  private store = new Map<string, number[]>()

  constructor(private opts: RateLimiterOptions) {}

  check(key: string): boolean {
    const now = (this.opts.getNow ?? Date.now)()
    const windowStart = now - this.opts.windowMs
    const timestamps = (this.store.get(key) ?? []).filter(t => t > windowStart)
    timestamps.push(now)
    this.store.set(key, timestamps)
    return timestamps.length <= this.opts.limit
  }

  // Call in cleanup interval to prevent unbounded growth
  evictExpired(): void {
    const now = (this.opts.getNow ?? Date.now)()
    for (const [key, timestamps] of this.store) {
      const active = timestamps.filter(t => t > now - this.opts.windowMs)
      if (active.length === 0) this.store.delete(key)
      else this.store.set(key, active)
    }
  }
}

// Singleton instances (one per rate-limited endpoint)
export const chatIpLimiter = new InMemoryRateLimiter({ limit: 10, windowMs: 60_000 })
export const chatHistoryLimiter = new InMemoryRateLimiter({ limit: 30, windowMs: 60_000 })
export const demoCreateLimiter = new InMemoryRateLimiter({ limit: 10, windowMs: 60_000 })
export const demoReadLimiter = new InMemoryRateLimiter({ limit: 30, windowMs: 60_000 })
export const leadsCreateLimiter = new InMemoryRateLimiter({ limit: 5, windowMs: 60_000 })
export const leadsReadLimiter = new InMemoryRateLimiter({ limit: 20, windowMs: 60_000 })
export const cleanupLimiter = new InMemoryRateLimiter({ limit: 2, windowMs: 60_000 })

// Per-session hard caps (checked from DB message_count, not this limiter)
export const SESSION_MESSAGE_HARD_CAP = 200
export const SESSION_MESSAGE_HOURLY_CAP = 20
export const SESSION_LEAD_LIFETIME_CAP = 10

// IP extraction for Railway reverse proxy
export function getClientIP(req: { headers: { get: (k: string) => string | null } }): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const ips = forwarded.split(',').map(s => s.trim())
    const publicIP = ips.find(ip => !isPrivateIP(ip))
    if (publicIP) return publicIP
  }
  return '127.0.0.1'
}

function isPrivateIP(ip: string): boolean {
  return /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|::1$|^$)/.test(ip)
}
```

---

## 11. Input Validation Rules

All validation at the API route boundary before any DB or LLM operation.

| Field | Rule | HTTP 400 message |
|-------|------|-----------------|
| `hubspot_company_id` | Non-empty string, `/^[a-zA-Z0-9\-_]{1,64}$/` | "Invalid hubspot_company_id format" |
| `sessionId` (POST /api/chat) | UUID format `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` | "Invalid sessionId format" |
| `message` | Non-empty, max 2000 chars after trim | "Message cannot be empty" / "Message too long (max 2000 characters)" |
| `uuid` (GET /api/demo) | UUID format | "Invalid uuid format" |
| `name` (POST /api/leads) | Non-empty string, max 200 chars | "name is required" / "name too long" |
| `contact` (POST /api/leads) | Non-empty string, max 200 chars | "contact is required" / "contact too long" |
| `message` (POST /api/leads) | Optional, max 1000 chars | "message too long" |
| `sessionId` (POST /api/leads) | UUID format | "Invalid sessionId format" |
| `company` (GET /api/leads) | Non-empty string, max 64 chars | "company query param required" |
| `id` (DELETE /api/leads/:id) | UUID format | "Invalid lead id format" |

---

## 12. DB Schema (Target State After All Migrations)

The target schema after all 5 migrations are applied. This is what `src/db/schema.ts` must
reflect once Sprint 0 is complete.

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const demoSessions = sqliteTable('demo_sessions', {
  id:               text('id').primaryKey(),
  hubspotCompanyId: text('hubspot_company_id').notNull(),
  businessName:     text('business_name'),
  createdAt:        text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  lastActiveAt:     text('last_active_at').notNull().$defaultFn(() => new Date().toISOString()),
  viewCount:        integer('view_count').notNull().default(0),
  messageCount:     integer('message_count').notNull().default(0),
  deletedAt:        text('deleted_at'),   // Migration 0002
})

export const chatMessages = sqliteTable('chat_messages', {
  id:               text('id').primaryKey(),
  sessionId:        text('session_id').notNull().references(() => demoSessions.id),
  role:             text('role', { enum: ['user', 'assistant'] }).notNull(),
  content:          text('content').notNull(),
  langsmithTraceId: text('langsmith_trace_id'),   // Migration 0003
  createdAt:        text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const leads = sqliteTable('leads', {   // Migration 0004
  id:               text('id').primaryKey(),
  sessionId:        text('session_id').notNull().references(() => demoSessions.id),
  hubspotCompanyId: text('hubspot_company_id').notNull(),
  name:             text('name').notNull(),
  contact:          text('contact').notNull(),
  message:          text('message'),
  createdAt:        text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})
```

---

## 13. Build and Deploy Commands

```bash
# Development
npm run dev          # Next.js dev server on :3002

# Database
npm run db:generate  # drizzle-kit generate (after schema changes)
npm run db:migrate   # drizzle-kit migrate (apply pending migrations)

# Testing
npm run test         # vitest run (all tests, no watch)
npm run test:watch   # vitest --watch
npm run test:ui      # vitest --ui

# Type checking
npm run typecheck    # tsc --noEmit

# Production build
npm run build        # next build
npm run start        # next start (requires successful build)

# Lint
npm run lint         # eslint src/
```

### Railway Deploy Commands (CI/CD)

```bash
# Staging (auto on push to main)
railway deploy --service clara-app --environment staging

# Production (manual approval required)
railway deploy --service clara-app --environment production
```

---

## 14. Definition of Done

A task is Done when ALL of the following are true:

- [ ] Code passes `npm run typecheck` with zero errors
- [ ] All new functions have at least one happy path + one error path test
- [ ] `npm run test` passes (no failures)
- [ ] No TypeScript `any` types introduced
- [ ] `data-testid` on all new interactive UI components
- [ ] Error handling follows the contract in Section 8
- [ ] No hardcoded secrets or API keys in any committed file
- [ ] Input validation at the route boundary for all new endpoints
- [ ] Rate limiting applied before any DB or LLM operation for public endpoints
- [ ] Operator auth applied before any handler logic for protected endpoints
- [ ] Code Review Agent approved

---

## 15. Known Code Divergences (Fix in Sprint 0)

These are bugs in the current code relative to the spec — not opinions, facts.

| Location | Issue | Fix |
|----------|-------|-----|
| `src/app/api/demo/route.ts` lines 38–47 | Deduplicates sessions by `hubspot_company_id` — returns existing session instead of creating new one. PRD US-07 AC: "If the same hubspot_company_id is used multiple times, a new session is created each time." | Remove the `findFirst` deduplication block. Always create a new session. |
| `src/app/api/chat/route.ts` line 110 | `message_count: session.messageCount + 2` — counts both user and assistant messages. The 200-message cap should count user messages only (visitor input, not assistant output). | Change to `message_count: session.messageCount + 1` |
| `src/app/api/chat/route.ts` lines 44–51 | Session lookup does not filter `WHERE deleted_at IS NULL`. Soft-deleted sessions should return 404. | Add `deleted_at IS NULL` filter once Migration 0002 is applied. |
| `src/db/schema.ts` | Missing `deletedAt`, `langsmithTraceId`, and `leads` table. | Apply Migrations 0002–0005 and update schema.ts. |
| `src/agent/receptionist.ts` | LangSmith tracing not wired. `ReceptionistResult` does not include `langsmithTraceId`. | Wrap with `traceable`, extend result type. |

---

*Clara Technical Specification v1.0 — 2026-03-24*
*Author: Tech Lead Agent*
*Next review: Sprint 0 completion or before first real prospect demo is sent*
