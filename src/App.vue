<template>
  <ion-app>
    <!-- 🛡️ Premium Stalling Maintenance Screen for Bots -->
    <div v-if="isBotDetected" class="bot-maintenance-overlay">
      <div class="bot-maintenance-content">
        <ion-spinner name="crescent" class="bot-spinner"></ion-spinner>
        <h2 class="bot-header">Checking security status...</h2>
        <p class="bot-subheader">Establishing a secure connection to the database. Please wait...</p>
      </div>
    </div>

    <div v-else class="app-main-wrapper">
      <SmartAppBanner />
      <div class="app-content-wrapper">
        <ion-router-outlet />
      </div>
    </div>

    <!-- 🎁 Global Subtle Reward Toast -->
    <div v-if="rewardOpen" class="reward-overlay">
      <div 
        class="reward-toast" 
        @click="closeReward"
        @touchstart="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
        :style="toastStyle"
      >
        <div class="reward-toast-left">
          <ion-avatar class="reward-toast-avatar" v-if="rewardAvatar">
            <img :src="rewardAvatar" alt="Avatar" />
          </ion-avatar>
          <div v-else class="reward-toast-icon">✨</div>
        </div>

        <div class="reward-toast-body">
          <div class="reward-toast-header">
            <span class="reward-points-badge">+{{ rewardPoints }} XP</span>
            <span class="reward-action-text">{{ rewardAction }}</span>
          </div>

          <!-- Animated EXP progress -->
          <div class="reward-toast-progress-container">
            <ion-progress-bar
                :value="rewardProgress"
                color="success"
                class="reward-progress-bar"
            ></ion-progress-bar>
          </div>
          <div class="reward-toast-level-info">
            <span>Level {{ rewardLevel }}</span>
            <span>{{ rewardDisplay }} / {{ rewardNextXp }} XP</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Only UI responsibilities left -->
    <ion-alert
        :is-open="showUpdateAlert"
        header="Update Available"
        message="A new version is available. Update now?"
        :buttons="alertButtons"
        @didDismiss="showUpdateAlert = false"
    />

    <ForceUpdateModal 
      :is-open="isUpdateRequired" 
      :store-url="storeUrl"
      :current-version="currentVersion"
      :min-version="minVersion"
    />
  </ion-app>

  <Analytics mode="production" />
  <SpeedInsights/>
</template>

<script setup lang="ts">
import { IonApp, IonRouterOutlet, IonAlert, IonButton, IonProgressBar, IonAvatar, IonSpinner, alertController } from '@ionic/vue';
import { onMounted, ref, computed } from 'vue';
import { performBotChecks, isBotDetected } from '@/utils/botShield';
import { initInteractionMonitor } from '@/utils/interactionShield';


import { Analytics } from "@vercel/analytics/vue";
import { SpeedInsights } from '@vercel/speed-insights/vue';
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import { AppUpdate, AppUpdateAvailability } from '@capawesome/capacitor-app-update';
import { InAppReview } from '@capacitor-community/in-app-review';
import { Browser } from '@capacitor/browser';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/zh-tw';
import 'dayjs/locale/id';
import 'dayjs/locale/ms';
import { useI18n } from 'vue-i18n';
import { watch } from 'vue';
import { useTheme } from '@/composables/useTheme';
import { useAppUpdate } from '@/composables/useAppUpdate';
import ForceUpdateModal from '@/components/ForceUpdateModal.vue';
import SmartAppBanner from '@/components/SmartAppBanner.vue';

dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(timezone);

import {
  rewardOpen,
  rewardPoints,
  rewardAction,
  closeReward,
  rewardAvatar,
  rewardDisplay,
  rewardLevel,
  rewardNextXp,
  rewardProgress
} from "@/composables/useRewardOverlay";

// 📱 Swipe to dismiss logic for mobile notifications
const touchStartY = ref(0);
const touchStartX = ref(0);
const swipeOffsetY = ref(0);
const swipeOffsetX = ref(0);
const isSwiping = ref(false);

const onTouchStart = (e: TouchEvent) => {
  touchStartY.value = e.touches[0].clientY;
  touchStartX.value = e.touches[0].clientX;
  isSwiping.value = true;
};

const onTouchMove = (e: TouchEvent) => {
  if (!isSwiping.value) return;
  const currentY = e.touches[0].clientY;
  const currentX = e.touches[0].clientX;
  
  const diffY = currentY - touchStartY.value;
  const diffX = currentX - touchStartX.value;
  
  // Swiping up (negative Y) has no resistance; swiping down has resistance
  swipeOffsetY.value = diffY < 0 ? diffY : diffY * 0.2;
  swipeOffsetX.value = diffX;
};

const onTouchEnd = () => {
  if (!isSwiping.value) return;
  isSwiping.value = false;
  
  // Dismiss if swiped up > 30px or swiped horizontally > 60px
  if (swipeOffsetY.value < -30 || Math.abs(swipeOffsetX.value) > 60) {
    closeReward();
  }
  
  // Reset offsets
  swipeOffsetY.value = 0;
  swipeOffsetX.value = 0;
};

