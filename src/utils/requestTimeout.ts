// Timeout + one automatic retry for supabase-js queries, so a stalled request on
// a bad connection is aborted and retried instead of leaving a skeleton up forever.
//
//   withTimeoutRetry(signal => supabase.from('x').select().abortSignal(signal))

export const REQUEST_TIMEOUT_MS = 10000
export const TIMEOUT_ERROR_MESSAGE = 'Request timed out'

type Failure = { message?: string } | null

export type TimeoutResult<T> = { data: T | null; error: Failure; timedOut: boolean }

export interface TimeoutOptions {
  timeoutMs?: number
  /** Extra attempts after the first (default 1). */
  retries?: number
  /** Called right before a retry starts (e.g. to show a "slow connection" hint). */
  onRetry?: () => void
  isOnline?: () => boolean
}

const NETWORK_MESSAGE = /failed to fetch|networkerror|load failed|network request failed/i

const defaultIsOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false

export async function withTimeoutRetry<T>(
  run: (signal: AbortSignal) => PromiseLike<{ data: T | null; error: Failure }>,
  opts: TimeoutOptions = {}
): Promise<TimeoutResult<T>> {
  const timeoutMs = opts.timeoutMs ?? REQUEST_TIMEOUT_MS
  const retries = opts.retries ?? 1
  const isOnline = opts.isOnline ?? defaultIsOnline

  let last: TimeoutResult<T> = { data: null, error: { message: TIMEOUT_ERROR_MESSAGE }, timedOut: true }

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)

    try {
      const res = await run(controller.signal)
      if (timedOut) {
        last = { data: null, error: { message: TIMEOUT_ERROR_MESSAGE }, timedOut: true }
      } else if (!res.error) {
        return { data: res.data, error: null, timedOut: false }
      } else {
        last = { data: null, error: res.error, timedOut: false }
      }
    } catch (err) {
      const message = timedOut ? TIMEOUT_ERROR_MESSAGE : (err as Error)?.message
      last = { data: null, error: { message }, timedOut }
    } finally {
      clearTimeout(timer)
    }

    // Only transient failures are worth retrying (and only while online);
    // real API errors (RLS, bad query) would just fail again.
    const transient = last.timedOut || NETWORK_MESSAGE.test(last.error?.message ?? '')
    if (!transient || !isOnline() || attempt === retries) break
    opts.onRetry?.()
  }

  return last
}
