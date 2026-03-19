<template>
  <transition name="slide-down">
    <div v-if="isVisible" class="smart-banner" :class="{ 'is-dark': isDark }">
      <div class="banner-content">
        <div class="close-btn" @click="dismiss">
          <ion-icon :icon="closeOutline" />
        </div>
        
        <div class="app-info">
          <div class="app-icon">
            <img src="/apple-touch-icon.png" alt="Halal Formosa" />
          </div>
          <div class="app-text">
            <h4>Halal Formosa</h4>
            <p>{{ $t('main.betterInApp') || 'Better experience in our app!' }}</p>
            <div class="rating">
              <ion-icon v-for="i in 5" :key="i" :icon="star" class="star" />
              <span>(4.9)</span>
            </div>
          </div>
        </div>

        <a :href="storeUrl" class="get-btn" @click="logClick">
          {{ $t('main.getApp') || 'GET' }}
        </a>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { IonIcon } from '@ionic/vue';
import { closeOutline, star } from 'ionicons/icons';
import { Capacitor } from '@capacitor/core';
import { ActivityLogService } from '@/services/ActivityLogService';

const isVisible = ref(false);
const DISMISS_KEY = 'smart_banner_dismissed';

const isDark = computed(() => document.documentElement.classList.contains('ion-palette-dark'));

const storeUrl = computed(() => {
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
    return 'https://apps.apple.com/app/halal-formosa/idYOUR_APP_ID';
  }
  return 'https://play.google.com/store/apps/details?id=com.rcreative.halalformosa';
});

const dismiss = () => {
  isVisible.value = false;
  localStorage.setItem(DISMISS_KEY, Date.now().toString());
};

const logClick = () => {
  ActivityLogService.log('smart_banner_click', { platform: Capacitor.getPlatform() });
};

onMounted(() => {
  // Only show on Web mobile browsers
  const isNative = Capacitor.isNativePlatform();
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const alreadyDismissed = localStorage.getItem(DISMISS_KEY);
  
  // Show if it's mobile web and not dismissed in the last 7 days
  if (!isNative && isMobile) {
    if (!alreadyDismissed || (Date.now() - parseInt(alreadyDismissed)) > 7 * 24 * 60 * 60 * 1000) {
      setTimeout(() => {
        isVisible.value = true;
      }, 2000); // 2 second delay for better impact
    }
  }
});
</script>

<style scoped>
.smart-banner {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  padding: 8px 16px;
  height: 72px;
  display: flex;
  align-items: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.smart-banner.is-dark {
  background: rgba(28, 28, 30, 0.85);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.banner-content {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 12px;
}

.close-btn {
  color: #8e8e93;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.app-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.app-icon img {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.app-text h4 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--ion-color-dark);
}

.app-text p {
  margin: 0;
  font-size: 11px;
  color: #8e8e93;
}

.rating {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: 2px;
}

.star {
  color: #ffcc00;
  font-size: 10px;
}

.rating span {
  font-size: 10px;
  color: #8e8e93;
  margin-left: 4px;
}

.get-btn {
  background: var(--ion-color-success);
  color: white;
  text-decoration: none;
  font-size: 13px;
  font-weight: 700;
  padding: 6px 16px;
  border-radius: 20px;
  transition: transform 0.2s;
}

.get-btn:active {
  transform: scale(0.95);
}

/* Animations */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s;
}

.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