const toastStyle = computed(() => {
  if (!isSwiping.value && swipeOffsetY.value === 0 && swipeOffsetX.value === 0) {
    return {};
  }
  const opacity = Math.max(0.1, 1 - Math.max(Math.abs(swipeOffsetX.value) / 180, -swipeOffsetY.value / 80));
  return {
    transform: `translate(${swipeOffsetX.value}px, ${swipeOffsetY.value}px)`,
    opacity: opacity,
    transition: isSwiping.value ? 'none' : 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s ease',
  };
});
import { updateLastSeen, currentUser, hasReviewedApp, setHasReviewedApp } from '@/composables/userProfile';
import { supabase } from '@/plugins/supabaseClient';
const { initTheme } = useTheme();
const { t } = useI18n();
const { isUpdateRequired, storeUrl, currentVersion, minVersion } = useAppUpdate();

const askedKey = 'askedLocationPermission';
const showUpdateAlert = ref(false);

const alertButtons = [
  { text: 'Later', role: 'cancel' },
  {
    text: 'Update Now',
    handler: async () => {
      const info = await AppUpdate.getAppUpdateInfo();
      if (info.flexibleUpdateAllowed) {
        await AppUpdate.startFlexibleUpdate();
        await AppUpdate.completeFlexibleUpdate();
      } else if (info.immediateUpdateAllowed) {
        await AppUpdate.performImmediateUpdate();
      }
    },
  },
];

// ✅ Request geolocation permission once
const askGeolocationPermission = async () => {
  if (!Capacitor.isNativePlatform()) return;

  const alreadyAsked = localStorage.getItem(askedKey);
  if (alreadyAsked) return;

  try {
    const permStatus = await Geolocation.checkPermissions();
    if (permStatus.location !== 'granted') {
      const result = await Geolocation.requestPermissions();
      console.log('🔑 Geolocation permission result:', result);
    }
    localStorage.setItem(askedKey, 'true');
  } catch (err) {
    console.error('❌ Error requesting location permission:', err);
  }
};

const APP_OPEN_KEY = 'app_open_count';
const NEVER_SHOW_REVIEW_KEY = 'app_review_never_show';

const checkAppUpdate = async () => {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
  try {
    const info = await AppUpdate.getAppUpdateInfo();
    if (info.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE) {
      showUpdateAlert.value = true;
    }
  } catch (err) {
    console.error('❌ Error checking app update:', err);
  }
};

const openAppStore = async () => {
  const platform = Capacitor.getPlatform();
  let url = 'https://play.google.com/store/apps/details?id=com.rcreative.halalformosa'; // fallback default
  
  if (platform === 'ios') {
    url = 'https://apps.apple.com/app/id123456789';
  }
  
  try {
    const { data } = await supabase
      .from('app_config')
      .select('key, value')
      .in('key', ['android_store_url', 'ios_store_url']);
      
    if (data && data.length > 0) {
      const key = platform === 'ios' ? 'ios_store_url' : 'android_store_url';
      const dbUrl = data.find(item => item.key === key)?.value;
      if (dbUrl) url = dbUrl;
    }
  } catch (err) {
    console.warn('[Review] Dynamic URL fetch failed, using fallback', err);
  }

  try {
    await Browser.open({ url });
  } catch (err) {
    window.open(url, '_blank');
  }
};

const checkAndAskForReview = async () => {
  // 📱 Target native platforms (Android now, soon iOS)
  if (!Capacitor.isNativePlatform()) return;
  const platform = Capacitor.getPlatform();
  if (platform !== 'android' && platform !== 'ios') return;

  // 📝 Skip if already reviewed (synced from Supabase) OR "Never" pressed locally
  if (hasReviewedApp.value || localStorage.getItem(NEVER_SHOW_REVIEW_KEY) === 'true') {
    return;
  }

  let count = parseInt(localStorage.getItem(APP_OPEN_KEY) || '0', 10);
  count++;
  localStorage.setItem(APP_OPEN_KEY, count.toString());

  // 🔄 Trigger every 5 opens
  if (count % 5 === 0) {
    const alert = await alertController.create({
      header: t('appReview.title'),
      message: t('appReview.message'),
      cssClass: 'app-review-alert',
      buttons: [
        {
          text: t('appReview.never'),
          role: 'destructive',
          handler: async () => {
            const confirmAlert = await alertController.create({
              header: t('appReview.confirmNeverTitle'),
              message: t('appReview.confirmNeverMessage'),
              buttons: [
                {
                  text: t('appReview.confirmNeverCancel'),
                  role: 'cancel'
                },
                {
                  text: t('appReview.confirmNeverConfirm'),
                  handler: () => {
                    localStorage.setItem(NEVER_SHOW_REVIEW_KEY, 'true');
                    setHasReviewedApp(true);
                  }
                }
              ]
            });
            await confirmAlert.present();
          }
        },
        {
          text: t('appReview.later'),
          role: 'cancel',
          handler: () => {
            // Reset counter to wait for another 5 opens
            localStorage.setItem(APP_OPEN_KEY, '0');
          }
        },
        {
          text: t('appReview.rateNow'),
          cssClass: 'alert-button-confirm',
          handler: async () => {
            // 1. Mark as reviewed locally & in DB immediately to stop asking
            localStorage.setItem(NEVER_SHOW_REVIEW_KEY, 'true');
            setHasReviewedApp(true);

            // 2. Redirect to native app store page
            await openAppStore();
          }
        }
      ]
    });

    await alert.present();
  }
};

