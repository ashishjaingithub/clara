// Generated from .spec/api-spec.yaml — update this file when the API spec changes
// Source: /Users/ashishjain/agenticLearning/Clara/.spec/api-spec.yaml
// Cross-referenced with: /Users/ashishjain/agenticLearning/Clara/.spec/technical-spec.md Section 4
// Last synced: 2026-03-24

// ─── Domain entities (mirror Drizzle infer types from src/db/schema.ts) ───────

/** Full demo session row — mirrors the demo_sessions Drizzle schema. */
export interface DemoSession {
  id: string
  hubspotCompanyId: string
  businessName: string | null  // null until first chat message fetches the Hunter profile
  createdAt: string            // ISO-8601 UTC
  lastActiveAt: string         // ISO-8601 UTC
  viewCount: number
  messageCount: number         // counts user messages only (not assistant turns)
  deletedAt: string | null     // ISO-8601 UTC or null; soft-delete via admin cleanup
}

/** Full chat message row — mirrors the chat_messages Drizzle schema. */
export interface ChatMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  langsmithTraceId: string | null  // null in test/dev if tracing not configured
  createdAt: string                // ISO-8601 UTC
}

/** Full lead capture row — mirrors the leads Drizzle schema. */
export interface Lead {
  id: string
  sessionId: string
  hubspotCompanyId: string  // denormalised from session at insert time; never from client
  name: string
  contact: string           // email or phone — single free-text field, not normalised
  message: string | null    // optional note from the visitor
  createdAt: string         // ISO-8601 UTC
}

// ─── Agent / service types ────────────────────────────────────────────────────

/** Single turn in the LangChain message history passed to the receptionist agent. */
export interface MessageHistoryItem {
  role: 'user' | 'assistant'
  content: string
}

/** A pain point surfaced by Hunter's enrichment pipeline for a given business. */
export interface PainPoint {
  problem: string
  aiSolution: string
}

/**
 * Business profile fetched from Hunter's GET /api/business/:hubspot_company_id/profile.
 * All fields except companyId and companyName are optional — Hunter may not have enriched
 * every field for every company.
 */
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

// ─── Shared sub-objects (named schemas from OpenAPI components) ───────────────

/**
 * A single message in the chat history array (GET /api/chat response items).
 * Named ChatMessageSummary in the OpenAPI spec — lighter than the full ChatMessage
 * domain entity (no langsmithTraceId, no sessionId).
 */
export interface ChatMessageSummary {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string  // ISO-8601 UTC
}

/**
 * A single lead in the GET /api/leads response array.
 * Named LeadSummary in the OpenAPI spec — does NOT include hubspotCompanyId
 * (that is an internal field; the operator queries by company param, not per-row).
 */
export interface LeadSummary {
  id: string
  sessionId: string
  name: string
  contact: string           // email or phone
  message: string | null    // optional visitor note; nullable in API response
  createdAt: string         // ISO-8601 UTC
}

// ─── API request shapes ───────────────────────────────────────────────────────

/** POST /api/demo — operator creates a demo session for a HubSpot company. */
export interface CreateDemoRequest {
  hubspot_company_id: string  // snake_case: matches DB column name and OpenAPI spec field
}

/** POST /api/chat — visitor sends a message and receives Clara's reply. */
export interface SendMessageRequest {
  sessionId: string   // UUID of the demo session (from URL or prior response)
  message: string     // 1–2000 characters; trimmed before processing
}

/**
 * POST /api/leads — visitor submits their contact details.
 * hubspot_company_id is intentionally absent: it is read from the session row server-side
 * to prevent cross-tenant injection.
 */
export interface CaptureLeadRequest {
  sessionId: string   // UUID of the session in which the lead was captured
  name: string        // 1–200 characters; free-text, not normalised
  contact: string     // email or phone; 1–200 characters; not validated as email/phone in v1
  message?: string    // optional visitor note; max 1000 characters
}

