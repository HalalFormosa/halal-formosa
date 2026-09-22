<template>
  <div class="full-screen-scanner">
    <!-- Camera is the background -->
    <div class="camera-container">
      <video
          ref="videoRef"
          autoplay
          playsinline
          muted
          class="camera-preview"
      ></video>
    </div>

    <!-- UI Overlay (Controls & Feedback) -->
    <div class="scanner-ui-overlay">
      <div class="top-controls">
        <span class="scanner-title">{{ $t('scanIngredients.autoScan.title', 'Auto Scanner') }}</span>
        <div class="top-controls-actions">
          <div v-if="scanStatus" class="scan-count-chip" :class="{ 'scan-count-empty': scanStatus.remaining <= 0 }">
            <ion-icon :icon="scanOutline" />
            <span>{{ scanStatus.isDonor ? '∞' : `${scanStatus.used}/${scanStatus.limit}` }}</span>
          </div>
          <button class="close-btn" @click="$emit('close')">
            <ion-icon :icon="closeOutline" />
          </button>
        </div>
      </div>

      <div class="scan-frame-container">
        <div class="scan-area" ref="scanAreaRef" :class="{ 'detected': isDetected }">
          <div class="corner top-left"></div>
          <div class="corner top-right"></div>
          <div class="corner bottom-left"></div>
          <div class="corner bottom-right"></div>

          <!-- Example Overlay -->
          <img
            v-if="phase === 'searching'"
            :src="hintImage"
            class="hint-overlay"
            alt="Hint overlay"
          />

          <div class="scan-line" v-if="phase !== 'result'"></div>
        </div>
      </div>

      <!-- 🔵 Full-screen analyzing overlay — unmissable feedback while the OCR/translation
           pipeline runs, since that step can take a few seconds and the small status badge
           alone (same green as the "detected" frame) was easy to miss. -->
      <div v-if="phase === 'analyzing'" class="analyzing-overlay">
        <ion-spinner name="crescent" class="analyzing-spinner" />
        <div class="analyzing-text">{{ statusMessage }}</div>
        <div class="analyzing-hint">{{ $t('scanIngredients.autoScan.analyzingHint', 'Photo captured — you can lower the camera now') }}</div>
      </div>

      <!-- 🟢 Live result card — shown instantly over the camera feed, Lens-style -->
      <div v-if="phase === 'result' && lastResult" class="live-result-card">
        <IngredientHighlightImage
          v-if="resultPreviewUrl"
          :src="resultPreviewUrl"
          :ocr-image-width="lastResult.ocrImageWidth || 0"
          :ocr-image-height="lastResult.ocrImageHeight || 0"
          :highlights="flaggedHighlights"
          img-class="preview-img-cropped live-result-preview"
        />
        <div class="live-result-badge" :class="'badge-' + resultColor">
          {{ $t(`search.status.${lastResult.autoStatus}`, lastResult.autoStatus || '') }}
        </div>
        <div class="live-result-name">
          {{ lastResult.productName || $t('scanIngredients.scan.results') }}
        </div>
        <div v-if="lastResult.highlights?.length" class="live-result-highlights">
          {{ $t('scanIngredients.autoScan.highlightsFound', { count: lastResult.highlights.length }) }}
        </div>
        <div class="live-result-actions">
          <button class="live-btn secondary" @click="resetLiveScan">
            {{ $t('scanIngredients.autoScan.scanAgain', 'Scan Again') }}
          </button>
          <button class="live-btn primary" @click="viewDetails">
            {{ $t('scanIngredients.autoScan.viewDetails', 'View Details') }}
          </button>
        </div>
      </div>

      <div class="bottom-controls" v-if="phase !== 'result'">
        <div class="status-badge" :class="statusClass">
          <ion-spinner v-if="phase !== 'searching' || scanning" name="lines-small" />
          <span>{{ statusMessage }}</span>
        </div>

        <div class="tips">
          {{ $t('scanIngredients.autoScan.hint', 'Position ingredients inside the frame') }}
        </div>
      </div>
    </div>

    <!-- Hidden canvas for frame analysis -->
    <canvas ref="canvasRef" style="display: none;"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { IonIcon, IonSpinner } from '@ionic/vue'
import { closeOutline, scanOutline } from 'ionicons/icons'
import { useI18n } from 'vue-i18n'
import useHighlightCache from '@/composables/useHighlightCache'
import { useOcrService } from '@/composables/useOcrService'
import type { AutoScanResult } from '@/composables/useAutoScanStore'
import IngredientHighlightImage from '@/components/scan/IngredientHighlightImage.vue'
import { extractIonColor } from '@/utils/ingredientHelpers'
import { getScanStatus, type ScanStatus } from '@/services/ScanLimitService'
import { ActivityLogService } from '@/services/ActivityLogService'

