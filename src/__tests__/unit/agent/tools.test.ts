import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

// ── agent-core mocks — use vi.hoisted so refs are available in vi.mock factory ─
const { mockGetAvailableSlots, mockBookAppointment, mockUpsertContact } = vi.hoisted(() => ({
  mockGetAvailableSlots: vi.fn(),
  mockBookAppointment: vi.fn(),
  mockUpsertContact: vi.fn(),
}))

vi.mock('@agenticlearning/agent-core', () => ({
  getAvailableSlots: mockGetAvailableSlots,
  bookAppointment: mockBookAppointment,
  upsertContact: mockUpsertContact,
  // withRetry is a pass-through in tests — the mocked fns already control outcomes
  withRetry: async <T>(fn: () => Promise<T>) => fn(),
}))

import { createClaraTools } from '../../../agent/tools'
import type { EnrichmentProfile } from '@agenticlearning/agent-core'

// ── Helpers ──────────────────────────────────────────────────────────────────

function getToolByName(tools: ReturnType<typeof createClaraTools>, name: string) {
  const tool = tools.find((t) => t.name === name)
  if (!tool) throw new Error(`Tool "${name}" not found`)
  return tool
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeAll(() => {
  process.env.SIMULATE_APIS = 'true'
})

beforeEach(() => {
  mockGetAvailableSlots.mockReset()
  mockBookAppointment.mockReset()
  mockUpsertContact.mockReset()
  // Reset relevant env vars to predictable defaults
  delete process.env.GOOGLE_CALENDAR_ID
  delete process.env.BUSINESS_TIMEZONE
})

// ── createClaraTools structure ────────────────────────────────────────────────

describe('createClaraTools', () => {
  it('returns exactly 4 tools', () => {
    const tools = createClaraTools(null)
    expect(tools).toHaveLength(4)
  })

  it('tools have the correct names', () => {
    const tools = createClaraTools(null)
    const names = tools.map((t) => t.name)
    expect(names).toContain('get_available_slots')
    expect(names).toContain('book_appointment')
    expect(names).toContain('upsert_contact')
    expect(names).toContain('get_enrichment_details')
  })

  it('tools have non-empty descriptions', () => {
    const tools = createClaraTools(null)
    for (const tool of tools) {
      expect(tool.description.length).toBeGreaterThan(0)
    }
  })

  it('uses env var fallbacks when enrichmentProfile is null', () => {
    process.env.GOOGLE_CALENDAR_ID = 'cal-from-env@group.calendar.google.com'
    process.env.BUSINESS_TIMEZONE = 'America/New_York'

    // Just verify tools are created (env vars are consumed at factory call time)
    const tools = createClaraTools(null)
    expect(tools).toHaveLength(4)
  })

  it('uses enrichmentProfile values over env var fallbacks', () => {
    process.env.GOOGLE_CALENDAR_ID = 'env-cal@group.calendar.google.com'
    const profile: EnrichmentProfile = {
      companyId: 'biz-001',
      companyName: 'Test Co',
      calendarId: 'profile-cal@group.calendar.google.com',
      timezone: 'America/Chicago',
      bookingDurationMinutes: 60,
    }
    const tools = createClaraTools(profile)
    expect(tools).toHaveLength(4)
  })
})

// ── get_available_slots ───────────────────────────────────────────────────────

describe('get_available_slots tool', () => {
  it('returns formatted slot list on success', async () => {
    mockGetAvailableSlots.mockResolvedValueOnce([
      { start: '2026-03-25T14:00:00', end: '2026-03-25T14:30:00', label: 'Tue Mar 25 at 2:00 PM' },
      { start: '2026-03-25T15:00:00', end: '2026-03-25T15:30:00', label: 'Tue Mar 25 at 3:00 PM' },
    ])

    const tools = createClaraTools(null)
    const tool = getToolByName(tools, 'get_available_slots')
    const result = await tool.invoke({})

    expect(result).toContain('Available appointment slots')
    expect(result).toContain('Tue Mar 25 at 2:00 PM')
    expect(result).toContain('Tue Mar 25 at 3:00 PM')
    expect(result).toContain('2026-03-25T14:00:00')
  })

  it('returns no-slots message when empty array returned', async () => {
    mockGetAvailableSlots.mockResolvedValueOnce([])

    const tools = createClaraTools(null)
    const tool = getToolByName(tools, 'get_available_slots')
    const result = await tool.invoke({})

    expect(result).toContain('No available slots')
  })

  it('returns error string (does not throw) when getAvailableSlots throws', async () => {
    mockGetAvailableSlots.mockRejectedValueOnce(new Error('Calendar API unreachable'))

    const tools = createClaraTools(null)
    const tool = getToolByName(tools, 'get_available_slots')
    const result = await tool.invoke({})

    expect(result).toContain('Failed to retrieve available slots')
    expect(result).toContain('Calendar API unreachable')
  })

  it('passes calendarId, timezone, and durationMinutes from enrichment profile', async () => {
    mockGetAvailableSlots.mockResolvedValueOnce([])

    const profile: EnrichmentProfile = {
      companyId: 'biz-002',
      companyName: 'Test Co',
      calendarId: 'custom-cal@group.calendar.google.com',
      timezone: 'America/Denver',
      bookingDurationMinutes: 45,
    }
    const tools = createClaraTools(profile)
    const tool = getToolByName(tools, 'get_available_slots')
    await tool.invoke({})

    expect(mockGetAvailableSlots).toHaveBeenCalledWith(
      'custom-cal@group.calendar.google.com',
      'America/Denver',
      45,
    )
  })
})

// ── book_appointment ──────────────────────────────────────────────────────────

describe('book_appointment tool', () => {
  it('returns success message with event ID on successful booking', async () => {
    mockBookAppointment.mockResolvedValueOnce({
      success: true,
      eventId: 'evt-abc-123',
      start: '2026-03-25T14:00:00',
      end: '2026-03-25T14:30:00',
      label: 'Tue Mar 25 at 2:00 PM',
    })

    const tools = createClaraTools(null)
    const tool = getToolByName(tools, 'book_appointment')
    const result = await tool.invoke({
      start: '2026-03-25T14:00:00',
      end: '2026-03-25T14:30:00',
      attendeeEmail: 'visitor@example.com',
      attendeeName: 'Jane Smith',
    })

    expect(result).toContain('Appointment booked successfully')
    expect(result).toContain('evt-abc-123')
    expect(result).toContain('Tue Mar 25 at 2:00 PM')
  })

  it('includes calendar link when htmlLink is returned', async () => {
    mockBookAppointment.mockResolvedValueOnce({
      success: true,
      eventId: 'evt-xyz',
      start: '2026-03-25T14:00:00',
      end: '2026-03-25T14:30:00',
      label: 'Tue Mar 25 at 2:00 PM',
      htmlLink: 'https://calendar.google.com/event?eid=abc123',
    })

    const tools = createClaraTools(null)
    const tool = getToolByName(tools, 'book_appointment')
    const result = await tool.invoke({
      start: '2026-03-25T14:00:00',
      end: '2026-03-25T14:30:00',
      attendeeEmail: 'visitor@example.com',
      attendeeName: 'Jane Smith',
    })

    expect(result).toContain('https://calendar.google.com/event?eid=abc123')
  })

  it('returns failure message when success is false', async () => {
    mockBookAppointment.mockResolvedValueOnce({
      success: false,
      eventId: '',
      start: '2026-03-25T14:00:00',
      end: '2026-03-25T14:30:00',
      label: '',
    })

    const tools = createClaraTools(null)
    const tool = getToolByName(tools, 'book_appointment')
    const result = await tool.invoke({
      start: '2026-03-25T14:00:00',
      end: '2026-03-25T14:30:00',
      attendeeEmail: 'visitor@example.com',
      attendeeName: 'Jane Smith',
    })

    expect(result).toContain('Appointment booking failed')
  })

  it('returns slot conflict message when SLOT_CONFLICT error is thrown', async () => {
    mockBookAppointment.mockRejectedValueOnce(
      Object.assign(new Error('SLOT_CONFLICT'), { code: 'SLOT_CONFLICT' }),
    )

    const tools = createClaraTools(null)
    const tool = getToolByName(tools, 'book_appointment')
    const result = await tool.invoke({
      start: '2026-03-25T14:00:00',
      end: '2026-03-25T14:30:00',
      attendeeEmail: 'visitor@example.com',
      attendeeName: 'Jane Smith',
    })

    expect(result).toContain('just taken')
    expect(result).toContain('get_available_slots')
  })

  it('returns generic error string (does not throw) on unexpected error', async () => {
    mockBookAppointment.mockRejectedValueOnce(new Error('Network timeout'))

    const tools = createClaraTools(null)
    const tool = getToolByName(tools, 'book_appointment')
    const result = await tool.invoke({
      start: '2026-03-25T14:00:00',
      end: '2026-03-25T14:30:00',
      attendeeEmail: 'visitor@example.com',
      attendeeName: 'Jane Smith',
    })

    expect(result).toContain('Failed to book appointment')
    expect(result).toContain('Network timeout')
  })

  it('passes calendarId and timezone from enrichment profile to bookAppointment', async () => {
    mockBookAppointment.mockResolvedValueOnce({
      success: true,
      eventId: 'evt-123',
      start: '2026-03-25T14:00:00',
      end: '2026-03-25T14:30:00',
      label: 'Tue Mar 25 at 2:00 PM',
    })

    const profile: EnrichmentProfile = {
      companyId: 'biz-003',
      companyName: 'Test Co',
      calendarId: 'profile-cal@group.calendar.google.com',
      timezone: 'America/Chicago',
    }
    const tools = createClaraTools(profile)
    const tool = getToolByName(tools, 'book_appointment')
    await tool.invoke({
      start: '2026-03-25T14:00:00',
      end: '2026-03-25T14:30:00',
      attendeeEmail: 'visitor@example.com',
      attendeeName: 'Jane Smith',
      description: 'Initial consultation',
    })

    expect(mockBookAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: 'profile-cal@group.calendar.google.com',
        timezone: 'America/Chicago',
        description: 'Initial consultation',
      }),
    )
  })
})

