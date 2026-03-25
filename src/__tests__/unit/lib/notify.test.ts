import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Unit tests for lib/notify.ts — notifyLeadCaptured
 *
 * Strategy:
 * - Mock `googleapis` to prevent real OAuth2 / Gmail API calls.
 * - Exercise all branches: not configured, no recipient, send ok, send throws.
 *
 * Note: vi.spyOn(notify, 'sendGmailMessage') does NOT intercept internal calls
 * in ESM because the module calls the function directly (not via exports).
 * We must mock `googleapis` at the transport layer instead.
 */

const { mockSend, mockGmail, MockOAuth2 } = vi.hoisted(() => {
  const mockSend = vi.fn()
  const mockGmail = vi.fn(() => ({ users: { messages: { send: mockSend } } }))
  // Must be a real function, not an arrow function — used as `new google.auth.OAuth2(...)`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function MockOAuth2(this: any) {
    this.setCredentials = vi.fn()
  }
  return { mockSend, mockGmail, MockOAuth2 }
})

vi.mock('googleapis', () => ({
  google: {
    auth: { OAuth2: MockOAuth2 },
    gmail: mockGmail,
  },
}))

import { notifyLeadCaptured } from '@/lib/notify'

const BASE_PARAMS = {
  businessName: 'Acme HVAC',
  hubspotCompanyId: '12345',
  visitorName: 'Jane Doe',
  visitorContact: 'jane@example.com',
  sessionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  baseUrl: 'http://localhost:3002',
}

const OAUTH_ENV = {
  GMAIL_REFRESH_TOKEN: 'refresh-token',
  GMAIL_CLIENT_ID: 'client-id',
  GMAIL_CLIENT_SECRET: 'client-secret',
  GMAIL_USER: 'clara@gmail.com',
}

