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
})
