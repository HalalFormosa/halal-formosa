<template>
  <ion-app>
    <div class="app-main-wrapper">
      <SmartAppBanner />
      <div class="app-content-wrapper">
        <ion-router-outlet />
      </div>
    </div>

    <!-- 🎁 Global Reward Popup -->
    <div v-if="rewardOpen" class="reward-overlay">
      <div class="reward-float ion-text-center">
        <h2>🎉 {{ $t('main.congratulation') }}</h2>

        <!-- Avatar -->
        <ion-avatar style="margin: 0 auto; width: 80px; height: 80px;" v-if="rewardAvatar">
          <img :src="rewardAvatar" alt="Profile Picture" />
        </ion-avatar>

        <!-- Reward points -->
        <p style="margin-top: 1rem;">
          {{ $t('main.increasePoint') }} <strong>+{{ rewardPoints }}</strong> {{ $t('main.point') }}
          {{ $t('main.for') }} <em>{{ rewardAction }}</em>!
        </p>

        <!-- Animated EXP progress -->
        <ion-progress-bar
            :value="rewardProgress"
            color="success"
            style="margin-top: 10px; border-radius: 8px;"
        ></ion-progress-bar>
        <small>
          Level {{ rewardLevel }} — {{ rewardDisplay }} / {{ rewardNextXp }} XP
        </small>

        <ion-button expand="block" color="success" @click="closeReward" style="margin-top: 1rem;">
          OK
        </ion-button>
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
import { IonApp, IonRouterOutlet, IonAlert, IonButton, IonProgressBar, IonAvatar, alertController } from '@ionic/vue';
import { onMounted, ref } from 'vue';
import { Analytics } from "@vercel/analytics/vue";
import { SpeedInsights } from '@vercel/speed-insights/vue';
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import { AppUpdate, AppUpdateAvailability } from '@capawesome/capacitor-app-update';
import { InAppReview } from '@capacitor-community/in-app-review';
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

const checkAndAskForReview = async () => {
  // 📱 Target native platforms (Android now, soon iOS)
  if (!Capacitor.isNativePlatform()) return;
  const platform = Capacitor.getPlatform();
  if (platform !== 'android' && platform !== 'ios') return;

  // 📝 Skip if already reviewed (synced from Supabase)
  if (hasReviewedApp.value) return;

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
            // 1. Mark as reviewed in DB immediately to stop asking
            setHasReviewedApp(true);

            // 2. Trigger Official Native In-App Review Sheet
            try {
              console.log('⭐ Triggering Native Review Sheet...');
              await InAppReview.requestReview();
            } catch (err) {
              console.error('❌ Native sheet failed:', err);
            }
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
</style>
