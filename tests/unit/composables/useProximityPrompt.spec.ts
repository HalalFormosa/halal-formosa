import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { useProximityPrompt } from '@/composables/useProximityPrompt'
import { useLocation } from '@/composables/useLocation'
import { nearbyPromptsEnabled, currentUser } from '@/composables/userProfile'
import { supabase } from '@/plugins/supabaseClient'

// Define mock location ref (resolved via lazy closure in mock)
const mockUserLocation = ref<{ lat: number; lng: number } | null>(null)

// Mock dependencies
vi.mock('@capacitor/geolocation', () => ({
  Geolocation: {
    checkPermissions: vi.fn().mockResolvedValue({ location: 'granted' })
  }
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn().mockReturnValue(true)
  }
}))

vi.mock('@/composables/useLocation', () => {
  return {
    useLocation: vi.fn().mockImplementation(() => ({
      get userLocation() {
        return mockUserLocation
      }
    }))
  }
})

vi.mock('@/composables/userProfile', () => ({
  nearbyPromptsEnabled: ref(true),
  currentUser: ref({ id: 'user-123' })
}))

vi.mock('@/plugins/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        })
      }),
      // location_owners lookup — no owned locations by default
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null })
      })
    })
  }
}))

describe('useProximityPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    nearbyPromptsEnabled.value = true
    currentUser.value = { id: 'user-123' }
    mockUserLocation.value = null
    
    // Reset singleton state
    const { stopProximityTracking, currentPrompt } = useProximityPrompt()
    stopProximityTracking()
    currentPrompt.value = null
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should not track if nearbyPromptsEnabled is false', async () => {
    nearbyPromptsEnabled.value = false
    const { startProximityTracking, isTracking } = useProximityPrompt()
    
    await startProximityTracking()
    expect(isTracking.value).toBe(false)
  })

  it('should start tracking if conditions are met', async () => {
    const { startProximityTracking, isTracking } = useProximityPrompt()
    
    await startProximityTracking()
    expect(isTracking.value).toBe(true)
  })

  it('should query nearby locations on location update and trigger dwell check', async () => {
    const rpcMock = vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: [
        { id: 456, name: 'Main Mosque', lat: 25.0330, lng: 121.5654, type_id: 4, distance_m: 20 }
      ],
      error: null
    } as any)

    const { startProximityTracking, currentPrompt } = useProximityPrompt()
    await startProximityTracking()

    // Simulate location updates near the mosque
    mockUserLocation.value = { lat: 25.0331, lng: 121.5655 }
    
    // Wait for watchers to resolve
    await vi.runAllTimersAsync()

    expect(rpcMock).toHaveBeenCalledWith('find_reviewable_locations_near', {
      p_lat: 25.0331,
      p_lng: 121.5655,
      p_radius_m: 150,
      p_user_id: 'user-123'
    })

    // Advance time by 3.5 minutes to trigger dwell confirmation
    await vi.advanceTimersByTimeAsync(3.5 * 60 * 1000)
    // Send another location update to trigger the watcher check at the new time
    mockUserLocation.value = { lat: 25.03311, lng: 121.56551 }
    // Run all pending promises / async ticks
    await vi.runAllTimersAsync()

    expect(rpcMock).toHaveBeenCalledWith('record_visit', {
      p_location_id: 456
    })
    expect(currentPrompt.value).toEqual({
      id: 456,
      name: 'Main Mosque',
      lat: 25.0330,
      lng: 121.5654,
      type_id: 4,
      distance_m: 20
    })
  })

  it('should reset dwell tracker if user moves away from candidate', async () => {
    const rpcMock = vi.spyOn(supabase, 'rpc')
    rpcMock.mockImplementation((rpcName) => {
      if (rpcName === 'find_reviewable_locations_near') {
        return Promise.resolve({
          data: [
            { id: 456, name: 'Main Mosque', lat: 25.0330, lng: 121.5654, type_id: 4, distance_m: 20 }
          ],
          error: null
        } as any)
      }
      return Promise.resolve({ data: null, error: null } as any)
    })

    const { startProximityTracking, currentPrompt } = useProximityPrompt()
    await startProximityTracking()

    // 1. Move user near mosque
    mockUserLocation.value = { lat: 25.0331, lng: 121.5655 }
    await vi.runAllTimersAsync()

    // 2. Advance time 1 minute (candidate set but not dwelled)
    await vi.advanceTimersByTimeAsync(60 * 1000)
    mockUserLocation.value = { lat: 25.03311, lng: 121.56551 }
    await vi.runAllTimersAsync()
    expect(currentPrompt.value).toBeNull()

    // 3. Move user far away
    rpcMock.mockImplementation((rpcName) => {
      if (rpcName === 'find_reviewable_locations_near') {
        return Promise.resolve({
          data: [],
          error: null
        } as any)
      }
      return Promise.resolve({ data: null, error: null } as any)
    })
    mockUserLocation.value = { lat: 26.0000, lng: 122.0000 }
    await vi.runAllTimersAsync()

    // 4. Advance time past remaining dwell threshold (should not trigger prompt)
    await vi.advanceTimersByTimeAsync(3 * 60 * 1000)
    mockUserLocation.value = { lat: 26.0001, lng: 122.0001 }
    await vi.runAllTimersAsync()
    expect(currentPrompt.value).toBeNull()
  })

  it('should not re-prompt for a location the user already reviewed this session', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: [
        { id: 456, name: 'Main Mosque', lat: 25.0330, lng: 121.5654, type_id: 4, distance_m: 20 }
      ],
      error: null
    } as any)

    const { startProximityTracking, currentPrompt, dismissPrompt } = useProximityPrompt()
    await startProximityTracking()

    // Dwell until the first prompt fires
    mockUserLocation.value = { lat: 25.0331, lng: 121.5655 }
    await vi.runAllTimersAsync()
    await vi.advanceTimersByTimeAsync(3.5 * 60 * 1000)
    mockUserLocation.value = { lat: 25.03311, lng: 121.56551 }
    await vi.runAllTimersAsync()
    expect(currentPrompt.value?.id).toBe(456)

    // User submits the review (App.vue calls dismissPrompt on @success)
    await dismissPrompt()
    expect(currentPrompt.value).toBeNull()

    // Walk away and come back — the cached RPC result still lists the place
    mockUserLocation.value = { lat: 26.0000, lng: 122.0000 }
    await vi.runAllTimersAsync()
    mockUserLocation.value = { lat: 25.0331, lng: 121.5655 }
    await vi.runAllTimersAsync()
    await vi.advanceTimersByTimeAsync(3.5 * 60 * 1000)
    mockUserLocation.value = { lat: 25.03311, lng: 121.56551 }
    await vi.runAllTimersAsync()

    expect(currentPrompt.value).toBeNull()
  })

  // Kept last: it overrides the shared `supabase.from` mock for the whole file.
  it('should never prompt for a location the user owns', async () => {
    // User owns location 456
    vi.spyOn(supabase, 'from').mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        })
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [{ location_id: 456 }], error: null })
      })
    } as any)

    const rpcMock = vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: [
        { id: 456, name: 'My Own Cafe', lat: 25.0330, lng: 121.5654, type_id: 4, distance_m: 20 }
      ],
      error: null
    } as any)

    const { startProximityTracking, currentPrompt } = useProximityPrompt()
    await startProximityTracking()

    mockUserLocation.value = { lat: 25.0331, lng: 121.5655 }
    await vi.runAllTimersAsync()

    await vi.advanceTimersByTimeAsync(3.5 * 60 * 1000)
    mockUserLocation.value = { lat: 25.03311, lng: 121.56551 }
    await vi.runAllTimersAsync()

    expect(currentPrompt.value).toBeNull()
    expect(rpcMock).not.toHaveBeenCalledWith('record_visit', { p_location_id: 456 })
  })
})
