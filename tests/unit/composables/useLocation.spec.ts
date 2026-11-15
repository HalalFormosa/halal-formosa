import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLocation } from '@/composables/useLocation'
import { Geolocation } from '@capacitor/geolocation'

vi.mock('@capacitor/geolocation', () => ({
    Geolocation: {
        checkPermissions: vi.fn().mockResolvedValue({ location: 'granted' }),
        requestPermissions: vi.fn(),
        getCurrentPosition: vi.fn().mockResolvedValue({ coords: { latitude: 25.0330, longitude: 121.5654 } }),
        watchPosition: vi.fn().mockImplementation((options: any, callback: any) => {
            callback({ coords: { latitude: 25.0330, longitude: 121.5654 } }, null)
            return Promise.resolve('watch-123')
        }),
        clearWatch: vi.fn().mockResolvedValue(undefined)
    }
}))

vi.mock('@capacitor/core', () => ({
    Capacitor: { isNativePlatform: vi.fn().mockReturnValue(true) }
}))

describe('useLocation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should start watching and fetch user location', async () => {
        const { startWatching, userLocation, isLocating, locationAttemptFinished } = useLocation()
        
        await startWatching()

        expect(isLocating.value).toBe(false)
        expect(locationAttemptFinished.value).toBe(true)
        expect(userLocation.value).toEqual({ lat: 25.0330, lng: 121.5654 })
    })

    it('should stop watching location', async () => {
        const { stopWatching } = useLocation()
        await stopWatching()
        expect(Geolocation.clearWatch).toHaveBeenCalled()
    })
})
