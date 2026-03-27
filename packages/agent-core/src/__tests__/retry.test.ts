import { describe, it, expect, vi } from 'vitest'
import { withRetry } from '../utils/retry.js'

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on 429 and succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce({ response: { status: 429 } })
      .mockResolvedValue('ok')
    const result = await withRetry(fn, { baseDelayMs: 0 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('retries on 500 and succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce({ response: { status: 503 } })
      .mockResolvedValue('done')
    const result = await withRetry(fn, { baseDelayMs: 0 })
    expect(result).toBe('done')
  })

  it('does not retry on 400 (non-retryable)', async () => {
    const fn = vi.fn().mockRejectedValue({ response: { status: 400 } })
    await expect(withRetry(fn, { baseDelayMs: 0 })).rejects.toMatchObject({
      response: { status: 400 },
    })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('throws after maxAttempts exhausted', async () => {
    const fn = vi.fn().mockRejectedValue({ response: { status: 429 } })
    await expect(withRetry(fn, { maxAttempts: 2, baseDelayMs: 0 })).rejects.toMatchObject({
      response: { status: 429 },
    })
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('calls onRetry with attempt info', async () => {
    const onRetry = vi.fn()
    const fn = vi
      .fn()
      .mockRejectedValueOnce({ response: { status: 429 } })
      .mockResolvedValue('ok')
    await withRetry(fn, { baseDelayMs: 0, onRetry })
    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 1 }),
    )
  })

  it('respects custom retryOn predicate', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('custom'))
      .mockResolvedValue('ok')
    const result = await withRetry(fn, {
      baseDelayMs: 0,
      retryOn: (err) => (err as Error).message === 'custom',
    })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
