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
const getCachedLocation = (): LatLng | null => {
  try {
    const raw = localStorage.getItem('hf_user_location')
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    console.warn('[GPS] Failed to parse cached location', e)
    return null
  }
}

const userLocation = ref<LatLng | null>(getCachedLocation())
const locationAttemptFinished = ref(!!userLocation.value)
const isLocating = ref(false)
const hasAutoCentered = ref(false)
let locationWatchId: string | null = null
// Battery-saving by default. The Explore map switches to high accuracy while it
// is on screen so following / nearby pop-ups keep up with a moving user.
let highAccuracy = false

// Throttling state for geocoding
const lastGeocodeTime = ref(0)
const GEOCODE_THROTTLE_MS = 60000 // 1 minute

/**
 * Shared Location Logic
 */
export function useLocation() {

  const beginWatch = async (): Promise<void> => {
    const modeUsed = highAccuracy
    locationWatchId = await Geolocation.watchPosition(
      modeUsed
        ? { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
        : {
            enableHighAccuracy: false, // 🔋 Major battery save & ANR mitigation
            maximumAge: 60000,         // Relax to 1 minute cache
            timeout: 15000
          },
      (pos, err) => {
        if (!locationAttemptFinished.value) {
          locationAttemptFinished.value = true
        }

        if (err || !pos) {
          console.warn('[GPS] Watch feedback error', err)
          return
        }

        const newLoc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          city: userLocation.value?.city
        }
        userLocation.value = newLoc
        localStorage.setItem('hf_user_location', JSON.stringify(newLoc))

        // Optional: resolve city name (THROTTLED)
        const now = Date.now()
        if (now - lastGeocodeTime.value > GEOCODE_THROTTLE_MS) {
          lastGeocodeTime.value = now
          reverseGeocode(pos.coords.latitude, pos.coords.longitude)
        }
      }
    )
    // The mode was switched while the watch was being registered: redo it
    if (modeUsed !== highAccuracy) {
      await Geolocation.clearWatch({ id: locationWatchId })
      locationWatchId = null
      await beginWatch()
    }
  }

  /** Switch between high-accuracy (moving, map on screen) and battery-saving updates. */
  const setHighAccuracy = async (enabled: boolean) => {
    if (highAccuracy === enabled) return
    highAccuracy = enabled
    if (!locationWatchId) return // not watching yet: startWatching will use the new mode
    try {
      await Geolocation.clearWatch({ id: locationWatchId })
      locationWatchId = null
      await beginWatch()
    } catch (e) {
      console.warn('[GPS] Failed to switch accuracy mode', e)
    }
  }

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
        enableHighAccuracy: false, // ⚡ Faster network/wifi triangulation on startup
        timeout: 5000
      }).then(currentPos => {
        if (currentPos) {
          const newLoc = {
            lat: currentPos.coords.latitude,
            lng: currentPos.coords.longitude,
            city: userLocation.value?.city
          }
          userLocation.value = newLoc
          localStorage.setItem('hf_user_location', JSON.stringify(newLoc))
          locationAttemptFinished.value = true
        }
      }).catch(err => {
         console.warn("[GPS] getCurrentPosition failed, watch will take over", err)
      })

      await beginWatch()
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
        localStorage.setItem('hf_user_location', JSON.stringify(userLocation.value))
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
    stopWatching,
    setHighAccuracy
  }
}
