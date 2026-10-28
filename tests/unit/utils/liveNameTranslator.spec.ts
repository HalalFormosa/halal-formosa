import { describe, it, expect, vi } from 'vitest'
import { LiveNameTranslator } from '@/utils/liveNameTranslator'

const NAME = '咔辣姆久厚切洋芋片'
const OTHER = '香濃奶茶'
const LONG_NAME = '咔辣姆久厚切洋芋片-勁辣唐辛子口味'

async function flush() {
    await new Promise(r => setTimeout(r, 0))
}

describe('LiveNameTranslator', () => {
    it('waits for the name to settle before translating', async () => {
        const translate = vi.fn().mockResolvedValue('Crunchy thick-cut potato chips')
        const t = new LiveNameTranslator(translate, { settleMs: 1000 })
        t.update(NAME, 0)
        t.update(NAME, 500)
        expect(translate).not.toHaveBeenCalled()
        t.update(NAME, 1000)
        expect(translate).toHaveBeenCalledOnce()
        await flush()
        expect(t.get(NAME)).toBe('Crunchy thick-cut potato chips')
    })

    it('translates each name once', async () => {
        const translate = vi.fn().mockResolvedValue('Potato chips')
        const t = new LiveNameTranslator(translate, { settleMs: 0 })
        t.update(NAME, 0)
        t.update(NAME, 10) // still in flight
        await flush()
        t.update(NAME, 20) // cached
        expect(translate).toHaveBeenCalledOnce()
    })

    it('restarts the wait when the name changes', () => {
        const translate = vi.fn().mockResolvedValue('x')
        const t = new LiveNameTranslator(translate, { settleMs: 1000 })
        t.update(NAME, 0)
        t.update(OTHER, 900)
        t.update(OTHER, 1500)
        expect(translate).not.toHaveBeenCalled()
        t.update(OTHER, 1900)
        expect(translate).toHaveBeenCalledOnce()
    })

    it('does not translate names that are not Chinese or are empty', () => {
        const translate = vi.fn().mockResolvedValue('x')
        const t = new LiveNameTranslator(translate, { settleMs: 0 })
        t.update('Spicy Chips', 0)
        t.update('', 10)
        expect(translate).not.toHaveBeenCalled()
    })

    it('keeps the Chinese name and backs off when translation fails', async () => {
        const translate = vi.fn().mockResolvedValue(null)
        const t = new LiveNameTranslator(translate, { settleMs: 0, retryMs: 60000, minIntervalMs: 0 })
        t.update(NAME, 0)
        await flush()
        expect(t.get(NAME)).toBe('')
        t.update(NAME, 100)
        expect(translate).toHaveBeenCalledOnce() // not retried straight away
    })

    it('treats a thrown error like a failure', async () => {
        const translate = vi.fn().mockRejectedValue(new Error('offline'))
        const onUpdate = vi.fn()
        const t = new LiveNameTranslator(translate, { settleMs: 0, onUpdate })
        t.update(NAME, 0)
        await flush()
        expect(t.get(NAME)).toBe('')
        expect(onUpdate).toHaveBeenCalledOnce()
    })

    it('only returns a translation for the exact name it was made for', async () => {
        const translate = vi.fn().mockResolvedValue('Potato chips')
        const t = new LiveNameTranslator(translate, { settleMs: 0 })
        t.update(NAME, 0)
        await flush()
        expect(t.get(OTHER)).toBe('')
    })
})

