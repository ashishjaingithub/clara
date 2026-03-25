import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Route handler tests for /api/demo
 *
 * Strategy:
 * - Import the route handlers directly (not via HTTP).
 * - Mock `@/db/index` so no real SQLite is needed.
 * - Mock `@/lib/rate-limit` so rate limits do not interfere (default: allowed).
 * - Set CLARA_OPERATOR_API_KEY to a known value before each test.
 *
 * vi.hoisted() is used to create mock functions before vi.mock() hoisting
 * moves the factory call to the top of the file.
 */

// ── Hoist mock functions so they are available inside vi.mock() factories ─────
const { mockInsert, mockUpdate, mockFindFirst, mockDemoCreateLimiter, mockDemoReadLimiter } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockFindFirst: vi.fn(),
  mockDemoCreateLimiter: vi.fn().mockReturnValue({ allowed: true }),
  mockDemoReadLimiter: vi.fn().mockReturnValue({ allowed: true }),
}))

// ── DB mock ───────────────────────────────────────────────────────────────────
vi.mock('@/db/index', () => ({
  db: {
    insert: () => ({ values: mockInsert }),
    update: () => ({ set: () => ({ where: mockUpdate }) }),
    query: {
      demoSessions: {
        findFirst: mockFindFirst,
      },
    },
  },
}))

// ── Rate limiter mock (all allowed by default) ────────────────────────────────
vi.mock('@/lib/rate-limit', () => ({
  demoCreateLimiter: { check: mockDemoCreateLimiter },
  demoReadLimiter: { check: mockDemoReadLimiter },
  getClientIP: vi.fn().mockReturnValue('203.0.113.1'),
}))

// Import AFTER mocks are registered
import { POST, GET } from '../../../app/api/demo/route'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePostRequest(body: unknown, authHeader?: string): NextRequest {
  return new NextRequest('http://localhost:3002/api/demo', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authHeader ? { authorization: authHeader } : {}),
    },
    body: JSON.stringify(body),
  })
}

function makeGetRequest(uuid?: string): NextRequest {
  const url = uuid
    ? `http://localhost:3002/api/demo?uuid=${uuid}`
    : 'http://localhost:3002/api/demo'
  return new NextRequest(url, { method: 'GET' })
}

