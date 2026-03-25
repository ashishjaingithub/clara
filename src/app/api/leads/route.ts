import { NextRequest, NextResponse } from 'next/server'
import { eq, isNull } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db } from '@/db/index'
import { demoSessions, leads } from '@/db/schema'
import { requireOperatorAuth } from '@/lib/auth'
import { leadsCreateLimiter, leadsReadLimiter, getClientIP, SESSION_LEAD_LIFETIME_CAP } from '@/lib/rate-limit'
import { notifyLeadCaptured } from '@/lib/notify'

// POST /api/leads — public (UUID gate); visitor submits their contact info
export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. IP rate limiting — FIRST check
  const ip = getClientIP(request)
  const rateCheck = leadsCreateLimiter.check(ip)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again in 60 seconds.' },
      {
        status: 429,
        headers: { 'Retry-After': '60' },
      },
    )
  }

  // 2. Parse body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const b = body as Record<string, unknown>

  // 3. Validate required fields
  if (typeof b.sessionId !== 'string' || !b.sessionId) {
    return NextResponse.json({ error: 'Invalid sessionId format' }, { status: 400 })
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b.sessionId)) {
    return NextResponse.json({ error: 'Invalid sessionId format' }, { status: 400 })
  }

  if (typeof b.name !== 'string' || !b.name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (b.name.length > 200) {
    return NextResponse.json({ error: 'name too long (max 200 characters)' }, { status: 400 })
  }

  if (typeof b.contact !== 'string' || !b.contact.trim()) {
    return NextResponse.json({ error: 'contact is required' }, { status: 400 })
  }
  if (b.contact.length > 200) {
    return NextResponse.json({ error: 'contact too long (max 200 characters)' }, { status: 400 })
  }

  if (b.message !== undefined && b.message !== null) {
    if (typeof b.message !== 'string') {
      return NextResponse.json({ error: 'message must be a string' }, { status: 400 })
    }
    if (b.message.length > 1000) {
      return NextResponse.json({ error: 'message too long (max 1000 characters)' }, { status: 400 })
    }
  }

  const { sessionId, name, contact, message } = {
    sessionId: b.sessionId,
    name: (b.name as string).trim(),
    contact: (b.contact as string).trim(),
    message: typeof b.message === 'string' ? b.message : undefined,
  }

  // 4. Load active session — get hubspot_company_id (never trust it from the client)
  const session = await db.query.demoSessions.findFirst({
    where: (s, { and, eq: eqOp }) => and(eqOp(s.id, sessionId), isNull(s.deletedAt)),
  })

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  // 5. Per-session lifetime cap on lead submissions
  const existingLeads = await db.query.leads.findMany({
    where: eq(leads.sessionId, sessionId),
  })

  if (existingLeads.length >= SESSION_LEAD_LIFETIME_CAP) {
    return NextResponse.json(
      { error: 'Maximum lead submissions reached for this session.' },
      {
        status: 429,
        headers: { 'Retry-After': '60' },
      },
    )
  }

  // 6. Insert lead — hubspot_company_id sourced from DB row, not client
  const leadId = uuidv4()
  await db.insert(leads).values({
    id: leadId,
    sessionId,
    hubspotCompanyId: session.hubspotCompanyId,
    name,
    contact,
    message: message ?? null,
  })

  // 7. Log without PII (security spec: never log name or contact)
  process.stdout.write(`[leads] captured for session ${sessionId.slice(0, 8)}...\n`)

  // 8. Fire-and-forget email notification — never blocks response
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ??
    `http://localhost:${process.env.PORT ?? 3002}`

  void notifyLeadCaptured({
    businessName: session.businessName ?? 'This Business',
    hubspotCompanyId: session.hubspotCompanyId,
    visitorName: name,
    visitorContact: contact,
    visitorMessage: message,
    sessionId,
    baseUrl,
  })

  return NextResponse.json({ leadId }, { status: 201 })
}

// GET /api/leads?company=<hubspot_company_id> — operator-only; returns leads for a company
export async function GET(request: NextRequest): Promise<NextResponse> {
  // 1. Operator auth — FIRST check
  const authError = requireOperatorAuth(request)
  if (authError) return authError

  // 2. Rate limiting
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

  // 3. Validate company query param
  const company = request.nextUrl.searchParams.get('company')

  if (!company || !company.trim()) {
    return NextResponse.json({ error: 'company query param required' }, { status: 400 })
  }

  if (!/^[a-zA-Z0-9\-_]{1,64}$/.test(company)) {
    return NextResponse.json({ error: 'Invalid company format' }, { status: 400 })
  }

  // 4. Query leads for this company (ordered by most recent first)
  const companyLeads = await db.query.leads.findMany({
    where: eq(leads.hubspotCompanyId, company),
    orderBy: (l, { desc }) => [desc(l.createdAt)],
  })

  return NextResponse.json({
    leads: companyLeads.map((l) => ({
      id: l.id,
      sessionId: l.sessionId,
      name: l.name,
      contact: l.contact,
      message: l.message ?? null,
      createdAt: l.createdAt,
    })),
  })
}
