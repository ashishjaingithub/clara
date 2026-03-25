import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Chaos tests — inject adversarial inputs into all public API surfaces.
 * Asserts the app handles them gracefully (no crash, sensible HTTP status).
 *
 * Categories:
 * - XSS strings in user message/name fields
 * - SQL injection strings in company/name/contact fields
 * - Oversized payloads (10,000-character strings)
 * - Null bytes and control characters
 * - Unicode edge cases
 */

// ── Hoist mocks ───────────────────────────────────────────────────────────────
const {
  mockInsert,
  mockUpdate,
  mockFindFirst,
  mockFindMany,
  mockRunReceptionist,
  mockIpCheck,
  mockLeadsCreateCheck,
  mockLeadsReadCheck,
  mockDemoCreateCheck,
} = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockFindFirst: vi.fn(),
  mockFindMany: vi.fn(),
  mockRunReceptionist: vi.fn(),
  mockIpCheck: vi.fn().mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 }),
  mockLeadsCreateCheck: vi.fn().mockReturnValue({ allowed: true }),
  mockLeadsReadCheck: vi.fn().mockReturnValue({ allowed: true }),
  mockDemoCreateCheck: vi.fn().mockReturnValue({ allowed: true }),
}))

vi.mock('@/db/index', () => ({
  db: {
    insert: () => ({ values: mockInsert }),
    update: () => ({ set: () => ({ where: mockUpdate }) }),
    query: {
      demoSessions: {
        findFirst: (opts?: { where?: (t: unknown, ops: unknown) => unknown }) => {
          if (opts?.where) {
            const dummy = new Proxy({}, { get: (_t, p) => ({ col: String(p) }) })
            opts.where(dummy, {
              and: (...a: unknown[]) => a,
              eq: () => true,
              isNull: () => true,
            })
          }
          return mockFindFirst(opts)
        },
      },
      chatMessages: { findMany: mockFindMany },
      leads: { findMany: mockFindMany },
    },
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  chatIpLimiter: { check: mockIpCheck },
  chatHistoryLimiter: { check: mockIpCheck },
  leadsCreateLimiter: { check: mockLeadsCreateCheck },
  leadsReadLimiter: { check: mockLeadsReadCheck },
  demoCreateLimiter: { check: mockDemoCreateCheck },
  demoReadLimiter: { check: mockDemoCreateCheck },
  getClientIP: vi.fn().mockReturnValue('203.0.113.1'),
  SESSION_MESSAGE_HARD_CAP: 200,
  SESSION_LEAD_LIFETIME_CAP: 10,
}))

vi.mock('@/agent/receptionist', () => ({
  runReceptionist: mockRunReceptionist,
}))

import { POST as chatPOST } from '../../app/api/chat/route'
import { POST as leadsPOST } from '../../app/api/leads/route'

const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
const VALID_KEY = 'chaos-test-operator-key'

function mockSession(overrides = {}) {
  return {
    id: VALID_UUID,
    hubspotCompanyId: 'chaos-company',
    businessName: 'Chaos Test Biz',
    viewCount: 1,
    messageCount: 0,
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    deletedAt: null,
    ...overrides,
  }
}

function chatRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3002/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function leadsRequest(body: unknown, key = VALID_KEY): NextRequest {
  return new NextRequest('http://localhost:3002/api/leads', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  })
}

// ─── XSS Inputs ──────────────────────────────────────────────────────────────

describe('Chaos — XSS inputs in chat message', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CLARA_OPERATOR_API_KEY = VALID_KEY
    mockIpCheck.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 })
    mockFindFirst.mockResolvedValue(mockSession())
    mockFindMany.mockResolvedValue([])
    mockInsert.mockResolvedValue(undefined)
    mockUpdate.mockResolvedValue(undefined)
    mockRunReceptionist.mockResolvedValue({
      reply: 'Safe reply',
      businessProfile: { companyId: 'chaos-company', companyName: 'Chaos Test Biz' },
      langsmithTraceId: null,
    })
  })

  it('accepts XSS string in message field without crashing', async () => {
    const xss = '<script>alert(1)</script>'
    const req = chatRequest({ sessionId: VALID_UUID, message: xss })
    const res = await chatPOST(req)
    // Should succeed (agent handles it) or return a validation error — never 500
    expect(res.status).not.toBe(500)
    expect([200, 400, 429]).toContain(res.status)
  })

  it('accepts HTML attribute injection in message field without crashing', async () => {
    const injection = '"><img src=x onerror=alert(1)>'
    const req = chatRequest({ sessionId: VALID_UUID, message: injection })
    const res = await chatPOST(req)
    expect(res.status).not.toBe(500)
  })

  it('accepts JavaScript URI in message field without crashing', async () => {
    const jsUri = 'javascript:alert(document.cookie)'
    const req = chatRequest({ sessionId: VALID_UUID, message: jsUri })
    const res = await chatPOST(req)
    expect(res.status).not.toBe(500)
  })

  it('accepts template injection string in message field without crashing', async () => {
    const templateInject = '{{7*7}} ${7*7} #{7*7}'
    const req = chatRequest({ sessionId: VALID_UUID, message: templateInject })
    const res = await chatPOST(req)
    expect(res.status).not.toBe(500)
  })
})

