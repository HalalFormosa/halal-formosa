<template>
  <div class="spc" :class="[`spc--step-${step}`, { 'spc--done': done }]">
    <!-- Photo: a tall rounded print that slowly drifts while we read it -->
    <div class="spc-photo">
      <div class="spc-frame" :style="frameStyle">
        <img v-if="imageUrl" :src="imageUrl" class="spc-img" alt="" draggable="false" />

        <!-- A soft glint of light glides across the label while it is read -->
        <div v-if="step <= 3 && !done" class="spc-glint" aria-hidden="true" />

        <!-- Each line of text the OCR found gets highlighted, then underlined -->
        <div v-if="showMarks" class="spc-marks" aria-hidden="true">
          <span v-for="(b, i) in marks" :key="i" class="spc-mark" :style="b.style" />
        </div>

        <div class="spc-vignette" aria-hidden="true" />
      </div>

      <!-- Progress ring that sits on the photo's lower edge -->
      <div class="spc-ring" :key="done ? 'done' : 'run'">
        <svg viewBox="0 0 80 80" class="spc-ring-svg" aria-hidden="true">
          <circle class="spc-ring-track" cx="40" cy="40" r="34" />
          <circle
            class="spc-ring-fill"
            cx="40" cy="40" r="34"
            :stroke-dasharray="CIRC"
            :stroke-dashoffset="CIRC * (1 - shown)"
          />
        </svg>
        <div class="spc-ring-inner">
          <ion-icon v-if="done" :icon="checkmarkOutline" class="spc-check" />
          <template v-else>{{ pct }}<small>%</small></template>
        </div>
        <span v-if="done" class="spc-burst" aria-hidden="true">
          <i v-for="n in 8" :key="n" :style="{ '--a': n * 45 + 'deg' }" />
        </span>
      </div>
    </div>

    <!-- What is happening now -->
    <div class="spc-info" aria-live="polite">
      <transition name="spc-swap" mode="out-in">
        <div :key="step" class="spc-copy">
          <h3 class="spc-title">
            <ion-icon :icon="stepIcon" />
            {{ t(`scanIngredients.scanProgress.s${step}.title`) }}
          </h3>
          <p class="spc-sub">
            {{ step === 4 && knownCount
              ? t('scanIngredients.scanProgress.s4.subCount', { count: knownCount })
              : t(`scanIngredients.scanProgress.s${step}.sub`) }}
          </p>
        </div>
      </transition>

      <!-- Four small dots show where we are -->
      <div class="spc-dots" aria-hidden="true">
        <span v-for="n in TOTAL" :key="n" :class="{ on: n <= step, now: n === step && !done }" />
      </div>
    </div>

    <!-- Ingredients land here one by one as they are checked -->
    <div v-if="step === 4 && chips.length" class="spc-tray" aria-hidden="true">
      <span v-for="c in chips" :key="c" class="spc-chip">{{ c }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { IonIcon } from '@ionic/vue'
import {
  cloudUploadOutline,
  glassesOutline,
  languageOutline,
  shieldCheckmarkOutline,
  checkmarkOutline
} from 'ionicons/icons'
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import type { OcrWord } from '@/types/Ingredient'

const props = withDefaults(defineProps<{
  imageUrl?: string | null
  /** 0..1 from the OCR pipeline */
  progress: number
  words?: OcrWord[]
  imageWidth?: number
  imageHeight?: number
  /** English ingredient names, dropped into the tray in the "checking" step */
  ingredients?: string[]
  /** How many haram / doubtful ingredients we compare against */
  knownCount?: number
}>(), {
  imageUrl: null,
  words: () => [],
  imageWidth: 0,
  imageHeight: 0,
  ingredients: () => [],
  knownCount: 0
})

const { t } = useI18n()
const TOTAL = 4
const CIRC = 2 * Math.PI * 34
// Pipeline progress where each step starts (see useOcrPipeline.ts)
const STEP_STARTS = [0, 0.15, 0.4, 0.7]

/* ---------- Smooth, never-stalling percentage ---------- */
// The pipeline jumps in chunks and the OCR call can sit still for seconds.
// Ease toward the real value, and creep slowly inside the current step so
// the ring always feels alive without ever overtaking the next step.
const shown = ref(0)
let raf = 0

function stepOf(p: number) {
  let s = 1
  for (let i = 0; i < STEP_STARTS.length; i++) if (p >= STEP_STARTS[i]) s = i + 1
  return s
}

function tick() {
  const target = props.progress
  if (target >= 1) {
    shown.value += (1 - shown.value) * 0.2
    if (1 - shown.value < 0.002) shown.value = 1
  } else {
    const s = stepOf(target)
    const ceiling = (STEP_STARTS[s] ?? 1) - 0.02
    let next = shown.value + (target - shown.value) * 0.1
    if (next >= target - 0.004) next = Math.min(shown.value + 0.0007, Math.max(target, ceiling))
    shown.value = Math.max(shown.value, next)
  }
  raf = requestAnimationFrame(tick)
}

onMounted(() => { raf = requestAnimationFrame(tick) })
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  if (chipTimer) clearInterval(chipTimer)
})

