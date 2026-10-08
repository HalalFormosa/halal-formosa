// Pure helpers for client-side error reporting (see src/plugins/clientErrorReporting.ts).

const MAX_MESSAGE = 300
const MAX_STACK = 500
const STACK_LINES = 4

/**
 * Error text can echo user input or secrets (an email in a validation message, a token in a URL), so it is
 * scrubbed before it is stored: emails, JWTs, long digit runs (phone / card / ids) and URL query strings.
 */
export function sanitizeErrorText(input: unknown, max = MAX_MESSAGE): string {
    let s = typeof input === 'string' ? input : String(input ?? '')
    s = s
        .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]')
        .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[token]')
        .replace(/(https?:\/\/[^\s?#)]+)[?#][^\s)]*/g, '$1?…')
        .replace(/\d{9,}/g, '[num]')
    return s.length > max ? s.slice(0, max) + '…' : s
}

export interface DescribedError {
    message: string
    name?: string
    stack?: string
}

/** Normalises whatever was thrown (Error, string, object, anything) into loggable text. */
export function describeError(input: unknown): DescribedError {
    if (input instanceof Error) {
        return {
            message: sanitizeErrorText(input.message),
            name: input.name,
            stack: input.stack
                ? sanitizeErrorText(input.stack.split('\n').slice(0, STACK_LINES).join('\n'), MAX_STACK)
                : undefined,
        }
    }
    if (input && typeof input === 'object') {
        const msg = (input as { message?: unknown }).message
        if (typeof msg === 'string') return { message: sanitizeErrorText(msg) }
        try {
            return { message: sanitizeErrorText(JSON.stringify(input)) }
        } catch {
            return { message: '[unserializable error]' }
        }
    }
    return { message: sanitizeErrorText(input) }
}

/**
 * Errors that carry no signal: browser quirks, cross-origin script noise, and plain connectivity or
 * cancelled-request failures (those are handled where they happen and would flood the log offline).
 */
export function isIgnorableError(message: string, name?: string): boolean {
    if (name === 'AbortError') return true
    const m = message.toLowerCase()
    return (
        m.includes('resizeobserver loop') ||
        m === 'script error.' ||
        m === 'script error' ||
        m.includes('non-error promise rejection') ||
        m.includes('failed to fetch') ||
        m.includes('networkerror') ||
        m.includes('network request failed') ||
        m.includes('load failed') ||
        m.includes('the operation was aborted') ||
        m.includes('aborterror')
    )
}

/** Short, stable id so the same bug groups together: message with digits collapsed + where it came from. */
export function errorSignature(message: string, source: string): string {
    const basis = `${source}|${message.replace(/\d+/g, '#').slice(0, 160)}`
    let h = 5381
    for (let i = 0; i < basis.length; i++) h = ((h << 5) + h + basis.charCodeAt(i)) | 0
    return (h >>> 0).toString(36)
}

/** Per-session limiter: each distinct error once, and a hard cap so a crash loop cannot flood the table. */
export function createErrorGate(maxPerSession = 10) {
    const seen = new Set<string>()
    return {
        shouldReport(signature: string): boolean {
            if (seen.has(signature)) return false
            if (seen.size >= maxPerSession) return false
            seen.add(signature)
            return true
        },
    }
}