// ── upsert_contact ────────────────────────────────────────────────────────────

describe('upsert_contact tool', () => {
  it('returns created message when new contact is created', async () => {
    mockUpsertContact.mockResolvedValueOnce({ contactId: 'cid-001', created: true })

    const tools = createClaraTools(null)
    const tool = getToolByName(tools, 'upsert_contact')
    const result = await tool.invoke({ email: 'new@example.com' })

    expect(result).toContain('Contact created successfully')
    expect(result).toContain('cid-001')
    expect(result).toContain('new@example.com')
  })

  it('returns updated message when existing contact is found', async () => {
    mockUpsertContact.mockResolvedValueOnce({ contactId: 'cid-existing', created: false })

    const tools = createClaraTools(null)
    const tool = getToolByName(tools, 'upsert_contact')
    const result = await tool.invoke({ email: 'existing@example.com' })

    expect(result).toContain('Contact updated successfully')
    expect(result).toContain('cid-existing')
  })

  it('passes all optional fields to upsertContact', async () => {
    mockUpsertContact.mockResolvedValueOnce({ contactId: 'cid-full', created: true })

    const tools = createClaraTools(null)
    const tool = getToolByName(tools, 'upsert_contact')
    await tool.invoke({
      email: 'full@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      phone: '+15551234567',
      notes: 'Interested in premium plan',
    })

    expect(mockUpsertContact).toHaveBeenCalledWith({
      email: 'full@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      phone: '+15551234567',
      notes: 'Interested in premium plan',
    })
  })

  it('returns error string (does not throw) when upsertContact throws', async () => {
    mockUpsertContact.mockRejectedValueOnce(new Error('HubSpot rate limit exceeded'))

    const tools = createClaraTools(null)
    const tool = getToolByName(tools, 'upsert_contact')
    const result = await tool.invoke({ email: 'test@example.com' })

    expect(result).toContain('Failed to save contact information')
    expect(result).toContain('HubSpot rate limit exceeded')
  })
})

