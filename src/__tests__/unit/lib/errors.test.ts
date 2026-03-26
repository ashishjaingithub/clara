import { describe, it, expect } from 'vitest'
import {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  RateLimitError,
  ExternalServiceError,
  CalendarError,
  HubSpotError,
  LLMError,
  LLMOutputValidationError,
  DatabaseError,
  classifyError,
  toErrorResponse,
} from '../../../lib/errors'

// ── AppError (base) ───────────────────────────────────────────────────────────

describe('AppError', () => {
  it('stores message, code, and statusCode', () => {
    const err = new AppError('something failed', 'CUSTOM_CODE', 418)
    expect(err.message).toBe('something failed')
    expect(err.code).toBe('CUSTOM_CODE')
    expect(err.statusCode).toBe(418)
  })

  it('defaults statusCode to 500', () => {
    const err = new AppError('oops', 'ERR')
    expect(err.statusCode).toBe(500)
  })

  it('sets name to constructor class name', () => {
    const err = new AppError('oops', 'ERR')
    expect(err.name).toBe('AppError')
  })

  it('is an instance of Error', () => {
    const err = new AppError('oops', 'ERR')
    expect(err).toBeInstanceOf(Error)
  })

  it('toUserMessage returns the message by default', () => {
    const err = new AppError('custom user message', 'ERR')
    expect(err.toUserMessage()).toBe('custom user message')
  })

  it('toJSON includes error and code', () => {
    const err = new AppError('test', 'TEST_CODE', 400)
    const json = err.toJSON()
    expect(json.error).toBe('test')
    expect(json.code).toBe('TEST_CODE')
  })

  it('toJSON omits context in production', () => {
    const orig = process.env.NODE_ENV
    ;(process.env as Record<string, string>).NODE_ENV = 'production'
    const err = new AppError('test', 'T', 500, { secret: 'value' })
    const json = err.toJSON()
    expect(json).not.toHaveProperty('context')
    ;(process.env as Record<string, string>).NODE_ENV = orig
  })

  it('toJSON includes context in non-production', () => {
    const orig = process.env.NODE_ENV
    ;(process.env as Record<string, string>).NODE_ENV = 'development'
    const err = new AppError('test', 'T', 500, { detail: 'extra' })
    const json = err.toJSON() as Record<string, unknown>
    expect(json['context']).toEqual({ detail: 'extra' })
    ;(process.env as Record<string, string>).NODE_ENV = orig
  })
})

// ── ValidationError ───────────────────────────────────────────────────────────

describe('ValidationError', () => {
  it('has statusCode 400', () => {
    const err = new ValidationError('bad input')
    expect(err.statusCode).toBe(400)
  })

  it('has code VALIDATION_ERROR', () => {
    const err = new ValidationError('bad input')
    expect(err.code).toBe('VALIDATION_ERROR')
  })

  it('accepts context', () => {
    const err = new ValidationError('bad input', { field: 'email' })
    expect(err.context).toEqual({ field: 'email' })
  })
})

// ── NotFoundError ─────────────────────────────────────────────────────────────

describe('NotFoundError', () => {
  it('has statusCode 404', () => {
    const err = new NotFoundError('Session')
    expect(err.statusCode).toBe(404)
  })

  it('has code NOT_FOUND', () => {
    const err = new NotFoundError('Lead')
    expect(err.code).toBe('NOT_FOUND')
  })

  it('includes resource name in message', () => {
    const err = new NotFoundError('Session')
    expect(err.message).toContain('Session')
  })

  it('includes id in message when provided', () => {
    const err = new NotFoundError('Session', 'abc-123')
    expect(err.message).toContain('abc-123')
  })
})

// ── UnauthorizedError ─────────────────────────────────────────────────────────

describe('UnauthorizedError', () => {
  it('has statusCode 401', () => {
    const err = new UnauthorizedError()
    expect(err.statusCode).toBe(401)
  })

  it('has code UNAUTHORIZED', () => {
    const err = new UnauthorizedError()
    expect(err.code).toBe('UNAUTHORIZED')
  })

  it('toUserMessage returns auth required text', () => {
    const err = new UnauthorizedError()
    expect(err.toUserMessage()).toContain('Authentication')
  })
})

// ── ForbiddenError ────────────────────────────────────────────────────────────

describe('ForbiddenError', () => {
  it('has statusCode 403', () => {
    const err = new ForbiddenError()
    expect(err.statusCode).toBe(403)
  })

  it('has code FORBIDDEN', () => {
    const err = new ForbiddenError()
    expect(err.code).toBe('FORBIDDEN')
  })

  it('toUserMessage returns permission text', () => {
    const err = new ForbiddenError()
    expect(err.toUserMessage()).toContain('permission')
  })
})

