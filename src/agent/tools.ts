/**
 * Clara tool wrappers — LangChain DynamicStructuredTool definitions for:
 *   - get_available_slots  : fetches open calendar slots
 *   - book_appointment     : books a Google Calendar event (Tier 3 HITL-gated)
 *   - upsert_contact       : creates/updates a HubSpot contact (Tier 3 HITL-gated)
 *   - get_enrichment_details : returns the enrichment profile already in session context
 *
 * All tools handle errors gracefully and return descriptive error strings so the LLM
 * can communicate what went wrong without throwing.
 *
 * Simulation mode: set SIMULATE_APIS=true to use mock data (tests + local dev).
 */

import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { getAvailableSlots, bookAppointment, upsertContact, withRetry } from '@agenticlearning/agent-core'
import type { EnrichmentProfile } from '@agenticlearning/agent-core'

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates the 4 Clara tools, pre-bound to the session's enrichment profile.
 * Accepts null when no enrichment data is available; falls back to env vars.
 */
export function createClaraTools(enrichmentProfile: EnrichmentProfile | null): DynamicStructuredTool[] {
  const calendarId = enrichmentProfile?.calendarId ?? process.env['GOOGLE_CALENDAR_ID'] ?? ''
  const timezone =
    enrichmentProfile?.timezone ?? process.env['BUSINESS_TIMEZONE'] ?? 'America/Los_Angeles'
  const durationMinutes = enrichmentProfile?.bookingDurationMinutes ?? 30

  // ── Tool 1: get_available_slots ──────────────────────────────────────────────

  const getAvailableSlotsTool = new DynamicStructuredTool({
    name: 'get_available_slots',
    description:
      'Returns a list of available appointment slots for the next 3 business days. ' +
      'Use this when the visitor asks about availability or wants to book an appointment. ' +
      'No input needed — session context provides calendar and timezone.',
    schema: z.object({}),
    func: async (): Promise<string> => {
      try {
        // Retry with jitter — calendar API may transiently fail (429 / 5xx)
        const slots = await withRetry(
          () => getAvailableSlots(calendarId, timezone, durationMinutes),
          { maxAttempts: 3, baseDelayMs: 500 },
        )
        if (slots.length === 0) {
          return 'No available slots found for the next 3 business days. Please ask the visitor to call during business hours.'
        }
        const formatted = slots
          .map((s, i) => `${i + 1}. ${s.label} (start: ${s.start}, end: ${s.end})`)
          .join('\n')
        return `Available appointment slots:\n${formatted}`
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return `Failed to retrieve available slots: ${msg}. Please ask the visitor to call to schedule.`
      }
    },
  })

  // ── Tool 2: book_appointment ─────────────────────────────────────────────────

  const bookAppointmentTool = new DynamicStructuredTool({
    name: 'book_appointment',
    description:
      'Books an appointment on the business calendar. ' +
      'Use this ONLY after the visitor has confirmed a specific time slot from get_available_slots. ' +
      'Requires start time, end time, attendee email, and attendee name.',
    schema: z.object({
      start: z.string().describe('ISO 8601 datetime for appointment start (e.g. 2026-03-25T14:00:00)'),
      end: z.string().describe('ISO 8601 datetime for appointment end (e.g. 2026-03-25T14:30:00)'),
      attendeeEmail: z.string().email().describe('Email address of the visitor booking the appointment'),
      attendeeName: z.string().describe('Full name of the visitor booking the appointment'),
      description: z.string().optional().describe('Optional note about the appointment purpose'),
    }),
    func: async (input): Promise<string> => {
      try {
        // Retry with jitter — do not retry SLOT_CONFLICT (it is not transient)
        const result = await withRetry(
          () => bookAppointment({
            start: input.start,
            end: input.end,
            attendeeEmail: input.attendeeEmail,
            attendeeName: input.attendeeName,
            calendarId,
            timezone,
            description: input.description,
          }),
          {
            maxAttempts: 3,
            baseDelayMs: 500,
            retryOn: (err) => {
              const msg = err instanceof Error ? err.message : String(err)
              // SLOT_CONFLICT is deterministic — retrying will not resolve it
              if (msg.includes('SLOT_CONFLICT')) return false
              const e = err as { response?: { status?: number } } | undefined
              const status = e?.response?.status
              return status === 429 || (status !== undefined && status >= 500)
            },
          },
        )
        if (result.success) {
          return (
            `Appointment booked successfully!\n` +
            `Time: ${result.label}\n` +
            `Confirmation ID: ${result.eventId}` +
            (result.htmlLink ? `\nCalendar link: ${result.htmlLink}` : '')
          )
        }
        return 'Appointment booking failed. Please ask the visitor to call to schedule.'
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('SLOT_CONFLICT')) {
          return 'That time slot was just taken. Please show the visitor updated availability by calling get_available_slots again.'
        }
        return `Failed to book appointment: ${msg}. Please ask the visitor to call to schedule.`
      }
    },
  })

  // ── Tool 3: upsert_contact ───────────────────────────────────────────────────

  const upsertContactTool = new DynamicStructuredTool({
    name: 'upsert_contact',
    description:
      'Creates or updates a visitor contact in HubSpot CRM. ' +
      'Use this when the visitor has provided their contact details and wants to be followed up with. ' +
      'Only email is required; other fields are optional.',
    schema: z.object({
      email: z.string().email().describe('Visitor email address (required)'),
      firstName: z.string().optional().describe("Visitor's first name"),
      lastName: z.string().optional().describe("Visitor's last name"),
      phone: z.string().optional().describe("Visitor's phone number"),
      notes: z.string().optional().describe('Notes about the visitor or their inquiry'),
    }),
    func: async (input): Promise<string> => {
      try {
        // Retry with jitter — HubSpot may transiently rate-limit (429) or be unavailable (5xx)
        const result = await withRetry(
          () => upsertContact({
            email: input.email,
            firstName: input.firstName,
            lastName: input.lastName,
            phone: input.phone,
            notes: input.notes,
          }),
          { maxAttempts: 3, baseDelayMs: 500 },
        )
        if (result.created) {
          return `Contact created successfully. ID: ${result.contactId}. The team will follow up with ${input.email}.`
        }
        return `Contact updated successfully. ID: ${result.contactId}. Notes added for ${input.email}.`
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return `Failed to save contact information: ${msg}. Please ask the visitor to contact the business directly.`
      }
    },
  })

  // ── Tool 4: get_enrichment_details ───────────────────────────────────────────

  const getEnrichmentDetailsTool = new DynamicStructuredTool({
    name: 'get_enrichment_details',
    description:
      'Returns the full business enrichment profile already loaded for this session. ' +
      'Use this if you need to reference specific business details like services, pain points, or pitch angles. ' +
      'No input needed — data is already in session context.',
    schema: z.object({}),
    func: async (): Promise<string> => {
      if (!enrichmentProfile) {
        return 'No enrichment profile available for this session. Only basic business information is loaded.'
      }

      const lines: string[] = [`Business: ${enrichmentProfile.companyName}`]
      if (enrichmentProfile.industry) lines.push(`Industry: ${enrichmentProfile.industry}`)
      if (enrichmentProfile.phone) lines.push(`Phone: ${enrichmentProfile.phone}`)
      if (enrichmentProfile.website) lines.push(`Website: ${enrichmentProfile.website}`)
      if (enrichmentProfile.address) lines.push(`Address: ${enrichmentProfile.address}`)
      if (enrichmentProfile.hours) lines.push(`Hours: ${enrichmentProfile.hours}`)
      if (enrichmentProfile.timezone) lines.push(`Timezone: ${enrichmentProfile.timezone}`)
      if (enrichmentProfile.bookingDurationMinutes) {
        lines.push(`Appointment duration: ${enrichmentProfile.bookingDurationMinutes} minutes`)
      }
      if (enrichmentProfile.services?.length) {
        lines.push(`Services: ${enrichmentProfile.services.join(', ')}`)
      }
      if (enrichmentProfile.pitchAngle) {
        lines.push(`Key strength: ${enrichmentProfile.pitchAngle}`)
      }
      if (enrichmentProfile.techMaturity) {
        lines.push(`Tech maturity: ${enrichmentProfile.techMaturity}`)
      }
      if (enrichmentProfile.priority) {
        lines.push(`Priority: ${enrichmentProfile.priority}`)
      }
      if (enrichmentProfile.painPoints?.length) {
        lines.push('Pain points addressed:')
        for (const pp of enrichmentProfile.painPoints) {
          lines.push(`  - ${pp.problem}: ${pp.aiSolution}`)
        }
      }

      return lines.join('\n')
    },
  })

  return [getAvailableSlotsTool, bookAppointmentTool, upsertContactTool, getEnrichmentDetailsTool]
}
