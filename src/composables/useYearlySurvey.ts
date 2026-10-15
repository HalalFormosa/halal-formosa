import { ref, computed } from 'vue'
import { supabase } from '@/plugins/supabaseClient'
import { usePoints, currentPoints } from '@/composables/usePoints'
import { openReward } from '@/composables/useRewardOverlay'
import { ActivityLogService } from '@/services/ActivityLogService'
import {
  SurveyService,
  type SurveyAnswer,
  type SurveyCard,
  type SurveyQuestion,
  type SurveySubmitResult,
} from '@/services/SurveyService'
import { i18n } from '@/i18n'

// Module-level so every Home mount in the same app session shares one decision: the card asks for ONE question per
// session. Asking the server again would hand out a new question after a tab switch.
const card = ref<SurveyCard | null>(null)
const loaded = ref(false)
const loading = ref(false)
const flowOpen = ref(false)

/** Test hook: lets a new test start from a fresh session. */
export function resetYearlySurveySession() {
  card.value = null
  loaded.value = false
  loading.value = false
  flowOpen.value = false
}

export function useYearlySurvey() {
  const { fetchCurrentPoints } = usePoints()

  const question = computed<SurveyQuestion | null>(() =>
    card.value?.state === 'question' ? card.value.question ?? null : null
  )
  const answered = computed(() => card.value?.answered ?? 0)
  const total = computed(() => card.value?.total ?? 0)
  const remaining = computed(() => Math.max(0, total.value - answered.value))

  async function loadCard() {
    if (loaded.value || loading.value) return
    loading.value = true
    try {
      card.value = await SurveyService.getCard()
      loaded.value = true
      if (card.value.state === 'question') {
        ActivityLogService.log('survey_question_shown', { question_key: card.value.question?.key })
      }
    } catch (err) {
      console.warn('[useYearlySurvey] could not load the survey card:', err)
      card.value = null
    } finally {
      loading.value = false
    }
  }

  /** Keeps the points counter in step with what the server awarded. */
  async function syncPoints(points: number) {
    if (!points) return
    currentPoints.value = (currentPoints.value ?? 0) + points
    const session = (await supabase.auth.getSession()).data.session
    if (session?.user?.id) fetchCurrentPoints(session.user.id)
  }

  /** Points toast for answers given one at a time on the Home card. */
  async function celebrate(result: SurveySubmitResult) {
    if (!result.points) return
    const session = (await supabase.auth.getSession()).data.session
    const avatar = session?.user?.user_metadata?.avatar_url || ''
    const label = result.bonus ? i18n.global.t('survey.rewardComplete') : i18n.global.t('survey.rewardAnswer')
    openReward(result.points, label, avatar, (currentPoints.value ?? 0) + result.points)
    await syncPoints(result.points)
  }

  /** Saves one answer from the Home card; the card then thanks the user and hides until the next session. */
  async function answerCard(value: SurveyAnswer): Promise<SurveySubmitResult | null> {
    const q = question.value
    if (!q) return null
    const result = await saveAnswer(q.key, value)
    if (card.value) {
      card.value = {
        state: result.completed ? 'complete' : 'cooldown',
        answered: result.answered,
        total: result.total,
      }
    }
    return result
  }

  /**
   * Shared by the card and the full-screen flow. The flow passes `toast: false` and shows one summary at the end
   * instead of a toast per answer.
   */
  async function saveAnswer(
    questionKey: string,
    value: SurveyAnswer,
    opts: { toast?: boolean } = {}
  ): Promise<SurveySubmitResult> {
    const result = await SurveyService.submitAnswer(questionKey, value)
    ActivityLogService.log('survey_answered', { question_key: questionKey, completed: result.completed })
    if (opts.toast === false) await syncPoints(result.points)
    else await celebrate(result)
    return result
  }

  async function dismiss(forever: boolean) {
    try {
      await SurveyService.dismiss(forever)
      ActivityLogService.log('survey_dismissed', { forever })
    } catch (err) {
      console.warn('[useYearlySurvey] dismiss failed:', err)
    }
    if (card.value) card.value = { ...card.value, state: 'snoozed' }
  }

  function openFlow() {
    flowOpen.value = true
    ActivityLogService.log('survey_flow_started', { answered: answered.value })
  }

  /** Called when the full-screen flow closes so the Home card reflects the new progress. */
  function onFlowClosed(progress?: { answered: number; total: number; completed: boolean }) {
    flowOpen.value = false
    if (progress && card.value) {
      card.value = {
        state: progress.completed ? 'complete' : 'cooldown',
        answered: progress.answered,
        total: progress.total,
      }
    }
  }

  return {
    card,
    question,
    answered,
    total,
    remaining,
    loading,
    flowOpen,
    loadCard,
    answerCard,
    saveAnswer,
    dismiss,
    openFlow,
    onFlowClosed,
  }
}
