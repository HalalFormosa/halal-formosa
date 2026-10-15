<template>
  <ion-card v-if="visible" class="survey-card" data-testid="survey-card">
    <ion-card-header>
      <div class="head-row">
        <ion-card-title>{{ $t('survey.cardTitle') }}</ion-card-title>
        <span class="progress-pill" data-testid="survey-progress">
          {{ $t('survey.progress', { answered: answered, total: total }) }}
        </span>
      </div>
      <ion-progress-bar :value="total ? answered / total : 0" color="carrot" class="bar" />
    </ion-card-header>

    <ion-card-content>
      <!-- thank-you after an answer -->
      <div v-if="thanks" class="thanks" data-testid="survey-thanks">
        <ion-icon :icon="checkmarkCircle" />
        <div>
          <strong>{{ thanks.completed ? $t('survey.doneAllTitle') : $t('survey.thanksTitle') }}</strong>
          <p>{{ thanks.completed ? $t('survey.doneAllBody') : $t('survey.thanksBody') }}</p>
        </div>
      </div>
      <div v-if="thanks && !thanks.completed && remaining > 0" class="more" data-testid="survey-more">
        <ion-button expand="block" color="carrot" data-testid="survey-answer-more" @click="openFlow">
          {{ $t('survey.answerMore', { count: remaining, minutes: estimateMinutes(remaining) }) }}
        </ion-button>
        <button type="button" class="link later" data-testid="survey-later" @click="thanks = null">
          {{ $t('survey.later') }}
        </button>
      </div>

      <template v-if="!thanks && question">
        <p class="intro">{{ $t('survey.cardIntro') }}</p>
        <h3 class="prompt" data-testid="survey-prompt">{{ prompt }}</h3>

        <SurveyQuestionInput v-model="value" :question="question" />
        <p v-if="error" class="error">{{ $t('survey.saveError') }}</p>

        <ion-button
          expand="block"
          color="carrot"
          class="submit"
          :disabled="!canSubmit || saving"
          data-testid="survey-submit"
          @click="submit"
        >
          <ion-spinner v-if="saving" name="dots" />
          <template v-else>{{ $t('survey.submit') }}</template>
        </ion-button>

        <ion-button
          v-if="remaining > 1"
          expand="block"
          fill="outline"
          color="carrot"
          class="all-btn"
          data-testid="survey-answer-all"
          @click="openFlow"
        >
          {{ $t('survey.answerAll', { count: remaining, minutes: estimateMinutes(remaining) }) }}
        </ion-button>

        <div class="links">
          <button type="button" class="link" data-testid="survey-not-now" @click="dismiss(false)">{{ $t('survey.notNow') }}</button>
          <button type="button" class="link" data-testid="survey-never" @click="dismiss(true)">{{ $t('survey.neverAsk') }}</button>
        </div>
      </template>
    </ion-card-content>
  </ion-card>

  <YearlySurveyFlow />
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonButton, IonIcon, IonProgressBar, IonSpinner,
} from '@ionic/vue'
import { checkmarkCircle } from 'ionicons/icons'
import SurveyQuestionInput from '@/components/survey/SurveyQuestionInput.vue'
import YearlySurveyFlow from '@/components/survey/YearlySurveyFlow.vue'
import { useYearlySurvey } from '@/composables/useYearlySurvey'
import { estimateMinutes, localizedText, type SurveyAnswer, type SurveySubmitResult } from '@/services/SurveyService'

const { locale } = useI18n()
const { card, question, answered, total, remaining, flowOpen, flowRequestedAt, consumeFlowRequest, loadCard, answerCard, dismiss, openFlow } = useYearlySurvey()

const value = ref<SurveyAnswer | null>(null)
const saving = ref(false)
const error = ref(false)
const thanks = ref<SurveySubmitResult | null>(null)

// A /survey link: open the full-screen flow, whether Home was already showing or is only now being mounted.
function openIfRequested() { if (consumeFlowRequest()) openFlow() }
onMounted(() => { loadCard(); openIfRequested() })
watch(flowRequestedAt, openIfRequested)

// Coming back from "answer the rest now" the thank-you is stale: the flow has its own finish screen.
watch(flowOpen, (open) => { if (!open) thanks.value = null })

// A new question (or a fresh flow result) clears whatever was typed for the previous one.
watch(() => question.value?.key, () => { value.value = null; error.value = false })

const prompt = computed(() => (question.value ? localizedText(question.value.prompt, locale.value) : ''))

// Shown while a question is waiting, and for the short thank-you after the user answers it.
const visible = computed(() => !!thanks.value || card.value?.state === 'question')

const canSubmit = computed(() => {
  const v = value.value
  if (v === null || v === undefined) return false
  if (typeof v === 'string') return v.trim().length > 0
  if (Array.isArray(v)) return v.length > 0
  return true
})

async function submit() {
  if (!canSubmit.value || saving.value) return
  saving.value = true
  error.value = false
  try {
    const result = await answerCard(value.value as SurveyAnswer)
    if (result) thanks.value = result
    value.value = null
  } catch (err) {
    console.warn('[YearlySurveyCard] could not save answer:', err)
    error.value = true
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.survey-card { border: 1.5px solid rgba(var(--ion-color-carrot-rgb), 0.35); }
.head-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.progress-pill {
  font-size: 0.72rem;
  font-weight: 800;
  padding: 3px 10px;
  border-radius: 999px;
  color: var(--ion-color-carrot);
  background: rgba(var(--ion-color-carrot-rgb), 0.12);
  white-space: nowrap;
}
.bar { margin-top: 10px; border-radius: 4px; }
.intro { margin: 0 0 6px; font-size: 0.8rem; color: var(--ion-color-medium); }
.prompt { margin: 0 0 14px; font-size: 1.05rem; line-height: 1.35; }
.submit { margin-top: 16px; }
.all-btn { margin-top: 4px; }
.error { color: var(--ion-color-danger); font-size: 0.85rem; margin: 8px 0 0; }
.links { display: flex; justify-content: space-between; margin-top: 8px; }
.link {
  background: none;
  border: none;
  padding: 8px 4px;
  color: var(--ion-color-medium);
  font-size: 0.8rem;
  text-decoration: underline;
  cursor: pointer;
}
.thanks { display: flex; gap: 12px; align-items: center; }
.thanks ion-icon { font-size: 40px; color: var(--ion-color-success); flex: 0 0 auto; }
.thanks p { margin: 2px 0 0; font-size: 0.85rem; color: var(--ion-color-medium); }
.more { margin-top: 14px; }
.later { display: block; margin: 4px auto 0; }
</style>
