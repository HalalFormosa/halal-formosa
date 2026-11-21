import { describe, expect, it, vi } from 'vitest'
import { TIMEOUT_ERROR_MESSAGE, withTimeoutRetry } from '@/utils/requestTimeout'

const never = (signal: AbortSignal) =>
  new Promise<{ data: null; error: null }>((_, reject) =>
    signal.addEventListener('abort', () => reject(new Error('AbortError')))
  )

describe('withTimeoutRetry', () => {
  it('returns data on first success without retrying', async () => {
    const run = vi.fn().mockResolvedValue({ data: [1], error: null })
    const onRetry = vi.fn()
    const res = await withTimeoutRetry(run, { onRetry })
    expect(res).toEqual({ data: [1], error: null, timedOut: false })
    expect(run).toHaveBeenCalledTimes(1)
    expect(onRetry).not.toHaveBeenCalled()
  })

  it('aborts a stalled request and retries once', async () => {
    const run = vi.fn()
      .mockImplementationOnce(never)
      .mockResolvedValueOnce({ data: ['ok'], error: null })
    const onRetry = vi.fn()
    const res = await withTimeoutRetry(run, { timeoutMs: 20, onRetry })
    expect(res.data).toEqual(['ok'])
    expect(run).toHaveBeenCalledTimes(2)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('gives up after the retry and reports a timeout', async () => {
    const run = vi.fn().mockImplementation(never)
    const res = await withTimeoutRetry(run, { timeoutMs: 20 })
    expect(run).toHaveBeenCalledTimes(2)
    expect(res.timedOut).toBe(true)
    expect(res.error?.message).toBe(TIMEOUT_ERROR_MESSAGE)
  })

  it('does not retry real API errors', async () => {
    const run = vi.fn().mockResolvedValue({ data: null, error: { message: 'permission denied' } })
    const res = await withTimeoutRetry(run)
    expect(run).toHaveBeenCalledTimes(1)
    expect(res.error?.message).toBe('permission denied')
  })

  it('retries network errors, but not while offline', async () => {
    const netErr = { data: null, error: { message: 'Failed to fetch' } }
    const online = vi.fn().mockResolvedValue(netErr)
    await withTimeoutRetry(online, { isOnline: () => true })
    expect(online).toHaveBeenCalledTimes(2)

    const offline = vi.fn().mockResolvedValue(netErr)
    await withTimeoutRetry(offline, { isOnline: () => false })
    expect(offline).toHaveBeenCalledTimes(1)
  })
})
