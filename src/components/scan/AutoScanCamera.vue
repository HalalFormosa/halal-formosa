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
        <span class="scanner-title">✨ {{ $t('scanIngredients.autoScan.title', 'Auto Scanner') }}</span>
        <button class="close-btn" @click="$emit('close')">
          <ion-icon :icon="closeOutline" />
        </button>
      </div>

      <div class="scan-frame-container">
        <div class="scan-area" :class="{ 'detected': isDetected }">
          <div class="corner top-left"></div>
          <div class="corner top-right"></div>
          <div class="corner bottom-left"></div>
          <div class="corner bottom-right"></div>

          <!-- Example Overlay -->
          <img 
            v-if="!isDetected"
            :src="hintImage" 
            class="hint-overlay" 
            alt="Hint overlay" 
          />

          <div class="scan-line" v-if="scanning"></div>
        </div>
      </div>

      <div class="bottom-controls">
        <div class="status-badge" :class="statusClass">
          <ion-spinner v-if="scanning && !isDetected" name="lines-small" />
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
import { closeOutline } from 'ionicons/icons'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  active: boolean
}>()

const emit = defineEmits<{
  (e: 'detected', result: { blob: Blob, roi: any }): void
  (e: 'error', message: string): void
  (e: 'close'): void
}>()

const { t } = useI18n()

const videoRef = ref<HTMLVideoElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const scanning = ref(false)
const isDetected = ref(false)
const statusMessage = ref(t('scanIngredients.autoScan.status.init', 'Initializing HD Camera...'))

const hintImage = ref('/hints/hints1.png')

let stream: MediaStream | null = null
let analysisInterval: any = null

const statusClass = computed(() => ({
  'status-scanning': scanning.value && !isDetected.value,
  'status-detected': isDetected.value,
  'status-idle': !scanning.value
}))

// Keywords to look for
const INGREDIENT_KEYWORDS = [
  'ingredients', 'ingredient', '成分', '成份', '配料', '原料', '材料', '內容物', '内容物'
]

async function initCamera() {
  if (stream) return;
  
  console.log('📸 [AutoScan] Requesting HD camera access...');
  statusMessage.value = t('scanIngredients.autoScan.status.connecting', 'Connecting HD Camera...')
  
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

async function startAnalysis() {
  if (analysisInterval) return
  
  analysisInterval = setInterval(async () => {
    if (!scanning.value || isDetected.value || !videoRef.value || !canvasRef.value) return

    const video = videoRef.value
    const canvas = canvasRef.value
    const context = canvas.getContext('2d')
    if (!context) return

    canvas.width = 1024
    canvas.height = (1024 / video.videoWidth) * video.videoHeight
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

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
        
        let roi = null;
        // Check multiple possible paths for annotations 
        let annotations = json.textAnnotations || json.responses?.[0]?.textAnnotations;
        
        if (!annotations && json.words) {
            console.log('💡 [AutoScan] mapping "words" to annotations format');
            const sample = json.words[0];
            console.log('📦 [AutoScan] Sample word:', JSON.stringify(sample));
            
            // Map our custom 'words' format to Vision's 'textAnnotations' format
            const mapped = json.words.map((w: any) => {
                let vertices = [];
                const poly = w.boundingPoly || w.boundingBox;
                
                if (poly && Array.isArray(poly.vertices)) {
                    vertices = poly.vertices;
                } else if (poly && typeof poly.x === 'number') {
                    // Convert {x,y,w,h} to vertices
                    vertices = [
                        { x: poly.x, y: poly.y },
                        { x: poly.x + poly.w, y: poly.y },
                        { x: poly.x + poly.w, y: poly.y + poly.h },
                        { x: poly.x, y: poly.y + poly.h }
                    ];
                } else if (Array.isArray(w.vertices)) {
                    // Direct vertices array (Supabase Edge Function format)
                    vertices = w.vertices;
                }
                
                return {
                    description: w.text || w.description || w.word || '',
                    boundingPoly: { vertices }
                };
            });
            // Prepend a dummy full-text annotation because calculateROI starts from index 1
            annotations = [{ description: json.text || '', boundingPoly: { vertices: [] } }, ...mapped];
        }

        if (annotations) {
            roi = calculateROI(annotations, foundKeyword, canvas.width, canvas.height);
        } else {
            console.warn('⚠️ [AutoScan] No annotations found for ROI. Keys:', Object.keys(json));
        }
        
        handleDetection(roi)
      } else {
        console.log('⏳ [AutoScan] Ingredients not detected yet...');
        statusMessage.value = t('scanIngredients.autoScan.status.notFound', 'Ingredients not found, keep holding...')
      }
    } catch (e) {
      console.warn('⚠️ [AutoScan] AI Analysis failed', e)
    }
  }, 3500)
}

