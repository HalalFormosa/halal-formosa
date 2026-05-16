import { describe, it, expect } from 'vitest'
import { xpForLevel, getLevelFromPoints } from '@/utils/xp'

describe('xp', () => {
    describe('xpForLevel', () => {
        it('should return 0 for level 1 or below', () => {
            expect(xpForLevel(1)).toBe(0)
            expect(xpForLevel(0)).toBe(0)
            expect(xpForLevel(-5)).toBe(0)
        })
        it('should calculate correct XP for higher levels', () => {
            // Formula: Math.floor(0.5 * level * level * 2.5)
            expect(xpForLevel(2)).toBe(5) // 0.5 * 4 * 2.5 = 5
            expect(xpForLevel(3)).toBe(11) // 0.5 * 9 * 2.5 = 11.25 -> 11
            expect(xpForLevel(10)).toBe(125) // 0.5 * 100 * 2.5 = 125
        })
    })

    describe('getLevelFromPoints', () => {
        it('should return level 1 for 0 points', () => {
            expect(getLevelFromPoints(0)).toBe(1)
        })
        it('should calculate correct level for given points', () => {
            expect(getLevelFromPoints(4)).toBe(1)
            expect(getLevelFromPoints(5)).toBe(2)
            expect(getLevelFromPoints(10)).toBe(2)
            expect(getLevelFromPoints(11)).toBe(3)
            expect(getLevelFromPoints(125)).toBe(10)
            expect(getLevelFromPoints(126)).toBe(10) // Not enough for lvl 11
        })
    })
})
