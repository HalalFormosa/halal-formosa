<template>
  <ion-page>
    <ion-header class="explore-header" :class="{ 'is-native': isNative && !isDonor }">
      <!-- Native AdMob banner -->
      <div v-if="isNative && !isDonor" id="ad-space-explore" style="height:65px;"></div>

      <ion-toolbar class="header-search-toolbar">
        <!-- Search & Add Row -->
        <div class="search-row">
          <ion-searchbar
              class="search-explore"
              :debounce="1000"
              v-model="searchQuery"
              @ionInput="onSearchInput"
              @ionSearch="onSearchCommit"
              @keyup.enter.capture="onSearchCommit"
              :placeholder="$t('explore.placeholder')"
              :disabled="isGeocoding"
          />

          <ion-button
              @click="viewMode = viewMode === 'map' ? 'list' : 'map'"
              class="header-btn"
              color="carrot"
          >
            <ion-icon :icon="viewMode === 'map' ? listOutline : mapOutline"/>
          </ion-button>

          <ion-button
              v-if="isLoggedIn"
              @click="goToAddPlace"
              class="header-btn"
              color="carrot"
          >
            <ion-icon :icon="addOutline"/>
          </ion-button>
          
        </div>

        <!-- Category bar row -->
        <div class="category-bar-row">
          <div v-show="!loadingCategories" class="category-bar">
            <ion-chip
                v-for="cat in categories"
                :key="cat.id"
                class="modern-category-chip"
                :class="{ active: activeCategoryIds.includes(cat.id) }"
                :style="{ 
                  '--cat-color': cat.color || 'var(--ion-color-carrot)',
                  '--cat-bg': activeCategoryIds.includes(cat.id) ? (cat.color || 'var(--ion-color-carrot)') : 'transparent'
                }"
                @click="toggleCategory(cat)"
            >
              <span v-if="typeof categoryIconMap[cat.name] === 'string' && categoryIconMap[cat.name].length === 2" class="category-emoji">
                {{ categoryIconMap[cat.name] }}
              </span>
              <ion-icon v-else-if="categoryIconMap[cat.name]" :icon="categoryIconMap[cat.name]" class="category-icon" />
              <ion-label>{{ cat.name }}</ion-label>
            </ion-chip>
          </div>

          <ion-chip
              v-if="activeCategoryIds.length"
              class="clear-chip floating-clear"
              @click="activeCategoryIds = []"
          >
            <ion-icon :icon="closeCircleOutline" style="margin-right: 4px; font-size: 16px;" />
            {{ $t('common.clear') }}
          </ion-chip>

          <!-- Skeleton placeholder -->
          <div v-if="loadingCategories" class="category-skeletons" style="display: flex; gap: 10px;">
            <ion-skeleton-text animated style="width:110px; height:36px; border-radius:100px; margin: 0;"/>
            <ion-skeleton-text animated style="width:85px; height:36px; border-radius:100px; margin: 0;"/>
            <ion-skeleton-text animated style="width:120px; height:36px; border-radius:100px; margin: 0;"/>
            <ion-skeleton-text animated style="width:90px; height:36px; border-radius:100px; margin: 0;"/>
          </div>
        </div>
      </ion-toolbar>
    </ion-header>

    <div
        style="position: absolute; height: 100%; width: 100%; top: 0; left: 0; z-index: 0;"
    >
      <div id="map" :class="{ 'map-dimmed': viewMode === 'list' }" style="height: 100%; width: 100%;"></div>

      <!-- Map is always present, hidden when loading -->
      <ion-skeleton-text
          v-show="loading"
          animated
          class="map-overlay"
      />

      <!-- Skeleton overlay -->
      <ion-skeleton-text
          v-show="loading"
          animated
          style="height:100%;width:100%;border-radius:0;position:absolute;top:0;left:0;z-index:0;"
      />
    </div>

    <!-- 4. List View Overlay -->
    <transition name="fade-slide">
      <div v-if="viewMode === 'list'" class="list-view-overlay">
        <div class="list-container">
          <div class="list-header">
            <div class="list-sort-container">
              <ion-button
                  class="sort-btn-simple"
                  fill="clear"
                  id="sort-trigger-explore"
              >
                <ion-icon :icon="sortIcon" slot="start" />
                <ion-label>{{ sortLabel }}</ion-label>
                <ion-icon :icon="chevronDownOutline" slot="end" style="font-size: 12px; margin-left: 4px;" />
              </ion-button>
              
              <ion-popover trigger="sort-trigger-explore" trigger-action="click" :dismiss-on-select="true" class="width-190">
                <ion-list lines="none">
                  <ion-item button @click="sortBy = 'nearest'">
                    <ion-icon :icon="locationOutline" slot="start" />
                    <ion-label>{{ $t('search.sortNearest') }}</ion-label>
                    <ion-icon v-if="sortBy === 'nearest'" :icon="checkmarkCircle" slot="end" color="success" style="font-size: 14px;" />
                  </ion-item>
                  
                  <ion-item button @click="sortBy = 'recent'">
                    <ion-icon :icon="timeOutline" slot="start" />
                    <ion-label>{{ $t('search.sortRecent') }}</ion-label>
                    <ion-icon v-if="sortBy === 'recent'" :icon="checkmarkCircle" slot="end" color="success" style="font-size: 14px;" />
                  </ion-item>
                  
                  <ion-item button @click="sortBy = 'trending'">
                    <ion-icon :icon="trendingUpOutline" slot="start" />
                    <ion-label>{{ $t('search.sortTrending') }}</ion-label>
                    <ion-icon v-if="sortBy === 'trending'" :icon="checkmarkCircle" slot="end" color="success" style="font-size: 14px;" />
                  </ion-item>

                  <ion-item button @click="sortBy = 'popular'">
                    <ion-icon :icon="flameOutline" slot="start" />
                    <ion-label>{{ $t('search.sortViews') }}</ion-label>
                    <ion-icon v-if="sortBy === 'popular'" :icon="checkmarkCircle" slot="end" color="success" style="font-size: 14px;" />
                  </ion-item>
                </ion-list>
              </ion-popover>
            </div>

            <h3>{{ $t('explore.results') }} ({{ displayedLocations.length }})</h3>
          </div>
          
          <div class="vertical-cards-stack">
            <!-- Skeleton list while loading -->
            <template v-if="loadingPlaces">
              <div v-for="n in 5" :key="'skeleton-list-' + n" class="modern-location-card list-mode-card">
                <div class="card-inner">
                  <div class="card-image-section">
                    <ion-skeleton-text animated style="width:100%; height:100%; border-radius:10px;" />
                  </div>
                  <div class="card-info-section">
                    <div class="info-top">
                      <ion-skeleton-text animated style="width:70%; height:20px; margin-bottom:12px;" />
                      <div class="metas">
                        <ion-skeleton-text animated style="width:30%; height:14px;" />
                        <ion-skeleton-text animated style="width:20%; height:14px;" />
                      </div>
                      <ion-skeleton-text animated style="width:40%; height:14px; margin-top:8px;" />
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <div
              v-for="place in displayedLocations"
              :key="place.id"
              class="modern-location-card list-mode-card"
              :class="['tier-' + String(place.partner_tier || 'basic').toLowerCase()]"
              @click="goToDetail(place.id)"
            >
              <div class="card-inner">
                <div class="card-image-section">
                  <img 
                    loading="lazy" 
                    :src="place.image || PLACEHOLDER" 
                    :alt="place.name" 
                    @error="onImageError"
                  />
                  <div v-if="place.partner_tier" class="floating-tier-badge">
                    <div :class="['tier-pill', place.partner_tier.toLowerCase()]">
                      <ion-icon :icon="sparkles" />
                      <span>{{ place.partner_tier.toUpperCase() }}</span>
                    </div>
                  </div>
                </div>
                <div class="card-info-section">
                  <div class="info-top">
                    <h5 class="title-text">
                      {{ place.name }}
                      <ion-icon v-if="place.partner_tier" :icon="checkmarkCircle" class="verified-badge" />
                    </h5>
                    <div class="metas">
                      <span class="meta">{{ place.type }}</span>
                      <span class="meta-dot">•</span>
                      <span class="meta"><ion-icon :icon="eyeOutline" style="vertical-align: middle; margin-top: -2px;" /> {{ place.view_count || 0 }}</span>
                      <span class="meta-dot">•</span>
                      <span class="meta">
                        <ion-icon :icon="calendarOutline" style="vertical-align: middle; margin-top: -2px;" />
                        {{ fromNowToTaipei(place.created_at) }}
                      </span>
                    </div>
                    <div v-if="userLocation && (place as any).distance !== undefined" class="distance">
                      <ion-icon :icon="locationOutline" style="font-size: 0.85rem; vertical-align: middle; margin-top: -2px;" /> {{ formatKm((place as any).distance) }} km
                    </div>
                  </div>
                </div>
                <div v-if="['gold', 'silver'].includes(String(place.partner_tier || '').toLowerCase())" class="premium-flare"></div>
              </div>
            </div>
            
            <div v-if="displayedLocations.length === 0 && !loading" class="empty-state">
              <ion-icon :icon="informationCircleOutline" />
              <p>{{ $t('explore.noResults') }}</p>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- 5. Floating UI (Locate Me) -->
    <div v-if="viewMode === 'map'" class="map-floating-actions">
      <ion-button class="locate-me-btn" color="carrot" @click="centerOnUser">
        <ion-icon :icon="navigateCircleOutline" />
      </ion-button>
    </div>

    <!-- 6. Bottom Results Slider (Map Only) -->
    <div 
      v-if="viewMode === 'map' && (displayedLocations.length > 0 || loadingPlaces)"
      class="floating-results-bar"
    >
      <div 
        ref="contentRef" 
        class="horizontal-scroll-wrapper"
      >
        <div class="cards-track">
          <!-- Skeleton list while loading -->
          <template v-if="loadingPlaces">
            <div v-for="n in 3" :key="'skeleton-map-' + n" class="modern-location-card">
              <div class="card-inner">
                <div class="card-image-section">
                  <ion-skeleton-text
                      animated
                      style="width:100%; height:100%;"
                  />
                </div>
                <div class="card-info-section">
                  <div class="info-top">
                    <ion-skeleton-text animated style="width:75%; height:20px; margin-bottom:12px;" />
                    <div class="metas">
                      <ion-skeleton-text animated style="width:30%; height:14px;" />
                      <ion-skeleton-text animated style="width:20%; height:14px;" />
                      <ion-skeleton-text animated style="width:20%; height:14px;" />
                    </div>
                    <ion-skeleton-text animated style="width:45%; height:14px; margin-top:8px;" />
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- Real data after loaded -->
          <template v-else>
            <div
                v-for="place in displayedLocations"
                :key="place.id"
                :data-id="place.id"
                :ref="setCardRef(place.id)"
                :class="[
                  'modern-location-card', 
                  { 'active-card': selectedPlace?.id === place.id },
                  place.partner_tier ? 'tier-' + place.partner_tier.toLowerCase() : ''
                ]"
                @click="selectPlace(place)"
            >
              <div class="card-inner">
                <div class="card-image-section">
                  <img
                      loading="lazy"
                      :src="place.image || PLACEHOLDER"
                      :alt="place.name"
                      @error="onImageError"
                  />
                  <!-- Floating Tier Badge -->
                  <div v-if="place.partner_tier" class="floating-tier-badge">
                    <div :class="['tier-pill', place.partner_tier.toLowerCase()]">
                      <ion-icon :icon="sparkles" />
                      <span>{{ (place.partner_tier || '').toUpperCase() }}</span>
                    </div>
                  </div>
                </div>

                <div class="card-info-section">
                  <div class="info-top">
                    <h5 class="title-text">
                      {{ place.name }}
                      <ion-icon v-if="place.partner_tier" :icon="checkmarkCircle" class="verified-badge" />
                    </h5>
                    <div class="metas">
                      <span class="meta">{{ place.type }}</span>
                      <span class="meta-dot">•</span>
                      <span class="meta"><ion-icon :icon="eyeOutline" style="vertical-align: middle; margin-top: -2px;" /> {{ place.view_count || 0 }}</span>
                      <span class="meta-dot">•</span>
                      <span class="meta">
                        <ion-icon :icon="calendarOutline" style="vertical-align: middle; margin-top: -2px;" />
                        {{ fromNowToTaipei(place.created_at) }}
                      </span>
                    </div>
                    
                    <div v-if="userLocation && (place as any).distance !== undefined" class="distance">
                      <ion-icon :icon="locationOutline" style="font-size: 0.85rem; vertical-align: middle; margin-top: -2px;" /> {{ formatKm((place as any).distance) }} km
                    </div>
                  </div>

                  <div class="info-actions">
                    <div class="action-row">
                      <ion-button fill="clear" size="small" color="carrot" @click.stop="goToDetail(place.id)" class="detail-btn">
                        DETAILS
                      </ion-button>
                    </div>
                  </div>
                </div>
                <div v-if="['gold', 'silver'].includes(String(place.partner_tier || '').toLowerCase())" class="premium-flare"></div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </ion-page>
