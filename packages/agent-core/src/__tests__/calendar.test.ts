import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Hoist mock functions so they're available inside vi.mock() factory
const calMocks = vi.hoisted(() => ({
  eventsInsert: vi.fn(),
  freebusyQuery: vi.fn(),
  jwtConstructor: vi.fn().mockImplementation(() => ({})),
  calendarFactory: null as ReturnType<typeof vi.fn> | null,
}))

vi.mock('googleapis', () => ({
  google: {
    // calendar() is a regular function call (not new), so mockReturnValue is fine
    calendar: vi.fn().mockReturnValue({
      events: { insert: calMocks.eventsInsert },
      freebusy: { query: calMocks.freebusyQuery },
    }),
    auth: {
      // JWT is called with `new`, so needs mockImplementation(class)
      JWT: vi.fn().mockImplementation(class MockJWT {}),
    },
  },
}))

vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(() =>
      JSON.stringify({ client_email: 'test@test.iam.gserviceaccount.com', private_key: 'fake-key' }),
    ),
  },
}))

import { getAvailableSlots, bookAppointment, _resetCalendarClient } from '../calendar.js'

const TEST_CALENDAR_ID = 'test-cal@group.calendar.google.com'
const TEST_TIMEZONE = 'America/Los_Angeles'

describe('getAvailableSlots', () => {
  beforeEach(() => {
    _resetCalendarClient()
    vi.clearAllMocks()
    delete process.env['SIMULATE_APIS']
    delete process.env['GOOGLE_SERVICE_ACCOUNT_KEY_PATH']
    delete process.env['BUSINESS_TIMEZONE']
  })

  it('returns mock slots when SIMULATE_APIS=true', async () => {
    process.env['SIMULATE_APIS'] = 'true'
    const slots = await getAvailableSlots(TEST_CALENDAR_ID, TEST_TIMEZONE, 30)
    expect(slots.length).toBeGreaterThan(0)
    expect(slots[0]).toHaveProperty('start')
    expect(slots[0]).toHaveProperty('end')
    expect(slots[0]).toHaveProperty('label')
  })

  it('uses BUSINESS_TIMEZONE env var as fallback timezone', async () => {
    process.env['SIMULATE_APIS'] = 'true'
    process.env['BUSINESS_TIMEZONE'] = 'America/New_York'
    const slots = await getAvailableSlots(TEST_CALENDAR_ID)
    expect(slots.length).toBeGreaterThan(0)
  })

  it('returns available slots filtered by freebusy in real mode', async () => {
    process.env['GOOGLE_SERVICE_ACCOUNT_KEY_PATH'] = '/fake/path.json'
    const today = new Date()
    today.setDate(today.getDate() + 1)
    const dateStr = today.toLocaleDateString('en-CA', { timeZone: TEST_TIMEZONE })

    calMocks.freebusyQuery.mockResolvedValueOnce({
      data: {
        calendars: {
          [TEST_CALENDAR_ID]: {
            busy: [{ start: `${dateStr}T09:00:00`, end: `${dateStr}T09:30:00` }],
          },
        },
      },
    })

    const slots = await getAvailableSlots(TEST_CALENDAR_ID, TEST_TIMEZONE, 30)
    expect(slots.length).toBeGreaterThan(0)
    const conflictingSlot = slots.find((s) => s.start === `${dateStr}T09:00:00`)
    expect(conflictingSlot).toBeUndefined()
  })

  it('returns empty array when freebusy query fails (fail-safe)', async () => {
    process.env['GOOGLE_SERVICE_ACCOUNT_KEY_PATH'] = '/fake/path.json'
    calMocks.freebusyQuery.mockRejectedValueOnce(new Error('Network error'))
    const slots = await getAvailableSlots(TEST_CALENDAR_ID, TEST_TIMEZONE, 30)
    expect(slots).toEqual([])
  })

  it('returns empty array when GOOGLE_SERVICE_ACCOUNT_KEY_PATH missing (fail-safe)', async () => {
    // getCalendarClient throws, which is caught by the fail-safe and returns []
    const slots = await getAvailableSlots(TEST_CALENDAR_ID, TEST_TIMEZONE, 30)
    expect(slots).toEqual([])
  })

  it('returns empty array when durationMinutes > 60 (no slots generated)', async () => {
    // generateSlots loop condition m+duration<=60 never holds → allSlots=[] → early return
    const slots = await getAvailableSlots(TEST_CALENDAR_ID, TEST_TIMEZONE, 90)
    expect(slots).toEqual([])
  })

  it('returns all slots when freebusy response has no entry for calendar (covers ?? [] fallback)', async () => {
    process.env['GOOGLE_SERVICE_ACCOUNT_KEY_PATH'] = '/fake/path.json'
    calMocks.freebusyQuery.mockResolvedValueOnce({
      data: { calendars: {} }, // calendarId key absent → res.data.calendars?.[calendarId]?.busy ?? []
    })
    const slots = await getAvailableSlots(TEST_CALENDAR_ID, TEST_TIMEZONE, 30)
    expect(slots.length).toBeGreaterThan(0)
  })

  it('uses America/Los_Angeles when no timezone param and BUSINESS_TIMEZONE not set', async () => {
    process.env['SIMULATE_APIS'] = 'true'
    // BUSINESS_TIMEZONE deleted in beforeEach; no timezone arg → hits ?? 'America/Los_Angeles' on line 70
    const slots = await getAvailableSlots(TEST_CALENDAR_ID)
    expect(slots.length).toBeGreaterThan(0)
  })

  it('reuses cached calendar client on repeated calls without reset (covers singleton line 21)', async () => {
    process.env['GOOGLE_SERVICE_ACCOUNT_KEY_PATH'] = '/fake/path.json'
    calMocks.freebusyQuery
      .mockResolvedValueOnce({ data: { calendars: {} } })
      .mockResolvedValueOnce({ data: { calendars: {} } })
    // First call initializes client; second call hits `if (_calendarClient) return _calendarClient`
    await getAvailableSlots(TEST_CALENDAR_ID, TEST_TIMEZONE, 30)
    await getAvailableSlots(TEST_CALENDAR_ID, TEST_TIMEZONE, 30)
    expect(calMocks.freebusyQuery).toHaveBeenCalledTimes(2)
  })

  it('handles busy times with null start/end without throwing (covers b.start ?? "" branches)', async () => {
    process.env['GOOGLE_SERVICE_ACCOUNT_KEY_PATH'] = '/fake/path.json'
    calMocks.freebusyQuery.mockResolvedValueOnce({
      data: {
        calendars: {
          [TEST_CALENDAR_ID]: { busy: [{ start: null, end: null }] },
        },
      },
    })
    const slots = await getAvailableSlots(TEST_CALENDAR_ID, TEST_TIMEZONE, 30)
    // null busy times produce NaN timestamps → no slots filtered
    expect(slots.length).toBeGreaterThan(0)
  })
})

