<template>
  <ion-page>
   <ion-header class="ion-no-border immersive-header" :class="{ 'is-scrolled': isScrolled }">
       <app-header
           :title="$t('explore.details.title')"
           show-back
           :useRouterBack="true"
           :backRoute="'/explore'"
           :icon="mapOutline"
           :transparent="!isScrolled"
           :contrast="!isScrolled"
       >
         <template #actions>
           <ion-item v-if="canEdit" button @click="editItem" lines="none">
             <ion-icon :icon="createOutline" slot="start"/>
             <ion-label>{{ $t('search.details.edit') }}</ion-label>
           </ion-item>

           <ion-item button @click="reportItem" lines="none">
             <ion-icon :icon="alertCircleOutline" slot="start"/>
             <ion-label>{{ $t('search.details.report') }}</ion-label>
           </ion-item>

           <ion-item button @click="share" lines="none">
             <ion-icon :icon="shareSocialOutline" slot="start"/>
             <ion-label>{{ $t('search.details.share') }}</ion-label>
           </ion-item>

           <ion-item v-if="isLoggedIn" button @click="openSaveModal" lines="none">
             <ion-icon :icon="isLocationSaved(place?.id || 0) ? bookmark : bookmarkOutline" slot="start" :color="isLocationSaved(place?.id || 0) ? 'carrot' : ''" />
             <ion-label>{{ isLocationSaved(place?.id || 0) ? $t('savedLocations.saved') || 'Saved' : $t('savedLocations.save') || 'Save Location' }}</ion-label>
           </ion-item>
         </template>
       </app-header>
     </ion-header>

    <ion-content :scroll-events="true" @ionScroll="handleScroll" fullscreen>
      <div v-if="!loading && place">
        <!-- 🖼️ Image carousel (Swiper) -->
        <Swiper
            v-if="place.image"
            :modules="modules"
            :zoom="true"
            :slides-per-view="1"
            :pagination="{ clickable: true }"
            class="place-swiper"
        >
          <SwiperSlide>
            <img
                :src="place?.image || 'https://placehold.co/100x100'"
                alt="Place image"
                style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;"
                @click="openImageModal"
            />
          </SwiperSlide>
        </Swiper>

        <!-- 📍 Location Info Section -->
        <div 
          :class="[
            'details-container', 
            place?.partner_tier ? 'tier-' + place.partner_tier.toLowerCase() : ''
          ]"
        >
          <!-- Premium Flare for Gold/Silver -->
          <div v-if="['gold', 'silver'].includes(String(place?.partner_tier || '').toLowerCase())" class="premium-flare"></div>

          <div class="ion-padding" style="position: relative; z-index: 2;">
            <div class="title-row">
              <h2 class="product-title">{{ place?.name }}</h2>
              <div v-if="place?.partner_tier" class="premium-badge-wrapper">
                <div :class="['premium-badge-pill', place.partner_tier.toLowerCase()]">
                  <ion-icon :icon="sparkles" />
                  <span>{{ place.partner_tier.toUpperCase() }}</span>
                </div>
              </div>
            </div>

            <div class="status-action-row">
              <ion-chip color="carrot" class="capitalize">{{ place?.type }}</ion-chip>
              <div v-if="place?.partner_tier" class="official-verified-tag">
                <ion-icon :icon="shieldCheckmarkOutline" />
                <span>OFFICIAL PARTNER</span>
              </div>
            </div>

            <!-- 🏷️ Location Tags -->
            <div v-if="place.tags?.length" class="hashtag-row">
              <span v-for="tag in place.tags" :key="tag" class="location-hashtag">
                #{{ tag }}
              </span>
            </div>

            <!-- 📢 Important Notice (Read Description) -->
            <div
                v-if="place.description && isMuslimFriendly"
                class="description-notice-banner"
                :class="{ 'is-muslim-friendly': isMuslimFriendly }"
                @click="scrollToDescription"
            >
              <div class="notice-icon-wrapper">
                <ion-icon :icon="isMuslimFriendly ? alertCircle : informationCircle" />
              </div>
              <div class="notice-text-content">
                <div class="notice-title">{{ $t('explore.details.noticeTitle') }}</div>
                <div class="notice-message">{{ $t('explore.details.readDescriptionNotice') }}</div>
              </div>
              <ion-icon :icon="chevronDown" class="notice-arrow" />
            </div>

            <p v-if="place?.author?.public_profile" class="attribution-text">
              {{ $t('home.addedBy', { author: place.author.display_name }) }} - {{ fromNowToTaipei(place.created_at) }}
            </p>
            <p v-else class="attribution-text">
              {{ $t('home.added') }} {{ fromNowToTaipei(place.created_at) }}
            </p>

            <!-- Certified By (Gold Partner) -->
            <div
                v-if="!loadingCertifications && certifications.length"
                class="ion-margin-top"
            >
              <p class="section-title">
                <strong><small>Certified by</small></strong>
              </p>

              <div
                  v-for="c in certifications"
                  :key="c.partner.id"
                  class="gold-cert-card"
                  role="button"
                  tabindex="0"
                  @click="goToPartner(c.partner.id)"
              >
                <div class="gold-glow"></div>

                <div class="gold-cert-content">
                  <div class="gold-cert-left">
                    <img
                        v-if="c.partner.logo_url"
                        :src="c.partner.logo_url"
                        alt="logo"
                        class="gold-cert-logo"
                    />

                    <div class="gold-cert-text">
                      <div class="gold-cert-name">
                        {{ c.partner.name }}
                      </div>
                      <div class="premium-verified-tag">
                        <ion-icon :icon="sparkles" />
                        Verified Gold Partner
                      </div>
                    </div>
                  </div>

                  <!-- RIGHT SIDE ACTION -->
                  <ion-button
                      v-if="c.proof_url"
                      fill="clear"
                      size="small"
                      color="carrot"
                      @click.stop
                      :href="c.proof_url"
                      target="_blank"
                      aria-label="View certificate"
                  >
                    <ion-icon slot="icon-only" :icon="documentTextOutline" />
                  </ion-button>
                </div>
              </div>
            </div>


            <!-- 📝 Description -->
            <template v-if="place.description">
              <ion-item lines="none" id="place-description-section">
                <ion-icon :icon="documentTextOutline" slot="start" color="carrot"/>

                <ion-label>
                  <p class="text-sm text-gray-500">
                    {{ isMuslimFriendly ? $t('explore.details.handlingDetails') : $t('search.details.description') }}
                  </p>
                  <p style="white-space: pre-line;">
                   {{ place.description }}
                  </p>
                </ion-label>
              </ion-item>
            </template>


            <!-- 📍 Address -->
            <ion-item lines="none">
              <ion-icon :icon="navigateOutline" slot="start" color="carrot"/>

              <ion-label>
                <p class="text-sm text-gray-500">Address</p>
                <p>{{ place.address || 'No address available' }}</p>
              </ion-label>

              <ion-button
                  fill="clear"
                  size="small"
                  color="carrot"
                  @click="logOpenMaps"
                  :href="`https://www.google.com/maps/search/?api=1&query=${mapSearchQuery}&center=${place.lat},${place.lng}&zoom=16`"
                  target="_blank"
              >
                Open
              </ion-button>
            </ion-item>


            <!-- 🗺️ Interactive Map -->
            <div class="rounded-xl overflow-hidden ion-margin-vertical shadow-md detail-map-container">
              <div id="detail-map" class="detail-map"></div>
            </div>

            <!-- ⭐ Additional Details -->
            <div class="ion-margin-vertical">
              <!-- 🕒 Opening Hours -->
              <template v-if="place.opening_hours">
                <div class="ion-margin-top ion-margin-bottom">
                  <h3 class="font-bold text-lg">Opening Hours</h3>
                  <div class="open-status-badge" :class="{ open: isOpenNow, closed: !isOpenNow }">
                    {{ isOpenNow ? 'Open Now' : 'Closed Now' }}
                  </div>
                </div>

                <ion-list>
                  <ion-item v-for="(value, day) in formattedOpeningHours" :key="day" :class="{ 'today-highlight': day === todayDayLabel }">
                    <ion-label class="capitalize">{{ day }}</ion-label>
                    <ion-label slot="end" class="ion-text-right">
            <span v-if="value.active">
              {{ value.open }} – {{ value.close }}
            </span>
                      <span v-else class="text-gray-400">Closed</span>
                    </ion-label>
                  </ion-item>
                </ion-list>
              </template>

              <!-- 📞 Contact Info -->
              <template v-if="place.phone || place.instagram || place.line_id">
                <h3 class="font-bold text-lg ion-margin-top">Additional Details</h3>

                <ion-item lines="none" v-if="place.phone">
                  <ion-icon :icon="callOutline" slot="start" color="carrot"/>
                  <ion-label>
                    <p class="text-sm text-gray-500">Phone</p>
                    <p>{{ place.phone }}</p>
                  </ion-label>

                  <ion-button
                      fill="clear"
                      color="carrot"
                      @click="logCall"
                      :href="`tel:${place.phone}`"
                  >
                    Call
                  </ion-button>
                </ion-item>


                <ion-item lines="none" v-if="place.instagram">
                  <ion-icon :icon="logoInstagram" slot="start" color="carrot"/>
                  <ion-label>
                    <p class="text-sm text-gray-500">Instagram</p>
                    <p>@{{ place.instagram.replace('@', '') }}</p>
                  </ion-label>
                  <ion-button
                      fill="clear"
                      size="small"
                      @click="logInstagram"
                      :href="`https://instagram.com/${place.instagram.replace('@','')}`"
                      target="_blank">
                    Open
                  </ion-button>
                </ion-item>

                <ion-item lines="none" v-if="place.line_id">
                  <ion-icon :icon="chatboxEllipsesOutline" slot="start" color="carrot"/>
                  <ion-label>
                    <p class="text-sm text-gray-500">LINE ID</p>
                    <p>{{ place.line_id }}</p>
                  </ion-label>

                  <ion-button
                      fill="clear"
                      size="small"
                      @click="logLine"
                      :href="`line://ti/p/~${place.line_id}`">
                    Open
                  </ion-button>

                </ion-item>

              </template>

              <!-- 💰 Price Range -->
              <template v-if="place.price_range">
                <ion-item lines="none">
                  <ion-icon :icon="cashOutline" slot="start" color="carrot"/>
                  <ion-label>
                    <p class="text-sm text-gray-500">Estimated Price</p>
                    <p>{{ place.price_range }}</p>
                  </ion-label>
                </ion-item>
              </template>

            </div>
          </div>
        </div>
      </div>

      <!-- Skeleton while loading -->
      <div v-else>
        <ion-skeleton-text
            animated
            style="width:100%;height:300px;margin-bottom:12px;"
        />
        <ion-skeleton-text animated style="width:80%;height:20px;margin-bottom:8px;"/>
        <ion-skeleton-text animated style="width:60%;height:16px;margin-bottom:8px;"/>
      </div>
    </ion-content>

    <!-- 🟢 Fullscreen image modal -->
    <ion-modal :is-open="showImageModal" @didDismiss="closeImageModal">
      <ion-content fullscreen>
        <ion-button
            fill="solid"
            color="carrot"
            class="image-modal-close-btn"
            @click="closeImageModal"
        >
          ✕
        </ion-button>

        <Swiper
            :modules="[Zoom]"
            :zoom="true"
            :slides-per-view="1"
            class="fullscreen-swiper"
        >
          <SwiperSlide>
            <div class="swiper-zoom-container">
              <img :src="place?.image || 'https://placehold.co/200x100'" alt="Place Image"/>
            </div>
          </SwiperSlide>
        </Swiper>
      </ion-content>
    </ion-modal>

    <!-- Save Location Modal -->
    <SaveLocationModal
      :is-open="showSaveLocationModal"
      :location-id="place?.id || 0"
      :location-name="place?.name || ''"
      @close="showSaveLocationModal = false"
      @saved="checkSavedState(place?.id || 0)"
    />
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage,
  IonContent,
  IonSkeletonText,
  IonIcon,
  IonItem,
  IonLabel,
  IonModal,
  IonButton, IonHeader, IonChip,
  IonList,
  popoverController
} from '@ionic/vue'
import {ref, onMounted, computed, nextTick} from 'vue'
import {useI18n} from 'vue-i18n'
import {onIonViewWillEnter} from '@ionic/vue'
import {useRoute, useRouter} from 'vue-router'
import {supabase} from '@/plugins/supabaseClient'
import {Share} from '@capacitor/share'
import {Swiper, SwiperSlide} from 'swiper/vue'
import {Pagination, Zoom} from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/pagination'
import 'swiper/css/zoom'
import AppHeader from '@/components/AppHeader.vue'
import {
  alertCircle, informationCircle, chevronDown,
  alertCircleOutline, callOutline, cashOutline, chatboxEllipsesOutline,
  createOutline, documentTextOutline, logoInstagram,
  mapOutline,
  navigateOutline,
  shareSocialOutline,
  sparkles,
  shieldCheckmarkOutline,
  bookmarkOutline,
  bookmark
} from 'ionicons/icons'
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

