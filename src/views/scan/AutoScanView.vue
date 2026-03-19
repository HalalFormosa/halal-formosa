<template>
  <ion-page>
    <auto-scan-camera
      active
      @detected="onDetected"
      @close="onClose"
      @error="onError"
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
import { useAutoScanStore } from '@/composables/useAutoScanStore'

const router = useRouter()
const { setResult } = useAutoScanStore()
const errorMsg = ref('')

function onDetected(result: any) {
  setResult(result)
  router.back()
}

function onClose() {
  router.back()
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