</template>


<script setup lang="ts">

/* ---------------- Imports ---------------- */
import {
  IonPage, IonContent, IonToolbar, IonSearchbar, IonIcon, IonFab, IonFabButton,
  IonCard, IonThumbnail, IonButton, onIonViewDidEnter, IonLabel, IonChip, IonHeader,
  IonSkeletonText, onIonViewWillEnter, IonFabList, onIonViewWillLeave, IonModal,
  IonPopover, IonList, IonItem
} from '@ionic/vue'
import {
  navigateCircleOutline,
  addOutline,
  restaurant, informationCircleOutline, chevronUpOutline, chevronDownOutline, restaurantOutline, leaf, home,
  layersOutline, listOutline, gridOutline, mapOutline, sparkles, shieldCheckmarkOutline, checkmarkCircle,
  trendingUpOutline, flameOutline, timeOutline, locationOutline, filterOutline,
  eyeOutline, shareSocialOutline, navigateOutline, closeCircleOutline,
  calendarOutline
} from 'ionicons/icons'
import {ref, computed, nextTick, onMounted, onUnmounted, watch} from 'vue'
import type {ComponentPublicInstance, VNodeRef} from 'vue'
import {useRouter} from 'vue-router'
import mapsLoader from '@/plugins/googleMapsLoader'
import {Capacitor} from '@capacitor/core'
import {Geolocation} from '@capacitor/geolocation'
import {supabase} from '@/plugins/supabaseClient'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import {MarkerClusterer, SuperClusterAlgorithm} from "@googlemaps/markerclusterer"
import {Cluster, Renderer} from "@googlemaps/markerclusterer"

import { Motion } from '@capacitor/motion'

import useSharePlace from '@/composables/useSharePlace'
import {ActivityLogService} from "@/services/ActivityLogService";

import {isDonor} from "@/composables/useSubscriptionStatus";

const ionIconMap: Record<string, any> = {
  restaurant,
  restaurantOutline,
  leaf,
  home,
  listOutline,
  mapOutline
}

/* ---------------- State ---------------- */
const viewMode = ref<'map' | 'list'>('map')

/* ---------------- Types ---------------- */
type LatLng = { lat: number; lng: number }
type LocationType = {
  id: number
  name: string
  color: string | null
  emoji: string | null
  icon: string | null
}


type Place = {
  id: number
  name: string
  address?: string | null
  position: { lat: number; lng: number }
  image?: string | null
  typeId: number | null
  type: string
  view_count?: number
  partner_tier?: 'Gold' | 'Silver' | 'Bronze'
  created_at?: string
}


type LocationRow = {
  id: number
  name: string
  address: string
  lat: number
  lng: number
  image?: string | null
  type_id: number | null
  location_types: { name: string } | null
  view_count?: number
  partner_tier?: 'Gold' | 'Silver' | 'Bronze'
  created_at: string
}

// Local type for ion-content (no external import needed)
type HTMLIonContentElement = HTMLElement & {
  getScrollElement: () => Promise<HTMLElement>
}

// No longer using viewMode switcher
const isPageActive = ref(false)


/* ---------------- Constants ---------------- */
const MAP_ID = 'a40f1ec0ad0afbbb12694f19'
const DEFAULT_CENTER: LatLng = {lat: 25.0343, lng: 121.5645}
const PLACEHOLDER = 'https://placehold.co/200x100'

/* ---------------- State ---------------- */
const router = useRouter()

const isLoggedIn = ref(false)
const isContributor = ref(false)
const userLocation = ref<LatLng | null>(null)

const locations = ref<Place[]>([])
const selectedPlace = ref<Place | null>(null)
const focusedPlaceId = ref<number | null>(null)

const cardRefs = ref<Record<number, Element | ComponentPublicInstance | null>>({})
const contentRef = ref<HTMLIonContentElement | null>(null)