function fromNowToTaipei(dateString?: string) {
  if (!dateString) return ''
  return dayjs.utc(dateString).tz('Asia/Taipei').fromNow()
}

import {ActivityLogService} from "@/services/ActivityLogService";
import { useSavedLocations } from '@/composables/useSavedLocations';
import SaveLocationModal from '@/components/SaveLocationModal.vue';
import mapsLoader from '@/plugins/googleMapsLoader'
import { useLocation } from '@/composables/useLocation'

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"

type OpeningHours = {
  [key: string]: {
    active: boolean
    open: string
    close: string
  }
}

type PlaceDetail = {
  id: number
  name: string
  lat: number
  lng: number
  image?: string | null
  address?: string | null
  description?: string | null
  type: string
  location_types: { name: string } | null
  phone?: string | null
  instagram?: string | null
  line_id?: string | null
  price_range?: string | null
  opening_hours?: OpeningHours | null
  created_at?: string
  author?: {
    display_name: string | null;
    public_profile: boolean;
  } | null;
  partner_tier?: 'Gold' | 'Silver' | 'Bronze' | null;
  approved?: boolean;
  tags?: string[] | null;
}

type LocationCertification = {
  certified_at: string | null
  proof_url?: string | null
  partner: {
    id: string
    name: string
    logo_url: string | null
    partner_tier: 'gold' | 'silver' | 'bronze' | null
    verified: boolean
  }
}


