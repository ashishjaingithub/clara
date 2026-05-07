import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  notifyErrorToSlack,
  _clearSlackDedupeCache,
  _getSlackDedupeCache,
} from '../../../lib/error-tracker'

/**
 * Unit tests for Slack error notification in error-tracker.ts.
 *
 * Strategy:
 * - Mock global fetch to prevent real webhook calls.
 * - Exercise: no webhook URL, successful send, deduplication, fetch failure, SLACK_WEBHOOK_ERRORS priority.
 */

function makeErrorEvent(overrides?: Record<string, unknown>) {
  return {
    id: 'err_1234_abc123',
    timestamp: '2026-04-01T12:00:00.000Z',
    project: 'clara' as const,
    source: 'server' as const,
    severity: 'high' as ('low' | 'medium' | 'high' | 'critical'),
    status: 'detected' as const,
    error: {
      message: 'HubSpot is currently unavailable',
      type: 'ExternalServiceError',
      code: 'EXTERNAL_SERVICE_ERROR',
      statusCode: 502,
      retryable: true,
    },
    context: { operation: 'hubspot-upsert' },
    resolution: null,
    ...overrides,
  }
}

describe('notifyErrorToSlack', () => {
  const fetchSpy = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    _clearSlackDedupeCache()
    globalThis.fetch = fetchSpy
    fetchSpy.mockResolvedValue({ ok: true, status: 200 })
    delete process.env.SLACK_WEBHOOK_URL
    delete process.env.SLACK_WEBHOOK_ERRORS
  })

  afterEach(() => {
    delete process.env.SLACK_WEBHOOK_URL
    delete process.env.SLACK_WEBHOOK_ERRORS
  })

  // ── No webhook configured ────────────────────────────────────────────────

  it('does nothing when no SLACK_WEBHOOK_URL or SLACK_WEBHOOK_ERRORS is set', async () => {
    await notifyErrorToSlack(makeErrorEvent())
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  // ── Successful send ──────────────────────────────────────────────────────

  it('sends POST to SLACK_WEBHOOK_URL with error details', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://test-webhook.example.com/slack'

    await notifyErrorToSlack(makeErrorEvent())

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, opts] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://test-webhook.example.com/slack')
    expect(opts.method).toBe('POST')
    expect(opts.headers['Content-Type']).toBe('application/json')

    const body = JSON.parse(opts.body)
    expect(body.text).toContain('HIGH')
    expect(body.text).toContain('EXTERNAL_SERVICE_ERROR')
    expect(body.blocks[0].text.text).toContain('clara')
    expect(body.blocks[0].text.text).toContain('high')
    expect(body.blocks[0].text.text).toContain('HubSpot is currently unavailable')
  })

  // ── SLACK_WEBHOOK_ERRORS priority ────────────────────────────────────────

  it('prefers SLACK_WEBHOOK_ERRORS over SLACK_WEBHOOK_URL', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://test-webhook.example.com/general'
    process.env.SLACK_WEBHOOK_ERRORS = 'https://test-webhook.example.com/errors'

    await notifyErrorToSlack(makeErrorEvent())

    const [url] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://test-webhook.example.com/errors')
  })

  // ── Deduplication ────────────────────────────────────────────────────────

  it('deduplicates identical error messages within 5-minute window', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://test-webhook.example.com/slack'

    await notifyErrorToSlack(makeErrorEvent())
    await notifyErrorToSlack(makeErrorEvent())
    await notifyErrorToSlack(makeErrorEvent())

    // Only the first call should go through
    expect(fetchSpy).toHaveBeenCalledOnce()
  })

  it('allows different error messages through deduplication', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://test-webhook.example.com/slack'

    await notifyErrorToSlack(makeErrorEvent())
    await notifyErrorToSlack(
      makeErrorEvent({ error: { message: 'Different error', type: 'LLMError', code: 'LLM_ERROR', statusCode: 502, retryable: true } }),
    )

    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('allows resend after dedup window expires', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://test-webhook.example.com/slack'

    await notifyErrorToSlack(makeErrorEvent())
    expect(fetchSpy).toHaveBeenCalledOnce()

    // Simulate expired dedup window by backdating the cache entry
    const cache = _getSlackDedupeCache()
    const msg = 'HubSpot is currently unavailable'
    cache.set(msg, Date.now() - 6 * 60 * 1000) // 6 minutes ago

    await notifyErrorToSlack(makeErrorEvent())
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  // ── Fire-and-forget resilience ───────────────────────────────────────────

  it('never throws when fetch rejects', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://test-webhook.example.com/slack'
    fetchSpy.mockRejectedValue(new Error('Network timeout'))
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    await expect(notifyErrorToSlack(makeErrorEvent())).resolves.toBeUndefined()

    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('Slack error notification failed'),
    )
    stderrSpy.mockRestore()
  })

  it('never throws when fetch returns non-ok response', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://test-webhook.example.com/slack'
    fetchSpy.mockResolvedValue({ ok: false, status: 500 })

    // Should not throw — fire-and-forget
    await expect(notifyErrorToSlack(makeErrorEvent())).resolves.toBeUndefined()
  })

  // ── Payload structure ────────────────────────────────────────────────────

  it('includes severity, project, timestamp, code, message, type, and retryable in payload', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://test-webhook.example.com/slack'
    const event = makeErrorEvent({ severity: 'critical' })

    await notifyErrorToSlack(event)

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
    const text = body.blocks[0].text.text
    expect(text).toContain('*Project:* clara')
    expect(text).toContain('*Severity:* critical')
    expect(text).toContain('*Code:* EXTERNAL_SERVICE_ERROR')
    expect(text).toContain('*Message:* HubSpot is currently unavailable')
    expect(text).toContain('*Type:* ExternalServiceError')
    expect(text).toContain('*Retryable:* true')
    expect(text).toContain('*Timestamp:*')
  })

  it('sets a 5-second timeout via AbortSignal', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://test-webhook.example.com/slack'

    await notifyErrorToSlack(makeErrorEvent())

    const opts = fetchSpy.mock.calls[0][1]
    expect(opts.signal).toBeDefined()
  })
})
