import { describe, it, expect, vi, beforeEach } from 'vitest'
import useDisclaimer from '@/composables/useDisclaimer'
import router from '@/router'

vi.mock('@/router', () => ({
    default: { push: vi.fn() }
}))

describe('useDisclaimer', () => {
    let mockStorage: Record<string, string> = {}

    beforeEach(() => {
        mockStorage = {}
        vi.stubGlobal('localStorage', {
            getItem: vi.fn((key: string) => mockStorage[key] || null),
            setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value }),
            removeItem: vi.fn((key: string) => { delete mockStorage[key] })
        })
        vi.clearAllMocks()
    })

    it('should show disclaimer if not accepted', () => {
        const { maybeShowDisclaimer, showSimpleDisclaimer } = useDisclaimer()
        expect(maybeShowDisclaimer()).toBe(true)
        expect(showSimpleDisclaimer.value).toBe(true)
    })

    it('should accept disclaimer and update localStorage', () => {
        const { acceptDisclaimer, showSimpleDisclaimer } = useDisclaimer()
        acceptDisclaimer()
        expect(mockStorage['disclaimerAccepted']).toBe('true')
        expect(showSimpleDisclaimer.value).toBe(false)
    })

    it('should show detailed disclaimer when requested', () => {
        const { showDetails, showDetailedDisclaimer, closeDetailedDisclaimer } = useDisclaimer()
        showDetails()
        expect(showDetailedDisclaimer.value).toBe(true)
        closeDetailedDisclaimer()
        expect(showDetailedDisclaimer.value).toBe(false)
    })

    it('should decline disclaimer and redirect to home', () => {
        const { declineDisclaimer, showSimpleDisclaimer } = useDisclaimer()
        declineDisclaimer()
        expect(mockStorage['disclaimerAccepted']).toBeUndefined()
        expect(showSimpleDisclaimer.value).toBe(false)
        expect(router.push).toHaveBeenCalledWith('/home')
    })

    it('should increment disclaimer scan count', () => {
        const { incrementDisclaimerCount } = useDisclaimer()
        incrementDisclaimerCount()
        expect(mockStorage['disclaimerScanCount']).toBe('1')
    })
})