const pct = computed(() => Math.min(100, Math.round(shown.value * 100)))
const step = computed(() => stepOf(Math.max(props.progress, 0)))
const done = computed(() => props.progress >= 1)
const stepIcon = computed(
  () => [cloudUploadOutline, glassesOutline, languageOutline, shieldCheckmarkOutline][step.value - 1]
)

/* ---------- Photo frame sized to the image so marks line up ---------- */
const frameStyle = computed(() =>
  props.imageWidth && props.imageHeight
    ? { aspectRatio: `${props.imageWidth} / ${props.imageHeight}` }
    : {}
)

/* ---------- Text marks over the OCR'd lines ---------- */
const MAX_MARKS = 140
const showMarks = computed(() => step.value >= 2 && !done.value && marks.value.length > 0)
const marks = computed(() => {
  const w = props.imageWidth
  const h = props.imageHeight
  if (!w || !h || !props.words?.length) return []
  const out: { style: Record<string, string> }[] = []
  // Skip the first entry when it is the full-text block Vision returns
  const list = props.words.length > 1 ? props.words.slice(1) : props.words
  const stride = Math.max(1, Math.ceil(list.length / MAX_MARKS))
  for (let i = 0; i < list.length; i += stride) {
    const vs = list[i].vertices
    if (!vs?.length) continue
    const xs = vs.map(v => v.x ?? 0)
    const ys = vs.map(v => v.y ?? 0)
    const x = Math.min(...xs), y = Math.min(...ys)
    const bw = Math.max(...xs) - x, bh = Math.max(...ys) - y
    if (bw <= 0 || bh <= 0) continue
    out.push({
      style: {
        left: `${(x / w) * 100}%`,
        top: `${(y / h) * 100}%`,
        width: `${(bw / w) * 100}%`,
        height: `${(bh / h) * 100}%`,
        // Top-to-bottom wave, capped so it never drags
        animationDelay: `${Math.min((y / h) * 900 + (i % 5) * 22, 1100)}ms`
      }
    })
  }
  return out
})

/* ---------- Ingredient tray ---------- */
const MAX_CHIPS = 10
const chips = ref<string[]>([])
let chipTimer: ReturnType<typeof setInterval> | null = null

watch(step, (s) => {
  if (chipTimer) { clearInterval(chipTimer); chipTimer = null }
  if (s !== 4) { chips.value = []; return }
  chips.value = []
  chipTimer = setInterval(() => {
    const next = props.ingredients[chips.value.length]
    if (chips.value.length >= MAX_CHIPS || (!next && props.ingredients.length)) {
      if (chipTimer) { clearInterval(chipTimer); chipTimer = null }
      return
    }
    if (next && !chips.value.includes(next)) chips.value = [...chips.value, next]
    else if (next) chips.value = [...chips.value, `${next} `]
  }, 330)
})

