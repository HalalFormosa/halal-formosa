import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ScanDecisionPrompt from '@/components/ScanDecisionPrompt.vue'
import { ActivityLogService } from '@/services/ActivityLogService'

vi.mock('@/services/ActivityLogService', () => ({
    ActivityLogService: { log: vi.fn().mockResolvedValue(undefined) },
}))

const factory = (props: { scanKey: number; status: string | null }) =>
    mount(ScanDecisionPrompt, {
        props,
        global: { mocks: { $t: (k: string) => k }, stubs: { IonIcon: true } },
    })

describe('ScanDecisionPrompt', () => {
    beforeEach(() => vi.clearAllMocks())
    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllEnvs()
    })

    it('shows three choices on every verdict result by default', () => {
        // even an unlucky random roll must not hide it when no rate is configured
        vi.spyOn(Math, 'random').mockReturnValue(0.99)
        for (const status of ['Muslim-friendly', 'Syubhah', 'Haram']) {
            const w = factory({ scanKey: 1, status })
            expect(w.findAll('button.decision-btn')).toHaveLength(3)
        }
    })

    it('can be sampled with VITE_DECISION_PROMPT_RATE', () => {
        vi.stubEnv('VITE_DECISION_PROMPT_RATE', '0.5')
        const random = vi.spyOn(Math, 'random')

        random.mockReturnValue(0.1)
        expect(factory({ scanKey: 1, status: 'Syubhah' }).find('.decision-prompt').exists()).toBe(true)

        random.mockReturnValue(0.9)
        expect(factory({ scanKey: 1, status: 'Syubhah' }).find('.decision-prompt').exists()).toBe(false)
    })

    it('never shows without a verdict', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0)
        expect(factory({ scanKey: 1, status: 'No ingredients detected' }).find('.decision-prompt').exists()).toBe(false)
        expect(factory({ scanKey: 1, status: null }).find('.decision-prompt').exists()).toBe(false)
    })

    it('logs one scan_decision event and then shows thanks', async () => {
        vi.spyOn(Math, 'random').mockReturnValue(0)
        const w = factory({ scanKey: 1, status: 'Haram' })

        await w.find('.decision-btn-skip').trigger('click')
        await w.vm.$nextTick()

        expect(ActivityLogService.log).toHaveBeenCalledTimes(1)
        expect(ActivityLogService.log).toHaveBeenCalledWith('scan_decision', {
            choice: 'skip',
            auto_status: 'Haram',
            source: 'ingredient_scan',
        })
        expect(w.find('.decision-thanks').exists()).toBe(true)
        expect(w.findAll('button.decision-btn')).toHaveLength(0)
    })

    it('explains how the answer is used when the info icon is tapped, and logs nothing', async () => {
        vi.spyOn(Math, 'random').mockReturnValue(0)
        const w = factory({ scanKey: 1, status: 'Syubhah' })
        expect(w.find('.decision-info').exists()).toBe(false)

        await w.find('.decision-info-btn').trigger('click')
        expect(w.find('.decision-info').exists()).toBe(true)

        await w.find('.decision-info-btn').trigger('click')
        expect(w.find('.decision-info').exists()).toBe(false)
        expect(ActivityLogService.log).not.toHaveBeenCalled()
    })

    it('re-rolls and resets when a new scan result arrives', async () => {
        const random = vi.spyOn(Math, 'random').mockReturnValue(0)
        const w = factory({ scanKey: 1, status: 'Haram' })
        await w.find('.decision-btn-use').trigger('click')
        expect(w.find('.decision-thanks').exists()).toBe(true)

        random.mockReturnValue(0)
        await w.setProps({ scanKey: 2, status: 'Muslim-friendly' })
        expect(w.findAll('button.decision-btn')).toHaveLength(3)
    })
})
