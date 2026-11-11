<template>
  <pro-upsell-sheet
    :open="open"
    source="scan_milestone"
    :icon="trophyOutline"
    :title="t('home.scanMilestone.title', { count: SCAN_MILESTONE })"
    :message="t('home.scanMilestone.body')"
    :upgrade-label="t('home.scanMilestone.upgrade')"
    :dismiss-label="t('home.scanMilestone.later')"
    @update:open="emit('update:open', $event)"
    @dismissed="onDismissed"
  >
    <ul class="benefits">
      <li v-for="key in BENEFITS" :key="key">
        <ion-icon :icon="checkmarkOutline" />
        <span>{{ t(`home.scanMilestone.${key}`) }}</span>
      </li>
    </ul>
  </pro-upsell-sheet>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue'
import { checkmarkOutline, trophyOutline } from 'ionicons/icons'
import { useI18n } from 'vue-i18n'
import ProUpsellSheet from '@/components/ProUpsellSheet.vue'
import { SCAN_MILESTONE } from '@/constants/scanMilestone'
import { recordPaywallDismissed } from '@/utils/paywallCap'

/** One-time celebration of the 10th scan that shows what Pro adds. See useScanMilestone. */
defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'update:open', value: boolean): void }>()

const { t } = useI18n()
const BENEFITS = ['benefitScans', 'benefitAi', 'benefitHistory'] as const

// Walking away counts like dismissing a paywall, so other app-opened prompts hold back for a while.
function onDismissed() {
  recordPaywallDismissed()
}
</script>

<style scoped>
.benefits {
  list-style: none;
  margin: 0 0 18px;
  padding: 0;
  text-align: left;
}
.benefits li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 6px 0;
  font-size: 14px;
  line-height: 1.4;
}
.benefits ion-icon {
  flex-shrink: 0;
  margin-top: 2px;
  font-size: 18px;
  color: #ca8a04;
}
</style>