/* ---------- Haptics: a soft tick per step, a pop when it lands ---------- */
async function buzz(kind: 'tick' | 'done') {
  if (!Capacitor.isNativePlatform()) return
  try {
    if (kind === 'done') await Haptics.notification({ type: NotificationType.Success })
    else await Haptics.impact({ style: ImpactStyle.Light })
  } catch { /* haptics unavailable: ignore */ }
}
watch(step, (s, prev) => { if (prev !== undefined && s > prev) buzz('tick') })
watch(done, (d) => { if (d) buzz('done') })
watch(showMarks, (v) => { if (v) buzz('tick') })
</script>

<style scoped>
/* Brand: carrot orange drives everything here. Status colours (green, yellow,
   red, blue) are reserved for verdicts, so none are used. */
.spc {
  --spc-accent: var(--ion-color-carrot, #e67e22);
  --spc-accent-rgb: var(--ion-color-carrot-rgb, 230, 126, 34);
  --spc-shade: var(--ion-color-carrot-shade, #c96718);
  --spc-card: var(--ion-card-background, #fff);
  --spc-muted: var(--ion-color-step-600, #666);
  width: 100%;
  max-width: 320px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--ion-text-color);
  text-align: center;
  animation: spc-in 0.4s cubic-bezier(0.2, 0.9, 0.2, 1) both;
}

/* ----- photo ----- */
.spc-photo { position: relative; width: 100%; display: flex; flex-direction: column; align-items: center; }
.spc-frame {
  position: relative;
  width: auto;
  max-width: 100%;
  max-height: 300px;
  min-height: 140px;
  border-radius: 26px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.06);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.16), 0 0 0 1px rgba(0, 0, 0, 0.06);
}
.spc-img {
  display: block;
  width: 100%;
  height: 100%;
  max-height: 300px;
  object-fit: contain;
  transform-origin: 50% 40%;
  animation: spc-drift 6s ease-in-out infinite alternate;
  transition: filter 0.6s ease;
}
.spc--step-3 .spc-img { filter: brightness(0.9) saturate(0.85); }
.spc--step-4 .spc-img { filter: brightness(0.78) saturate(0.8); }
.spc--done .spc-img { filter: none; animation: none; }
.spc-vignette {
  position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(120% 90% at 50% 40%, transparent 55%, rgba(0, 0, 0, 0.32) 100%);
}

/* ----- glint ----- */
.spc-glint {
  position: absolute; inset: 0; pointer-events: none; overflow: hidden;
}
.spc-glint::before {
  content: '';
  position: absolute; top: -20%; bottom: -20%; left: -60%; width: 45%;
  background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.5), rgba(var(--spc-accent-rgb), 0.25), transparent);
  transform: skewX(-18deg);
  animation: spc-glint 2.3s ease-in-out infinite;
}

/* ----- marks ----- */
.spc-marks { position: absolute; inset: 0; pointer-events: none; }
.spc-mark {
  position: absolute;
  border-bottom: 2.5px solid rgba(var(--spc-accent-rgb), 1);
  background: linear-gradient(to top, rgba(var(--spc-accent-rgb), 0.28), rgba(var(--spc-accent-rgb), 0.05));
  border-radius: 2px 2px 0 0;
  transform-origin: left center;
  transform: scaleX(0);
  opacity: 0;
  animation: spc-mark-draw 0.42s cubic-bezier(0.25, 0.9, 0.3, 1) forwards;
}

/* ----- ring ----- */
.spc-ring {
  position: relative;
  width: 84px;
  height: 84px;
  margin-top: -42px;
  border-radius: 50%;
  background: var(--spc-card);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.05);
  display: grid;
  place-items: center;
  animation: spc-ring-in 0.5s cubic-bezier(0.2, 1.4, 0.4, 1) both;
}
.spc-ring-svg { position: absolute; inset: 2px; width: calc(100% - 4px); height: calc(100% - 4px); transform: rotate(-90deg); }
.spc-ring-track { fill: none; stroke: rgba(var(--spc-accent-rgb), 0.16); stroke-width: 6; }
.spc-ring-fill { fill: none; stroke: var(--spc-accent); stroke-width: 6; stroke-linecap: round; }
.spc-ring-inner {
  position: relative;
  font-size: 22px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--ion-text-color);
  line-height: 1;
}
.spc-ring-inner small { font-size: 11px; font-weight: 700; margin-left: 1px; color: var(--spc-shade); }
.spc-check { font-size: 34px; color: var(--spc-shade); animation: spc-check 0.5s cubic-bezier(0.2, 1.6, 0.4, 1) both; }
.spc--done .spc-ring { animation: spc-ring-done 0.55s cubic-bezier(0.2, 1.5, 0.4, 1) both; }