const searchQuery = ref('')
const isNative = ref(Capacitor.isNativePlatform())
const loading = ref(true)
const loadingCategories = ref(true)
const loadingPlaces = ref(true)
const sortBy = ref<'nearest' | 'recent' | 'popular' | 'trending'>('nearest')
const trendingPlaceIds = ref<number[]>([])

let cardObserver: IntersectionObserver | null = null
let isProgrammaticScroll = false

/* Google Maps runtime objects */
let mapInstance: google.maps.Map | null = null
let advancedMarkerLib: typeof google.maps.marker | null = null
let infoWindow: google.maps.InfoWindow | null = null
const markerMap = new Map<number, google.maps.marker.AdvancedMarkerElement>()
const userMarker = ref<google.maps.marker.AdvancedMarkerElement | null>(null)
const userArrowEl = ref<HTMLElement | null>(null)
const {sharePlace} = useSharePlace()
const locationTypes = ref<LocationType[]>([])
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

let hasCenteredInitially = false
let clusterer: MarkerClusterer | null = null
let locationWatchId: string | null = null
let lastStableLoc: LatLng | null = null

const distanceInMeters = (a: LatLng, b: LatLng) => {
  const R = 6371000
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180

  const x =
      dLng * Math.cos((a.lat + b.lat) * Math.PI / 360)
  const y = dLat

  return Math.sqrt(x * x + y * y) * R
}

const startWatchingUserLocation = async () => {
  try {
    if (Capacitor.isNativePlatform()) {
      const perm = await Geolocation.checkPermissions()
      if (perm.location !== 'granted') {
        const req = await Geolocation.requestPermissions()
        if (req.location !== 'granted') return
      }
    }

    locationWatchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          maximumAge: 1000,   // reuse recent GPS
          timeout: 10000
        },
        (pos, err) => {
          if (err || !pos) {
            console.warn('[GPS] watch error', err)
            return
          }

          const userLoc = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          }

          userLocation.value = userLoc

          // 🔥 CENTER MAP ON FIRST GPS FIX ONLY
          if (!hasCenteredInitially && mapInstance) {
            setTimeout(() => {
              mapInstance?.panTo(userLoc)
              mapInstance?.setZoom(15)
            }, 800)
            hasCenteredInitially = true
          }


          // 🟦 Update dot
          if (userMarker.value) {
            const prevPos = userMarker.value.position
            if (!prevPos) return

            const prevLat =
                prevPos instanceof google.maps.LatLng
                    ? prevPos.lat()
                    : prevPos.lat

            const prevLng =
                prevPos instanceof google.maps.LatLng
                    ? prevPos.lng()
                    : prevPos.lng

            const prev: LatLng = lastStableLoc ?? { lat: prevLat, lng: prevLng }

            const d = distanceInMeters(prev, userLoc)
            if (d < 5) return

            const t = d > 30 ? 0.7 : d > 10 ? 0.45 : 0.3

            const next: LatLng = {
              lat: lerp(prev.lat, userLoc.lat, t),
              lng: lerp(prev.lng, userLoc.lng, t),
            }

            userMarker.value.position = next
            lastStableLoc = next


          } else if (advancedMarkerLib && mapInstance) {
            const dot = document.createElement('div')
            dot.className = 'user-location-dot'

            const cone = document.createElement('div')
            cone.className = 'user-heading-cone'
            dot.prepend(cone) // 👈 Prepend so it stays behind the dot background
            userArrowEl.value = cone

            userMarker.value =
                new advancedMarkerLib.AdvancedMarkerElement({
                  position: userLoc,
                  map: mapInstance,
                  content: dot,
                  title: 'You are here'
                })
            
            // Re-initialize heading tracking once dot exists
            initHeadingTracking()
          }
        }
    )
  } catch (e) {
    console.warn('[GPS] Failed to start watch', e)
  }
}

const initHeadingTracking = async () => {
  if (!userArrowEl.value) return

  // iOS 13+ permission 
  if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
    try {
      const permission = await (DeviceOrientationEvent as any).requestPermission()
      if (permission !== 'granted') return
    } catch (e) {
      console.warn('[Orientation] Permission failed', e)
      return
    }
  }

  try {
    await Motion.addListener('orientation', (event) => {
      if (userArrowEl.value) {
        // alpha is heading (0-360)
        const heading = (event as any).webkitCompassHeading || event.alpha || 0
        userArrowEl.value.style.transform = `rotate(${heading}deg)`
      }
    })
  } catch (e) {
    console.warn('[Orientation] Motion listener failed', e)
  }
}

const fetchLocationTypes = async () => {
  loadingCategories.value = true

  const {data, error} = await supabase
      .from('location_types')
      .select('id, name, color, emoji, icon')
      .eq('is_active', true)
      .order('sort_order', {ascending: true})
      .order('name', {ascending: true})

  if (!error && data) locationTypes.value = data

  loadingCategories.value = false
}

const addressMarker = ref<google.maps.marker.AdvancedMarkerElement | null>(null)

const isGeocoding = ref(false)
const lastGeocodeAt = ref(0)
const lastGeocodeQuery = ref<string | null>(null)

const GEOCODE_COOLDOWN_MS = 1500 // 1.5 seconds

const onSearchCommit = async () => {
  if (!mapInstance) return

  const q = searchQuery.value.trim()
  if (!q) return

  // 1️⃣ Local DB match FIRST
  const hasLocalMatch = sortedLocations.value.length > 0
  if (hasLocalMatch) {
    console.log('[SEARCH] Local DB match', {
      query: q,
      count: sortedLocations.value.length,
      firstId: sortedLocations.value[0]?.id
    })

    const first = sortedLocations.value[0]
    if (first) {
      selectPlace(first)
    }
    return
  }

  // 2️⃣ Same-query protection
  if (lastGeocodeQuery.value === q) {
    console.log('[SEARCH] Blocked — duplicate query', q)
    return
  }

  // 3️⃣ Spam / cooldown protection
  const now = Date.now()

  if (isGeocoding.value) {
    console.log('[SEARCH] Blocked — geocode in progress', q)
    return
  }

  if (now - lastGeocodeAt.value < GEOCODE_COOLDOWN_MS) {
    console.log('[SEARCH] Blocked — cooldown', {
      query: q,
      remainingMs: GEOCODE_COOLDOWN_MS - (now - lastGeocodeAt.value)
    })
    return
  }

  isGeocoding.value = true
  lastGeocodeAt.value = now
  lastGeocodeQuery.value = q

  try {
    // 4️⃣ Paid fallback
    console.log('[SEARCH] Geocode fallback', q)
    await geocodeAddress(q)
  } finally {
    isGeocoding.value = false
  }
}


import {toastController} from '@ionic/vue'

const showAddressToast = async () => {
  const toast = await toastController.create({
    message: isGeocoding.value
        ? 'Please wait…'
        : 'Searching address on map…',
    duration: 1000,
    position: 'top'
  })
  await toast.present()
}


const geocodeAddress = async (query: string) => {
  await showAddressToast()
  try {
    const geocoder = new google.maps.Geocoder()

    const res = await geocoder.geocode({
      address: query,
      region: 'TW',
      bounds: mapInstance?.getBounds() ?? undefined
    })

    const place = res.results?.[0]
    if (!place) return

    const loc = place.geometry.location
    const latLng = {lat: loc.lat(), lng: loc.lng()}

    // Move map
    mapInstance!.panTo(latLng)
    mapInstance!.setZoom(17)

    // Drop / move temp marker
    if (advancedMarkerLib) {
      if (addressMarker.value) {
        addressMarker.value.position = latLng
        addressMarker.value.map = mapInstance
      } else {
        const dot = document.createElement('div')
        dot.className = 'user-location-dot' // reuse style

        addressMarker.value =
            new advancedMarkerLib.AdvancedMarkerElement({
              position: latLng,
              map: mapInstance!,
              content: dot,
              title: place.formatted_address
            })
      }
    }

    // Optional InfoWindow
    if (infoWindow) {
      infoWindow.setContent(`
        <strong>📍 ${place.formatted_address}</strong>
      `)
      infoWindow.open(mapInstance, addressMarker.value!)
    }

    ActivityLogService.log("explore_address_search", {
      query,
      address: place.formatted_address,
      lat: latLng.lat,
      lng: latLng.lng
    })
  } catch (err) {
    console.warn("Geocode failed", err)
  }

  // Reset DB filters after successful address search
  searchQuery.value = ''
  activeCategoryIds.value = []

  focusedPlaceId.value = null
}


