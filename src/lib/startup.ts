/**
 * Production startup checks.
 * Import this at the top of src/app/layout.tsx (server component) so it runs on every cold start.
 * In non-production environments, checks are skipped or warn-only.
 */
export function checkProductionEnv(): void {
  if (process.env.NODE_ENV !== 'production') return
  // Skip during `next build` — env vars are only available at runtime, not build time
  if (process.env.NEXT_PHASE === 'phase-production-build') return

  const required = [
    'GROQ_API_KEY',
    'LANGSMITH_API_KEY',
    'CLARA_OPERATOR_API_KEY',
    'NEXT_PUBLIC_BASE_URL',
  ] as const

  for (const key of required) {
    if (!process.env[key]) {
      console.error(`[Clara] ${key} is required in production`)
      process.exit(1)
    }
  }

  if (process.env.LANGSMITH_TRACING !== 'true') {
    console.error('[Clara] LANGSMITH_TRACING=true is required in production')
    process.exit(1)
  }
}
