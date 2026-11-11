<template>
  <ion-modal
    :is-open="open"
    class="pro-upsell-sheet"
    :initial-breakpoint="0.55"
    :breakpoints="[0, 0.55, 0.8]"
    @didDismiss="onDidDismiss"
  >
    <div class="sheet">
      <div class="icon-circle">
        <ion-icon :icon="icon" />
      </div>
      <h2 class="sheet-title">{{ title }}</h2>
      <p class="sheet-message">{{ message }}</p>
      <slot />

      <ion-button v-if="canUpgrade" expand="block" shape="round" class="pro-btn" :disabled="busy" @click="upgrade">
        <ion-icon slot="start" :icon="star" />
        {{ upgradeLabel }}
      </ion-button>
      <ion-button v-if="secondaryLabel" expand="block" shape="round" fill="outline" color="carrot" @click="runSecondary">
        {{ secondaryLabel }}
      </ion-button>
      <ion-button expand="block" fill="clear" color="medium" @click="close">
        {{ dismissLabel }}
      </ion-button>
    </div>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { IonModal, IonButton, IonIcon } from '@ionic/vue'
import { star, scanOutline } from 'ionicons/icons'
import { presentProPaywall } from '@/utils/proPaywall'

/**
 * Bottom sheet that offers Pro at the moment a free limit is hit. It never blocks: there is
 * always a way out ("not now") and, when the caller supplies one, a free alternative.
 *
 * `dismissed` fires only when the user leaves without choosing anything (Not now, swipe or
 * backdrop), so a parent can decide what to do next, e.g. leave a camera screen.
 */
const props = withDefaults(defineProps<{
  open: boolean
  /** Activity-log source passed to the paywall, e.g. "scan_limit". */
  source: string
  /** Extra fields logged with the paywall trigger. */
  meta?: Record<string, unknown>
  title: string
  message: string
  upgradeLabel: string
  dismissLabel: string
  /** Free alternative. Omit to hide the button. */
  secondaryLabel?: string
  /** False where the paywall can't run (web), so only free options show. */
  canUpgrade?: boolean
  icon?: string
}>(), {
  meta: undefined,
  secondaryLabel: undefined,
  canUpgrade: true,
  icon: scanOutline,
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'upgraded'): void
  (e: 'secondary'): void
  (e: 'dismissed'): void
}>()

const busy = ref(false)
// Why the sheet closed, so didDismiss only reports a plain dismissal as "dismissed".
let closedBy: 'upgraded' | 'secondary' | null = null

async function upgrade() {
  if (busy.value) return
  busy.value = true
  try {
    const ok = await presentProPaywall(props.source, { meta: props.meta })
    if (!ok) return
    closedBy = 'upgraded'
    emit('update:open', false)
    emit('upgraded')
  } finally {
    busy.value = false
  }
}

function runSecondary() {
  closedBy = 'secondary'
  emit('update:open', false)
  emit('secondary')
}

function close() {
  emit('update:open', false)
}

function onDidDismiss() {
  emit('update:open', false)
  if (!closedBy) emit('dismissed')
  closedBy = null
}
</script>

<style scoped>
.sheet {
  padding: 24px 20px calc(env(safe-area-inset-bottom, 0px) + 16px);
  text-align: center;
  color: var(--ion-text-color, #000);
}
.icon-circle {
  width: 52px;
  height: 52px;
  margin: 0 auto 12px;
  border-radius: 50%;
  background: rgba(230, 126, 34, 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
}
.icon-circle ion-icon {
  font-size: 26px;
  color: var(--ion-color-carrot, #e67e22);
}
.sheet-title {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 700;
}
.sheet-message {
  margin: 0 0 18px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ion-color-medium, #666);
}
.pro-btn {
  --background: #facc15;
  --background-activated: #ca8a04;
  --color: #000;
  font-weight: 600;
}
ion-button {
  margin: 0 0 8px;
}
</style>