const props = defineProps<{
  active: boolean
}>()

const emit = defineEmits<{
  (e: 'detected', result: AutoScanResult): void
  (e: 'stable-result', result: AutoScanResult): void
  (e: 'error', message: string): void
  (e: 'close'): void
}>()

const { t } = useI18n()

const videoRef = ref<HTMLVideoElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const scanAreaRef = ref<HTMLDivElement | null>(null)
const scanning = ref(false)
const isDetected = ref(false)
const statusMessage = ref(t('scanIngredients.autoScan.status.init', 'Initializing HD Camera...'))
// Today's usage/limit shown in the top-controls chip, kept in sync with the
// same daily-cap check startAnalysis already runs before each detection.
const scanStatus = ref<ScanStatus | null>(null)

// 'searching' -> polling for the "ingredients" keyword
// 'analyzing' -> running the full OCR/translation pipeline on a detected frame
// 'result'    -> live overlay showing the halal status, waiting on the user
const phase = ref<'searching' | 'analyzing' | 'result'>('searching')
const lastResult = ref<AutoScanResult | null>(null)

// Only draw boxes around the flagged (Syubhah/Haram) ingredients on the preview —
// Muslim-friendly ones don't need calling out.
const flaggedHighlights = computed(() => {
  const highlights = lastResult.value?.highlights || []
  return highlights.filter((h) => {
    const color = extractIonColor(h.color)
    return color === 'warning' || color === 'danger'
  })
})

// Object URL for the actual cropped/captured frame the result is based on, so the
// user can see what was scanned before deciding to view details or scan again.
const resultPreviewUrl = ref<string | null>(null)
watch(lastResult, (result) => {
  if (resultPreviewUrl.value) {
    URL.revokeObjectURL(resultPreviewUrl.value)
    resultPreviewUrl.value = null
  }
  if (result?.blob) {
    resultPreviewUrl.value = URL.createObjectURL(result.blob)
  }
})

// The live scan only checks ingredient keywords, not official certification, so
// "Halal" (which requires certification lookup) is never a possible result here —
// the best achievable verdict is "Muslim-friendly".
const resultColor = computed(() => {
  const status = lastResult.value?.autoStatus
  if (status === 'Haram') return 'danger'
  if (status === 'Syubhah') return 'warning'
  if (status === 'Muslim-friendly') return 'primary'
  return 'medium'
})

const hintImage = ref('/hints/hints1.png')

let stream: MediaStream | null = null
let analysisInterval: any = null

const statusClass = computed(() => ({
  'status-scanning': scanning.value && !isDetected.value,
  'status-detected': isDetected.value,
  'status-idle': !scanning.value
}))

/** ---------- Live OCR/translation pipeline (reused for the instant overlay) ---------- */
const { allHighlights, blacklistPatterns, fetchHighlightsWithCache, incrementUsageCount } = useHighlightCache()

const {
  processFile,
  ocrImageWidth: pipelineImageWidth,
  ocrImageHeight: pipelineImageHeight,
} = useOcrService({
  allHighlights,
  blacklistPatterns,
  fetchHighlightsWithCache,
  incrementUsageCount,
  setError: (msg: string) => console.warn('⚠️ [AutoScan] Live analysis error:', msg),
  t,
})

// Keywords to look for
const INGREDIENT_KEYWORDS = [
  'ingredients', 'ingredient', '成分', '成份', '配料', '原料', '材料', '內容物', '内容物'
]

async function refreshScanStatus() {
  try {
    scanStatus.value = await getScanStatus()
  } catch (e) {
    console.warn('⚠️ [AutoScan] Failed to load scan status:', e)
  }
}

async function initCamera() {
  if (stream) return;

  console.log('📸 [AutoScan] Requesting HD camera access...');
  statusMessage.value = t('scanIngredients.autoScan.status.connecting', 'Connecting HD Camera...')
  refreshScanStatus()

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          // Request continuous focus if supported
          // @ts-expect-error - focusMode is not in MediaTrackConstraints type but works in Chrome/Android
          focusMode: 'continuous'
      },
      audio: false
    })
    
    if (videoRef.value) {
      videoRef.value.srcObject = stream
      videoRef.value.setAttribute('autoplay', '');
      videoRef.value.setAttribute('muted', '');
      videoRef.value.setAttribute('playsinline', '');
      
      await videoRef.value.play()
      
      // Log actual resolution received
      console.log(`✅ [AutoScan] Video started: ${videoRef.value.videoWidth}x${videoRef.value.videoHeight}`);
      
      statusMessage.value = t('scanIngredients.autoScan.status.searching', 'Searching for ingredients...')
      scanning.value = true
      startAnalysis()
    }
  } catch (err: any) {
    console.error('❌ [AutoScan] Camera access failed:', err)
    emit('error', 'Could not access camera. Please check permissions.')
  }
}

