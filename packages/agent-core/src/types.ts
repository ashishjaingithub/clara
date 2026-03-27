// ── Calendar ─────────────────────────────────────────────────────────────────

export interface TimeSlot {
  /** ISO 8601 datetime, no timezone suffix (naive — represents time in the configured timezone) */
  start: string
  /** ISO 8601 datetime, no timezone suffix */
  end: string
  /** Human-readable label, e.g. "Mon Mar 25 at 2:00 PM" */
  label: string
}

export interface BookingResult {
  success: boolean
  eventId: string
  start: string
  end: string
  label: string
  htmlLink?: string
}

export interface BookAppointmentParams {
  /** ISO 8601 datetime */
  start: string
  /** ISO 8601 datetime */
  end: string
  attendeeEmail: string
  attendeeName: string
  /** Google Calendar ID to book on */
  calendarId: string
  /** IANA timezone, e.g. "America/Los_Angeles" */
  timezone: string
  description?: string
  /** Idempotency key — callers should pass a stable ID to prevent double-booking */
  idempotencyKey?: string
}

// ── HubSpot ──────────────────────────────────────────────────────────────────

export interface ContactData {
  email: string
  firstName?: string
  lastName?: string
  phone?: string
  company?: string
  /** Free-text note to attach to the contact after upsert */
  notes?: string
}

export interface ContactResult {
  contactId: string
  /** true = new contact created; false = existing contact found/updated */
  created: boolean
}

// ── Enrichment ───────────────────────────────────────────────────────────────

export interface PainPoint {
  problem: string
  reviewQuote: string
  aiSolution: string
}

export interface EnrichmentProfile {
  companyId: string
  companyName: string
  industry?: string
  services?: string[]
  phone?: string
  website?: string
  address?: string
  hours?: string
  /** Google Calendar ID to use for bookings. Falls back to GOOGLE_CALENDAR_ID env var. */
  calendarId?: string
  /** IANA timezone. Falls back to BUSINESS_TIMEZONE env var. */
  timezone?: string
  bookingDurationMinutes?: number
  painPoints?: PainPoint[]
  pitchAngle?: string
  techMaturity?: string
  priority?: string
}

// ── Notify-Lead event ────────────────────────────────────────────────────────

export type LeadEvent =
  | 'chat_started'
  | 'appointment_booked'
  | 'contact_captured'
  | 'demo_completed'

export interface NotifyLeadPayload {
  event: LeadEvent
  metadata?: Record<string, unknown>
}
