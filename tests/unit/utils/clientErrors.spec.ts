import { describe, it, expect } from 'vitest'
import { createErrorGate, describeError, errorSignature, isIgnorableError, sanitizeErrorText } from '@/utils/clientErrors'

describe('clientErrors', () => {
    describe('sanitizeErrorText', () => {
        it('scrubs emails, tokens, long numbers and URL query strings', () => {
            const out = sanitizeErrorText(
                'Invalid login for rakha@example.com token eyJhbGciOi.eyJzdWIiOiIx.SflKxwRJSMeKKF phone 0912345678 at https://x.co/a/b?access_token=secret&x=1#frag'
            )
            expect(out).not.toContain('rakha@example.com')
            expect(out).not.toContain('eyJhbGciOi')
            expect(out).not.toContain('0912345678')
            expect(out).not.toContain('access_token')
            expect(out).toContain('[email]')
            expect(out).toContain('[token]')
            expect(out).toContain('[num]')
            expect(out).toContain('https://x.co/a/b?…')
        })

        it('keeps short numbers and truncates long text', () => {
            expect(sanitizeErrorText('line 42 col 7')).toBe('line 42 col 7')
            const long = sanitizeErrorText('x'.repeat(1000))
            expect(long.length).toBe(301)
            expect(long.endsWith('…')).toBe(true)
        })
    })

    describe('describeError', () => {
        it('reads an Error, keeping only the top of the stack', () => {
            const e = new TypeError('boom')
            e.stack = ['TypeError: boom', 'a', 'b', 'c', 'd', 'e'].join('\n')
            const d = describeError(e)
            expect(d).toMatchObject({ message: 'boom', name: 'TypeError' })
            expect(d.stack?.split('\n')).toHaveLength(4)
        })

        it('copes with strings, plain objects and odd values', () => {
            expect(describeError('plain').message).toBe('plain')
            expect(describeError({ message: 'obj msg' }).message).toBe('obj msg')
            expect(describeError({ a: 1 }).message).toBe('{"a":1}')
            expect(describeError(undefined).message).toBe('')
            const circular: any = {}
            circular.self = circular
            expect(describeError(circular).message).toBe('[unserializable error]')
        })
    })

    describe('isIgnorableError', () => {
        it('ignores browser noise and connectivity failures', () => {
            for (const m of [
                'ResizeObserver loop completed with undelivered notifications.',
                'Script error.',
                'Failed to fetch',
                'NetworkError when attempting to fetch resource.',
                'Load failed',
                'Non-Error promise rejection captured with value: x',
            ]) expect(isIgnorableError(m)).toBe(true)
            expect(isIgnorableError('anything', 'AbortError')).toBe(true)
        })

        it('keeps real errors', () => {
            expect(isIgnorableError("Cannot read properties of undefined (reading 'id')")).toBe(false)
        })
    })

    describe('errorSignature', () => {
        it('is stable, ignores digits, and differs by message or source', () => {
            const a = errorSignature('Cannot read item 12', 'vue')
            expect(errorSignature('Cannot read item 99', 'vue')).toBe(a)
            expect(errorSignature('Cannot read item 12', 'promise')).not.toBe(a)
            expect(errorSignature('Something else', 'vue')).not.toBe(a)
        })
    })

    describe('createErrorGate', () => {
        it('lets each signature through once and caps the session', () => {
            const gate = createErrorGate(3)
            expect(gate.shouldReport('a')).toBe(true)
            expect(gate.shouldReport('a')).toBe(false)
            expect(gate.shouldReport('b')).toBe(true)
            expect(gate.shouldReport('c')).toBe(true)
            expect(gate.shouldReport('d')).toBe(false) // cap reached
        })
    })
})