describe('notifyLeadCaptured', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.GMAIL_REFRESH_TOKEN
    delete process.env.GMAIL_CLIENT_ID
    delete process.env.GMAIL_CLIENT_SECRET
    delete process.env.GMAIL_USER
    delete process.env.OPERATOR_EMAIL
  })

  afterEach(() => {
    delete process.env.GMAIL_REFRESH_TOKEN
    delete process.env.GMAIL_CLIENT_ID
    delete process.env.GMAIL_CLIENT_SECRET
    delete process.env.GMAIL_USER
    delete process.env.OPERATOR_EMAIL
  })

  // ── not-configured path ───────────────────────────────────────────────────

  it('logs to stdout and returns when no OAuth credentials are set', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    await expect(notifyLeadCaptured(BASE_PARAMS)).resolves.toBeUndefined()

    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining('Lead captured (email not configured)'),
    )
    expect(mockGmail).not.toHaveBeenCalled()
    stdoutSpy.mockRestore()
  })

  it('logs to stdout when GMAIL_REFRESH_TOKEN is missing', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    process.env.GMAIL_CLIENT_ID = 'client-id'
    process.env.GMAIL_CLIENT_SECRET = 'client-secret'

    await expect(notifyLeadCaptured(BASE_PARAMS)).resolves.toBeUndefined()

    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('email not configured'))
    expect(mockGmail).not.toHaveBeenCalled()
    stdoutSpy.mockRestore()
  })

  it('logs to stdout when GMAIL_USER (from/to fallback) is not set', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    Object.assign(process.env, OAUTH_ENV)
    delete process.env.GMAIL_USER
    delete process.env.OPERATOR_EMAIL

    await expect(notifyLeadCaptured(BASE_PARAMS)).resolves.toBeUndefined()

    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('email not configured'))
    expect(mockGmail).not.toHaveBeenCalled()
    stdoutSpy.mockRestore()
  })

  it('includes visitorName in the stdout log when not configured', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    await expect(notifyLeadCaptured(BASE_PARAMS)).resolves.toBeUndefined()

    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('Jane Doe'))
    stdoutSpy.mockRestore()
  })

  // ── successful send path ──────────────────────────────────────────────────

  it('calls gmail.users.messages.send when fully configured', async () => {
    Object.assign(process.env, OAUTH_ENV)
    process.env.OPERATOR_EMAIL = 'operator@example.com'
    mockSend.mockResolvedValue({ data: {} })

    await notifyLeadCaptured(BASE_PARAMS)

    expect(mockGmail).toHaveBeenCalledOnce()
    expect(mockSend).toHaveBeenCalledOnce()
  })

  it('encodes To: OPERATOR_EMAIL in the raw message', async () => {
    Object.assign(process.env, OAUTH_ENV)
    process.env.OPERATOR_EMAIL = 'operator@example.com'
    mockSend.mockResolvedValue({})

    await notifyLeadCaptured(BASE_PARAMS)

    const raw = mockSend.mock.calls[0][0].requestBody.raw
    const decoded = Buffer.from(raw, 'base64url').toString('utf-8')
    expect(decoded).toContain('To: operator@example.com')
  })

  it('uses GMAIL_USER as recipient fallback when OPERATOR_EMAIL is not set', async () => {
    Object.assign(process.env, OAUTH_ENV)
    mockSend.mockResolvedValue({})

    await notifyLeadCaptured(BASE_PARAMS)

    const raw = mockSend.mock.calls[0][0].requestBody.raw
    const decoded = Buffer.from(raw, 'base64url').toString('utf-8')
    expect(decoded).toContain('To: clara@gmail.com')
  })

  it('includes businessName and visitorName in the subject', async () => {
    Object.assign(process.env, OAUTH_ENV)
    mockSend.mockResolvedValue({})

    await notifyLeadCaptured(BASE_PARAMS)

    const raw = mockSend.mock.calls[0][0].requestBody.raw
    const decoded = Buffer.from(raw, 'base64url').toString('utf-8')
    expect(decoded).toContain('Acme HVAC')
    expect(decoded).toContain('Jane Doe')
  })

  it('includes hubspotCompanyId, visitorContact and sessionId in the HTML body', async () => {
    Object.assign(process.env, OAUTH_ENV)
    mockSend.mockResolvedValue({})

    await notifyLeadCaptured(BASE_PARAMS)

    const raw = mockSend.mock.calls[0][0].requestBody.raw
    const decoded = Buffer.from(raw, 'base64url').toString('utf-8')
    expect(decoded).toContain('12345')
    expect(decoded).toContain('jane@example.com')
    expect(decoded).toContain(BASE_PARAMS.sessionId)
  })

  it('includes optional visitorMessage in email body when provided', async () => {
    Object.assign(process.env, OAUTH_ENV)
    mockSend.mockResolvedValue({})

    await notifyLeadCaptured({ ...BASE_PARAMS, visitorMessage: 'Interested in annual plan.' })

    const raw = mockSend.mock.calls[0][0].requestBody.raw
    const decoded = Buffer.from(raw, 'base64url').toString('utf-8')
    expect(decoded).toContain('Interested in annual plan.')
  })

  it('does not include Message section in email when visitorMessage is undefined', async () => {
    Object.assign(process.env, OAUTH_ENV)
    mockSend.mockResolvedValue({})

    await notifyLeadCaptured({ ...BASE_PARAMS, visitorMessage: undefined })

    const raw = mockSend.mock.calls[0][0].requestBody.raw
    const decoded = Buffer.from(raw, 'base64url').toString('utf-8')
    expect(decoded).not.toContain('<strong>Message:</strong>')
  })

  // ── error resilience ──────────────────────────────────────────────────────

  it('logs to stderr but does NOT throw when send rejects with an Error', async () => {
    Object.assign(process.env, OAUTH_ENV)
    mockSend.mockRejectedValue(new Error('OAuth token expired'))
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    await expect(notifyLeadCaptured(BASE_PARAMS)).resolves.toBeUndefined()

    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('OAuth token expired'))
    stderrSpy.mockRestore()
  })

  it('logs non-Error rejection objects as string in stderr', async () => {
    Object.assign(process.env, OAUTH_ENV)
    mockSend.mockRejectedValue('network timeout')
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    await expect(notifyLeadCaptured(BASE_PARAMS)).resolves.toBeUndefined()

    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('network timeout'))
    stderrSpy.mockRestore()
  })

  // ── chaos inputs ──────────────────────────────────────────────────────────

  it('handles 500-char business name without throwing', async () => {
    Object.assign(process.env, OAUTH_ENV)
    mockSend.mockResolvedValue({})

    await expect(
      notifyLeadCaptured({ ...BASE_PARAMS, businessName: 'A'.repeat(500) }),
    ).resolves.toBeUndefined()
  })

  it('handles visitorMessage with HTML-injectable content without throwing', async () => {
    Object.assign(process.env, OAUTH_ENV)
    mockSend.mockResolvedValue({})

    await expect(
      notifyLeadCaptured({ ...BASE_PARAMS, visitorMessage: '<script>alert(1)</script>' }),
    ).resolves.toBeUndefined()
  })
})
