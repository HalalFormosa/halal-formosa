import { describe, it, expect, vi, beforeEach } from 'vitest'
import { switchScanMode, takeScanAction } from '@/composables/useScanModeRequest'

function fakeRouter() {
    return { replace: vi.fn(), back: vi.fn() }
}

describe('switchScanMode', () => {
    beforeEach(() => {
        takeScanAction() // clear anything left over
    })

    it('replaces the current screen when switching to Auto Scan or Live Verdict', () => {
        const router = fakeRouter()
        switchScanMode(router, 'auto', '/scan')
        switchScanMode(router, 'live', '/scan')
        expect(router.replace).toHaveBeenNthCalledWith(1, '/scan/auto')
        expect(router.replace).toHaveBeenNthCalledWith(2, '/scan/live')
        expect(router.back).not.toHaveBeenCalled()
        expect(takeScanAction()).toBeNull()
    })

    it('goes back to the scan page and asks it to open the camera', () => {
        const router = fakeRouter()
        switchScanMode(router, 'camera', '/scan')
        expect(router.back).toHaveBeenCalledOnce()
        expect(router.replace).not.toHaveBeenCalled()
        expect(takeScanAction()).toBe('camera')
    })

    it('goes back to the scan page and asks it to open the gallery', () => {
        const router = fakeRouter()
        switchScanMode(router, 'gallery', '/scan?x=1')
        expect(router.back).toHaveBeenCalledOnce()
        expect(takeScanAction()).toBe('gallery')
    })

    it('opens the scan page itself when it is not right behind us', () => {
        const router = fakeRouter()
        switchScanMode(router, 'camera', '/home')
        switchScanMode(router, 'gallery', null)
        expect(router.back).not.toHaveBeenCalled()
        expect(router.replace).toHaveBeenCalledTimes(2)
        expect(router.replace).toHaveBeenCalledWith('/scan')
    })

    it('does not treat /scan/auto as the scan page', () => {
        const router = fakeRouter()
        switchScanMode(router, 'camera', '/scan/auto')
        expect(router.back).not.toHaveBeenCalled()
        expect(router.replace).toHaveBeenCalledWith('/scan')
    })
})

describe('takeScanAction', () => {
    it('hands the waiting action over once', () => {
        switchScanMode(fakeRouter(), 'camera', '/scan')
        expect(takeScanAction()).toBe('camera')
        expect(takeScanAction()).toBeNull()
    })
})
