import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

const state = vi.hoisted(() => ({ log: vi.fn() }))
vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string, params?: Record<string, string>) => params ? `${key}|${params.ingredient}` : key }),
}))
vi.mock('@/services/ActivityLogService', () => ({ ActivityLogService: { log: state.log } }))

import AiExplanationTeaser from '@/components/scan/AiExplanationTeaser.vue'

const IonButton = { template: '<button><slot /></button>' }
const mountIt = () =>
    mount(AiExplanationTeaser, {
        props: { ingredient: 'E471' },
        global: { stubs: { IonButton, IonIcon: true } },
    })

describe('AiExplanationTeaser', () => {
    beforeEach(() => state.log.mockClear())

    it('names the flagged ingredient in its title', () => {
        expect(mountIt().find('h3').text()).toBe('scanIngredients.aiSummary.teaser.title|E471')
    })

    it('says the verdict stays free', () => {
        expect(mountIt().text()).toContain('scanIngredients.aiSummary.teaser.note')
    })

    it('asks to unlock when the button is tapped', async () => {
        const w = mountIt()
        await w.find('button').trigger('click')
        expect(w.emitted('unlock')).toHaveLength(1)
    })

    it('logs that the teaser was shown', () => {
        mountIt()
        expect(state.log).toHaveBeenCalledWith('ai_teaser_shown', { ingredient: 'E471' })
    })
})
