/**
 * Error collector route — /api/error-collector
 *
 * Receives error events from the client-side ErrorBoundary and error hooks,
 * writes them to .claude/logs/error-events.jsonl and .claude/logs/errors/clara.jsonl.
 *
 * DEV-ONLY: returns 404 if NODE_ENV === 'production'.
 */

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

function findRepoRoot(): string {
  if (process.env.MONOREPO_ROOT) return process.env.MONOREPO_ROOT

  let current = process.cwd()
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(current, '.claude'))) return current
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  return path.resolve(process.cwd(), '..')
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Dev-only guard
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const event = await request.json()

    // Basic validation
    if (!event || !event.error || !event.project) {
      return NextResponse.json(
        { error: 'Invalid event: requires error and project fields' },
        { status: 400 }
      )
    }

    // Ensure required fields
    const normalizedEvent = {
      id: event.id || `err_${Math.floor(Date.now() / 1000)}_${Math.random().toString(16).slice(2, 8)}`,
      timestamp: event.timestamp || new Date().toISOString(),
      project: event.project,
      source: event.source || 'ui',
      severity: event.severity || 'P2',
      status: event.status || 'detected',
      error: {
        message: String(event.error.message || '').slice(0, 500),
        type: event.error.type || 'Error',
        stack: String(event.error.stack || '').slice(0, 5000),
        ...(event.error.file && { file: event.error.file }),
        ...(event.error.line && { line: event.error.line }),
      },
      context: event.context || {},
      resolution: null,
    }

    // Write to JSONL
    const root = findRepoRoot()
    const logDir = path.join(root, '.claude', 'logs')
    const errorsDir = path.join(logDir, 'errors')

    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })
    if (!fs.existsSync(errorsDir)) fs.mkdirSync(errorsDir, { recursive: true })

    const line = JSON.stringify(normalizedEvent) + '\n'
    fs.appendFileSync(path.join(logDir, 'error-events.jsonl'), line, 'utf-8')
    fs.appendFileSync(path.join(errorsDir, `${normalizedEvent.project}.jsonl`), line, 'utf-8')

    return NextResponse.json({ id: normalizedEvent.id, status: 'recorded' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Health check
export async function GET(): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ status: 'ok', endpoint: 'error-collector', devOnly: true })
}
