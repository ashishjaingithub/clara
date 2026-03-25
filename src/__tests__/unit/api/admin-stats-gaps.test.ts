import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Targeted gap tests for GET /api/admin/stats — covering lines 46-49:
 * The `?? 0` fallback when the count query result array is empty or undefined.
 */

const { mockSelectFn, mockGetClientIP } = vi.hoisted(() => ({
  mockSelectFn: vi.fn(),
  mockGetClientIP: vi.fn().mockReturnValue('203.0.113.55'),
}))

vi.mock('@/db/index', () => ({
  db: {
    select: mockSelectFn,
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  cleanupLimiter: { check: vi.fn().mockReturnValue({ allowed: true }) },
  getClientIP: mockGetClientIP,
}))

import { GET as statsGET } from '../../../app/api/admin/stats/route'

const VALID_KEY = 'test-operator-key'

function makeRequest(authKey?: string): NextRequest {
  return new NextRequest('http://localhost:3002/api/admin/stats', {
    method: 'GET',
    headers: authKey ? { authorization: `Bearer ${authKey}` } : {},
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function selectChain(value: unknown): any {
  const chain: Record<string, unknown> = {}
  for (const m of ['from', 'where', 'orderBy', 'limit', 'leftJoin']) {
    chain[m] = () => chain
  }
  chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(value).then(res, rej)
  chain.catch = (rej: (e: unknown) => unknown) => Promise.resolve(value).catch(rej)
  chain.finally = (fn: () => void) => Promise.resolve(value).finally(fn)
  return chain
}

describe('GET /api/admin/stats — nullish fallback (lines 46-49)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CLARA_OPERATOR_API_KEY = VALID_KEY
  })

  it('returns 0 counts when all count queries return empty arrays (nullish ?? 0 branch)', async () => {
    // All 4 count queries return empty arrays (no [0].value) — exercises lines 46-49
    mockSelectFn
      .mockReturnValueOnce(selectChain([]))   // totalSessions → [] → ?? 0
      .mockReturnValueOnce(selectChain([]))   // activeSessions → [] → ?? 0
      .mockReturnValueOnce(selectChain([]))   // totalMessages → [] → ?? 0
      .mockReturnValueOnce(selectChain([]))   // totalLeads → [] → ?? 0
      .mockReturnValueOnce(selectChain([]))   // recentSessions list
      .mockReturnValueOnce(selectChain([]))   // recentLeads list

    const res = await statsGET(makeRequest(VALID_KEY))
    expect(res.status).toBe(200)

    const body = await res.json()
    // All nullish coalesce fallbacks should produce 0
    expect(body.totalSessions).toBe(0)
    expect(body.activeSessions).toBe(0)
    expect(body.totalMessages).toBe(0)
    expect(body.totalLeads).toBe(0)
  })

  it('returns 0 when count result contains undefined value field', async () => {
    // [0] exists but .value is undefined — exercises the ?? 0 branch
    mockSelectFn
      .mockReturnValueOnce(selectChain([{ value: undefined }]))
      .mockReturnValueOnce(selectChain([{ value: undefined }]))
      .mockReturnValueOnce(selectChain([{ value: undefined }]))
      .mockReturnValueOnce(selectChain([{ value: undefined }]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))

    const res = await statsGET(makeRequest(VALID_KEY))
    const body = await res.json()

    expect(body.totalSessions).toBe(0)
    expect(body.activeSessions).toBe(0)
    expect(body.totalMessages).toBe(0)
    expect(body.totalLeads).toBe(0)
  })
})
