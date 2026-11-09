<template>
  <ion-modal
    :is-open="isOpen"
    :initial-breakpoint="0.85"
    :breakpoints="[0, 0.85, 1]"
    class="prayer-settings-sheet"
    @didDismiss="$emit('close')"
  >
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ $t('prayerSettings.title') }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="$emit('close')" :aria-label="$t('prayerSettings.close')">
            <ion-icon :icon="closeOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <p class="ps-note">{{ $t('prayerSettings.note') }}</p>

      <div class="ps-label">{{ $t('prayerSettings.method') }}</div>
      <ion-select
        v-model="draft.method"
        interface="action-sheet"
        fill="outline"
        :aria-label="$t('prayerSettings.method')"
      >
        <ion-select-option v-for="m in PRAYER_METHODS" :key="m" :value="m">
          {{ $t('prayerSettings.methods.' + m) }}
        </ion-select-option>
      </ion-select>

      <div class="ps-label">{{ $t('prayerSettings.asr') }}</div>
      <ion-segment v-model="draft.asr" color="carrot">
        <ion-segment-button value="Standard">
          <ion-label>{{ $t('prayerSettings.asrStandard') }}</ion-label>
        </ion-segment-button>
        <ion-segment-button value="Hanafi">
          <ion-label>{{ $t('prayerSettings.asrHanafi') }}</ion-label>
        </ion-segment-button>
      </ion-segment>

      <div class="ps-label">{{ $t('prayerSettings.adjust') }}</div>
      <p class="ps-help">{{ $t('prayerSettings.adjustHelp') }}</p>
      <div class="ps-tune-grid">
        <div v-for="k in TUNABLE_PRAYERS" :key="k" class="ps-tune-row">
          <span class="ps-tune-name">{{ $t('prayerSettings.prayers.' + k) }}</span>
          <div class="ps-stepper">
            <ion-button fill="clear" size="small" color="carrot"
                        :aria-label="$t('prayerSettings.minus', { prayer: $t('prayerSettings.prayers.' + k) })"
                        :disabled="draft.tune[k] <= -MAX_TUNE_MINUTES"
                        @click="draft.tune[k]--">
              <ion-icon :icon="removeOutline" />
            </ion-button>
            <span class="ps-tune-val">{{ formatTune(draft.tune[k]) }}</span>
            <ion-button fill="clear" size="small" color="carrot"
                        :aria-label="$t('prayerSettings.plus', { prayer: $t('prayerSettings.prayers.' + k) })"
                        :disabled="draft.tune[k] >= MAX_TUNE_MINUTES"
                        @click="draft.tune[k]++">
              <ion-icon :icon="addOutline" />
            </ion-button>
          </div>
        </div>
      </div>

      <ion-button expand="block" color="carrot" class="ps-save" @click="save">
        {{ $t('prayerSettings.save') }}
      </ion-button>
      <ion-button expand="block" fill="clear" color="carrot" @click="resetDraft">
        {{ $t('prayerSettings.reset') }}
      </ion-button>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent,
  IonSelect, IonSelectOption, IonSegment, IonSegmentButton, IonLabel,
} from '@ionic/vue'
import { closeOutline, addOutline, removeOutline } from 'ionicons/icons'
import {
  usePrayerSettings, defaultPrayerSettings, PRAYER_METHODS, TUNABLE_PRAYERS,
  type PrayerSettings,
} from '@/composables/usePrayerSettings'

const props = defineProps<{ isOpen: boolean }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const { settings, update, MAX_TUNE_MINUTES } = usePrayerSettings()

const draft = reactive<PrayerSettings>(structuredClone(defaultPrayerSettings()))

// Re-seed the draft from the saved settings each time the sheet opens, so
// cancelled edits never leak into the next open.
watch(() => props.isOpen, (open) => {
  if (open) Object.assign(draft, structuredClone(JSON.parse(JSON.stringify(settings.value))))
})

function formatTune(n: number) {
  return n > 0 ? `+${n}` : String(n)
}

function resetDraft() {
  Object.assign(draft, structuredClone(defaultPrayerSettings()))
}

function save() {
  update(JSON.parse(JSON.stringify(draft)))
  emit('saved')
  emit('close')
}
</script>

<style scoped>
.ps-note { font-size: 13px; color: var(--ion-color-medium); margin: 0 0 8px; }
.ps-label { font-size: 12px; font-weight: 600; color: var(--ion-color-carrot-shade, #C96718); margin: 16px 0 6px; }
.ps-help { font-size: 12px; color: var(--ion-color-medium); margin: 0 0 8px; }
.ps-tune-row { display: flex; align-items: center; justify-content: space-between; padding: 2px 0; }
.ps-tune-name { font-size: 14px; }
.ps-stepper { display: flex; align-items: center; gap: 4px; }
.ps-tune-val { min-width: 36px; text-align: center; font-size: 14px; font-variant-numeric: tabular-nums; }
.ps-save { margin-top: 20px; }
</style>
