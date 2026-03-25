import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Targeted gap tests for /api/chat route covering uncovered branches:
 * - Line 122: triggerLeadCapture = true (LLM reply ends with [NEEDS_FOLLOWUP])
 * - Line 162: response includes triggerLeadCapture: true
 */

const {
  mockInsert,
  mockUpdate,
  mockFindFirst,
  mockFindMany,
  mockRunReceptionist,
  mockIpLimiterCheck,
  mockHistoryLimiterCheck,
} = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockFindFirst: vi.fn(),
  mockFindMany: vi.fn(),
  mockRunReceptionist: vi.fn(),
  mockIpLimiterCheck: vi.fn().mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 }),
  mockHistoryLimiterCheck: vi.fn().mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 }),
}))

const dummyTableProxy = new Proxy({}, { get: (_t, prop) => ({ columnName: String(prop) }) })
const dummyOps = {
  and: (...args: unknown[]) => args,
  eq: (_col: unknown, _val: unknown) => true,
  isNull: (_col: unknown) => true,
}

vi.mock('@/db/index', () => ({
  db: {
    insert: () => ({ values: mockInsert }),
    update: () => ({ set: () => ({ where: mockUpdate }) }),
    query: {
      demoSessions: {
        findFirst: (opts?: { where?: (t: unknown, ops: unknown) => unknown }) => {
          if (opts?.where) opts.where(dummyTableProxy, dummyOps)
          return mockFindFirst(opts)
        },
      },
      chatMessages: {
        findMany: mockFindMany,
      },
    },
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  chatIpLimiter: { check: mockIpLimiterCheck },
  chatHistoryLimiter: { check: mockHistoryLimiterCheck },
  getClientIP: vi.fn().mockReturnValue('203.0.113.1'),
  SESSION_MESSAGE_HARD_CAP: 200,
}))

vi.mock('@/agent/receptionist', () => ({
  runReceptionist: mockRunReceptionist,
}))

import { POST } from '../../../app/api/chat/route'

const VALID_SESSION_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3002/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeSession(overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString()
  return {
    id: VALID_SESSION_UUID,
    hubspotCompanyId: 'hubspot-123',
    businessName: 'Sunrise Plumbing',
    viewCount: 1,
    messageCount: 0,
    createdAt: now,
    lastActiveAt: now,
    deletedAt: null,
    ...overrides,
  }
}

describe('POST /api/chat — [NEEDS_FOLLOWUP] tag handling (lines 122, 162)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIpLimiterCheck.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 })
    mockFindFirst.mockResolvedValue(makeSession())
    mockFindMany.mockResolvedValue([])
    mockInsert.mockResolvedValue(undefined)
    mockUpdate.mockResolvedValue(undefined)
  })

  it('strips [NEEDS_FOLLOWUP] from visible reply and sets triggerLeadCapture in response', async () => {
    // Agent reply ends with [NEEDS_FOLLOWUP] — route must strip the tag
    mockRunReceptionist.mockResolvedValue({
      reply: "I'm not sure about that specific part — let me have someone follow up. [NEEDS_FOLLOWUP]",
      businessProfile: { companyId: 'hubspot-123', companyName: 'Sunrise Plumbing' },
      langsmithTraceId: null,
    })

    const req = makePostRequest({ sessionId: VALID_SESSION_UUID, message: 'Do you do emergency repairs?' })
    const res = await POST(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    // Visible reply should not contain the tag
    expect(body.reply).not.toContain('[NEEDS_FOLLOWUP]')
    expect(body.reply).toContain("I'm not sure about that specific part")
    // triggerLeadCapture signal must be present in response
    expect(body.triggerLeadCapture).toBe(true)
    // messageId must still be present
    expect(body.messageId).toBeDefined()
  })

  it('strips trailing whitespace after removing [NEEDS_FOLLOWUP] tag', async () => {
    mockRunReceptionist.mockResolvedValue({
      reply: 'Let me have someone reach out to you.   [NEEDS_FOLLOWUP]',
      businessProfile: { companyId: 'hubspot-123', companyName: 'Sunrise Plumbing' },
      langsmithTraceId: null,
    })

    const req = makePostRequest({ sessionId: VALID_SESSION_UUID, message: 'What is your price?' })
    const res = await POST(req)
    const body = await res.json()

    expect(body.reply).toBe('Let me have someone reach out to you.')
    expect(body.triggerLeadCapture).toBe(true)
  })

  it('does not set triggerLeadCapture in response when reply has no [NEEDS_FOLLOWUP] tag', async () => {
    mockRunReceptionist.mockResolvedValue({
      reply: 'Our hours are 8am to 5pm Monday through Friday.',
      businessProfile: { companyId: 'hubspot-123', companyName: 'Sunrise Plumbing' },
      langsmithTraceId: null,
    })

    const req = makePostRequest({ sessionId: VALID_SESSION_UUID, message: 'What are your hours?' })
    const res = await POST(req)
    const body = await res.json()

    expect(body.reply).toBe('Our hours are 8am to 5pm Monday through Friday.')
    expect(body.triggerLeadCapture).toBeUndefined()
  })

  it('persists the stripped visible reply (without tag) to the DB as assistant message', async () => {
    mockRunReceptionist.mockResolvedValue({
      reply: 'Please leave your contact. [NEEDS_FOLLOWUP]',
      businessProfile: { companyId: 'hubspot-123', companyName: 'Sunrise Plumbing' },
      langsmithTraceId: null,
    })

    const req = makePostRequest({ sessionId: VALID_SESSION_UUID, message: 'Can I schedule?' })
    await POST(req)

    // mockInsert called twice: once for user, once for assistant
    expect(mockInsert).toHaveBeenCalledTimes(2)
    const assistantInsertCall = mockInsert.mock.calls[1][0]
    // The stored content should be the stripped reply
    expect(assistantInsertCall.content).toBe('Please leave your contact.')
    expect(assistantInsertCall.role).toBe('assistant')
  })
})
