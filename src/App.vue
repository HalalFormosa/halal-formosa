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

    <ion-modal 
      :is-open="!!currentPrompt" 
      @didDismiss="dismissPrompt" 
      class="two-step-gate-modal"
      :initial-breakpoint="0.6"
      :breakpoints="[0, 0.6, 0.95]"
      :handle="true"
    >
      <ion-content class="ion-no-padding">
        <!-- Place Image Banner -->
        <div class="place-banner">
          <img v-if="currentPrompt?.image" :src="currentPrompt.image" class="place-img" />
          <div v-else class="place-placeholder-banner">
            <span class="placeholder-icon">🕌</span>
          </div>
          <div class="category-badge-wrapper">
            <span class="category-badge">{{ currentPrompt?.category_name || 'Location' }}</span>
          </div>
        </div>

        <div class="ion-padding content-wrapper ion-text-center">
          <h2 class="place-title">{{ currentPrompt?.name }}</h2>
          <p v-if="currentPrompt?.address" class="place-address">
            <ion-icon :icon="navigateOutline" class="address-icon" /> {{ currentPrompt.address }}
          </p>

          <div class="gate-divider"></div>

          <template v-if="inAppGateStep === 1">
            <h3 class="gate-heading">{{ $t('facilityReview.gate.didYouVisitPrompt') || 'Did you visit here?' }}</h3>
            <p class="gate-desc">{{ $t('facilityReview.gate.didYouVisitDesc') }}</p>
            <div class="gate-buttons">
              <ion-button expand="block" color="carrot" class="action-btn" @click="inAppGateStep = 2">
                {{ $t('facilityReview.gate.yes') }}
              </ion-button>
              <ion-button expand="block" fill="clear" color="medium" class="cancel-btn" @click="dismissPrompt">
                {{ $t('facilityReview.gate.no') }}
              </ion-button>
            </div>
          </template>

          <template v-else-if="inAppGateStep === 2">
            <h3 class="gate-heading">{{ $t('facilityReview.gate.leaveReview') }}</h3>
            <p class="gate-desc">{{ $t('facilityReview.gate.leaveReviewDesc') }}</p>
            <div class="gate-buttons">
              <ion-button expand="block" color="carrot" class="action-btn" @click="openReviewFromInAppGate">
                {{ $t('facilityReview.gate.writeReview') }}
              </ion-button>
              <ion-button expand="block" fill="clear" color="medium" class="cancel-btn" @click="dismissPrompt">
                {{ $t('facilityReview.gate.maybeLater') }}
              </ion-button>
            </div>
          </template>
        </div>
      </ion-content>
    </ion-modal>

    <!-- Facility Review Modal for In-App Prompts -->
    <FacilityReviewModal
      v-if="currentPrompt"
      :is-open="facilityReviewModalOpen"
      :location-id="currentPrompt.id"
      :location-name="currentPrompt.name"
      @close="closeInAppReviewModal"
      @success="dismissPrompt"
    />
  </ion-app>

  <Analytics mode="production" />
  <SpeedInsights/>
</template>

<script setup lang="ts">
import { IonApp, IonRouterOutlet, IonAlert, IonButton, IonProgressBar, IonAvatar, IonSpinner, IonModal, IonContent, IonIcon, alertController } from '@ionic/vue';
import { navigateOutline } from 'ionicons/icons';
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
import { useProximityPrompt } from '@/composables/useProximityPrompt';
import FacilityReviewModal from '@/components/FacilityReviewModal.vue';

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
import { updateLastSeen, currentUser, hasReviewedApp, setHasReviewedApp, profileLoaded, isProfileComplete, profileSkipped, backgroundTrackingEnabled } from '@/composables/userProfile';
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

// 🚨 Redirect users with incomplete profiles to the onboarding wizard once the profile loads
watch(
  [profileLoaded, isProfileComplete, profileSkipped, currentUser],
  ([loaded, complete, skipped, user]) => {
    if (loaded && user && !complete && !skipped) {
      const currentPath = router.currentRoute.value.path;
      const allowedWithoutCompletion = ['/profile/edit', '/logout'];
      if (!allowedWithoutCompletion.includes(currentPath)) {
        router.replace({
          path: '/profile/edit',
          query: { redirect: router.currentRoute.value.fullPath }
        });
      }
    }
  },
  { immediate: true }
);

onMounted(async () => {
  // 🛡️ Initialize Organic Interaction Monitor
  initInteractionMonitor();

  // 🛡️ Perform Bot Defense checks on mount
  performBotChecks();

  initTheme();
  await askGeolocationPermission();
  await checkAppUpdate();
  await checkAndAskForReview();
  
  // Start proximity tracking for facility reviews
  startProximityTracking();

  // ✅ Track Activity
  if (currentUser.value?.id) await updateLastSeen();
  
  // Update last seen when app becomes active again
  CapApp.addListener('appStateChange', ({ isActive }) => {
    if (isActive) {
      if (currentUser.value?.id) {
        updateLastSeen();
      }
      startProximityTracking();
    } else {
      if (!backgroundTrackingEnabled.value) {
        console.log('[Proximity] Pausing proximity tracking in background to save battery.');
        stopProximityTracking();
      }
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

const { startProximityTracking, stopProximityTracking, currentPrompt, dismissPrompt } = useProximityPrompt()
const inAppGateStep = ref(1)
const facilityReviewModalOpen = ref(false)

const openReviewFromInAppGate = () => {
  facilityReviewModalOpen.value = true
}

const closeInAppReviewModal = () => {
  facilityReviewModalOpen.value = false
  dismissPrompt()
}

watch(() => currentPrompt.value, (newVal) => {
  if (newVal) {
    inAppGateStep.value = 1
  }
})
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

.two-step-gate-modal {
  --border-radius: 16px 16px 0 0;
  --overflow: hidden;
}

.place-banner {
  width: 100%;
  height: 180px;
  position: relative;
  overflow: hidden;
}

.place-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.place-placeholder-banner {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, var(--ion-color-carrot, #ff9800), var(--ion-color-primary, #3880ff));
  display: flex;
  justify-content: center;
  align-items: center;
}

.placeholder-icon {
  font-size: 3rem;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
}

.category-badge-wrapper {
  position: absolute;
  bottom: 12px;
  left: 12px;
}

.category-badge {
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.content-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.place-title {
  font-size: 1.35rem;
  font-weight: 800;
  margin-top: 8px;
  margin-bottom: 6px;
  color: var(--ion-text-color);
}

.place-address {
  font-size: 0.85rem;
  color: var(--ion-color-medium);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: 90%;
  text-align: center;
}

.address-icon {
  font-size: 0.95rem;
  color: var(--ion-color-carrot);
  flex-shrink: 0;
}

.gate-divider {
  width: 40px;
  height: 3px;
  background: rgba(var(--ion-text-color-rgb), 0.1);
  border-radius: 2px;
  margin: 16px 0;
}

.gate-heading {
  font-size: 1.15rem;
  font-weight: 700;
  margin: 0 0 8px 0;
  color: var(--ion-color-carrot);
}

.gate-desc {
  font-size: 0.88rem;
  line-height: 1.45;
  color: var(--ion-color-medium);
  margin: 0 0 20px 0;
}

.gate-buttons {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-btn {
  margin: 0;
  --border-radius: 12px;
  --box-shadow: none;
  font-weight: 700;
  height: 46px;
}

.cancel-btn {
  margin: 0;
  --border-radius: 12px;
  font-weight: 700;
  font-size: 0.88rem;
}
</style>
