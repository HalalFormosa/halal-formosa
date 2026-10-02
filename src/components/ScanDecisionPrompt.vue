<template>
  <div v-if="visible" class="decision-prompt" role="group" :aria-label="$t('scanIngredients.scan.decision.question')">
    <template v-if="!answered">
      <p class="decision-question">
        {{ $t('scanIngredients.scan.decision.question') }}
        <button
            type="button"
            class="decision-info-btn"
            :aria-label="$t('scanIngredients.scan.decision.infoLabel')"
            :aria-expanded="showInfo"
            @click="showInfo = !showInfo"
        >
          <ion-icon :icon="informationCircleOutline" />
        </button>
      </p>
      <p v-if="showInfo" class="decision-info">{{ $t('scanIngredients.scan.decision.info') }}</p>
      <div class="decision-buttons">
        <button
            v-for="option in options"
            :key="option.value"
            type="button"
            class="decision-btn"
            :class="`decision-btn-${option.value}`"
            @click="choose(option.value)"
        >
          <ion-icon :icon="option.icon" />
          <span>{{ $t(`scanIngredients.scan.decision.${option.value}`) }}</span>
        </button>
      </div>
    </template>
    <p v-else class="decision-thanks">
      <ion-icon :icon="checkmarkCircle" />
      {{ $t('scanIngredients.scan.decision.thanks') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { IonIcon } from '@ionic/vue'
import {
  checkmarkCircle,
  checkmarkCircleOutline,
  closeCircleOutline,
  informationCircleOutline,
  searchOutline,
} from 'ionicons/icons'
import { ActivityLogService } from '@/services/ActivityLogService'

/**
 * One-tap "what will you do with this product?" question shown under a scan
 * result. Shown on a random ~1 in 3 results (re-rolled whenever `scanKey`
 * changes) so it stays light, and only for results that give a verdict.
 * The answer is logged as a `scan_decision` activity event.
 */
const props = defineProps<{
  /** Increment once per new result; each change re-rolls whether to show. */
  scanKey: number
  /** The verdict shown for this scan (e.g. "Syubhah"). */
  status: string | null | undefined
}>()

const emit = defineEmits<{ (e: 'answered', choice: DecisionChoice): void }>()

import type { ScanDecisionChoice as DecisionChoice } from '@/utils/scanDecisionNotice'

// Share of results that show the prompt (0-1). Override with VITE_DECISION_PROMPT_RATE, e.g.
// `VITE_DECISION_PROMPT_RATE=1` in .env to see it on every result in a device build. Without it,
// `ionic serve` always shows it (easy to test) and every built app (including a "dev" Android
// build, where Vite's DEV flag is false) uses 1 in 3. Unit tests always use 1 in 3.
const DEFAULT_RATE = 1 / 3
const envRate = Number(import.meta.env.VITE_DECISION_PROMPT_RATE)
const hasEnvRate =
    import.meta.env.VITE_DECISION_PROMPT_RATE !== undefined &&
    import.meta.env.VITE_DECISION_PROMPT_RATE !== '' &&
    Number.isFinite(envRate)
const SHOW_RATE =
    import.meta.env.MODE === 'test'
        ? DEFAULT_RATE
        : hasEnvRate
            ? Math.min(1, Math.max(0, envRate))
            : import.meta.env.DEV
                ? 1
                : DEFAULT_RATE
const VERDICTS = new Set(['Muslim-friendly', 'Syubhah', 'Haram'])

const options: { value: DecisionChoice; icon: string }[] = [
  { value: 'use', icon: checkmarkCircleOutline },
  { value: 'skip', icon: closeCircleOutline },
  { value: 'check', icon: searchOutline },
]

const visible = ref(false)
const answered = ref(false)
const showInfo = ref(false)

watch(
    () => props.scanKey,
    () => {
      answered.value = false
      showInfo.value = false
      visible.value = !!props.status && VERDICTS.has(props.status) && Math.random() < SHOW_RATE
    },
    { immediate: true }
)

function choose(choice: DecisionChoice) {
  if (answered.value) return
  answered.value = true
  emit('answered', choice)
  // Fire and forget: a logging failure must never get in the user's way.
  void ActivityLogService.log('scan_decision', {
    choice,
    auto_status: props.status,
    source: 'ingredient_scan',
  }).catch(() => {})
}
</script>

<style scoped>
.decision-prompt {
  margin: 4px 0 16px;
  padding: 12px;
  border-radius: 14px;
  background: var(--ion-color-light, #f4f5f8);
  text-align: center;
}

.decision-question {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--ion-text-color, #222);
}

.decision-info-btn {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  margin-left: 2px;
  padding: 2px;
  border: 0;
  background: transparent;
  color: var(--ion-color-medium, #92949c);
  font-size: 18px;
  cursor: pointer;
}

.decision-info {
  margin: -2px 0 10px;
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--ion-background-color, #fff);
  color: var(--ion-color-step-600, #555);
  font-size: 12.5px;
  line-height: 1.4;
  text-align: left;
}

.decision-buttons {
  display: flex;
  gap: 8px;
}

.decision-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-height: 56px;
  padding: 8px 4px;
  border: 1px solid var(--ion-color-step-250, #d7d8da);
  border-radius: 12px;
  background: var(--ion-background-color, #fff);
  color: var(--ion-text-color, #222);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
  cursor: pointer;
}

.decision-btn ion-icon {
  font-size: 22px;
}

.decision-btn:active {
  transform: scale(0.97);
}

.decision-btn-use ion-icon { color: var(--ion-color-success, #2dd36f); }
.decision-btn-skip ion-icon { color: var(--ion-color-danger, #eb445a); }
.decision-btn-check ion-icon { color: var(--ion-color-warning, #ffc409); }

.decision-thanks {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 4px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--ion-color-success, #2dd36f);
}
</style>