// Maps the on-screen guide box (.scan-area) to a source rectangle in the video's
// native pixel space, accounting for the object-fit:cover crop/scale of <video>.
// This is what keeps analysis limited to "inside the square scanner" rather than
// the whole camera frame, which previously let text outside the box (e.g. a
// barcode/disclaimer line elsewhere on the label) trigger a false keyword match.
function getGuideBoxSourceRect(video: HTMLVideoElement) {
  const videoEl = videoRef.value
  const boxEl = scanAreaRef.value
  if (!videoEl || !boxEl || !video.videoWidth || !video.videoHeight) return null

  const videoRect = videoEl.getBoundingClientRect()
  const boxRect = boxEl.getBoundingClientRect()
  if (!videoRect.width || !videoRect.height) return null

  const nativeW = video.videoWidth
  const nativeH = video.videoHeight
  const scale = Math.max(videoRect.width / nativeW, videoRect.height / nativeH)
  const offsetX = (nativeW * scale - videoRect.width) / 2
  const offsetY = (nativeH * scale - videoRect.height) / 2

  const toNative = (screenX: number, screenY: number) => ({
    x: (screenX + offsetX) / scale,
    y: (screenY + offsetY) / scale,
  })

  const topLeft = toNative(boxRect.left - videoRect.left, boxRect.top - videoRect.top)
  const bottomRight = toNative(boxRect.right - videoRect.left, boxRect.bottom - videoRect.top)

  const sx = Math.max(0, Math.min(nativeW, topLeft.x))
  const sy = Math.max(0, Math.min(nativeH, topLeft.y))
  const sw = Math.max(1, Math.min(nativeW - sx, bottomRight.x - topLeft.x))
  const sh = Math.max(1, Math.min(nativeH - sy, bottomRight.y - topLeft.y))

  return { sx, sy, sw, sh }
}

