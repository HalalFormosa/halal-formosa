import { describe, it, expect, vi, beforeEach } from 'vitest'
import { refreshSubscriptionStatus, isDonor } from '@/composables/useSubscriptionStatus'
import { Purchases } from '@revenuecat/purchases-capacitor'

vi.mock('@revenuecat/purchases-capacitor', () => ({
    Purchases: {
        getCustomerInfo: vi.fn().mockResolvedValue({
            customerInfo: { entitlements: { active: { 'Halal Formosa Pro': true } } }
        })
    }
}))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: vi.fn().mockReturnValue(true) } }))

describe('useSubscriptionStatus', () => {
    beforeEach(() => {
        vi.stubGlobal('localStorage', {
            getItem: vi.fn(), setItem: vi.fn()
        })
    })

    it('should refresh RevenueCat customer info and set pro status', async () => {
        await refreshSubscriptionStatus()
        expect(isDonor.value).toBe(true)
    })
})
