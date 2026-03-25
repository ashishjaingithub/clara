import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/db/index'
import { demoSessions } from '@/db/schema'
import { requireOperatorAuth } from '@/lib/auth'
import { cleanupLimiter, getClientIP } from '@/lib/rate-limit'

// POST /api/admin/cleanup — operator-only; soft-deletes sessions inactive for 30+ days
export async function GET(request: NextRequest): Promise<NextResponse> {
  // 1. Operator auth — FIRST check
  const authError = requireOperatorAuth(request)
  if (authError) return authError

  // 2. Rate limiting (2 req/min — cron-only endpoint)
  const ip = getClientIP(request)
  const rateCheck = cleanupLimiter.check(ip)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again in 60 seconds.' },
      {
        status: 429,
        headers: { 'Retry-After': '60' },
      },
    )
  }

  // 3. Calculate the 30-day cutoff date
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - 30)
  const cutoffIso = cutoffDate.toISOString()

  // 4. Soft-delete sessions with no activity in the last 30 days
  //    Condition: last_active_at < cutoffDate AND deleted_at IS NULL
  const now = new Date().toISOString()

  const result = await db
    .update(demoSessions)
    .set({ deletedAt: now })
    .where(
      sql`${demoSessions.lastActiveAt} < ${cutoffIso} AND ${demoSessions.deletedAt} IS NULL`,
    )
    .returning({ id: demoSessions.id })

  const sessionsExpired = result.length

  process.stdout.write(`[admin/cleanup] Soft-deleted ${sessionsExpired} session(s) inactive since ${cutoffIso}\n`)

  return NextResponse.json({
    sessionsExpired,
    archivedCount: sessionsExpired,
    cutoffDate: cutoffIso,
  })
}
