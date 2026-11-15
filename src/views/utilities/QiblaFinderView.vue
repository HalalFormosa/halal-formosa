<template>
  <ion-page>
    <ion-header>
      <app-header :title="$t('qibla.title')" icon="none" :showBack="true" />
    </ion-header>

    <ion-content class="ion-padding qibla-page">

      <!-- Compass -->
      <div class="compass-container">

        <CompassDial
            :rotation="hasCompass ? compassRotation : 0"
            :qibla="qiblaBearing"
            :aligned="aligned && hasCompass"
        />

        <div class="info">
          <h2>{{ $t('qibla.direction') }}</h2>

          <div v-if="loading" class="loading-row">
            <ion-spinner name="crescent" />
            <span>{{ $t('qibla.preparing') }}</span>
          </div>

          <template v-else>
            <!-- If compass has successfully initialized -->
            <div v-if="hasCompass">
              <p class="bearing">
                {{ qiblaBearing.toFixed(0) }}° • {{ bearingLabel }} {{ $t('qibla.fromNorth') }}
              </p>
            </div>

            <!-- If iOS permission is required but not yet granted -->
            <div v-else-if="permissionPromptRequired" class="permission-prompt">
              <p class="prompt-text">{{ $t('qibla.needsPermission') || 'Compass access is required to show direction.' }}</p>
              <ion-button expand="block" color="carrot" class="ion-margin-top" @click="enableCompass">
                {{ $t('qibla.enableButton') || 'Enable Compass' }}
              </ion-button>
            </div>

            <!-- If device lacks compass hardware or sensor is unsupported -->
            <div v-else-if="!sensorSupported && qiblaBearing" class="static-bearing-info">
              <p class="bearing">
                {{ qiblaBearing.toFixed(0) }}° • {{ bearingLabel }} {{ $t('qibla.fromNorth') }}
              </p>
              <p class="sub-text">
                {{ $t('qibla.noSensor') || 'Compass hardware is not active on this device. Use the degree heading above.' }}
              </p>
            </div>

            <!-- Generic placeholder/error state if location or compass failed -->
            <div v-else class="loading-row">
              <span>{{ $t('qibla.error') || 'Unable to initialize compass.' }}</span>
            </div>
          </template>

          <p v-if="aligned && hasCompass" class="aligned-text">
            {{ $t('qibla.facing') }}
          </p>
        </div>
      </div>

    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  IonHeader,
  IonPage,
  IonContent,
  IonSpinner,
  IonButton,
  onIonViewWillEnter
} from '@ionic/vue'

import AppHeader from '@/components/AppHeader.vue'
import CompassDial from '@/components/CompassDial.vue'
import { useQiblaCompass, calculateQiblaBearing } from '@/composables/useQiblaCompass'
import { useLocation } from '@/composables/useLocation'
import { ActivityLogService } from '@/services/ActivityLogService'

/* ---------------- Qibla Logic ---------------- */
const {
  loading,
  hasCompass,
  sensorSupported,
  qiblaBearing,
  compassRotation,
  aligned,
  start
} = useQiblaCompass()

const { userLocation, startWatching } = useLocation()
const userCoords = ref<{ lat: number; lng: number } | null>(null)

const permissionPromptRequired = computed(() => {
  return typeof (window as any).DeviceOrientationEvent?.requestPermission === 'function' && !hasCompass.value
})

const bearingLabel = computed(() => {
  const deg = qiblaBearing.value
  if (deg == null) return ''

  // Normalize
  const d = Math.round(deg)

  if (d === 0) return '0° N'
  if (d < 90) return `${d}° NE`
  if (d === 90) return '90° E'
  if (d < 180) return `${180 - d}° SE`
  if (d === 180) return '180° S'
  if (d < 270) return `${d - 180}° SW`
  if (d === 270) return '270° W'
  return `${360 - d}° NW`
})

async function enableCompass() {
  if (userCoords.value) {
    loading.value = true
    await start(userCoords.value.lat, userCoords.value.lng)
  }
}

function initCompassWithCoords(lat: number, lng: number) {
  userCoords.value = { lat, lng }
  qiblaBearing.value = calculateQiblaBearing(lat, lng)

  if (typeof (window as any).DeviceOrientationEvent?.requestPermission !== 'function') {
    start(lat, lng)
  } else {
    loading.value = false
  }
}

/* ---------------- Lifecycle ---------------- */
onIonViewWillEnter(() => {
  ActivityLogService.log('utility_qibla_open')
  loading.value = true

  // 1. Instant cached location fallback
  if (userLocation.value?.lat && userLocation.value?.lng) {
    initCompassWithCoords(userLocation.value.lat, userLocation.value.lng)
  }

  // 2. Fetch/update current GPS position
  startWatching()

  navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        initCompassWithCoords(lat, lng)
      },
      (err) => {
        console.warn("[GPS] Qibla location fallback error:", err)
        if (!userCoords.value) {
          loading.value = false
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 60000
      }
  )
})
</script>

<style scoped>
.qibla-page {
  display: flex;
  justify-content: center;
}

.compass-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 40px;
}

.info {
  margin-top: 12px;
  text-align: center;
}

.aligned-text {
  margin-top: 10px;
  color: var(--ion-color-carrot);
  font-weight: 600;
  letter-spacing: 0.4px;
}

.loading-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--ion-color-medium);
  font-size: 14px;
  margin-top: 8px;
}

.permission-prompt {
  margin-top: 12px;
}

.prompt-text, .sub-text {
  font-size: 13px;
  color: var(--ion-color-medium);
  max-width: 260px;
  margin: 8px auto 0 auto;
}

.static-bearing-info {
  margin-top: 8px;
}
</style>
