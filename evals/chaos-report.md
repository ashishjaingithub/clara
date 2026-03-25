# Chaos Agent Report

**Date:** 2026-03-24
**Build/Iteration:** clara — Explore phase, post-backend-build
**Test suite location:** `/Users/ashishjain/agenticLearning/clara/src/__tests__/`
**Test runner:** Vitest v4.1.1
**Baseline:** 33 tests passing across 3 files before any mutation

---

## Test Strength Score: 100%

```
MUTATION TESTING RESULTS
═══════════════════════════════════════════════════════════════════════════
Path                                               Result     Verdict
───────────────────────────────────────────────────────────────────────────
auth: wrong key returns null instead of 401        CAUGHT     Strong
  (auth.ts: timingSafeEqual failure path mutated
   to return null — bypasses auth on wrong key)
  Tests that failed: "returns 401 when wrong key is provided"
                     "is timing-safe — does not reveal whether key exists"

rate-limit: allowed = true (limit never fires)     CAUGHT     Strong
  (rate-limit.ts: active.length <= maxRequests
   replaced with literal true)
  Tests that failed: "rejects the request that exceeds the limit"
                     "tracks keys independently"
                     "allows requests after the window expires using
                      injected clock" (partial — blocked check failed)

receptionist: anti-injection instruction removed   CAUGHT     Strong
  (receptionist.ts: prompt injection defense line
   deleted from buildSystemPrompt)
  Tests that failed: "includes anti-injection instruction"
═══════════════════════════════════════════════════════════════════════════
Test Strength Score: 3/3 = 100% — PASS (threshold: 80%)
```

---

## Vibe Tests to Rewrite

None identified. All three mutations were caught by distinct, precisely targeted assertions.
The test suite contains no tests that would pass regardless of implementation correctness for
the three paths tested.

---

## Security Payload Coverage Results

```
SECURITY PAYLOAD RESULTS
════════════════════════════════════════════════════════════════════════════
Security Check             Coverage                    Result
────────────────────────────────────────────────────────────────────────────
Wrong operator API key     auth.test.ts lines 58-65    COVERED
  → 401 Unauthorized       Explicit assertions on
                           status=401 and body.error=
                           "Unauthorized" for wrong key

Rate limit exceeded        rate-limit.test.ts          COVERED
  → allowed: false         lines 12-19, 29-35, 43-45
                           Multiple assertions that
                           allowed=false and
                           remaining=0 past limit

Missing GROQ_API_KEY       NOT DIRECTLY TESTED         MISSING
  in production →          startup.ts exists with
  process.exit(1)          checkProductionEnv() and
                           correct process.exit(1)
                           logic, but there is no test
                           file for startup.ts.
                           setup.ts sets GROQ_API_KEY=
                           'test-key' to prevent exit
                           in tests — but the inverse
                           (production enforcement)
                           is untested.
════════════════════════════════════════════════════════════════════════════
Security Coverage Score: 2/3 checks covered
```

### Detail: Missing startup.ts test

`/Users/ashishjain/agenticLearning/clara/src/lib/startup.ts` implements `checkProductionEnv()`
which calls `process.exit(1)` when `GROQ_API_KEY`, `LANGSMITH_API_KEY`, `CLARA_OPERATOR_API_KEY`,
or `NEXT_PUBLIC_BASE_URL` are absent in production, or when `LANGSMITH_TRACING !== 'true'`.

There are no tests that:
1. Set `NODE_ENV=production` and delete `GROQ_API_KEY`, then assert `process.exit` is called
2. Verify the specific env var names checked match the spec table in technical-spec.md Section 3
3. Verify `LANGSMITH_TRACING` enforcement

Without tests, a refactor that silently drops a required var check would go undetected.

**Recommended test (for QA Agent to write):**

