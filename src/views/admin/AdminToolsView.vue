<template>
  <ion-page>
    <ion-header>
      <app-header :title="$t('adminPages.tools.title')" :icon="constructOutline" :showBack="true" />
    </ion-header>

    <ion-content class="ap-content ion-padding">
      <p class="ap-muted ap-small intro">{{ $t('adminPages.tools.intro') }}</p>

      <div v-for="group in groups" :key="group.key">
        <p class="ap-section">{{ $t(`adminPages.tools.group.${group.key}`) }}</p>
        <button
          v-for="tool in group.tools" :key="tool.path" type="button" class="ap-card tool"
          :data-testid="`tool-${tool.id}`" @click="router.push(tool.path)"
        >
          <span class="icon"><ion-icon :icon="tool.icon" /></span>
          <span class="text">
            <strong>{{ $t(`adminPages.tools.${tool.id}.name`) }}</strong>
            <span class="ap-small ap-muted">{{ $t(`adminPages.tools.${tool.id}.desc`) }}</span>
          </span>
          <ion-icon :icon="chevronForwardOutline" class="chev" />
        </button>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { IonPage, IonHeader, IonContent, IonIcon } from '@ionic/vue'
import {
  constructOutline, chevronForwardOutline, phonePortraitOutline, settingsOutline, pulseOutline, cardOutline,
  megaphoneOutline, barcodeOutline, bugOutline, starOutline, chatbubblesOutline, clipboardOutline,
} from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import '@/views/admin/adminPage.css'

const router = useRouter()

const groups = [
  {
    key: 'release',
    tools: [
      { id: 'versions', path: '/admin/app-versions', icon: phonePortraitOutline },
      { id: 'settings', path: '/admin/app-settings', icon: settingsOutline },
    ],
  },
  {
    key: 'health',
    tools: [
      { id: 'health', path: '/admin/system-health', icon: pulseOutline },
      { id: 'errors', path: '/admin/app-errors', icon: bugOutline },
    ],
  },
  {
    key: 'business',
    tools: [
      { id: 'subs', path: '/admin/subscriptions', icon: cardOutline },
      { id: 'announcements', path: '/admin/announcements', icon: megaphoneOutline },
      { id: 'survey', path: '/admin/survey', icon: clipboardOutline },
    ],
  },
  {
    key: 'content',
    tools: [
      { id: 'barcodes', path: '/admin/unknown-barcodes', icon: barcodeOutline },
      { id: 'reviews', path: '/admin/reviews', icon: starOutline },
      { id: 'line', path: '/admin/line-activity', icon: chatbubblesOutline },
    ],
  },
]
</script>

<style scoped>
.intro { margin: 0 2px 8px; }
.tool { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; border: none; font: inherit; color: inherit; cursor: pointer; }
.icon { flex: 0 0 38px; width: 38px; height: 38px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; background: rgba(var(--ion-color-carrot-rgb), 0.14); color: var(--ion-color-carrot); font-size: 1.2rem; }
.text { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.chev { color: var(--ion-color-medium); flex: 0 0 auto; }
</style>
