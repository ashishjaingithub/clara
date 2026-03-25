import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Unit tests for GET /api/admin/stats and GET /api/admin/cleanup
 *
 * Strategy:
 * - Mock `@/db/index` with thenable chain objects to avoid real SQLite.
 * - Mock `@/lib/rate-limit` to control rate-limiting.
 * - Auth is bypassed by default (CLARA_OPERATOR_API_KEY not set in dev/test).
 */

const { mockSelectFn, mockUpdateFn, mockCleanupCheck, mockGetClientIP } = vi.hoisted(() => ({
  mockSelectFn: vi.fn(),
  mockUpdateFn: vi.fn(),
  mockCleanupCheck: vi.fn().mockReturnValue({ allowed: true }),
  mockGetClientIP: vi.fn().mockReturnValue('203.0.113.99'),
}))

vi.mock('@/db/index', () => ({
  db: {
    select: mockSelectFn,
    update: mockUpdateFn,
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  cleanupLimiter: { check: mockCleanupCheck },
  getClientIP: mockGetClientIP,
}))

import { GET as statsGET } from '../../../app/api/admin/stats/route'
import { GET as cleanupGET } from '../../../app/api/admin/cleanup/route'

const VALID_KEY = 'test-operator-key'

function makeRequest(path: string, authKey?: string): NextRequest {
  return new NextRequest(`http://localhost:3002${path}`, {
    method: 'GET',
    headers: authKey ? { authorization: `Bearer ${authKey}` } : {},
  })
}

/**
 * Returns a thenable Drizzle-style query chain that resolves to `value`.
 * Each chain method (from, where, orderBy, limit, leftJoin) returns the same chain,
 * so tests can call .from(...).where(...).limit(...) without errors.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function selectChain(value: unknown): any {
  const chain: Record<string, unknown> = {}
  for (const m of ['from', 'where', 'orderBy', 'limit', 'leftJoin']) {
    chain[m] = () => chain
  }
  // Make the chain thenable so `await chain` resolves to value
  chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(value).then(res, rej)
  chain.catch = (rej: (e: unknown) => unknown) => Promise.resolve(value).catch(rej)
  chain.finally = (fn: () => void) => Promise.resolve(value).finally(fn)
  return chain
}

/**
 * Returns a mock Drizzle update chain that resolves `.returning()` to `rows`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function updateChain(rows: unknown[]): any {
  const returning = vi.fn().mockResolvedValue(rows)
  const where = vi.fn(() => ({ returning }))
  const set = vi.fn(() => ({ where }))
  return { set }
}

/** Set up default select chain for stats (6 calls: 4 counts + 2 lists) */
function setupStatsSelect({
  totalSessions = 5,
  activeSessions = 3,
  totalMessages = 20,
  totalLeads = 2,
  recentSessions = [] as unknown[],
  recentLeads = [] as unknown[],
} = {}) {
  mockSelectFn
    .mockReturnValueOnce(selectChain([{ value: totalSessions }]))
    .mockReturnValueOnce(selectChain([{ value: activeSessions }]))
    .mockReturnValueOnce(selectChain([{ value: totalMessages }]))
    .mockReturnValueOnce(selectChain([{ value: totalLeads }]))
    .mockReturnValueOnce(selectChain(recentSessions))
    .mockReturnValueOnce(selectChain(recentLeads))
}

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.CLARA_OPERATOR_API_KEY
  })

  // ── auth gate ─────────────────────────────────────────────────────────────

  it('returns 401 when Authorization header is missing', async () => {
    const req = makeRequest('/api/admin/stats')
    const res = await statsGET(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 when wrong API key is provided', async () => {
    process.env.CLARA_OPERATOR_API_KEY = VALID_KEY
    const req = makeRequest('/api/admin/stats', 'wrong-key')
    const res = await statsGET(req)
    expect(res.status).toBe(401)
  })

  // ── rate limit gate ───────────────────────────────────────────────────────

  // Note: stats route uses an inline per-IP sliding window (30 req/min), not
  // the imported cleanupLimiter. We can't easily mock it, but 1–2 requests
  // in tests are well below the 30/min threshold.

  // ── successful response ───────────────────────────────────────────────────

  it('returns 200 with aggregate counts when auth passes', async () => {
    setupStatsSelect({ totalSessions: 7, activeSessions: 5, totalMessages: 42, totalLeads: 3 })

    const req = makeRequest('/api/admin/stats', VALID_KEY)
    const res = await statsGET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.totalSessions).toBe(7)
    expect(body.activeSessions).toBe(5)
    expect(body.totalMessages).toBe(42)
    expect(body.totalLeads).toBe(3)
  })

  it('returns empty arrays when no sessions or leads exist', async () => {
    setupStatsSelect({ totalSessions: 0, activeSessions: 0, totalMessages: 0, totalLeads: 0 })

    const req = makeRequest('/api/admin/stats', VALID_KEY)
    const res = await statsGET(req)
    const body = await res.json()

    expect(body.recentSessions).toEqual([])
    expect(body.recentLeads).toEqual([])
  })

  it('maps recentSessions rows to the expected shape', async () => {
    const sessionRow = {
      id: 'sess-uuid',
      hubspotCompanyId: 'hubspot-1',
      businessName: 'Acme HVAC',
      messageCount: 8,
      createdAt: '2026-01-01T00:00:00.000Z',
      lastActiveAt: '2026-01-02T00:00:00.000Z',
      leadCount: 2,
    }
    setupStatsSelect({ recentSessions: [sessionRow] })

    const req = makeRequest('/api/admin/stats', VALID_KEY)
    const res = await statsGET(req)
    const body = await res.json()

    expect(body.recentSessions).toHaveLength(1)
    const s = body.recentSessions[0]
    expect(s.id).toBe('sess-uuid')
    expect(s.businessName).toBe('Acme HVAC')
    expect(s.leadCount).toBe(2)
  })

  it('maps recentLeads rows to the expected shape', async () => {
    const leadRow = {
      id: 'lead-uuid',
      sessionId: 'sess-uuid',
      hubspotCompanyId: 'hubspot-1',
      businessName: 'Acme HVAC',
      name: 'Jane Doe',
      contact: 'jane@example.com',
      message: 'Interested in service.',
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    setupStatsSelect({ recentLeads: [leadRow] })

    const req = makeRequest('/api/admin/stats', VALID_KEY)
    const res = await statsGET(req)
    const body = await res.json()

    expect(body.recentLeads).toHaveLength(1)
    const l = body.recentLeads[0]
    expect(l.id).toBe('lead-uuid')
    expect(l.name).toBe('Jane Doe')
    expect(l.message).toBe('Interested in service.')
  })

  it('coerces null businessName to null in response (not undefined)', async () => {
    setupStatsSelect({
      recentSessions: [{ id: 's1', hubspotCompanyId: 'h1', businessName: null,
        messageCount: 0, createdAt: '2026-01-01T00:00:00.000Z',
        lastActiveAt: '2026-01-01T00:00:00.000Z', leadCount: 0 }],
      recentLeads: [{ id: 'l1', sessionId: 's1', hubspotCompanyId: 'h1',
        businessName: null, name: 'Bob', contact: 'bob@x.com', message: null,
        createdAt: '2026-01-01T00:00:00.000Z' }],
    })

    const req = makeRequest('/api/admin/stats', VALID_KEY)
    const res = await statsGET(req)
    const body = await res.json()

    expect(body.recentSessions[0].businessName).toBeNull()
    expect(body.recentLeads[0].businessName).toBeNull()
    expect(body.recentLeads[0].message).toBeNull()
  })

  it('calls db.select exactly 6 times (4 counts + 2 list queries)', async () => {
    setupStatsSelect()

    const req = makeRequest('/api/admin/stats', VALID_KEY)
    await statsGET(req)

    expect(mockSelectFn).toHaveBeenCalledTimes(6)
  })

  it('returns 429 when the inline per-IP rate limit (30/min) is exceeded', async () => {
    // Use a unique IP to avoid interference with other tests' call history.
    // The inline rate limiter is module-level state — calls accumulate per IP.
    mockGetClientIP.mockReturnValue('10.255.0.1')

    // Exhaust the 30-request limit
    for (let i = 0; i < 30; i++) {
      setupStatsSelect()
      await statsGET(makeRequest('/api/admin/stats', VALID_KEY))
    }

    // 31st request should be rate-limited
    const res = await statsGET(makeRequest('/api/admin/stats', VALID_KEY))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toMatch(/rate limit/i)
    expect(res.headers.get('Retry-After')).toBe('60')

    // Restore IP for subsequent tests
    mockGetClientIP.mockReturnValue('203.0.113.99')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCleanupCheck.mockReturnValue({ allowed: true })
    delete process.env.CLARA_OPERATOR_API_KEY
  })

  // ── auth gate ─────────────────────────────────────────────────────────────

  it('returns 401 when Authorization header is missing', async () => {
    const req = makeRequest('/api/admin/cleanup')
    const res = await cleanupGET(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 when wrong API key is provided', async () => {
    process.env.CLARA_OPERATOR_API_KEY = VALID_KEY
    const req = makeRequest('/api/admin/cleanup', 'wrong-key')
    const res = await cleanupGET(req)
    expect(res.status).toBe(401)
  })

  // ── rate limit gate ───────────────────────────────────────────────────────

  it('returns 429 when rate limit is exceeded', async () => {
    mockCleanupCheck.mockReturnValueOnce({ allowed: false })

    const req = makeRequest('/api/admin/cleanup', VALID_KEY)
    const res = await cleanupGET(req)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toMatch(/rate limit/i)
    expect(res.headers.get('Retry-After')).toBe('60')
  })

  // ── successful cleanup ────────────────────────────────────────────────────

  it('returns 200 with sessionsExpired=0 when no stale sessions exist', async () => {
    mockUpdateFn.mockReturnValue(updateChain([]))

    const req = makeRequest('/api/admin/cleanup', VALID_KEY)
    const res = await cleanupGET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sessionsExpired).toBe(0)
    expect(body.archivedCount).toBe(0)
  })

  it('returns sessionsExpired count equal to soft-deleted rows', async () => {
    mockUpdateFn.mockReturnValue(
      updateChain([{ id: 'sess-a' }, { id: 'sess-b' }, { id: 'sess-c' }]),
    )

    const req = makeRequest('/api/admin/cleanup', VALID_KEY)
    const res = await cleanupGET(req)
    const body = await res.json()

    expect(body.sessionsExpired).toBe(3)
    expect(body.archivedCount).toBe(3)
  })

  it('includes cutoffDate in the response', async () => {
    mockUpdateFn.mockReturnValue(updateChain([]))

    const req = makeRequest('/api/admin/cleanup', VALID_KEY)
    const res = await cleanupGET(req)
    const body = await res.json()

    expect(body.cutoffDate).toBeDefined()
    // cutoffDate should be a valid ISO string in the past, roughly 30 days ago
    // Using a 31-day window to be robust against DST offsets
    const cutoff = new Date(body.cutoffDate)
    expect(Number.isNaN(cutoff.getTime())).toBe(false)
    expect(cutoff.getTime()).toBeLessThan(Date.now())
    const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000
    expect(cutoff.getTime()).toBeGreaterThan(thirtyOneDaysAgo)
  })

  it('calls db.update exactly once per cleanup request', async () => {
    mockUpdateFn.mockReturnValue(updateChain([]))

    const req = makeRequest('/api/admin/cleanup', VALID_KEY)
    await cleanupGET(req)

    expect(mockUpdateFn).toHaveBeenCalledTimes(1)
  })
})
