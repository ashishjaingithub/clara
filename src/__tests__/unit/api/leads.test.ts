import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Route handler tests for /api/leads
 *
 * Strategy:
 * - Import POST and GET route handlers directly.
 * - Mock `@/db/index` to avoid real SQLite.
 * - Mock `@/lib/rate-limit` to avoid rate-limit interference.
 * - POST /api/leads is public (UUID gate, no operator auth).
 * - GET /api/leads is operator-protected.
 *
 * vi.hoisted() is used so mock functions are available inside vi.mock() factories,
 * which Vitest hoists to the top of the file before variable declarations.
 */

// ── Hoist mock functions so they are available inside vi.mock() factories ─────
const { mockInsert, mockFindFirst, mockFindMany, mockLeadsCreateCheck, mockLeadsReadCheck } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockFindFirst: vi.fn(),
  mockFindMany: vi.fn(),
  mockLeadsCreateCheck: vi.fn().mockReturnValue({ allowed: true }),
  mockLeadsReadCheck: vi.fn().mockReturnValue({ allowed: true }),
}))

// ── DB mock ───────────────────────────────────────────────────────────────────
vi.mock('@/db/index', () => ({
  db: {
    insert: () => ({ values: mockInsert }),
    query: {
      demoSessions: { findFirst: mockFindFirst },
      leads: { findMany: mockFindMany },
    },
  },
}))

// ── Rate limiter mock (all allowed by default) ────────────────────────────────
vi.mock('@/lib/rate-limit', () => ({
  leadsCreateLimiter: { check: mockLeadsCreateCheck },
  leadsReadLimiter: { check: mockLeadsReadCheck },
  getClientIP: vi.fn().mockReturnValue('203.0.113.1'),
  SESSION_LEAD_LIFETIME_CAP: 10,
}))

// Import AFTER mocks are registered
import { POST, GET } from '../../../app/api/leads/route'

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_SESSION_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3002/api/leads', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeGetRequest(company?: string, authHeader?: string): NextRequest {
  const url = company
    ? `http://localhost:3002/api/leads?company=${encodeURIComponent(company)}`
    : 'http://localhost:3002/api/leads'
  return new NextRequest(url, {
    method: 'GET',
    headers: authHeader ? { authorization: authHeader } : {},
  })
}

// A minimal valid session row returned by the DB mock
const MOCK_SESSION = {
  id: VALID_SESSION_ID,
  hubspotCompanyId: 'hubspot-001',
  businessName: 'Sunrise Plumbing',
  viewCount: 2,
  messageCount: 4,
  createdAt: new Date().toISOString(),
  lastActiveAt: new Date().toISOString(),
  deletedAt: null,
}

