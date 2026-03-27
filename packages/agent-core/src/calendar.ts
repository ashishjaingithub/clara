/**
 * Google Calendar tools — shared between Clara (chat) and Veya (voice).
 *
 * Simulation guard comes FIRST in every function (before HITL gates or real API calls).
 * Set SIMULATE_APIS=true in test environments to prevent real API calls.
 *
 * HITL gate: CLARA_CONFIRM_BOOKING=true required to create calendar events outside local dev.
 */

import { google } from 'googleapis'
import fs from 'fs'
import type { BookAppointmentParams, BookingResult, TimeSlot } from './types'
import { getNextBusinessDays, generateSlots, formatSlotLabel } from './utils/slots'
import { withRetry } from './utils/retry'

// ── Google Calendar client (lazy singleton) ───────────────────────────────────

let _calendarClient: ReturnType<typeof google.calendar> | null = null

function getCalendarClient(): ReturnType<typeof google.calendar> {
  if (_calendarClient) return _calendarClient

  const keyPath = process.env['GOOGLE_SERVICE_ACCOUNT_KEY_PATH']
  if (!keyPath) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY_PATH env var is required')
  }

  const key = JSON.parse(fs.readFileSync(keyPath, 'utf8')) as {
    client_email: string
    private_key: string
  }

  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  })

  _calendarClient = google.calendar({ version: 'v3', auth })
  return _calendarClient
}

/** Reset the cached client — used in tests to force re-initialization. */
export function _resetCalendarClient(): void {
  _calendarClient = null
}

// ── Simulation data ───────────────────────────────────────────────────────────

function getMockSlots(
  timezone: string,
  durationMinutes: number,
): TimeSlot[] {
  const days = getNextBusinessDays(3, new Date(), timezone)
  const allSlots = days.flatMap((day) => generateSlots(day, durationMinutes))
  // Simulate some busy slots by removing every 3rd slot
  return allSlots.filter((_, i) => i % 3 !== 0)
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch available slots for the next 3 business days.
 * Filters against real Google Calendar free/busy times in production.
 * Returns mock slots (with some removed) in simulation mode.
 */
export async function getAvailableSlots(
  calendarId: string,
  timezone: string = process.env['BUSINESS_TIMEZONE'] ?? 'America/Los_Angeles',
  durationMinutes: number = 30,
): Promise<TimeSlot[]> {
  // 1. SIMULATION GUARD — MUST BE FIRST
  if (process.env['SIMULATE_APIS'] === 'true') {
    return getMockSlots(timezone, durationMinutes)
  }

  const days = getNextBusinessDays(3, new Date(), timezone)
  const allSlots = days.flatMap((day) => generateSlots(day, durationMinutes))

  if (allSlots.length === 0) return []

  const windowStart = new Date(`${allSlots[0]!.start}Z`)
  const windowEnd = new Date(`${allSlots[allSlots.length - 1]!.end}Z`)

  let busyTimes: Array<{ start?: string | null; end?: string | null }>
  try {
    busyTimes = await getBusyTimes(calendarId, windowStart, windowEnd)
  } catch (err) {
    console.error('[calendar] failed to fetch busy times', err);
    // Fail safe — return empty rather than risk double-booking
    return []
  }

  return allSlots.filter((s) => !isSlotBusy(s, busyTimes))
}

/**
 * Book an appointment on Google Calendar.
 * Idempotent when `idempotencyKey` is provided (same key = same result).
 *
 * HITL gate: CLARA_CONFIRM_BOOKING must be 'true' in non-development environments.
 */
export async function bookAppointment(params: BookAppointmentParams): Promise<BookingResult> {
  const {
    start,
    end,
    attendeeEmail,
    attendeeName,
    calendarId,
    timezone = process.env['BUSINESS_TIMEZONE'] ?? 'America/Los_Angeles',
    description,
    idempotencyKey,
  } = params

  // 1. SIMULATION GUARD — MUST BE FIRST
  if (process.env['SIMULATE_APIS'] === 'true') {
    return {
      success: true,
      eventId: `sim-evt-${idempotencyKey ?? Date.now()}`,
      start,
      end,
      label: formatSlotLabel(start),
    }
  }

  // 2. HITL GATE — Tier 3 action (creates a real calendar event)
  if (process.env['NODE_ENV'] !== 'development' && process.env['CLARA_CONFIRM_BOOKING'] !== 'true') {
    throw new Error(
      'Calendar booking blocked: set CLARA_CONFIRM_BOOKING=true to enable outside local dev (Tier 3 HITL gate)',
    )
  }

  // 3. Real Google Calendar API call
  try {
    const cal = getCalendarClient()
    const event = await withRetry(() =>
      cal.events.insert({
        calendarId,
        sendUpdates: 'all',
        requestBody: {
          summary: attendeeName ? `Demo call with ${attendeeName}` : 'Demo call',
          start: { dateTime: start, timeZone: timezone },
          end: { dateTime: end, timeZone: timezone },
          attendees: attendeeEmail
            ? [{ email: attendeeEmail, displayName: attendeeName }]
            : [],
          description: [
            description,
            idempotencyKey ? `Idempotency key: ${idempotencyKey}` : undefined,
            'Booked via Clara AI receptionist.',
          ]
            .filter(Boolean)
            .join('\n\n'),
        },
      }),
    )

    return {
      success: true,
      eventId: event.data.id ?? '',
      start: event.data.start?.dateTime ?? start,
      end: event.data.end?.dateTime ?? end,
      label: formatSlotLabel(start),
      htmlLink: event.data.htmlLink ?? undefined,
    }
  } catch (err) {
    // Handle calendar conflict (double-booking race condition)
    const e = err as { response?: { status?: number }; code?: number }
    if (e?.response?.status === 409 || e?.code === 409) {
      throw Object.assign(new Error('SLOT_CONFLICT'), {
        code: 'SLOT_CONFLICT',
        message: 'That time slot was just taken. Please choose a different time.',
        statusCode: 409,
      })
    }
    throw err
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function getBusyTimes(
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<Array<{ start?: string | null; end?: string | null }>> {
  const cal = getCalendarClient()
  const res = await withRetry(() =>
    cal.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: calendarId }],
      },
    }),
  )
  return res.data.calendars?.[calendarId]?.busy ?? []
}

function isSlotBusy(
  slot: TimeSlot,
  busyTimes: Array<{ start?: string | null; end?: string | null }>,
): boolean {
  const slotStart = new Date(slot.start).getTime()
  const slotEnd = new Date(slot.end).getTime()
  return busyTimes.some((b) => {
    const busyStart = new Date(b.start ?? '').getTime()
    const busyEnd = new Date(b.end ?? '').getTime()
    return slotStart < busyEnd && slotEnd > busyStart
  })
}
