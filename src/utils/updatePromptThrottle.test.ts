import { describe, it, expect } from 'vitest'
import { shouldShowUpdatePrompt, UPDATE_PROMPT_GAP_MS } from './updatePromptThrottle'

describe('shouldShowUpdatePrompt', () => {
    const now = 1_800_000_000_000

    it('shows when it was never shown', () => {
        expect(shouldShowUpdatePrompt(now, null)).toBe(true)
    })

    it('stays quiet inside the window', () => {
        expect(shouldShowUpdatePrompt(now, now - 60_000)).toBe(false)
        expect(shouldShowUpdatePrompt(now, now - (UPDATE_PROMPT_GAP_MS - 1))).toBe(false)
    })

    it('shows again once the window has passed', () => {
        expect(shouldShowUpdatePrompt(now, now - UPDATE_PROMPT_GAP_MS)).toBe(true)
    })

    it('recovers if the stored time is in the future', () => {
        expect(shouldShowUpdatePrompt(now, now + 86_400_000)).toBe(true)
    })
})