const categoryIconMap = computed<Record<string, any>>(() => {
  const map: Record<string, any> = {}

  for (const t of locationTypes.value) {
    if (t.emoji) {
      map[t.name] = t.emoji
    } else if (t.icon) {
      map[t.name] = ionIconMap[t.icon] ?? restaurant
    }
  }

  return map
})

const topOffset = computed(() => {
  let offset = 12; // base padding

  if (isNative.value && !isDonor.value) {
    offset += 120; // 👈 your AdMob height
  }

  return `${offset}px`;
});

const sortLabel = computed(() => {
  if (sortBy.value === 'nearest') return 'Nearest'
  if (sortBy.value === 'recent') return 'Recent'
  if (sortBy.value === 'trending') return 'Trending'
  if (sortBy.value === 'popular') return 'Hot'
  return 'Sort'
})

const sortIcon = computed(() => {
  if (sortBy.value === 'nearest') return locationOutline
  if (sortBy.value === 'recent') return timeOutline
  if (sortBy.value === 'trending') return trendingUpOutline
  if (sortBy.value === 'popular') return flameOutline
  return filterOutline
})

const markerStyles = computed<Record<string, {
  color: string
  emoji?: string
}>>(() => {
  const map: Record<string, any> = {}

  for (const t of locationTypes.value) {
    map[t.name] = {
      color: t.color ?? 'var(--ion-color-carrot)',
      emoji: t.emoji ?? undefined
    }
  }

  return map
})

// No viewMode logic needed

/* ---------------- Utilities ---------------- */

const getDomEl = (node: Element | ComponentPublicInstance | null | undefined) =>
    ((node as ComponentPublicInstance | null)?.$el ?? node) as HTMLElement | null

const formatKm = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : '–')

const getDistanceInKm = (locPos: LatLng) => {
  if (!userLocation.value) return Number.POSITIVE_INFINITY
  const R = 6371
  const dLat = (locPos.lat - userLocation.value.lat) * Math.PI / 180
  const dLon = (locPos.lng - userLocation.value.lng) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(userLocation.value.lat * Math.PI / 180) *
      Math.cos(locPos.lat * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

// ✅ initialize dayjs
dayjs.extend(relativeTime)
dayjs.extend(utc)
dayjs.extend(timezone)

function fromNowToTaipei(dateString?: string) {
  if (!dateString) return ''
  return dayjs.utc(dateString).tz('Asia/Taipei').fromNow()
}

const displayedLocations = computed(() => {
  // if one place is focused → only show that
  if (focusedPlaceId.value !== null) {
    return sortedLocations.value.filter(l => l.id === focusedPlaceId.value)
  }
  return sortedLocations.value
})


const setCardRef = (id: number): VNodeRef =>
    ((el: Element | ComponentPublicInstance | null) => {
      cardRefs.value[id] = el
    }) as VNodeRef

const onImageError = (e: Event) => {
  const img = e.currentTarget as HTMLImageElement | null
  if (!img) return
  img.onerror = null
  img.src = PLACEHOLDER
}

const carrotRippleClusterRenderer: Renderer = {
  render: ({count, position}: Cluster) => {
    // Color based on count
    let bg = "rgba(255, 159, 64, 1)" // light orange
    if (count > 50) bg = "rgba(255, 87, 34, 1)" // carrot orange
    if (count > 100) bg = "rgba(220, 53, 69, 1)" // red

    const div = document.createElement("div")
    div.style.background = bg
    div.style.color = "white"
    div.style.borderRadius = "50%"
    div.style.display = "flex"
    div.style.alignItems = "center"
    div.style.justifyContent = "center"
    div.style.width = "40px"
    div.style.height = "40px"
    div.style.fontSize = "14px"
    div.style.fontWeight = "bold"
    div.style.boxShadow = "0 0 0 8px rgba(255, 87, 34, 0.5)" // soft ripple glow
    div.style.transition = "transform 0.3s ease"
    div.textContent = String(count)

    // Animate ripple
    div.animate(
        [
          {boxShadow: "0 0 0 0 rgba(255, 87, 34, 0.4)"},
          {boxShadow: "0 0 0 12px rgba(255, 87, 34, 0)"}
        ],
        {
          duration: 1500,
          iterations: Infinity
        }
    )

    return new google.maps.marker.AdvancedMarkerElement({
      position,
      content: div
    })
  },
}

const darkenColor = (color: string, amount = 0.35) => {
  // HEX format
  if (color.startsWith('#')) {
    const hex = color.replace('#', '')
    if (hex.length !== 6) return color

    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)

    const dark = (v: number) => Math.max(0, Math.floor(v * (1 - amount)))

    return `rgb(${dark(r)}, ${dark(g)}, ${dark(b)})`
  }

  // rgb / rgba format
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (match) {
    const r = Number(match[1])
    const g = Number(match[2])
    const b = Number(match[3])

    const dark = (v: number) => Math.max(0, Math.floor(v * (1 - amount)))

    return `rgb(${dark(r)}, ${dark(g)}, ${dark(b)})`
  }

  // fallback (CSS var etc.)
  return color
}


const buildInfoHtml = (p: Place) => {
  const baseColor =
      markerStyles.value[p.type]?.color ?? 'var(--ion-color-carrot)'

  const textColor = darkenColor(baseColor, 0.45)
  const emoji = markerStyles.value[p.type]?.emoji ?? ''

  return `
    <div style="max-width: 230px;">
      <img
        src="${p.image || 'https://placehold.co/200x100'}"
        alt="${p.name}"
        style="
          width: 100%;
          height: 120px;
          object-fit: cover;
          border-radius: 8px;
          margin-bottom: 6px;
        "
        onerror="this.src='https://placehold.co/200x100';"
      />

      <strong style="display:block; font-size:14px; margin-bottom:2px;">
        ${p.name}
      </strong>

      <!-- Category badge -->
      <span
  style="
    display: inline-block;
    margin-top: 2px;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 500;
    color: ${textColor};
    border-width: 1px;
    border-style: solid;
    border-color: ${textColor};
    background: rgba(0,0,0,0.03);
  "
>
        ${emoji ? `${emoji}&nbsp;` : ''}${p.type}
      </span>

      ${p.address ? `
        <div
          style="
            font-size: 12px;
            color: #6b7280;
            margin-top: 4px;
            line-height: 1.3;
            display: flex;
            align-items: center;
            gap: 4px;
          "
        >
          <ion-icon :icon="locationOutline" style="font-size: 14px; flex-shrink: 0;"></ion-icon>
          <span>${p.address}</span>
        </div>
      ` : ''}

      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 8px;
        "
      >
        <a
          href="https://www.google.com/maps/dir/?api=1&destination=${p.position.lat},${p.position.lng}"
          target="_blank"
          rel="noopener noreferrer"
          style="
            color: var(--ion-color-carrot);
            font-weight: 600;
            text-decoration: none;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 4px;
          "
        >
          <ion-icon :icon="navigateOutline"></ion-icon>
          Navigate
        </a>

        <button
          class="share-btn"
          data-id="${p.id}"
          style="
            background: none;
            border: none;
            color: var(--ion-color-carrot);
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 4px;
          "
        >
          <ion-icon :icon="shareSocialOutline"></ion-icon>
          Share
        </button>
      </div>
    </div>
  `
}


const createPinElement = (place: Place) => {
  const style =
      markerStyles.value[place.type] ?? {
        color: "var(--ion-color-carrot)"
      }

  const wrapper = document.createElement("div")
  wrapper.className = "pin-wrapper"

  wrapper.innerHTML = `
    <div class="pin">
      <div class="pin-head">
        ${style.emoji ?? ""}
      </div>
      <div class="pin-body" style="background:${style.color}"></div>
    </div>
  `

  return wrapper
}


const applyInfoWindowDarkClass = () => {
  const isDark = document.documentElement.classList.contains('ion-palette-dark')
  const iw = document.querySelector('.gm-style-iw-c')
  if (iw) iw.classList.toggle('dark-infowindow', isDark)
}

// Resolve the actual host element from a ref that may be a component or an element
const asEl = (node: unknown): HTMLElement | null => {
  if (!node) return null
  const maybeCmp = node as { $el?: Element }
  return ((maybeCmp && '$el' in maybeCmp && maybeCmp.$el) ? maybeCmp.$el : (node as Element)) as HTMLElement
}

const scrollCardIntoView = async (id: number) => {
  await nextTick()

  const cardRef = cardRefs.value[id]
  const cardEl = getDomEl(cardRef)
  if (!cardEl || !contentRef.value) return

  const containerEl = contentRef.value as HTMLElement
  
  // For horizontal slider, we use scrollLeft
  const containerRect = containerEl.getBoundingClientRect()
  const cardRect = cardEl.getBoundingClientRect()
  
  const scrollOffset = containerEl.scrollLeft + (cardRect.left - containerRect.left) - (containerRect.width / 2) + (cardRect.width / 2)
  
  isProgrammaticScroll = true
  containerEl.scrollTo({
    left: scrollOffset,
    behavior: 'smooth'
  })

  // Reset after scroll likely finishes
  setTimeout(() => {
    isProgrammaticScroll = false
  }, 800)
}

/* ---------------- Roles ---------------- */
const loadRole = async () => {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    isLoggedIn.value = false
    return
  }

  isLoggedIn.value = true

  const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

  if (!error && (data?.role === 'admin' || data?.role === 'contributor')) {
    isContributor.value = true
  }
}

