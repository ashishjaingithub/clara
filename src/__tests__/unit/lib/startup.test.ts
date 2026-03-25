import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Tests for checkProductionEnv() in src/lib/startup.ts
 *
 * Strategy: spy on process.exit so it throws instead of actually exiting.
 * Manually control NODE_ENV and each required env var in beforeEach/afterEach.
 * Because the module has no side-effectful top-level code (the function must be
 * called explicitly), we can import it once and re-exercise it per test.
 */

// Spy must be declared before the import so the mock is in place when the
// module is first evaluated. The spy is set to throw so test assertions work
// without the process actually exiting.
// process.exit signature accepts string | number | null | undefined — use any to satisfy both
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: any) => {
  throw new Error('process.exit called')
})

// Helper: cast to avoid TypeScript read-only complaint on NODE_ENV
function setNodeEnv(value: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(process.env as any).NODE_ENV = value
}

// Snapshot every env var we touch so we can restore it exactly after each test
const ENV_KEYS = [
  'NODE_ENV',
  'NEXT_PHASE',
  'GROQ_API_KEY',
  'LANGSMITH_API_KEY',
  'CLARA_OPERATOR_API_KEY',
  'NEXT_PUBLIC_BASE_URL',
  'LANGSMITH_TRACING',
] as const

type EnvSnapshot = Record<(typeof ENV_KEYS)[number], string | undefined>

function snapshotEnv(): EnvSnapshot {
  return Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]])) as EnvSnapshot
}

function restoreEnv(snapshot: EnvSnapshot) {
  for (const key of ENV_KEYS) {
    const val = snapshot[key]
    if (val === undefined) {
      delete process.env[key]
    } else {
      // NODE_ENV is typed as read-only — cast to bypass TS restriction in test code
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(process.env as any)[key] = val
    }
  }
}

import { checkProductionEnv } from '../../../lib/startup'

describe('checkProductionEnv', () => {
  let snapshot: EnvSnapshot

  beforeEach(() => {
    snapshot = snapshotEnv()
    exitSpy.mockClear()

    // Default: full production config with all vars present
    setNodeEnv('production')
    process.env.GROQ_API_KEY = 'groq-prod-key'
    process.env.LANGSMITH_API_KEY = 'ls-prod-key'
    process.env.CLARA_OPERATOR_API_KEY = 'op-prod-key'
    process.env.NEXT_PUBLIC_BASE_URL = 'https://clara.example.com'
    process.env.LANGSMITH_TRACING = 'true'
  })

  afterEach(() => {
    restoreEnv(snapshot)
  })

  // ── Happy path ────────────────────────────────────────────────────────────

  it('does NOT call process.exit when all required vars are set in production', () => {
    expect(() => checkProductionEnv()).not.toThrow()
    expect(exitSpy).not.toHaveBeenCalled()
  })

  // ── Missing individual required vars ─────────────────────────────────────

  it('calls process.exit(1) when GROQ_API_KEY is missing in production', () => {
    delete process.env.GROQ_API_KEY
    expect(() => checkProductionEnv()).toThrow('process.exit called')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('calls process.exit(1) when LANGSMITH_API_KEY is missing in production', () => {
    delete process.env.LANGSMITH_API_KEY
    expect(() => checkProductionEnv()).toThrow('process.exit called')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('calls process.exit(1) when CLARA_OPERATOR_API_KEY is missing in production', () => {
    delete process.env.CLARA_OPERATOR_API_KEY
    expect(() => checkProductionEnv()).toThrow('process.exit called')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('calls process.exit(1) when NEXT_PUBLIC_BASE_URL is missing in production', () => {
    delete process.env.NEXT_PUBLIC_BASE_URL
    expect(() => checkProductionEnv()).toThrow('process.exit called')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  // ── LANGSMITH_TRACING enforcement ─────────────────────────────────────────

  it('calls process.exit(1) when LANGSMITH_TRACING is "false" in production', () => {
    process.env.LANGSMITH_TRACING = 'false'
    expect(() => checkProductionEnv()).toThrow('process.exit called')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('calls process.exit(1) when LANGSMITH_TRACING is "TRUE" (wrong case) in production', () => {
    process.env.LANGSMITH_TRACING = 'TRUE'
    expect(() => checkProductionEnv()).toThrow('process.exit called')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('calls process.exit(1) when LANGSMITH_TRACING is absent in production', () => {
    delete process.env.LANGSMITH_TRACING
    expect(() => checkProductionEnv()).toThrow('process.exit called')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  // ── Non-production skips all checks ──────────────────────────────────────

  it('does NOT call process.exit in NODE_ENV=development even with all vars missing', () => {
    setNodeEnv('development')
    delete process.env.GROQ_API_KEY
    delete process.env.LANGSMITH_API_KEY
    delete process.env.CLARA_OPERATOR_API_KEY
    delete process.env.NEXT_PUBLIC_BASE_URL
    delete process.env.LANGSMITH_TRACING
    expect(() => checkProductionEnv()).not.toThrow()
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('does NOT call process.exit in NODE_ENV=test even with all vars missing', () => {
    setNodeEnv('test')
    delete process.env.GROQ_API_KEY
    delete process.env.LANGSMITH_API_KEY
    delete process.env.CLARA_OPERATOR_API_KEY
    delete process.env.NEXT_PUBLIC_BASE_URL
    delete process.env.LANGSMITH_TRACING
    expect(() => checkProductionEnv()).not.toThrow()
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('does NOT call process.exit during next build phase even in production', () => {
    // NEXT_PHASE=phase-production-build causes the function to return early (line 9)
    // without checking any env vars — needed so `next build` does not fail at build time
    setNodeEnv('production')
    ;(process.env as Record<string, string>).NEXT_PHASE = 'phase-production-build'
    delete process.env.GROQ_API_KEY
    delete process.env.LANGSMITH_API_KEY
    delete process.env.CLARA_OPERATOR_API_KEY
    delete process.env.NEXT_PUBLIC_BASE_URL
    delete process.env.LANGSMITH_TRACING
    expect(() => checkProductionEnv()).not.toThrow()
    expect(exitSpy).not.toHaveBeenCalled()
  })
})
