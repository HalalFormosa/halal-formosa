import { describe, it, expect } from 'vitest'
import {
    buildScanDecisionDetail,
    buildScanDecisionShownDetail,
    flaggedIngredientNames,
    FLAGGED_INGREDIENTS_MAX,
    FLAGGED_INGREDIENT_MAX_LENGTH,
} from '@/utils/scanDecisionLog'

describe('buildScanDecisionShownDetail', () => {
    it('keeps the existing keys and adds scan_log_id', () => {
        expect(buildScanDecisionShownDetail({ autoStatus: 'Syubhah', scanLogId: 'abc-123' })).toEqual({
            auto_status: 'Syubhah',
            source: 'ingredient_scan',
            scan_log_id: 'abc-123',
        })
    })

    it('uses null (not undefined) when there is no scan log id', () => {
        expect(buildScanDecisionShownDetail({ autoStatus: 'Haram' })).toEqual({
            auto_status: 'Haram',
            source: 'ingredient_scan',
            scan_log_id: null,
        })
        expect(buildScanDecisionShownDetail({ autoStatus: 'Haram', scanLogId: null }).scan_log_id).toBeNull()
    })

    it('never carries flagged_ingredients', () => {
        expect(buildScanDecisionShownDetail({ autoStatus: 'Haram', scanLogId: 7 })).not.toHaveProperty('flagged_ingredients')
    })
})

describe('buildScanDecisionDetail', () => {
    const base = { choice: 'skip' as const, autoStatus: 'Syubhah', shownStatus: 'Syubhah', inDatabase: false }

    it('keeps the existing keys and adds scan_log_id and flagged_ingredients', () => {
        expect(buildScanDecisionDetail({ ...base, scanLogId: 42, flaggedIngredients: ['gelatin', 'e471'] })).toEqual({
            choice: 'skip',
            auto_status: 'Syubhah',
            shown_status: 'Syubhah',
            in_database: false,
            source: 'ingredient_scan',
            scan_log_id: 42,
            flagged_ingredients: ['gelatin', 'e471'],
        })
    })

    it('works without a scan_log_id', () => {
        const d = buildScanDecisionDetail({ ...base, flaggedIngredients: ['gelatin'] })
        expect(d.scan_log_id).toBeNull()
        expect(d.flagged_ingredients).toEqual(['gelatin'])
    })

    it('uses [] when nothing was flagged', () => {
        expect(buildScanDecisionDetail({ ...base }).flagged_ingredients).toEqual([])
        expect(buildScanDecisionDetail({ ...base, flaggedIngredients: [] }).flagged_ingredients).toEqual([])
        expect(buildScanDecisionDetail({ ...base, flaggedIngredients: null }).flagged_ingredients).toEqual([])
    })

    it('caps more than 10 flagged names at 10', () => {
        const many = Array.from({ length: 25 }, (_, i) => `ingredient ${i}`)
        const d = buildScanDecisionDetail({ ...base, flaggedIngredients: many })
        expect(d.flagged_ingredients).toHaveLength(FLAGGED_INGREDIENTS_MAX)
        expect(d.flagged_ingredients[0]).toBe('ingredient 0')
        expect(d.flagged_ingredients[9]).toBe('ingredient 9')
    })

    it('falls back to the scan verdict and null like before', () => {
        const d = buildScanDecisionDetail({ choice: 'use', autoStatus: 'Haram' })
        expect(d).toMatchObject({ shown_status: 'Haram', in_database: null })
    })
})

describe('flaggedIngredientNames', () => {
    it('lower-cases, trims and de-duplicates', () => {
        expect(
            flaggedIngredientNames([
                { keyword: 'Gelatin' },
                { keyword: '  gelatin ' },
                { keyword: 'E471' },
                { keyword: 'GELATIN' },
            ])
        ).toEqual(['gelatin', 'e471'])
    })

    it('uses the first spelling when a keyword holds several separated by |', () => {
        expect(flaggedIngredientNames([{ keyword: 'Gelatin|Gelatine' }])).toEqual(['gelatin'])
    })

    it('collapses inner whitespace and drops empty or missing keywords', () => {
        expect(
            flaggedIngredientNames([{ keyword: 'Mono   and\n diglycerides' }, { keyword: '' }, { keyword: null }, {}])
        ).toEqual(['mono and diglycerides'])
    })

    it('cuts a long name to 60 characters', () => {
        const [name] = flaggedIngredientNames([{ keyword: 'a'.repeat(200) }])
        expect(name).toHaveLength(FLAGGED_INGREDIENT_MAX_LENGTH)
    })

    it('caps the list at 10 distinct names', () => {
        const highlights = Array.from({ length: 30 }, (_, i) => ({ keyword: `item ${i % 15}` }))
        const names = flaggedIngredientNames(highlights)
        expect(names).toHaveLength(10)
        expect(new Set(names).size).toBe(10)
    })

    it('returns [] for null, undefined or non-string keywords', () => {
        expect(flaggedIngredientNames(null)).toEqual([])
        expect(flaggedIngredientNames(undefined)).toEqual([])
        expect(flaggedIngredientNames([{ keyword: 5 as unknown as string }])).toEqual([])
    })

    it('ignores everything on a highlight except the English keyword', () => {
        const names = flaggedIngredientNames([
            { keyword: 'Lard', keyword_zh: '豬油', color: 'danger', boxes: [{ x: 1, y: 2, width: 3, height: 4 }] } as any,
        ])
        expect(names).toEqual(['lard'])
    })
})
