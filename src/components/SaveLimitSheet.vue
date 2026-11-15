<template>
  <pro-upsell-sheet
    :open="open"
    :source="kind === 'item' ? 'save_item_limit' : 'save_location_limit'"
    :meta="meta"
    :icon="bookmarkOutline"
    :title="t(`${ns}.limitSheet.title`)"
    :message="t(`${ns}.limitSheet.body`, { limit: FREE_SAVE_LIMIT })"
    :upgrade-label="t(`${ns}.limitSheet.upgrade`)"
    :secondary-label="t(`${ns}.limitSheet.manage`)"
    :dismiss-label="t(`${ns}.limitSheet.notNow`)"
    :can-upgrade="isNative"
    @update:open="emit('update:open', $event)"
    @upgraded="emit('upgraded')"
    @secondary="emit('manage')"
  />
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { Capacitor } from '@capacitor/core'
import { bookmarkOutline } from 'ionicons/icons'
import { useI18n } from 'vue-i18n'
import ProUpsellSheet from '@/components/ProUpsellSheet.vue'
import { FREE_SAVE_LIMIT } from '@/constants/savedLimits'
import { ActivityLogService } from '@/services/ActivityLogService'

/**
 * Shown when a free user tries to save a sixth item or location. Offers Pro, or a way to free a
 * slot by managing what they've saved, and never leaves a dead end.
 */
const props = defineProps<{
  open: boolean
  kind: 'item' | 'location'
  /** Extra fields logged with the paywall trigger, e.g. { location_id }. */
  meta?: Record<string, unknown>
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'upgraded'): void
  /** The user wants to remove something to make room. */
  (e: 'manage'): void
}>()

const { t } = useI18n()
const isNative = Capacitor.isNativePlatform()
const ns = computed(() => (props.kind === 'item' ? 'savedItems' : 'savedLocations'))

// The paywall only logs when Pro is tapped, so record that the limit was hit at all.
watch(() => props.open, (open) => {
  if (open) ActivityLogService.log('save_limit_reached', { kind: props.kind, ...props.meta })
})
</script>