const certifications = ref<LocationCertification[]>([])
const loadingCertifications = ref(false)

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const place = ref<PlaceDetail | null>(null)
const canEdit = ref(false)
const modules = [Pagination, Zoom]
const isLoggedIn = ref(false)

// Saved Locations
const { isLocationSaved, checkSavedState } = useSavedLocations()
const showSaveLocationModal = ref(false)

const isScrolled = ref(false)
const handleScroll = (ev: any) => {
  isScrolled.value = ev.detail.scrollTop > 80
}

const showImageModal = ref(false)

function openImageModal() {
  if (place.value) {
    ActivityLogService.log("explore_detail_open_image", {
      id: place.value.id,
      name: place.value.name
    });
  }
  showImageModal.value = true
}

function openSaveModal() {
  if (!place.value) return
  showSaveLocationModal.value = true
  ActivityLogService.log("location_save_click", {
    location_id: place.value.id,
    location_name: place.value.name,
    source: "place_details"
  })
}

function closeImageModal() {
  showImageModal.value = false
}

const loading = ref(true)

/* ---------------- Map State ---------------- */
let mapInstance: google.maps.Map | null = null
let placeMarker: google.maps.marker.AdvancedMarkerElement | null = null
let userMarker: google.maps.marker.AdvancedMarkerElement | null = null
let advancedMarkerLib: typeof google.maps.marker | null = null
const { userLocation } = useLocation()