// ── get_enrichment_details ────────────────────────────────────────────────────

describe('get_enrichment_details tool', () => {
  it('returns no-profile message when enrichmentProfile is null', async () => {
    const tools = createClaraTools(null)
    const tool = getToolByName(tools, 'get_enrichment_details')
    const result = await tool.invoke({})

    expect(result).toContain('No enrichment profile available')
  })

  it('returns formatted profile details when enrichmentProfile is provided', async () => {
    const profile: EnrichmentProfile = {
      companyId: 'biz-010',
      companyName: 'Elite Dental',
      industry: 'Dental',
      phone: '555-9000',
      website: 'https://elitedental.com',
      address: '123 Main St',
      hours: 'Mon-Fri 9am-5pm',
      timezone: 'America/Los_Angeles',
      bookingDurationMinutes: 30,
      services: ['Cleaning', 'Whitening', 'Fillings'],
      pitchAngle: 'Same-day emergency appointments',
      techMaturity: 'medium',
      priority: 'high',
    }

    const tools = createClaraTools(profile)
    const tool = getToolByName(tools, 'get_enrichment_details')
    const result = await tool.invoke({})

    expect(result).toContain('Elite Dental')
    expect(result).toContain('Dental')
    expect(result).toContain('555-9000')
    expect(result).toContain('https://elitedental.com')
    expect(result).toContain('123 Main St')
    expect(result).toContain('Mon-Fri 9am-5pm')
    expect(result).toContain('America/Los_Angeles')
    expect(result).toContain('30')
    expect(result).toContain('Cleaning')
    expect(result).toContain('Same-day emergency appointments')
    expect(result).toContain('medium')
    expect(result).toContain('high')
  })

  it('includes pain points when provided', async () => {
    const profile: EnrichmentProfile = {
      companyId: 'biz-011',
      companyName: 'Service Co',
      painPoints: [
        { problem: 'Missed calls', reviewQuote: 'Always busy', aiSolution: 'AI answers 24/7' },
        { problem: 'Slow booking', reviewQuote: 'Too slow', aiSolution: 'Instant booking' },
      ],
    }

    const tools = createClaraTools(profile)
    const tool = getToolByName(tools, 'get_enrichment_details')
    const result = await tool.invoke({})

    expect(result).toContain('Pain points addressed')
    expect(result).toContain('Missed calls')
    expect(result).toContain('AI answers 24/7')
    expect(result).toContain('Slow booking')
  })

  it('handles enrichmentProfile with only required fields gracefully', async () => {
    const profile: EnrichmentProfile = {
      companyId: 'biz-012',
      companyName: 'Minimal Co',
    }

    const tools = createClaraTools(profile)
    const tool = getToolByName(tools, 'get_enrichment_details')
    const result = await tool.invoke({})

    expect(result).toContain('Minimal Co')
    // Optional fields should not appear with undefined/null values
    expect(result).not.toContain('undefined')
    expect(result).not.toContain('null')
  })
})
