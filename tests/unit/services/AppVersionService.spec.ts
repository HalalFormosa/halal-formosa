import { describe, it, expect } from 'vitest'
import { shouldReport } from '@/services/AppVersionService'

const base = { userId: 'u1', version: '2.0.1', build: '136' }
const HOUR = 60 * 60 * 1000

describe('AppVersionService.shouldReport', () => {
    it('reports when nothing has been reported yet', () => {
        expect(shouldReport(null, base)).toBe(true)
    })

    it('skips an identical report within 12 hours', () => {
        expect(shouldReport({ ...base, at: 1000 }, base, 1000 + 11 * HOUR)).toBe(false)
    })

    it('reports again once 12 hours have passed', () => {
        expect(shouldReport({ ...base, at: 1000 }, base, 1000 + 12 * HOUR)).toBe(true)
    })

    it('reports immediately on a new version, build or user', () => {
        const last = { ...base, at: 1000 }
        expect(shouldReport(last, { ...base, version: '2.0.2' }, 2000)).toBe(true)
        expect(shouldReport(last, { ...base, build: '137' }, 2000)).toBe(true)
        expect(shouldReport(last, { ...base, userId: 'u2' }, 2000)).toBe(true)
    })
})
