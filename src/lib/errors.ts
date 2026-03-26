/**
 * Clara Error Class Hierarchy
 * Copied from agentic-standards/templates/typescript/errors.ts
 * and adapted for Clara (Iterate-phase AI receptionist).
 *
 * Clara uses SQLite via Drizzle — DatabaseError is included.
 * CalendarError and HubSpotError extend ExternalServiceError for Clara-specific failures.
 *
 * See .claude/rules/error-handling.md for usage rules.
 */

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message)
    this.name = this.constructor.name
    // Maintains proper stack trace in V8 (Node.js and Chrome)
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }

  /** User-safe message — never expose internal details to end users */
  toUserMessage(): string {
    return this.message
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      // Only expose context in non-production environments
      ...(process.env.NODE_ENV !== 'production' && this.context
        ? { context: this.context }
        : {}),
    }
  }
}

// ── Validation ────────────────────────────────────────────────────────────────

export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, context)
  }
}

// ── Not Found ─────────────────────────────────────────────────────────────────

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} not found: ${id}` : `${resource} not found`,
      'NOT_FOUND',
      404,
    )
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401)
  }
  toUserMessage() { return 'Authentication required.' }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN', 403)
  }
  toUserMessage() { return 'You do not have permission to perform this action.' }
}

// ── Rate Limiting ─────────────────────────────────────────────────────────────

export class RateLimitError extends AppError {
  constructor(retryAfterMs?: number) {
    super('Rate limit exceeded', 'RATE_LIMIT', 429, { retryAfterMs })
  }
  toUserMessage() { return 'Too many requests. Please wait a moment and try again.' }
}

// ── External Services ─────────────────────────────────────────────────────────

export class ExternalServiceError extends AppError {
  constructor(service: string, cause?: unknown) {
    super(
      `${service} is currently unavailable`,
      'EXTERNAL_SERVICE_ERROR',
      502,
      {
        service,
        cause: cause instanceof Error ? cause.message : String(cause),
      },
    )
    if (cause instanceof Error) this.cause = cause
  }
  toUserMessage() {
    return 'A required service is temporarily unavailable. Please try again in a moment.'
  }
}

// ── Google Calendar ────────────────────────────────────────────────────────────

export class CalendarError extends ExternalServiceError {
  constructor(cause?: unknown) {
    super('Google Calendar', cause)
    this.name = 'CalendarError'
  }
}

// ── HubSpot CRM ───────────────────────────────────────────────────────────────

export class HubSpotError extends ExternalServiceError {
  constructor(cause?: unknown) {
    super('HubSpot', cause)
    this.name = 'HubSpotError'
  }
}

// ── LLM / AI ──────────────────────────────────────────────────────────────────

export class LLMError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, 'LLM_ERROR', 502, {
      cause: cause instanceof Error ? cause.message : String(cause),
    })
    if (cause instanceof Error) this.cause = cause
  }
  toUserMessage() { return 'AI processing failed. Please try again.' }
}

export class LLMOutputValidationError extends AppError {
  constructor(task: string, parseError?: unknown) {
    super(
      `LLM returned invalid structure for task: ${task}`,
      'LLM_OUTPUT_INVALID',
      502,
      { task, parseError: String(parseError) },
    )
  }
  toUserMessage() { return 'AI processing failed. Please try again.' }
}

// ── Database ──────────────────────────────────────────────────────────────────

export class DatabaseError extends AppError {
  constructor(operation: string, cause?: unknown) {
    super(
      `Database operation failed: ${operation}`,
      'DATABASE_ERROR',
      500,
      { operation, cause: cause instanceof Error ? cause.message : String(cause) },
    )
    if (cause instanceof Error) this.cause = cause
  }
  toUserMessage() { return 'A data error occurred. Please try again.' }
}

// ── Utility ───────────────────────────────────────────────────────────────────

/**
 * Classify an unknown error for monitoring/metrics.
 * Use when emitting to error-events.jsonl.
 */
export function classifyError(err: unknown): {
  code: string
  statusCode: number
  retryable: boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
} {
  if (err instanceof ValidationError || err instanceof NotFoundError) {
    return { code: err.code, statusCode: err.statusCode, retryable: false, severity: 'low' }
  }
  if (err instanceof UnauthorizedError || err instanceof ForbiddenError) {
    return { code: err.code, statusCode: err.statusCode, retryable: false, severity: 'medium' }
  }
  if (err instanceof RateLimitError) {
    return { code: err.code, statusCode: err.statusCode, retryable: true, severity: 'medium' }
  }
  if (err instanceof ExternalServiceError || err instanceof LLMError) {
    return { code: err.code, statusCode: err.statusCode, retryable: true, severity: 'high' }
  }
  if (err instanceof AppError) {
    return { code: err.code, statusCode: err.statusCode, retryable: false, severity: 'high' }
  }
  return { code: 'UNKNOWN', statusCode: 500, retryable: false, severity: 'critical' }
}

/**
 * Standard API route error handler.
 * Use in every route's catch block.
 *
 * Usage:
 *   import { toErrorResponse } from '@/lib/errors'
 *   catch (err) { return toErrorResponse(err) }
 */
export function toErrorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json(err.toJSON(), { status: err.statusCode })
  }
  // Unknown error — never expose internals in production
  process.stderr.write(`[Clara] [UNHANDLED_ERROR] ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`)
  // Lazy import to avoid circular dependency (errors.ts is imported by error-tracker.ts)
  import('./error-tracker').then(({ trackError }) => {
    trackError(err, { operation: 'api-route-unhandled' })
  }).catch((importErr) => { process.stderr.write(`[Clara] Failed to load error tracker: ${importErr instanceof Error ? importErr.message : String(importErr)}\n`) })
  return Response.json(
    { error: 'Internal server error', code: 'INTERNAL_ERROR' },
    { status: 500 },
  )
}