const MAP_ID = '6d203f1adb514723' // Same as ExploreView

const initMap = async () => {
  if (!place.value) return
  
  await nextTick()
  
  const el = document.getElementById('detail-map')
  if (!el) {
    console.warn('[Map] #detail-map not ready yet, retrying...')
    requestAnimationFrame(initMap)
    return
  }
  
  const [{Map}, marker] = await Promise.all([
    mapsLoader.importLibrary('maps'),
    mapsLoader.importLibrary('marker')
  ])
  advancedMarkerLib = marker
  
  const center = { lat: place.value.lat, lng: place.value.lng }
  
  mapInstance = new Map(el, {
    center,
    zoom: 16,
    disableDefaultUI: true,
    mapId: MAP_ID,
    clickableIcons: false
  })
  
  // Create place marker with custom pin element
  const pinElement = document.createElement('div')
  pinElement.className = 'place-marker-pin'
  pinElement.innerHTML = `
    <svg viewBox="0 0 24 24" width="36" height="36" fill="var(--ion-color-carrot, #ff9800)">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  `
  
  placeMarker = new marker.AdvancedMarkerElement({
    position: center,
    map: mapInstance,
    content: pinElement,
    title: place.value.name
  })
  
  // Add user location marker if available
  if (userLocation.value) {
    const dot = document.createElement('div')
    dot.className = 'user-location-dot'
    
    userMarker = new marker.AdvancedMarkerElement({
      position: { lat: userLocation.value.lat, lng: userLocation.value.lng },
      map: mapInstance,
      content: dot,
      title: 'Your Location'
    })
  }
}

