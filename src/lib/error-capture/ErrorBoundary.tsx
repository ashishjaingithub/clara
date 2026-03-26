'use client'

/**
 * ErrorBoundary — React error boundary that captures render errors
 * and reports them to the local error collector endpoint.
 *
 * Usage (in layout.tsx):
 *   import { ErrorBoundary } from '@/lib/error-capture/ErrorBoundary'
 *   <ErrorBoundary project="clara">{children}</ErrorBoundary>
 *
 * Dev-only: only POSTs to the collector in development mode.
 * In production, shows the fallback UI but does not POST.
 */

import React, { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  project: string
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorId: string | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, errorId: null }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const errorId = `err_${Math.floor(Date.now() / 1000)}_${Math.random().toString(16).slice(2, 8)}`
    this.setState({ errorId })

    // Only report in development
    if (process.env.NODE_ENV !== 'production') {
      this.reportError(error, errorInfo, errorId)
    }
  }

  private async reportError(error: Error, errorInfo: ErrorInfo, errorId: string): Promise<void> {
    try {
      const event = {
        id: errorId,
        timestamp: new Date().toISOString(),
        project: this.props.project,
        source: 'ui' as const,
        severity: 'P2' as const,
        status: 'detected' as const,
        error: {
          message: error.message,
          type: error.name || 'Error',
          stack: (error.stack || '').slice(0, 5000),
          file: this.extractFileFromStack(error.stack),
        },
        context: {
          url: typeof window !== 'undefined' ? window.location.pathname : '',
          component: errorInfo.componentStack
            ? this.extractComponentName(errorInfo.componentStack)
            : 'Unknown',
          action: 'component-render',
          componentStack: (errorInfo.componentStack || '').slice(0, 2000),
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

  private extractFileFromStack(stack?: string): string | undefined {
    if (!stack) return undefined
    const match = stack.match(/at\s+\S+\s+\((.+?):\d+:\d+\)/)
    if (match) return match[1]
    const match2 = stack.match(/\((.+?):\d+:\d+\)/)
    return match2?.[1]
  }

  private extractComponentName(componentStack: string): string {
    const match = componentStack.match(/^\s+at\s+(\w+)/)
    return match?.[1] || 'Unknown'
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorId: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
          color: '#666',
        }}>
          <h2 style={{ color: '#333', marginBottom: '0.5rem' }}>Something went wrong</h2>
          <p style={{ marginBottom: '1rem' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          {this.state.errorId && (
            <p style={{ fontSize: '0.75rem', color: '#999', marginBottom: '1rem' }}>
              Error ID: {this.state.errorId}
            </p>
          )}
          <button
            onClick={this.handleRetry}
            style={{
              padding: '0.5rem 1.5rem',
              borderRadius: '0.375rem',
              border: '1px solid #ddd',
              background: '#fff',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Try Again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
