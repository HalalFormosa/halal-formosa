<template>
  <ion-modal :is-open="flowOpen" class="survey-flow-modal" @didPresent="start" @didDismiss="finishClose">
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ $t('survey.flowTitle') }}</ion-title>
        <ion-buttons slot="end">
          <ion-button data-testid="survey-flow-close" @click="flowOpen = false">
            <ion-icon slot="icon-only" :icon="closeOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-progress-bar v-if="!loading && !done && questions.length" :value="progressValue" color="carrot" />
    </ion-header>

    <ion-content class="ion-padding">
      <div v-if="loading" class="center-box"><ion-spinner name="crescent" /></div>

      <div v-else-if="errorKey" class="center-box" data-testid="survey-flow-error">
        <p>{{ $t(errorKey) }}</p>
        <ion-button fill="outline" color="carrot" @click="start">{{ $t('survey.retry') }}</ion-button>
      </div>

      <div v-else-if="notAvailable" class="center-box" data-testid="survey-flow-unavailable">
        <p>{{ $t('survey.notAvailable') }}</p>
        <ion-button fill="outline" color="carrot" @click="flowOpen = false">{{ $t('survey.close') }}</ion-button>
      </div>

      <!-- thank-you -->
      <div v-else-if="done" class="center-box done-box" data-testid="survey-flow-done">
        <div class="done-icon"><ion-icon :icon="checkmarkCircle" /></div>
        <h2>{{ finishedAll ? $t('survey.doneAllTitle') : $t('survey.doneSomeTitle') }}</h2>
        <p>{{ finishedAll ? $t('survey.doneAllBody') : $t('survey.doneSomeBody') }}</p>
        <p v-if="earned > 0" class="earned">{{ $t('survey.earned', { points: earned }) }}</p>
        <ion-button expand="block" color="carrot" data-testid="survey-flow-finish" @click="flowOpen = false">
          {{ $t('survey.close') }}
        </ion-button>
      </div>

      <!-- one question per screen -->
      <div v-else-if="current" class="question-box">
        <div class="step-label" data-testid="survey-flow-step">
          {{ $t('survey.stepOf', { current: stepNumber, total: totalSteps }) }}
        </div>
        <h2 class="prompt">{{ prompt(current) }}</h2>
        <SurveyQuestionInput v-model="value" :question="current" />
        <p v-if="saveError" class="save-error">{{ $t('survey.saveError') }}</p>
      </div>
    </ion-content>

    <ion-footer v-if="!loading && !done && !errorKey && !notAvailable && current">
      <ion-toolbar>
        <div class="footer-row">
          <ion-button fill="clear" color="medium" :disabled="saving" data-testid="survey-flow-skip" @click="skip">
            {{ $t('survey.skip') }}
          </ion-button>
          <ion-button color="carrot" :disabled="!canSubmit || saving" data-testid="survey-flow-next" @click="next">
            <ion-spinner v-if="saving" name="dots" />
            <template v-else>{{ isLast ? $t('survey.finish') : $t('survey.next') }}</template>
          </ion-button>
        </div>
      </ion-toolbar>
    </ion-footer>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent, IonFooter,
  IonProgressBar, IonSpinner,
} from '@ionic/vue'
import { closeOutline, checkmarkCircle } from 'ionicons/icons'
import SurveyQuestionInput from '@/components/survey/SurveyQuestionInput.vue'
import { useYearlySurvey } from '@/composables/useYearlySurvey'
import { SurveyService, localizedText, type SurveyAnswer, type SurveyQuestion } from '@/services/SurveyService'

const { locale } = useI18n()
const { flowOpen, saveAnswer, onFlowClosed } = useYearlySurvey()

const loading = ref(false)
const errorKey = ref<string | null>(null)
const saveError = ref(false)
const saving = ref(false)
const done = ref(false)
const notAvailable = ref(false)

const questions = ref<SurveyQuestion[]>([])
const index = ref(0)
const value = ref<SurveyAnswer | null>(null)

const baseAnswered = ref(0)
const total = ref(0)
const answeredNow = ref(0)
const earned = ref(0)
const skipped = ref(0)
const completed = ref(false)

const current = computed(() => questions.value[index.value] ?? null)
const isLast = computed(() => index.value >= questions.value.length - 1)
const totalSteps = computed(() => questions.value.length)
const stepNumber = computed(() => Math.min(index.value + 1, totalSteps.value))
const progressValue = computed(() => (totalSteps.value ? index.value / totalSteps.value : 0))
const finishedAll = computed(() => completed.value)

const prompt = (q: SurveyQuestion) => localizedText(q.prompt, locale.value)

const canSubmit = computed(() => {
  const v = value.value
  if (v === null || v === undefined) return false
  if (typeof v === 'string') return v.trim().length > 0
  if (Array.isArray(v)) return v.length > 0
  return true
})

async function start() {
  loading.value = true
  errorKey.value = null
  saveError.value = false
  done.value = false
  notAvailable.value = false
  index.value = 0
  value.value = null
  earned.value = 0
  skipped.value = 0
  answeredNow.value = 0
  try {
    const flow = await SurveyService.getFlow()
    baseAnswered.value = flow.answered
    total.value = flow.total
    completed.value = flow.state === 'complete'
    questions.value = flow.state === 'flow' ? flow.questions : []
    if (flow.state === 'ineligible') notAvailable.value = true
    else if (!questions.value.length) done.value = true
  } catch (err) {
    console.warn('[YearlySurveyFlow] could not load questions:', err)
    errorKey.value = 'survey.loadError'
  } finally {
    loading.value = false
  }
}

function advance() {
  value.value = null
  saveError.value = false
  if (isLast.value) {
    done.value = true
  } else {
    index.value += 1
  }
}

async function next() {
  const q = current.value
  if (!q || !canSubmit.value || saving.value) return
  saving.value = true
  saveError.value = false
  try {
    const result = await saveAnswer(q.key, value.value as SurveyAnswer, { toast: false })
    earned.value += result.points
    answeredNow.value = result.answered - baseAnswered.value
    completed.value = result.completed
    advance()
  } catch (err) {
    console.warn('[YearlySurveyFlow] could not save answer:', err)
    saveError.value = true
  } finally {
    saving.value = false
  }
}

// Skipped questions are not saved; they come back later one per session.
function skip() {
  skipped.value += 1
  advance()
}

function finishClose() {
  onFlowClosed({
    answered: baseAnswered.value + answeredNow.value,
    total: total.value,
    completed: completed.value,
  })
}
</script>

<style scoped>
.center-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 12px;
  min-height: 60%;
  padding: 24px 8px;
}
.done-icon { font-size: 72px; color: var(--ion-color-success); line-height: 1; }
.done-box h2 { margin: 0; font-size: 1.4rem; }
.done-box p { margin: 0; color: var(--ion-color-medium); }
.earned { color: var(--ion-color-carrot) !important; font-weight: 800; font-size: 1.1rem; }
.done-box ion-button { width: 100%; margin-top: 12px; }

.question-box { display: flex; flex-direction: column; gap: 16px; padding-top: 8px; }
.step-label { font-size: 0.78rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--ion-color-carrot); }
.prompt { margin: 0; font-size: 1.25rem; line-height: 1.35; }
.save-error { color: var(--ion-color-danger); font-size: 0.85rem; margin: 0; }

.footer-row { display: flex; justify-content: space-between; align-items: center; padding: 0 8px; }
</style>
