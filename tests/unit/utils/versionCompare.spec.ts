import { describe, it, expect } from 'vitest'
import { compareVersions, isBelowMinimum, latestVersion } from '@/utils/versionCompare'

describe('compareVersions', () => {
    it('compares numerically, not as text', () => {
        expect(compareVersions('2.0.10', '2.0.9')).toBe(1)
        expect(compareVersions('1.9.2', '2.0.0')).toBe(-1)
        expect(compareVersions('2.0.1', '2.0.1')).toBe(0)
    })

    it('treats missing parts as zero', () => {
        expect(compareVersions('2.0', '2.0.0')).toBe(0)
        expect(compareVersions('1.3.8.1', '1.3.8')).toBe(1)
        expect(compareVersions('2', '2.0.1')).toBe(-1)
    })
})

describe('isBelowMinimum', () => {
    it('flags only versions older than the minimum', () => {
        expect(isBelowMinimum('2.0.0', '2.0.1')).toBe(true)
        expect(isBelowMinimum('2.0.1', '2.0.1')).toBe(false)
        expect(isBelowMinimum('2.1.0', '2.0.1')).toBe(false)
    })

    it('blocks nobody when there is no minimum', () => {
        expect(isBelowMinimum('0.1', null)).toBe(false)
        expect(isBelowMinimum('0.1', '')).toBe(false)
        expect(isBelowMinimum('0.1', undefined)).toBe(false)
    })
})

describe('latestVersion', () => {
    it('picks the newest and handles empty lists', () => {
        expect(latestVersion(['1.9.2', '2.0.1', '2.0.0', '1.10.0'])).toBe('2.0.1')
        expect(latestVersion(['1.9.2', '1.10.0'])).toBe('1.10.0')
        expect(latestVersion([])).toBeNull()
    })
})