/* ---------------- Data ---------------- */
const fetchLocations = async () => {
  loadingPlaces.value = true

  const { data, error } = await supabase
      .from('locations')
      .select(`
    id,
    name,
    lat,
    lng,
    image,
    type_id,
    address,
    view_count,
    created_at,
    location_types(name),
    partner:partners(partner_tier)
  `)
      .eq('approved', true)


  if (!error && data) {
    //@ts-expect-error LocationRow
    const typedData = data as LocationRow[]

    locations.value = typedData.map((loc: any) => ({
      id: loc.id,
      name: loc.name,
      address: loc.address ?? null,
      position: {lat: loc.lat, lng: loc.lng},
      image: loc.image,
      typeId: loc.type_id,
      type: loc.location_types?.name ?? '',
      view_count: loc.view_count ?? 0,
      partner_tier: Array.isArray(loc.partner) ? loc.partner[0]?.partner_tier : loc.partner?.partner_tier,
      created_at: loc.created_at
    }))
  }

  initMarkers()
  loadingPlaces.value = false
}

const fetchTrendingPlaces = async () => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  
  const { data, error } = await supabase
    .from('activity_log')
    .select('entity_id')
    .eq('entity_type', 'place')
    .in('activity_type', ['explore_place_detail_open', 'explore_place_card_click', 'explore_marker_click'])
    .gte('created_at', yesterday)

  if (!error && data) {
    const counts: Record<string, number> = {}
    data.forEach(log => {
      if (log.entity_id) {
        counts[log.entity_id] = (counts[log.entity_id] || 0) + 1
      }
    })
    
    trendingPlaceIds.value = Object.keys(counts)
      .sort((a, b) => counts[b] - counts[a])
      .map(id => parseInt(id))
  }
}

const categories = computed(() => locationTypes.value)

const activeCategoryIds = ref<number[]>([])

const toggleCategory = (cat: LocationType) => {
  const index = activeCategoryIds.value.indexOf(cat.id)

  if (index > -1) {
    // remove
    activeCategoryIds.value.splice(index, 1)
  } else {
    // add
    activeCategoryIds.value.push(cat.id)
  }

  ActivityLogService.log("explore_filter_category", {
    category_ids: activeCategoryIds.value,
    category_name: cat.name
  })

  focusedPlaceId.value = null
  if (infoWindow) infoWindow.close()
}


/* ---------------- Map ---------------- */
const initMap = async () => {
  if (mapInstance) return   // guard

  await nextTick()          // wait for Vue render

  const el = document.getElementById('map')
  if (!el) {
    console.warn('[Map] #map not ready yet, retrying...')
    requestAnimationFrame(initMap)
    return
  }

  loading.value = true

  const [{Map}, marker] = await Promise.all([
    mapsLoader.importLibrary('maps'),
    mapsLoader.importLibrary('marker')
  ])

  advancedMarkerLib = marker

  mapInstance = new Map(el, {
    center: DEFAULT_CENTER,
    zoom: 14,
    disableDefaultUI: true,
    mapId: MAP_ID,
    clickableIcons: false
  })

  infoWindow = new google.maps.InfoWindow()
  loading.value = false
}


const initMarkers = (places: Place[] = locations.value) => {
  if (!mapInstance || !advancedMarkerLib) return

  // clear old markers
  markerMap.forEach(m => m.map = null)
  markerMap.clear()

  // clear previous cluster
  if (clusterer) {
    clusterer.clearMarkers()
    clusterer.setMap(null)
    clusterer = null
  }

  const markerArray: google.maps.marker.AdvancedMarkerElement[] = []

  places.forEach((loc) => {
    const iconHTML = createPinElement(loc)

    const marker = new advancedMarkerLib!.AdvancedMarkerElement({
      position: loc.position,
      content: iconHTML,
      title: `${loc.type}: ${loc.name}`
    })

    marker.addListener('click', () => {
      ActivityLogService.log("explore_marker_click", {
        id: loc.id,
        name: loc.name,
        type: loc.type,
        lat: loc.position.lat,
        lng: loc.position.lng
      });

      if (searchQuery.value && !loc.name.toLowerCase().includes(searchQuery.value.toLowerCase())) {
        searchQuery.value = ''
      }
      selectPlace(loc)
    })

    markerMap.set(loc.id, marker)
    markerArray.push(marker)
  })

  // ✅ only cluster when no filter
  if (activeCategoryIds.value.length === 0) {
    clusterer = new MarkerClusterer({
      map: mapInstance!,
      markers: markerArray,
      renderer: carrotRippleClusterRenderer,
      algorithm: new SuperClusterAlgorithm({radius: 80})
    })
  } else {
    // just put markers on map directly
    markerArray.forEach(m => (m.map = mapInstance!))
  }
}

// Final centerOnUser trigger or modal resize logic
// viewMode was removed, so we only need resize logic if general state change occurs, 
// usually IonModal handles its own viewport.

watch(searchQuery, q => {
  if (!q && addressMarker.value) {
    addressMarker.value.map = null
    addressMarker.value = null
  }
})

/* ---------------- Interactions ---------------- */
const selectPlace = (place: Place) => {
  ActivityLogService.log("explore_place_card_click", {
    id: place.id,
    name: place.name,
    type: place.type,
    lat: place.position.lat,
    lng: place.position.lng
  });

  selectedPlace.value = place
  scrollCardIntoView(place.id)

  if (!mapInstance) return

  const currentZoom = mapInstance.getZoom() || 14
  const targetZoom = currentZoom < 16 ? 17 : currentZoom
  
  // Calculate offset to center info card (~100px North)
  const latOffset = 100 * 360 / (256 * Math.pow(2, targetZoom))
  mapInstance.panTo({
    lat: place.position.lat + latOffset,
    lng: place.position.lng
  })
  mapInstance.setZoom(targetZoom)

  const m = markerMap.get(place.id)
  if (m && infoWindow) {
    infoWindow.setContent(buildInfoHtml(place))
    infoWindow.open(mapInstance, m)

    setTimeout(() => {
      applyInfoWindowDarkClass()

      const shareBtn = document.querySelector('.share-btn')
      if (shareBtn) {
        shareBtn.addEventListener('click', () => {
          ActivityLogService.log("explore_share_place", {
            id: place.id,
            name: place.name
          });

          sharePlace({
            name: place.name,
            type: place.type,
            imageUrl: place.image || 'https://placehold.co/200x100',
            lat: place.position.lat,
            lng: place.position.lng
          })
        })
      }

      const navigateBtn = document.querySelector('.navigate-btn')
      if (navigateBtn) {
        navigateBtn.addEventListener('click', () => {
          ActivityLogService.log("explore_navigate_click", {
            id: place.id,
            name: place.name
          });
        })
      }
    }, 50)
  }
}

const initCardObserver = () => {
  if (!contentRef.value) return
  if (cardObserver) cardObserver.disconnect()

  cardObserver = new IntersectionObserver((entries) => {
    if (isProgrammaticScroll) return
    
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
        const id = Number(entry.target.getAttribute('data-id'))
        const p = locations.value.find(l => l.id === id)
        if (p && selectedPlace.value?.id !== p.id) {
          // Sync selective metadata but don't recursive scroll
          selectedPlace.value = p
          if (mapInstance) {
             const currentZoom = mapInstance.getZoom() || 14
             const latOffset = 100 * 360 / (256 * Math.pow(2, currentZoom))
             mapInstance.panTo({
               lat: p.position.lat + latOffset,
               lng: p.position.lng
             })
             const m = markerMap.get(p.id)
             if (m && infoWindow) {
               infoWindow.setContent(buildInfoHtml(p))
               infoWindow.open(mapInstance, m)
               setTimeout(applyInfoWindowDarkClass, 50)
             }
          }
        }
      }
    })
  }, {
    root: contentRef.value,
    threshold: 0.6
  })

  // Observe all current cards
  nextTick(() => {
    const cards = (contentRef.value as HTMLElement)?.querySelectorAll('.modern-location-card')
    cards?.forEach(c => cardObserver?.observe(c))
  })
}

