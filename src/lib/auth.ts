import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual, createHash } from 'crypto'

/**
 * Middleware for operator-only endpoints.
 *
 * Checks the `Authorization: Bearer <CLARA_OPERATOR_API_KEY>` header.
 * Uses timing-safe comparison (via SHA-256 hashing to ensure equal buffer lengths).
 *
 * Returns null if auth passes (caller continues).
 * Returns a 401 NextResponse if auth fails (caller should return it immediately).
 *
 * Behaviour by environment:
 * - production: API key is required — exit(1) if not set at startup (see startup.ts)
 * - development: if CLARA_OPERATOR_API_KEY is not set, auth is bypassed with a warning
 * - test: same as development (key not required unless explicitly set)
 */
export function requireOperatorAuth(req: NextRequest): NextResponse | null {
  const authHeader = req.headers.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const provided = authHeader.slice(7)
  const expected = process.env.CLARA_OPERATOR_API_KEY ?? ''

  if (!expected) {
    // In production, CLARA_OPERATOR_API_KEY must be set (enforced by startup.ts).
    // In dev/test, if not set, allow through with a warning.
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.warn('[Clara] CLARA_OPERATOR_API_KEY is not set — operator auth bypassed in dev/test')
    return null
  }

  // Hash both values to ensure equal buffer lengths for timingSafeEqual
  const a = Buffer.from(createHash('sha256').update(provided).digest('hex'))
  const b = Buffer.from(createHash('sha256').update(expected).digest('hex'))

  if (!timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null // null = auth passed
}