const formattedOpeningHours = computed(() => {
  if (!place.value?.opening_hours) return {}

  // Check if opening_hours is in Google Places format (with periods)
  const hours = place.value.opening_hours as any
  if (hours.periods && Array.isArray(hours.periods)) {
    const dayMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
    const labels = {
      sun: "Sun",
      mon: "Mon",
      tue: "Tue",
      wed: "Wed",
      thu: "Thu",
      fri: "Fri",
      sat: "Sat",
    }

    const result: any = {}
    
    // Initialize all days as closed
    dayMap.forEach(day => {
      result[labels[day as keyof typeof labels]] = { active: false, open: '', close: '' }
    })

    // Process periods
    hours.periods.forEach((period: any) => {
      const dayKey = dayMap[period.open.day] as keyof typeof labels
      const openTime = period.open.time.replace(':', '')
      const closeTime = period.close.time.replace(':', '')
      
      // Format time from HHMM to HH:MM
      const formatTime = (time: string) => {
        if (time.length === 4) {
          return `${time.substring(0, 2)}:${time.substring(2, 4)}`
        }
        return time
      }

      result[labels[dayKey]] = {
        active: true,
        open: formatTime(openTime),
        close: formatTime(closeTime)
      }
    })

    return result
  }

  // Original format (day keys with active/open/close)
  const order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
  const labels = {
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
    sun: "Sun",
  }

  const result: any = {}
  order.forEach(day => {
    const key = day as DayKey
    if (place.value?.opening_hours?.[key]) {
      result[labels[key]] = place.value.opening_hours[key]
    }
  })

  return result
})

const isOpenNow = computed(() => {
  if (!place.value?.opening_hours) return false
  
  const hours = place.value.opening_hours as any
  
  // Check if opening_hours is in Google Places format (with periods)
  if (hours.periods && Array.isArray(hours.periods)) {
    const now = dayjs().tz('Asia/Taipei')
    const currentDay = now.day() // 0 = Sunday, 1 = Monday, etc.
    const currentTime = now.format('HHmm')
    
    for (const period of hours.periods) {
      // Skip malformed periods (same validation as ExploreView)
      if (!period?.open || !period?.close) continue
      if (typeof period.open.day !== 'number' || typeof period.close.day !== 'number') continue
      if (typeof period.open.time !== 'string' || typeof period.close.time !== 'string') continue
      
      const openDay = period.open.day
      const closeDay = period.close.day
      const openTime = period.open.time.replace(':', '')
      const closeTime = period.close.time.replace(':', '')
      
      // Handle same day opening
      if (openDay === currentDay && closeDay === currentDay) {
        if (currentTime >= openTime && currentTime <= closeTime) {
          return true
        }
      }
      // Handle overnight (e.g., opens Monday, closes Tuesday)
      else if (openDay === currentDay && closeDay !== currentDay) {
        if (currentTime >= openTime) {
          return true
        }
      }
      else if (closeDay === currentDay && openDay !== currentDay) {
        if (currentTime <= closeTime) {
          return true
        }
      }
    }
    
    return false
  }
  
  // Original format - check if current day is active and within time range
  const now = dayjs().tz('Asia/Taipei')
  const currentDay = now.day()
  const currentTime = now.format('HH:mm')
  const dayMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
  const currentDayKey = dayMap[currentDay] as DayKey
  
  const todayHours = hours[currentDayKey]
  if (!todayHours || !todayHours.active) return false
  
  return currentTime >= todayHours.open && currentTime <= todayHours.close
})