const centerOnUser = async () => {
  await ActivityLogService.log("explore_center_user")

  if (!userLocation.value || !mapInstance) return

  mapInstance.panTo(userLocation.value)

  // Optional: gentle zoom only if far
  const zoom = mapInstance.getZoom() ?? 14
  if (zoom < 16) {
    mapInstance.setZoom(16)
  }
}


const onSearchInput = (event: CustomEvent) => {
  searchQuery.value = (event.detail?.value ?? '') as string

  ActivityLogService.log("explore_search_query", {
    query: searchQuery.value
  });
}

/* ---------------- Derived ---------------- */
const sortedLocations = computed(() => {
  let base = [...locations.value]

  // ✅ filter by category
  if (activeCategoryIds.value.length > 0) {
    base = base.filter(l =>
        l.typeId && activeCategoryIds.value.includes(l.typeId)
    )
  }

  // ✅ search (this already works for all matches)
  const q = searchQuery.value.toLowerCase().trim()

  if (q) {
    base = base.filter(l =>
        l.name.toLowerCase().includes(q) ||
        (l.address && l.address.toLowerCase().includes(q))
    )
  }


  // 🏆 Hybrid Sorting Strategy
  const mapped = base.map(p => {
    const distance = userLocation.value ? getDistanceInKm(p.position) : 999999;
    return { ...p, distance };
  });

  if (sortBy.value === 'nearest') {
    const PROMOTION_RADIUS_KM = 30;
    mapped.sort((a, b) => {
      const aGold = a.partner_tier?.toLowerCase() === 'gold' && a.distance <= PROMOTION_RADIUS_KM;
      const bGold = b.partner_tier?.toLowerCase() === 'gold' && b.distance <= PROMOTION_RADIUS_KM;
      if (aGold && !bGold) return -1;
      if (!aGold && bGold) return 1;
      return a.distance - b.distance;
    });
  } else if (sortBy.value === 'recent') {
    mapped.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  } else if (sortBy.value === 'popular') {
    mapped.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
  } else if (sortBy.value === 'trending') {
    mapped.sort((a, b) => {
      const aIndex = trendingPlaceIds.value.indexOf(a.id);
      const bIndex = trendingPlaceIds.value.indexOf(b.id);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return (b.view_count || 0) - (a.view_count || 0);
    });
  }

  return mapped;
})

watch(sortedLocations, (filtered) => {
  initMarkers(filtered)
})

watch(displayedLocations, () => {
  if (viewMode.value === 'map') {
    initCardObserver()
  }
}, { deep: true })

watch(viewMode, (mode) => {
  if (mode === 'map') {
    initCardObserver()
  } else if (cardObserver) {
    cardObserver.disconnect()
  }
})

/* ---------------- Lifecycle ---------------- */
onMounted(async () => {
  await ActivityLogService.log("explore_page_open")

  await initMap()
  await loadRole()
  fetchLocationTypes()
  await fetchLocations()
  await fetchTrendingPlaces()
  await refreshViewCounts()

  // 🔥 START GPS WATCH HERE
  await startWatchingUserLocation()
  
  if (viewMode.value === 'map') {
    initCardObserver()
  }
})

onUnmounted(() => {
  if (cardObserver) cardObserver.disconnect()
})

let firstEnter = true

onIonViewWillEnter(async () => {
  isPageActive.value = true
  if (firstEnter) {
    firstEnter = false
    return
  }

  await fetchLocations()
  await nextTick()

  if (mapInstance) {
    google.maps.event.trigger(mapInstance, 'resize')
  }

  const focusId = Number(router.currentRoute.value.query.focus)
  if (focusId) {
    const p = locations.value.find(l => l.id === focusId)
    if (p) selectPlace(p)

    router.replace({query: {}}) // 👈 clear focus param
  }
})


onIonViewDidEnter(async () => {
  await refreshViewCounts();  // 👈 refresh again when user returns
});

onIonViewWillLeave(() => {
  isPageActive.value = false
  if (locationWatchId) {
    Geolocation.clearWatch({ id: locationWatchId })
    locationWatchId = null
  }

  hasCenteredInitially = false
  lastStableLoc = null   // 🔥 REQUIRED
})


async function refreshViewCounts() {
  if (locations.value.length === 0) return;

  const ids = locations.value.map(l => l.id);

  const {data: updated, error} = await supabase
      .from("locations")
      .select("id, view_count")
      .in("id", ids);

  if (!error && updated) {
    for (const u of updated) {
      const loc = locations.value.find(l => l.id === u.id);
      if (loc) loc.view_count = u.view_count;
    }
  }
}


/* dark mode InfoWindow sync */
const observer = new MutationObserver(applyInfoWindowDarkClass)
observer.observe(document.documentElement, {attributes: true, attributeFilter: ['class']})

/* ---------------- Navigation ---------------- */
const goToAddPlace = async () => {
  router.push('/explore/add')
}

const goToDetail = async (id: number) => {

  const place = locations.value.find(p => p.id === id)
  if (place) place.view_count = (place.view_count ?? 0) + 1

  ActivityLogService.log("explore_place_detail_open", {
    id,
    name: place?.name || null,
    type: place?.type || null
  });

  router.push(`/place/${id}`);
};

</script>


<style>
:root {
  --explore-top-offset: 0px;
  --explore-card-height: 140px;
}

/*********************************************
 * MAP SECTION
 *********************************************/
#map {
  margin: 0;
  width: 100%;
  height: 45vh;
  border-radius: 0;
  overflow: hidden;
  position: relative;
  z-index: 1;
}

.map-overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
}


/*********************************************
 * GOOGLE MAPS UI OVERRIDES
 *********************************************/
.gm-style {
  font: var(--ion-font-family);
}

.gm-style .gm-style-iw-c {
  color: var(--ion-color-dark);
}

.gm-style .gm-style-iw-c.dark-infowindow {
  color: var(--ion-color-light);
}

button.gm-ui-hover-effect {
  width: 24px !important;
  height: 24px !important;
}

button.gm-ui-hover-effect > span {
  position: absolute;
  left: 1px;
  top: 1px;
  background: var(--ion-color-medium) !important;
  width: 24px !important;
  height: 24px !important;
  margin: 0 !important;
}

/*********************************************
 * MAP PINS
 *********************************************/
.pin-wrapper {
  position: relative;
  width: 34px;
  height: 46px;
  cursor: pointer;
}

.pin {
  position: relative;
  width: 34px;
  height: 46px;
}

.pin-head {
  width: 25px;
  height: 25px;
  background: rgba(255, 255, 255, 0.85); /* Slightly more opaque head */
  border-radius: 50%;
  position: absolute;
  top: 5px;
  left: 4.5px;

  display: flex;
  align-items: center;
  justify-content: center;

  font-size: 14px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  z-index: 2;
}

.pin-body {
  width: 35px;
  height: 35px;
  position: absolute;
  top: 1px;

  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);

  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.ion-palette-dark .pin-head {
  background: rgba(40, 40, 40, 0.9);
  color: #fff;
}

/*********************************************
 * USER LOCATION DOT
 *********************************************/
