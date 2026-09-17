<template>
  <div class="barcode-scanner-ui full-screen-scanner" :class="{ 'is-web': !isNative }">
    <!-- Web: html5-qrcode renders its own <video> into this container.
         Native: this stays empty/transparent — the real camera feed is a
         native layer showing through the (transparent) WebView, see
         body.barcode-scanner-active in theme/variables.css. -->
    <div class="camera-container">
      <div id="barcode-reader"></div>
    </div>

    <div class="scanner-ui-overlay">
      <div class="top-controls">
        <span class="scanner-title">{{ $t('search.barcodeScan.title') }}</span>
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
        <div class="scan-area" :class="{ detected: phase !== 'scanning' }">
          <div class="corner top-left"></div>
          <div class="corner top-right"></div>
          <div class="corner bottom-left"></div>
          <div class="corner bottom-right"></div>
          <div class="scan-line" v-if="phase === 'scanning'"></div>
        </div>
      </div>

      <div class="bottom-controls" v-if="phase === 'scanning'">
        <div class="status-badge">
          <ion-spinner name="lines-small" />
          <span>{{ statusMessage }}</span>
        </div>
        <div class="tips">{{ $t('search.barcodeScan.hint') }}</div>
      </div>

      <!-- 🟢 Result card: found product -->
      <div v-if="phase === 'found' && product" class="live-result-card">
        <div class="live-result-photo">
          <img v-if="product.photo_front_url" :src="product.photo_front_url" alt="" />
          <ion-icon v-else :icon="fastFoodOutline" class="live-result-photo-placeholder" />
        </div>
        <div class="live-result-info">
          <div class="live-result-badge" :class="'badge-' + statusColor(product.status)">
            {{ $t(`search.status.${product.status}`, product.status) }}
          </div>
          <div class="live-result-name">{{ product.name }}</div>
        </div>
        <div class="live-result-actions">
          <button class="live-btn secondary" @click="resetScan">
            {{ $t('search.barcodeScan.scanAgain') }}
          </button>
          <button class="live-btn primary" @click="$emit('view-details', product.barcode)">
            {{ $t('search.barcodeScan.viewDetails') }}
          </button>
        </div>
      </div>

      <!-- 🟠 Result card: barcode scanned, no matching product -->
      <div v-if="phase === 'not-found'" class="live-result-card">
        <div class="live-result-badge badge-medium">{{ $t('search.status.Unknown') }}</div>
        <div class="live-result-name">{{ $t('search.barcodeScan.notFound.title') }}</div>
        <div class="live-result-highlights">
          {{ $t('search.barcodeScan.notFound.message', { barcode: scannedBarcode }) }}
        </div>
        <div class="live-result-actions">
          <button class="live-btn secondary" @click="resetScan">
            {{ $t('search.barcodeScan.scanAgain') }}
          </button>
          <button class="live-btn primary" @click="$emit('add-product', scannedBarcode)">
            {{ $t('search.barcodeScan.notFound.action') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { IonIcon, IonSpinner } from '@ionic/vue'
import { closeOutline, flashOutline, flashOffOutline, fastFoodOutline } from 'ionicons/icons'
import { useI18n } from 'vue-i18n'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { supabase } from '@/plugins/supabaseClient'
import { ActivityLogService } from '@/services/ActivityLogService'
import { isNetworkError } from '@/utils/offlineFeedback'
import { useLiveBarcodeScanner } from '@/composables/useLiveBarcodeScanner'
import type { Product } from '@/types/Product'

const emit = defineEmits<{
  (e: 'view-details', barcode: string): void
  (e: 'add-product', barcode: string): void
  (e: 'close'): void
  (e: 'error', message: string): void
}>()

const { t } = useI18n()

const { isNative, torchAvailable, torchOn, start: startScanner, stop: stopScanner, toggleTorch } = useLiveBarcodeScanner()

const phase = ref<'scanning' | 'found' | 'not-found'>('scanning')
const statusMessage = ref(t('search.barcodeScan.status.init'))
const scannedBarcode = ref('')
const product = ref<Product | null>(null)

// Guards against the same barcode re-firing (native fires continuously while
// the frame is in view; the web BarcodeDetector polling loop does too) while
// a result card is already on screen.
let locked = false

const PREVIEW_SELECT = 'barcode, name, status, photo_front_url'

function statusColor(status: string) {
  switch (status?.toLowerCase()) {
    case 'halal': return 'success'
    case 'muslim-friendly': return 'primary'
    case 'syubhah': return 'warning'
    case 'haram': return 'danger'
    default: return 'medium'
  }
}

async function lookupProduct(barcode: string): Promise<Product | null> {
  const { data: direct } = await supabase
    .from('products')
    .select(PREVIEW_SELECT)
    .eq('barcode', barcode)
    .maybeSingle() as { data: Product | null }

  if (direct) return direct

  // The barcode may have been merged into another product's alias list.
  const { data: aliasData } = await supabase
    .from('product_barcodes')
    .select(`products (${PREVIEW_SELECT})`)
    .eq('barcode', barcode)
    .maybeSingle() as { data: any }

  const aliased: Product | null = Array.isArray(aliasData?.products) ? aliasData?.products[0] : aliasData?.products
  return aliased ?? null
}

async function handleDetected(rawValue: string) {
  if (locked || !rawValue) return
  locked = true

  try {
    await Haptics.impact({ style: ImpactStyle.Medium })
  } catch {
    // haptics unsupported on this device/browser — non-critical
  }

  scannedBarcode.value = rawValue
  statusMessage.value = t('search.barcodeScan.status.checking')

  try {
    const match = await lookupProduct(rawValue)
    if (match) {
      product.value = match
      phase.value = 'found'
      await ActivityLogService.log('barcode_scan_success', { barcode: rawValue })
    } else {
      product.value = null
      phase.value = 'not-found'
      await ActivityLogService.log('barcode_scan_success', { barcode: rawValue, matched: false })
    }
  } catch (err) {
    console.error('❌ [BarcodeScan] Product lookup failed:', err)
    await ActivityLogService.log('barcode_scan_error', { error: String(err), offline: isNetworkError(err as any) })
    product.value = null
    phase.value = 'not-found'
  }
}

function resetScan() {
  phase.value = 'scanning'
  product.value = null
  scannedBarcode.value = ''
  statusMessage.value = t('search.barcodeScan.status.searching')
  locked = false
}

onMounted(async () => {
  await ActivityLogService.log('barcode_scan_start')
  try {
    await startScanner('barcode-reader', handleDetected)
    statusMessage.value = t('search.barcodeScan.status.searching')
  } catch (err) {
    console.error('❌ [BarcodeScan] Failed to start camera:', err)
    await ActivityLogService.log('barcode_scan_error', { error: String(err) })
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

#barcode-reader {
  width: 100%;
  height: 100%;
}

#barcode-reader :deep(video) {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover;
}

/* html5-qrcode injects its own border/canvas overlay — we draw our own
   corner-bracket frame instead, so hide the library's. */
#barcode-reader :deep(canvas),
#barcode-reader :deep(img) {
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

/* 🟢 Result overlay */
.live-result-card {
  pointer-events: auto;
  margin: 0 20px calc(var(--ion-safe-area-bottom, 0px) + 20px);
  padding: 16px;
  border-radius: 20px;
  background: rgba(20, 20, 20, 0.88);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  animation: liveResultIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  display: flex;
  flex-direction: column;
}

@keyframes liveResultIn {
  from { opacity: 0; transform: translateY(16px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.live-result-photo {
  align-self: center;
  width: 84px;
  height: 84px;
  border-radius: 14px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}

.live-result-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.live-result-photo-placeholder {
  font-size: 32px;
  color: rgba(255, 255, 255, 0.4);
}

.live-result-info {
  text-align: center;
}

.live-result-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.3px;
  color: white;
  margin-bottom: 8px;
}

.live-result-badge.badge-success { background: var(--ion-color-success); }
.live-result-badge.badge-primary { background: var(--ion-color-primary); }
.live-result-badge.badge-warning { background: var(--ion-color-warning); color: #2b2b2b; }
.live-result-badge.badge-danger { background: var(--ion-color-danger); }
.live-result-badge.badge-medium { background: var(--ion-color-medium); }

.live-result-name {
  color: white;
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 4px;
  text-align: center;
}

.live-result-highlights {
  color: rgba(255, 255, 255, 0.75);
  font-size: 13px;
  margin-bottom: 12px;
  text-align: center;
}

.live-result-actions {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}

.live-btn {
  flex: 1;
  height: 44px;
  border-radius: 12px;
  border: none;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
}

.live-btn.primary {
  background: var(--ion-color-carrot);
  color: white;
}

.live-btn.secondary {
  background: rgba(255, 255, 255, 0.12);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.25);
}
</style>
