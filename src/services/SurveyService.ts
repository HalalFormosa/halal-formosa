import { supabase } from '@/plugins/supabaseClient'

export type SurveyAnswerType = 'scale_5' | 'nps' | 'single' | 'multi' | 'text'
export type SurveyAnswer = number | string | string[]
export type LocalizedText = Record<string, string>

export interface SurveyOption {
  value: string
  label: LocalizedText
}

export interface SurveyQuestion {
  key: string
  placement: 'first' | 'middle' | 'last'
  answer_type: SurveyAnswerType
  prompt: LocalizedText
  options: SurveyOption[] | null
  scale_labels: { min: LocalizedText; max: LocalizedText } | null
}

export type SurveyCardState = 'ineligible' | 'complete' | 'snoozed' | 'cooldown' | 'question'

export interface SurveyCard {
  state: SurveyCardState
  answered?: number
  total?: number
  question?: SurveyQuestion
}

export interface SurveyFlow {
  state: 'ineligible' | 'complete' | 'flow'
  answered: number
  total: number
  questions: SurveyQuestion[]
}

export interface SurveySubmitResult {
  ok: boolean
  already_answered: boolean
  points: number
  answered: number
  total: number
  completed: boolean
  bonus?: boolean
}

export interface SurveyResultQuestion {
  key: string
  answer_type: SurveyAnswerType
  prompt: LocalizedText
  options: SurveyOption[] | null
  n: number
  distribution: Record<string, number> | null
  average: number | null
  nps: number | null
  texts: { text: string; at: string }[] | null
}

export interface SurveyResults {
  respondents: number
  completed: number
  total_questions: number
  cycles: number[]
  questions: SurveyResultQuestion[]
}

export interface SurveyResponseRow {
  user_ref: string
  cycle: number
  question_key: string
  answer: unknown
  answered_at: string
}

/** Picks the text for `locale`, falling back to English, then to whatever exists. */
export function localizedText(text: LocalizedText | null | undefined, locale: string): string {
  if (!text) return ''
  return text[locale] ?? text[locale.split('-')[0]] ?? text.en ?? Object.values(text)[0] ?? ''
}

/** Rough time to answer the remaining questions, for the "answer all now" button. */
export function estimateMinutes(remaining: number): number {
  return Math.max(1, Math.round((remaining * 12) / 60))
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw error
  return data as T
}

export const SurveyService = {
  getCard: () => rpc<SurveyCard>('survey_get_card'),
  getFlow: () => rpc<SurveyFlow>('survey_get_flow'),
  submitAnswer: (questionKey: string, answer: SurveyAnswer) =>
    rpc<SurveySubmitResult>('survey_submit_answer', { p_question_key: questionKey, p_answer: answer }),
  dismiss: async (forever = false) => {
    await rpc<null>('survey_dismiss', { p_forever: forever })
  },
  adminResults: (cycle: number | null, status: string | null) =>
    rpc<SurveyResults>('survey_admin_results', { p_cycle: cycle, p_status: status }),
  adminResponses: (cycle: number | null) =>
    rpc<SurveyResponseRow[]>('survey_admin_responses', { p_cycle: cycle }),
}
