import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Unit tests for DELETE /api/leads/[id]
 *
 * Strategy:
 * - Mock `@/db/index` to avoid real SQLite.
 * - Mock `@/lib/rate-limit` to control rate-limiting.
 * - All auth validation uses the real `@/lib/auth` (no mock) — it reads
 *   OPERATOR_API_KEY from process.env, which we set in each test.
 */

const { mockDelete, mockFindFirst, mockWhere, mockReturning } = vi.hoisted(() => {
  const mockReturning = vi.fn()
  const mockWhere = vi.fn(() => ({ returning: mockReturning }))
  const mockDelete = vi.fn(() => ({ where: mockWhere }))
  const mockFindFirst = vi.fn()
  return { mockDelete, mockFindFirst, mockWhere, mockReturning }
})

vi.mock('@/db/index', () => ({
  db: {
    delete: mockDelete,
    query: {
      leads: { findFirst: mockFindFirst },
    },
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  leadsReadLimiter: { check: vi.fn().mockReturnValue({ allowed: true }) },
  getClientIP: vi.fn().mockReturnValue('203.0.113.5'),
}))

import { DELETE } from '../../../app/api/leads/[id]/route'

const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
const OPERATOR_KEY = 'test-operator-key-secret'

function makeDeleteRequest(id: string, authKey?: string): NextRequest {
  return new NextRequest(`http://localhost:3002/api/leads/${id}`, {
    method: 'DELETE',
    headers: authKey ? { authorization: `Bearer ${authKey}` } : {},
  })
}

describe('DELETE /api/leads/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear key so auth is bypassed by default in dev/test mode
    delete process.env.CLARA_OPERATOR_API_KEY
  })

  // ── auth gate ─────────────────────────────────────────────────────────────

  it('returns 401 when no auth header is provided', async () => {
    const req = makeDeleteRequest(VALID_UUID)
    const res = await DELETE(req, { params: Promise.resolve({ id: VALID_UUID }) })
    expect(res.status).toBe(401)
  })

  it('returns 401 when wrong API key is provided', async () => {
    process.env.CLARA_OPERATOR_API_KEY = OPERATOR_KEY  // activate auth enforcement
    const req = makeDeleteRequest(VALID_UUID, 'wrong-key')
    const res = await DELETE(req, { params: Promise.resolve({ id: VALID_UUID }) })
    expect(res.status).toBe(401)
  })

  // ── rate limit gate ───────────────────────────────────────────────────────

  it('returns 429 when rate limit is exceeded', async () => {
    const { leadsReadLimiter } = await import('@/lib/rate-limit')
    vi.mocked(leadsReadLimiter.check).mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 })

    const req = makeDeleteRequest(VALID_UUID, OPERATOR_KEY)
    const res = await DELETE(req, { params: Promise.resolve({ id: VALID_UUID }) })

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toMatch(/rate limit/i)
    expect(res.headers.get('Retry-After')).toBe('60')
  })

  // ── UUID validation ───────────────────────────────────────────────────────

  it('returns 400 when id is empty string', async () => {
    const req = makeDeleteRequest('', OPERATOR_KEY)
    const res = await DELETE(req, { params: Promise.resolve({ id: '' }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid lead id/i)
  })

  it('returns 400 when id is not a valid UUID (plain text)', async () => {
    const req = makeDeleteRequest('not-a-uuid', OPERATOR_KEY)
    const res = await DELETE(req, { params: Promise.resolve({ id: 'not-a-uuid' }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid lead id/i)
  })

  it('returns 400 when id is a SQL injection attempt', async () => {
    const injection = "1' OR '1'='1"
    const req = makeDeleteRequest(injection, OPERATOR_KEY)
    const res = await DELETE(req, { params: Promise.resolve({ id: injection }) })
    expect(res.status).toBe(400)
    expect(mockFindFirst).not.toHaveBeenCalled()
  })

  it('returns 400 when id is a UUID-like string with wrong length', async () => {
    const bad = 'a1b2c3d4-e5f6-7890-abcd-ef123456789' // one char short
    const req = makeDeleteRequest(bad, OPERATOR_KEY)
    const res = await DELETE(req, { params: Promise.resolve({ id: bad }) })
    expect(res.status).toBe(400)
  })

  // ── not found ─────────────────────────────────────────────────────────────

  it('returns 404 when lead does not exist in the database', async () => {
    mockFindFirst.mockResolvedValue(undefined)

    const req = makeDeleteRequest(VALID_UUID, OPERATOR_KEY)
    const res = await DELETE(req, { params: Promise.resolve({ id: VALID_UUID }) })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/not found/i)
    expect(mockDelete).not.toHaveBeenCalled()
  })

  // ── successful delete ─────────────────────────────────────────────────────

  it('returns 200 with deleted: true when lead exists', async () => {
    mockFindFirst.mockResolvedValue({
      id: VALID_UUID,
      sessionId: 'sess-1',
      name: 'Test User',
      contact: 'test@example.com',
    })
    mockReturning.mockResolvedValue([{ id: VALID_UUID }])

    const req = makeDeleteRequest(VALID_UUID, OPERATOR_KEY)
    const res = await DELETE(req, { params: Promise.resolve({ id: VALID_UUID }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.deleted).toBe(true)
    expect(body.id).toBe(VALID_UUID)
    expect(mockDelete).toHaveBeenCalledOnce()
  })

  it('passes the UUID filter to db.delete (not full id)', async () => {
    mockFindFirst.mockResolvedValue({ id: VALID_UUID })
    mockReturning.mockResolvedValue([])

    const req = makeDeleteRequest(VALID_UUID, OPERATOR_KEY)
    await DELETE(req, { params: Promise.resolve({ id: VALID_UUID }) })

    expect(mockDelete).toHaveBeenCalledOnce()
    // where() was called — verifies the delete is scoped
    expect(mockWhere).toHaveBeenCalledOnce()
  })

  // ── chaos: malformed UUID edge cases ─────────────────────────────────────

  it('rejects UUID with null-byte injection', async () => {
    const nullByte = 'a1b2c3d4-e5f6-7890-abcd-ef1234567\x008'
    const res = await DELETE(
      makeDeleteRequest(nullByte, OPERATOR_KEY),
      { params: Promise.resolve({ id: nullByte }) },
    )
    expect(res.status).toBe(400)
    expect(mockFindFirst).not.toHaveBeenCalled()
  })

  it('rejects a 500-char id without hitting the DB', async () => {
    const huge = 'a'.repeat(500)
    const res = await DELETE(
      makeDeleteRequest(huge, OPERATOR_KEY),
      { params: Promise.resolve({ id: huge }) },
    )
    expect(res.status).toBe(400)
    expect(mockFindFirst).not.toHaveBeenCalled()
  })

  it('handles uppercase UUID correctly (case-insensitive regex)', async () => {
    const upper = VALID_UUID.toUpperCase()
    mockFindFirst.mockResolvedValue({ id: upper })
    mockReturning.mockResolvedValue([{ id: upper }])

    const res = await DELETE(
      makeDeleteRequest(upper, OPERATOR_KEY),
      { params: Promise.resolve({ id: upper }) },
    )
    expect(res.status).toBe(200)
  })
})
