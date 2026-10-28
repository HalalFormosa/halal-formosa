import { describe, it, expect } from 'vitest'
import type { IngredientHighlight } from '@/types/Ingredient'
import { LiveHighlightTracker } from '@/utils/liveVerdictTracker'

const haram: IngredientHighlight = { keyword: 'pork', keyword_zh: '豬', color: '--ion-color-danger', matchedVariant: 'pork' }
const doubtful: IngredientHighlight = { keyword: 'carmine', keyword_zh: '', color: '--ion-color-warning', matchedVariant: 'carmine' }
const friendly: IngredientHighlight = { keyword: 'rice', keyword_zh: '米', color: '--ion-color-primary', matchedVariant: 'rice' }

describe('LiveHighlightTracker', () => {
    it('shows a highlight only after it is seen in consecutive frames', () => {
        const t = new LiveHighlightTracker()
        t.update([haram], 0)
        expect(t.active(0)).toEqual([])
        t.update([haram], 100)
        expect(t.active(100)).toEqual([haram])
    })

    it('drops a highlight once it has not been seen for the ttl', () => {
        const t = new LiveHighlightTracker({ ttlMs: 500 })
        t.update([haram], 0)
        t.update([haram], 100)
        expect(t.active(550)).toEqual([haram])
        expect(t.active(700)).toEqual([])
    })

    it('makes a stale match earn its way back in', () => {
        const t = new LiveHighlightTracker({ ttlMs: 500 })
        t.update([haram], 0)
        t.update([haram], 100)
        t.update([haram], 2000)
        expect(t.active(2000)).toEqual([])
    })

    it('ranks Haram over Syubhah', () => {
        const t = new LiveHighlightTracker()
        for (const now of [0, 100]) t.update([doubtful, haram], now)
        expect(t.verdict(100)).toBe('Haram')
    })

    it('reports Syubhah when only a doubtful ingredient is confirmed', () => {
        const t = new LiveHighlightTracker()
        for (const now of [0, 100]) t.update([doubtful], now)
        expect(t.verdict(100)).toBe('Syubhah')
    })

    it('never reports a clear verdict: no flagged ingredient means still scanning', () => {
        const t = new LiveHighlightTracker()
        for (const now of [0, 100, 200, 300]) t.update([], now)
        expect(t.verdict(300)).toBe('scanning')
    })

    it('does not let a Muslim-friendly (primary) match change the verdict', () => {
        const t = new LiveHighlightTracker()
        for (const now of [0, 100]) t.update([friendly], now)
        expect(t.verdict(100)).toBe('scanning')
    })
})