.user-location-dot {
  position: relative;
  width: 18px;
  height: 18px;
  background: var(--ion-color-carrot);
  border-radius: 50%;
  border: 4px solid white;
  box-shadow: 0 0 0 4px rgba(66, 133, 244, 0.3);
  animation: pulse 1.5s infinite;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-heading-cone {
  position: absolute;
  bottom: 5px; /* Pinned to the center of the dot */
  left: 50%;
  width: 80px;
  height: 80px;
  margin-left: -40px; /* Center horizontally */
  
  /* Soft gradient beam */
  background: radial-gradient(
    circle at 50% 100%, 
    rgba(var(--ion-color-carrot-rgb), 0.6) 0%, 
    rgba(var(--ion-color-carrot-rgb), 0.2) 50%, 
    transparent 80%
  );
  
  /* Wide cone shape */
  clip-path: polygon(50% 100%, 15% 0%, 85% 0%);
  
  transform-origin: 50% 100%;
  transition: transform 0.2s cubic-bezier(0.1, 0, 0.3, 1);
  pointer-events: none;
  z-index: -1;
  opacity: 0.8;
}

.user-heading-cone::after {
  content: '';
  position: absolute;
  top: 0;
  left: -2px;
  width: 4px;
  height: 4px;
  background: white;
  border-radius: 50%;
  box-shadow: 0 0 6px white;
  display: none; /* Keep it clean for now */
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(216, 98, 13, 0.4);
  }
  100% {
    box-shadow: 0 0 0 10px rgba(66, 133, 244, 0);
  }
}

/* =========================
   EXPLORE HEADER & SEARCH
   (Floating Glassmorphism Design)
========================= */
.explore-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  pointer-events: none;
  background: transparent !important;
  box-shadow: none !important;
}

.header-search-toolbar {
  --background: transparent !important;
  --border-width: 0 !important;
  padding-top: var(--ion-safe-area-top, 0);
  background: transparent !important;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px 0;
  pointer-events: auto;
}

.search-explore {
  flex: 1;
  margin: 0;
  --background: var(--ion-background-color) !important;
  --border-radius: 100px;
  --box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  font-weight: 500;
  height: 50px;
  --padding-start: 12px;
  --padding-end: 12px;
  background: var(--ion-background-color) !important;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  --color: var(--ion-color-dark) !important;
  --placeholder-color: var(--ion-color-step-600) !important;
  --icon-color: var(--ion-color-carrot) !important;
  --clear-button-color: var(--ion-color-step-600) !important;
  border: 1px solid rgba(var(--ion-color-dark-rgb), 0.15);
  border-radius: 100px;
}

.header-btn {
  --border-radius: 50%;
  height: 50px;
  width: 50px;
  margin: 0;

  --color: var(--ion-color-carrot);
  flex-shrink: 0;
}

.category-bar-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  pointer-events: auto;
}

.category-bar {
  flex: 1;
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}

.category-bar::-webkit-scrollbar {
  display: none;
}

.modern-category-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--ion-background-color) !important;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: var(--cat-color);
  height: 36px;
  border-radius: 100px;
  padding: 0 14px;
  border: 1px solid rgba(var(--ion-color-dark-rgb), 0.18);
  font-weight: 600;
  font-size: 0.8rem;
  transition: all 0.2s ease;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.modern-category-chip ion-label {
  margin: 0;
}

.modern-category-chip.active {
  background: var(--cat-color) !important;
  color: #ffffff;
  border-color: var(--cat-color);
  box-shadow: 0 4px 12px rgba(6, 182, 212, 0.2);
}

.category-emoji, .category-icon { margin-right: 6px; }



