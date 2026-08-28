<template>
  <div
      ref="wrapperRef"
      class="ihi-wrapper"
      :class="{ clickable: props.clickable, zoomable: props.zoomable }"
      :style="wrapperStyle"
      @click="handleClick"
      @wheel="props.zoomable ? onWheel($event) : undefined"
      @touchstart="props.zoomable ? onTouchStart($event) : undefined"
      @touchmove="props.zoomable ? onTouchMove($event) : undefined"
      @touchend="props.zoomable ? onTouchEnd($event) : undefined"
      @mousedown="props.zoomable ? onMouseDown($event) : undefined"
  >
    <div class="ihi-transform-layer" :style="transformStyle">
      <img
          ref="imgRef"
          :src="src"
          alt="Cropped ingredients"
          :class="imgClass"
          draggable="false"
          @load="onLoad"
      />
      <div
          v-for="(box, idx) in boxRects"
          :key="idx"
          class="ihi-highlight-box"
          :style="box.style"
      ></div>
    </div>

    <div v-if="props.zoomable" class="ihi-zoom-badge">
      <ion-icon :icon="expandOutline" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { IonIcon } from '@ionic/vue'
import { expandOutline } from 'ionicons/icons'
import type { IngredientHighlight } from '@/types/Ingredient'
import { ionToHex } from '@/utils/ingredientHelpers'

const props = defineProps<{
  src: string
  ocrImageWidth: number
  ocrImageHeight: number
  highlights: IngredientHighlight[]
  imgClass?: string
  clickable?: boolean
  zoomable?: boolean
}>()

const emit = defineEmits<{ click: [] }>()

const wrapperRef = ref<HTMLDivElement | null>(null)
const imgRef = ref<HTMLImageElement | null>(null)
const containRect = ref({ renderW: 0, renderH: 0, offsetX: 0, offsetY: 0 })
let resizeObserver: ResizeObserver | null = null

function computeContainRect() {
  const el = imgRef.value
  if (!el || !el.naturalWidth || !el.naturalHeight) return
  const containerW = el.clientWidth
  const containerH = el.clientHeight
  if (!containerW || !containerH) return

  const containerRatio = containerW / containerH
  const imageRatio = el.naturalWidth / el.naturalHeight
  let renderW: number, renderH: number
  if (imageRatio > containerRatio) {
    renderW = containerW
    renderH = containerW / imageRatio
  } else {
    renderH = containerH
    renderW = containerH * imageRatio
  }

  containRect.value = {
    renderW,
    renderH,
    offsetX: (containerW - renderW) / 2,
    offsetY: (containerH - renderH) / 2
  }
}

function onLoad() {
  computeContainRect()
  if (imgRef.value && !resizeObserver && 'ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => computeContainRect())
    resizeObserver.observe(imgRef.value)
  }
}

// The <img> may already be loaded/cached by the time this mounts (e.g. a modal
// reusing a blob URL already rendered in the compact preview) — @load won't refire then.
onMounted(() => {
  if (imgRef.value?.complete) onLoad()
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
})

const boxRects = computed(() => {
  const rect = containRect.value
  if (!props.ocrImageWidth || !props.ocrImageHeight || !rect.renderW || !rect.renderH) return []

  const scaleX = rect.renderW / props.ocrImageWidth
  const scaleY = rect.renderH / props.ocrImageHeight

  const rects: { style: Record<string, string> }[] = []
  for (const h of props.highlights) {
    if (!h.boxes?.length) continue
    const color = ionToHex(h.color)
    for (const box of h.boxes) {
      rects.push({
        style: {
          left: `${rect.offsetX + box.x * scaleX}px`,
          top: `${rect.offsetY + box.y * scaleY}px`,
          width: `${box.width * scaleX}px`,
          height: `${box.height * scaleY}px`,
          borderColor: color,
          backgroundColor: color + '2E'
        }
      })
    }
  }
  return rects
})

/** ---------- Pinch-zoom / pan (only active when `zoomable`) ---------- */
const MIN_SCALE = 1
const MAX_SCALE = 4

const scale = ref(1)
const translateX = ref(0)
const translateY = ref(0)

const transformStyle = computed(() => ({
  transform: `translate(${translateX.value}px, ${translateY.value}px) scale(${scale.value})`,
  transformOrigin: 'center center'
}))