const todayDayLabel = computed(() => {
  const now = dayjs().tz('Asia/Taipei')
  const currentDay = now.day()
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  return labels[currentDay]
})

const mapSearchQuery = computed(() => {
  if (!place.value) return ''
  const name = place.value.name
  const address = place.value.address || ''
  return encodeURIComponent(`${name} ${address}`.trim())
})


const loadPlace = async () => {
  loading.value = true

  const {data, error} = await supabase
      .from('locations')
      .select(`
    id,
    name,
    lat,
    lng,
    image,
    address,
    description,
    created_by,
    phone,
    instagram,
    line_id,
    price_range,
    opening_hours,
    created_at,
    approved,
    tags,
    location_types(name),
    partner:partners(partner_tier)
  `)
      .eq('id', route.params.id)
      .maybeSingle()

  if (error) {
    console.error(error)
    return
  }

  if (data) {
    const locationType = Array.isArray(data.location_types)
        ? data.location_types[0]
        : data.location_types

    place.value = {
      id: data.id,
      name: data.name,
      image: data.image,
      type: locationType?.name ?? 'Halal Location',
      lat: data.lat,
      lng: data.lng,
      address: data.address,
      description: data.description,
      phone: data.phone,
      instagram: data.instagram,
      line_id: data.line_id,
      price_range: data.price_range,
      opening_hours: data.opening_hours,
      created_at: data.created_at,
      approved: data.approved,
      author: null,
      location_types: locationType ?? null,
      tags: data.tags ?? [],
      partner_tier: Array.isArray(data.partner) ? data.partner[0]?.partner_tier : (data.partner as any)?.partner_tier
    }

    // 🔹 Fetch author details separately since join is missing in schema
    if (data.created_by) {
      const { data: authorData } = await supabase
        .from('user_profiles')
        .select('display_name, public_profile')
        .eq('id', data.created_by)
        .maybeSingle()
      
      if (authorData && place.value) {
        place.value.author = authorData
      }
    }

    await fetchLocationCertifications(data.id)


    // 🔹 Check if the current user can edit
    const {data: {user}} = await supabase.auth.getUser()
    if (user) {
      isLoggedIn.value = true
      // Check if user is the creator or an admin/contributor
      const {data: roleData} = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single()

      if (
          user.id === data.created_by ||
          roleData?.role === 'admin' ||
          roleData?.role === 'contributor'
      ) {
        canEdit.value = true
      }
    }

    await ActivityLogService.log("explore_place_detail_view", {
      id: data.id,
      name: data.name,
      type: locationType?.name ?? null
    });
  }

  loading.value = false
  
  // Initialize map after data is loaded
  initMap()
}

async function fetchLocationCertifications(locationId: number) {
  loadingCertifications.value = true

  const { data, error } = await supabase
      .from('location_certifications')
      .select(`
    certified_at,
    proof_url,
    partners:partner_id (
      id,
      name,
      logo_url,
      partner_tier,
      verified
    )
  `)
      .eq('location_id', locationId)
      .eq('status', 'active')



  if (!error && data) {
    certifications.value = data
        .map(c => {
          const body = Array.isArray(c.partners)
              ? c.partners[0]
              : c.partners

          if (!body) return null

          return {
            certified_at: c.certified_at ?? null,
            proof_url: c.proof_url ?? null,
            partner: body
          }
        })
        .filter(c => c !== null)
        .filter(c => c.partner.partner_tier === 'gold')
  }

  loadingCertifications.value = false
}

