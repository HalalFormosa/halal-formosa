<template>
  <div class="ai-teaser">
    <div class="teaser-head">
      <ion-icon :icon="sparklesOutline" class="teaser-icon" />
      <h3 class="teaser-title">{{ t('scanIngredients.aiSummary.teaser.title', { ingredient }) }}</h3>
      <span class="teaser-pill">PRO</span>
    </div>

    <p class="teaser-body">{{ t('scanIngredients.aiSummary.teaser.body') }}</p>

    <!-- Decorative: hints that an explanation sits behind the button. -->
    <div class="teaser-lines" aria-hidden="true">
      <span style="width: 92%"></span>
      <span style="width: 68%"></span>
    </div>

    <ion-button expand="block" color="carrot" class="teaser-button" @click="emit('unlock')">
      <ion-icon slot="start" :icon="lockClosedOutline" />
      {{ t('scanIngredients.aiSummary.unlock') }}
    </ion-button>

    <p class="teaser-note">{{ t('scanIngredients.aiSummary.teaser.note') }}</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { IonButton, IonIcon } from '@ionic/vue'
import { lockClosedOutline, sparklesOutline } from 'ionicons/icons'
import { useI18n } from 'vue-i18n'
import { ActivityLogService } from '@/services/ActivityLogService'

/**
 * Shown to free users under a scan result that has flagged ingredients, in place of a bare
 * "unlock" button. The verdict itself stays free; this only offers the plain-language "why".
 * Static on purpose: it makes no AI call, so showing it costs nothing.
 */
const props = defineProps<{
  /** Name of the main flagged ingredient, e.g. "E471". */
  ingredient: string
}>()

const emit = defineEmits<{ (e: 'unlock'): void }>()

const { t } = useI18n()

onMounted(() => {
  ActivityLogService.log('ai_teaser_shown', { ingredient: props.ingredient })
})
</script>

<style scoped>
.ai-teaser {
  margin-top: 16px;
  padding: 14px 16px 12px;
  border-radius: 16px;
  background: rgba(250, 204, 21, 0.1);
  border: 1px solid rgba(250, 204, 21, 0.45);
  color: var(--ion-text-color, #000);
}
.teaser-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.teaser-icon {
  font-size: 20px;
  color: #ca8a04;
  flex-shrink: 0;
}
.teaser-title {
  flex: 1;
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  min-width: 0;
  overflow-wrap: anywhere;
}
.teaser-pill {
  font-size: 10px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 6px;
  background: #facc15;
  color: #000;
  flex-shrink: 0;
}
.teaser-body {
  margin: 8px 0 10px;
  font-size: 13px;
  line-height: 1.45;
  color: var(--ion-color-medium, #666);
}
.teaser-lines span {
  display: block;
  height: 8px;
  margin: 7px 0;
  border-radius: 4px;
  background: rgba(128, 128, 128, 0.25);
}
.teaser-button {
  margin: 12px 0 0;
  font-weight: 700;
}
.teaser-note {
  margin: 8px 0 0;
  text-align: center;
  font-size: 11px;
  color: var(--ion-color-medium, #666);
}
</style>
