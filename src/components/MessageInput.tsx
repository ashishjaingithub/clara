'use client'

import { useState } from 'react'

interface MessageInputProps {
  onSend: (message: string) => void
  disabled: boolean
  placeholder?: string
  onTyping?: () => void
}

export function MessageInput({
  onSend,
  disabled,
  placeholder = 'Type a message...',
  onTyping,
}: MessageInputProps): JSX.Element {
  const [value, setValue] = useState('')

  const canSend = value.trim().length > 0 && !disabled
  const hasText = value.length > 0

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    if (!canSend) return
    onSend(value.trim())
    setValue('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!canSend) return
      onSend(value.trim())
      setValue('')
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    setValue(e.target.value)
    if (e.target.value.length > 0) {
      onTyping?.()
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-3"
      aria-label="Message input"
    >
      <input
        data-testid="message-input"
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        aria-label="Message to Clara"
        autoComplete="off"
        style={{ fontSize: '16px' }}
        className="min-h-[44px] flex-1 rounded-full border border-gray-300 bg-gray-50 px-4 py-2.5 text-gray-900 placeholder-gray-400 outline-none transition-shadow focus:border-brand-400 focus:shadow-input focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <button
        data-testid="send-button"
        type="submit"
        disabled={!canSend}
        aria-label="Send message"
        className={[
          'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition-all hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50',
          hasText && !disabled ? 'shadow-[0_0_0_4px_rgba(79,70,229,0.2)] animate-pulse' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
        </svg>
      </button>
    </form>
  )
}