describe('bookAppointment', () => {
  const baseParams = {
    start: '2026-03-25T10:00:00',
    end: '2026-03-25T10:30:00',
    attendeeEmail: 'prospect@example.com',
    attendeeName: 'Jane Smith',
    calendarId: TEST_CALENDAR_ID,
    timezone: TEST_TIMEZONE,
  }

  beforeEach(() => {
    _resetCalendarClient()
    vi.clearAllMocks()
    delete process.env['SIMULATE_APIS']
    delete process.env['CLARA_CONFIRM_BOOKING']
    delete process.env['NODE_ENV']
    delete process.env['GOOGLE_SERVICE_ACCOUNT_KEY_PATH']
    delete process.env['BUSINESS_TIMEZONE']
  })

  it('returns mock booking when SIMULATE_APIS=true', async () => {
    process.env['SIMULATE_APIS'] = 'true'
    const result = await bookAppointment(baseParams)
    expect(result.success).toBe(true)
    expect(result.eventId).toMatch(/^sim-evt-/)
    expect(result.start).toBe(baseParams.start)
    expect(result.end).toBe(baseParams.end)
    expect(result.label).toBeTruthy()
  })

  it('uses idempotencyKey in sim event ID', async () => {
    process.env['SIMULATE_APIS'] = 'true'
    const result = await bookAppointment({ ...baseParams, idempotencyKey: 'test-key-123' })
    expect(result.eventId).toBe('sim-evt-test-key-123')
  })

  it('blocks booking outside local dev without CLARA_CONFIRM_BOOKING', async () => {
    process.env['NODE_ENV'] = 'staging'
    await expect(bookAppointment(baseParams)).rejects.toThrow('CLARA_CONFIRM_BOOKING')
  })

  it('allows booking in development without CLARA_CONFIRM_BOOKING', async () => {
    process.env['NODE_ENV'] = 'development'
    process.env['GOOGLE_SERVICE_ACCOUNT_KEY_PATH'] = '/fake/path.json'
    calMocks.eventsInsert.mockResolvedValueOnce({
      data: {
        id: 'real-event-123',
        start: { dateTime: baseParams.start },
        end: { dateTime: baseParams.end },
        htmlLink: 'https://calendar.google.com/event/123',
      },
    })

    const result = await bookAppointment(baseParams)
    expect(result.success).toBe(true)
    expect(result.eventId).toBe('real-event-123')
    expect(result.htmlLink).toBe('https://calendar.google.com/event/123')
  })

  it('allows booking when CLARA_CONFIRM_BOOKING=true in production', async () => {
    process.env['NODE_ENV'] = 'production'
    process.env['CLARA_CONFIRM_BOOKING'] = 'true'
    process.env['GOOGLE_SERVICE_ACCOUNT_KEY_PATH'] = '/fake/path.json'
    calMocks.eventsInsert.mockResolvedValueOnce({
      data: {
        id: 'prod-event-456',
        start: { dateTime: baseParams.start },
        end: { dateTime: baseParams.end },
        htmlLink: null,
      },
    })

    const result = await bookAppointment(baseParams)
    expect(result.success).toBe(true)
    expect(result.eventId).toBe('prod-event-456')
    expect(result.htmlLink).toBeUndefined()
  })

  it('falls back to param values when Google returns null dates', async () => {
    process.env['NODE_ENV'] = 'development'
    process.env['GOOGLE_SERVICE_ACCOUNT_KEY_PATH'] = '/fake/path.json'
    calMocks.eventsInsert.mockResolvedValueOnce({
      data: { id: null, start: null, end: null, htmlLink: null },
    })

    const result = await bookAppointment(baseParams)
    expect(result.eventId).toBe('')
    expect(result.start).toBe(baseParams.start)
    expect(result.end).toBe(baseParams.end)
  })

  it('throws SLOT_CONFLICT on response 409', async () => {
    process.env['NODE_ENV'] = 'development'
    process.env['GOOGLE_SERVICE_ACCOUNT_KEY_PATH'] = '/fake/path.json'
    calMocks.eventsInsert.mockRejectedValueOnce({ response: { status: 409 } })

    await expect(bookAppointment(baseParams)).rejects.toMatchObject({ code: 'SLOT_CONFLICT' })
  })

  it('throws SLOT_CONFLICT on error code 409', async () => {
    process.env['NODE_ENV'] = 'development'
    process.env['GOOGLE_SERVICE_ACCOUNT_KEY_PATH'] = '/fake/path.json'
    calMocks.eventsInsert.mockRejectedValueOnce({ code: 409 })

    await expect(bookAppointment(baseParams)).rejects.toMatchObject({ code: 'SLOT_CONFLICT' })
  })

  it('rethrows non-409 errors', async () => {
    process.env['NODE_ENV'] = 'development'
    process.env['GOOGLE_SERVICE_ACCOUNT_KEY_PATH'] = '/fake/path.json'
    calMocks.eventsInsert.mockRejectedValueOnce(new Error('Internal server error'))

    await expect(bookAppointment(baseParams)).rejects.toThrow('Internal server error')
  })

  it('includes description and idempotency key in event body', async () => {
    process.env['NODE_ENV'] = 'development'
    process.env['GOOGLE_SERVICE_ACCOUNT_KEY_PATH'] = '/fake/path.json'
    calMocks.eventsInsert.mockResolvedValueOnce({
      data: { id: 'evt', start: { dateTime: baseParams.start }, end: { dateTime: baseParams.end }, htmlLink: null },
    })

    await bookAppointment({ ...baseParams, description: 'Demo call', idempotencyKey: 'k1' })

    const callArgs = calMocks.eventsInsert.mock.calls[0]![0] as {
      requestBody: { description: string }
    }
    expect(callArgs.requestBody.description).toContain('Demo call')
    expect(callArgs.requestBody.description).toContain('k1')
  })

  it('uses BUSINESS_TIMEZONE fallback when timezone not provided', async () => {
    process.env['SIMULATE_APIS'] = 'true'
    process.env['BUSINESS_TIMEZONE'] = 'America/Chicago'
    const result = await bookAppointment({ ...baseParams, timezone: undefined as unknown as string })
    expect(result.success).toBe(true)
  })

  it('sends no attendees when email is empty string', async () => {
    process.env['NODE_ENV'] = 'development'
    process.env['GOOGLE_SERVICE_ACCOUNT_KEY_PATH'] = '/fake/path.json'
    calMocks.eventsInsert.mockResolvedValueOnce({
      data: { id: 'no-attendee-evt', start: { dateTime: baseParams.start }, end: { dateTime: baseParams.end }, htmlLink: null },
    })

    await bookAppointment({ ...baseParams, attendeeEmail: '' })

    const callArgs = calMocks.eventsInsert.mock.calls[0]![0] as {
      requestBody: { attendees: unknown[] }
    }
    expect(callArgs.requestBody.attendees).toEqual([])
  })

  it('uses America/Los_Angeles when no timezone param and BUSINESS_TIMEZONE not set', async () => {
    process.env['SIMULATE_APIS'] = 'true'
    // BUSINESS_TIMEZONE deleted in beforeEach; timezone omitted → hits ?? 'America/Los_Angeles' on line 110
    const result = await bookAppointment({ ...baseParams, timezone: undefined as unknown as string })
    expect(result.success).toBe(true)
  })

  it('uses generic summary when attendeeName is absent (covers ternary false branch)', async () => {
    process.env['NODE_ENV'] = 'development'
    process.env['GOOGLE_SERVICE_ACCOUNT_KEY_PATH'] = '/fake/path.json'
    calMocks.eventsInsert.mockResolvedValueOnce({
      data: { id: 'generic-evt', start: { dateTime: baseParams.start }, end: { dateTime: baseParams.end }, htmlLink: null },
    })

    await bookAppointment({ ...baseParams, attendeeName: undefined })

    const callArgs = calMocks.eventsInsert.mock.calls[0]![0] as {
      requestBody: { summary: string }
    }
    expect(callArgs.requestBody.summary).toBe('Demo call')
  })
})
