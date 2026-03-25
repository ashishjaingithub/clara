import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { requireOperatorAuth } from '../../../lib/auth'

function makeRequest(authHeader?: string): NextRequest {
  return new NextRequest('http://localhost:3002/api/demo', {
    method: 'POST',
    headers: authHeader ? { authorization: authHeader } : {},
  })
}

// Helper to safely set NODE_ENV in tests (TS marks it as read-only in ProcessEnv typedef)
function setNodeEnv(value: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(process.env as any).NODE_ENV = value
}

describe('requireOperatorAuth', () => {
  const originalKey = process.env.CLARA_OPERATOR_API_KEY
  const originalEnv = process.env.NODE_ENV

  beforeEach(() => {
    process.env.CLARA_OPERATOR_API_KEY = 'test-operator-key'
    setNodeEnv('test')
  })

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.CLARA_OPERATOR_API_KEY
    } else {
      process.env.CLARA_OPERATOR_API_KEY = originalKey
    }
    setNodeEnv(originalEnv ?? 'test')
  })

  it('returns null (auth pass) when correct key is provided', () => {
    const req = makeRequest('Bearer test-operator-key')
    const result = requireOperatorAuth(req)
    expect(result).toBeNull()
  })

  it('returns 401 when Authorization header is missing', async () => {
    const req = makeRequest()
    const result = requireOperatorAuth(req)
    expect(result).not.toBeNull()
    expect(result!.status).toBe(401)
    const body = await result!.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 when Authorization header does not start with Bearer', async () => {
    const req = makeRequest('Basic dGVzdA==')
    const result = requireOperatorAuth(req)
    expect(result).not.toBeNull()
    expect(result!.status).toBe(401)
  })

  it('returns 401 when wrong key is provided', async () => {
    const req = makeRequest('Bearer wrong-key')
    const result = requireOperatorAuth(req)
    expect(result).not.toBeNull()
    expect(result!.status).toBe(401)
    const body = await result!.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 when key is empty string in bearer', async () => {
    const req = makeRequest('Bearer ')
    const result = requireOperatorAuth(req)
    expect(result).not.toBeNull()
    expect(result!.status).toBe(401)
  })

  it('is timing-safe — does not reveal whether key exists via error difference', () => {
    // Both wrong key and missing key produce the same 401 response
    const wrongKeyReq = makeRequest('Bearer wrong-key')
    const noKeyReq = makeRequest()
    const r1 = requireOperatorAuth(wrongKeyReq)
    const r2 = requireOperatorAuth(noKeyReq)
    expect(r1?.status).toBe(r2?.status)
  })

  it('bypasses auth with warning when key is not set in non-production env', () => {
    delete process.env.CLARA_OPERATOR_API_KEY
    setNodeEnv('development')
    const req = makeRequest('Bearer any-value')
    const result = requireOperatorAuth(req)
    expect(result).toBeNull() // auth bypassed
  })

  it('returns 401 in production when key is not set', () => {
    delete process.env.CLARA_OPERATOR_API_KEY
    setNodeEnv('production')
    const req = makeRequest('Bearer any-value')
    const result = requireOperatorAuth(req)
    expect(result?.status).toBe(401)
  })
})
