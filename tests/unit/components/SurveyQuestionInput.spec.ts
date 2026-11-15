import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import SurveyQuestionInput from '@/components/survey/SurveyQuestionInput.vue'
import type { SurveyQuestion } from '@/services/SurveyService'

const i18n = createI18n({ legacy: false, locale: 'id', fallbackLocale: 'en', messages: { en: { survey: { textPlaceholder: 'Type' } } } })

const base = { key: 'q', placement: 'middle' as const, prompt: { en: 'Q' }, options: null, scale_labels: null }
const mountInput = (question: SurveyQuestion, modelValue: any = null) =>
    mount(SurveyQuestionInput, { props: { question, modelValue }, global: { plugins: [i18n] } })

describe('SurveyQuestionInput', () => {
    it('a 1–5 scale offers five buttons and reports the number tapped', async () => {
        const w = mountInput({ ...base, answer_type: 'scale_5', scale_labels: { min: { en: 'Low' }, max: { en: 'High' } } })
        expect(w.findAll('.scale-btn')).toHaveLength(5)
        expect(w.text()).toContain('Low')
        expect(w.text()).toContain('High')
        await w.find('[data-testid="survey-scale-4"]').trigger('click')
        expect(w.emitted('update:modelValue')![0]).toEqual([4])
    })

    it('the recommend question runs from 0 to 10', async () => {
        const w = mountInput({ ...base, answer_type: 'nps' })
        expect(w.findAll('.scale-btn')).toHaveLength(11)
        await w.find('[data-testid="survey-scale-0"]').trigger('click')
        expect(w.emitted('update:modelValue')![0]).toEqual([0])
    })

    it('single choice shows the label in the current language and reports the value', async () => {
        const w = mountInput({
            ...base, answer_type: 'single',
            options: [{ value: 'daily', label: { en: 'Every day', id: 'Setiap hari' } }, { value: 'rarely', label: { en: 'Rarely', id: 'Jarang' } }],
        }, 'daily')
        expect(w.text()).toContain('Setiap hari')
        expect(w.find('[data-testid="survey-option-daily"]').classes()).toContain('selected')
        await w.find('[data-testid="survey-option-rarely"]').trigger('click')
        expect(w.emitted('update:modelValue')![0]).toEqual(['rarely'])
    })

    it('multi choice adds and removes choices, and reports nothing selected as null', async () => {
        const options = [{ value: 'a', label: { en: 'A' } }, { value: 'b', label: { en: 'B' } }]
        const w = mountInput({ ...base, answer_type: 'multi', options }, ['a'])
        await w.find('[data-testid="survey-option-b"]').trigger('click')
        expect(w.emitted('update:modelValue')![0]).toEqual([['a', 'b']])
        await w.find('[data-testid="survey-option-a"]').trigger('click')
        expect(w.emitted('update:modelValue')![1]).toEqual([null])
    })

    it('free text reports what is typed and counts characters', async () => {
        const w = mountInput({ ...base, answer_type: 'text' }, 'hello')
        expect(w.text()).toContain('5/1000')
        await w.find('textarea').setValue('hello world')
        expect(w.emitted('update:modelValue')![0]).toEqual(['hello world'])
    })
})
