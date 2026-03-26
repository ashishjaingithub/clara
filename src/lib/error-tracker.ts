/**
 * Error Tracker — writes structured error events to factory logs.
 *
 * Writes to:
 *   - .claude/logs/error-events.jsonl (factory-wide)
 *   - .claude/logs/errors/clara.jsonl (project-specific)
 *
 * Always-on for Iterate phase (Clara handles real prospect data and needs visibility).
 * Safe in production: writes are fire-and-forget, never throws, never blocks.
 */

import fs from 'fs'
import path from 'path'
import { classifyError } from './errors'

interface ErrorContext {
  /** What operation was being performed */
  operation?: string
  /** Additional metadata */
  [key: string]: unknown
}

interface ErrorEvent {
  id: string
  timestamp: string
  project: 'clara'
  source: 'server'
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'detected'
  error: {
    message: string
    type: string
    code: string
    statusCode: number
    retryable: boolean
    stack?: string
  }
  context: ErrorContext
  resolution: null
}

function generateErrorId(): string {
  const ts = Math.floor(Date.now() / 1000)
  const hex = Math.random().toString(16).slice(2, 8)
  return `err_${ts}_${hex}`
}

function findRepoRoot(): string {
  // Try MONOREPO_ROOT env var first
  if (process.env.MONOREPO_ROOT) return process.env.MONOREPO_ROOT

  // Walk up from cwd looking for .claude/
  let current = process.cwd()
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(current, '.claude'))) return current
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  // Fallback: Clara lives one level below the workspace root
  return path.resolve(process.cwd(), '..')
}

let repoRoot: string | null = null

function getRepoRoot(): string {
  if (!repoRoot) repoRoot = findRepoRoot()
  return repoRoot
}

/**
 * Track an error by writing it to factory JSONL logs.
 * Never throws — logging failures are silently ignored.
 */
export function trackError(error: unknown, context: ErrorContext = {}): void {
  try {
    const classification = classifyError(error)
    const isError = error instanceof Error

    const event: ErrorEvent = {
      id: generateErrorId(),
      timestamp: new Date().toISOString(),
      project: 'clara',
      source: 'server',
      severity: classification.severity,
      status: 'detected',
      error: {
        message: isError ? error.message : String(error),
        type: isError ? error.constructor.name : 'UnknownError',
        code: classification.code,
        statusCode: classification.statusCode,
        retryable: classification.retryable,
        stack: isError ? error.stack : undefined,
      },
      context,
      resolution: null,
    }

    const root = getRepoRoot()
    const logDir = path.join(root, '.claude', 'logs')
    const errorsDir = path.join(logDir, 'errors')

    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })
    if (!fs.existsSync(errorsDir)) fs.mkdirSync(errorsDir, { recursive: true })

    const line = JSON.stringify(event) + '\n'
    fs.appendFileSync(path.join(logDir, 'error-events.jsonl'), line, 'utf-8')
    fs.appendFileSync(path.join(errorsDir, 'clara.jsonl'), line, 'utf-8')
  } catch (err) {
    // Never let error tracking crash the app
    console.debug('Error tracker failed to write event', err)
  }
}
