import { describe, it, expect } from 'vitest'

/**
 * Integration test for src/db/index.ts
 *
 * Strategy:
 * - Import the real db module (NO mock) so module-level code runs:
 *   - Database(':memory:') is created
 *   - Pragmas are set
 *   - runMigrations fires (file-based or inline fallback)
 *   - Drizzle instance is exported
 * - DATABASE_PATH is ':memory:' (set in vitest.config.ts) — no disk writes.
 * - Tests verify the schema is present by running simple Drizzle queries.
 *
 * This file intentionally does NOT use vi.mock('@/db/index') so that the
 * module-level side effects (DB init + migrations) are executed and covered.
 */

// Import the REAL db — this executes module-level DB init
import { db } from '@/db/index'
import { demoSessions, chatMessages, leads } from '@/db/schema'
import { count } from 'drizzle-orm'

describe('db/index.ts — real in-memory initialisation', () => {
  it('exports a db object with the expected Drizzle API', () => {
    expect(db).toBeDefined()
    expect(typeof db.select).toBe('function')
    expect(typeof db.insert).toBe('function')
    expect(typeof db.update).toBe('function')
    expect(typeof db.delete).toBe('function')
  })

  it('creates the demo_sessions table (migration ran successfully)', async () => {
    const rows = await db.select({ total: count() }).from(demoSessions)
    expect(rows).toHaveLength(1)
    expect(rows[0].total).toBe(0) // empty table — no rows yet
  })

  it('creates the chat_messages table', async () => {
    const rows = await db.select({ total: count() }).from(chatMessages)
    expect(rows[0].total).toBe(0)
  })

  it('creates the leads table', async () => {
    const rows = await db.select({ total: count() }).from(leads)
    expect(rows[0].total).toBe(0)
  })

  it('can insert and query a demo session row', async () => {
    const id = 'a1b2c3d4-0000-0000-0000-000000000001'
    await db.insert(demoSessions).values({
      id,
      hubspotCompanyId: 'hubspot-test-01',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    })

    const found = await db.query.demoSessions.findFirst({
      where: (t, { eq }) => eq(t.id, id),
    })

    expect(found).toBeDefined()
    expect(found?.hubspotCompanyId).toBe('hubspot-test-01')
    expect(found?.messageCount).toBe(0)
    expect(found?.deletedAt).toBeNull()
  })

  it('enforces the session_id foreign key on chat_messages', async () => {
    // Inserting a chat message for a non-existent session should throw
    await expect(
      db.insert(chatMessages).values({
        id: 'msg-000',
        sessionId: 'non-existent-session-id',
        role: 'user',
        content: 'Hello',
        createdAt: new Date().toISOString(),
      }),
    ).rejects.toThrow()
  })
})
