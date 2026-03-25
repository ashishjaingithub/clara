'use client'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
  isError?: boolean
  onRetry?: () => void
}

function ClaraAvatar(): JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white"
    >
      C
    </div>
  )
}

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  return `${Math.floor(diff / 3600000)}h ago`
}

export function MessageBubble({
  role,
  content,
  timestamp,
  isError = false,
  onRetry,
}: MessageBubbleProps): JSX.Element {
  const isUser = role === 'user'

  const timestampEl = timestamp ? (
    <span className="mt-1 block text-right text-2xs text-gray-400 opacity-0 transition-opacity group-hover/bubble:opacity-100">
      {relativeTime(timestamp)}
    </span>
  ) : null

  // Error bubble styling
  if (isError) {
    return (
      <div
        data-testid="message-bubble"
        data-role={role}
        className="group/bubble flex gap-3"
        role="alert"
      >
        {!isUser && <ClaraAvatar />}
        <div className="max-w-[75%] sm:max-w-[85%]">
          <div
            className="rounded-chat rounded-tl-sm border border-error-border bg-error-bg px-4 py-3 text-sm leading-relaxed text-error-text shadow-bubble"
            aria-label={`Error: ${content}`}
          >
            <span aria-hidden="true" className="mr-1">⚠</span>
            {content}
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-1 text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline"
              aria-label="Retry sending message"
            >
              ↺ Retry
            </button>
          )}
          {timestampEl}
        </div>
      </div>
    )
  }

  // User bubble — right-aligned, brand indigo
  if (isUser) {
    return (
      <div
        data-testid="message-bubble"
        data-role="user"
        className="group/bubble flex flex-row-reverse gap-3"
      >
        <div className="max-w-[75%] sm:max-w-[85%]">
          <div className="rounded-chat rounded-tr-sm bg-brand-600 px-4 py-3 text-sm leading-relaxed text-white shadow-bubble">
            {content}
          </div>
          {timestampEl}
        </div>
      </div>
    )
  }

  // Assistant bubble — left-aligned, white
  return (
    <div
      data-testid="message-bubble"
      data-role="assistant"
      className="group/bubble flex gap-3"
    >
      <ClaraAvatar />
      <div className="max-w-[75%] sm:max-w-[85%]">
        <div className="rounded-chat rounded-tl-sm border border-gray-100 bg-white px-4 py-3 text-sm leading-relaxed text-gray-800 shadow-bubble">
          {content}
        </div>
        {timestampEl}
      </div>
    </div>
  )
}
