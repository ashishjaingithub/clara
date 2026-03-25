/**
 * E2E: /api/demo — session creation and retrieval
 *
 * Flow coverage:
 *   - POST /api/demo creates a session (201)
 *   - GET /api/demo?uuid= returns session metadata and increments view_count
 *   - POST /api/demo without auth header returns 401
 *   - POST /api/demo with wrong auth key returns 401
 *   - POST /api/demo with missing body field returns 400
 *   - GET /api/demo with invalid UUID format returns 400
 *   - GET /api/demo with unknown UUID returns 404
 */

import { test, expect } from '@playwright/test'
import { operatorHeaders, publicHeaders, uniqueTestIP } from './helpers'

test.describe('POST /api/demo — demo session creation', () => {
  test('creates a session and returns 201 with sessionId and uuid', async ({ request }) => {
    const response = await request.post('/api/demo', {
      headers: operatorHeaders(),
      data: { hubspot_company_id: 'test-company-123' },
    })

    expect(response.status()).toBe(201)

    const body = await response.json() as { sessionId: string; uuid: string }
    expect(body).toHaveProperty('sessionId')
    expect(body).toHaveProperty('uuid')
    expect(body.sessionId).toBe(body.uuid)

    // UUID v4 format
    expect(body.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  test('creates distinct sessions for the same company (no deduplication)', async ({ request }) => {
    const ip = uniqueTestIP()
    const headers = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer e2e-test-operator-key',
      'X-Forwarded-For': ip,
    }
    const data = { hubspot_company_id: 'same-company-456' }

    const res1 = await request.post('/api/demo', { headers, data })
    const res2 = await request.post('/api/demo', { headers, data })

    const body1 = await res1.json() as { sessionId: string }
    const body2 = await res2.json() as { sessionId: string }

    // Both should succeed (2 calls from same IP, within 10/min limit)
    expect(res1.status()).toBe(201)
    expect(res2.status()).toBe(201)
    expect(body1.sessionId).not.toBe(body2.sessionId)
  })

  test('returns 401 when Authorization header is missing', async ({ request }) => {
    const response = await request.post('/api/demo', {
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': uniqueTestIP(),
      },
      data: { hubspot_company_id: 'some-company' },
    })
    // CLARA_OPERATOR_API_KEY is set in the test server — a missing Bearer header returns 401.
    expect(response.status()).toBe(401)
  })

  test('returns 401 when Authorization header has wrong key', async ({ request }) => {
    const response = await request.post('/api/demo', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer wrong-key',
        'X-Forwarded-For': uniqueTestIP(),
      },
      data: { hubspot_company_id: 'some-company' },
    })
    expect(response.status()).toBe(401)
    const body = await response.json() as { error: string }
    expect(body.error).toMatch(/unauthorized/i)
  })

  test('returns 400 when hubspot_company_id is missing', async ({ request }) => {
    const response = await request.post('/api/demo', {
      headers: operatorHeaders(),
      data: {},
    })
    expect(response.status()).toBe(400)
    const body = await response.json() as { error: string }
    expect(body.error).toMatch(/hubspot_company_id/i)
  })

  test('returns 400 when hubspot_company_id has invalid format', async ({ request }) => {
    const response = await request.post('/api/demo', {
      headers: operatorHeaders(),
      data: { hubspot_company_id: 'invalid company id with spaces!' },
    })
    expect(response.status()).toBe(400)
    const body = await response.json() as { error: string }
    expect(body.error).toMatch(/invalid/i)
  })

  test('returns 400 for non-JSON body', async ({ request }) => {
    const response = await request.post('/api/demo', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer e2e-test-operator-key',
        'X-Forwarded-For': uniqueTestIP(),
      },
      // Send a raw string that is not valid JSON by using fetch directly
      // Playwright's request.post with data: string sends it as-is if Content-Type is set
      data: 'this is not json',
    })
    // The server will fail to parse JSON and return 400
    expect(response.status()).toBe(400)
  })
})

test.describe('GET /api/demo — session metadata retrieval', () => {
  test('returns session metadata and increments view_count', async ({ request }) => {
    // Create a session first
    const createRes = await request.post('/api/demo', {
      headers: operatorHeaders(),
      data: { hubspot_company_id: 'view-count-test-co' },
    })
    expect(createRes.status()).toBe(201)
    const { sessionId } = await createRes.json() as { sessionId: string }

    const ip = uniqueTestIP()
    const getRes = await request.get(`/api/demo?uuid=${sessionId}`, {
      headers: { 'X-Forwarded-For': ip },
    })
    expect(getRes.status()).toBe(200)

    const meta = await getRes.json() as {
      sessionId: string
      businessName: string
      viewCount: number
      messageCount: number
    }

    expect(meta.sessionId).toBe(sessionId)
    expect(meta.businessName).toBe('This Business') // no Hunter data in test
    expect(meta.viewCount).toBe(1)
    expect(meta.messageCount).toBe(0)

    // Second GET increments view_count to 2
    const getRes2 = await request.get(`/api/demo?uuid=${sessionId}`, {
      headers: { 'X-Forwarded-For': ip },
    })
    expect(getRes2.status()).toBe(200)
    const meta2 = await getRes2.json() as { viewCount: number }
    expect(meta2.viewCount).toBe(2)
  })

  test('returns 400 when uuid param is missing', async ({ request }) => {
    const response = await request.get('/api/demo', {
      headers: publicHeaders(),
    })
    expect(response.status()).toBe(400)
    const body = await response.json() as { error: string }
    expect(body.error).toMatch(/uuid/i)
  })

  test('returns 400 for malformed UUID', async ({ request }) => {
    const response = await request.get('/api/demo?uuid=not-a-real-uuid', {
      headers: publicHeaders(),
    })
    expect(response.status()).toBe(400)
  })

  test('returns 404 for a valid-format UUID that does not exist', async ({ request }) => {
    const response = await request.get('/api/demo?uuid=00000000-0000-4000-8000-000000000000', {
      headers: publicHeaders(),
    })
    expect(response.status()).toBe(404)
    const body = await response.json() as { error: string }
    expect(body.error).toMatch(/not found/i)
  })
})
