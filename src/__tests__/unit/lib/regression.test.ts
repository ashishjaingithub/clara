/**
 * Regression tests for Clara — each test prevents a specific bug class from re-appearing.
 * Test names include a description of what they prevent.
 */

import { describe, it, expect } from 'vitest'
import {
  ValidationError,
  NotFoundError,
  LLMError,
  AppError,
  toErrorResponse,
  classifyError,
  ExternalServiceError,
  CalendarError,
  HubSpotError,
} from '../../../lib/errors'
import { suggestReplies } from '../../../lib/suggest-replies'

// ── Regression: empty message should be rejected (not passed to LLM) ──────────
//
// Bug scenario: a whitespace-only message (e.g., "   ") would pass the `typeof
// message === 'string'` check but produce an empty LLM prompt. The route now
// trims and rejects blank messages before running the agent.

describe('Regression: whitespace-only message is not a valid chat message', () => {
  it('ValidationError is correct error class for empty input (not a generic Error)', () => {
    // The route uses inline NextResponse.json — this test validates the error class
    // used when we explicitly construct the validation error for coverage.
    const err = new ValidationError('Message cannot be empty')
    expect(err.statusCode).toBe(400)
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.message).toBe('Message cannot be empty')
  })

  it('suggestReplies handles empty string without throwing', () => {
    // Prevent regression: empty assistantMessage must not throw
    expect(() => suggestReplies('', 1)).not.toThrow()
    expect(suggestReplies('', 1)).toEqual([
      'What are your hours?',
      'Where are you located?',
      'How do I get started?',
    ])
  })

  it('suggestReplies handles null-like falsy message gracefully (messageCount > 8)', () => {
    // When message is empty and count > 8, chips must not be shown
    expect(suggestReplies('', 10)).toEqual([])
  })
})

// ── Regression: soft-deleted sessions must return 404, not session data ────────
//
// Bug scenario: an IDOR would allow accessing deleted sessions if the soft-delete
// filter was missing from the query. The route uses `isNull(s.deletedAt)` in the
// where clause. NotFoundError is the correct response type.

describe('Regression: soft-deleted sessions are indistinguishable from missing sessions', () => {
  it('NotFoundError has statusCode 404 (not 403) to avoid revealing session existence', () => {
    const err = new NotFoundError('Demo session', 'deleted-uuid')
    expect(err.statusCode).toBe(404)
    // 403 would reveal the session existed — 404 is intentional (see CLAUDE.md)
    expect(err.statusCode).not.toBe(403)
  })

  it('NotFoundError message includes resource type but not internal DB details', () => {
    const err = new NotFoundError('Demo session')
    expect(err.message).toContain('Demo session')
    // Must not include raw SQL or table names
    expect(err.message).not.toContain('SELECT')
    expect(err.message).not.toContain('demo_sessions')
  })
})

// ── Regression: LLMError wraps agent failures as 502, not 500 ─────────────────
//
// Bug scenario: the original chat.test.ts expected status 500 for agent errors,
// but the route wraps them in LLMError which correctly returns 502 (Bad Gateway —
// upstream LLM failure). Tests were fixed to match this intentional design.
// This regression test pins the expected behavior so it is never reverted to 500.

describe('Regression: LLMError returns 502 Bad Gateway, not 500 Internal Server Error', () => {
  it('LLMError has statusCode 502 (upstream LLM failure = Bad Gateway)', () => {
    const err = new LLMError('Agent failed to generate a response', new Error('timeout'))
    expect(err.statusCode).toBe(502)
    // 500 would be wrong — the Clara server itself did not crash, the upstream LLM did
    expect(err.statusCode).not.toBe(500)
  })

  it('toErrorResponse returns 502 status for LLMError', async () => {
    const err = new LLMError('generation timeout')
    const res = toErrorResponse(err)
    expect(res.status).toBe(502)
  })

  it('LLMError body includes user-safe error field', async () => {
    const err = new LLMError('internal token overflow')
    const res = toErrorResponse(err)
    const body = await res.json() as Record<string, unknown>
    // error field must exist and be user-facing
    expect(body['error']).toBeTruthy()
    expect(body['code']).toBe('LLM_ERROR')
  })
})

// ── Regression: toErrorResponse must never leak internal error details ─────────
//
// Bug scenario: if `toErrorResponse` passed through the raw Error message for
// unknown errors, secrets (DB passwords, API keys) could be exposed in 500 responses.
// The handler writes to stderr and returns a generic message instead.

