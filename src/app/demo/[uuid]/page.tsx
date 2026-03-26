'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { ChatHeader } from '@/components/ChatHeader'
import { DemoBanner } from '@/components/DemoBanner'
import { LeadCaptureCard } from '@/components/LeadCaptureCard'
import { MessageBubble } from '@/components/MessageBubble'
import { MessageInput } from '@/components/MessageInput'
import { StarterChips } from '@/components/StarterChips'
import { TypingIndicator } from '@/components/TypingIndicator'
import { suggestReplies } from '@/lib/suggest-replies'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  isError?: boolean
  createdAt?: string
  /** Original user text for failed messages, so Retry can re-send it */
  retryText?: string
}

interface SessionMeta {
  sessionId: string
  businessName: string
  messageCount: number
  viewCount: number
  createdAt: string
  lastActiveAt: string
}

interface LeadData {
  name: string
  email?: string
  phone?: string
}

// ─── Lead-trigger detection ───────────────────────────────────────────────────

const LEAD_TRIGGER_PATTERNS = [
  /\b(follow[- ]?up|call back|callback|contact|reach out|get in touch|speak to|talk to|someone call)\b/i,
  /\b(book|schedule|appointment)\b/i,
]

function messageTriggersLead(content: string): boolean {
  return LEAD_TRIGGER_PATTERNS.some((re) => re.test(content))
}

// ─── Typing delay: proportional to response length, bounded 800–2000ms ───────

