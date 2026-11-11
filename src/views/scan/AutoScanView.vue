<template>
  <ion-page>
    <auto-scan-camera
      active
      @detected="onDetected"
      @stable-result="onStableResult"
      @close="onClose"
      @error="onError"
      @limit-reached="onLimitReached"
    />

    <scan-limit-sheet
      v-model:open="limitSheetOpen"
      :can-earn="canEarn"
      @upgraded="router.back()"
      @earn="router.replace('/add')"
      @dismissed="router.back()"
    />
    
    <!-- Error Toast -->
    <ion-toast
      :is-open="!!errorMsg"
      :message="errorMsg"
      :duration="2000"
      color="danger"
      @didDismiss="errorMsg = ''"
    />
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { IonPage, IonToast } from '@ionic/vue'
import { useRouter } from 'vue-router'
import AutoScanCamera from '@/components/scan/AutoScanCamera.vue'
import ScanLimitSheet from '@/components/scan/ScanLimitSheet.vue'
import { canEarnMoreScans, type ScanStatus } from '@/services/ScanLimitService'
import { useAutoScanStore, type AutoScanResult } from '@/composables/useAutoScanStore'
import { ActivityLogService } from '@/services/ActivityLogService'
import { logIngredientScan } from '@/services/IngredientScanLogService'

const router = useRouter()
const { setResult } = useAutoScanStore()
const errorMsg = ref('')
const limitSheetOpen = ref(false)
const canEarn = ref(true)

function onDetected(result: any) {
  setResult(result)
  router.back()
}

// Fires as soon as the live scanner gets a confident read — a successful detection
// (e.g. "Muslim-friendly") already IS a completed scan, so it's counted and logged
// here immediately, regardless of whether the user goes on to tap "View Details".
// `result` is mutated with `loggedAsScan: true` so ScanIngredientsView.handleAutoDetected
// (fired if the user does tap View Details) knows not to log/count it a second time.
async function onStableResult(result: AutoScanResult) {
  const { success, id } = await logIngredientScan({
    source: 'camera',
    productName: result.productName,
    ingredientsTextZh: result.textZh,
    ingredientsTextEn: result.textEn,
    ocrRaw: result.ocrRaw,
    autoStatus: result.autoStatus,
    highlightSummary: result.highlights,
  })

  if (success) {
    result.loggedAsScan = true
    result.scanLogId = id
    await ActivityLogService.log('scan_ingredients_success', {
      product_name: result.productName || 'Unknown',
      auto_status: result.autoStatus,
      ingredient_count: result.highlights?.length ?? 0,
      source: 'auto_scan',
    })
  }
}

function onClose() {
  router.back()
}

// The camera stops itself at the daily cap. Offer Pro or bonus scans instead of a dead-end toast.
function onLimitReached(status: ScanStatus | null) {
  canEarn.value = canEarnMoreScans(status)
  limitSheetOpen.value = true
}

function onError(msg: string) {
  errorMsg.value = msg
  setTimeout(() => router.back(), 2000)
}
</script>

<style scoped>
ion-page {
  --background: #000;
}
</style>
