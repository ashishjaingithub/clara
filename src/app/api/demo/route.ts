import { NextRequest, NextResponse } from 'next/server'
import { eq, isNull } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db } from '@/db/index'
import { demoSessions } from '@/db/schema'
import { requireOperatorAuth } from '@/lib/auth'
import { demoCreateLimiter, demoReadLimiter, getClientIP } from '@/lib/rate-limit'

// POST /api/demo — operator-only; creates a new demo session
export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Operator auth — FIRST check before any other logic
  const authError = requireOperatorAuth(request)
  if (authError) return authError

  // 2. Rate limiting
  const ip = getClientIP(request)
  const rateCheck = demoCreateLimiter.check(ip)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again in 60 seconds.' },
      {
        status: 429,
        headers: { 'Retry-After': '60' },
      },
    )
  }

  // 3. Parse body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).hubspot_company_id !== 'string' ||
    (body as Record<string, unknown>).hubspot_company_id === ''
  ) {
    return NextResponse.json(
      { error: 'Missing required field: hubspot_company_id' },
      { status: 400 },
    )
  }

  const { hubspot_company_id } = body as { hubspot_company_id: string }

  // 4. Validate format: alphanumeric + hyphens/underscores, 1–64 chars
  if (!/^[a-zA-Z0-9\-_]{1,64}$/.test(hubspot_company_id)) {
    return NextResponse.json({ error: 'Invalid hubspot_company_id format' }, { status: 400 })
  }

  // 5. Always create a new session (PRD US-07 AC: new session per call, no deduplication)
  const sessionId = uuidv4()

  await db.insert(demoSessions).values({
    id: sessionId,
    hubspotCompanyId: hubspot_company_id,
  })

  return NextResponse.json(
    { sessionId, uuid: sessionId },
    { status: 201 },
  )
}

// GET /api/demo?uuid=<sessionId> — public; increments view_count
export async function GET(request: NextRequest): Promise<NextResponse> {
  // 1. Rate limiting
  const ip = getClientIP(request)
  const rateCheck = demoReadLimiter.check(ip)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again in 60 seconds.' },
      {
        status: 429,
        headers: { 'Retry-After': '60' },
      },
    )
  }

  // 2. Validate uuid param
  const uuid = request.nextUrl.searchParams.get('uuid')

  if (!uuid) {
    return NextResponse.json({ error: 'uuid query param required' }, { status: 400 })
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) {
    return NextResponse.json({ error: 'Invalid uuid format' }, { status: 400 })
  }

  // 3. Load active session (IDOR gate: only non-deleted sessions, return 404 not 403)
  const session = await db.query.demoSessions.findFirst({
    where: (s, { and, eq: eqOp }) => and(eqOp(s.id, uuid), isNull(s.deletedAt)),
  })

  if (!session) {
    return NextResponse.json({ error: 'Demo session not found' }, { status: 404 })
  }

  // 4. Increment view count
  await db
    .update(demoSessions)
    .set({ viewCount: session.viewCount + 1 })
    .where(eq(demoSessions.id, uuid))

  return NextResponse.json({
    sessionId: session.id,
    businessName: session.businessName ?? 'This Business',
    viewCount: session.viewCount + 1,
    messageCount: session.messageCount,
    createdAt: session.createdAt,
    lastActiveAt: session.lastActiveAt,
  })
}
