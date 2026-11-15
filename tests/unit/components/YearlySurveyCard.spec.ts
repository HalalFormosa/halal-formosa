import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import en from '@/locales/en.json'

vi.mock('@/services/SurveyService', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/services/SurveyService')>()
    return {
        ...actual,
        SurveyService: { getCard: vi.fn(), getFlow: vi.fn(), submitAnswer: vi.fn(), dismiss: vi.fn(), adminResults: vi.fn(), adminResponses: vi.fn() },
    }
})
vi.mock('@/services/ActivityLogService', () => ({ ActivityLogService: { log: vi.fn().mockResolvedValue(undefined) } }))
vi.mock('@/composables/useRewardOverlay', () => ({ openReward: vi.fn() }))
vi.mock('@/composables/usePoints', async () => {
    const { ref } = await import('vue')
    return { currentPoints: ref<number | null>(0), usePoints: () => ({ fetchCurrentPoints: vi.fn().mockResolvedValue(undefined) }) }
})
vi.mock('@/i18n', () => ({ i18n: { global: { t: (k: string) => k } } }))
// the full-screen flow is covered elsewhere; here it only matters that the card can open it
vi.mock('@/components/survey/YearlySurveyFlow.vue', () => ({ default: { template: '<div data-testid="flow-stub" />' } }))

import YearlySurveyCard from '@/components/survey/YearlySurveyCard.vue'
import { SurveyService } from '@/services/SurveyService'
import { resetYearlySurveySession, useYearlySurvey, requestYearlySurveyFlow } from '@/composables/useYearlySurvey'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })
const passthrough = { template: '<div><slot /></div>' }
const stubs = {
    IonCard: passthrough, IonCardHeader: passthrough, IonCardTitle: passthrough, IonCardContent: passthrough,
    IonProgressBar: true, IonIcon: true, IonSpinner: true,
    IonButton: { template: '<button v-bind="$attrs"><slot /></button>' },
}

const question = {
    key: 'situation_status', placement: 'first' as const, answer_type: 'single' as const,
    prompt: { en: 'Which best describes you?' },
    options: [{ value: 'degree_student', label: { en: 'Degree student' } }],
    scale_labels: null,
}

async function mountAndAnswer(result: { answered: number; completed: boolean }) {
    vi.mocked(SurveyService.getCard).mockResolvedValue({ state: 'question', answered: 0, total: 14, question })
    vi.mocked(SurveyService.submitAnswer).mockResolvedValue({
        ok: true, already_answered: false, points: 2, total: 14, ...result,
    })
    const w = mount(YearlySurveyCard, { global: { plugins: [i18n], stubs } })
    await flushPromises()
    await w.find('[data-testid="survey-option-degree_student"]').trigger('click')
    await w.find('[data-testid="survey-submit"]').trigger('click')
    await flushPromises()
    return w
}

describe('YearlySurveyCard after an answer', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        resetYearlySurveySession()
    })

    it('thanks the user and offers to answer the rest now, with how many are left', async () => {
        const w = await mountAndAnswer({ answered: 1, completed: false })

        expect(w.find('[data-testid="survey-thanks"]').exists()).toBe(true)
        const more = w.find('[data-testid="survey-answer-more"]')
        expect(more.exists()).toBe(true)
        expect(more.text()).toContain('13')
        expect(w.find('[data-testid="survey-prompt"]').exists()).toBe(false)
    })

    it('"answer more" opens the full-screen flow', async () => {
        const w = await mountAndAnswer({ answered: 1, completed: false })
        await w.find('[data-testid="survey-answer-more"]').trigger('click')

        expect(useYearlySurvey().flowOpen.value).toBe(true)
    })

    it('"maybe later" hides the card until the next session', async () => {
        const w = await mountAndAnswer({ answered: 1, completed: false })
        await w.find('[data-testid="survey-later"]').trigger('click')

        expect(w.find('[data-testid="survey-card"]').exists()).toBe(false)
        expect(SurveyService.getCard).toHaveBeenCalledTimes(1)
    })

    it('closing the flow also clears the thank-you', async () => {
        const w = await mountAndAnswer({ answered: 1, completed: false })
        const s = useYearlySurvey()
        s.openFlow()
        await flushPromises()
        s.onFlowClosed({ answered: 14, total: 14, completed: true })
        await flushPromises()

        expect(w.find('[data-testid="survey-card"]').exists()).toBe(false)
    })

    it('after the very last question there is nothing more to offer', async () => {
        const w = await mountAndAnswer({ answered: 14, completed: true })

        expect(w.find('[data-testid="survey-thanks"]').exists()).toBe(true)
        expect(w.find('[data-testid="survey-answer-more"]').exists()).toBe(false)
    })

    it('opens the full-screen flow straight away when Home is reached through a /survey link', async () => {
        vi.mocked(SurveyService.getCard).mockResolvedValue({ state: 'question', answered: 0, total: 14, question })
        requestYearlySurveyFlow()
        mount(YearlySurveyCard, { global: { plugins: [i18n], stubs } })
        await flushPromises()

        expect(useYearlySurvey().flowOpen.value).toBe(true)
    })

    it('opens it as well when Home was already showing and the link arrives afterwards', async () => {
        vi.mocked(SurveyService.getCard).mockResolvedValue({ state: 'question', answered: 0, total: 14, question })
        mount(YearlySurveyCard, { global: { plugins: [i18n], stubs } })
        await flushPromises()
        expect(useYearlySurvey().flowOpen.value).toBe(false)

        requestYearlySurveyFlow()
        await flushPromises()
        expect(useYearlySurvey().flowOpen.value).toBe(true)
    })

    it('does not open the flow without a link', async () => {
        vi.mocked(SurveyService.getCard).mockResolvedValue({ state: 'question', answered: 0, total: 14, question })
        mount(YearlySurveyCard, { global: { plugins: [i18n], stubs } })
        await flushPromises()

        expect(useYearlySurvey().flowOpen.value).toBe(false)
    })
})
