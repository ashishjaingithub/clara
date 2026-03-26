'use client'

/**
 * useErrorCapture — Client-side hook that registers global error handlers
 * to capture uncaught exceptions and unhandled promise rejections.
 *
 * Usage (in layout.tsx or a top-level client component):
 *   import { useErrorCapture } from '@/lib/error-capture/error-hooks'
 *   function ErrorCapture() {
 *     useErrorCapture('clara')
 *     return null
 *   }
 *
 * Dev-only: only active when NODE_ENV !== 'production'.
 *
 * Captures:
 * - window.onerror (uncaught exceptions)
 * - unhandledrejection (unhandled promise rejections)
 * - Deduplicates: same error message within 5 seconds = 1 event
 */

import { useEffect, useRef } from 'react'

const DEDUP_WINDOW_MS = 5000

function generateErrorId(): string {
  const ts = Math.floor(Date.now() / 1000)
  const hex = Math.random().toString(16).slice(2, 8)
  return `err_${ts}_${hex}`
}

async function reportError(
  project: string,
  error: { message: string; type: string; stack: string; file?: string; line?: number },
  context: Record<string, unknown> = {}
): Promise<void> {
  try {
    const event = {
      id: generateErrorId(),
      timestamp: new Date().toISOString(),
      project,
      source: 'ui' as const,
      severity: 'P2' as const,
      status: 'detected' as const,
      error,
      context: {
        url: window.location.pathname,
        ...context,
      },
      resolution: null,
    }

    await fetch('/api/error-collector', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    })
  } catch (err) {
    console.error('Error reporting failed:', err)
  }
}

export function useErrorCapture(project: string): void {
  const recentErrors = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    // Only capture in development
    if (process.env.NODE_ENV === 'production') return

    function isDuplicate(message: string): boolean {
      const now = Date.now()
      const lastSeen = recentErrors.current.get(message)
      if (lastSeen && now - lastSeen < DEDUP_WINDOW_MS) {
        return true
      }
      recentErrors.current.set(message, now)
      // Clean old entries
      for (const [key, ts] of recentErrors.current.entries()) {
        if (now - ts > DEDUP_WINDOW_MS * 2) {
          recentErrors.current.delete(key)
        }
      }
      return false
    }

    function handleError(event: ErrorEvent): void {
      const message = event.message || 'Unknown error'
      if (isDuplicate(message)) return

      reportError(project, {
        message,
        type: 'UncaughtException',
        stack: event.error?.stack || '',
        file: event.filename,
        line: event.lineno,
      }, {
        action: 'uncaught-exception',
        colno: event.colno,
      })
    }

    function handleRejection(event: PromiseRejectionEvent): void {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
      const message = error.message || 'Unhandled promise rejection'
      if (isDuplicate(message)) return

      reportError(project, {
        message,
        type: 'UnhandledRejection',
        stack: error.stack || '',
      }, {
        action: 'unhandled-rejection',
      })
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [project])
}
