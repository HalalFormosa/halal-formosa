import { describe, it, expect } from 'vitest'
import type { LiveTextFrame } from '@/plugins/liveText'
import { extractLiveProductName, LiveProductNameTracker, nameSimilarity } from '@/utils/liveProductName'

function frameWithLines(...lines: string[]): LiveTextFrame {
    return {
        width: 720,
        height: 1280,
        blocks: lines.map((text, i) => ({
            lines: [{ text, box: { x: 0, y: i * 40, width: 400, height: 30 }, elements: [] }],
        })),
    }
}

describe('extractLiveProductName', () => {
    it('reads a 名: line (the 品 is often a separate fragment)', () => {
        expect(extractLiveProductName(frameWithLines('名:咔辣姆久厚切洋芋片-勁辣唐辛子口味'))).toBe(
            '咔辣姆久厚切洋芋片-勁辣唐辛子口味',
        )
    })

    it('reads 品名 with a full-width colon', () => {
        expect(extractLiveProductName(frameWithLines('品名：香濃奶茶'))).toBe('香濃奶茶')
    })

    it('reads an English product name line', () => {
        expect(extractLiveProductName(frameWithLines('Product Name: Spicy Chips ®'))).toBe('Spicy Chips')
    })

    it('does not mistake other lines for a name', () => {
        expect(extractLiveProductName(frameWithLines('重:52公克', '保存期限:8個月', '原產地:台灣'))).toBe('')
    })

    it('ignores a name that is too short to be real', () => {
        expect(extractLiveProductName(frameWithLines('名:糖'))).toBe('')
    })
})

describe('nameSimilarity', () => {
    it('is 1 for identical and high for a one-character misread', () => {
        expect(nameSimilarity('咔辣姆久厚切洋芋片', '咔辣姆久厚切洋芋片')).toBe(1)
        expect(nameSimilarity('咔辣姆久厚切洋芋片', '咔辣好久厚切洋芋片')).toBeGreaterThan(0.6)
    })
    it('is low for different products', () => {
        expect(nameSimilarity('咔辣姆久厚切洋芋片', '香濃奶茶')).toBeLessThan(0.3)
    })
})

describe('LiveProductNameTracker', () => {
    it('shows nothing until a name has been read twice', () => {
        const t = new LiveProductNameTracker()
        t.update('咔辣姆久厚切洋芋片', 0)
        expect(t.current(0)).toBe('')
        t.update('咔辣姆久厚切洋芋片', 100)
        expect(t.current(100)).toBe('咔辣姆久厚切洋芋片')
    })

    it('settles on the most common spelling of a name that is misread between frames', () => {
        const t = new LiveProductNameTracker()
        const reads = ['咔辣姆久厚切洋芋片', '咔辣好久厚切洋芋片', '咔辣姆久厚切洋芋片', '咔辣妒久厚切洋芋片']
        reads.forEach((r, i) => t.update(r, i * 100))
        expect(t.current(400)).toBe('咔辣姆久厚切洋芋片')
    })

    it('drops the name after the camera has moved on', () => {
        const t = new LiveProductNameTracker({ ttlMs: 1000 })
        t.update('咔辣姆久厚切洋芋片', 0)
        t.update('咔辣姆久厚切洋芋片', 100)
        expect(t.current(5000)).toBe('')
    })

    it('switches to a different product once it is read more often', () => {
        const t = new LiveProductNameTracker({ ttlMs: 1000 })
        for (const at of [0, 100]) t.update('咔辣姆久厚切洋芋片', at)
        for (const at of [1500, 1600, 1700]) t.update('香濃奶茶', at)
        expect(t.current(1700)).toBe('香濃奶茶')
    })
})
