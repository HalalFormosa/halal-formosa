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
            :qibla="hasCompass ? qiblaBearing : null"
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
            <p v-if="hasCompass" class="bearing">
              {{ qiblaBearing.toFixed(0) }}° • {{ bearingLabel }} {{ $t('qibla.fromNorth') }}
            </p>

            <!-- If iOS permission is required but not yet granted -->
            <div v-else-if="permissionPromptRequired" class="permission-prompt">
              <p class="prompt-text">{{ $t('qibla.needsPermission') || 'Compass access is required to show direction.' }}</p>
              <ion-button expand="block" color="carrot" class="ion-margin-top" @click="enableCompass">
                {{ $t('qibla.enableButton') || 'Enable Compass' }}
              </ion-button>
            </div>

            <!-- Generic placeholder/error state if neither loading nor has compass (e.g. GPS or permission failed) -->
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
import {computed, ref} from 'vue'
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
import { useQiblaCompass } from '@/composables/useQiblaCompass'
import { ActivityLogService } from '@/services/ActivityLogService'

/* ---------------- Qibla Logic ---------------- */
const {
  loading,
  hasCompass,
  qiblaBearing,
  compassRotation,
  aligned,
  start
} = useQiblaCompass()

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
    loading.value = false
  }
}

/* ---------------- Lifecycle ---------------- */
onIonViewWillEnter(() => {
  ActivityLogService.log('utility_qibla_open')
  // Set loading to true IMMEDIATELY so the user sees the spinner
  loading.value = true;

  navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        userCoords.value = { lat, lng }

        if (typeof (window as any).DeviceOrientationEvent?.requestPermission !== 'function') {
          // No iOS permission required, auto-start!
          start(lat, lng)
        } else {
          // iOS/Safari: Wait for user gesture
          loading.value = false;
        }
      },
      (err) => {
        console.error("GPS Error:", err);
        loading.value = false; // Stop loading if GPS fails
      },
      {
        enableHighAccuracy: false, // Tip 1: Faster fix
        timeout: 5000,
        maximumAge: 60000          // Use cache if available
      }
  )
})
</script>

<style scoped>
.qibla-page {
  display: flex;
  justify-content: center;
}

.center {
  text-align: center;
  margin-top: 30%;
  color: var(--ion-color-medium);
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


</style>