function typingDelay(text: string): number {
  const wordCount = text.split(/\s+/).length
  return Math.min(2000, Math.max(800, wordCount * 50))
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DemoPage(): JSX.Element {
  const params = useParams()
  const uuid = typeof params.uuid === 'string' ? params.uuid : ''

  // Session state
  const [session, setSession] = useState<SessionMeta | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [sessionError, setSessionError] = useState<string | null>(null)

  // Message state
  const [messages, setMessages] = useState<Message[]>([])
  const [isTyping, setIsTyping] = useState(false)

  // Proactive greeting — fires after 30s if user hasn't sent any messages
  const [proactiveShown, setProactiveShown] = useState(false)

  // Contextual quick-reply suggestions shown after the last assistant message
  const [suggestions, setSuggestions] = useState<string[]>([])

  // Lead capture state
  const [showLeadCapture, setShowLeadCapture] = useState(false)
  const [leadCaptured, setLeadCaptured] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ─── Load session + history ─────────────────────────────────────────────

  useEffect(() => {
    if (!uuid) return

    async function loadSession(): Promise<void> {
      try {
        const [sessionRes, historyRes] = await Promise.all([
          fetch(`/api/demo?uuid=${uuid}`),
          fetch(`/api/chat?sessionId=${uuid}`),
        ])

        if (!sessionRes.ok) {
          setSessionError(
            sessionRes.status === 404
              ? 'Demo session not found. This link may have expired.'
              : 'Failed to load demo session.'
          )
          return
        }

        const sessionData = (await sessionRes.json()) as SessionMeta
        setSession(sessionData)

        if (historyRes.ok) {
          const historyData = (await historyRes.json()) as { messages: Message[] }
          setMessages(historyData.messages)
        }
      } catch (err) {
        console.warn('Demo session load failed', err)
        setSessionError('Failed to load demo session. Please try again.')
      } finally {
        setSessionLoading(false)
      }
    }

    void loadSession()
  }, [uuid])

  // ─── Proactive greeting: fires after 30s if no user messages yet ────────

  useEffect(() => {
    // Only arm the timer once the session has loaded successfully
    if (sessionLoading || sessionError || !session || proactiveShown) return

    const timer = setTimeout(() => {
      setMessages((prev) => {
        // If user has sent any messages by now, abort
        if (prev.some((m) => m.role === 'user')) return prev

        const name = session.businessName ?? 'This Business'
        const greetingContent =
          `Hi! I'm the AI receptionist for ${name}. Is there anything I can help you with today?`

        setProactiveShown(true)
        setSuggestions(suggestReplies(greetingContent, 0))

        return [
          ...prev,
          {
            id: `proactive-${Date.now()}`,
            role: 'assistant' as const,
            content: greetingContent,
            createdAt: new Date().toISOString(),
          },
        ]
      })
    }, 30000)

    return () => clearTimeout(timer)
  // session object identity changes on every render — use specific fields
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, sessionError, session?.sessionId, proactiveShown])

  // ─── Auto-scroll to latest message ─────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping, showLeadCapture])

  // ─── Lead capture trigger: after 5 user messages with no lead captured ──

  useEffect(() => {
    if (leadCaptured || showLeadCapture) return
    const userMsgCount = messages.filter((m) => m.role === 'user').length
    if (userMsgCount >= 5) {
      setShowLeadCapture(true)
    }
  }, [messages, leadCaptured, showLeadCapture])

  // ─── Clear suggestions when user starts typing ──────────────────────────

  const handleTyping = useCallback(() => {
    setSuggestions([])
  }, [])

  // ─── Send message ───────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string): Promise<void> => {
      if (!text.trim() || isTyping || !session) return

      const trimmed = text.trim()

      // Clear suggestions immediately
      setSuggestions([])

      // Optimistic user message
      const userMessage: Message = {
        id: `temp-user-${Date.now()}`,
        role: 'user',
        content: trimmed,
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, userMessage])
      setIsTyping(true)

      // Check if user message should trigger lead capture
      if (!leadCaptured && !showLeadCapture && messageTriggersLead(trimmed)) {
        setShowLeadCapture(true)
      }

      // Run API call immediately — typing delay enforced after response arrives
      let apiReply: string | null = null
      let apiMessageId: string | null = null
      let apiTriggerLead = false
      let apiError: string | null = null

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: uuid, message: trimmed }),
        })

        if (!res.ok) {
          const errData = (await res.json()) as { error?: string }
          apiError = errData.error ?? 'Sorry, something went wrong. Please try again.'
        } else {
          const data = (await res.json()) as {
            reply: string
            messageId: string
            triggerLeadCapture?: boolean
          }
          apiReply = data.reply
          apiMessageId = data.messageId
          apiTriggerLead = data.triggerLeadCapture === true
        }
      } catch (err) {
        console.warn('Chat API request failed', err)
        apiError = 'Sorry, I had trouble connecting. Please try again.'
      }

      // Enforce minimum typing indicator duration (proportional to reply length)
      const delay = apiReply ? typingDelay(apiReply) : 800
      await new Promise<void>((resolve) => setTimeout(resolve, delay))

      setIsTyping(false)

      if (apiError !== null) {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'assistant' as const,
            content: apiError!,
            isError: true,
            retryText: trimmed,
            createdAt: new Date().toISOString(),
          },
        ])
      } else if (apiReply !== null && apiMessageId !== null) {
        const reply = apiReply
        const msgId = apiMessageId
        setMessages((prev) => {
          const updated: Message[] = [
            ...prev,
            {
              id: msgId,
              role: 'assistant' as const,
              content: reply,
              createdAt: new Date().toISOString(),
            },
          ]
          const assistantCount = updated.filter((m) => m.role === 'assistant').length
          setSuggestions(suggestReplies(reply, assistantCount))
          return updated
        })

        // Honour backend signal to trigger lead capture
        if (apiTriggerLead && !leadCaptured && !showLeadCapture) {
          setShowLeadCapture(true)
        }
      }
    },
    [isTyping, session, uuid, leadCaptured, showLeadCapture]
  )

  // ─── Retry a failed message ─────────────────────────────────────────────

  const retryMessage = useCallback(
    (failedMsgId: string, retryText: string): void => {
      setMessages((prev) => prev.filter((m) => m.id !== failedMsgId))
      void sendMessage(retryText)
    },
    [sendMessage]
  )

  // ─── Lead capture submission ────────────────────────────────────────────

  const handleLeadSubmit = useCallback(
    async (lead: LeadData): Promise<void> => {
      setLeadCaptured(true)
      setShowLeadCapture(false)

      try {
        await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: uuid,
            name: lead.name,
            contact: lead.email ?? lead.phone ?? '',
          }),
        })
      } catch (err) {
        // Best-effort — lead capture failure is non-fatal
        console.debug('Lead capture submission failed (non-fatal)', err)
      }

      // Return focus to message input
      inputRef.current?.focus()
    },
    [uuid]
  )

  const handleLeadDismiss = useCallback((): void => {
    setShowLeadCapture(false)
    setLeadCaptured(true) // Prevent re-triggering
    inputRef.current?.focus()
  }, [])

  // ─── Loading state ──────────────────────────────────────────────────────

  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div
            className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent"
            aria-hidden="true"
          />
          <p className="text-sm text-gray-500" aria-live="polite">
            Loading demo...
          </p>
        </div>
      </div>
    )
  }

  // ─── 404 / Error state ──────────────────────────────────────────────────

  if (sessionError || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div
          role="alert"
          className="max-w-md rounded-xl border border-red-200 bg-white p-8 text-center shadow-card"
        >
          <div
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-400"
            aria-hidden="true"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-800">Demo not found</h2>
          <p className="mt-1 text-sm text-gray-500">
            {sessionError ?? 'This demo link may have expired or is invalid.'}
          </p>
        </div>
      </div>
    )
  }

  // ─── Derived state ──────────────────────────────────────────────────────

  const businessName = session.businessName ?? 'This Business'
  const hasMessages = messages.length > 0

  const welcomeMessage = businessName === 'This Business'
    ? "Hi! I'm Clara, an AI receptionist. Ask me about this business's hours, services, and how to book."
    : `Hi! I'm Clara, the AI receptionist for ${businessName}. Ask me about hours, services, pricing, or how to book an appointment.`

  // ─── Main layout ────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col bg-gray-50"
      style={{ height: '100dvh' }}
    >
      {/* Zone 1: Demo Banner (fixed top) */}
      <DemoBanner businessName={businessName} />

      {/* Zone 2: Chat Header */}
      <ChatHeader
        businessName={businessName}
        status={isTyping ? 'connecting' : 'online'}
      />

      {/* Zone 3: Chat Area (scrollable) */}
      <main
        className="flex-1 overflow-y-auto px-4 py-6"
        style={{
          // Smooth scroll on iOS
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div
          id="message-log"
          role="log"
          aria-live="polite"
          aria-label="Conversation with Clara"
          aria-atomic="false"
          className="mx-auto max-w-2xl space-y-4"
        >
          {/* Welcome message (before any messages, including proactive) */}
          {!hasMessages && (
            <MessageBubble
              role="assistant"
              content={welcomeMessage}
            />
          )}

          {/* Starter chips — unmounted (not just hidden) after first message */}
          {!hasMessages && (
            <StarterChips
              onSelect={(chip) => void sendMessage(chip)}
              disabled={isTyping}
            />
          )}

          {/* Message thread */}
          {messages.map((msg, idx) => {
            const isLast = idx === messages.length - 1
            const isLastAssistant = isLast && msg.role === 'assistant'
            const isProactive = msg.id.startsWith('proactive-')

            return (
              <div
                key={msg.id}
                className={isProactive ? 'animate-fade-in' : undefined}
              >
                <MessageBubble
                  role={msg.role}
                  content={msg.content}
                  timestamp={msg.createdAt}
                  isError={msg.isError}
                  onRetry={
                    msg.isError && msg.retryText
                      ? () => retryMessage(msg.id, msg.retryText!)
                      : undefined
                  }
                />

                {/* Contextual suggestion chips after last assistant message */}
                {isLastAssistant && !isTyping && suggestions.length > 0 && (
                  <div className="mt-2">
                    <StarterChips
                      chips={suggestions}
                      onSelect={(chip) => void sendMessage(chip)}
                      disabled={isTyping}
                    />
                  </div>
                )}
              </div>
            )
          })}

          {/* Typing indicator — only mounted while waiting */}
          {isTyping && <TypingIndicator />}

          {/* Lead capture card — slides into thread */}
          {showLeadCapture && (
            <LeadCaptureCard
              onSubmit={(lead) => void handleLeadSubmit(lead)}
              onDismiss={handleLeadDismiss}
              businessName={businessName}
            />
          )}

          {/* Auto-scroll anchor */}
          <div ref={messagesEndRef} aria-hidden="true" />
        </div>
      </main>

      {/* Zone 4: Message Input Bar (fixed bottom) */}
      <div
        className="border-t border-gray-200 bg-white px-4 py-3"
        style={{
          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        }}
      >
        <div className="mx-auto max-w-2xl">
          <MessageInput
            onSend={(msg) => void sendMessage(msg)}
            disabled={isTyping || !session}
            onTyping={handleTyping}
          />
        </div>
      </div>

      {/* Zone 5: Demo Footer */}
      <div
        className="border-t border-gray-100 bg-white px-4 py-2 text-center"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <p className="text-xs text-gray-400">
          Want this for your business?{' '}
          <a
            href="mailto:hello@clara.ai"
            className="font-medium text-brand-600 hover:text-brand-700 hover:underline"
            aria-label="Contact Clara to get your own AI receptionist"
          >
            Get in touch
          </a>
        </p>
      </div>
    </div>
  )
}