async function startAnalysis() {
  if (analysisInterval) return

  analysisInterval = setInterval(async () => {
    if (phase.value !== 'searching' || !scanning.value || !videoRef.value || !canvasRef.value) return

    const video = videoRef.value
    const canvas = canvasRef.value
    const context = canvas.getContext('2d')
    if (!context) return

    const guideRect = getGuideBoxSourceRect(video)
    if (!guideRect) return

    canvas.width = 1024
    canvas.height = Math.round((1024 / guideRect.sw) * guideRect.sh)
    context.drawImage(
      video,
      guideRect.sx, guideRect.sy, guideRect.sw, guideRect.sh,
      0, 0, canvas.width, canvas.height
    )

    try {
      console.log('🔍 [AutoScan] AI Checking...');
      statusMessage.value = t('scanIngredients.autoScan.status.scanning', 'AI Scanning...')

      const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-ocr`, {
          method: 'POST',
          headers: {
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({ imageBase64: base64, includeAnnotations: true })
      })

      const json = await res.json()
      console.log('📦 [AutoScan] OCR Response keys:', JSON.stringify(Object.keys(json)));
      const text = json.text || ''
      const lowerText = text.toLowerCase()

      const foundKeyword = INGREDIENT_KEYWORDS.find(kw => lowerText.includes(kw))

      if (foundKeyword) {
        console.log('🎯 [AutoScan] MATCH:', foundKeyword);

        // A live detection is counted as a completed scan the moment it succeeds
        // (see AutoScanView.vue's onStableResult), so the daily cap has to be
        // enforced right here — not just when the user taps "View Details".
        // Reuses the same status for the top-controls chip so it reflects reality
        // right before the pipeline runs, rather than the (possibly stale) count
        // fetched when the camera first opened.
        const status = await getScanStatus()
        scanStatus.value = status
        const allowed = !status || status.remaining > 0
        if (!allowed) {
          console.log('🚫 [AutoScan] Daily scan limit reached, stopping.')
          ActivityLogService.log('scan_ingredients_limit_reached', { source: 'auto_scan' })
          stopCamera()
          emit('error', t(
            'scanIngredients.limit.reached',
            'Daily scan limit reached. Watch an ad or contribute a missing product/location to get more scans!'
          ))
          return
        }

        // The canvas is already just the guide-box crop, so it's used as-is —
        // no further keyword-position cropping needed.
        handleLiveDetection(canvas)
      } else {
        console.log('⏳ [AutoScan] Ingredients not detected yet...');
        statusMessage.value = t('scanIngredients.autoScan.status.notFound', 'Ingredients not found, keep holding...')
      }
    } catch (e) {
      console.warn('⚠️ [AutoScan] AI Analysis failed', e)
    }
  }, 1400)
}

watch(() => props.active, (val) => {
  if (val) initCamera()
  else stopCamera()
})

import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

// 🔔 Distinct vibration per result so the user can tell the verdict without looking:
// Muslim-friendly = one short buzz, Syubhah = two quick knocks, Haram = a longer buzzed alert.
async function triggerResultHaptics(status?: string) {
  try {
    if (status === 'Syubhah') {
      await Haptics.impact({ style: ImpactStyle.Medium })
      await new Promise((resolve) => setTimeout(resolve, 150))
      await Haptics.impact({ style: ImpactStyle.Medium })
    } else if (status === 'Haram') {
      await Haptics.notification({ type: NotificationType.Error })
      await Haptics.vibrate({ duration: 400 })
    } else if (status === 'Muslim-friendly') {
      await Haptics.impact({ style: ImpactStyle.Light })
    } else {
      await Haptics.impact({ style: ImpactStyle.Medium })
    }
  } catch (e) {
    console.warn('⚠️ [AutoScan] Haptics failed', e)
  }
}

// 🟢 Live, Lens-style detection: no capture button, no freeze-and-leave — the keyword
// hit triggers the same OCR/translation pipeline the manual flow uses, and the result
// is overlaid directly on the still-running camera feed. `canvas` is already cropped
// to the guide box (see getGuideBoxSourceRect), so it's used as the final image as-is.
async function handleLiveDetection(canvas: HTMLCanvasElement) {
  if (phase.value !== 'searching') return
  phase.value = 'analyzing'
  isDetected.value = true
  statusMessage.value = t('scanIngredients.autoScan.status.analyzing', 'Reading ingredients...')

  try {
    await Haptics.impact({ style: ImpactStyle.Medium })
  } catch (e) {
    console.warn('⚠️ [AutoScan] Haptics failed', e)
  }

  try {
    const frameBlob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9)
    )
    if (!frameBlob) throw new Error('Failed to capture frame')

    const fileToAnalyze = new File([frameBlob], `live-${Date.now()}.jpg`, { type: 'image/jpeg' })

    const result = await processFile(fileToAnalyze)
    if (!result || (!result.textEn?.trim() && !result.textZh?.trim())) {
      throw new Error('No ingredients recognized in this frame')
    }

    const payload: AutoScanResult = {
      blob: fileToAnalyze,
      roi: null,
      productName: result.productName,
      textEn: result.textEn,
      textZh: result.textZh,
      highlights: result.highlights,
      autoStatus: result.autoStatus,
      detectedLanguage: result.detectedLanguage,
      ocrRaw: result.ocrRaw,
      ocrImageWidth: pipelineImageWidth.value,
      ocrImageHeight: pipelineImageHeight.value,
    }

    lastResult.value = payload
    phase.value = 'result'
    statusMessage.value = t('scanIngredients.autoScan.status.found', 'Ingredients Found!')

    await triggerResultHaptics(payload.autoStatus)

    // Reflect the just-completed scan in the chip immediately — the caller logs
    // it to the DB asynchronously (see AutoScanView.onStableResult), so waiting
    // on a refetch would leave the badge stale for a beat.
    if (scanStatus.value && !scanStatus.value.isDonor) {
      scanStatus.value = {
        ...scanStatus.value,
        used: scanStatus.value.used + 1,
        remaining: Math.max(0, scanStatus.value.remaining - 1),
      }
    }

    // Let the caller log this as a successful detection even if the user never
    // taps "View Details" — the scan itself already succeeded.
    emit('stable-result', payload)
  } catch (e) {
    console.warn('⚠️ [AutoScan] Live analysis failed, resuming scan:', e)
    phase.value = 'searching'
    isDetected.value = false
    statusMessage.value = t('scanIngredients.autoScan.status.notFound', 'Ingredients not found, keep holding...')
  }
}

function resetLiveScan() {
  phase.value = 'searching'
  isDetected.value = false
  lastResult.value = null
  statusMessage.value = t('scanIngredients.autoScan.status.searching', 'Searching for ingredients...')
}

function viewDetails() {
  if (!lastResult.value) return
  emit('detected', lastResult.value)
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop())
    stream = null
  }
  if (analysisInterval) {
    clearInterval(analysisInterval)
    analysisInterval = null
  }
  scanning.value = false
}

onMounted(() => {
  if (props.active) initCamera()
  // Pick a random hint image out of the 5 available
  const randomHint = Math.floor(Math.random() * 5) + 1
  hintImage.value = `/hints/hints${randomHint}.png`
})

onUnmounted(() => {
  stopCamera()
  if (resultPreviewUrl.value) {
    URL.revokeObjectURL(resultPreviewUrl.value)
  }
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
  background: #000;
}

.camera-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}

.camera-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.scanner-ui-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
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
  align-items: center;
  gap: 10px;
}

.scan-count-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 14px;
  border-radius: 20px;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  backdrop-filter: blur(10px);
  white-space: nowrap;
}

.scan-count-chip.scan-count-empty {
  background: var(--ion-color-danger);
}

.close-btn {
  background: rgba(0, 0, 0, 0.5);
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  backdrop-filter: blur(10px);
  pointer-events: auto;
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
  height: 55%;
  border: 1.5px solid rgba(255, 255, 255, 0.3);
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.scan-area.detected {
  border-color: var(--ion-color-success);
  background: rgba(45, 211, 111, 0.1);
  transform: scale(1.05);
}

.corner {
  position: absolute;
  width: 30px;
  height: 30px;
  border: 4px solid var(--ion-color-carrot);
}

.top-left { top: -2px; left: -2px; border-right: 0; border-bottom: 0; border-radius: 4px 0 0 0; }
.top-right { top: -2px; right: -2px; border-left: 0; border-bottom: 0; border-radius: 0 4px 0 0; }
.bottom-left { bottom: -2px; left: -2px; border-right: 0; border-top: 0; border-radius: 0 0 0 4px; }
.bottom-right { bottom: -2px; right: -2px; border-left: 0; border-top: 0; border-radius: 0 0 4px 0; }

.scan-area.detected .corner {
  border-color: var(--ion-color-success);
}

.analyzing-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(2px);
  pointer-events: auto;
}

.analyzing-spinner {
  width: 64px;
  height: 64px;
  color: var(--ion-color-carrot);
  animation: analyzingPulse 1.2s ease-in-out infinite;
}

@keyframes analyzingPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.9); }
}

.analyzing-text {
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
}

.analyzing-hint {
  color: rgba(255, 255, 255, 0.85);
  font-size: 14px;
  font-weight: 500;
  text-align: center;
  padding: 0 32px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}

.hint-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 85%;
  height: 85%;
  object-fit: contain;
  opacity: 0.2;
  pointer-events: none;
  filter: grayscale(0.5);
  transition: opacity 0.3s ease;
}

.scan-line {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background: var(--ion-color-carrot);
  box-shadow: 0 0 15px var(--ion-color-carrot);
  animation: scan 3s linear infinite;
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

.status-scanning { border-color: var(--ion-color-carrot); }
.status-detected { border-color: var(--ion-color-success); background: var(--ion-color-success); }

.tips {
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  text-align: center;
  width: 85%;
  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
  font-weight: 500;
}

/* 🟢 Live result overlay */
.live-result-card {
  pointer-events: auto;
  margin: 0 20px calc(var(--ion-safe-area-bottom, 0px) + 20px);
  padding: 16px;
  border-radius: 20px;
  background: rgba(20, 20, 20, 0.85);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  animation: liveResultIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes liveResultIn {
  /* Opacity-only: a translateY/scale bounce here used to leave the card
     (and its "View Details" button) visually below/smaller than its final
     resting spot for the first ~150ms, so a tap aimed at the button's
     eventual position could land on empty space above it and appear to
     do nothing. Fading in place keeps the hit target stationary. */
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* IngredientHighlightImage renders its own scoped template, so this reaches into
   it via :deep() — object-fit must stay "contain" (not "cover") since the
   component's highlight-box math assumes a letterboxed, uncropped image. */
:deep(.live-result-preview) {
  max-height: 160px;
  object-fit: contain;
  margin-bottom: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
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

.live-result-badge.badge-primary { background: var(--ion-color-primary); }
.live-result-badge.badge-warning { background: var(--ion-color-warning); color: #2b2b2b; }
.live-result-badge.badge-danger { background: var(--ion-color-danger); }
.live-result-badge.badge-medium { background: var(--ion-color-medium); }

.live-result-name {
  color: white;
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 4px;
}

.live-result-highlights {
  color: rgba(255, 255, 255, 0.75);
  font-size: 13px;
  margin-bottom: 12px;
}

.live-result-actions {
  display: flex;
  gap: 10px;
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
