import { describe, it, expect, vi } from 'vitest'
import type { OcrResult } from '@/composables/useOcrService'
import { base64ToFile, buildAddProductQuery, contributePromptKind } from '@/utils/liveContribute'
import { LiveProductLookup } from '@/utils/liveProductLookup'
import { extractCoreProductName, pickBestProductMatch, wordJaccard } from '@/utils/productNameMatch'

const ocr: OcrResult = {
    textZh: '馬鈴薯、棕櫚油',
    textEn: 'Potato, palm oil',
    productName: 'Spicy Potato Chips',
    highlights: [{ keyword: 'palm oil', keyword_zh: '棕櫚油', color: '--ion-color-primary' }],
    autoStatus: 'Muslim-friendly',
    detectedLanguage: 'chinese',
    ocrRaw: 'raw',
}

describe('buildAddProductQuery', () => {
    it('carries the label reading over in the shape the add-product flow expects', () => {
        const q = buildAddProductQuery({ ocr, fallbackName: 'Live Name', imageUrl: 'blob:abc' })
        expect(q).toMatchObject({
            fromScan: 'true',
            name: 'Spicy Potato Chips',
            ingredients: 'Potato, palm oil',
            status: 'Muslim-friendly',
            image: 'blob:abc',
            rawOcr: '馬鈴薯、棕櫚油',
        })
        expect(JSON.parse(q.analysis)).toHaveLength(1)
    })

    it('never sends a barcode, so the add flow asks for it first', () => {
        expect(buildAddProductQuery({ ocr, fallbackName: 'x', imageUrl: 'blob:abc' })).not.toHaveProperty('barcode')
    })

    it('uses the live-detected name when the label reading has none', () => {
        expect(buildAddProductQuery({ ocr: { ...ocr, productName: 'Unknown Product' }, fallbackName: 'Live Name', imageUrl: 'b' }).name).toBe('Live Name')
    })

    it('still works when the label could not be read', () => {
        const q = buildAddProductQuery({ ocr: null, fallbackName: 'Live Name', imageUrl: 'blob:abc' })
        expect(q).toMatchObject({ name: 'Live Name', ingredients: '', status: '', image: 'blob:abc', analysis: '[]' })
    })

    it('falls back to the Chinese text when there is no English ingredients text', () => {
        expect(buildAddProductQuery({ ocr: { ...ocr, textEn: '' }, fallbackName: 'x', imageUrl: 'b' }).ingredients).toBe('馬鈴薯、棕櫚油')
    })
})

describe('base64ToFile', () => {
    it('decodes base64 into a jpeg File', async () => {
        const file = base64ToFile(btoa('hello'), 'live-capture.jpg')
        expect(file.name).toBe('live-capture.jpg')
        expect(file.type).toBe('image/jpeg')
        expect(file.size).toBe(5)
    })
})

describe('productNameMatch', () => {
    it('strips packaging noise from a name', () => {
        expect(extractCoreProductName('Coffee Plaza Net Weight: 300ml')).toBe('Coffee Plaza')
    })

    it('finds the matching product among search hits', () => {
        const rows = [{ name: 'Ultra Milk Long-lasting Flavored Milk - Strawberry Flavor' }, { name: 'Strawberry Milk' }]
        expect(pickBestProductMatch('Strawberry Milk', rows)).toEqual({ name: 'Strawberry Milk' })
    })

    it('returns null when nothing is close enough', () => {
        expect(pickBestProductMatch('Spicy Potato Chips', [{ name: 'Green Tea' }, { name: 'Oat Biscuits' }])).toBeNull()
    })

    it('does not treat a short name inside a long unrelated one as a match', () => {
        expect(wordJaccard('Strawberry Milk', 'Ultra Milk Long-lasting Flavored Milk - Strawberry Flavor')).toBeLessThan(0.6)
    })
})

