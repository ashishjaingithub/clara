import { describe, it, expect, vi } from 'vitest'

/**
 * Integration test for src/db/index.ts — inline fallback path.
 *
 * When `readdirSync` throws (migrations directory not found), the module
 * falls back to `runInlineFallback(db)` which creates tables via inline DDL.
 * This test covers lines 39-40 and 58 in db/index.ts.
 *
 * Strategy:
 * - Mock `fs` to make `readdirSync` throw a "not found" error.
 * - Dynamically import a fresh copy of `@/db/index` so module-level code runs.
 * - Verify the fallback schema is created (tables exist and are queryable).
 */

// Mock fs before any imports that might load db/index.ts
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    readdirSync: vi.fn((path: string) => {
      // Simulate migrations directory not found
      const err = new Error(`ENOENT: no such file or directory, scandir '${path}'`)
      Object.assign(err, { code: 'ENOENT' })
      throw err
    }),
  }
})

describe('db/index.ts — inline fallback path (migrations dir missing)', () => {
  it('falls back to inline DDL when migrations directory is not found', async () => {
    // Dynamic import forces a fresh module load AFTER the vi.mock is applied
    const { db } = await import('@/db/index')

    expect(db).toBeDefined()
    expect(typeof db.select).toBe('function')
  })

  it('inline fallback creates the demo_sessions table', async () => {
    const { db } = await import('@/db/index')
    const { demoSessions } = await import('@/db/schema')
    const { count } = await import('drizzle-orm')

    const rows = await db.select({ total: count() }).from(demoSessions)
    expect(rows[0].total).toBeGreaterThanOrEqual(0)
  })
})
