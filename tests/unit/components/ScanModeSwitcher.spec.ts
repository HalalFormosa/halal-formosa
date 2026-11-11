import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

const state = vi.hoisted(() => ({
    replace: vi.fn(),
    back: vi.fn(),
    platform: 'android',
    paywall: vi.fn(),
    donor: { value: true },
}))

vi.mock('vue-router', () => ({ useRouter: () => ({ replace: state.replace, back: state.back }) }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string, fallback?: string) => fallback ?? key }) }))
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => state.platform } }))
vi.mock('@/utils/proPaywall', () => ({ presentProPaywall: state.paywall }))
vi.mock('@/composables/useSubscriptionStatus', () => ({ isDonor: state.donor }))

import ScanModeSwitcher from '@/components/scan/ScanModeSwitcher.vue'
import { takeScanAction } from '@/composables/useScanModeRequest'

const mountIt = (current: 'camera' | 'auto' | 'live') =>
    mount(ScanModeSwitcher, { props: { current }, global: { stubs: { IonIcon: true } } })

describe('ScanModeSwitcher', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        state.platform = 'android'
        state.donor.value = true
        state.paywall.mockResolvedValue(false)
        takeScanAction()
        window.history.replaceState({ back: '/scan' }, '')
    })

    it('always shows Gallery plus the three modes on Android', () => {
        const labels = mountIt('live').findAll('button').map(b => b.text())
        expect(labels).toEqual(['Gallery', 'Camera', 'Auto Capture', 'Live Scan'])
    })

    it('shows Live Scan on iOS too', () => {
        state.platform = 'ios'
        const labels = mountIt('auto').findAll('button').map(b => b.text())
        expect(labels).toEqual(['Gallery', 'Camera', 'Auto Capture', 'Live Scan'])
    })

    it('leaves out Live Scan where it is not available, but keeps Gallery', () => {
        state.platform = 'web'
        const labels = mountIt('auto').findAll('button').map(b => b.text())
        expect(labels).toEqual(['Gallery', 'Camera', 'Auto Capture'])
    })

    it('marks only the current mode as selected', () => {
        const buttons = mountIt('auto').findAll('button')
        const pressed = buttons.filter(b => b.attributes('aria-pressed') === 'true').map(b => b.text())
        expect(pressed).toEqual(['Auto Capture'])
        expect(buttons[0].classes()).not.toContain('active') // Gallery is never "selected"
    })

    it('does nothing when the current mode is tapped', async () => {
        const w = mountIt('live')
        await w.findAll('button')[3].trigger('click')
        expect(state.replace).not.toHaveBeenCalled()
        expect(state.back).not.toHaveBeenCalled()
    })

    it('swaps straight to the other camera modes', async () => {
        const w = mountIt('live')
        await w.findAll('button')[2].trigger('click') // Auto Capture
        expect(state.replace).toHaveBeenCalledWith('/scan/auto')
    })

    it('marks Live Scan as Pro for free users and sends them to the paywall first', async () => {
        state.donor.value = false
        const w = mountIt('camera')
        const live = w.findAll('button')[3]
        expect(live.text()).toContain('Pro')

        await live.trigger('click')
        await vi.waitFor(() => expect(state.paywall).toHaveBeenCalledWith('live_verdict'))
        expect(state.replace).not.toHaveBeenCalled() // cancelled: stay where they are

        state.paywall.mockResolvedValue(true)
        await live.trigger('click')
        await vi.waitFor(() => expect(state.replace).toHaveBeenCalledWith('/scan/live'))
    })

    it('goes straight to Live Scan for Pro users', async () => {
        const w = mountIt('camera')
        await w.findAll('button')[3].trigger('click')
        expect(state.paywall).not.toHaveBeenCalled()
        expect(state.replace).toHaveBeenCalledWith('/scan/live')
    })

    it('asks the scan page to open the native camera', async () => {
        const w = mountIt('live')
        await w.findAll('button')[1].trigger('click') // Camera
        expect(state.back).toHaveBeenCalledOnce()
        expect(takeScanAction()).toBe('camera')
    })

    it('asks the scan page to open the gallery', async () => {
        const w = mountIt('auto')
        await w.findAll('button')[0].trigger('click') // Gallery
        expect(state.back).toHaveBeenCalledOnce()
        expect(takeScanAction()).toBe('gallery')
    })
})
