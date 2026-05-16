import { describe, it, expect } from 'vitest'
import { getLevelLabel, getLevelColor } from '@/composables/useLevels'

describe('useLevels', () => {
    it('should return level label', () => {
        expect(getLevelLabel(50)).toContain('Level')
    })
    it('should return level color based on tier', () => {
        expect(getLevelColor(0)).toBe('medium') // Level 1 < 10
        expect(getLevelColor(500)).toBe('primary') // Level 20 < 50
        expect(getLevelColor(5000)).toBe('success') // Level 63 < 100
        expect(getLevelColor(50000)).toBe('warning') // Level 200 >= 100
    })
})