/* =========================
   PREMIUM LOCATION CARDS
========================= */
.modern-location-card {
  margin: 16px 0;
  background: var(--ion-card-background, #ffffff);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0,0,0,0.06);
  border: 1px solid rgba(var(--ion-color-dark-rgb), 0.05);
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
}

.active-card {
  border: 1.5px solid var(--ion-color-carrot);
  box-shadow: 0 0 0 2px var(--ion-color-carrot), 0 8px 25px rgba(234, 113, 10, 0.15);
}

.card-inner {
  display: flex;
  height: var(--explore-card-height);
}

.card-image-section {
  width: 110px;
  height: 100%;
  flex-shrink: 0;
  position: relative;
  background: var(--ion-background-color-step-100, #f0f0f0);
}

.card-image-section img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-info-section {
  flex: 1;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 6px;
  min-width: 0;
}

.info-top .title-text {
  margin: 0 0 4px 0;
  font-size: 1rem;
  font-weight: 850;
  line-height: 1.25;
  color: var(--ion-color-dark);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.metas {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--ion-color-medium);
  opacity: 0.8;
}

.meta-dot { font-size: 1rem; opacity: 0.5; }

.info-bottom {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.distance {
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--ion-color-medium);
}

.action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-left: -12px; /* Pull button to align text */
  margin-top: 4px;
}

/* =========================
   PARTNER TIERS (EXPLORE)
========================= */
/* Partner Tiers (Explore) */
.modern-location-card {
  --tier-bg: var(--ion-background-color, #ffffff);
  --tier-border: rgba(var(--ion-color-dark-rgb), 0.05);
  background: var(--tier-bg) !important;
  border-color: var(--tier-border) !important;
  overflow: hidden;
}

.modern-location-card.tier-gold {
  --tier-bg: var(--tier-gold-bg);
  --tier-border: #facc15;
}

.modern-location-card.tier-silver {
  --tier-bg: var(--tier-silver-bg);
  --tier-border: #cbd5e1;
}

.modern-location-card.tier-bronze {
  --tier-bg: var(--tier-bronze-bg);
  --tier-border: #fed7aa;
}

/* Dark Mode Overrides */






/* Tier Badges (below) */

.tier-header { margin-bottom: 6px; display: flex; }

.tier-badge {
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 0.55rem;
  font-weight: 900;
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
  gap: 3px;
  color: #fff;
}

.tier-badge.gold { background: linear-gradient(135deg, #facc15 0%, #ca8a04 100%); color: #422006; }
.tier-badge.silver { background: linear-gradient(135deg, #cbd5e1 0%, #64748b 100%); color: #0f172a; }
.tier-badge.bronze { background: linear-gradient(135deg, #d97706 0%, #78350f 100%); color: #fff; }

.premium-verified {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 0.65rem;
  font-weight: 900;
  width: 130px; /* Fixed width for consistency */
  height: 30px;
  border-radius: 10px;
  letter-spacing: 0.02em;
  background: rgba(var(--ion-color-dark-rgb), 0.05);
  flex-shrink: 0;
}

.tier-gold .premium-verified { color: #ca8a04; background: rgba(202, 138, 4, 0.1); }
.tier-silver .premium-verified { color: #64748b; background: rgba(100, 116, 139, 0.1); }
.tier-bronze .premium-verified { color: #d97706; background: rgba(217, 119, 6, 0.1); }

/* Metallic Flare */
.premium-flare {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    110deg,
    transparent 30%,
    rgba(255, 255, 255, 0) 35%,
    rgba(255, 255, 255, 0.45) 50%,
    rgba(255, 255, 255, 0) 65%,
    transparent 70%
  );
  animation: shine-flare 5s infinite cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
  z-index: 10;
}

@keyframes shine-flare {
  0% { transform: translateX(0); }
  25% { transform: translateX(300%); }
  100% { transform: translateX(300%); }
}

/* FLOATING RESULTS BAR (HORIZONTAL SLIDER) */
.floating-results-bar {
  position: absolute;
  bottom: calc(var(--ion-safe-area-bottom, 0px) + 8px); /* Lowered position */
  left: 0;
  right: 0;
  z-index: 1000;
  pointer-events: none;
}

.horizontal-scroll-wrapper {
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 6px 0 6px;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  pointer-events: auto;
  scrollbar-width: none;
}

.horizontal-scroll-wrapper::-webkit-scrollbar {
  display: none;
}

.cards-track {
  display: flex;
  padding: 0 16px;
  gap: 12px;
}

.modern-location-card {
  flex: 0 0 85vw;
  max-width: 380px;
  margin: 0;
  background: rgba(var(--ion-card-background-rgb, 255, 255, 255), 0.7); /* Glass base */
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
  border: 1px solid rgba(255, 255, 255, 0.3); /* Glass border */
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  position: relative;
  scroll-snap-align: center;
  scroll-snap-stop: always;
}

.modern-location-card {
  flex: 0 0 85vw;
  max-width: 380px;
  margin: 0;
  /* Light Mode Base - higher opacity for text readability */
  background: rgba(255, 255, 255, 0.85); 
  backdrop-filter: blur(25px) saturate(200%);
  -webkit-backdrop-filter: blur(25px) saturate(200%);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
  border: 1px solid rgba(255, 255, 255, 0.5);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  position: relative;
  scroll-snap-align: center;
  scroll-snap-stop: always;
}

/* Dark Mode Base Case */
.ion-palette-dark .modern-location-card {
  background: rgba(28, 28, 30, 0.92); /* Higher opacity for better contrast */
  border: 1px solid rgba(255, 255, 255, 0.15);
}

@media (min-width: 768px) {
  .modern-location-card {
    flex: 0 0 350px;
  }
}

.card-inner {
  display: flex;
  height: var(--explore-card-height); 
}

.card-image-section {
  width: 110px;
  height: 100%;
  flex-shrink: 0;
  position: relative;
  background: var(--ion-background-color-step-100, #f0f0f0);
}

.card-image-section img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.floating-tier-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 5;
}

.tier-pill {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.65rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 4px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.tier-pill.gold { background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%); color: #451a03; }
.tier-pill.silver { background: linear-gradient(135deg, #94a3b8 0%, #475569 100%); color: #f8fafc; }
.tier-pill.bronze { background: linear-gradient(135deg, #b45309 0%, #78350f 100%); color: #fff; }

.card-info-section {
  flex: 1;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0; 
}

.title-text {
  margin: 0 0 4px 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--ion-color-dark);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.verified-badge {
  color: #3897f0; /* Instagram Blue */
  font-size: 1rem;
  filter: drop-shadow(0 0 2px rgba(56, 151, 240, 0.3));
  flex-shrink: 0;
  vertical-align: middle;
}

.metas {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 2px;
}

.meta {
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--ion-color-step-600, #666);
  white-space: nowrap;
  display: flex;
  align-items: center;
}

.ion-palette-dark .meta { color: #d1d5db; }

.meta-dot { opacity: 0.5; }

.distance {
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--ion-color-carrot);
  margin-top: 2px;
}

.info-actions {
  margin-top: auto;
}

.action-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.detail-btn {
  --padding-start: 12px;
  --padding-end: 12px;
  height: 32px;
  font-size: 0.8rem;
  font-weight: 800;
  background: rgba(var(--ion-color-carrot-rgb), 0.15);
  border-radius: 12px;
  margin: 0;
  letter-spacing: 0.05em;
}

.ion-palette-dark .detail-btn {
  --background: var(--ion-color-carrot);
  --color: #ffffff;
}

/* Tier Specific Overrides - ensure contrast in both modes */
.modern-location-card.tier-gold {
  background: linear-gradient(135deg, rgba(255, 251, 235, 0.9) 0%, rgba(254, 243, 199, 0.9) 100%) !important;
  border-color: rgba(251, 191, 36, 0.45) !important;
}
.modern-location-card.tier-gold .title-text { color: #451a03; }
.modern-location-card.tier-gold .meta { color: #713f12; }

/* Tiered Dark Mode Overrides */
.ion-palette-dark .modern-location-card.tier-gold {
  background: linear-gradient(135deg, rgba(66, 32, 6, 0.5) 0%, rgba(28, 28, 30, 0.8) 100%) !important;
  border-color: rgba(251, 191, 36, 0.3) !important;
}
.ion-palette-dark .modern-location-card.tier-gold .title-text { color: #fef3c7; }
.ion-palette-dark .modern-location-card.tier-gold .meta { color: #fde68a; }

.modern-location-card.tier-silver {
  background: linear-gradient(135deg, rgba(248, 250, 252, 0.9) 0%, rgba(226, 232, 240, 0.9) 100%) !important;
  border-color: rgba(148, 163, 184, 0.4) !important;
}
.modern-location-card.tier-silver .title-text { color: #0f172a; }

.modern-location-card.tier-bronze {
  background: linear-gradient(135deg, rgba(255, 251, 235, 0.9) 0%, rgba(255, 237, 213, 0.9) 100%) !important;
  border-color: rgba(180, 83, 9, 0.4) !important;
}
.modern-location-card.tier-bronze .title-text { color: #431407; }

/* Metallic Flare Animation */
.premium-flare {
  position: absolute;
  top: 0;
  left: -150%;
  width: 150%;
  height: 100%;
  background: linear-gradient(
    110deg,
    transparent 40%,
    rgba(255, 255, 255, 0.6) 50%,
    transparent 60%
  );
  animation: shine-flare 5s infinite cubic-bezier(0.42, 0, 0.58, 1);
  pointer-events: none;
  z-index: 10;
}

@keyframes shine-flare {
  0% { transform: translateX(0); }
  25% { transform: translateX(250%); }
  100% { transform: translateX(250%); }
}

.ion-palette-dark .premium-flare {
  background: linear-gradient(
    110deg,
    transparent 40%,
    rgba(255, 255, 255, 0.25) 50%,
    transparent 60%
  );
}

/* =========================
   NEW UI ELEMENTS (MODE TOGGLE & FAB)
========================= */
.map-floating-actions {
  position: absolute;
  bottom: calc(var(--ion-safe-area-bottom, 0px) + var(--explore-card-height) + 40px);
  right: 20px;
  z-index: 1001;
  pointer-events: auto;
}

.locate-me-btn {
  --color: var(--ion-color-carrot);
  --border-radius: 50%;
  width: 48px;
  height: 48px;
}

.list-view-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 800;
  background: var(--ion-background-color);
  padding-top: 140px; /* Below search/filters */
  overflow-y: auto;
}

.list-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 16px 100px;
}

.list-header {
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(var(--ion-color-dark-rgb), 0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sort-btn-simple {
  --padding-start: 8px;
  --padding-end: 8px;
  height: 32px;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ion-color-medium);
  margin: 0;
}

.sort-btn-simple ion-icon {
  color: var(--ion-color-carrot);
  font-size: 18px;
}

.list-header h3 {
  font-size: 1.4rem;
  font-weight: 800;
  margin: 0;
  color: var(--ion-color-dark);
}

.vertical-cards-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.list-mode-card {
  flex: none !important;
  max-width: none !important;
  width: 100% !important;
}

.map-dimmed {
  filter: grayscale(0.5) blur(2px);
  opacity: 0.8;
}

/* Transitions */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(30px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(30px);
}

.empty-state {
  padding: 60px 20px;
  text-align: center;
  color: var(--ion-color-medium);
}

.empty-state ion-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.3;
}

/* =========================
   VIEW MODE SWITCH (BASE)
========================= */
.view-mode-switch {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  justify-content: center;

  padding: 6px;
  border-radius: 14px;
  background: var(--ion-background-color);

  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

  /* animation consistency */
  transition: transform 0.25s ease,
  opacity 0.2s ease;
}

/* =========================
   FLOATING (Map / Both)
========================= */
.view-mode-switch.floating {
  position: fixed;
  top: 150px; /* Below the search/category header */
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000; /* Above header */
}

/* =========================
   INLINE (List)
========================= */
.view-mode-switch.inline {
  position: relative;
  display: flex;
  justify-content: center;
  margin-bottom: 8px;

  background: transparent;
  box-shadow: none;
}

.view-mode-switch {
  will-change: transform, opacity;
}

.view-mode-fab {
  bottom: 92px; /* above tab bar */
  left: 12px;
  z-index: 30;
}

/* shrink FAB list spacing */
.view-mode-fab ion-fab-list {
  margin-bottom: 6px;
}

/* shared base */
.fab-right,
.view-mode-fab {
  position: fixed;
  z-index: 30;
  transition: bottom 0.35s cubic-bezier(.25, .8, .25, 1);
}

/* left FAB horizontal offset */
.view-mode-fab {
  left: 12px;
}

/* right FAB offset */
.fab-right {
  right: 20px;
}

/* MAP ONLY */
.fab-right.map,
.view-mode-fab.map {
  bottom: 5vh; /* above tab bar */
}

/* BOTH — panel collapsed */
.fab-right.panel-collapsed,
.view-mode-fab.panel-collapsed {
  bottom: 26vh;
}

/* BOTH — panel open */
.fab-right.panel-open,
.view-mode-fab.panel-open {
  bottom: 62vh;
}

.clear-chip {
  --background: rgba(255,255,255,0.08);
  --color: var(--ion-color-carrot);
  border: 1px dashed var(--ion-color-medium);
  border-radius: 100px;
  font-weight: 700;
  width: auto;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 38px;
  padding: 0 16px;
  margin: 0;
  background: var(--ion-background-color) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.floating-clear {
  border: 1px solid var(--ion-color-carrot) !important;
  color: var(--ion-color-carrot) !important;
  margin-left: 0;
  flex-shrink: 0;
}



</style>

<style>
/* Force readable text colors for tiered cards in dark mode */

/* Force readable text colors for tiered cards in dark mode */
.ion-palette-dark .modern-location-card.tier-gold .title-text,
.ion-palette-dark .modern-location-card.tier-silver .title-text,
.ion-palette-dark .modern-location-card.tier-bronze .title-text {
  color: #ffffff !important;
}
</style>