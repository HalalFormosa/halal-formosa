<template>
  <ion-page>
    <barcode-scan-camera
      @view-details="onViewDetails"
      @add-product="onAddProduct"
      @close="onClose"
      @error="onError"
    />

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
import BarcodeScanCamera from '@/components/scan/BarcodeScanCamera.vue'

const router = useRouter()
const errorMsg = ref('')

function onViewDetails(barcode: string) {
  router.replace({ path: `/item/${barcode}` })
}

function onAddProduct(barcode: string) {
  router.replace({ path: '/add', query: { barcode } })
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
/* Transparent, not black: on native this page sits behind the real camera
   layer (see BarcodeScanCamera.vue's .full-screen-scanner), so it must not
   paint an opaque background over it. */
ion-page {
  --background: transparent;
}
</style>
