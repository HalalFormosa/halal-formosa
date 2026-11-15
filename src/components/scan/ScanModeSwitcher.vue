<template>
  <div class="mode-switcher-bar">
    <nav class="mode-switcher" :aria-label="t('scanIngredients.modeSwitcher.label', 'Scan mode')">
      <!-- Gallery is an upload, not a mode: always shown, never "selected" -->
      <button type="button" class="mode-btn" @click="go('gallery')">
        <ion-icon :icon="imagesOutline" />
        <span>{{ t('scanIngredients.scan.gallery', 'Gallery') }}</span>
      </button>

      <span class="mode-divider" aria-hidden="true" />

      <button
        v-for="mode in modes"
        :key="mode.id"
        type="button"
        class="mode-btn"
        :class="{ active: mode.id === current }"
        :aria-pressed="mode.id === current"
        @click="go(mode.id)"
      >
        <ion-icon :icon="mode.icon" />
        <span>{{ mode.label }}</span>
        <span v-if="mode.pro" class="pro-badge"><ion-icon :icon="lockClosed" />{{ t('common.pro', 'Pro') }}</span>
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { IonIcon } from '@ionic/vue'
import { cameraOutline, imagesOutline, lockClosed, pulseOutline, scanOutline } from 'ionicons/icons'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { isLiveVerdictSupported } from '@/utils/liveScanPlatform'
import { switchScanMode, type ScanMode } from '@/composables/useScanModeRequest'
import { isDonor } from '@/composables/useSubscriptionStatus'
import { presentProPaywall } from '@/utils/proPaywall'

const props = defineProps<{ current: 'camera' | 'auto' | 'live' }>()

const router = useRouter()
const { t } = useI18n()

// Live Scan needs the native camera plugin (Android and iOS).
const liveAvailable = isLiveVerdictSupported()

const modes = computed(() => {
  const list: { id: 'camera' | 'auto' | 'live'; label: string; icon: string; pro?: boolean }[] = [
    { id: 'camera', label: t('scanIngredients.scan.camera', 'Camera'), icon: cameraOutline },
    { id: 'auto', label: t('scanIngredients.autoScan.label', 'Auto Capture'), icon: scanOutline },
  ]
  if (liveAvailable) {
    list.push({ id: 'live', label: t('scanIngredients.liveVerdict.label', 'Live Scan'), icon: pulseOutline, pro: !isDonor.value })
  }
  return list
})

async function go(mode: ScanMode) {
  if (mode === props.current) return
  // Live Scan is a Pro feature: free users see the paywall instead of the camera.
  if (mode === 'live' && !isDonor.value && !(await presentProPaywall('live_verdict'))) return
  const previous = (window.history.state as { back?: string | null } | null)?.back
  switchScanMode(router, mode, previous)
}
</script>

<style scoped>
.mode-switcher-bar {
  display: flex;
  justify-content: center;
  padding: 0 12px calc(env(safe-area-inset-bottom, 0px) + 12px);
  pointer-events: none;
}
.mode-switcher {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px;
  border-radius: 20px;
  background: rgba(20, 20, 22, 0.88);
  pointer-events: auto;
}
.mode-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 64px;
  min-height: 48px;
  padding: 4px 10px;
  border: 0;
  border-radius: 14px;
  background: transparent;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.1;
}
.mode-btn ion-icon {
  font-size: 22px;
}
/* Pro badge: solid orange with black text; inverted on the active (orange) button. */
.pro-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0 5px;
  border-radius: 6px;
  background: var(--ion-color-carrot, #e67e22);
  color: #000;
  font-size: 9px;
  font-weight: 800;
  line-height: 1.4;
}
.mode-btn.active .pro-badge {
  background: #000;
  color: #fff;
}
/* Brand: solid orange takes black text. */
.mode-btn.active {
  background: var(--ion-color-carrot, #e67e22);
  color: #000;
}
.mode-divider {
  width: 1px;
  height: 28px;
  margin: 0 2px;
  background: rgba(255, 255, 255, 0.2);
}
</style>
