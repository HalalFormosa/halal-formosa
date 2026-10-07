<template>
  <ion-list class="opening-hours-list" lines="none">
    <ion-item v-for="key in DAY_KEYS" :key="key" class="opening-hours-item" lines="full">
      <ion-checkbox
        slot="start"
        :checked="modelValue[key].active"
        @ionChange="(e: any) => { modelValue[key].active = e.detail.checked; emit('change') }"
      />
      <ion-label class="day-label">{{ $t(dayLabelPrefix + key) }}</ion-label>
      <span v-if="!modelValue[key].active" class="closed-label">{{ $t(closedKey) }}</span>
      <div v-else class="shifts">
        <div v-for="(shift, i) in modelValue[key].shifts" :key="i" class="shift-row">
          <ion-input v-model="shift.open" type="time" class="time-field" @ionInput="emit('change')" />
          <span class="dash">-</span>
          <ion-input v-model="shift.close" type="time" class="time-field" @ionInput="emit('change')" />
          <ion-button
            v-if="modelValue[key].shifts.length > 1"
            fill="clear" size="small" color="medium" class="mini-btn"
            :aria-label="$t('addPlace.removeShift', 'Remove shift')"
            @click="removeShift(key, i)"
          >
            <ion-icon slot="icon-only" :icon="closeCircleOutline" />
          </ion-button>
        </div>
        <ion-button
          v-if="modelValue[key].shifts.length < MAX_SHIFTS_PER_DAY"
          fill="clear" size="small" class="add-shift"
          @click="addShift(key)"
        >
          <ion-icon slot="start" :icon="addOutline" />
          {{ $t('addPlace.addShift', 'Add shift') }}
        </ion-button>
      </div>
    </ion-item>
  </ion-list>
</template>

<script setup lang="ts">
import { IonList, IonItem, IonCheckbox, IonLabel, IonInput, IonButton, IonIcon } from '@ionic/vue'
import { addOutline, closeCircleOutline } from 'ionicons/icons'
import { DAY_KEYS, MAX_SHIFTS_PER_DAY, newShift, type DayKey, type WeekShifts } from '@/utils/openingHours'

const props = withDefaults(defineProps<{
  modelValue: WeekShifts
  dayLabelPrefix?: string
  closedKey?: string
}>(), {
  dayLabelPrefix: 'addPlace.days.',
  closedKey: 'addPlace.closed',
})
const emit = defineEmits<{ (e: 'change'): void }>()

function addShift(key: DayKey) {
  const shifts = props.modelValue[key].shifts
  // Start the new shift after the previous one ends (a common split-shift pattern), 2 hours long.
  const last = shifts[shifts.length - 1]
  const s = newShift()
  if (last?.close) {
    const [h, m] = last.close.split(':').map(Number)
    const start = Math.min(h + 3, 21)
    s.open = `${String(start).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`
    s.close = `${String(Math.min(start + 2, 23)).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`
  }
  shifts.push(s)
  emit('change')
}

function removeShift(key: DayKey, index: number) {
  props.modelValue[key].shifts.splice(index, 1)
  emit('change')
}
</script>

<style scoped>
.opening-hours-item { --padding-top: 6px; --padding-bottom: 6px; }
.day-label { flex: 0 0 auto; min-width: 84px; max-width: none; white-space: nowrap; font-weight: 600; }
.closed-label { color: var(--ion-color-medium); font-size: .85rem; font-style: italic; }
.shifts { display: flex; flex-direction: column; gap: 4px; margin-left: auto; align-items: flex-end; }
.shift-row { display: flex; align-items: center; gap: 4px; }
.time-field { width: 142px; max-width: 142px; --padding-start: 8px; --padding-end: 4px; border: 1px solid var(--ion-color-light-shade); border-radius: 8px; }
.dash { color: var(--ion-color-medium); }
.mini-btn { margin: 0; --padding-start: 2px; --padding-end: 2px; }
.add-shift { margin: 0; font-size: .8rem; text-transform: none; }
</style>
