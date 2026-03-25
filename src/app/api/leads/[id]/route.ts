import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db/index'
import { leads } from '@/db/schema'
import { requireOperatorAuth } from '@/lib/auth'
import { leadsReadLimiter, getClientIP } from '@/lib/rate-limit'

// DELETE /api/leads/:id — operator-only; hard-delete (GDPR Art.17 erasure)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  // 1. Operator auth — FIRST check
  const authError = requireOperatorAuth(request)
  if (authError) return authError

  // 2. Rate limiting (share leadsReadLimiter — 20/min is appropriate for operator operations)
  const ip = getClientIP(request)
  const rateCheck = leadsReadLimiter.check(ip)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again in 60 seconds.' },
      {
        status: 429,
        headers: { 'Retry-After': '60' },
      },
    )
  }

  // 3. Validate lead ID format
  const { id } = await params

  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid lead id format' }, { status: 400 })
  }

  // 4. Verify lead exists before deleting
  const existing = await db.query.leads.findFirst({
    where: eq(leads.id, id),
  })

  if (!existing) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  // 5. Hard-delete — GDPR Art.17 right to erasure; PII must be fully removed
  await db.delete(leads).where(eq(leads.id, id))

  return NextResponse.json({ deleted: true, id })
}
