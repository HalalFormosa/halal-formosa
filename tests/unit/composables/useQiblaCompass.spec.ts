import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useQiblaCompass, calculateQiblaBearing } from '@/composables/useQiblaCompass'

vi.mock('@ionic/vue', () => ({
    onIonViewWillLeave: vi.fn()
}))

describe('useQiblaCompass', () => {
    let eventListeners: Record<string, (e: any) => void> = {}

    beforeEach(() => {
        eventListeners = {}
        vi.stubGlobal('window', {
            addEventListener: vi.fn((event, handler) => {
                eventListeners[event] = handler
            }),
            removeEventListener: vi.fn((event) => {
                delete eventListeners[event]
            }),
            DeviceOrientationEvent: { requestPermission: vi.fn().mockResolvedValue('granted') }
        })
    })

    it('should calculate accurate qibla bearing for Taipei coordinates', () => {
        // Taipei Coordinates ~ 25.0330 N, 121.5654 E -> ~ 288.5 degrees
        const bearing = calculateQiblaBearing(25.0330, 121.5654)
        expect(bearing).toBeGreaterThan(285)
        expect(bearing).toBeLessThan(290)
    })

    it('should calculate accurate qibla bearing when started', async () => {
        const { start, qiblaBearing, loading } = useQiblaCompass()
        
        await start(25.0330, 121.5654)
        
        expect(loading.value).toBe(true)
        expect(qiblaBearing.value).toBeGreaterThan(285)
        expect(qiblaBearing.value).toBeLessThan(290)
    })

    it('should process iOS webkitCompassHeading event correctly', async () => {
        const { start, compassRotation, hasCompass, loading } = useQiblaCompass()

        await start(25.0330, 121.5654)

        // Trigger iOS orientation event with webkitCompassHeading = 90 (pointing East)
        const listener = eventListeners['deviceorientation']
        expect(listener).toBeDefined()

        listener({ webkitCompassHeading: 90 })

        expect(hasCompass.value).toBe(true)
        expect(loading.value).toBe(false)
        expect(compassRotation.value).toBe(90)
    })

    it('should process Android alpha orientation event correctly', async () => {
        const { start, compassRotation, hasCompass, loading } = useQiblaCompass()

        await start(25.0330, 121.5654)

        const listener = eventListeners['deviceorientationabsolute'] || eventListeners['deviceorientation']
        expect(listener).toBeDefined()

        // Android alpha = 270 (pointing East, 360 - 270 = 90)
        listener({ alpha: 270 })

        expect(hasCompass.value).toBe(true)
        expect(loading.value).toBe(false)
        expect(compassRotation.value).toBe(90)
    })
})
