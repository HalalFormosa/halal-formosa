import { describe, it, expect } from 'vitest'
import { highlightIngredients } from '@/utils/useIngredientHighlighter'

describe('useIngredientHighlighter', () => {
    it('should highlight ingredients present in dictionary', () => {
        const text = 'Pork, Gelatin, Sugar, Salt'
        const dict = {
            'pork': '--ion-color-danger',
            'gelatin': '--ion-color-warning'
        }

        const res = highlightIngredients(text, dict, 'Halal')
        expect(res.length).toBe(4)
        expect(res[0].highlighted).toBe(true)
        expect(res[0].html).toContain('--ion-color-danger')
        expect(res[1].highlighted).toBe(true)
        expect(res[1].html).toContain('--ion-color-warning')
        expect(res[2].highlighted).toBe(false)
        expect(res[2].html).toBe('Sugar')
    })

    it('should downgrade Syubhah to Muslim-friendly when product status is Muslim-friendly', () => {
        const text = 'Soy Sauce'
        const dict = { 'soy sauce': '--ion-color-warning' }

        const res = highlightIngredients(text, dict, 'Muslim-friendly')
        expect(res[0].highlighted).toBe(true)
        expect(res[0].html).toContain('--ion-color-primary')
    })

    it('should match Chinese keywords and split on Chinese separators', () => {
        const dict = {
            '脂肪酸聚合甘油酯': '--ion-color-warning',
            '脂肪酸甘油[酯脂]': '--ion-color-warning'
        }

        const res = highlightIngredients('水、砂糖、脂肪酸聚合甘油酯，脂肪酸甘油脂', dict, 'Halal')
        expect(res.map(r => r.highlighted)).toEqual([false, false, true, true])
    })

    it('matches single-character Chinese keys only against the whole segment', () => {
        const dict = { '水': '--ion-color-primary' }

        const res = highlightIngredients('水、水解動物蛋白、水 70%、水（純水）、冰水', dict, 'Halal')
        expect(res.map(r => r.highlighted)).toEqual([true, false, true, true, false])
    })

    it('still applies longer Chinese keys inside a segment next to a single-character key', () => {
        const dict = { '水': '--ion-color-primary', '水解': '--ion-color-danger' }

        const res = highlightIngredients('水解動物蛋白', dict, 'Halal')
        expect(res[0].highlighted).toBe(true)
        expect(res[0].html).toContain('--ion-color-danger')
    })
})
