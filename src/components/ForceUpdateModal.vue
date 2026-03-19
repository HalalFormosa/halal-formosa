<template>
  <ion-modal 
    :is-open="isOpen" 
    :backdrop-dismiss="false" 
    :can-dismiss="false"
    class="force-update-modal"
  >
    <div class="modal-content ion-padding ion-text-center">
      <div class="illustration-container">
        <!-- A simple but elegant SVG illustration for update -->
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="update-icon">
          <path d="M12 2V6M12 18V22M6 12H2M22 12H18M19.07 4.93L16.24 7.76M7.76 16.24L4.93 19.07M19.07 19.07L16.24 16.24M7.76 7.76L4.93 4.93" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M12 8C14.2091 8 16 9.79086 16 12C16 14.2091 14.2091 16 12 16C9.79086 16 8 14.2091 8 12C8 9.79086 9.79086 8 12 8Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>

      <h1 class="title">{{ $t('update.required_title') || 'Update Required' }}</h1>
      <p class="description">
        {{ $t('update.required_message') || 'A new version of Halal Formosa is available. Please update to continue using the app and enjoy the latest features and security improvements.' }}
      </p>

      <div class="version-info" v-if="currentVersion && minVersion">
        <ion-badge color="light">{{ currentVersion }}</ion-badge>
        <ion-icon :icon="arrowForward" style="margin: 0 8px; vertical-align: middle;"></ion-icon>
        <ion-badge color="primary">{{ minVersion }}</ion-badge>
      </div>

      <ion-button expand="block" color="primary" class="update-button" @click="handleUpdate">
        {{ $t('update.button') || 'Update Now' }}
      </ion-button>
    </div>
  </ion-modal>
</template>

<script setup lang="ts">
import { IonModal, IonButton, IonBadge, IonIcon } from '@ionic/vue';
import { arrowForward } from 'ionicons/icons';
import { Browser } from '@capacitor/browser';
import { AppLauncher } from '@capacitor/app-launcher';
import { Capacitor } from '@capacitor/core';

const props = defineProps<{
  isOpen: boolean;
  storeUrl: string;
  currentVersion?: string;
  minVersion?: string;
}>();

const handleUpdate = async () => {
  if (!props.storeUrl) {
    console.error('No store URL provided for update');
    return;
  }

  const platform = Capacitor.getPlatform();

  try {
    if (platform === 'android') {
      // Android: market://details?id=YOUR_PACKAGE_NAME
      // We extract the ID from the store URL if possible, or use the standard one
      const appId = 'com.rcreative.halalformosa';
      await AppLauncher.openUrl({ url: `market://details?id=${appId}` });
    } else if (platform === 'ios') {
      // iOS: itms-apps://itunes.apple.com/app/idYOUR_APP_ID
      // Assuming storeUrl is already the itms-apps link or we can convert it
      const iosUrl = props.storeUrl.replace('https://apps.apple.com', 'itms-apps://itunes.apple.com');
      await AppLauncher.openUrl({ url: iosUrl });
    } else {
      // Web or other: fall back to browser
      await Browser.open({ url: props.storeUrl });
    }
  } catch (err) {
    console.warn('[ForceUpdate] Native redirect failed, falling back to Browser:', err);
    await Browser.open({ url: props.storeUrl });
  }
};
</script>

<style scoped>
.force-update-modal {
  --height: auto;
  --max-height: 80%;
  --border-radius: 24px;
  --background: var(--ion-background-color, #ffffff);
}

.modal-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
}

.illustration-container {
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  padding: 24px;
  border-radius: 50%;
  margin-bottom: 24px;
}

.update-icon {
  width: 64px;
  height: 64px;
  color: var(--ion-color-primary);
  animation: rotate 10s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 16px;
  color: var(--ion-color-step-900);
}

.description {
  font-size: 16px;
  line-height: 1.5;
  color: var(--ion-color-step-600);
  margin-bottom: 24px;
}

.version-info {
  display: flex;
  align-items: center;
  margin-bottom: 32px;
}

.update-button {
  width: 100%;
  --border-radius: 12px;
  --padding-top: 16px;
  --padding-bottom: 16px;
  font-weight: 600;
  margin-top: auto;
}
</style>