function calculateROI(annotations: any[], keyword: string, canvasW: number, canvasH: number) {
    try {
        console.log('🔍 [AutoScan] Attempting ROI for:', keyword, `on ${canvasW}x${canvasH}`);
        
        // 1. Try exact match first
        let target = annotations.find((a: any, i: number) => 
            i > 0 && 
            a.description && 
            a.description.toLowerCase().includes(keyword.toLowerCase())
        );

        // 2. If exact match fails, OCR might have split the keyword (e.g., "成" and "分").
        // Combine all blocks to find the character offset, then map it back to the bounding block.
        if (!target || !target.boundingPoly) {
            let concatenated = "";
            const blockMap: any[] = [];
            
            for (let i = 1; i < annotations.length; i++) {
                const desc = annotations[i].description || "";
                concatenated += desc;
                // For each character in the description, push a reference to its parent annotation
                for (let c = 0; c < desc.length; c++) {
                    blockMap.push(annotations[i]);
                }
            }

            const matchIndex = concatenated.toLowerCase().indexOf(keyword.toLowerCase());
            if (matchIndex !== -1 && blockMap[matchIndex]) {
                target = blockMap[matchIndex];
                console.log(`💡 [AutoScan] Fuzzy match successful for '${keyword}'. Mapped to block:`, target.description);
            }
        }

        if (!target || !target.boundingPoly) {
            console.warn(`⚠️ [AutoScan] Keyword match failed for '${keyword}' in textAnnotations blocks (total blocks: ${annotations.length})`);
            // Fallback: search in block 0 if blocks 1+ failed
            if (annotations[0]?.description?.toLowerCase().includes(keyword.toLowerCase())) {
                 console.log('💡 [AutoScan] Keyword found in block 0 only, using full image coordinates');
            }
            return null;
        }

        console.log('🎯 [AutoScan] Found target block:', target.description);
        const vertices = target.boundingPoly.vertices;
        
        let targetXMin = 0;
        let targetYMin = 0;

        // The edge function might return {x, y} or just numbers in an array. Handle safely.
        if (vertices.length > 0) {
           if (typeof vertices[0].x !== 'undefined') {
                targetXMin = Math.min(...vertices.map((v: any) => v.x ?? 0));
                targetYMin = Math.min(...vertices.map((v: any) => v.y ?? 0));
           } else if (typeof vertices[0] === 'number') {
                targetXMin = vertices[0];
                targetYMin = vertices[1];
           }
        }
        
        // 🎯 Improved ROI strategy for programmatic cropping:
        // Calculate the bounding box of ALL text blocks that appear near or below the keyword.
        let allLeft = targetXMin;
        let allRight = targetXMin;
        let allTop = targetYMin;
        let allBottom = targetYMin;
        
        for (let i = 1; i < annotations.length; i++) {
            const poly = annotations[i].boundingPoly;
            if (!poly || !poly.vertices || poly.vertices.length === 0) continue;
            
            let vxMin = 0, vxMax = 0, vyMin = 0, vyMax = 0;
            const vs = poly.vertices;
            
            if (typeof vs[0].x !== 'undefined') {
                vxMin = Math.min(...vs.map((v: any) => v.x ?? 0));
                vxMax = Math.max(...vs.map((v: any) => v.x ?? 0));
                vyMin = Math.min(...vs.map((v: any) => v.y ?? 0));
                vyMax = Math.max(...vs.map((v: any) => v.y ?? 0));
            } else if (typeof vs[0] === 'number') {
                if (vs.length >= 8) {
                   vxMin = Math.min(vs[0], vs[2], vs[4], vs[6]);
                   vxMax = Math.max(vs[0], vs[2], vs[4], vs[6]);
                   vyMin = Math.min(vs[1], vs[3], vs[5], vs[7]);
                   vyMax = Math.max(vs[1], vs[3], vs[5], vs[7]);
                } else {
                   vxMin = vs[0]; vxMax = vs[0];
                   vyMin = vs[1]; vyMax = vs[1];
                }
            }
            
            // Only consider text that starts roughly at or below the keyword's height (with negative 50px tolerance)
            if (vyMax >= targetYMin - 50) {
                allLeft = Math.min(allLeft, vxMin);
                allRight = Math.max(allRight, vxMax);
                allTop = Math.min(allTop, vyMin);
                allBottom = Math.max(allBottom, vyMax);
            }
        }
        
        // Add 5% padding around the detected text boundaries
        const canvasPadW = canvasW * 0.05;
        const canvasPadH = canvasH * 0.05;
        
        allLeft = Math.max(0, allLeft - canvasPadW);
        allTop = Math.max(0, allTop - canvasPadH);
        allRight = Math.min(canvasW, allRight + canvasPadW);
        allBottom = Math.min(canvasH, allBottom + canvasPadH);
        
        const leftPct = (allLeft / canvasW) * 100;
        const topPct = (allTop / canvasH) * 100;
        let widthPct = ((allRight - allLeft) / canvasW) * 100;
        let heightPct = ((allBottom - allTop) / canvasH) * 100;
        
        // Ensure boundaries don't exceed 100%
        if (leftPct + widthPct > 100) widthPct = 100 - leftPct;
        if (topPct + heightPct > 100) heightPct = 100 - topPct;
        
        const result = {
            left: leftPct, 
            top: topPct,
            width: widthPct, 
            height: heightPct 
        };
        console.log('📐 [AutoScan] Dynamic text-bounded ROI:', result);
        return result;
    } catch (e) {
        console.error('❌ [AutoScan] ROI calculation failed', e);
        return null;
    }
}

