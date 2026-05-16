import { describe, it, expect, vi } from 'vitest'
import { SubscriptionManager } from '@/services/SubscriptionManager'

vi.mock('@capgo/native-purchases', () => ({
    NativePurchases: {
        isBillingSupported: vi.fn().mockResolvedValue({ isBillingSupported: true }),
        getProduct: vi.fn().mockResolvedValue({ product: { identifier: 'sub-1', price: 100 } }),
        purchaseProduct: vi.fn().mockResolvedValue({ transactionId: 'tx-sub', productIdentifier: 'sub-1' }),
        getPurchases: vi.fn().mockResolvedValue({ purchases: [{ productIdentifier: 'sub-1' }] })
    },
    PURCHASE_TYPE: { INAPP: 'inapp', SUBS: 'subs' }
}))

vi.mock('@capacitor/core', () => ({
    Capacitor: { getPlatform: vi.fn().mockReturnValue('android') }
}))

describe('SubscriptionManager', () => {
    it('should initialize and check billing', async () => {
        const sm = new SubscriptionManager('sub-1', 'plan-1')
        expect(await sm.initialize()).toBe(true)
    })

    it('should load subscription product details', async () => {
        const sm = new SubscriptionManager('sub-1', 'plan-1')
        const prod = await sm.loadProduct()
        expect(prod.price).toBe(100)
    })

    it('should process subscription purchase', async () => {
        const sm = new SubscriptionManager('sub-1', 'plan-1')
        const res = await sm.purchase()
        expect(res.transactionId).toBe('tx-sub')
    })

    it('should check active subscription status', async () => {
        const sm = new SubscriptionManager('sub-1', 'plan-1')
        expect(await sm.checkActive()).toBe(true)
    })
})
