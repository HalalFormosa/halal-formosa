import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string, params?: Record<string, number>) => (params ? `${key}|${params.count}` : key) }),
}))
vi.mock('@/utils/proPaywall', () => ({ presentProPaywall: vi.fn() }))

import ScanMilestoneSheet from '@/components/scan/ScanMilestoneSheet.vue'
import ProUpsellSheet from '@/components/ProUpsellSheet.vue'
import { canAutoShowPaywall } from '@/utils/paywallCap'

// Render the real sheet's slot so the benefit list is visible, but not the Ionic modal itself.
const IonModal = { props: ['isOpen'], template: '<div v-if="isOpen"><slot /></div>' }
const mountIt = () =>
    mount(ScanMilestoneSheet, {
        props: { open: true },
        global: { stubs: { IonModal, IonButton: { template: '<button><slot /></button>' }, IonIcon: true } },
    })

describe('ScanMilestoneSheet', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('celebrates the milestone and offers Pro without a free alternative', () => {
        const w = mountIt()
        const sheet = w.findComponent(ProUpsellSheet)
        expect(sheet.props('source')).toBe('scan_milestone')
        expect(sheet.props('title')).toBe('home.scanMilestone.title|10')
        expect(sheet.props('secondaryLabel')).toBeUndefined()
    })

    it('lists what Pro adds', () => {
        const items = mountIt().findAll('li').map(li => li.text())
        expect(items).toEqual([
            'home.scanMilestone.benefitScans',
            'home.scanMilestone.benefitAi',
            'home.scanMilestone.benefitHistory',
        ])
    })

    it('counts walking away as a dismissal, so other app-opened prompts hold back', () => {
        const w = mountIt()
        expect(canAutoShowPaywall()).toBe(true)
        w.findComponent(ProUpsellSheet).vm.$emit('dismissed')
        expect(canAutoShowPaywall()).toBe(false)
    })
})
