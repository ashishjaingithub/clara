import { describe, it, expect } from 'vitest'
import { suggestReplies } from '@/lib/suggest-replies'

/**
 * Unit tests for suggestReplies — pure function, zero dependencies.
 * Covers all 6 regex signal branches, messageCount edge cases, and chaos inputs.
 */

describe('suggestReplies', () => {
  // ── messageCount gate ──────────────────────────────────────────────────────

  it('returns [] when messageCount > 8 regardless of message content', () => {
    const appointmentMsg = 'Would you like to schedule an appointment?'
    expect(suggestReplies(appointmentMsg, 9)).toEqual([])
    expect(suggestReplies(appointmentMsg, 100)).toEqual([])
    expect(suggestReplies(appointmentMsg, Number.MAX_SAFE_INTEGER)).toEqual([])
  })

  it('shows chips at exactly messageCount = 8 (boundary — still allowed)', () => {
    const result = suggestReplies('Would you like to book an appointment?', 8)
    expect(result.length).toBeGreaterThan(0)
  })

  // ── appointment/booking branch ─────────────────────────────────────────────

  it('returns appointment chips when message contains "appointment"', () => {
    const result = suggestReplies('Would you like to schedule an appointment?', 3)
    expect(result).toEqual(['What times are available?', 'How do I book?', 'What should I bring?'])
  })

  it('returns appointment chips when message contains "book"', () => {
    expect(suggestReplies('You can book online at any time.', 3))
      .toEqual(['What times are available?', 'How do I book?', 'What should I bring?'])
  })

  it('returns appointment chips when message contains "schedul"', () => {
    expect(suggestReplies('Our scheduling system is open 24/7.', 3))
      .toEqual(['What times are available?', 'How do I book?', 'What should I bring?'])
  })

  it('returns appointment chips when message contains "availab"', () => {
    expect(suggestReplies('We have availability on Tuesday and Thursday.', 3))
      .toEqual(['What times are available?', 'How do I book?', 'What should I bring?'])
  })

  it('appointment match is case-insensitive (uppercase trigger)', () => {
    expect(suggestReplies('APPOINTMENT TIMES ARE MONDAY 9AM.', 1))
      .toEqual(['What times are available?', 'How do I book?', 'What should I bring?'])
  })

  // ── hours branch ───────────────────────────────────────────────────────────

  it('returns hours chips when message contains "hours"', () => {
    expect(suggestReplies('Our hours are 9am to 5pm Monday through Friday.', 3))
      .toEqual(['Are you open on weekends?', 'What about holidays?', 'Can I book online?'])
  })

  it('returns hours chips when message contains "open"', () => {
    expect(suggestReplies('We are open every day.', 3))
      .toEqual(['Are you open on weekends?', 'What about holidays?', 'Can I book online?'])
  })

  it('returns hours chips when message contains "monday"', () => {
    expect(suggestReplies('We are open Monday to Friday.', 3))
      .toEqual(['Are you open on weekends?', 'What about holidays?', 'Can I book online?'])
  })

  it('returns hours chips when message contains "weekend"', () => {
    // "Weekend" alone — no "appointment", "book", "schedul", "availab" in this string
    expect(suggestReplies('We are closed on weekends.', 3))
      .toEqual(['Are you open on weekends?', 'What about holidays?', 'Can I book online?'])
  })

  it('returns hours chips when message contains "saturday" or "sunday"', () => {
    expect(suggestReplies('We are closed on Saturday and Sunday.', 3))
      .toEqual(['Are you open on weekends?', 'What about holidays?', 'Can I book online?'])
  })

  // ── pricing branch ─────────────────────────────────────────────────────────

  it('returns pricing chips when message contains "price"', () => {
    expect(suggestReplies('Our prices start at $50 per visit.', 3))
      .toEqual(["Do you take insurance?", 'Is there a payment plan?', 'Can I get a quote?'])
  })

  it('returns pricing chips when message contains "cost"', () => {
    expect(suggestReplies('The cost of the service is affordable.', 3))
      .toEqual(["Do you take insurance?", 'Is there a payment plan?', 'Can I get a quote?'])
  })

  it('returns pricing chips when message contains "$"', () => {
    expect(suggestReplies('Plans start at $99/month.', 3))
      .toEqual(["Do you take insurance?", 'Is there a payment plan?', 'Can I get a quote?'])
  })

  it('returns pricing chips when message contains "free" or "consult"', () => {
    expect(suggestReplies('We offer a free consultation for new patients.', 3))
      .toEqual(["Do you take insurance?", 'Is there a payment plan?', 'Can I get a quote?'])
  })

  // ── location branch ────────────────────────────────────────────────────────

  it('returns location chips when message contains "locat"', () => {
    expect(suggestReplies('Our location is at 123 Main Street.', 3))
      .toEqual(['Is there parking?', 'How far are you?', "What's the best way to get there?"])
  })

  it('returns location chips when message contains "parking"', () => {
    // "parking" alone — avoid "free" (pricing) and "available" (appointment)
    expect(suggestReplies('Parking is included with your visit.', 3))
      .toEqual(['Is there parking?', 'How far are you?', "What's the best way to get there?"])
  })

  it('returns location chips when message contains "address" or "direction"', () => {
    expect(suggestReplies('You can find our address and directions on our website.', 3))
      .toEqual(['Is there parking?', 'How far are you?', "What's the best way to get there?"])
  })

  it('returns location chips when message contains "near" or "map"', () => {
    expect(suggestReplies('Find us on the map near downtown.', 3))
      .toEqual(['Is there parking?', 'How far are you?', "What's the best way to get there?"])
  })

  // ── contact/callback branch ────────────────────────────────────────────────

  it('returns contact chips when message contains "call"', () => {
    // avoid "free" (pricing) — use a message that only triggers the contact branch
    expect(suggestReplies('Please call us during business time.', 3))
      .toEqual(["I'd like a callback", "What's your email?", 'Can I leave my number?'])
  })

  it('returns contact chips when message contains "email"', () => {
    expect(suggestReplies('You can reach us by email at info@example.com.', 3))
      .toEqual(["I'd like a callback", "What's your email?", 'Can I leave my number?'])
  })

  it('returns contact chips when message contains "contact" or "team"', () => {
    expect(suggestReplies('Our team is happy to contact you.', 3))
      .toEqual(["I'd like a callback", "What's your email?", 'Can I leave my number?'])
  })

  it('returns contact chips when message contains "phone" or "reach"', () => {
    // avoid "hours"/"monday" — use a message that only triggers the contact branch
    expect(suggestReplies('You can reach us by phone or text.', 3))
      .toEqual(["I'd like a callback", "What's your email?", 'Can I leave my number?'])
  })

  // ── early-conversation general branch ─────────────────────────────────────

  it('returns general chips when messageCount <= 2 and no specific signal', () => {
    const generic = ['What are your hours?', 'Where are you located?', 'How do I get started?']
    expect(suggestReplies('Hello! How can I help you today?', 0)).toEqual(generic)
    expect(suggestReplies('Hello! How can I help you today?', 1)).toEqual(generic)
    expect(suggestReplies('Hello! How can I help you today?', 2)).toEqual(generic)
  })

  it('returns [] when messageCount is 3+ and no specific signal', () => {
    expect(suggestReplies('Thank you, let us know if you need anything else.', 3)).toEqual([])
    expect(suggestReplies('Thank you, let us know if you need anything else.', 8)).toEqual([])
  })

  // ── priority: first match wins ─────────────────────────────────────────────

  it('appointment branch wins over hours when both signals present', () => {
    // "book" triggers appointment before "hours" is checked
    const result = suggestReplies('You can book during our open hours.', 3)
    expect(result).toEqual(['What times are available?', 'How do I book?', 'What should I bring?'])
  })

  it('hours branch wins over pricing when both signals present', () => {
    // "open" triggers hours before "price"
    const result = suggestReplies('We are open and our prices are competitive.', 3)
    expect(result).toEqual(['Are you open on weekends?', 'What about holidays?', 'Can I book online?'])
  })

  // ── chaos / boundary ──────────────────────────────────────────────────────

  it('handles empty string message gracefully', () => {
    expect(suggestReplies('', 0)).toEqual(['What are your hours?', 'Where are you located?', 'How do I get started?'])
    expect(suggestReplies('', 3)).toEqual([])
  })

  it('handles a 10,000-character message without throwing', () => {
    const bigMsg = 'a'.repeat(10_000)
    expect(() => suggestReplies(bigMsg, 5)).not.toThrow()
    expect(suggestReplies(bigMsg, 5)).toEqual([])
  })

  it('handles a message with all regex special characters without throwing', () => {
    const specialChars = '.*+?^${}()|[]\\<>!@#%&_='
    expect(() => suggestReplies(specialChars, 1)).not.toThrow()
  })

  it('handles negative messageCount without throwing (treated as <= 2)', () => {
    // Negative numbers are <= 2, so general branch fires
    expect(() => suggestReplies('Hello!', -1)).not.toThrow()
    expect(suggestReplies('Hello!', -1)).toEqual(['What are your hours?', 'Where are you located?', 'How do I get started?'])
  })

  it('handles NaN messageCount without throwing', () => {
    // NaN > 8 is false, NaN <= 2 is false — falls through to []
    expect(() => suggestReplies('Hello!', NaN)).not.toThrow()
  })
})