// Run once and every time view re-enters
onMounted(loadPlace)
onIonViewWillEnter(loadPlace)

const logInstagram = () => {
  if (!place.value) return;
  ActivityLogService.log("explore_detail_instagram", {
    id: place.value.id,
    instagram: place.value.instagram
  });
};

function goToPartner(id: string) {
  ActivityLogService.log("partner_click", {
    partner_id: id,
    source: "location_detail"
  })

  router.push(`/partner/${id}`)
}


const share = async () => {
  if (!place.value) return

  await ActivityLogService.log("explore_detail_share", {
    id: place.value.id,
    name: place.value.name
  });

  await Share.share({
    title: place.value.name,
    text: `${place.value.name} (${place.value.type})\n🔗 https://app.halalformosa.com/place/${place.value.id}\n\nShared via Halal Formosa 🕌`,
    dialogTitle: t('search.details.share'),
  })
}

const logOpenMaps = () => {
  if (!place.value) return;
  ActivityLogService.log("explore_detail_open_maps", {
    id: place.value.id,
    name: place.value.name
  });
};

const logCall = () => {
  if (!place.value) return;
  ActivityLogService.log("explore_detail_call", {
    id: place.value.id,
    phone: place.value.phone
  });
};


const editItem = async () => {
  if (!place.value) return;

  ActivityLogService.log("explore_detail_edit", {
    id: place.value.id,
    name: place.value.name
  });

  try {
    await popoverController.dismiss();
  } catch {
    // Ignore if no popover is open
  }

  router.push(`/place/${place.value.id}/edit`);
};

const reportItem = async () => {
  if (!place.value) return;

  ActivityLogService.log("explore_detail_report", {
    id: place.value.id,
    name: place.value.name
  });

  try {
    await popoverController.dismiss();
  } catch {
    // Ignore if no popover is open
  }

  router.push(`/place/${place.value.id}/report`);
};

const logLine = () => {
  if (!place.value) return;
  ActivityLogService.log("explore_detail_line", {
    id: place.value.id,
    line_id: place.value.line_id
  });
};

const isMuslimFriendly = computed(() => {
  if (!place.value?.type) return false
  return place.value.type.toLowerCase().includes('muslim-friendly')
})

const scrollToDescription = () => {
  if (!place.value?.description) return
  const el = document.getElementById('place-description-section')
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}
</script>


<style scoped>
/* MAP STYLES */
.detail-map-container {
  width: 100%;
  height: 200px;
  border-radius: 12px;
  overflow: hidden;
}

.detail-map {
  width: 100%;
  height: 100%;
}

/* Place Marker */
.place-marker-pin {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  filter: drop-shadow(0 3px 6px rgba(0,0,0,0.3));
  transform: translateY(-50%);
}

/* User Location Dot (same as ExploreView) */
.user-location-dot {
  width: 16px;
  height: 16px;
  background: #4285f4;
  border: 2px solid white;
  border-radius: 50%;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
}

/* TIERED PAGE STYLES - Inherit from global variables if needed, otherwise clean up redundant local backgrounds */
.tier-gold .official-verified-tag {
  color: #ca8a04;
}
.tier-silver .official-verified-tag {
  color: #64748b;
}

.details-container {
  background: var(--ion-background-color); /* Default theme background */
  margin-top: -24px;
  position: relative;
  border-radius: 24px 24px 0 0;
  min-height: 100vh; /* Ensure background fills to bottom */
  z-index: 10;
  overflow: hidden;
}

/* PREMIUM FLARE */
.premium-flare {
  position: absolute;
  top: 0;
  left: -150%;
  width: 50%;
  height: 100%;
  background: linear-gradient(
    to right,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.4) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  transform: skewX(-25deg);
  z-index: 1;
  pointer-events: none;
  animation: details-shimmer 4s infinite linear;
}

