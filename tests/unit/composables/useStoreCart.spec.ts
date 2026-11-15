import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useStoreCart } from '@/composables/useStoreCart'

describe('useStoreCart', () => {
    let mockStorage: Record<string, string> = {}

    beforeEach(() => {
        mockStorage = {}
        // Stub localStorage to avoid polluting actual browser/node environments
        vi.stubGlobal('localStorage', {
            getItem: vi.fn((key: string) => mockStorage[key] || null),
            setItem: vi.fn((key: string, value: string) => {
                mockStorage[key] = value.toString()
            }),
            removeItem: vi.fn((key: string) => {
                delete mockStorage[key]
            }),
            clear: vi.fn(() => {
                mockStorage = {}
            })
        })
        
        // Since useStoreCart uses a global ref `items` in the module scope,
        // we must explicitly clear it before each test to maintain isolation.
        const cart = useStoreCart()
        cart.clearCart()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('should initialize with an empty cart', () => {
        const cart = useStoreCart()
        expect(cart.items.value).toEqual([])
        expect(cart.cartCount.value).toBe(0)
        expect(cart.cartTotal.value).toBe(0)
    })

    it('should add an item to the cart', () => {
        const cart = useStoreCart()
        cart.addItem({ id: 'p1', name: 'Product 1', price: 100 }, 2)
        
        expect(cart.items.value.length).toBe(1)
        expect(cart.items.value[0].productId).toBe('p1')
        expect(cart.items.value[0].quantity).toBe(2)
        expect(cart.cartCount.value).toBe(2)
        expect(cart.cartTotal.value).toBe(200)
    })

    it('should accumulate quantity for existing items', () => {
        const cart = useStoreCart()
        cart.addItem({ id: 'p1', name: 'Product 1', price: 100 }, 1)
        cart.addItem({ id: 'p1', name: 'Product 1', price: 100 }, 3)
        
        expect(cart.items.value.length).toBe(1)
        expect(cart.items.value[0].quantity).toBe(4)
        expect(cart.cartCount.value).toBe(4)
        expect(cart.cartTotal.value).toBe(400)
    })

    it('should remove an item from the cart', () => {
        const cart = useStoreCart()
        cart.addItem({ id: 'p1', name: 'Product 1', price: 100 }, 1)
        cart.addItem({ id: 'p2', name: 'Product 2', price: 50 }, 1)
        
        cart.removeItem('p1')
        
        expect(cart.items.value.length).toBe(1)
        expect(cart.items.value[0].productId).toBe('p2')
        expect(cart.cartCount.value).toBe(1)
    })

    it('should update quantity directly and remove if <= 0', () => {
        const cart = useStoreCart()
        cart.addItem({ id: 'p1', name: 'Product 1', price: 100 }, 2)
        
        // Update to valid quantity
        cart.updateQty('p1', 5)
        expect(cart.items.value[0].quantity).toBe(5)
        expect(cart.cartTotal.value).toBe(500)
        
        // Update to 0 should remove
        cart.updateQty('p1', 0)
        expect(cart.items.value.length).toBe(0)
    })
})