const { locale } = useI18n();

// ✅ Sync dayjs locale with i18n locale
watch(locale, (newLocale) => {
  const dayjsLocale = newLocale === 'zh' ? 'zh-tw' : newLocale;
  dayjs.locale(dayjsLocale);
}, { immediate: true });

import { App as CapApp } from '@capacitor/app';
import { useRouter } from 'vue-router';

const router = useRouter();

onMounted(async () => {
  // 🛡️ Initialize Organic Interaction Monitor
  initInteractionMonitor();

  // 🛡️ Perform Bot Defense checks on mount
  performBotChecks();

  initTheme();
  await askGeolocationPermission();
  await checkAppUpdate();
  await checkAndAskForReview();

  // ✅ Track Activity
  if (currentUser.value?.id) await updateLastSeen();
  
  // Update last seen when app becomes active again
  CapApp.addListener('appStateChange', ({ isActive }) => {
    if (isActive && currentUser.value?.id) {
      updateLastSeen();
    }
  });

  // Periodically update if the user is active (every 5 mins)
  setInterval(() => {
    if (currentUser.value?.id) updateLastSeen();
  }, 1000 * 60 * 5);

  // 🔐 Listen for Auth events (Recovery, Invite, etc)
  supabase.auth.onAuthStateChange((event: string) => {
    if (event === 'PASSWORD_RECOVERY') {
      console.log('🔄 Password recovery event detected. Redirecting...');
      router.push('/update-password');
    }
  });
});
</script>

<style>
.app-main-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  position: relative;
}

.app-content-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
}

/* Ensure Ionic components inside the wrapper behave correctly */
ion-router-outlet {
  position: absolute !important;
  inset: 0 !important;
}

/* ⭐ App Review Alert Styles */
.alert-button-confirm {
  font-weight: 700 !important;
  color: var(--ion-color-carrot) !important;
}

.app-review-alert .alert-head {
  padding-bottom: 8px;
}

.app-review-alert .alert-title {
  font-size: 1.3rem;
  font-weight: 800;
  color: var(--ion-color-carrot);
}

.app-review-alert .alert-message {
  font-size: 1rem;
  line-height: 1.5;
  color: #444444; /* Dark gray for light theme */
  opacity: 1;
}

/* 🌓 Dark Mode Refinements */
.ion-palette-dark .alert-button-confirm {
  color: var(--ion-color-carrot-tint) !important;
}

.ion-palette-dark .app-review-alert .alert-title {
  color: var(--ion-color-carrot-tint);
}

.ion-palette-dark .app-review-alert .alert-message {
  color: #dddddd; /* Light gray for dark theme */
}

/* Offset for Toasts over fixed footers */
ion-toast.cart-toast-offset {
  transform: translateY(-64px) !important;
}

/* 🛡️ Premium Anti-Bot Stalling Screen */
.bot-maintenance-overlay {
  position: fixed;
  inset: 0;
  background: var(--ion-background-color, #fafafa);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99999;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  padding: 24px;
}

.bot-maintenance-content {
  text-align: center;
  max-width: 380px;
  background: var(--ion-card-background, #ffffff);
  padding: 40px 32px;
  border-radius: 24px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(var(--ion-color-dark-rgb), 0.08);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.bot-spinner {
  width: 56px;
  height: 56px;
  --color: var(--ion-color-carrot, #f97316);
  margin-bottom: 24px;
}

.bot-header {
  font-size: 1.4rem;
  font-weight: 800;
  margin: 0 0 12px;
  color: var(--ion-color-dark, #1e293b);
  letter-spacing: -0.02em;
}

.bot-subheader {
  font-size: 0.95rem;
  color: var(--ion-color-medium, #64748b);
  line-height: 1.6;
  margin: 0;
}

/* Dark mode adjustment */
.ion-palette-dark .bot-maintenance-overlay {
  background: #0f172a;
}
.ion-palette-dark .bot-maintenance-content {
  background: #1e293b;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  border-color: rgba(255, 255, 255, 0.08);
}
.ion-palette-dark .bot-header {
  color: #f1f5f9;
}
.ion-palette-dark .bot-subheader {
  color: #94a3b8;
}
</style>
