import { describe, it, expect } from 'vitest'

/**
 * Integration test for src/db/migrate.ts
 *
 * `migrate.ts` is a standalone CLI script (not a module with exports).
 * Importing it executes all module-level side effects:
 *   - Opens a SQLite connection (DATABASE_PATH=':memory:' via vitest.config.ts)
 *   - Runs pragma configuration
 *   - Reads migration files from src/db/migrations/
 *   - Applies any un-applied migrations to the _migrations tracking table
 *   - Closes the connection
 *
 * This test verifies the script runs without errors when imported in the
 * test environment.
 */

describe('db/migrate.ts — standalone migration runner', () => {
  it('runs all migrations against an in-memory DB without throwing', async () => {
    // Importing the script executes all side effects.
    // DATABASE_PATH=':memory:' (set by vitest.config.ts) prevents disk writes.
    await expect(import('@/db/migrate')).resolves.toBeDefined()
  })
})
