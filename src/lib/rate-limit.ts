/**
 * In-memory sliding window rate limiter.
 *
 * ADR-005: In-memory is correct for v1 single-process deployment.
 * State is lost on process restart — acceptable since rate limit windows are short (60s).
 *
 * The `getNow` parameter enables deterministic testing without mocking Date.now globally.
 */

export interface RateLimiterOptions {
  limit: number
  windowMs: number
  getNow?: () => number  // defaults to Date.now; inject for tests
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number  // Unix epoch ms when the oldest entry in the window expires
}

export function createRateLimiter(maxRequests: number, windowMs: number, getNow?: () => number) {
  const store = new Map<string, number[]>()
  const now = getNow ?? Date.now

  return {
    check(key: string): RateLimitResult {
      const currentTime = now()
      const windowStart = currentTime - windowMs
      const existing = store.get(key) ?? []
      const active = existing.filter(t => t > windowStart)
      active.push(currentTime)
      store.set(key, active)

      const allowed = active.length <= maxRequests
      const remaining = Math.max(0, maxRequests - active.length)
      // Reset time: when the oldest timestamp in the window expires
      const resetAt = active.length > 0 ? active[0] + windowMs : currentTime + windowMs

      return { allowed, remaining, resetAt }
    },

    evictExpired(): void {
      const currentTime = now()
      for (const [key, timestamps] of store) {
        const active = timestamps.filter(t => t > currentTime - windowMs)
        if (active.length === 0) store.delete(key)
        else store.set(key, active)
      }
    },
  }
}

// ─── Singleton instances (one per rate-limited endpoint) ──────────────────────

// POST /api/chat — 10 req/min/IP
export const chatIpLimiter = createRateLimiter(10, 60_000)

// GET /api/chat — 30 req/min/IP
export const chatHistoryLimiter = createRateLimiter(30, 60_000)

// POST /api/demo — 10 req/min/IP
export const demoCreateLimiter = createRateLimiter(10, 60_000)

// GET /api/demo — 30 req/min/IP
export const demoReadLimiter = createRateLimiter(30, 60_000)

// POST /api/leads — 5 req/min/IP
export const leadsCreateLimiter = createRateLimiter(5, 60_000)

// GET /api/leads — 20 req/min/IP (operator endpoint; auth is primary control)
export const leadsReadLimiter = createRateLimiter(20, 60_000)

// POST /api/admin/cleanup — 2 req/min/IP
export const cleanupLimiter = createRateLimiter(2, 60_000)

// ─── Per-session hard caps (checked from DB counts, not sliding-window limiters) ─

export const SESSION_MESSAGE_HARD_CAP = 200
export const SESSION_MESSAGE_HOURLY_CAP = 20
export const SESSION_LEAD_LIFETIME_CAP = 10

// ─── IP extraction for Railway reverse proxy ──────────────────────────────────

/**
 * Extract the real client IP from request headers.
 * Railway appends the real client IP as the RIGHTMOST value in X-Forwarded-For.
 * We take the rightmost non-private IP — this is the value Railway's proxy added,
 * which the client cannot spoof (they control only values to the LEFT of Railway's entry).
 * See: https://docs.railway.app/guides/networking#x-forwarded-for
 */
export function getClientIP(req: { headers: { get: (k: string) => string | null } }): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const ips = forwarded.split(',').map(s => s.trim())
    // Rightmost non-private IP = the one Railway's trusted proxy appended
    const publicIP = [...ips].reverse().find(ip => !isPrivateIP(ip))
    if (publicIP) return publicIP
  }

  const realIp = req.headers.get('x-real-ip')
  if (realIp && !isPrivateIP(realIp)) return realIp

  return '127.0.0.1'
}

function isPrivateIP(ip: string): boolean {
  return /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|::1$|^$)/.test(ip)
}
