'use client'

export function TypingIndicator(): JSX.Element {
  return (
    <div
      data-testid="typing-indicator"
      className="flex gap-3"
      aria-label="Clara is typing"
      aria-live="polite"
    >
      {/* Clara avatar */}
      <div
        aria-hidden="true"
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white"
      >
        C
      </div>

      {/* Bubble with animated dots */}
      <div className="rounded-chat rounded-tl-sm border border-gray-100 bg-white px-4 py-3 shadow-bubble">
        <div className="flex items-center gap-1" role="presentation">
          <span
            className="h-2 w-2 animate-typing-1 rounded-full bg-gray-400"
            aria-hidden="true"
          />
          <span
            className="h-2 w-2 animate-typing-2 rounded-full bg-gray-400"
            aria-hidden="true"
          />
          <span
            className="h-2 w-2 animate-typing-3 rounded-full bg-gray-400"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  )
}
