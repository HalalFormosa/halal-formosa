import { describe, it, expect } from 'vitest'
import { buildScanDecisionNotice } from '@/utils/scanDecisionNotice'

describe('buildScanDecisionNotice', () => {
    it('includes product, result, decision, flagged items and ingredients', () => {
        const { title, message } = buildScanDecisionNotice({
            productName: 'Coffee Plaza 300 ml',
            status: 'Syubhah',
            choice: 'skip',
            flagged: ['emulsifier (E471)', 'flavouring'],
            ingredientsZh: '水,蔗糖,乳粉,\n乳化劑',
            ingredients: 'Water, sugar, milk,\n emulsifier (E471)',
        })
        expect(title).toBe('🧾 Scan decision: Skip it')
        expect(message).toContain('**Product:** Coffee Plaza 300 ml')
        expect(message).toContain('**Result:** Syubhah')
        expect(message).toContain('**Decision:** Skip it')
        expect(message).toContain('**Flagged:** emulsifier (E471), flavouring')
        expect(message).toContain('**Ingredients (中文):** 水,蔗糖,乳粉, 乳化劑')
        expect(message).toContain('**Ingredients (EN):** Water, sugar, milk, emulsifier (E471)')
    })

    it('omits empty flagged/ingredients lines and falls back for unknowns', () => {
        const { message } = buildScanDecisionNotice({ choice: 'use' })
        expect(message).toBe(
            '**Product:** Unknown\n**In database:** Not checked yet\n**Result:** Unknown\n**Decision:** Buy / eat it'
        )
    })

    it('says whether the product is already in the database', () => {
        const yes = buildScanDecisionNotice({ choice: 'use', inDatabase: true, matchedName: 'Coffee Plaza 300 ml' })
        expect(yes.message).toContain('**In database:** Yes — Coffee Plaza 300 ml')

        const no = buildScanDecisionNotice({ choice: 'use', inDatabase: false })
        expect(no.message).toContain('**In database:** No (new product)')

        const unknown = buildScanDecisionNotice({ choice: 'use', inDatabase: null })
        expect(unknown.message).toContain('**In database:** Not checked yet')
    })

    it('does not list flagged ingredients for a product already in the database', () => {
        const { message } = buildScanDecisionNotice({
            status: 'Syubhah',
            choice: 'check',
            inDatabase: true,
            flagged: ['emulsifier'],
        })
        expect(message).not.toContain('Flagged')
    })

    it('does not list flagged ingredients when the final result is Muslim-friendly', () => {
        const { message } = buildScanDecisionNotice({
            status: 'Muslim-friendly',
            choice: 'use',
            inDatabase: false,
            flagged: ['emulsifier'],
        })
        expect(message).not.toContain('Flagged')
    })

    it('lists flagged ingredients for a new product that is not Muslim-friendly', () => {
        const { message } = buildScanDecisionNotice({
            status: 'Syubhah',
            choice: 'skip',
            inDatabase: false,
            flagged: ['emulsifier', 'gelatin'],
        })
        expect(message).toContain('**Flagged:** emulsifier, gelatin')
    })

    it('never lets user-editable text ping the channel', () => {
        const { message } = buildScanDecisionNotice({
            productName: 'Hello @everyone and @here <@123456789>',
            choice: 'check',
        })
        expect(message).not.toMatch(/@everyone/i)
        expect(message).not.toMatch(/@here/i)
        expect(message).not.toContain('<@123456789>')
    })

    it('keeps even the longest message within Discord limits', () => {
        const { title, message } = buildScanDecisionNotice({
            productName: 'P'.repeat(500),
            status: 'Syubhah',
            choice: 'check',
            inDatabase: true,
            matchedName: 'M'.repeat(500),
            flagged: ['f'.repeat(500)],
            ingredientsZh: '水'.repeat(5000),
            ingredients: 'sugar '.repeat(2000),
        })
        // notify-event sends "**title**" + newline + message, and Discord rejects > 2000 characters
        expect(`**${title}**\n${message}`.length).toBeLessThan(2000)
        expect(message).toContain('…')
    })

    it('skips the Chinese line when there is no Chinese text', () => {
        const { message } = buildScanDecisionNotice({ choice: 'use', ingredients: 'Water, sugar' })
        expect(message).not.toContain('中文')
        expect(message).toContain('**Ingredients (EN):** Water, sugar')
    })

    it('contains no user identity fields', () => {
        const { message, title } = buildScanDecisionNotice({ productName: 'A', status: 'Haram', choice: 'skip' })
        expect(`${title}\n${message}`).not.toMatch(/email|user_id|@\w+\.\w+/i)
    })
})
