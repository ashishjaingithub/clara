import { describe, it, expect } from 'vitest'
import { createRateLimiter, getClientIP } from '../../../lib/rate-limit'

describe('createRateLimiter', () => {
  it('allows requests within the limit', () => {
    const limiter = createRateLimiter(3, 60_000)
    expect(limiter.check('key1').allowed).toBe(true)
    expect(limiter.check('key1').allowed).toBe(true)
    expect(limiter.check('key1').allowed).toBe(true)
  })

  it('rejects the request that exceeds the limit', () => {
    const limiter = createRateLimiter(2, 60_000)
    limiter.check('key1')
    limiter.check('key1')
    const result = limiter.check('key1')
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('returns correct remaining count', () => {
    const limiter = createRateLimiter(5, 60_000)
    const r1 = limiter.check('key1')
    expect(r1.remaining).toBe(4)
    const r2 = limiter.check('key1')
    expect(r2.remaining).toBe(3)
  })

  it('tracks keys independently', () => {
    const limiter = createRateLimiter(1, 60_000)
    limiter.check('key1')
    const r1 = limiter.check('key1') // exceeds limit for key1
    const r2 = limiter.check('key2') // key2 is fresh
    expect(r1.allowed).toBe(false)
    expect(r2.allowed).toBe(true)
  })

  it('allows requests after the window expires using injected clock', () => {
    let fakeNow = 1000
    const limiter = createRateLimiter(2, 60_000, () => fakeNow)

    limiter.check('key1')
    limiter.check('key1')
    const blocked = limiter.check('key1')
    expect(blocked.allowed).toBe(false)

    // Advance time beyond the window
    fakeNow = 1000 + 61_000

    const afterWindow = limiter.check('key1')
    expect(afterWindow.allowed).toBe(true)
  })

  it('provides resetAt timestamp', () => {
    let fakeNow = 1000
    const limiter = createRateLimiter(3, 60_000, () => fakeNow)
    const result = limiter.check('key1')
    // resetAt should be approximately fakeNow + windowMs
    expect(result.resetAt).toBe(1000 + 60_000)
  })

  it('evictExpired removes stale entries', () => {
    let fakeNow = 1000
    const limiter = createRateLimiter(2, 60_000, () => fakeNow)
    limiter.check('key1')
    limiter.check('key1')

    fakeNow = 1000 + 65_000 // advance past window
    limiter.evictExpired()

    // After eviction, key1 should start fresh
    const result = limiter.check('key1')
    expect(result.allowed).toBe(true)
  })

  it('evictExpired retains entries that are still within the window', () => {
    let fakeNow = 1000
    const limiter = createRateLimiter(5, 60_000, () => fakeNow)

    // Make two requests at t=1000 and one at t=30000
    limiter.check('key1') // t=1000
    limiter.check('key1') // t=1000
    fakeNow = 30_000
    limiter.check('key1') // t=30000 — within window when evict runs

    // Advance time so the t=1000 entries fall outside the window but t=30000 does not
    fakeNow = 62_000 // 1000+60000=61000 < 62000, so t=1000 is stale; 30000+60000=90000 > 62000, so t=30000 is active
    limiter.evictExpired() // should hit the else branch: active=[30000], store.set(key1, [30000])

    // key1 still has 1 active entry — remaining should reflect that
    const result = limiter.check('key1')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(3) // limit=5, active was [30000], now [30000, 62000] → 5-2=3
  })
})

describe('getClientIP', () => {
  function makeHeaders(headers: Record<string, string | null>) {
    return {
      headers: {
        get: (k: string) => headers[k.toLowerCase()] ?? null,
      },
    }
  }

  it('extracts IP from x-forwarded-for', () => {
    const req = makeHeaders({ 'x-forwarded-for': '203.0.113.1' })
    expect(getClientIP(req)).toBe('203.0.113.1')
  })

  it('takes leftmost public IP from x-forwarded-for chain', () => {
    const req = makeHeaders({ 'x-forwarded-for': '203.0.113.1, 10.0.0.1, 172.16.0.1' })
    expect(getClientIP(req)).toBe('203.0.113.1')
  })

  it('skips private IPs in x-forwarded-for to find public IP', () => {
    const req = makeHeaders({ 'x-forwarded-for': '10.0.0.1, 192.168.1.1, 203.0.113.5' })
    expect(getClientIP(req)).toBe('203.0.113.5')
  })

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const req = makeHeaders({ 'x-real-ip': '203.0.113.99' })
    expect(getClientIP(req)).toBe('203.0.113.99')
  })

  it('falls back to 127.0.0.1 when no IP headers present (local dev)', () => {
    const req = makeHeaders({})
    expect(getClientIP(req)).toBe('127.0.0.1')
  })

  it('falls back to 127.0.0.1 when all IPs in x-forwarded-for are private', () => {
    const req = makeHeaders({ 'x-forwarded-for': '10.0.0.1, 192.168.1.1' })
    expect(getClientIP(req)).toBe('127.0.0.1')
  })
})
