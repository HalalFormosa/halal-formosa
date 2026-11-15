<template>
  <ion-toolbar class="premium-header modal-header">
    <ion-buttons slot="start">
      <ion-button class="header-action-button" @click="$emit('close')">
        <ion-icon :icon="closeOutline" />
      </ion-button>
    </ion-buttons>

    <ion-title class="header-title">
      <div class="title-content">
        <template v-if="icon">
          <ion-icon :icon="icon" class="header-title-icon" />
        </template>
        <span class="title-text">{{ title }}</span>
      </div>
    </ion-title>

    <ion-buttons slot="end" v-if="$slots.end">
      <slot name="end"></slot>
    </ion-buttons>
  </ion-toolbar>
</template>

<script setup lang="ts">
import { IonToolbar, IonButton, IonTitle, IonButtons, IonIcon } from '@ionic/vue'
import { closeOutline } from 'ionicons/icons'

defineProps<{
  title: string
  icon?: string
}>()

defineEmits<{ close: [] }>()
</script>

<style scoped>
.header-title {
  padding: 0;
}

.title-content {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  height: 100%;
  gap: 10px;
}

.header-title-icon {
  font-size: 22px;
  color: var(--ion-color-carrot);
  display: flex;
  align-items: center;
}

/* Matches AppHeader's circular chip buttons (back/action icons) so a modal's
   Close button reads as the same control language as the page header. */
:deep(.header-action-button) {
  --border-radius: 50% !important;
  --background: var(--card-inner-bg) !important;
  --background-hover: var(--card-inner-bg) !important;
  --background-activated: var(--card-inner-bg) !important;
  --background-focused: var(--card-inner-bg) !important;
  --box-shadow: none !important;
  --color: var(--ion-text-color, inherit) !important;
  --icon-color: var(--ion-text-color, inherit) !important;
  width: 36px !important;
  min-width: 36px !important;
  max-width: 36px !important;
  height: 36px !important;
  min-height: 36px !important;
  max-height: 36px !important;
  margin: 4px 2px !important;
  border: 1px solid var(--card-border);
  border-radius: 50%;
  font-size: 20px;
}
</style>
