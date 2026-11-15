import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '@/plugins/supabaseClient'
import { SurveyService, localizedText, estimateMinutes } from '@/services/SurveyService'

const rpc = vi.fn()
;(supabase as any).rpc = rpc

describe('localizedText', () => {
    const t = { en: 'Hello', id: 'Halo', 'zh-CN': '你好' }

    it('uses the exact locale first', () => {
        expect(localizedText(t, 'id')).toBe('Halo')
        expect(localizedText(t, 'zh-CN')).toBe('你好')
    })

    it('falls back from a regional locale to its base language, then to English', () => {
        expect(localizedText({ en: 'Hi', zh: '嗨' }, 'zh-TW')).toBe('嗨')
        expect(localizedText(t, 'ko')).toBe('Hello')
    })

    it('uses any available text when English is missing, and an empty string for nothing', () => {
        expect(localizedText({ id: 'Halo' }, 'ko')).toBe('Halo')
        expect(localizedText(null, 'en')).toBe('')
        expect(localizedText(undefined, 'en')).toBe('')
    })
})

describe('estimateMinutes', () => {
    it('is at least one minute and grows with the questions left', () => {
        expect(estimateMinutes(1)).toBe(1)
        expect(estimateMinutes(5)).toBe(1)
        expect(estimateMinutes(14)).toBe(3)
    })
})

describe('SurveyService', () => {
    beforeEach(() => rpc.mockReset())

    it('asks the server for the card and the flow', async () => {
        rpc.mockResolvedValue({ data: { state: 'cooldown' }, error: null })
        await expect(SurveyService.getCard()).resolves.toEqual({ state: 'cooldown' })
        expect(rpc).toHaveBeenCalledWith('survey_get_card', undefined)

        await SurveyService.getFlow()
        expect(rpc).toHaveBeenLastCalledWith('survey_get_flow', undefined)
    })

    it('sends the answer exactly as the server function expects it', async () => {
        rpc.mockResolvedValue({ data: { ok: true, points: 2 }, error: null })
        await SurveyService.submitAnswer('features_used', ['scan_barcode', 'qibla'])
        expect(rpc).toHaveBeenCalledWith('survey_submit_answer', {
            p_question_key: 'features_used',
            p_answer: ['scan_barcode', 'qibla'],
        })
    })

    it('maps dismiss to "not now" (7 days) or "don\'t ask again"', async () => {
        rpc.mockResolvedValue({ data: null, error: null })
        await SurveyService.dismiss()
        expect(rpc).toHaveBeenLastCalledWith('survey_dismiss', { p_forever: false })
        await SurveyService.dismiss(true)
        expect(rpc).toHaveBeenLastCalledWith('survey_dismiss', { p_forever: true })
    })

    it('passes the admin filters through', async () => {
        rpc.mockResolvedValue({ data: { respondents: 0 }, error: null })
        await SurveyService.adminResults(2, 'degree_student')
        expect(rpc).toHaveBeenCalledWith('survey_admin_results', { p_cycle: 2, p_status: 'degree_student' })
        await SurveyService.adminResponses(null)
        expect(rpc).toHaveBeenLastCalledWith('survey_admin_responses', { p_cycle: null })
    })

    it('throws the database error so callers can show it', async () => {
        rpc.mockResolvedValue({ data: null, error: { message: 'admin only' } })
        await expect(SurveyService.adminResults(null, null)).rejects.toEqual({ message: 'admin only' })
    })
})
