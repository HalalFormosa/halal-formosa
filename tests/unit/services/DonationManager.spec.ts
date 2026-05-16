import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DonationManager } from '@/services/DonationManager'

vi.mock('@capgo/native-purchases', () => ({
    NativePurchases: {
        isBillingSupported: vi.fn().mockResolvedValue({ isBillingSupported: true }),
        getProducts: vi.fn().mockResolvedValue({ products: [{ identifier: 'com.rcreative.support_1', price: 10 }] }),
        purchaseProduct: vi.fn().mockResolvedValue({ transactionId: 'tx-123', productIdentifier: 'com.rcreative.support_1' })
    },
    PURCHASE_TYPE: { INAPP: 'inapp', SUBS: 'subs' }
}))

vi.mock('@capacitor/core', () => ({
    Capacitor: { isNativePlatform: vi.fn().mockReturnValue(true), getPlatform: vi.fn().mockReturnValue('android') }
}))

describe('DonationManager', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should initialize and load products natively', async () => {
        const dm = new DonationManager()
        const prods = await dm.initialize()
        
        expect(prods?.length).toBe(1)
        expect(prods?.[0].price).toBe(10)
    })

    it('should process donation successfully', async () => {
        const dm = new DonationManager()
        const res = await dm.donate('com.rcreative.support_1')
        
        expect(res.success).toBe(true)
        expect(res.transactionId).toBe('tx-123')
    })

    it('should return error if donation attempted on non-native platform', async () => {
        vi.stubGlobal('alert', vi.fn())
        const dm = new DonationManager()
        dm.isNative = false

        const res = await dm.donate('com.rcreative.support_1')
        expect(res.success).toBe(false)
    })
})