// When embedded inline in a scrollable page (not a dedicated full-screen view), the
// wrapper must not block the page's normal vertical scroll until the user actually
// zooms in — otherwise a swipe starting on the image can no longer scroll the page.
// Once zoomed past 1x, switch to 'none' so our own single-finger pan takes over instead
// of the browser trying to scroll the page underneath it.
const wrapperStyle = computed(() => {
  if (!props.zoomable) return undefined
  return { touchAction: scale.value > 1 ? 'none' : 'pan-y' }
})

function clampScale(s: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))
}

function clampPan() {
  const el = wrapperRef.value
  if (!el) return
  const maxX = Math.max(0, (el.clientWidth * (scale.value - 1)) / 2)
  const maxY = Math.max(0, (el.clientHeight * (scale.value - 1)) / 2)
  translateX.value = Math.min(maxX, Math.max(-maxX, translateX.value))
  translateY.value = Math.min(maxY, Math.max(-maxY, translateY.value))
}

function resetZoom() {
  scale.value = 1
  translateX.value = 0
  translateY.value = 0
}

function touchDist(t0: Touch, t1: Touch) {
  return Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY)
}

let pinchStartDist = 0
let pinchStartScale = 1
let isPinching = false
let isPanning = false
const panStartPoint = { x: 0, y: 0 }
const panStartTranslate = { x: 0, y: 0 }

function onTouchStart(e: TouchEvent) {
  if (e.touches.length === 2) {
    isPinching = true
    isPanning = false
    pinchStartDist = touchDist(e.touches[0], e.touches[1])
    pinchStartScale = scale.value
  } else if (e.touches.length === 1 && scale.value > 1) {
    isPanning = true
    isPinching = false
    panStartPoint.x = e.touches[0].clientX
    panStartPoint.y = e.touches[0].clientY
    panStartTranslate.x = translateX.value
    panStartTranslate.y = translateY.value
  }
}

function onTouchMove(e: TouchEvent) {
  if (isPinching && e.touches.length === 2) {
    e.preventDefault()
    const dist = touchDist(e.touches[0], e.touches[1])
    scale.value = clampScale(pinchStartScale * (dist / pinchStartDist))
    clampPan()
  } else if (isPanning && e.touches.length === 1) {
    e.preventDefault()
    translateX.value = panStartTranslate.x + (e.touches[0].clientX - panStartPoint.x)
    translateY.value = panStartTranslate.y + (e.touches[0].clientY - panStartPoint.y)
    clampPan()
  }
}

function onTouchEnd(e: TouchEvent) {
  if (e.touches.length < 2) isPinching = false
  if (e.touches.length < 1) isPanning = false
  if (scale.value <= 1) resetZoom()
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  const delta = -e.deltaY * 0.0015
  scale.value = clampScale(scale.value + delta * scale.value)
  if (scale.value <= 1) resetZoom()
  else clampPan()
}

let isMouseDown = false

function onMouseDown(e: MouseEvent) {
  if (scale.value <= 1) return
  isMouseDown = true
  panStartPoint.x = e.clientX
  panStartPoint.y = e.clientY
  panStartTranslate.x = translateX.value
  panStartTranslate.y = translateY.value
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(e: MouseEvent) {
  if (!isMouseDown) return
  translateX.value = panStartTranslate.x + (e.clientX - panStartPoint.x)
  translateY.value = panStartTranslate.y + (e.clientY - panStartPoint.y)
  clampPan()
}

function onMouseUp() {
  isMouseDown = false
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
}

// Double-tap/double-click to toggle between 1x and 2x zoom
let lastTapTime = 0

function handleClick() {
  if (!props.zoomable) {
    if (props.clickable) emit('click')
    return
  }
  const now = Date.now()
  if (now - lastTapTime < 300) {
    if (scale.value > 1) resetZoom()
    else {
      scale.value = 2
      clampPan()
    }
  }
  lastTapTime = now
}
</script>

<style scoped>
.ihi-wrapper {
  position: relative;
  display: inline-block;
  width: 100%;
  border-radius: 16px;
}

.ihi-wrapper.clickable {
  cursor: zoom-in;
}

.ihi-wrapper.zoomable {
  overflow: hidden;
  cursor: grab;
}

.ihi-zoom-badge {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 16px;
  pointer-events: none;
}

.ihi-transform-layer {
  position: relative;
  width: 100%;
  will-change: transform;
}

.preview-img-cropped {
  width: 100%;
  max-height: 300px;
  object-fit: contain;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  background: var(--ion-color-step-100);
}

.ihi-highlight-box {
  position: absolute;
  box-sizing: border-box;
  border-width: 1px;
  border-style: solid;
  border-radius: 2px;
  pointer-events: none;
}
</style>
