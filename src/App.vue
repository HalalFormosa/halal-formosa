<template>
  <ion-app>
    <SmartAppBanner />
    <ion-router-outlet />

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
import { IonApp, IonRouterOutlet, IonAlert, IonButton, IonProgressBar, IonAvatar } from '@ionic/vue';
import { onMounted, ref } from 'vue';
import { Analytics } from "@vercel/analytics/vue";
import { SpeedInsights } from '@vercel/speed-insights/vue';
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import { AppUpdate, AppUpdateAvailability } from '@capawesome/capacitor-app-update';
import { AppReview } from '@capawesome/capacitor-app-review';
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
const { initTheme } = useTheme();
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
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
  let count = parseInt(localStorage.getItem(APP_OPEN_KEY) || '0', 10);
  count++;
  localStorage.setItem(APP_OPEN_KEY, count.toString());

  if (count === 5 || count === 15 || count === 30) {
    try {
      await AppReview.requestReview();
      console.log('⭐ In-app review requested');
    } catch (err) {
      console.error('❌ Error requesting in-app review:', err);

      await AppReview.openAppStore();
    }
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
});
</script>
