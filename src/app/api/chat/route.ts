import { NextRequest, NextResponse } from 'next/server'
import { eq, asc, isNull } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db } from '@/db/index'
import { demoSessions, chatMessages } from '@/db/schema'
import { runReceptionist } from '@/agent/receptionist'
import type { MessageHistoryItem, BusinessProfile } from '@/agent/receptionist'
import {
  chatIpLimiter,
  chatHistoryLimiter,
  getClientIP,
  SESSION_MESSAGE_HARD_CAP,
} from '@/lib/rate-limit'
import { toErrorResponse, LLMError } from '@/lib/errors'

// POST /api/chat — visitor sends a message and gets Clara's reply
export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. IP rate limit — FIRST check before any DB access
  const ip = getClientIP(request)
  const ipCheck = chatIpLimiter.check(ip)
  if (!ipCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again in 60 seconds.' },
      {
        status: 429,
        headers: { 'Retry-After': '60' },
      },
    )
  }

  // 2. Parse and validate body
  let body: unknown
  try {
    body = await request.json()
  } catch (err) {
    console.warn('Chat API: failed to parse JSON body', err)
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).sessionId !== 'string' ||
    typeof (body as Record<string, unknown>).message !== 'string'
  ) {
    return NextResponse.json(
      { error: 'Missing required fields: sessionId, message' },
      { status: 400 },
    )
  }

  const { sessionId, message } = body as { sessionId: string; message: string }

  // Validate sessionId format
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
    return NextResponse.json({ error: 'Invalid sessionId format' }, { status: 400 })
  }

  const trimmedMessage = message.trim()
  if (!trimmedMessage) {
    return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })
  }
  if (trimmedMessage.length > 2000) {
    return NextResponse.json({ error: 'Message too long (max 2000 characters)' }, { status: 400 })
  }

  // 3. Load active session (IDOR gate: only non-deleted sessions)
  const session = await db.query.demoSessions.findFirst({
    where: (s, { and, eq: eqOp }) => and(eqOp(s.id, sessionId), isNull(s.deletedAt)),
  })

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  // 4. Session lifetime hard cap (200 user messages)
  if (session.messageCount >= SESSION_MESSAGE_HARD_CAP) {
    return NextResponse.json(
      { error: 'This demo has reached its message limit. Please contact us directly.' },
      {
        status: 429,
        headers: { 'Retry-After': '60' },
      },
    )
  }

  // 5. Load message history
  const existingMessages = await db.query.chatMessages.findMany({
    where: eq(chatMessages.sessionId, sessionId),
    orderBy: [asc(chatMessages.createdAt)],
  })

  const history: MessageHistoryItem[] = existingMessages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  // 6. Rebuild cached business profile from session if available
  const cachedProfile: BusinessProfile | undefined = session.businessName
    ? {
        companyId: session.hubspotCompanyId,
        companyName: session.businessName,
      }
    : undefined

  // 7. Run the agent
  let result: Awaited<ReturnType<typeof runReceptionist>>
  try {
    result = await runReceptionist({
      hubspotCompanyId: session.hubspotCompanyId,
      message: trimmedMessage,
      history,
      businessProfile: cachedProfile,
    })
  } catch (err) {
    const lllmErr = new LLMError('Agent failed to generate a response', err)
    process.stderr.write(`[Clara] Receptionist agent error: ${lllmErr.context?.['cause'] ?? String(err)}\n`)
    return NextResponse.json(lllmErr.toJSON(), { status: lllmErr.statusCode })
  }

  // 8. Check for [NEEDS_FOLLOWUP] signal and strip it from the visible reply
  const FOLLOWUP_TAG = '[NEEDS_FOLLOWUP]'
  const triggerLeadCapture = result.reply.trimEnd().endsWith(FOLLOWUP_TAG)
  const visibleReply = triggerLeadCapture
    ? result.reply.trimEnd().slice(0, -FOLLOWUP_TAG.length).trimEnd()
    : result.reply

  const now = new Date().toISOString()

  // 9. Persist user message (no langsmithTraceId on user messages)
  const userMsgId = uuidv4()
  await db.insert(chatMessages).values({
    id: userMsgId,
    sessionId,
    role: 'user',
    content: trimmedMessage,
    langsmithTraceId: null,
  })

  // 10. Persist assistant reply (store visible reply without the tag)
  const assistantMsgId = uuidv4()
  await db.insert(chatMessages).values({
    id: assistantMsgId,
    sessionId,
    role: 'assistant',
    content: visibleReply,
    langsmithTraceId: result.langsmithTraceId ?? null,
  })

  // 11. Update session: increment message_count by 1 (user messages only), update lastActiveAt
  //     Cache business_name from the first successful Hunter fetch
  await db
    .update(demoSessions)
    .set({
      lastActiveAt: now,
      messageCount: session.messageCount + 1,
      businessName: result.businessProfile.companyName,
    })
    .where(eq(demoSessions.id, sessionId))

  return NextResponse.json({
    reply: visibleReply,
    messageId: assistantMsgId,
    ...(triggerLeadCapture && { triggerLeadCapture: true }),
  })
}

// GET /api/chat?sessionId=<id> — returns full message history (public with UUID gate)
export async function GET(request: NextRequest): Promise<NextResponse> {
  // 1. Rate limiting
  const ip = getClientIP(request)
  const rateCheck = chatHistoryLimiter.check(ip)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again in 60 seconds.' },
      {
        status: 429,
        headers: { 'Retry-After': '60' },
      },
    )
  }

  // 2. Validate sessionId param
  const sessionId = request.nextUrl.searchParams.get('sessionId')

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId query param required' }, { status: 400 })
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
    return NextResponse.json({ error: 'Invalid sessionId format' }, { status: 400 })
  }

  // 3. Verify session exists and is not soft-deleted (IDOR gate)
  const session = await db.query.demoSessions.findFirst({
    where: (s, { and, eq: eqOp }) => and(eqOp(s.id, sessionId), isNull(s.deletedAt)),
  })

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  // 4. Return message history
  const messages = await db.query.chatMessages.findMany({
    where: eq(chatMessages.sessionId, sessionId),
    orderBy: [asc(chatMessages.createdAt)],
  })

  return NextResponse.json({
    sessionId,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    })),
  })
}
