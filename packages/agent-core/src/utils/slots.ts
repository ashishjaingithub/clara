import type { TimeSlot } from '../types'

/**
 * Return the next N business days (Mon–Fri) starting from `from`.
 * Returns date strings in YYYY-MM-DD format.
 */
export function getNextBusinessDays(
  count: number,
  from: Date = new Date(),
  timezone: string = 'America/Los_Angeles',
  holidays: string[] = [],
): string[] {
  const holidaySet = new Set(holidays)
  const days: string[] = []
  const current = new Date(from)

  while (days.length < count) {
    current.setDate(current.getDate() + 1)
    const dayOfWeek = getDayOfWeekInTz(current, timezone)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const dateStr = current.toLocaleDateString('en-CA', { timeZone: timezone })
      if (!holidaySet.has(dateStr)) {
        days.push(dateStr)
      }
    }
  }

  return days
}

/**
 * Get day of week (0=Sun, 6=Sat) correctly in the given IANA timezone.
 * Uses Intl.DateTimeFormat to avoid locale-dependent weekday calculation.
 */
function getDayOfWeekInTz(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  }).formatToParts(date)
  const weekday = parts.find((p) => p.type === 'weekday')?.value
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  }
  /* v8 ignore next -- Intl.DateTimeFormat always returns a known weekday */
  return map[weekday ?? 'Sun'] ?? 0
}

/**
 * Generate time slots of `durationMinutes` between startHour and endHour for a YYYY-MM-DD date string.
 * Slots are naive datetimes (no timezone suffix) — they represent times in the business timezone.
 */
export function generateSlots(
  dateStr: string,
  durationMinutes: number = 30,
  startHour: number = 9,
  endHour: number = 17,
): TimeSlot[] {
  const slots: TimeSlot[] = []

  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m + durationMinutes <= 60; m += durationMinutes) {
      const startStr = `${dateStr}T${pad(h)}:${pad(m)}:00`
      const endTotalMin = h * 60 + m + durationMinutes
      const endH = Math.floor(endTotalMin / 60)
      const endM = endTotalMin % 60
      /* v8 ignore next -- loop condition m+duration<=60 ensures end never exceeds endHour */
      if (endH > endHour || (endH === endHour && endM > 0)) break
      const endStr = `${dateStr}T${pad(endH)}:${pad(endM)}:00`
      slots.push({ start: startStr, end: endStr, label: formatSlotLabel(startStr) })
    }
  }

  return slots
}

/**
 * Format a naive datetime string as "Mon Mar 25 at 2:00 PM".
 * Parses date components directly — does NOT use new Date() to avoid timezone shifts.
 */
export function formatSlotLabel(isoString: string): string {
  const [datePart, timePart] = isoString.split('T')
  if (!datePart || !timePart) return isoString

  const [, , day] = datePart.split('-').map(Number) as [number, number, number]
  const [hour, minute] = timePart.split(':').map(Number) as [number, number]

  // Use noon UTC on that date — safe from DST shifting the calendar day
  const noonUtc = new Date(`${datePart}T12:00:00Z`)
  const dayName = noonUtc.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short' })
  const monthName = noonUtc.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short' })

  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  const timeStr = minute === 0
    ? `${h12} ${ampm}`
    : `${h12}:${pad(minute)} ${ampm}`

  return `${dayName} ${monthName} ${day} at ${timeStr}`
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