```typescript
// src/__tests__/unit/lib/startup.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('checkProductionEnv', () => {
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit called') })

  beforeEach(() => {
    (process.env as Record<string, string>).NODE_ENV = 'production'
    process.env.GROQ_API_KEY = 'key'
    process.env.LANGSMITH_API_KEY = 'key'
    process.env.CLARA_OPERATOR_API_KEY = 'key'
    process.env.NEXT_PUBLIC_BASE_URL = 'https://clara.example.com'
    process.env.LANGSMITH_TRACING = 'true'
  })

  it('does not exit when all required vars are set', () => {
    const { checkProductionEnv } = require('../../../lib/startup')
    expect(() => checkProductionEnv()).not.toThrow()
  })

  it('calls process.exit(1) when GROQ_API_KEY is missing in production', () => {
    delete process.env.GROQ_API_KEY
    const { checkProductionEnv } = require('../../../lib/startup')
    expect(() => checkProductionEnv()).toThrow('process.exit called')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('calls process.exit(1) when LANGSMITH_TRACING is not "true" in production', () => {
    process.env.LANGSMITH_TRACING = 'false'
    const { checkProductionEnv } = require('../../../lib/startup')
    expect(() => checkProductionEnv()).toThrow('process.exit called')
  })

  it('skips all checks in non-production', () => {
    delete process.env.GROQ_API_KEY
    ;(process.env as Record<string, string>).NODE_ENV = 'development'
    const { checkProductionEnv } = require('../../../lib/startup')
    expect(() => checkProductionEnv()).not.toThrow()
  })
})
```

---

## Additional Observations

### Observation 1: getClientIP Railway proxy logic is inverted in test vs. spec

The test at `rate-limit.test.ts` line 91-93 asserts:
```
'x-forwarded-for': '203.0.113.1, 10.0.0.1, 172.16.0.1'  →  returns '203.0.113.1'
```

The current implementation takes the **rightmost** non-private IP (Railway's entry), which for
`203.0.113.1, 10.0.0.1, 172.16.0.1` would be `203.0.113.1` coincidentally — but only because
the private IPs are in the middle and right. The test description says "takes leftmost public IP"
which matches neither the Railway spec (rightmost) nor standard FFWD header semantics. The test
input does not distinguish whether the implementation is leftmost vs. rightmost because the only
public IP happens to be leftmost.

This is not a vibe test (it does assert a specific value), but it does not cover the Railway-
specific claim that the rightmost IP is trusted. A mutation that changes `reverse()` to not
reverse would still pass this particular test case.

**Recommended additional test case for QA Agent:**
```typescript
it('takes RIGHTMOST public IP from x-forwarded-for (Railway trusted proxy behavior)', () => {
  // Client supplies a spoofed public IP on the left; Railway appends real IP on right
  const req = makeHeaders({ 'x-forwarded-for': '1.2.3.4, 203.0.113.99' })
  // 203.0.113.99 is rightmost, which is what Railway appended — trust this one
  expect(getClientIP(req)).toBe('203.0.113.99')
})
```

### Observation 2: No route handler tests exist

The test suite covers only three units: `auth.ts`, `rate-limit.ts`, and `receptionist.ts`.
The technical spec (Section 6, Testing Strategy) calls for tests on `route.ts` files for
`/api/chat`, `/api/demo`, `/api/leads`, and `/api/admin/cleanup`. None exist.

This is not a mutation result (out of scope for this run), but it is a gap: the integration
between auth middleware + rate limiting + DB + agent cannot be tested without route handler tests.
The route handlers are where these three units compose — and that composition is currently untested.

---

## Verdict

**PASS** — All 3 mutations caught (100% strength, threshold 80%). No security payload bypasses.

One security gap identified: `startup.ts` has no test coverage. This is not a blocking failure
for Explore phase (no coverage gates) but should be addressed before Extract promotion.

---

## Recommendations

1. **Write startup.ts tests** (highest priority security gap). See template above.
   File: `src/__tests__/unit/lib/startup.test.ts`

2. **Add Railway-specific IP test** to clarify the directional intent of `getClientIP`.
   The current test description "takes leftmost public IP" contradicts the implementation
   comment and Railway docs. Rename the test and add a rightmost-trust test case.

3. **Add route handler tests** for `/api/chat`, `/api/demo`, `/api/leads`, `/api/admin/cleanup`
   before Extract phase promotion. These tests would catch auth/rate-limit composition bugs
   that unit tests alone cannot surface.

4. **Final baseline confirmation:** All 33 tests passed after all mutations were restored.
   No mutations were left in the codebase.

---

*Generated by Chaos Agent — 2026-03-24*
*Model: claude-sonnet-4-6*