// ── RateLimitError ────────────────────────────────────────────────────────────

describe('RateLimitError', () => {
  it('has statusCode 429', () => {
    const err = new RateLimitError()
    expect(err.statusCode).toBe(429)
  })

  it('has code RATE_LIMIT', () => {
    const err = new RateLimitError()
    expect(err.code).toBe('RATE_LIMIT')
  })

  it('accepts retryAfterMs in context', () => {
    const err = new RateLimitError(5000)
    expect(err.context?.['retryAfterMs']).toBe(5000)
  })

  it('toUserMessage advises user to wait', () => {
    const err = new RateLimitError()
    expect(err.toUserMessage()).toContain('requests')
  })
})

// ── ExternalServiceError ──────────────────────────────────────────────────────

describe('ExternalServiceError', () => {
  it('has statusCode 502', () => {
    const err = new ExternalServiceError('TestService')
    expect(err.statusCode).toBe(502)
  })

  it('has code EXTERNAL_SERVICE_ERROR', () => {
    const err = new ExternalServiceError('TestService')
    expect(err.code).toBe('EXTERNAL_SERVICE_ERROR')
  })

  it('includes service name in message', () => {
    const err = new ExternalServiceError('HubSpot')
    expect(err.message).toContain('HubSpot')
  })

  it('chains cause when cause is an Error', () => {
    const cause = new Error('upstream failure')
    const err = new ExternalServiceError('TestService', cause)
    expect(err.cause).toBe(cause)
  })

  it('stringifies non-Error cause', () => {
    const err = new ExternalServiceError('TestService', 'string cause')
    expect(err.context?.['cause']).toBe('string cause')
  })

  it('toUserMessage returns generic unavailable text', () => {
    const err = new ExternalServiceError('TestService')
    expect(err.toUserMessage()).toContain('unavailable')
  })
})

// ── CalendarError ─────────────────────────────────────────────────────────────

describe('CalendarError', () => {
  it('is an instance of ExternalServiceError', () => {
    const err = new CalendarError()
    expect(err).toBeInstanceOf(ExternalServiceError)
  })

  it('has name CalendarError', () => {
    const err = new CalendarError()
    expect(err.name).toBe('CalendarError')
  })

  it('has statusCode 502', () => {
    const err = new CalendarError()
    expect(err.statusCode).toBe(502)
  })

  it('includes Google Calendar in message', () => {
    const err = new CalendarError()
    expect(err.message).toContain('Google Calendar')
  })

  it('chains Error cause', () => {
    const cause = new Error('API quota exceeded')
    const err = new CalendarError(cause)
    expect(err.cause).toBe(cause)
  })
})

// ── HubSpotError ──────────────────────────────────────────────────────────────

describe('HubSpotError', () => {
  it('is an instance of ExternalServiceError', () => {
    const err = new HubSpotError()
    expect(err).toBeInstanceOf(ExternalServiceError)
  })

  it('has name HubSpotError', () => {
    const err = new HubSpotError()
    expect(err.name).toBe('HubSpotError')
  })

  it('has statusCode 502', () => {
    const err = new HubSpotError()
    expect(err.statusCode).toBe(502)
  })

  it('includes HubSpot in message', () => {
    const err = new HubSpotError()
    expect(err.message).toContain('HubSpot')
  })
})

// ── LLMError ──────────────────────────────────────────────────────────────────

describe('LLMError', () => {
  it('has statusCode 502', () => {
    const err = new LLMError('generation failed')
    expect(err.statusCode).toBe(502)
  })

  it('has code LLM_ERROR', () => {
    const err = new LLMError('generation failed')
    expect(err.code).toBe('LLM_ERROR')
  })

  it('chains Error cause', () => {
    const cause = new Error('timeout')
    const err = new LLMError('agent failed', cause)
    expect(err.cause).toBe(cause)
  })

  it('toUserMessage returns AI processing failed text', () => {
    const err = new LLMError('oops')
    expect(err.toUserMessage()).toContain('AI processing')
  })
})

// ── LLMOutputValidationError ──────────────────────────────────────────────────

describe('LLMOutputValidationError', () => {
  it('has statusCode 502', () => {
    const err = new LLMOutputValidationError('slot-extraction')
    expect(err.statusCode).toBe(502)
  })

  it('has code LLM_OUTPUT_INVALID', () => {
    const err = new LLMOutputValidationError('slot-extraction')
    expect(err.code).toBe('LLM_OUTPUT_INVALID')
  })

  it('includes task name in message', () => {
    const err = new LLMOutputValidationError('contact-parse')
    expect(err.message).toContain('contact-parse')
  })
})