watch(() => props.active, (val) => {
  if (val) initCamera()
  else stopCamera()
})

import { Haptics, ImpactStyle } from '@capacitor/haptics'

async function handleDetection(roi: any = null) {
  isDetected.value = true
  statusMessage.value = t('scanIngredients.autoScan.status.found', 'Ingredients Found! Focusing...')
  scanning.value = false
  
  try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      setTimeout(async () => {
          await Haptics.impact({ style: ImpactStyle.Heavy });
      }, 150);
  } catch(e) { 
      console.warn('⚠️ [AutoScan] Haptics failed', e)
  }
  
  // ⚡ Slightly longer focus delay for slower Android cameras
  await new Promise(r => setTimeout(r, 600))

  if (videoRef.value && stream) {
      let finalBlob: Blob | null = null;
      try {
        const videoTrack = stream.getVideoTracks()[0];
        if ('ImageCapture' in window && videoTrack) {
          const capture: any = new (window as any).ImageCapture(videoTrack);
          finalBlob = await capture.takePhoto();
        }
      } catch (e) {
        console.warn('⚠️ [AutoScan] ImageCapture failed', e);
      }

      if (!finalBlob) {
          const canvas = document.createElement('canvas')
          canvas.width = videoRef.value.videoWidth
          canvas.height = videoRef.value.videoHeight
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.imageSmoothingEnabled = true
            ctx.imageSmoothingQuality = 'high'
            ctx.drawImage(videoRef.value, 0, 0)
            finalBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 1.0));
          }
      }

      if (finalBlob) {
          emit('detected', { blob: finalBlob, roi });
      }
  }
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
</style>