describe('LiveNameTranslator cost limits', () => {
    it('reuses a translation for a near-identical misread instead of sending again', async () => {
        const translate = vi.fn().mockResolvedValue('Potato chips')
        const t = new LiveNameTranslator(translate, { settleMs: 0, minIntervalMs: 0 })
        t.update(LONG_NAME, 0)
        await flush()
        t.update('咔辣好久厚切洋芋片-勁辣唐辛子口味', 100) // one character misread
        expect(translate).toHaveBeenCalledOnce()
        expect(t.get('咔辣好久厚切洋芋片-勁辣唐辛子口味')).toBe('Potato chips')
    })

    it('does not reuse the translation of another flavour of the same product', async () => {
        const translate = vi.fn().mockResolvedValueOnce('Original flavour').mockResolvedValueOnce('Spicy flavour')
        const t = new LiveNameTranslator(translate, { settleMs: 0, minIntervalMs: 0 })
        t.update('咔辣姆久厚切洋芋片-原味', 0)
        await flush()
        t.update('咔辣姆久厚切洋芋片-辣味', 100)
        await flush()
        expect(translate).toHaveBeenCalledTimes(2)
        expect(t.get('咔辣姆久厚切洋芋片-辣味')).toBe('Spicy flavour')
    })

    it('does not reuse the translation of a clearly different product', async () => {
        const translate = vi.fn().mockResolvedValueOnce('Potato chips').mockResolvedValueOnce('Milk tea')
        const t = new LiveNameTranslator(translate, { settleMs: 0, minIntervalMs: 0 })
        t.update(NAME, 0)
        await flush()
        t.update(OTHER, 100)
        await flush()
        expect(translate).toHaveBeenCalledTimes(2)
        expect(t.get(OTHER)).toBe('Milk tea')
    })

    it('sends one request at a time', async () => {
        let resolveFirst: (v: string) => void = () => {}
        const translate = vi
            .fn()
            .mockImplementationOnce(() => new Promise<string>(r => (resolveFirst = r)))
            .mockResolvedValue('Milk tea')
        const t = new LiveNameTranslator(translate, { settleMs: 0, minIntervalMs: 0 })
        t.update(NAME, 0)
        t.update(OTHER, 10) // first still running
        expect(translate).toHaveBeenCalledOnce()
        resolveFirst('Potato chips')
        await flush()
        t.update(OTHER, 20)
        expect(translate).toHaveBeenCalledTimes(2)
    })

    it('spaces requests apart', async () => {
        const translate = vi.fn().mockResolvedValue('x')
        const t = new LiveNameTranslator(translate, { settleMs: 0, minIntervalMs: 4000 })
        t.update(NAME, 0)
        await flush()
        t.update(OTHER, 1000)
        expect(translate).toHaveBeenCalledOnce()
        t.update(OTHER, 4000)
        expect(translate).toHaveBeenCalledTimes(2)
    })

    it('stops after the session cap however many different names are seen', async () => {
        const translate = vi.fn().mockResolvedValue('x')
        const t = new LiveNameTranslator(translate, { settleMs: 0, minIntervalMs: 0, maxRequests: 3 })
        const names = ['香濃奶茶', '巧克力風味派', '黑糖珍珠鮮奶', '海苔洋芋片', '蘇打餅乾']
        let now = 0
        for (const n of names) {
            t.update(n, (now += 100))
            await flush()
        }
        expect(translate).toHaveBeenCalledTimes(3)
    })
})

describe('LiveNameTranslator saved translations', () => {
    it('loads saved translations so a product seen before costs nothing', () => {
        const translate = vi.fn()
        const t = new LiveNameTranslator(translate, {
            settleMs: 0,
            storage: { load: () => ({ [NAME]: 'Potato chips' }), save: vi.fn() },
        })
        t.update(NAME, 0)
        expect(t.get(NAME)).toBe('Potato chips')
        expect(translate).not.toHaveBeenCalled()
    })

    it('saves a new translation', async () => {
        const save = vi.fn()
        const t = new LiveNameTranslator(vi.fn().mockResolvedValue('Potato chips'), {
            settleMs: 0,
            storage: { load: () => ({}), save },
        })
        t.update(NAME, 0)
        await flush()
        expect(save).toHaveBeenCalledWith({ [NAME]: 'Potato chips' })
    })

    it('keeps only the newest saved entries', async () => {
        const save = vi.fn()
        const t = new LiveNameTranslator(vi.fn().mockResolvedValue('new'), {
            settleMs: 0,
            maxStored: 2,
            storage: { load: () => ({ 甲乙丙丁戊: 'a', 子丑寅卯辰: 'b' }), save },
        })
        t.update(NAME, 0)
        await flush()
        expect(Object.keys(save.mock.calls[0][0])).toEqual(['子丑寅卯辰', NAME])
    })

    it('starts empty when storage cannot be read', () => {
        const t = new LiveNameTranslator(vi.fn(), {
            storage: {
                load: () => {
                    throw new Error('blocked')
                },
                save: vi.fn(),
            },
        })
        expect(t.get(NAME)).toBe('')
    })
})
