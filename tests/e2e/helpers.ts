/**
 * Shared helpers for Clara E2E tests.
 *
 * Rate limit bypass strategy:
 *   The in-memory rate limiter uses client IP as the key (10 POST /api/demo per IP per minute).
 *   All test requests originate from 127.0.0.1 (loopback), which is classified as private
 *   by getClientIP() — causing it to fall back to '127.0.0.1' as the IP key.
 *
 *   To avoid hitting the rate limit across the ~20 POST /api/demo calls in the full test suite,
 *   each request passes a unique fake public IP via X-Forwarded-For.
 *   We use the TEST-NET-3 range (203.0.113.0/24, RFC 5737) — non-routable by design.
 *   getClientIP() picks the rightmost non-private IP from this header.
 */

let _ipCounter = 1

/**
 * Returns a unique TEST-NET-3 IP address for each call.
 * Safe to use as an X-Forwarded-For override in tests.
 */
export function uniqueTestIP(): string {
  const octet = (_ipCounter++ % 254) + 1 // 1-254, wraps
  return `203.0.113.${octet}`
}

/**
 * Headers for operator-only endpoints (POST /api/demo, etc.)
 * Includes a unique IP to avoid rate limit collisions.
 */
export function operatorHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: 'Bearer e2e-test-operator-key',
    'X-Forwarded-For': uniqueTestIP(),
  }
}

/**
 * Headers for public endpoints (POST /api/chat, GET /api/chat, GET /api/demo).
 * Includes a unique IP to avoid rate limit collisions.
 */
export function publicHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Forwarded-For': uniqueTestIP(),
  }
}
