import { describe, it, expect } from 'vitest'
import { shouldTriggerPreviewLimit } from '@/utils/reelPreview'

describe('shouldTriggerPreviewLimit', () => {
    it('triggers once playback reaches the limit', () => {
        expect(shouldTriggerPreviewLimit(false, 10, 10)).toBe(true)
        expect(shouldTriggerPreviewLimit(false, 12.5, 10)).toBe(true)
    })

    it('does not trigger before the limit', () => {
        expect(shouldTriggerPreviewLimit(false, 9.99, 10)).toBe(false)
        expect(shouldTriggerPreviewLimit(false, 0, 3)).toBe(false)
    })

    it('never triggers again once the reel is limited (the timeupdate loop guard)', () => {
        expect(shouldTriggerPreviewLimit(true, 10, 10)).toBe(false)
        expect(shouldTriggerPreviewLimit(true, 99, 10)).toBe(false)
    })
})