// ─── SQL Injection Inputs ─────────────────────────────────────────────────────

describe('Chaos — SQL injection in leads fields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CLARA_OPERATOR_API_KEY = VALID_KEY
    mockLeadsCreateCheck.mockReturnValue({ allowed: true })
    mockFindFirst.mockResolvedValue(mockSession())
    mockFindMany.mockResolvedValue([]) // under cap
    mockInsert.mockResolvedValue(undefined)
  })

  it('accepts SQL injection in name field and routes to DB layer without crashing', async () => {
    const sqlInject = "'; DROP TABLE leads; --"
    const req = leadsRequest({ sessionId: VALID_UUID, name: sqlInject, contact: 'test@example.com' })
    const res = await leadsPOST(req)
    // Should succeed (DB parameterization prevents injection) or return validation error
    expect(res.status).not.toBe(500)
    expect([201, 400, 404]).toContain(res.status)
  })

  it('accepts SQL injection in contact field without crashing', async () => {
    const sqlInject = "1' OR '1'='1"
    const req = leadsRequest({ sessionId: VALID_UUID, name: 'Jane Smith', contact: sqlInject })
    const res = await leadsPOST(req)
    expect(res.status).not.toBe(500)
  })

  it('accepts UNION SELECT injection in name field without crashing', async () => {
    const unionInject = "' UNION SELECT * FROM leads --"
    const req = leadsRequest({
      sessionId: VALID_UUID,
      name: unionInject,
      contact: 'test@test.com',
    })
    const res = await leadsPOST(req)
    expect(res.status).not.toBe(500)
  })

  it('accepts null byte injection in name field without crashing', async () => {
    const nullByte = 'Jane\x00Smith'
    const req = leadsRequest({ sessionId: VALID_UUID, name: nullByte, contact: 'test@test.com' })
    const res = await leadsPOST(req)
    expect(res.status).not.toBe(500)
  })
})

// ─── Oversized Payloads ───────────────────────────────────────────────────────

describe('Chaos — oversized inputs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CLARA_OPERATOR_API_KEY = VALID_KEY
    mockIpCheck.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 })
    mockLeadsCreateCheck.mockReturnValue({ allowed: true })
    mockFindFirst.mockResolvedValue(mockSession())
    mockFindMany.mockResolvedValue([])
    mockInsert.mockResolvedValue(undefined)
    mockUpdate.mockResolvedValue(undefined)
    mockRunReceptionist.mockResolvedValue({
      reply: 'Safe reply',
      businessProfile: { companyId: 'chaos-company', companyName: 'Chaos Test Biz' },
      langsmithTraceId: null,
    })
  })

  it('rejects 10,000-character message in chat with 400', async () => {
    const bigMessage = 'A'.repeat(10_000)
    const req = chatRequest({ sessionId: VALID_UUID, message: bigMessage })
    const res = await chatPOST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/too long/i)
  })

  it('rejects 2001-character message in chat with 400', async () => {
    const longMessage = 'B'.repeat(2001)
    const req = chatRequest({ sessionId: VALID_UUID, message: longMessage })
    const res = await chatPOST(req)
    expect(res.status).toBe(400)
  })

  it('rejects 201-character name in leads with 400', async () => {
    const longName = 'C'.repeat(201)
    const req = leadsRequest({ sessionId: VALID_UUID, name: longName, contact: 'test@test.com' })
    const res = await leadsPOST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/name too long/i)
  })

  it('rejects 201-character contact in leads with 400', async () => {
    const longContact = 'D'.repeat(201)
    const req = leadsRequest({ sessionId: VALID_UUID, name: 'Jane Smith', contact: longContact })
    const res = await leadsPOST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/contact too long/i)
  })

  it('rejects 1001-character message note in leads with 400', async () => {
    const longNote = 'E'.repeat(1001)
    const req = leadsRequest({
      sessionId: VALID_UUID,
      name: 'Jane Smith',
      contact: 'test@test.com',
      message: longNote,
    })
    const res = await leadsPOST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/message too long/i)
  })

  it('rejects exactly 10,000-character name in leads with 400', async () => {
    const hugePayload = 'F'.repeat(10_000)
    const req = leadsRequest({ sessionId: VALID_UUID, name: hugePayload, contact: 'test@test.com' })
    const res = await leadsPOST(req)
    expect(res.status).toBe(400)
  })
})

