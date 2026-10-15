<template>
  <div class="survey-input" data-testid="survey-input">
    <!-- 1–5 scale -->
    <div v-if="question.answer_type === 'scale_5'" class="scale-block">
      <div class="scale-row">
        <button
          v-for="n in 5"
          :key="n"
          type="button"
          class="scale-btn"
          :class="{ selected: modelValue === n }"
          :aria-pressed="modelValue === n"
          :data-testid="`survey-scale-${n}`"
          @click="emit('update:modelValue', n)"
        >{{ n }}</button>
      </div>
      <div v-if="question.scale_labels" class="scale-ends">
        <span>{{ text(question.scale_labels.min) }}</span>
        <span>{{ text(question.scale_labels.max) }}</span>
      </div>
    </div>

    <!-- 0–10 (recommend) -->
    <div v-else-if="question.answer_type === 'nps'" class="scale-block">
      <div class="scale-row nps-row">
        <button
          v-for="n in 11"
          :key="n"
          type="button"
          class="scale-btn nps-btn"
          :class="{ selected: modelValue === n - 1 }"
          :aria-pressed="modelValue === n - 1"
          :data-testid="`survey-scale-${n - 1}`"
          @click="emit('update:modelValue', n - 1)"
        >{{ n - 1 }}</button>
      </div>
      <div v-if="question.scale_labels" class="scale-ends">
        <span>{{ text(question.scale_labels.min) }}</span>
        <span>{{ text(question.scale_labels.max) }}</span>
      </div>
    </div>

    <!-- pick one -->
    <div v-else-if="question.answer_type === 'single'" class="option-list" role="radiogroup">
      <button
        v-for="o in question.options ?? []"
        :key="o.value"
        type="button"
        role="radio"
        class="option-btn"
        :class="{ selected: modelValue === o.value }"
        :aria-checked="modelValue === o.value"
        :data-testid="`survey-option-${o.value}`"
        @click="emit('update:modelValue', o.value)"
      >
        <span class="option-mark" aria-hidden="true"></span>
        <span class="option-label">{{ text(o.label) }}</span>
      </button>
    </div>

    <!-- pick several -->
    <div v-else-if="question.answer_type === 'multi'" class="option-list">
      <button
        v-for="o in question.options ?? []"
        :key="o.value"
        type="button"
        role="checkbox"
        class="option-btn multi"
        :class="{ selected: selectedList.includes(o.value) }"
        :aria-checked="selectedList.includes(o.value)"
        :data-testid="`survey-option-${o.value}`"
        @click="toggle(o.value)"
      >
        <span class="option-mark square" aria-hidden="true"></span>
        <span class="option-label">{{ text(o.label) }}</span>
      </button>
    </div>

    <!-- free text -->
    <div v-else class="text-block">
      <textarea
        class="text-area"
        rows="4"
        maxlength="1000"
        :value="typeof modelValue === 'string' ? modelValue : ''"
        :placeholder="$t('survey.textPlaceholder')"
        data-testid="survey-text"
        @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      ></textarea>
      <div class="char-count">{{ (typeof modelValue === 'string' ? modelValue.length : 0) }}/1000</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { localizedText, type LocalizedText, type SurveyAnswer, type SurveyQuestion } from '@/services/SurveyService'

const props = defineProps<{
  question: SurveyQuestion
  modelValue: SurveyAnswer | null
}>()
const emit = defineEmits<{ (e: 'update:modelValue', value: SurveyAnswer | null): void }>()

const { locale } = useI18n()
const text = (t: LocalizedText) => localizedText(t, locale.value)

const selectedList = computed<string[]>(() => (Array.isArray(props.modelValue) ? props.modelValue : []))

function toggle(value: string) {
  const next = selectedList.value.includes(value)
    ? selectedList.value.filter((v) => v !== value)
    : [...selectedList.value, value]
  emit('update:modelValue', next.length ? next : null)
}
</script>

<style scoped>
.scale-block { width: 100%; }
.scale-row { display: flex; gap: 8px; }
.nps-row { gap: 4px; }

.scale-btn {
  flex: 1;
  min-width: 0;
  height: 46px;
  border-radius: 12px;
  border: 1.5px solid var(--ion-color-step-200, #d7d8da);
  background: var(--ion-card-background, var(--ion-background-color));
  color: var(--ion-text-color);
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.nps-btn { height: 40px; font-size: 0.85rem; border-radius: 9px; }
.scale-btn.selected {
  background: var(--ion-color-carrot);
  border-color: var(--ion-color-carrot);
  color: #fff;
}
.scale-ends {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}

.option-list { display: flex; flex-direction: column; gap: 8px; }
.option-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 46px;
  padding: 10px 14px;
  text-align: left;
  border-radius: 12px;
  border: 1.5px solid var(--ion-color-step-200, #d7d8da);
  background: var(--ion-card-background, var(--ion-background-color));
  color: var(--ion-text-color);
  font-size: 0.95rem;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.option-btn.selected {
  border-color: var(--ion-color-carrot);
  background: rgba(var(--ion-color-carrot-rgb), 0.1);
}
.option-mark {
  flex: 0 0 20px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid var(--ion-color-medium);
  position: relative;
}
.option-mark.square { border-radius: 6px; }
.option-btn.selected .option-mark {
  border-color: var(--ion-color-carrot);
  background: var(--ion-color-carrot);
}
.option-btn.selected .option-mark::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 1px;
  width: 5px;
  height: 10px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
.option-label { flex: 1; line-height: 1.3; }

.text-area {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1.5px solid var(--ion-color-step-200, #d7d8da);
  background: var(--ion-card-background, var(--ion-background-color));
  color: var(--ion-text-color);
  font: inherit;
  font-size: 0.95rem;
  resize: vertical;
}
.text-area:focus { outline: none; border-color: var(--ion-color-carrot); }
.char-count { text-align: right; font-size: 0.72rem; color: var(--ion-color-medium); margin-top: 4px; }
</style>
