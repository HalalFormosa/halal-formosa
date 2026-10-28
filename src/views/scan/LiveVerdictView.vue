<template>
  <ion-page>
    <!-- The camera is drawn natively behind the webview; this page is deliberately transparent. -->
    <ion-content :fullscreen="true" class="live-content" :scroll-y="false">
      <div ref="stageRef" class="stage">
        <!-- Shown while the photo is taken and the label is read, then the add-product flow opens -->
        <div v-if="busy" class="busy-overlay">
          <ion-spinner name="crescent" />
          <div class="busy-text">{{ busyMessage }}</div>
        </div>

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
            <div class="product-row">
              <span class="product-label">Product</span>
              <span class="product-name" :class="{ 'product-name--pending': !productName }">{{ productName || (verdict === 'scanning' ? '—' : 'Looking for the product name…') }}</span>
              <span v-if="productNameEn" class="product-name-en">{{ productNameEn }}</span>
              <span v-else-if="translatingName" class="product-name-en product-name-en--pending">Translating…</span>
            </div>
            <div class="verdict-title">{{ verdictTitle }}</div>
            <div class="verdict-sub">{{ verdictSub }}</div>

            <div v-if="showContributePrompt" class="contribute">
              <div class="contribute-text">
                <strong>New to Halal Formosa?</strong> We don't have this product yet. Add it so others can scan it too.
              </div>
              <div class="contribute-actions">
                <ion-button size="small" color="carrot" @click="onContribute">Add this product</ion-button>
                <ion-button size="small" fill="clear" color="light" @click="dismissPrompt">Not now</ion-button>
              </div>
              <div class="contribute-note">Takes a photo of the label, then asks for the barcode.</div>
              <div v-if="contributeError" class="contribute-error">{{ contributeError }}</div>
            </div>
          </template>
          <div class="disclaimer">
            Reads the label on your phone and saves nothing. The product name is sent for translation when you are online. Not a certification.
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { IonPage, IonContent, IonIcon, IonButton, IonSpinner, onIonViewDidEnter, onIonViewWillLeave } from '@ionic/vue'
import { closeOutline, flashlight, flashlightOutline } from 'ionicons/icons'
import { useRouter } from 'vue-router'
import { Capacitor } from '@capacitor/core'
import useLiveVerdict from '@/composables/useLiveVerdict'
import useLiveContribute from '@/composables/useLiveContribute'
import { isContributionLimitReached } from '@/composables/useScanQuotaReward'
import { extractIonColor, colorMeaning } from '@/utils/ingredientHelpers'
import { mapImageBoxToView, liveMatchKey, liveDisplayName } from '@/utils/liveVerdictMatcher'

const router = useRouter()
const supported = Capacitor.getPlatform() === 'android'

const {
  running, error, verdict, productName, productNameEn, translatingName, lookupName, productMatch,
  highlights, frameSize, torchOn, start, stop, toggleTorch,
} = useLiveVerdict()

const { busy, busyMessage, error: contributeError, contribute } = useLiveContribute({ stopCamera: stop })

// Names the user said "Not now" to, so the prompt does not nag during this visit.
const dismissedNames = ref<string[]>([])
const contributionLimitReached = ref(false)

const showContributePrompt = computed(
  () =>
    supported &&
    running.value &&
    !error.value &&
    !contributionLimitReached.value &&
    productMatch.value === 'missing' &&
    !dismissedNames.value.includes(lookupName.value),
)

function dismissPrompt() {
  dismissedNames.value.push(lookupName.value)
}

function onContribute() {
  void contribute(productNameEn.value || productName.value)
}

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
    // Only flagged ingredients get a box; "Muslim-friendly" matches are not shown live.
    if (ion !== 'danger' && ion !== 'warning') continue
    const status = colorMeaning(ion)
    h.boxes?.forEach((box, i) => {
      const mapped = mapImageBoxToView(box, frameSize.value, viewSize.value)
      out.push({
        key: `${liveMatchKey(h)}#${i}`,
        ...mapped,
        color: `var(--ion-color-${ion})`,
        ion,
        label: `${status} · ${liveDisplayName(h)}`,
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
  return { scanning: 'idle', Haram: 'danger', Syubhah: 'warning', 'Muslim-friendly': 'primary' }[verdict.value]
})

const verdictTitle = computed(() => (verdict.value === 'scanning' ? 'Point at the ingredient list' : verdict.value))

const verdictSub = computed(() => {
  switch (verdict.value) {
    case 'Haram':
    case 'Syubhah':
      return 'Flagged: ' + flagged.value.map(liveDisplayName).join(', ')
    case 'Muslim-friendly':
      return 'No flagged ingredients in the text read so far. Move across the whole list to be sure.'
    default:
      return running.value ? 'Hold steady so the text is sharp.' : 'Starting camera…'
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

onIonViewDidEnter(async () => {
  measure()
  if (supported) void start()
  try {
    contributionLimitReached.value = await isContributionLimitReached()
  } catch {
    contributionLimitReached.value = false
  }
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
.bottom-card--primary { border-left-color: var(--ion-color-primary); }
.product-row {
  display: flex;
  flex-direction: column;
  margin-bottom: 8px;
}
.product-label {
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: 0.6;
}
.product-name {
  font-size: 16px;
  font-weight: 600;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}
.product-name-en {
  margin-top: 2px;
  font-size: 14px;
  opacity: 0.85;
}
.product-name-en--pending {
  opacity: 0.5;
}
.product-name--pending {
  font-weight: 400;
  opacity: 0.6;
}
.verdict-title {
  font-size: 22px;
  font-weight: 800;
}
.verdict-sub {
  margin-top: 2px;
  font-size: 14px;
  opacity: 0.9;
}
.contribute {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
}
.contribute-text {
  font-size: 14px;
  line-height: 1.35;
}
.contribute-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
}
.contribute-note {
  margin-top: 4px;
  font-size: 11px;
  opacity: 0.65;
}
.contribute-error {
  margin-top: 6px;
  font-size: 12px;
  color: var(--ion-color-danger);
}
.busy-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: var(--ion-background-color, #fff);
  color: var(--ion-text-color, #000);
  pointer-events: auto;
}
.busy-text {
  font-size: 15px;
  font-weight: 600;
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
