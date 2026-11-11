<template>
  <pro-upsell-sheet
    :open="open"
    source="scan_limit"
    :title="t('scanIngredients.limit.sheet.title', { limit: DAILY_SCAN_LIMIT })"
    :message="canEarn ? t('scanIngredients.limit.sheet.body') : t('scanIngredients.limit.sheet.bodyNoEarn')"
    :upgrade-label="t('scanIngredients.limit.sheet.upgrade')"
    :secondary-label="canEarn ? t('scanIngredients.limit.sheet.earn') : undefined"
    :dismiss-label="t('scanIngredients.limit.sheet.notNow')"
    :can-upgrade="isNative"
    @update:open="emit('update:open', $event)"
    @upgraded="emit('upgraded')"
    @secondary="onEarn"
    @dismissed="emit('dismissed')"
  />
</template>

<script setup lang="ts">
import { Capacitor } from '@capacitor/core'
import { useI18n } from 'vue-i18n'
import ProUpsellSheet from '@/components/ProUpsellSheet.vue'
import { ActivityLogService } from '@/services/ActivityLogService'
import { DAILY_SCAN_LIMIT } from '@/services/ScanLimitService'

/**
 * Shown when a free user hits the daily scan limit, from the manual scan screen and from
 * Auto Capture. Offers Pro, or a free way to earn more scans, and never leaves a dead end.
 */
defineProps<{
  open: boolean
  /** Whether contributing would still earn a scan today (see canEarnMoreScans). */
  canEarn: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'upgraded'): void
  (e: 'earn'): void
  (e: 'dismissed'): void
}>()

const { t } = useI18n()
const isNative = Capacitor.isNativePlatform()

function onEarn() {
  ActivityLogService.log('scan_limit_earn_tap')
  emit('earn')
}
</script>
