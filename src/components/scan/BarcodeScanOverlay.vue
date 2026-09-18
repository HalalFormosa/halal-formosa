<template>
  <div class="barcode-scanner-ui full-screen-scanner" :class="{ 'is-web': !isNative }">
    <!-- Web: html5-qrcode renders its own <video> into this container.
         Native: this stays empty/transparent — the real camera feed is a
         native layer showing through the (transparent) WebView, see
         body.barcode-scanner-active in theme/variables.css. -->
    <div class="camera-container">
      <div id="barcode-overlay-reader"></div>
    </div>

    <div class="scanner-ui-overlay">
      <div class="top-controls">
        <span class="scanner-title">{{ props.title || $t('search.barcodeScan.title') }}</span>
        <div class="top-controls-actions">
          <button v-if="torchAvailable" class="icon-btn" @click="toggleTorch">
            <ion-icon :icon="torchOn ? flashOutline : flashOffOutline" />
          </button>
          <button class="icon-btn" @click="$emit('close')">
            <ion-icon :icon="closeOutline" />
          </button>
        </div>
      </div>

      <div class="scan-frame-container">
        <div class="scan-area" :class="{ detected: found }">
          <div class="corner top-left"></div>
          <div class="corner top-right"></div>
          <div class="corner bottom-left"></div>
          <div class="corner bottom-right"></div>
          <div class="scan-line" v-if="!found"></div>
        </div>
      </div>

      <div class="bottom-controls">
        <div class="status-badge">
          <ion-spinner v-if="!found" name="lines-small" />
          <span>{{ statusMessage }}</span>
        </div>
        <div v-if="!found" class="tips">{{ $t('search.barcodeScan.hint') }}</div>

        <div v-if="props.showFallbackActions && !found" class="fallback-actions">
          <button class="fallback-btn" @click="$emit('manual-entry')">
            <ion-icon :icon="createOutline" />
            <span>{{ $t('addProduct.manualEntryShort') || 'Manual' }}</span>
          </button>
          <button class="fallback-btn" @click="$emit('gallery')">
            <ion-icon :icon="cloudUploadOutline" />
            <span>{{ $t('addProduct.galleryShort') || 'Gallery' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { IonIcon, IonSpinner } from '@ionic/vue'
import { closeOutline, flashOutline, flashOffOutline, createOutline, cloudUploadOutline } from 'ionicons/icons'
import { useI18n } from 'vue-i18n'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { useLiveBarcodeScanner } from '@/composables/useLiveBarcodeScanner'

const props = defineProps<{
  title?: string
  // Optional "Manual Entry" / "Upload from Gallery" buttons for callers (like
  // Add Product) that skip straight to the camera and need a way back to the
  // other input methods without leaving the full-screen overlay first.
  showFallbackActions?: boolean
}>()

const emit = defineEmits<{
  (e: 'detected', barcode: string): void
  (e: 'close'): void
  (e: 'error', message: string): void
  (e: 'manual-entry'): void
  (e: 'gallery'): void
}>()

const { t } = useI18n()

const { isNative, torchAvailable, torchOn, start: startScanner, stop: stopScanner, toggleTorch } = useLiveBarcodeScanner()

const statusMessage = ref(t('search.barcodeScan.status.init'))
// One-shot: this overlay hands the first detected barcode straight back to
// the caller (Add Product just wants to fill the field, not preview a
// product), so further detections while the closing animation/haptic plays
// are ignored.
const found = ref(false)

async function handleDetected(rawValue: string) {
  if (found.value || !rawValue) return
  found.value = true

  try {
    await Haptics.impact({ style: ImpactStyle.Medium })
  } catch {
    // haptics unsupported on this device/browser — non-critical
  }

  emit('detected', rawValue)
}

onMounted(async () => {
  try {
    await startScanner('barcode-overlay-reader', handleDetected)
    statusMessage.value = t('search.barcodeScan.status.searching')
  } catch (err) {
    console.error('❌ [BarcodeScanOverlay] Failed to start camera:', err)
    emit('error', t('search.barcodeScan.cameraError'))
  }
})

onUnmounted(() => {
  stopScanner()
})
</script>

<style scoped>
.full-screen-scanner {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2000;
  /* Transparent by default: on native, the real camera feed is a native layer
     rendered BELOW the WebView, so any opaque background here (or on any
     ancestor) would paint over it and hide it — see the .barcode-scanner-active
     rules in theme/variables.css. Only the web fallback (no native camera
     layer, just a plain <video>) needs a black backdrop while it loads. */
  background: transparent;
}

.full-screen-scanner.is-web {
  background: #000;
}

.camera-container {
  position: absolute;
  inset: 0;
  z-index: 1;
}

#barcode-overlay-reader {
  width: 100%;
  height: 100%;
}

#barcode-overlay-reader :deep(video) {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover;
}

#barcode-overlay-reader :deep(canvas),
#barcode-overlay-reader :deep(img) {
  display: none !important;
}

.scanner-ui-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  pointer-events: none;
}

.top-controls {
  padding: calc(var(--ion-safe-area-top, 0px) + 16px) 20px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%);
  pointer-events: auto;
}

.scanner-title {
  color: #fff;
  font-weight: 700;
  font-size: 20px;
  text-shadow: 0 2px 4px rgba(0,0,0,0.5);
}

.top-controls-actions {
  display: flex;
  gap: 10px;
}

.icon-btn {
  background: rgba(0, 0, 0, 0.5);
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  backdrop-filter: blur(10px);
}

.scan-frame-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.scan-area {
  position: relative;
  width: 85%;
  height: 32%;
  border: 1.5px solid rgba(255, 255, 255, 0.3);
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.scan-area.detected {
  border-color: var(--ion-color-success);
  background: rgba(45, 211, 111, 0.1);
  transform: scale(1.03);
}

.corner {
  position: absolute;
  width: 28px;
  height: 28px;
  border: 4px solid var(--ion-color-carrot);
}

.top-left { top: -2px; left: -2px; border-right: 0; border-bottom: 0; border-radius: 4px 0 0 0; }
.top-right { top: -2px; right: -2px; border-left: 0; border-bottom: 0; border-radius: 0 4px 0 0; }
.bottom-left { bottom: -2px; left: -2px; border-right: 0; border-top: 0; border-radius: 0 0 0 4px; }
.bottom-right { bottom: -2px; right: -2px; border-left: 0; border-top: 0; border-radius: 0 0 4px 0; }

.scan-area.detected .corner {
  border-color: var(--ion-color-success);
}

.scan-line {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background: var(--ion-color-carrot);
  box-shadow: 0 0 15px var(--ion-color-carrot);
  animation: scan 2.4s linear infinite;
}

@keyframes scan {
  0% { top: 0; opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { top: 100%; opacity: 0; }
}

.bottom-controls {
  padding: 20px 20px calc(var(--ion-safe-area-bottom, 0px) + 20px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  background: linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%);
}

.status-badge {
  padding: 12px 24px;
  border-radius: 40px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 16px;
  font-weight: 600;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 15px rgba(0,0,0,0.3);
}

.tips {
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  text-align: center;
  width: 85%;
  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
  font-weight: 500;
}

.fallback-actions {
  display: flex;
  gap: 10px;
  width: 100%;
  pointer-events: auto;
}

.fallback-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 44px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(10px);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.fallback-btn ion-icon {
  font-size: 18px;
  flex-shrink: 0;
}
</style>
