import { ref, watch } from 'vue'
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import { supabase } from '@/plugins/supabaseClient'
import { useLocation } from '@/composables/useLocation'
import { nearbyPromptsEnabled, currentUser } from '@/composables/userProfile'

// Helper function to calculate distance in meters (Euclidean approximation for short distances)
export function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return Math.sqrt(Math.pow(lat1 - lat2, 2) + Math.pow(lng1 - lng2, 2)) * 111139
}

export interface ReviewableLocation {
  id: number;
  name: string;
  lat: number;
  lng: number;
  type_id: number;
  distance_m: number;
  image?: string | null;
  address?: string | null;
  category_name?: string | null;
}

// Global shared state (singleton pattern)
const isTracking = ref(false)
const currentPrompt = ref<ReviewableLocation | null>(null)
const lastQueryLoc = ref<{ lat: number; lng: number } | null>(null)
const lastQueryTime = ref(0)
const nearbyLocations = ref<ReviewableLocation[]>([])

// Dwell tracking state
const candidateId = ref<number | null>(null)
const candidatePlace = ref<ReviewableLocation | null>(null)
const enteredAt = ref<number | null>(null)
const dwellConfirmed = ref(false)

// Configurable thresholds for easy testing/extensibility
const QUERY_DISTANCE_THRESHOLD_M = 75
const QUERY_TIME_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes
const DWELL_RADIUS_M = 150
const DWELL_TIME_THRESHOLD_MS = 3 * 60 * 1000 // 3 minutes

export function useProximityPrompt() {
  const { userLocation } = useLocation()

  const startProximityTracking = async () => {
    if (isTracking.value) return
    
    // Proximity prompts only run when nearby prompts are enabled
    if (!nearbyPromptsEnabled.value) {
      console.log('[Proximity] Nearby prompts are disabled in settings')
      return
    }

    // Geolocation permission check on native
    if (Capacitor.isNativePlatform()) {
      try {
        const perm = await Geolocation.checkPermissions()
        if (perm.location !== 'granted') {
          console.log('[Proximity] Location permission not granted, skipping tracking')
          return
        }
      } catch (err) {
        console.warn('[Proximity] Failed to check permissions:', err)
        return
      }
    }

    isTracking.value = true
    console.log('[Proximity] Proximity tracking started')
  }

  const stopProximityTracking = () => {
    isTracking.value = false
    resetDwellTracker()
    console.log('[Proximity] Proximity tracking stopped')
  }



  const resetDwellTracker = () => {
    candidateId.value = null
    candidatePlace.value = null
    enteredAt.value = null
    dwellConfirmed.value = false
  }

  const dismissPrompt = async () => {
    const prompt = currentPrompt.value
    if (!prompt) return

    currentPrompt.value = null

    // If logged in, record dismissal in DB
    if (currentUser.value?.id) {
      try {
        await supabase
          .from('location_visits')
          .update({ dismissed: true })
          .eq('user_id', currentUser.value.id)
          .eq('location_id', prompt.id)
      } catch (err) {
        console.warn('[Proximity] Failed to update visit dismissal in DB', err)
      }
    }
  }

  // Watch user location for changes when tracking is active
  watch(
    () => userLocation.value,
    async (loc) => {
      if (!isTracking.value || !loc || loc.lat === undefined || loc.lng === undefined) {
        return
      }

      const now = Date.now()
      let shouldQuery = false

      if (!lastQueryLoc.value) {
        shouldQuery = true
      } else {
        const distMoved = getDistance(
          lastQueryLoc.value.lat,
          lastQueryLoc.value.lng,
          loc.lat,
          loc.lng
        )
        const timePassed = now - lastQueryTime.value
        if (distMoved > QUERY_DISTANCE_THRESHOLD_M || timePassed > QUERY_TIME_THRESHOLD_MS) {
          shouldQuery = true
        }
      }

      if (shouldQuery) {
        lastQueryLoc.value = { lat: loc.lat, lng: loc.lng }
        lastQueryTime.value = now

        try {
          const { data, error } = await supabase.rpc('find_reviewable_locations_near', {
            p_lat: loc.lat,
            p_lng: loc.lng,
            p_radius_m: DWELL_RADIUS_M,
            p_user_id: currentUser.value?.id || null
          })
          if (!error && Array.isArray(data)) {
            nearbyLocations.value = data as ReviewableLocation[]
          } else {
            console.warn('[Proximity] find_reviewable_locations_near RPC failed', error)
          }
        } catch (err) {
          console.warn('[Proximity] Error calling find_reviewable_locations_near', err)
        }
      }

      // Check nearby candidates for dwell logic
      if (nearbyLocations.value.length > 0) {
        // find_reviewable_locations_near is ordered by distance_m asc
        const closest = nearbyLocations.value[0]

        // Recalculate distance to closest to be precise
        const currentDist = getDistance(loc.lat, loc.lng, closest.lat, closest.lng)

        if (currentDist <= DWELL_RADIUS_M) {
          if (candidateId.value !== closest.id) {
            candidateId.value = closest.id
            candidatePlace.value = closest
            enteredAt.value = now
            dwellConfirmed.value = false
            console.log(`[Proximity] New candidate detected: ${closest.name} at ${currentDist.toFixed(1)}m`)
          } else {
            // Stayed at the same candidate, check dwell time
            const elapsed = now - (enteredAt.value || now)
            if (elapsed >= DWELL_TIME_THRESHOLD_MS && !dwellConfirmed.value) {
              dwellConfirmed.value = true
              console.log(`[Proximity] Dwell threshold met for candidate: ${closest.name}`)
              
              // Call DB RPC to record visit
              if (currentUser.value?.id) {
                try {
                  await supabase.rpc('record_visit', { p_location_id: closest.id })
                } catch (err) {
                  console.warn('[Proximity] Failed to record visit in DB', err)
                }
              }
              
              // Trigger in-app prompt
              currentPrompt.value = closest
            }
          }
        } else {
          // Nearest candidate is outside radius
          if (candidateId.value !== null) {
            console.log('[Proximity] Candidate left radius')
            resetDwellTracker()
          }
        }
      } else {
        // No reviewable locations nearby
        if (candidateId.value !== null) {
          console.log('[Proximity] No reviewable locations nearby anymore')
          resetDwellTracker()
        }
      }
    },
    { deep: true, immediate: true }
  )

  return {
    isTracking,
    currentPrompt,
    nearbyLocations,
    startProximityTracking,
    stopProximityTracking,
    dismissPrompt
  }
}