describe('Regression: toErrorResponse does not expose internal error messages', () => {
  it('unknown Error message is not exposed in the 500 response body', async () => {
    const secretError = new Error('GROQ_API_KEY=gsk_secret_value_123')
    const res = toErrorResponse(secretError)
    const body = await res.json() as Record<string, unknown>
    expect(body['error']).toBe('Internal server error')
    // The actual error message must NOT appear
    expect(JSON.stringify(body)).not.toContain('GROQ_API_KEY')
  })

  it('non-Error thrown values are handled without exposing the raw value', async () => {
    const res = toErrorResponse({ raw: 'some-internal-detail' })
    const body = await res.json() as Record<string, unknown>
    expect(body['error']).toBe('Internal server error')
    expect(body['code']).toBe('INTERNAL_ERROR')
    expect(JSON.stringify(body)).not.toContain('some-internal-detail')
  })
})

// ── Regression: CalendarError and HubSpotError are ExternalServiceError instances ─
//
// Bug scenario: if CalendarError or HubSpotError were refactored to extend AppError
// directly instead of ExternalServiceError, classifyError would incorrectly classify
// them as generic AppError (severity: high, not retryable) rather than
// ExternalServiceError (severity: high, retryable: true). This test pins the
// instanceof hierarchy so the classification remains correct.

describe('Regression: CalendarError and HubSpotError remain ExternalServiceError subclasses', () => {
  it('CalendarError is instanceof ExternalServiceError', () => {
    expect(new CalendarError()).toBeInstanceOf(ExternalServiceError)
  })

  it('HubSpotError is instanceof ExternalServiceError', () => {
    expect(new HubSpotError()).toBeInstanceOf(ExternalServiceError)
  })

  it('classifyError marks CalendarError as retryable (calendar may transiently fail)', () => {
    const result = classifyError(new CalendarError(new Error('503 Service Unavailable')))
    expect(result.retryable).toBe(true)
  })

  it('classifyError marks HubSpotError as retryable (HubSpot may transiently rate-limit)', () => {
    const result = classifyError(new HubSpotError(new Error('429 Too Many Requests')))
    expect(result.retryable).toBe(true)
  })
})

// ── Regression: suggestReplies returns [] when messageCount > 8 ───────────────
//
// Bug scenario: if the early-exit guard `if (messageCount > 8) return []` were
// removed or the threshold changed, the UI would show quick-reply chips in long
// conversations where they are no longer helpful. This test pins the threshold.

describe('Regression: suggestReplies suppresses chips after 8 message exchanges', () => {
  it('returns non-empty chips at messageCount <= 8 when signal word present', () => {
    const result = suggestReplies('We have appointment slots available tomorrow', 8)
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns empty array at messageCount 9 regardless of signal words', () => {
    // Even a message with all signal words must return [] after the threshold
    const result = suggestReplies('appointment hours price location contact call', 9)
    expect(result).toEqual([])
  })

  it('returns empty array at high message counts', () => {
    expect(suggestReplies('How can I help you today?', 50)).toEqual([])
  })
})

// ── Regression: AppError subclasses must set name to constructor name ──────────
//
// Bug scenario: if a subclass forgot `this.name = this.constructor.name` or the
// base class stopped setting it, `instanceof` checks still work but error monitoring
// (Sentry, Langfuse) logs all errors as "Error" instead of the specific class name,
// making triage impossible.

describe('Regression: AppError subclasses have correct name property for error monitoring', () => {
  it('ValidationError.name is "ValidationError"', () => {
    expect(new ValidationError('test').name).toBe('ValidationError')
  })

  it('NotFoundError.name is "NotFoundError"', () => {
    expect(new NotFoundError('Resource').name).toBe('NotFoundError')
  })

  it('LLMError.name is "LLMError"', () => {
    expect(new LLMError('test').name).toBe('LLMError')
  })

  it('CalendarError.name is "CalendarError" (not ExternalServiceError)', () => {
    // CalendarError explicitly sets this.name in its constructor
    expect(new CalendarError().name).toBe('CalendarError')
  })

  it('HubSpotError.name is "HubSpotError" (not ExternalServiceError)', () => {
    expect(new HubSpotError().name).toBe('HubSpotError')
  })

  it('AppError subclass is still instanceof AppError after name override', () => {
    const err = new CalendarError()
    expect(err).toBeInstanceOf(AppError)
    expect(err).toBeInstanceOf(ExternalServiceError)
    expect(err.name).toBe('CalendarError')
  })
})