@keyframes details-shimmer {
  0% { left: -150%; }
  30% { left: 150%; }
  100% { left: 150%; }
}

/* TITLES AND TEXT */
.title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 8px;
}

.product-title {
  margin: 0;
  font-weight: 800;
  font-size: 1.6rem;
  line-height: 1.2;
}

/* DESCRIPTION NOTICE BANNER */
.description-notice-banner {
  background: rgba(234, 88, 12, 0.08); /* carrot light */
  border: 1px solid rgba(234, 88, 12, 0.2);
  border-radius: 12px;
  padding: 12px;
  margin: 16px 0;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.description-notice-banner:active {
  transform: scale(0.98);
  background: rgba(234, 88, 12, 0.15);
}

.description-notice-banner.is-muslim-friendly {
  background: rgba(245, 158, 11, 0.1); /* warning light */
  border-color: rgba(245, 158, 11, 0.4);
}

.description-notice-banner.is-muslim-friendly .notice-icon-wrapper {
  background: #f59e0b;
  color: #fff;
}

.description-notice-banner.is-muslim-friendly .notice-title {
  color: #d97706;
}

.notice-icon-wrapper {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--ion-color-carrot);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.notice-text-content {
  flex: 1;
}

.notice-title {
  font-weight: 700;
  font-size: 13px;
  color: var(--ion-color-carrot);
  margin-bottom: 2px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.notice-message {
  font-size: 12px;
  color: var(--ion-color-step-800);
  line-height: 1.4;
}

.notice-arrow {
  font-size: 20px;
  color: var(--ion-color-medium);
  opacity: 0.5;
}

.attribution-text {
  font-size: 12px;
  color: var(--ion-color-medium);
  margin: 2px 0 12px 0;
}

.section-title {
  margin-bottom: 4px;
  color: var(--ion-color-medium);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  font-size: 10px;
}

.open-status-badge {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 13px;
  margin-top: 8px;
}

.open-status-badge.open {
  background: rgba(34, 197, 94, 0.15);
  color: #16a34a;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.open-status-badge.closed {
  background: rgba(239, 68, 68, 0.15);
  color: #dc2626;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.today-highlight {
  background: rgba(234, 88, 12, 0.08);
  border-left: 3px solid var(--ion-color-carrot);
}

.today-highlight ion-label {
  font-weight: 600;
  color: var(--ion-color-carrot);
}

/* PREMIUM BADGES */
.premium-badge-wrapper {
  flex-shrink: 0;
}

.premium-badge-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 99px;
  font-weight: 800;
  font-size: 11px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.premium-badge-pill.gold {
  background: #facc15;
  color: #854d0e;
}

.premium-badge-pill.silver {
  background: #94a3b8;
  color: #1e293b;
}

.status-action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  gap: 8px;
}

.official-verified-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--ion-color-medium);
  font-weight: 700;
  font-size: 10px;
  letter-spacing: 0.5px;
}

.hashtag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.location-hashtag {
  font-size: 13px;
  font-weight: 600;
  color: var(--ion-color-carrot);
  opacity: 0.8;
  transition: opacity 0.2s ease;
  cursor: pointer;
}

.location-hashtag:hover {
  opacity: 1;
  text-decoration: underline;
}

.tier-gold .official-verified-tag {
  color: #ca8a04;
}

.image-modal-close-btn {
  position: absolute;
  top: calc(env(safe-area-inset-top, 0px) + 16px);
  right: 16px;
  z-index: 9999;
}

.place-swiper {
  margin: 0 !important;
  padding: 0 !important;
  width: 100%;
  height: 350px;
  border-radius: 0 0 24px 24px;
  overflow: hidden;
}

.fullscreen-swiper,
.fullscreen-swiper .swiper-slide,
.fullscreen-swiper .swiper-zoom-container {
  width: 100%;
  height: 100%;
}

.fullscreen-swiper .swiper-slide {
  display: flex;
  justify-content: center;
  align-items: center;
  background: black;
}

.fullscreen-swiper img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

iframe {
  border-radius: 4px;
}
</style>