// ─── API response shapes ──────────────────────────────────────────────────────

/** POST /api/demo 201 — new session created. */
export interface CreateDemoResponse {
  sessionId: string  // UUID of the new session
  uuid: string       // alias of sessionId — both fields contain the same value; `uuid` is
                     // provided for URL construction clarity: `/demo/${uuid}`
}

/**
 * GET /api/demo?uuid= 200 — session metadata for the demo page.
 * businessName is never null here: the fallback is "This Business" when Hunter is unreachable.
 * view_count is incremented server-side on every call to this endpoint.
 */
export interface GetDemoResponse {
  sessionId: string
  businessName: string  // never null in API response; fallback: "This Business"
  viewCount: number
  messageCount: number  // user messages only
  createdAt: string     // ISO-8601 UTC
  lastActiveAt: string  // ISO-8601 UTC
}

/** POST /api/chat 200 — assistant reply returned to the visitor. */
export interface SendMessageResponse {
  reply: string      // Clara's response; plain text, no HTML or Markdown
  messageId: string  // UUID of the assistant chat_messages row (for client-side React keying)
}

/** GET /api/chat?sessionId= 200 — full message history, oldest-first. */
export interface GetChatHistoryResponse {
  sessionId: string
  messages: ChatMessageSummary[]
}

/** POST /api/leads 201 — lead capture acknowledged. */
export interface CaptureLeadResponse {
  leadId: string  // UUID of the new leads row
}

/** GET /api/leads?company= 200 — all lead captures for a company (operator-only). */
export interface GetLeadsResponse {
  leads: LeadSummary[]
}

/** DELETE /api/leads/:id 200 — GDPR Art.17 hard-delete confirmed. */
export interface DeleteLeadResponse {
  deleted: true   // literal true — never false (404 returned if not found)
  id: string      // UUID of the deleted lead
}

/** POST /api/admin/cleanup 200 — session expiry run completed. */
export interface CleanupResponse {
  archivedCount: number  // number of sessions soft-deleted in this run
  cutoffDate: string     // ISO-8601 — the 30-day inactivity threshold date used
}

// ─── Error shape (all endpoints, all status codes ≥ 400) ─────────────────────

/**
 * Standard API error envelope.
 * `error` is a human-readable message. Never includes stack traces, internal IDs, or env
 * var names.
 * `code` is an optional machine-readable error code for client-side error handling
 * (not currently emitted by the v1 implementation but reserved for future use).
 */
export interface ApiError {
  error: string
  code?: string
}

// ─── Rate limit types ─────────────────────────────────────────────────────────

/**
 * Configuration object for InMemoryRateLimiter instances.
 * `hardCap` is an absolute per-session lifetime cap checked against the DB count,
 * not a sliding-window limiter.
 */
export interface RateLimitConfig {
  limit: number
  windowMs: number
  hardCap?: number  // absolute per-session cap (not a sliding window)
}

/**
 * HTTP response headers returned on 429 Too Many Requests.
 * The OpenAPI spec defines a `Retry-After` header on the RateLimited response.
 * `X-RateLimit-*` headers are conventional and reserved for future use.
 */
export interface RateLimitHeaders {
  'X-RateLimit-Limit': number
  'X-RateLimit-Remaining': number
  'X-RateLimit-Reset': number   // Unix epoch seconds when the window resets
  'Retry-After'?: number        // seconds to wait; included on 429 responses
}

// ─── LangSmith / agent result types ──────────────────────────────────────────

/** Input to the runReceptionist traceable function. */
export interface ReceptionistInput {
  sessionId: string
  message: string
  messageHistory: MessageHistoryItem[]
  businessProfile: BusinessProfile
}

/**
 * Output from the runReceptionist traceable function.
 * langsmithTraceId is null when tracing is disabled (test environment, SDK not configured).
 */
export interface ReceptionistResult {
  reply: string
  businessProfile: BusinessProfile
  langsmithTraceId: string | null
}
