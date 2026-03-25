import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

// ── agent-core Mock — prevent real API calls ──────────────────────────────
vi.mock('@agenticlearning/agent-core', () => ({
  getAvailableSlots: vi.fn(),
  bookAppointment: vi.fn(),
  upsertContact: vi.fn(),
}))

// ── LLM Mock ──────────────────────────────────────────────────────────────
// bindTools returns an object with invoke so the tool-calling agent loop works
const mockInvoke = vi.fn()
vi.mock('@langchain/groq', () => ({
  ChatGroq: class {
    invoke = mockInvoke
    bindTools = () => ({ invoke: mockInvoke })
  },
}))

beforeAll(() => {
  process.env.SIMULATE_APIS = 'true'
})

// ── LangSmith Mock ────────────────────────────────────────────────────────
vi.mock('langsmith/traceable', () => ({
  traceable: (fn: unknown) => fn,
  getCurrentRunTree: vi.fn(() => null),
}))

// ── Fetch Mock ────────────────────────────────────────────────────────────
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { runReceptionist, fetchBusinessProfile } from '../../../agent/receptionist'
import type { BusinessProfile } from '../../../agent/receptionist'

describe('fetchBusinessProfile — uncovered branches', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    process.env.HUNTER_API_URL = 'http://localhost:3001'
    process.env.HUNTER_API_KEY = ''
  })

  it('uses default HUNTER_API_URL when env var is not set (line 52 ?? fallback)', async () => {
    delete process.env.HUNTER_API_URL
    delete process.env.HUNTER_API_KEY

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ companyName: 'Default URL Biz' }),
    })

    const profile = await fetchBusinessProfile('company-default-url')
    expect(profile.companyName).toBe('Default URL Biz')

    // Verify the default URL was used in the fetch call
    const [url] = mockFetch.mock.calls[0] as [string]
    expect(url).toContain('localhost:3001')

    // Restore
    process.env.HUNTER_API_URL = 'http://localhost:3001'
  })

  it('returns techMaturity when present in Hunter API response (line 120)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        companyName: 'Tech Savvy Roofing',
        techMaturity: 'advanced',
        pitchAngle: 'Uses AI for scheduling',
      }),
    })

    const profile = await fetchBusinessProfile('company-tech')
    expect(profile.techMaturity).toBe('advanced')
    expect(profile.pitchAngle).toBe('Uses AI for scheduling')
  })

  it('returns undefined techMaturity when field is not a string', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        companyName: 'No Tech Biz',
        techMaturity: 42, // not a string — should be undefined
      }),
    })

    const profile = await fetchBusinessProfile('company-no-tech')
    expect(profile.techMaturity).toBeUndefined()
  })

  it('falls back gracefully when fetch throws a non-Error value (line 123 String() branch)', async () => {
    // String(err) path — throw a non-Error
    mockFetch.mockRejectedValueOnce('string error value')

    const profile = await fetchBusinessProfile('company-string-err')
    expect(profile.companyId).toBe('company-string-err')
    expect(profile.companyName).toBe('This Business')
  })

  it('returns undefined services when neither serviceCategories nor services is an array', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        companyName: 'No Services Biz',
        services: 'not-an-array',
        serviceCategories: 'also-not-an-array',
      }),
    })

    const profile = await fetchBusinessProfile('company-no-services')
    expect(profile.services).toBeUndefined()
  })

  it('falls back to services array when serviceCategories is absent (line 84 branch)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        companyName: 'Services Biz',
        services: ['Painting', 'Drywall'],
        // no serviceCategories field
      }),
    })

    const profile = await fetchBusinessProfile('company-services-fallback')
    expect(profile.services).toEqual(['Painting', 'Drywall'])
  })

  it('filters non-string entries from businessHours array', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        companyName: 'Mixed Hours Biz',
        businessHours: ['Mon-Fri 9am-5pm', 42, null, 'Sat 10am-2pm'],
      }),
    })

    const profile = await fetchBusinessProfile('company-mixed-hours')
    // Non-string entries filtered out
    expect(profile.hours).toBe('Mon-Fri 9am-5pm, Sat 10am-2pm')
  })

  it('returns undefined painPoints when array is empty after filtering invalids', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        companyName: 'Bad Pain Points Biz',
        painPoints: [
          null,
          42,
          { problem: 'Missing aiSolution' }, // no aiSolution
          { aiSolution: 'Missing problem' },  // no problem
        ],
      }),
    })

    const profile = await fetchBusinessProfile('company-bad-pain-points')
    // All pain points are invalid, painPoints.length === 0 → undefined
    expect(profile.painPoints).toBeUndefined()
  })

  it('returns undefined website and address when fields are non-string (lines 115-116 false branches)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        companyName: 'No Website Biz',
        website: 42,   // not a string — should be undefined
        address: null, // not a string — should be undefined
      }),
    })

    const profile = await fetchBusinessProfile('company-no-web-addr')
    expect(profile.website).toBeUndefined()
    expect(profile.address).toBeUndefined()
  })

  it('returns website and address when present as strings (lines 115-116 true branches)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        companyName: 'Full Profile Biz',
        website: 'https://fullprofile.com',
        address: '123 Main Street, Springfield',
        phone: '555-0123',
        industry: 'Plumbing',
      }),
    })

    const profile = await fetchBusinessProfile('company-full-profile')
    expect(profile.website).toBe('https://fullprofile.com')
    expect(profile.address).toBe('123 Main Street, Springfield')
    expect(profile.phone).toBe('555-0123')
  })

  it('uses "This Business" fallback when neither businessName nor companyName is a string', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        // both absent or non-string
        businessName: 42,
        companyName: null,
      }),
    })

    const profile = await fetchBusinessProfile('company-no-name')
    expect(profile.companyName).toBe('This Business')
  })
})

describe('runReceptionist — content fallback branch (line 256)', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockInvoke.mockReset()
  })

  it('returns fallback message when LLM returns non-string non-array content', async () => {
    const cachedProfile: BusinessProfile = {
      companyId: 'biz-fallback',
      companyName: 'Fallback Biz',
    }
    // content is neither string nor array — triggers fallback message (line 256)
    mockInvoke.mockResolvedValueOnce({ content: { unexpected: true } })

    const result = await runReceptionist({
      hubspotCompanyId: 'biz-fallback',
      message: 'Hello',
      history: [],
      businessProfile: cachedProfile,
    })

    expect(result.reply).toBe('I apologize, I had trouble generating a response. Please try again.')
  })
})
