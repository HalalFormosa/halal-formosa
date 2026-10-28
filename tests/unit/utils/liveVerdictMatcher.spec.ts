import { describe, it, expect } from 'vitest'
import type { LiveTextFrame } from '@/plugins/liveText'
import type { IngredientHighlight } from '@/types/Ingredient'
import {
    countRecognizedChars,
    createLiveMatcher,
    mapImageBoxToView,
    normalizeLiveText,
} from '@/utils/liveVerdictMatcher'

const hl = (keyword: string, keyword_zh: string, color: string): IngredientHighlight => ({
    keyword,
    keyword_zh,
    color,
})

function frameOf(...lines: string[][]): LiveTextFrame {
    // Each inner array is one line; every string in it is one element laid out left to right.
    return {
        width: 1000,
        height: 2000,
        blocks: [
            {
                lines: lines.map((words, row) => ({
                    text: words.join(' '),
                    box: { x: 0, y: row * 50, width: words.length * 100, height: 40 },
                    elements: words.map((w, col) => ({
                        text: w,
                        box: { x: col * 100, y: row * 50, width: 90, height: 40 },
                    })),
                })),
            },
        ],
    }
}

describe('normalizeLiveText', () => {
    it('lowercases and strips punctuation but keeps CJK', () => {
        expect(normalizeLiveText('Gelatin, (Pork)')).toBe('gelatinpork')
        expect(normalizeLiveText('豬 油，')).toBe('豬油')
    })
})

describe('createLiveMatcher', () => {
    const dictionary = [
        hl('gelatin|gelatine', '明膠', '--ion-color-danger'),
        hl('carmine', '胭脂紅', '--ion-color-warning'),
        hl('wine', '酒', '--ion-color-danger'),
        hl('e47[1-5]', '', '--ion-color-warning'),
    ]
    const match = createLiveMatcher(dictionary)

    it('finds a keyword and boxes the words that make it up', () => {
        const [m] = match(frameOf(['sugar', 'gelatin', 'salt']))
        expect(m.keyword).toBe('gelatin|gelatine')
        expect(m.matchedVariant).toBe('gelatin')
        expect(m.boxes).toEqual([{ x: 100, y: 0, width: 90, height: 40 }])
    })

    it('matches Chinese through keyword_zh', () => {
        const hits = match(frameOf(['成分：', '明膠、', '糖']))
        expect(hits.map(h => h.matchedVariant)).toEqual(['明膠'])
    })

    it('merges the boxes of a keyword split over several words and lines', () => {
        const hits = match(frameOf(['contains', 'car-'], ['mine', 'dye']))
        const carmine = hits.find(h => h.matchedVariant === 'carmine')
        expect(carmine?.boxes).toEqual([{ x: 0, y: 0, width: 190, height: 90 }])
    })

    it('treats [ ] and \\ variants as regex', () => {
        const hits = match(frameOf(['emulsifier', 'E472']))
        expect(hits.map(h => h.matchedVariant)).toEqual(['e47[1-5]'])
    })

    it('returns nothing when no keyword is present', () => {
        expect(match(frameOf(['sugar', 'water', 'salt']))).toEqual([])
    })

    it('does not report a shorter keyword already covered by a longer one', () => {
        const nested = createLiveMatcher([
            hl('red wine vinegar', '', '--ion-color-warning'),
            hl('wine', '', '--ion-color-danger'),
        ])
        const hits = nested(frameOf(['red', 'wine', 'vinegar']))
        expect(hits.map(h => h.matchedVariant)).toEqual(['red wine vinegar'])
    })

    it('ignores invalid regex entries instead of throwing', () => {
        const broken = createLiveMatcher([hl('[unclosed', '', '--ion-color-danger')])
        expect(broken(frameOf(['anything']))).toEqual([])
    })
})

describe('boxes for a whole-line element', () => {
    const lineFrame = (text: string, box: { x: number; y: number; width: number; height: number }): LiveTextFrame => ({
        width: 1000,
        height: 2000,
        blocks: [{ lines: [{ text, box, elements: [{ text, box }] }] }],
    })
    const match = createLiveMatcher([hl('', '明膠', '--ion-color-danger')])

    it('cuts the box to the matched characters', () => {
        const [m] = match(lineFrame('成分明膠糖', { x: 100, y: 50, width: 500, height: 40 }))
        expect(m.boxes).toEqual([{ x: 300, y: 50, width: 200, height: 40 }])
    })

    it('counts punctuation when locating the match', () => {
        const [m] = match(lineFrame('成分：明膠、糖', { x: 0, y: 0, width: 700, height: 40 }))
        expect(m.boxes).toEqual([{ x: 300, y: 0, width: 200, height: 40 }])
    })

    it('cuts top to bottom for vertical text', () => {
        const [m] = match(lineFrame('成分明膠糖', { x: 10, y: 0, width: 40, height: 500 }))
        expect(m.boxes).toEqual([{ x: 10, y: 200, width: 40, height: 200 }])
    })

    it('keeps the whole box when the match is the whole element', () => {
        const [m] = match(lineFrame('明膠', { x: 5, y: 6, width: 80, height: 30 }))
        expect(m.boxes).toEqual([{ x: 5, y: 6, width: 80, height: 30 }])
    })
})

describe('countRecognizedChars', () => {
    it('counts letters and digits only', () => {
        expect(countRecognizedChars(frameOf(['ab,', 'c 1']))).toBe(4)
    })
})

describe('mapImageBoxToView', () => {
    it('scales to cover the view and centres the overflow', () => {
        // 1000x2000 image shown in a 500x500 view: scale 0.5, 250px cropped top and bottom.
        const box = mapImageBoxToView(
            { x: 100, y: 1000, width: 200, height: 100 },
            { width: 1000, height: 2000 },
            { width: 500, height: 500 },
        )
        expect(box).toEqual({ x: 50, y: 250, width: 100, height: 50 })
    })
})
