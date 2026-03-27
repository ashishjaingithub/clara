import { describe, it, expect } from 'vitest'
import { getNextBusinessDays, generateSlots, formatSlotLabel } from '../utils/slots.js'

describe('getNextBusinessDays', () => {
  it('returns N business days', () => {
    const days = getNextBusinessDays(3, new Date('2026-03-23T12:00:00Z'), 'America/Los_Angeles')
    expect(days).toHaveLength(3)
    // 2026-03-23 is Monday — next 3 business days are Tue, Wed, Thu
    expect(days[0]).toBe('2026-03-24')
    expect(days[1]).toBe('2026-03-25')
    expect(days[2]).toBe('2026-03-26')
  })

  it('skips weekends', () => {
    // Friday → next business day is Monday
    const days = getNextBusinessDays(1, new Date('2026-03-27T12:00:00Z'), 'America/Los_Angeles')
    expect(days[0]).toBe('2026-03-30')
  })

  it('skips Saturday start', () => {
    const days = getNextBusinessDays(1, new Date('2026-03-28T12:00:00Z'), 'America/Los_Angeles')
    expect(days[0]).toBe('2026-03-30')
  })

  it('skips Sunday start', () => {
    const days = getNextBusinessDays(1, new Date('2026-03-29T12:00:00Z'), 'America/Los_Angeles')
    expect(days[0]).toBe('2026-03-30')
  })

  it('skips holidays', () => {
    const days = getNextBusinessDays(
      1,
      new Date('2026-03-23T12:00:00Z'),
      'America/Los_Angeles',
      ['2026-03-24'],
    )
    expect(days[0]).toBe('2026-03-25')
  })

  it('defaults from=now without throwing', () => {
    const days = getNextBusinessDays(2)
    expect(days).toHaveLength(2)
    expect(days[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('defaults timezone to America/Los_Angeles', () => {
    const days = getNextBusinessDays(1, new Date('2026-03-23T12:00:00Z'))
    expect(days).toHaveLength(1)
  })
})

describe('generateSlots', () => {
  it('generates 30-min slots from 9am to 5pm', () => {
    const slots = generateSlots('2026-03-24')
    expect(slots).toHaveLength(16) // 8 hours × 2 slots/hr
    expect(slots[0]).toEqual({
      start: '2026-03-24T09:00:00',
      end: '2026-03-24T09:30:00',
      label: expect.any(String),
    })
    expect(slots[slots.length - 1]!.end).toBe('2026-03-24T17:00:00')
  })

  it('respects custom duration', () => {
    const slots = generateSlots('2026-03-24', 60, 9, 12)
    expect(slots).toHaveLength(3) // 9-10, 10-11, 11-12
    expect(slots[0]!.end).toBe('2026-03-24T10:00:00')
  })

  it('respects custom start/end hours', () => {
    const slots = generateSlots('2026-03-24', 30, 10, 11)
    expect(slots).toHaveLength(2) // 10:00 and 10:30
  })

  it('handles hour boundary correctly at 11:30', () => {
    const slots = generateSlots('2026-03-24', 30, 11, 12)
    expect(slots).toHaveLength(2)
    expect(slots[1]!.end).toBe('2026-03-24T12:00:00')
  })

  it('returns empty when startHour >= endHour', () => {
    const slots = generateSlots('2026-03-24', 30, 17, 17)
    expect(slots).toHaveLength(0)
  })
})

describe('formatSlotLabel', () => {
  it('formats a slot label correctly', () => {
    const label = formatSlotLabel('2026-03-25T09:00:00')
    expect(label).toContain('9 AM')
    expect(label).toContain('Mar')
    expect(label).toContain('25')
  })

  it('formats PM slots correctly', () => {
    const label = formatSlotLabel('2026-03-25T14:30:00')
    expect(label).toContain('2:30 PM')
  })

  it('formats noon correctly', () => {
    const label = formatSlotLabel('2026-03-25T12:00:00')
    expect(label).toContain('12 PM')
  })

  it('formats midnight as 12 AM', () => {
    const label = formatSlotLabel('2026-03-25T00:00:00')
    expect(label).toContain('12 AM')
  })

  it('returns the input as-is if malformed', () => {
    const label = formatSlotLabel('not-a-date')
    expect(label).toBe('not-a-date')
  })
})