describe('POST /api/demo', () => {
  const VALID_KEY = 'test-operator-key'

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CLARA_OPERATOR_API_KEY = VALID_KEY
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(process.env as any).NODE_ENV = 'test'
    mockInsert.mockResolvedValue(undefined)
    mockDemoCreateLimiter.mockReturnValue({ allowed: true })
    mockDemoReadLimiter.mockReturnValue({ allowed: true })
  })

  // ── Auth ────────────────────────────────────────────────────────────────────

  it('returns 401 when Authorization header is missing', async () => {
    const req = makePostRequest({ hubspot_company_id: 'abc123' })
    const res = await POST(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 when wrong operator key is provided', async () => {
    const req = makePostRequest({ hubspot_company_id: 'abc123' }, 'Bearer wrong-key')
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  // ── Rate limiting ────────────────────────────────────────────────────────────

  it('returns 429 when POST create rate limit is exceeded', async () => {
    mockDemoCreateLimiter.mockReturnValue({ allowed: false })
    const req = makePostRequest({ hubspot_company_id: 'abc123' }, `Bearer ${VALID_KEY}`)
    const res = await POST(req)
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toMatch(/rate limit/i)
    expect(res.headers.get('Retry-After')).toBe('60')
  })

  // ── Invalid JSON ─────────────────────────────────────────────────────────────

  it('returns 400 when request body is not valid JSON', async () => {
    const req = new NextRequest('http://localhost:3002/api/demo', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${VALID_KEY}`,
      },
      body: 'not-json{{{',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid json/i)
  })

  // ── Validation ──────────────────────────────────────────────────────────────

  it('returns 400 when hubspot_company_id contains special characters', async () => {
    const req = makePostRequest(
      { hubspot_company_id: 'abc!@#$%^' },
      `Bearer ${VALID_KEY}`,
    )
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Invalid hubspot_company_id')
  })

  it('returns 400 when hubspot_company_id contains a SQL injection attempt', async () => {
    const req = makePostRequest(
      { hubspot_company_id: "'; DROP TABLE demo_sessions;--" },
      `Bearer ${VALID_KEY}`,
    )
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when hubspot_company_id contains a space', async () => {
    const req = makePostRequest(
      { hubspot_company_id: 'abc 123' },
      `Bearer ${VALID_KEY}`,
    )
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when hubspot_company_id is an empty string', async () => {
    const req = makePostRequest({ hubspot_company_id: '' }, `Bearer ${VALID_KEY}`)
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when hubspot_company_id is missing from body', async () => {
    const req = makePostRequest({}, `Bearer ${VALID_KEY}`)
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  // ── Happy path ──────────────────────────────────────────────────────────────

  it('returns 201 with sessionId and uuid when request is valid', async () => {
    const req = makePostRequest(
      { hubspot_company_id: 'hubspot-123' },
      `Bearer ${VALID_KEY}`,
    )
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toHaveProperty('sessionId')
    expect(body).toHaveProperty('uuid')
    expect(body.sessionId).toBe(body.uuid)
    expect(body.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
  })

  it('accepts hubspot_company_id with hyphens and underscores', async () => {
    const req = makePostRequest(
      { hubspot_company_id: 'my-company_id-123' },
      `Bearer ${VALID_KEY}`,
    )
    const res = await POST(req)
    expect(res.status).toBe(201)
  })
})

describe('GET /api/demo', () => {
  const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

  beforeEach(() => {
    vi.clearAllMocks()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(process.env as any).NODE_ENV = 'test'
    mockFindFirst.mockResolvedValue(null) // default: not found
    mockUpdate.mockResolvedValue(undefined)
    mockDemoCreateLimiter.mockReturnValue({ allowed: true })
    mockDemoReadLimiter.mockReturnValue({ allowed: true })
  })

  // ── Rate limiting ────────────────────────────────────────────────────────────

  it('returns 429 when GET read rate limit is exceeded', async () => {
    mockDemoReadLimiter.mockReturnValue({ allowed: false })
    const req = makeGetRequest(VALID_UUID)
    const res = await GET(req)
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toMatch(/rate limit/i)
    expect(res.headers.get('Retry-After')).toBe('60')
  })

  // ── Not found ───────────────────────────────────────────────────────────────

  it('returns 404 when uuid does not exist in the database', async () => {
    mockFindFirst.mockResolvedValue(null)
    const req = makeGetRequest(VALID_UUID)
    const res = await GET(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('returns 404 for a well-formed UUID that is a nonexistent session', async () => {
    mockFindFirst.mockResolvedValue(null)
    const req = makeGetRequest('00000000-0000-0000-0000-000000000000')
    const res = await GET(req)
    expect(res.status).toBe(404)
  })

  // ── Validation ──────────────────────────────────────────────────────────────

  it('returns 400 when uuid query param is missing', async () => {
    const req = makeGetRequest()
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when uuid is not a valid UUID format', async () => {
    const req = makeGetRequest('not-a-uuid')
    const res = await GET(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Invalid uuid format')
  })

  it('returns 400 when uuid contains special characters', async () => {
    const req = makeGetRequest('abc!@#$%^')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  // ── Happy path ──────────────────────────────────────────────────────────────

  it('returns 200 with session data when uuid exists', async () => {
    const now = new Date().toISOString()
    mockFindFirst.mockResolvedValue({
      id: VALID_UUID,
      hubspotCompanyId: 'hubspot-001',
      businessName: 'Sunrise Plumbing',
      viewCount: 3,
      messageCount: 10,
      createdAt: now,
      lastActiveAt: now,
      deletedAt: null,
    })
    const req = makeGetRequest(VALID_UUID)
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sessionId).toBe(VALID_UUID)
    expect(body.businessName).toBe('Sunrise Plumbing')
    expect(body.viewCount).toBe(4) // incremented by 1
    expect(body.messageCount).toBe(10)
  })

  it('returns "This Business" as businessName when business_name is null', async () => {
    const now = new Date().toISOString()
    mockFindFirst.mockResolvedValue({
      id: VALID_UUID,
      hubspotCompanyId: 'hubspot-002',
      businessName: null,
      viewCount: 0,
      messageCount: 0,
      createdAt: now,
      lastActiveAt: now,
      deletedAt: null,
    })
    const req = makeGetRequest(VALID_UUID)
    const res = await GET(req)
    const body = await res.json()
    expect(body.businessName).toBe('This Business')
  })

  it('invokes the where callback passed to findFirst (covers line 97)', async () => {
    // Make findFirst call the where callback so its body is exercised by coverage.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFindFirst.mockImplementation(async (opts: any) => {
      if (opts?.where) {
        const mockAnd = vi.fn((...args: unknown[]) => ({ type: 'and', args }))
        const mockEq = vi.fn((col: unknown, val: unknown) => ({ type: 'eq', col, val }))
        const mockIsNull = vi.fn((col: unknown) => ({ type: 'isNull', col }))
        opts.where(
          { id: 'id-col', deletedAt: 'deletedAt-col' },
          { and: mockAnd, eq: mockEq, isNull: mockIsNull },
        )
      }
      return null
    })
    const req = makeGetRequest(VALID_UUID)
    const res = await GET(req)
    expect(res.status).toBe(404)
    expect(mockFindFirst).toHaveBeenCalled()
  })
})
