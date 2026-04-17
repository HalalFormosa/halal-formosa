import { ref } from 'vue'
import { Geolocation } from '@capacitor/geolocation'
import { Capacitor } from '@capacitor/core'

/**
 * LatLng Interface
 */
export interface LatLng {
  lat: number
  lng: number
  city?: string
}

// Global shared state (singleton pattern)
const userLocation = ref<LatLng | null>(null)
const locationAttemptFinished = ref(false)
const isLocating = ref(false)
const hasAutoCentered = ref(false)
let locationWatchId: string | null = null

// Throttling state for geocoding
const lastGeocodeTime = ref(0)
const GEOCODE_THROTTLE_MS = 60000 // 1 minute

/**
 * Shared Location Logic
 */
export function useLocation() {

  const startWatching = async () => {
    if (locationWatchId) return; // Prevent multiple watchers

    isLocating.value = true
    try {
      if (Capacitor.isNativePlatform()) {
        const perm = await Geolocation.checkPermissions()
        if (perm.location !== 'granted') {
          const req = await Geolocation.requestPermissions()
          if (req.location !== 'granted') {
            locationAttemptFinished.value = true // Resolve even on denial
            return
          }
        }
      }

      // Initial check to speed things up if permissions are already given
      // We don't AWAIT this because we want to start the watch ASAP
      Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 5000
      }).then(currentPos => {
        if (currentPos && !userLocation.value) {
          userLocation.value = {
            lat: currentPos.coords.latitude,
            lng: currentPos.coords.longitude
          }
          locationAttemptFinished.value = true
        }
      }).catch(err => {
         console.warn("[GPS] getCurrentPosition failed, watch will take over", err)
      })

      // Continuous watching
      locationWatchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          maximumAge: 10000, // Balanced battery/accuracy
          timeout: 30000
        },
        (pos, err) => {
          if (!locationAttemptFinished.value) {
            locationAttemptFinished.value = true
          }

          if (err || !pos) {
            console.warn('[GPS] Watch feedback error', err)
            return
          }

          userLocation.value = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          }
          
          // Optional: resolve city name (THROTTLED)
          const now = Date.now()
          if (now - lastGeocodeTime.value > GEOCODE_THROTTLE_MS) {
            lastGeocodeTime.value = now
            reverseGeocode(pos.coords.latitude, pos.coords.longitude)
          }
        }
      )
    } catch (e) {
      console.error('[GPS] Location acquisition failed', e)
      locationAttemptFinished.value = true
    } finally {
      isLocating.value = false
    }
  }

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'HalalFormosaApp/1.0'
          }
        }
      )
      const data = await res.json()
      if (userLocation.value) {
        userLocation.value.city = 
          data.address?.city ||
          data.address?.town ||
          data.address?.municipality ||
          data.address?.state
      }
    } catch (e) {
      console.warn('[GPS] Reverse geocoding failed', e)
    }
  }

  const stopWatching = async () => {
    if (locationWatchId) {
      await Geolocation.clearWatch({ id: locationWatchId })
      locationWatchId = null
    }
  }

  return {
    userLocation,
    locationAttemptFinished,
    isLocating,
    hasAutoCentered,
    startWatching,
    stopWatching
  }
}
