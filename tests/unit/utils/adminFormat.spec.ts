import { describe, it, expect } from 'vitest'
import { fmtDateTime, fmtDay, shortId, pct, prettyJson } from '@/utils/adminFormat'

describe('adminFormat', () => {
    it('shows a dash for missing or invalid dates', () => {
        expect(fmtDateTime(null, 'en')).toBe('–')
        expect(fmtDateTime('not a date', 'en')).toBe('–')
        expect(fmtDay(undefined, 'en')).toBe('–')
    })

    it('formats dates in Taiwan time', () => {
        // 2026-10-16 17:30 UTC is already the 17th in Taipei (+8)
        expect(fmtDay('2026-10-16T17:30:00Z', 'en')).toContain('17')
        expect(fmtDateTime('2026-10-16T17:30:00Z', 'en')).toContain('01:30')
    })

    it('shortens ids', () => {
        expect(shortId('0123456789abcdef')).toBe('01234567')
        expect(shortId(null)).toBe('–')
    })

    it('computes whole-number percentages without dividing by zero', () => {
        expect(pct(1, 3)).toBe(33)
        expect(pct(2, 3)).toBe(67)
        expect(pct(5, 0)).toBe(0)
    })

    it('pretty-prints JSON and cuts very long values', () => {
        expect(prettyJson({ a: 1 })).toBe('{\n  "a": 1\n}')
        expect(prettyJson('plain')).toBe('plain')
        expect(prettyJson('x'.repeat(50), 10)).toBe('x'.repeat(10) + '…')
        expect(prettyJson(undefined)).toBe('')
    })
})
