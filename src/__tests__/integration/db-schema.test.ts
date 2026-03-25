import { describe, it, expect } from 'vitest'

/**
 * Integration tests for db/schema.ts
 *
 * Strategy:
 * - Import the REAL db module against :memory: SQLite.
 * - Insert rows WITHOUT providing createdAt/lastActiveAt to trigger the
 *   $defaultFn(() => new Date().toISOString()) callbacks on those columns.
 * - Assert the auto-populated values are valid ISO-8601 timestamps.
 *
 * Why this matters:
 * - V8 coverage counts the $defaultFn arrow functions as uncovered when no
 *   insert triggers them.  These tests exercise lines 9-10, 20-24, 32-37.
 */

import { db } from '@/db/index'
import { demoSessions, chatMessages, leads } from '@/db/schema'
import { eq } from 'drizzle-orm'

const ISO_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

describe('db/schema.ts — $defaultFn callbacks (default timestamps)', () => {
  it('auto-populates createdAt and lastActiveAt on demoSessions insert (lines 9-10)', async () => {
    const id = 'schema-test-' + Date.now().toString()
    await db.insert(demoSessions).values({
      id,
      hubspotCompanyId: 'schema-hubspot-001',
      // intentionally omit createdAt and lastActiveAt — $defaultFn should fill them
    })

    const row = await db.query.demoSessions.findFirst({
      where: (t, { eq: eqOp }) => eqOp(t.id, id),
    })

    expect(row).toBeDefined()
    expect(row!.createdAt).toBeDefined()
    expect(typeof row!.createdAt).toBe('string')
    // Should be a valid ISO-8601 timestamp
    expect(() => new Date(row!.createdAt).toISOString()).not.toThrow()
    expect(row!.lastActiveAt).toBeDefined()
    expect(typeof row!.lastActiveAt).toBe('string')
    expect(() => new Date(row!.lastActiveAt).toISOString()).not.toThrow()
  })

  it('auto-populates createdAt on chatMessages insert (lines 20-24)', async () => {
    // Insert a parent session first
    const sessionId = 'schema-session-' + Date.now().toString()
    await db.insert(demoSessions).values({
      id: sessionId,
      hubspotCompanyId: 'schema-hubspot-002',
    })

    const msgId = 'schema-msg-' + Date.now().toString()
    await db.insert(chatMessages).values({
      id: msgId,
      sessionId,
      role: 'user',
      content: 'Schema default function test message',
      // omit createdAt — $defaultFn should populate it
    })

    const row = await db.query.chatMessages.findFirst({
      where: (t, { eq: eqOp }) => eqOp(t.id, msgId),
    })

    expect(row).toBeDefined()
    expect(row!.createdAt).toBeDefined()
    expect(typeof row!.createdAt).toBe('string')
    expect(() => new Date(row!.createdAt).toISOString()).not.toThrow()
    // langsmithTraceId defaults to null
    expect(row!.langsmithTraceId).toBeNull()
  })

  it('auto-populates createdAt on leads insert (lines 32-37)', async () => {
    // Insert parent session
    const sessionId = 'schema-lead-session-' + Date.now().toString()
    await db.insert(demoSessions).values({
      id: sessionId,
      hubspotCompanyId: 'schema-hubspot-003',
    })

    const leadId = 'schema-lead-' + Date.now().toString()
    await db.insert(leads).values({
      id: leadId,
      sessionId,
      hubspotCompanyId: 'schema-hubspot-003',
      name: 'Schema Test User',
      contact: 'schema@test.com',
      // omit createdAt — $defaultFn should populate it
    })

    const row = await db.query.leads.findFirst({
      where: (t, { eq: eqOp }) => eqOp(t.id, leadId),
    })

    expect(row).toBeDefined()
    expect(row!.createdAt).toBeDefined()
    expect(typeof row!.createdAt).toBe('string')
    expect(() => new Date(row!.createdAt).toISOString()).not.toThrow()
    expect(row!.message).toBeNull()
  })

  it('allows optional message field on leads to be null (line 36)', async () => {
    const sessionId = 'schema-nullmsg-' + Date.now().toString()
    await db.insert(demoSessions).values({
      id: sessionId,
      hubspotCompanyId: 'schema-hubspot-004',
    })

    const leadId = 'schema-nullmsg-lead-' + Date.now().toString()
    await db.insert(leads).values({
      id: leadId,
      sessionId,
      hubspotCompanyId: 'schema-hubspot-004',
      name: 'No Message User',
      contact: 'nomessage@test.com',
      message: null,
    })

    const row = await db.query.leads.findFirst({
      where: eq(leads.id, leadId),
    })
    expect(row!.message).toBeNull()
  })

  it('stores optional message field on leads when provided (line 36)', async () => {
    const sessionId = 'schema-withmsg-' + Date.now().toString()
    await db.insert(demoSessions).values({
      id: sessionId,
      hubspotCompanyId: 'schema-hubspot-005',
    })

    const leadId = 'schema-withmsg-lead-' + Date.now().toString()
    await db.insert(leads).values({
      id: leadId,
      sessionId,
      hubspotCompanyId: 'schema-hubspot-005',
      name: 'With Message User',
      contact: 'withmsg@test.com',
      message: 'Looking for a quote',
    })

    const row = await db.query.leads.findFirst({
      where: eq(leads.id, leadId),
    })
    expect(row!.message).toBe('Looking for a quote')
  })

  it('viewCount defaults to 0 and messageCount defaults to 0 on demoSessions', async () => {
    const id = 'schema-counts-' + Date.now().toString()
    await db.insert(demoSessions).values({
      id,
      hubspotCompanyId: 'schema-counts-001',
    })

    const row = await db.query.demoSessions.findFirst({
      where: (t, { eq: eqOp }) => eqOp(t.id, id),
    })
    expect(row!.viewCount).toBe(0)
    expect(row!.messageCount).toBe(0)
    expect(row!.deletedAt).toBeNull()
  })

  it('stores enum role field correctly for assistant messages (line 21)', async () => {
    const sessionId = 'schema-role-' + Date.now().toString()
    await db.insert(demoSessions).values({
      id: sessionId,
      hubspotCompanyId: 'schema-role-001',
    })

    const msgId = 'schema-role-msg-' + Date.now().toString()
    await db.insert(chatMessages).values({
      id: msgId,
      sessionId,
      role: 'assistant',
      content: 'I can help you with that.',
    })

    const row = await db.query.chatMessages.findFirst({
      where: (t, { eq: eqOp }) => eqOp(t.id, msgId),
    })
    expect(row!.role).toBe('assistant')
  })

  it('stores langsmithTraceId when provided on chatMessages (line 23)', async () => {
    const sessionId = 'schema-trace-' + Date.now().toString()
    await db.insert(demoSessions).values({
      id: sessionId,
      hubspotCompanyId: 'schema-trace-001',
    })

    const msgId = 'schema-trace-msg-' + Date.now().toString()
    const traceId = 'ls-trace-id-abc123'
    await db.insert(chatMessages).values({
      id: msgId,
      sessionId,
      role: 'assistant',
      content: 'Response with trace',
      langsmithTraceId: traceId,
    })

    const row = await db.query.chatMessages.findFirst({
      where: (t, { eq: eqOp }) => eqOp(t.id, msgId),
    })
    expect(row!.langsmithTraceId).toBe(traceId)
  })
})
