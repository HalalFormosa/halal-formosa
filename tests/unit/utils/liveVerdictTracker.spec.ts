import { describe, it, expect } from 'vitest'
import type { IngredientHighlight } from '@/types/Ingredient'
import { LiveHighlightTracker } from '@/utils/liveVerdictTracker'

const haram: IngredientHighlight = { keyword: 'pork', keyword_zh: '豬', color: '--ion-color-danger', matchedVariant: 'pork' }
const doubtful: IngredientHighlight = { keyword: 'carmine', keyword_zh: '', color: '--ion-color-warning', matchedVariant: 'carmine' }
const friendly: IngredientHighlight = { keyword: 'rice', keyword_zh: '米', color: '--ion-color-primary', matchedVariant: 'rice' }

describe('LiveHighlightTracker', () => {
    it('shows a highlight only after it is seen in consecutive frames', () => {
        const t = new LiveHighlightTracker()
        t.update([haram], 50, 0)
        expect(t.active(0)).toEqual([])
        t.update([haram], 50, 100)
        expect(t.active(100)).toEqual([haram])
    })

    it('drops a highlight once it has not been seen for the ttl', () => {
        const t = new LiveHighlightTracker({ ttlMs: 500 })
        t.update([haram], 50, 0)
        t.update([haram], 50, 100)
        expect(t.active(550)).toEqual([haram])
        expect(t.active(700)).toEqual([])
    })

    it('makes a stale match earn its way back in', () => {
        const t = new LiveHighlightTracker({ ttlMs: 500 })
        t.update([haram], 50, 0)
        t.update([haram], 50, 100)
        t.update([haram], 50, 2000)
        expect(t.active(2000)).toEqual([])
    })

    it('ranks Haram over Syubhah', () => {
        const t = new LiveHighlightTracker()
        for (const now of [0, 100]) t.update([doubtful, haram], 50, now)
        expect(t.verdict(100)).toBe('Haram')
    })

    it('reports Syubhah when only a doubtful ingredient is confirmed', () => {
        const t = new LiveHighlightTracker()
        for (const now of [0, 100]) t.update([doubtful], 50, now)
        expect(t.verdict(100)).toBe('Syubhah')
    })

    it('stays on scanning until enough text has been read, then defaults to Muslim-friendly', () => {
        const t = new LiveHighlightTracker()
        t.update([], 5, 0)
        expect(t.verdict(0)).toBe('scanning')
        for (const now of [100, 200, 300]) t.update([], 60, now)
        expect(t.verdict(300)).toBe('Muslim-friendly')
    })

    it('goes back to scanning when the text disappears', () => {
        const t = new LiveHighlightTracker({ ttlMs: 500 })
        for (const now of [0, 100, 200]) t.update([], 60, now)
        expect(t.verdict(200)).toBe('Muslim-friendly')
        expect(t.verdict(1000)).toBe('scanning')
    })

    it('lets a flagged ingredient override the Muslim-friendly default', () => {
        const t = new LiveHighlightTracker()
        for (const now of [0, 100, 200]) t.update([doubtful], 60, now)
        expect(t.verdict(200)).toBe('Syubhah')
    })

    it('does not let a primary-colour dictionary match change the verdict', () => {
        const t = new LiveHighlightTracker()
        for (const now of [0, 100]) t.update([friendly], 5, now)
        expect(t.verdict(100)).toBe('scanning')
    })
})