describe('LiveProductLookup', () => {
    async function flush() {
        await new Promise(r => setTimeout(r, 0))
    }

    it('reports missing only after a successful search found nothing', async () => {
        const lookup = vi.fn().mockResolvedValue(false)
        const l = new LiveProductLookup(lookup, { minIntervalMs: 0 })
        l.update('Spicy Chips', 0)
        expect(l.state('Spicy Chips')).toBe('checking')
        await flush()
        expect(l.state('Spicy Chips')).toBe('missing')
    })

    it('reports found when the product exists', async () => {
        const l = new LiveProductLookup(vi.fn().mockResolvedValue(true), { minIntervalMs: 0 })
        l.update('Spicy Chips', 0)
        await flush()
        expect(l.state('Spicy Chips')).toBe('found')
    })

    it('never reports missing when the search itself failed', async () => {
        const l = new LiveProductLookup(vi.fn().mockResolvedValue(null), { minIntervalMs: 0 })
        l.update('Spicy Chips', 0)
        await flush()
        expect(l.state('Spicy Chips')).toBe('unknown')
    })

    it('treats a thrown error like a failed search', async () => {
        const l = new LiveProductLookup(vi.fn().mockRejectedValue(new Error('offline')), { minIntervalMs: 0 })
        l.update('Spicy Chips', 0)
        await flush()
        expect(l.state('Spicy Chips')).toBe('unknown')
    })

    it('searches each name once', async () => {
        const lookup = vi.fn().mockResolvedValue(false)
        const l = new LiveProductLookup(lookup, { minIntervalMs: 0 })
        l.update('Spicy Chips', 0)
        l.update('Spicy Chips', 10)
        await flush()
        l.update('Spicy Chips', 20)
        expect(lookup).toHaveBeenCalledOnce()
    })

    it('does not retry a failed name straight away', async () => {
        const lookup = vi.fn().mockResolvedValue(null)
        const l = new LiveProductLookup(lookup, { minIntervalMs: 0, retryMs: 60000 })
        l.update('Spicy Chips', 0)
        await flush()
        l.update('Spicy Chips', 100)
        expect(lookup).toHaveBeenCalledOnce()
    })

    it('stops after the session cap', async () => {
        const lookup = vi.fn().mockResolvedValue(true)
        const l = new LiveProductLookup(lookup, { minIntervalMs: 0, maxRequests: 2 })
        for (const [i, name] of ['A One', 'B Two', 'C Three', 'D Four'].entries()) {
            l.update(name, i * 100)
            await flush()
        }
        expect(lookup).toHaveBeenCalledTimes(2)
    })

    it('has no state for an empty name', () => {
        const l = new LiveProductLookup(vi.fn())
        expect(l.state('')).toBe('unknown')
    })
})

describe('contributePromptKind', () => {
    const base = {
        available: true,
        running: true,
        hasError: false,
        limitReached: false,
        detected: true,
        match: 'unknown' as const,
        dismissed: false,
    }

    it('says the product is missing once the lookup found nothing', () => {
        expect(contributePromptKind({ ...base, match: 'missing' })).toBe('missing')
    })

    it('still invites a contribution while the name is not translated or looked up yet', () => {
        expect(contributePromptKind({ ...base, match: 'unknown' })).toBe('general')
        expect(contributePromptKind({ ...base, match: 'checking' })).toBe('general')
    })

    it('stays when only ingredients are detected and no product name was read', () => {
        expect(contributePromptKind({ ...base, detected: true, match: 'unknown' })).toBe('general')
    })

    it('does not nag for a product the database already has', () => {
        expect(contributePromptKind({ ...base, match: 'found' })).toBeNull()
    })

    it('waits until something has been detected', () => {
        expect(contributePromptKind({ ...base, detected: false })).toBeNull()
    })

    it('respects Not now, errors, the contribution limit and a stopped camera', () => {
        expect(contributePromptKind({ ...base, dismissed: true })).toBeNull()
        expect(contributePromptKind({ ...base, hasError: true })).toBeNull()
        expect(contributePromptKind({ ...base, limitReached: true })).toBeNull()
        expect(contributePromptKind({ ...base, running: false })).toBeNull()
        expect(contributePromptKind({ ...base, available: false })).toBeNull()
    })
})