// ── DatabaseError ─────────────────────────────────────────────────────────────

describe('DatabaseError', () => {
  it('has statusCode 500', () => {
    const err = new DatabaseError('insert')
    expect(err.statusCode).toBe(500)
  })

  it('has code DATABASE_ERROR', () => {
    const err = new DatabaseError('insert')
    expect(err.code).toBe('DATABASE_ERROR')
  })

  it('includes operation in message', () => {
    const err = new DatabaseError('update session')
    expect(err.message).toContain('update session')
  })

  it('chains Error cause', () => {
    const cause = new Error('disk full')
    const err = new DatabaseError('write', cause)
    expect(err.cause).toBe(cause)
  })

  it('toUserMessage returns data error text', () => {
    const err = new DatabaseError('read')
    expect(err.toUserMessage()).toContain('data error')
  })
})

// ── classifyError ─────────────────────────────────────────────────────────────

describe('classifyError', () => {
  it('classifies ValidationError as low severity, not retryable', () => {
    const result = classifyError(new ValidationError('bad'))
    expect(result.severity).toBe('low')
    expect(result.retryable).toBe(false)
    expect(result.statusCode).toBe(400)
  })

  it('classifies NotFoundError as low severity', () => {
    const result = classifyError(new NotFoundError('Session'))
    expect(result.severity).toBe('low')
    expect(result.retryable).toBe(false)
  })

  it('classifies UnauthorizedError as medium severity', () => {
    const result = classifyError(new UnauthorizedError())
    expect(result.severity).toBe('medium')
    expect(result.retryable).toBe(false)
  })

  it('classifies ForbiddenError as medium severity', () => {
    const result = classifyError(new ForbiddenError())
    expect(result.severity).toBe('medium')
  })

  it('classifies RateLimitError as medium severity, retryable', () => {
    const result = classifyError(new RateLimitError())
    expect(result.severity).toBe('medium')
    expect(result.retryable).toBe(true)
  })

  it('classifies ExternalServiceError as high severity, retryable', () => {
    const result = classifyError(new ExternalServiceError('S3'))
    expect(result.severity).toBe('high')
    expect(result.retryable).toBe(true)
  })

  it('classifies CalendarError as high severity (inherits ExternalServiceError)', () => {
    const result = classifyError(new CalendarError())
    expect(result.severity).toBe('high')
    expect(result.retryable).toBe(true)
  })

  it('classifies LLMError as high severity, retryable', () => {
    const result = classifyError(new LLMError('failed'))
    expect(result.severity).toBe('high')
    expect(result.retryable).toBe(true)
  })

  it('classifies unknown Error as critical, not retryable', () => {
    const result = classifyError(new Error('something unknown'))
    expect(result.severity).toBe('critical')
    expect(result.code).toBe('UNKNOWN')
    expect(result.statusCode).toBe(500)
  })

  it('classifies non-Error values as critical', () => {
    const result = classifyError('a string error')
    expect(result.severity).toBe('critical')
  })
})

// ── toErrorResponse ───────────────────────────────────────────────────────────

describe('toErrorResponse', () => {
  it('returns Response with correct status for AppError subclass', async () => {
    const err = new ValidationError('invalid email')
    const res = toErrorResponse(err)
    expect(res.status).toBe(400)
    const body = await res.json() as Record<string, unknown>
    expect(body['error']).toBe('invalid email')
    expect(body['code']).toBe('VALIDATION_ERROR')
  })

  it('returns 404 for NotFoundError', async () => {
    const err = new NotFoundError('Demo session')
    const res = toErrorResponse(err)
    expect(res.status).toBe(404)
  })

  it('returns 500 with generic message for unknown errors', async () => {
    const res = toErrorResponse(new Error('unexpected database crash'))
    expect(res.status).toBe(500)
    const body = await res.json() as Record<string, unknown>
    expect(body['error']).toBe('Internal server error')
    expect(body['code']).toBe('INTERNAL_ERROR')
  })

  it('returns 500 for non-Error thrown values', async () => {
    const res = toErrorResponse('something bad happened')
    expect(res.status).toBe(500)
    const body = await res.json() as Record<string, unknown>
    expect(body['code']).toBe('INTERNAL_ERROR')
  })

  it('does not expose internal Error message for unknown errors', async () => {
    const res = toErrorResponse(new Error('db_password=secret123'))
    const body = await res.json() as Record<string, unknown>
    // Internal error details must NOT leak
    expect(body['error']).not.toContain('db_password')
  })
})