.spc-burst { position: absolute; inset: 0; pointer-events: none; }
.spc-burst i {
  position: absolute; left: 50%; top: 50%;
  width: 7px; height: 7px; margin: -3.5px;
  border-radius: 50%;
  background: var(--spc-accent);
  transform: rotate(var(--a)) translateY(-44px) scale(0);
  animation: spc-burst 0.7s ease-out 0.08s forwards;
}

/* ----- text ----- */
.spc-info { margin-top: 16px; min-height: 86px; display: flex; flex-direction: column; align-items: center; }
.spc-copy { display: flex; flex-direction: column; align-items: center; }
.spc-title {
  margin: 0;
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 19px; font-weight: 700; line-height: 1.25;
}
.spc-title ion-icon { font-size: 20px; color: var(--spc-accent); flex: none; }
.spc-sub { margin: 4px 0 0; font-size: 13px; color: var(--spc-muted); line-height: 1.4; max-width: 270px; }
.spc-swap-enter-active, .spc-swap-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.spc-swap-enter-from { opacity: 0; transform: translateY(8px); }
.spc-swap-leave-to { opacity: 0; transform: translateY(-8px); }

.spc-dots { display: flex; gap: 7px; margin-top: 12px; }
.spc-dots span {
  width: 7px; height: 7px; border-radius: 50%;
  background: rgba(var(--spc-accent-rgb), 0.22);
  transition: background 0.3s ease, transform 0.3s ease, width 0.3s ease;
}
.spc-dots span.on { background: var(--spc-accent); }
.spc-dots span.now { width: 20px; border-radius: 999px; }

/* ----- ingredient tray ----- */
.spc-tray {
  margin-top: 6px;
  display: flex; flex-wrap: wrap; justify-content: center; gap: 6px;
  max-width: 300px;
}
.spc-chip {
  padding: 5px 11px;
  border-radius: 999px;
  font-size: 12px; font-weight: 600;
  background: rgba(var(--spc-accent-rgb), 0.14);
  color: var(--ion-text-color);
  border: 1px solid rgba(var(--spc-accent-rgb), 0.35);
  animation: spc-chip-drop 0.45s cubic-bezier(0.2, 1.5, 0.4, 1) both;
}

/* ----- keyframes ----- */
@keyframes spc-in { from { opacity: 0; transform: translateY(14px) scale(0.97); } to { opacity: 1; transform: none; } }
@keyframes spc-drift { from { transform: scale(1) translateY(0); } to { transform: scale(1.045) translateY(-1.5%); } }
@keyframes spc-glint { 0% { left: -60%; } 60%, 100% { left: 130%; } }
@keyframes spc-mark-draw { to { opacity: 1; transform: scaleX(1); } }
@keyframes spc-ring-in { from { opacity: 0; transform: scale(0.6); } to { opacity: 1; transform: scale(1); } }
@keyframes spc-ring-done { 0% { transform: scale(1); } 50% { transform: scale(1.14); } 100% { transform: scale(1); } }
@keyframes spc-check { from { opacity: 0; transform: scale(0.3) rotate(-25deg); } to { opacity: 1; transform: none; } }
@keyframes spc-burst { 0% { transform: rotate(var(--a)) translateY(-30px) scale(0.2); opacity: 1; } 100% { transform: rotate(var(--a)) translateY(-56px) scale(1); opacity: 0; } }
@keyframes spc-chip-drop { from { opacity: 0; transform: translateY(-16px) scale(0.7); } to { opacity: 1; transform: none; } }

@media (prefers-reduced-motion: reduce) {
  .spc, .spc-img, .spc-glint::before, .spc-ring, .spc-chip, .spc-check { animation: none; }
  .spc-mark { animation: none; opacity: 1; transform: none; }
  .spc-burst { display: none; }
}
</style>
