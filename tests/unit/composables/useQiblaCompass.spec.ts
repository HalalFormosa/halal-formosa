import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useQiblaCompass } from '@/composables/useQiblaCompass'

vi.mock('@ionic/vue', () => ({
    onIonViewWillLeave: vi.fn()
}))

describe('useQiblaCompass', () => {
    beforeEach(() => {
        vi.stubGlobal('window', {
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            DeviceOrientationEvent: { requestPermission: vi.fn().mockResolvedValue('granted') }
        })
    })

    it('should calculate accurate qibla bearing when started', async () => {
        const { start, qiblaBearing, loading } = useQiblaCompass()
        
        // Taipei Coordinates ~ 25.0330 N, 121.5654 E
        // Qibla bearing from Taipei towards Kaaba is ~ 288.5 degrees
        await start(25.0330, 121.5654)
        
        expect(loading.value).toBe(true)
        expect(qiblaBearing.value).toBeGreaterThan(285)
        expect(qiblaBearing.value).toBeLessThan(290)
    })
})
