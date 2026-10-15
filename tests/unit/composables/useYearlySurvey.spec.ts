import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/services/SurveyService', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/services/SurveyService')>()
    return {
        ...actual,
        SurveyService: {
            getCard: vi.fn(),
            getFlow: vi.fn(),
            submitAnswer: vi.fn(),
            dismiss: vi.fn(),
            adminResults: vi.fn(),
            adminResponses: vi.fn(),
        },
    }
})
vi.mock('@/services/ActivityLogService', () => ({
    ActivityLogService: { log: vi.fn().mockResolvedValue(undefined) },
}))
vi.mock('@/composables/useRewardOverlay', () => ({ openReward: vi.fn() }))
vi.mock('@/composables/usePoints', async () => {
    const { ref } = await import('vue')
    return {
        currentPoints: ref<number | null>(100),
        usePoints: () => ({ fetchCurrentPoints: vi.fn().mockResolvedValue(undefined) }),
    }
})
vi.mock('@/i18n', () => ({ i18n: { global: { t: (k: string) => k } } }))

import { useYearlySurvey, resetYearlySurveySession } from '@/composables/useYearlySurvey'
import { SurveyService } from '@/services/SurveyService'
import { openReward } from '@/composables/useRewardOverlay'
import { currentPoints } from '@/composables/usePoints'

const question = {
    key: 'nps',
    placement: 'middle' as const,
    answer_type: 'nps' as const,
    prompt: { en: 'How likely?' },
    options: null,
    scale_labels: null,
}

describe('useYearlySurvey', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        resetYearlySurveySession()
        currentPoints.value = 100
    })

    it('asks the server once per session, even if Home mounts again', async () => {
        vi.mocked(SurveyService.getCard).mockResolvedValue({ state: 'question', answered: 3, total: 14, question })
        const a = useYearlySurvey()
        await a.loadCard()
        await useYearlySurvey().loadCard()

        expect(SurveyService.getCard).toHaveBeenCalledTimes(1)
        expect(a.question.value?.key).toBe('nps')
        expect(a.remaining.value).toBe(11)
    })

    it('has no question to show when the server says cooldown, snoozed or complete', async () => {
        for (const state of ['cooldown', 'snoozed', 'complete', 'ineligible'] as const) {
            resetYearlySurveySession()
            vi.mocked(SurveyService.getCard).mockResolvedValue({ state })
            const s = useYearlySurvey()
            await s.loadCard()
            expect(s.question.value).toBeNull()
        }
    })

    it('hides the card (without crashing) when the server call fails', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        vi.mocked(SurveyService.getCard).mockRejectedValue(new Error('network'))
        const s = useYearlySurvey()
        await expect(s.loadCard()).resolves.toBeUndefined()
        expect(s.question.value).toBeNull()
    })

    it('saves an answer, shows the points toast and moves the card to "cooldown"', async () => {
        vi.mocked(SurveyService.getCard).mockResolvedValue({ state: 'question', answered: 3, total: 14, question })
        vi.mocked(SurveyService.submitAnswer).mockResolvedValue({
            ok: true, already_answered: false, points: 2, answered: 4, total: 14, completed: false,
        })
        const s = useYearlySurvey()
        await s.loadCard()
        const result = await s.answerCard(9)

        expect(SurveyService.submitAnswer).toHaveBeenCalledWith('nps', 9)
        expect(result?.points).toBe(2)
        expect(openReward).toHaveBeenCalledTimes(1)
        expect(currentPoints.value).toBe(102)
        expect(s.card.value).toMatchObject({ state: 'cooldown', answered: 4, total: 14 })
        expect(s.question.value).toBeNull()
    })

    it('marks the card complete after the last answer and calls the bonus out in the toast', async () => {
        vi.mocked(SurveyService.getCard).mockResolvedValue({ state: 'question', answered: 13, total: 14, question })
        vi.mocked(SurveyService.submitAnswer).mockResolvedValue({
            ok: true, already_answered: false, points: 22, answered: 14, total: 14, completed: true, bonus: true,
        })
        const s = useYearlySurvey()
        await s.loadCard()
        await s.answerCard(8)

        expect(s.card.value?.state).toBe('complete')
        expect(vi.mocked(openReward).mock.calls[0][1]).toBe('survey.rewardComplete')
    })

    it('does not show a toast for an answer that earned nothing (already answered)', async () => {
        vi.mocked(SurveyService.submitAnswer).mockResolvedValue({
            ok: true, already_answered: true, points: 0, answered: 4, total: 14, completed: false,
        })
        await useYearlySurvey().saveAnswer('nps', 9)
        expect(openReward).not.toHaveBeenCalled()
        expect(currentPoints.value).toBe(100)
    })

    it('flow answers skip the per-answer toast but still keep the points counter right', async () => {
        vi.mocked(SurveyService.submitAnswer).mockResolvedValue({
            ok: true, already_answered: false, points: 2, answered: 5, total: 14, completed: false,
        })
        await useYearlySurvey().saveAnswer('nps', 9, { toast: false })
        expect(openReward).not.toHaveBeenCalled()
        expect(currentPoints.value).toBe(102)
    })

    it('lets the error from a failed save reach the caller so the UI can show a message', async () => {
        vi.mocked(SurveyService.submitAnswer).mockRejectedValue(new Error('offline'))
        await expect(useYearlySurvey().saveAnswer('nps', 9)).rejects.toThrow('offline')
    })

    it('dismissing hides the card and tells the server whether it is for good', async () => {
        vi.mocked(SurveyService.getCard).mockResolvedValue({ state: 'question', answered: 3, total: 14, question })
        vi.mocked(SurveyService.dismiss).mockResolvedValue(undefined)
        const s = useYearlySurvey()
        await s.loadCard()
        await s.dismiss(true)

        expect(SurveyService.dismiss).toHaveBeenCalledWith(true)
        expect(s.question.value).toBeNull()
    })

    it('the flow closing updates the card with the new progress', async () => {
        vi.mocked(SurveyService.getCard).mockResolvedValue({ state: 'question', answered: 3, total: 14, question })
        const s = useYearlySurvey()
        await s.loadCard()
        s.openFlow()
        expect(s.flowOpen.value).toBe(true)

        s.onFlowClosed({ answered: 14, total: 14, completed: true })
        expect(s.flowOpen.value).toBe(false)
        expect(s.card.value).toMatchObject({ state: 'complete', answered: 14 })
    })
})
