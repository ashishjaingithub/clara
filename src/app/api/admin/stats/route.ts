import { NextRequest, NextResponse } from 'next/server'
import { sql, isNull, isNotNull, count } from 'drizzle-orm'
import { db } from '@/db/index'
import { demoSessions, chatMessages, leads } from '@/db/schema'
import { requireOperatorAuth } from '@/lib/auth'
import { getClientIP } from '@/lib/rate-limit'

// Simple in-memory limiter for the stats endpoint (5 req/min per IP)
const statsCallTimes: Map<string, number[]> = new Map()

function checkStatsLimit(ip: string): boolean {
  const now = Date.now()
  const window = 60_000 // 1 minute
  const max = 30
  const times = (statsCallTimes.get(ip) ?? []).filter((t) => now - t < window)
  if (times.length >= max) return false
  times.push(now)
  statsCallTimes.set(ip, times)
  return true
}

// GET /api/admin/stats — operator-only; aggregate dashboard data
export async function GET(request: NextRequest): Promise<NextResponse> {
  // 1. Operator auth — FIRST check
  const authError = requireOperatorAuth(request)
  if (authError) return authError

  // 2. Light rate limiting
  const ip = getClientIP(request)
  if (!checkStatsLimit(ip)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again in 60 seconds.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    )
  }

  // 3. Aggregate counts — run in parallel
  const [totalSessionsResult, activeSessionsResult, totalMessagesResult, totalLeadsResult] =
    await Promise.all([
      db.select({ value: count() }).from(demoSessions),
      db.select({ value: count() }).from(demoSessions).where(isNull(demoSessions.deletedAt)),
      db.select({ value: count() }).from(chatMessages),
      db.select({ value: count() }).from(leads),
    ])

  const totalSessions = totalSessionsResult[0]?.value ?? 0
  const activeSessions = activeSessionsResult[0]?.value ?? 0
  const totalMessages = totalMessagesResult[0]?.value ?? 0
  const totalLeads = totalLeadsResult[0]?.value ?? 0

  // 4. Recent sessions (last 20, most recent first) with lead counts via subquery
  const recentSessionRows = await db
    .select({
      id: demoSessions.id,
      hubspotCompanyId: demoSessions.hubspotCompanyId,
      businessName: demoSessions.businessName,
      messageCount: demoSessions.messageCount,
      createdAt: demoSessions.createdAt,
      lastActiveAt: demoSessions.lastActiveAt,
      leadCount: sql<number>`(
        SELECT COUNT(*) FROM leads WHERE leads.session_id = ${demoSessions.id}
      )`,
    })
    .from(demoSessions)
    .orderBy(sql`${demoSessions.createdAt} DESC`)
    .limit(20)

  // 5. Recent leads (last 20, most recent first) joined with session for businessName
  const recentLeadRows = await db
    .select({
      id: leads.id,
      sessionId: leads.sessionId,
      hubspotCompanyId: leads.hubspotCompanyId,
      businessName: demoSessions.businessName,
      name: leads.name,
      contact: leads.contact,
      message: leads.message,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .leftJoin(demoSessions, sql`${leads.sessionId} = ${demoSessions.id}`)
    .orderBy(sql`${leads.createdAt} DESC`)
    .limit(20)

  return NextResponse.json({
    totalSessions,
    activeSessions,
    totalMessages,
    totalLeads,
    recentSessions: recentSessionRows.map((s) => ({
      id: s.id,
      hubspotCompanyId: s.hubspotCompanyId,
      businessName: s.businessName ?? null,
      messageCount: s.messageCount,
      createdAt: s.createdAt,
      lastActiveAt: s.lastActiveAt,
      leadCount: Number(s.leadCount),
    })),
    recentLeads: recentLeadRows.map((l) => ({
      id: l.id,
      sessionId: l.sessionId,
      hubspotCompanyId: l.hubspotCompanyId,
      businessName: l.businessName ?? null,
      name: l.name,
      contact: l.contact,
      message: l.message ?? null,
      createdAt: l.createdAt,
    })),
  })
}
