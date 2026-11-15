import { describe, it, expect, vi } from 'vitest'

vi.mock('@/plugins/supabaseClient', () => ({ supabase: { auth: { getSession: vi.fn() } } }))
vi.mock('@/i18n', () => ({
    i18n: { global: { t: (key: string) => key } },
}))

import { AiRequestError, friendlyAiError } from '@/composables/useAISummary'

describe('friendlyAiError', () => {
    it('maps known server codes to their own message', () => {
        expect(friendlyAiError(new AiRequestError(429, 'AI_DAILY_LIMIT'))).toBe('scanIngredients.aiErrors.dailyLimit')
        expect(friendlyAiError(new AiRequestError(403, 'PRO_ONLY'))).toBe('scanIngredients.aiErrors.proOnly')
        expect(friendlyAiError(new AiRequestError(401, 'UNAUTHORIZED'))).toBe('scanIngredients.aiErrors.signIn')
    })

    it('shows the generic message for provider outages, unknown codes and network errors', () => {
        expect(friendlyAiError(new AiRequestError(503, 'AI_UNAVAILABLE'))).toBe('scanIngredients.aiErrors.unavailable')
        expect(friendlyAiError(new AiRequestError(400, undefined, 'Your prepayment credits are depleted'))).toBe('scanIngredients.aiErrors.unavailable')
        expect(friendlyAiError(new TypeError('Failed to fetch'))).toBe('scanIngredients.aiErrors.unavailable')
    })

    it('never leaks the raw provider text into the user message', () => {
        const msg = friendlyAiError(new AiRequestError(400, undefined, 'Your prepayment credits are depleted https://ai.studio'))
        expect(msg).not.toMatch(/prepayment|ai\.studio/i)
    })
})