// ─── Unicode and Special Characters ──────────────────────────────────────────

describe('Chaos — Unicode and special characters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CLARA_OPERATOR_API_KEY = VALID_KEY
    mockIpCheck.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 })
    mockFindFirst.mockResolvedValue(mockSession())
    mockFindMany.mockResolvedValue([])
    mockInsert.mockResolvedValue(undefined)
    mockUpdate.mockResolvedValue(undefined)
    mockRunReceptionist.mockResolvedValue({
      reply: 'Safe reply',
      businessProfile: { companyId: 'chaos-company', companyName: 'Chaos Test Biz' },
      langsmithTraceId: null,
    })
  })

  it('accepts emoji in chat message without crashing', async () => {
    const emojiMsg = '😀🎉👋 Hello! Can you help me? 🏠🔧'
    const req = chatRequest({ sessionId: VALID_UUID, message: emojiMsg })
    const res = await chatPOST(req)
    expect(res.status).not.toBe(500)
  })

  it('accepts right-to-left text in chat message without crashing', async () => {
    const rtlMsg = 'مرحبا كيف حالك؟ هل يمكنني حجز موعد؟'
    const req = chatRequest({ sessionId: VALID_UUID, message: rtlMsg })
    const res = await chatPOST(req)
    expect(res.status).not.toBe(500)
  })

  it('rejects whitespace-only message in chat with 400', async () => {
    const whitespace = '   \t\n\r   '
    const req = chatRequest({ sessionId: VALID_UUID, message: whitespace })
    const res = await chatPOST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/empty/i)
  })

  it('accepts Unicode zero-width characters in message without crashing', async () => {
    // Zero-width joiner, zero-width non-joiner, etc.
    const zwj = 'Hello\u200DWorld\u200C!'
    const req = chatRequest({ sessionId: VALID_UUID, message: zwj })
    const res = await chatPOST(req)
    expect(res.status).not.toBe(500)
  })
})

// ─── Malformed JSON and Missing Fields ────────────────────────────────────────

describe('Chaos — malformed request bodies', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CLARA_OPERATOR_API_KEY = VALID_KEY
    mockIpCheck.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 })
    mockLeadsCreateCheck.mockReturnValue({ allowed: true })
  })

  it('returns 400 for truncated JSON in chat POST', async () => {
    const req = new NextRequest('http://localhost:3002/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"sessionId": "abc", "message":',
    })
    const res = await chatPOST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for entirely empty body in chat POST', async () => {
    const req = new NextRequest('http://localhost:3002/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '',
    })
    const res = await chatPOST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for plain text body in chat POST', async () => {
    const req = new NextRequest('http://localhost:3002/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'hello world',
    })
    const res = await chatPOST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for null body in chat POST (JSON null)', async () => {
    const req = new NextRequest('http://localhost:3002/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'null',
    })
    const res = await chatPOST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for array body in chat POST', async () => {
    const req = new NextRequest('http://localhost:3002/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '["sessionId", "message"]',
    })
    const res = await chatPOST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for truncated JSON in leads POST', async () => {
    const req = new NextRequest('http://localhost:3002/api/leads', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"sessionId": "abc"',
    })
    const res = await leadsPOST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for null body JSON in leads POST', async () => {
    const req = new NextRequest('http://localhost:3002/api/leads', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'null',
    })
    const res = await leadsPOST(req)
    expect(res.status).toBe(400)
  })
})

// ─── Session ID Injection ─────────────────────────────────────────────────────

describe('Chaos — session ID injection attempts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CLARA_OPERATOR_API_KEY = VALID_KEY
    mockIpCheck.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 })
    mockLeadsCreateCheck.mockReturnValue({ allowed: true })
  })

  it('rejects SQL injection in sessionId for chat POST with 400', async () => {
    const req = chatRequest({ sessionId: "'; DROP TABLE demo_sessions; --", message: 'Hi' })
    const res = await chatPOST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('rejects XSS in sessionId for chat POST with 400', async () => {
    const req = chatRequest({ sessionId: '<script>alert(1)</script>', message: 'Hi' })
    const res = await chatPOST(req)
    expect(res.status).toBe(400)
  })

  it('rejects path traversal in sessionId for leads POST with 400', async () => {
    const req = leadsRequest({
      sessionId: '../../../etc/passwd',
      name: 'Jane',
      contact: 'test@test.com',
    })
    const res = await leadsPOST(req)
    expect(res.status).toBe(400)
  })

  it('rejects numeric sessionId for chat POST with 400', async () => {
    const req = chatRequest({ sessionId: 12345, message: 'Hi' })
    const res = await chatPOST(req)
    expect(res.status).toBe(400)
  })
})