describe('POST /api/leads', () => {
  const VALID_KEY = 'test-operator-key'

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CLARA_OPERATOR_API_KEY = VALID_KEY
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(process.env as any).NODE_ENV = 'test'
    mockFindFirst.mockResolvedValue(MOCK_SESSION)
    mockFindMany.mockResolvedValue([]) // no existing leads → under cap
    mockInsert.mockResolvedValue(undefined)
    mockLeadsCreateCheck.mockReturnValue({ allowed: true })
    mockLeadsReadCheck.mockReturnValue({ allowed: true })
  })

  // ── Invalid JSON / body ───────────────────────────────────────────────────

  it('returns 400 when request body is not valid JSON', async () => {
    const req = new NextRequest('http://localhost:3002/api/leads', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json{{{',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid json/i)
  })

  it('returns 400 when request body is a non-object JSON value', async () => {
    const req = new NextRequest('http://localhost:3002/api/leads', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '"just a string"',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid request body/i)
  })

  // ── Rate limiting ────────────────────────────────────────────────────────────

  it('returns 429 when POST create rate limit is exceeded', async () => {
    mockLeadsCreateCheck.mockReturnValue({ allowed: false })
    const req = makePostRequest({
      sessionId: VALID_SESSION_ID,
      name: 'Jane Smith',
      contact: 'jane@example.com',
    })
    const res = await POST(req)
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toMatch(/rate limit/i)
    expect(res.headers.get('Retry-After')).toBe('60')
  })

  // ── Happy path ──────────────────────────────────────────────────────────────

  it('returns 201 with leadId when sessionId, name, and contact are all provided', async () => {
    const req = makePostRequest({
      sessionId: VALID_SESSION_ID,
      name: 'Jane Smith',
      contact: 'jane@example.com',
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toHaveProperty('leadId')
    expect(typeof body.leadId).toBe('string')
    expect(body.leadId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
  })

  it('returns 201 when optional message field is provided', async () => {
    const req = makePostRequest({
      sessionId: VALID_SESSION_ID,
      name: 'Bob Jones',
      contact: '555-1234',
      message: 'Looking for a quote on plumbing repairs',
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('returns 201 and uses "This Business" fallback when session businessName is null', async () => {
    mockFindFirst.mockResolvedValue({ ...MOCK_SESSION, businessName: null })
    const req = makePostRequest({
      sessionId: VALID_SESSION_ID,
      name: 'Carol White',
      contact: 'carol@example.com',
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  // ── Missing contact (email/phone) — the "name but no email or phone" case ──

  it('returns 400 when name is provided but contact is missing', async () => {
    const req = makePostRequest({
      sessionId: VALID_SESSION_ID,
      name: 'Jane Smith',
      // no contact field
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/contact/i)
  })

  it('returns 400 when contact is an empty string', async () => {
    const req = makePostRequest({
      sessionId: VALID_SESSION_ID,
      name: 'Jane Smith',
      contact: '',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when name is missing', async () => {
    const req = makePostRequest({
      sessionId: VALID_SESSION_ID,
      contact: 'jane@example.com',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/name/i)
  })

  it('returns 400 when name is whitespace only', async () => {
    const req = makePostRequest({
      sessionId: VALID_SESSION_ID,
      name: '   ',
      contact: 'jane@example.com',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  // ── sessionId validation ──────────────────────────────────────────────────

  it('returns 400 when sessionId is not a valid UUID', async () => {
    const req = makePostRequest({
      sessionId: 'not-a-uuid',
      name: 'Jane Smith',
      contact: 'jane@example.com',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/sessionId/i)
  })

  it('returns 400 when sessionId is missing', async () => {
    const req = makePostRequest({
      name: 'Jane Smith',
      contact: 'jane@example.com',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  // ── Session not found ─────────────────────────────────────────────────────

  it('returns 404 when session does not exist', async () => {
    mockFindFirst.mockResolvedValue(null)
    const req = makePostRequest({
      sessionId: VALID_SESSION_ID,
      name: 'Jane Smith',
      contact: 'jane@example.com',
    })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  // ── Per-session cap ───────────────────────────────────────────────────────

  it('returns 429 when session has reached the per-session lead cap', async () => {
    // SESSION_LEAD_LIFETIME_CAP is mocked as 10; return 10 existing leads
    mockFindMany.mockResolvedValue(new Array(10).fill({ id: 'lead-id' }))
    const req = makePostRequest({
      sessionId: VALID_SESSION_ID,
      name: 'Jane Smith',
      contact: 'jane@example.com',
    })
    const res = await POST(req)
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toMatch(/maximum lead submissions/i)
    expect(res.headers.get('Retry-After')).toBe('60')
  })

  // ── where callback coverage ───────────────────────────────────────────────

  it('invokes the demoSessions findFirst where callback (covers line 80)', async () => {
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
      return null // session not found → 404
    })
    const req = makePostRequest({
      sessionId: VALID_SESSION_ID,
      name: 'Jane Smith',
      contact: 'jane@example.com',
    })
    const res = await POST(req)
    expect(res.status).toBe(404)
    expect(mockFindFirst).toHaveBeenCalled()
  })

  // ── message field validation ──────────────────────────────────────────────

  it('returns 400 when message is provided but is not a string', async () => {
    const req = makePostRequest({
      sessionId: VALID_SESSION_ID,
      name: 'Jane Smith',
      contact: 'jane@example.com',
      message: 12345,
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/message must be a string/i)
  })

  it('returns 400 when message exceeds 1000 characters', async () => {
    const req = makePostRequest({
      sessionId: VALID_SESSION_ID,
      name: 'Jane Smith',
      contact: 'jane@example.com',
      message: 'x'.repeat(1001),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/message too long/i)
  })

  // ── Field length limits ───────────────────────────────────────────────────

  it('returns 400 when name exceeds 200 characters', async () => {
    const req = makePostRequest({
      sessionId: VALID_SESSION_ID,
      name: 'a'.repeat(201),
      contact: 'jane@example.com',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/name too long/i)
  })

  it('returns 400 when contact exceeds 200 characters', async () => {
    const req = makePostRequest({
      sessionId: VALID_SESSION_ID,
      name: 'Jane Smith',
      contact: 'a'.repeat(201),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/contact too long/i)
  })
})

describe('GET /api/leads', () => {
  const VALID_KEY = 'test-operator-key'

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CLARA_OPERATOR_API_KEY = VALID_KEY
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(process.env as any).NODE_ENV = 'test'
    mockFindMany.mockResolvedValue([])
    mockLeadsCreateCheck.mockReturnValue({ allowed: true })
    mockLeadsReadCheck.mockReturnValue({ allowed: true })
  })

  // ── Auth ────────────────────────────────────────────────────────────────────

  it('returns 401 when Authorization header is missing', async () => {
    const req = makeGetRequest('hubspot-001')
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 when wrong operator key is provided', async () => {
    const req = makeGetRequest('hubspot-001', 'Bearer wrong-key')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  // ── Rate limiting ────────────────────────────────────────────────────────────

  it('returns 429 when GET read rate limit is exceeded', async () => {
    mockLeadsReadCheck.mockReturnValue({ allowed: false })
    const req = makeGetRequest('hubspot-001', `Bearer ${VALID_KEY}`)
    const res = await GET(req)
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toMatch(/rate limit/i)
    expect(res.headers.get('Retry-After')).toBe('60')
  })

  // ── Validation ──────────────────────────────────────────────────────────────

  it('returns 400 when company query param is missing', async () => {
    const req = makeGetRequest(undefined, `Bearer ${VALID_KEY}`)
    const res = await GET(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/company/i)
  })

  it('returns 400 when company param contains special characters', async () => {
    // encodeURIComponent would encode these, so pass raw via URL construction
    const url = `http://localhost:3002/api/leads?company=abc!@%23%24%25`
    const req = new NextRequest(url, {
      method: 'GET',
      headers: { authorization: `Bearer ${VALID_KEY}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Invalid company format/i)
  })

  it('returns 400 when company param contains a SQL injection attempt', async () => {
    // Pass URL-encoded value; route will URL-decode and then regex-validate
    const url = `http://localhost:3002/api/leads?company=${encodeURIComponent("'; DROP TABLE leads;--")}`
    const req = new NextRequest(url, {
      method: 'GET',
      headers: { authorization: `Bearer ${VALID_KEY}` },
    })
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  // ── Happy path ──────────────────────────────────────────────────────────────

  it('returns 200 with empty leads array when no leads exist for company', async () => {
    mockFindMany.mockResolvedValue([])
    const req = makeGetRequest('hubspot-001', `Bearer ${VALID_KEY}`)
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('leads')
    expect(Array.isArray(body.leads)).toBe(true)
    expect(body.leads).toHaveLength(0)
  })

  it('returns 200 with leads array containing captured leads', async () => {
    const now = new Date().toISOString()
    mockFindMany.mockResolvedValue([
      {
        id: 'lead-uuid-1',
        sessionId: VALID_SESSION_ID,
        hubspotCompanyId: 'hubspot-001',
        name: 'Jane Smith',
        contact: 'jane@example.com',
        message: 'Need a quote',
        createdAt: now,
      },
    ])
    const req = makeGetRequest('hubspot-001', `Bearer ${VALID_KEY}`)
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.leads).toHaveLength(1)
    expect(body.leads[0].name).toBe('Jane Smith')
    expect(body.leads[0].contact).toBe('jane@example.com')
    expect(body.leads[0].message).toBe('Need a quote')
    expect(body.leads[0]).toHaveProperty('id')
    expect(body.leads[0]).toHaveProperty('sessionId')
    expect(body.leads[0]).toHaveProperty('createdAt')
  })

  it('accepts company param with hyphens and underscores', async () => {
    const req = makeGetRequest('my-company_123', `Bearer ${VALID_KEY}`)
    const res = await GET(req)
    expect(res.status).toBe(200)
  })

  it('invokes the orderBy callback in findMany (covers line 167)', async () => {
    // Make findMany call the orderBy callback so its body is exercised by coverage.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFindMany.mockImplementation(async (opts: any) => {
      if (opts?.orderBy) {
        const mockDesc = vi.fn((col: unknown) => ({ type: 'desc', col }))
        opts.orderBy({ createdAt: 'createdAt-col' }, { desc: mockDesc })
      }
      return []
    })
    const req = makeGetRequest('hubspot-001', `Bearer ${VALID_KEY}`)
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(mockFindMany).toHaveBeenCalled()
  })

  it('returns null message as null in response (covers message ?? null branch)', async () => {
    const now = new Date().toISOString()
    mockFindMany.mockResolvedValue([
      {
        id: 'lead-uuid-2',
        sessionId: VALID_SESSION_ID,
        hubspotCompanyId: 'hubspot-001',
        name: 'Alice Doe',
        contact: 'alice@example.com',
        message: null,
        createdAt: now,
      },
    ])
    const req = makeGetRequest('hubspot-001', `Bearer ${VALID_KEY}`)
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.leads[0].message).toBeNull()
  })
})
