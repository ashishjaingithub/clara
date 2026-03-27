interface RetryOptions {
  maxAttempts?: number
  baseDelayMs?: number
  maxDelayMs?: number
  retryOn?: (err: unknown) => boolean
  onRetry?: (ctx: { attempt: number; delay: number; err: unknown }) => void
}

function isRetryableError(err: unknown): boolean {
  const e = err as { response?: { status?: number } } | undefined
  const status = e?.response?.status
  return status === 429 || (status !== undefined && status >= 500)
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 500,
    maxDelayMs = 10000,
    retryOn = isRetryableError,
    onRetry,
  } = options

  let lastErr: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (attempt === maxAttempts || !retryOn(err)) throw err
      const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs)
      const jitter = Math.random() * delay * 0.2
      onRetry?.({ attempt, delay: delay + jitter, err })
      await new Promise((r) => setTimeout(r, delay + jitter))
    }
  }
  throw lastErr
}
