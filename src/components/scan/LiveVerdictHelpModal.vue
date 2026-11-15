<template>
  <ion-modal :is-open="open" :initial-breakpoint="0.85" :breakpoints="[0, 0.85, 1]" @didDismiss="$emit('update:open', false)">
    <div class="help-sheet">
      <h2>
        {{ t('scanIngredients.liveVerdict.label', 'Live Scan') }}
        <span v-if="!isDonor" class="pro-badge"><ion-icon :icon="lockClosed" />{{ t('common.pro', 'Pro') }}</span>
      </h2>
      <p>{{ t('scanIngredients.liveVerdict.helpIntro', 'Point your camera at an ingredient list and get a verdict as you move, with no photo to take.') }}</p>
      <!-- Bound dynamically so the build does not need the screenshot to exist (public/hints/live-verdict-howto.jpg). -->
      <img v-if="!imgFailed" class="help-img" :src="helpImageSrc" :alt="t('scanIngredients.liveVerdict.helpImgAlt', 'Live Scan reading an ingredient list inside the scan box')" @error="imgFailed = true" />
      <ol>
        <li>{{ t('scanIngredients.liveVerdict.helpStep0', 'Find the ingredient heading on the pack (成分 or 原料) and put it inside the box. Reading starts once it is found.') }}</li>
        <li>{{ t('scanIngredients.liveVerdict.helpStep1', 'Keep the ingredient list inside the box. Only what is in the box is read.') }}</li>
        <li>{{ t('scanIngredients.liveVerdict.helpStep2', 'The box turns blue for Muslim-friendly, yellow for Syubhah and red for Haram, and the label says which.') }}</li>
        <li>{{ t('scanIngredients.liveVerdict.helpStep3', 'Flagged ingredients are outlined on the label. Move across the whole list to be sure.') }}</li>
      </ol>
      <p class="help-note">{{ t('scanIngredients.liveVerdict.helpNote', 'The label is read on your phone and nothing is saved. This is a guide, not a halal certification.') }}</p>

      <ion-button v-if="!isDonor" expand="block" color="carrot" class="help-upgrade" @click="upgrade">
        <ion-icon slot="start" :icon="lockClosed" />
        {{ t('scanIngredients.liveVerdict.unlock', 'Unlock Live Scan with Pro') }}
      </ion-button>
    </div>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { IonModal, IonIcon, IonButton } from '@ionic/vue'
import { lockClosed } from 'ionicons/icons'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { isDonor } from '@/composables/useSubscriptionStatus'
import { presentProPaywall } from '@/utils/proPaywall'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'update:open', value: boolean): void }>()

const { t } = useI18n()
const router = useRouter()
const route = useRoute()

const imgFailed = ref(false)
const helpImageSrc = '/hints/live-verdict-howto.jpg'

/** Free users: open the paywall from here; on purchase, go straight into Live Scan. */
async function upgrade() {
  const ok = await presentProPaywall('live_verdict_help')
  if (!ok) return
  emit('update:open', false)
  if (route.path !== '/scan/live') router.push('/scan/live')
}
</script>

<style scoped>
.help-sheet { padding: 20px 20px calc(env(safe-area-inset-bottom, 0px) + 20px); color: var(--ion-text-color, #000); }
.help-sheet h2 { margin: 0 0 8px; font-size: 20px; display: flex; align-items: center; gap: 8px; }
.help-sheet ol { padding-left: 20px; line-height: 1.45; }
.help-img { display: block; width: 100%; max-height: 40vh; object-fit: contain; margin: 12px 0; border-radius: 12px; }
.help-note { font-size: 12px; opacity: 0.7; }
.help-upgrade { margin-top: 12px; height: 48px; font-weight: 700; }
.pro-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0 5px;
  border-radius: 6px;
  background: var(--ion-color-carrot, #e67e22);
  color: #000;
  font-size: 10px;
  font-weight: 800;
  line-height: 1.4;
}
</style>
