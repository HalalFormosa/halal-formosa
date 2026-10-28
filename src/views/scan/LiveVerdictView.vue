<template>
  <ion-page>
    <!-- The camera is drawn natively behind the webview; this page is deliberately transparent. -->
    <ion-content :fullscreen="true" class="live-content" :scroll-y="false">
      <div ref="stageRef" class="stage">
        <template v-if="supported">
          <div
            v-for="b in boxes"
            :key="b.key"
            class="hl-box"
            :style="{ left: b.x + 'px', top: b.y + 'px', width: b.width + 'px', height: b.height + 'px', borderColor: b.color }"
          >
            <span class="hl-label" :class="'hl-label--' + b.ion" :style="{ background: b.color }">{{ b.label }}</span>
          </div>
        </template>

        <div class="top-bar">
          <button class="round-btn" aria-label="Close" @click="close">
            <ion-icon :icon="closeOutline" />
          </button>
          <span class="experimental-pill">Experimental</span>
          <button v-if="running" class="round-btn" :aria-label="torchOn ? 'Turn torch off' : 'Turn torch on'" @click="toggleTorch">
            <ion-icon :icon="torchOn ? flashlight : flashlightOutline" />
          </button>
          <span v-else class="round-btn-spacer" />
        </div>

        <div class="bottom-card" :class="'bottom-card--' + verdictClass">
          <template v-if="!supported">
            <div class="verdict-title">Android only for now</div>
            <div class="verdict-sub">Live Verdict needs the Android app. Use Scan Ingredients on this device.</div>
          </template>
          <template v-else-if="error">
            <div class="verdict-title">Can't start</div>
            <div class="verdict-sub">{{ error }}</div>
            <ion-button size="small" color="carrot" class="retry" @click="start">Try again</ion-button>
          </template>
          <template v-else>
            <div class="verdict-title">{{ verdictTitle }}</div>
            <div class="verdict-sub">{{ verdictSub }}</div>
          </template>
          <div class="disclaimer">
            Reads only the text in view, on your phone. Nothing is saved or uploaded. Not a certification.
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { IonPage, IonContent, IonIcon, IonButton, onIonViewDidEnter, onIonViewWillLeave } from '@ionic/vue'
import { closeOutline, flashlight, flashlightOutline } from 'ionicons/icons'
import { useRouter } from 'vue-router'
import { Capacitor } from '@capacitor/core'
import useLiveVerdict from '@/composables/useLiveVerdict'
import { extractIonColor, colorMeaning } from '@/utils/ingredientHelpers'
import { mapImageBoxToView, liveMatchKey } from '@/utils/liveVerdictMatcher'

const router = useRouter()
const supported = Capacitor.getPlatform() === 'android'

const { running, error, verdict, highlights, frameSize, torchOn, start, stop, toggleTorch } = useLiveVerdict()

const stageRef = ref<HTMLElement | null>(null)
const viewSize = ref({ width: window.innerWidth, height: window.innerHeight })

function measure() {
  const el = stageRef.value
  if (el) viewSize.value = { width: el.clientWidth, height: el.clientHeight }
}

const boxes = computed(() => {
  if (!frameSize.value.width) return []
  const out: { key: string; x: number; y: number; width: number; height: number; color: string; ion: string; label: string }[] = []
  for (const h of highlights.value) {
    const ion = extractIonColor(h.color)
    const status = colorMeaning(ion)
    h.boxes?.forEach((box, i) => {
      const mapped = mapImageBoxToView(box, frameSize.value, viewSize.value)
      out.push({
        key: `${liveMatchKey(h)}#${i}`,
        ...mapped,
        color: `var(--ion-color-${ion})`,
        ion,
        label: `${status} · ${h.matchedVariant ?? h.keyword}`,
      })
    })
  }
  return out
})

const flagged = computed(() =>
  highlights.value.filter(h => ['danger', 'warning'].includes(extractIonColor(h.color))),
)

const verdictClass = computed(() => {
  if (!supported || error.value) return 'idle'
  return { scanning: 'idle', Haram: 'danger', Syubhah: 'warning' }[verdict.value]
})

const verdictTitle = computed(() => (verdict.value === 'scanning' ? 'Point at the ingredient list' : verdict.value))

const verdictSub = computed(() => {
  switch (verdict.value) {
    case 'Haram':
    case 'Syubhah':
      return 'Flagged: ' + flagged.value.map(h => h.matchedVariant ?? h.keyword).join(', ')
    default:
      return running.value ? 'Nothing flagged so far. Move across the whole list.' : 'Starting camera…'
  }
})

function close() {
  router.back()
}

onMounted(() => {
  measure()
  window.addEventListener('resize', measure)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', measure)
  void stop()
})

onIonViewDidEnter(() => {
  measure()
  if (supported) void start()
})
onIonViewWillLeave(() => {
  void stop()
})
</script>

<style scoped>
.live-content {
  --background: transparent;
}
.stage {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
.hl-box {
  position: absolute;
  border: 3px solid;
  border-radius: 6px;
  box-sizing: border-box;
}
.hl-label {
  position: absolute;
  left: -3px;
  bottom: 100%;
  margin-bottom: 2px;
  max-width: 70vw;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #fff;
}
/* Yellow chips use black text (brand guidelines). */
.hl-label--warning {
  color: #000;
}
.top-bar {
  position: absolute;
  top: calc(env(safe-area-inset-top, 0px) + 12px);
  left: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: auto;
}
.round-btn,
.round-btn-spacer {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 0;
}
.round-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 22px;
}
.experimental-pill {
  padding: 4px 12px;
  border-radius: 999px;
  background: var(--ion-color-carrot, #e67e22);
  color: #000;
  font-size: 12px;
  font-weight: 700;
}
.bottom-card {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 12px);
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(20, 20, 22, 0.88);
  color: #fff;
  pointer-events: auto;
  border-left: 8px solid transparent;
}
.bottom-card--danger { border-left-color: var(--ion-color-danger); }
.bottom-card--warning { border-left-color: var(--ion-color-warning); }
.verdict-title {
  font-size: 22px;
  font-weight: 800;
}
.verdict-sub {
  margin-top: 2px;
  font-size: 14px;
  opacity: 0.9;
}
.disclaimer {
  margin-top: 8px;
  font-size: 11px;
  opacity: 0.65;
}
.retry {
  margin-top: 8px;
}
</style>

<style>
/* While the native camera is behind the webview, every layer above it must be see-through. */
html.live-verdict-active,
html.live-verdict-active body,
html.live-verdict-active ion-app,
html.live-verdict-active ion-router-outlet,
html.live-verdict-active .ion-page,
html.live-verdict-active ion-content {
  background: transparent !important;
  --background: transparent !important;
}
</style>
