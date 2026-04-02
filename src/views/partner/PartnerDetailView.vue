<template>
  <ion-page>
    <ion-header>
      <app-header
          :title="body.name || $t('partner.detailTitle')"
          :showBack="true"
          icon="none"
      />

    </ion-header>

    <ion-content>

      <div class="hero-cover">
        <template v-if="loading">
          <div class="hero-content">
            <ion-skeleton-text
                animated
                style="width:96px;height:96px;border-radius:12px;margin-bottom:8px;"
            />
            <ion-skeleton-text
                animated
                style="width:180px;height:20px;"
            />
          </div>
        </template>

        <template v-else>
          <div
              class="hero-bg"
              :style="{ backgroundImage: `url(${body.logo})` }"
          ></div>

          <div
              class="hero-content"
              :class="body.partner_tier === 'gold' && 'hf-gold-glow'"
          >
            <div
                :class="['hero-logo-wrap', { 'gold-glow-wrap': body.partner_tier === 'gold' }]"
                @click="openLogoPreview"
            >
              <img
                  :src="body.logo"
                  :alt="body.name"
                  class="hero-logo clickable"
                  @error="(e) => (e.target as any).src = `https://placehold.co/200x200?text=${encodeURIComponent(body.name)}`"
              />
            </div>

            <h2 class="body-name">{{ body.name }}</h2>

            <!-- Partner tier badge -->
            <ion-badge
                v-if="body.partner_tier"
                :class="[
    'tier-badge',
    'partner-detail-badge',
    `${body.partner_tier}`,
    'ion-text-uppercase'
  ]"
            >
              {{ body.partner_tier }} Partner
            </ion-badge>

            <!-- Verified only (no tier) -->
            <ion-badge
                v-else-if="body.verified"
                color="success"
                class="verified-badge"
            >
              Verified Halal Certification Body
            </ion-badge>


          </div>
        </template>
      </div>


      <div class="ion-padding">

        <!-- Scopes / Categories -->
        <div class="scope-inline">
          <ion-chip
              v-for="scope in body.scopes"
              :key="scope"
              class="scope-chip chip-primary"
          >
            {{ scope }}
          </ion-chip>
        </div>

        <!-- About -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ $t('partner.about') }}</ion-card-title>
          </ion-card-header>

          <ion-card-content>
            <template v-if="loading">
              <ion-skeleton-text animated style="width:100%;height:14px;margin-bottom:8px;" />
              <ion-skeleton-text animated style="width:95%;height:14px;margin-bottom:8px;" />
              <ion-skeleton-text animated style="width:80%;height:14px;" />
            </template>

            <p v-else class="body-description">
              {{ body.about }}
            </p>
          </ion-card-content>
        </ion-card>


        <!-- Programs -->
        <ion-card v-if="loading || body.programs.length">
          <ion-card-header>
            <ion-card-title>
              {{ $t('partner.programs') }}
            </ion-card-title>
          </ion-card-header>

          <ion-card-content>
            <template v-if="loading">
              <ion-skeleton-text animated style="width:90%;height:14px;margin-bottom:6px;" />
              <ion-skeleton-text animated style="width:75%;height:14px;margin-bottom:6px;" />
              <ion-skeleton-text animated style="width:60%;height:14px;" />
            </template>

            <ul v-else class="program-list">
              <li v-for="p in body.programs" :key="p">
                {{ p }}
              </li>
            </ul>
          </ion-card-content>
        </ion-card>

        <!-- Certified Products (Gold Partner only) -->
        <ion-card
            v-if="body.partner_tier === 'gold' && (loadingProducts || certifiedProducts.length)"
        >
          <ion-card-header>
            <ion-card-title>
              Certified Products
            </ion-card-title>
          </ion-card-header>

          <ion-card-content>
            <!-- Skeleton -->
            <template v-if="loadingProducts">
              <ion-skeleton-text animated style="width:100%;height:140px;border-radius:12px;" />
              <ion-skeleton-text animated style="width:80%;height:14px;margin-top:8px;" />
            </template>

            <!-- Products (Horizontal Scroll) -->
            <div v-else class="discover-scroll">
              <div class="discover-track">
                <ion-card
                    v-for="p in certifiedProducts"
                    :key="p.id"
                    class="discover-item discover-item--scroll"
                    button
                    @click="openCertifiedProduct(p)"
                >
                  <img
                      :src="p.photo_front_url || 'https://placehold.co/200x200'"
                      class="discover-img"
                      @error="(e) => (e.target as any).src = `https://placehold.co/200x200?text=${encodeURIComponent(p.name)}`"
                  />
                  <ion-label class="discover-label">
                    <p class="discover-name" style="text-align: center;">{{ p.name }}</p>
                    <ion-chip color="success" style="font-size:10px; height: 20px; margin-top: 4px;">
                      {{ p.status }}
                    </ion-chip>
                  </ion-label>
                </ion-card>
              </div>
            </div>
          </ion-card-content>
        </ion-card>

        <!-- Certified Locations (Gold Partner only) -->
        <ion-card
            v-if="body.partner_tier === 'gold' && (loadingLocations || certifiedLocations.length)"
        >
          <ion-card-header>
            <ion-card-title>
              Certified Locations
            </ion-card-title>
          </ion-card-header>

          <ion-card-content>
            <!-- Skeleton -->
            <template v-if="loadingLocations">
              <ion-skeleton-text animated style="width:100%;height:140px;border-radius:12px;" />
              <ion-skeleton-text animated style="width:80%;height:14px;margin-top:8px;" />
            </template>

            <!-- Locations (Horizontal Scroll) -->
            <div v-else class="discover-scroll">
              <div class="discover-track">
                <ion-card
                    v-for="loc in certifiedLocations"
                    :key="loc.id"
                    class="discover-item discover-item--scroll"
                    button
                    @click="openCertifiedLocation(loc)"
                >
                  <img
                      :src="loc.image || 'https://placehold.co/200x200'"
                      class="discover-img"
                      @error="(e) => (e.target as any).src = `https://placehold.co/200x200?text=${encodeURIComponent(loc.name)}`"
                  />
                  <ion-label class="discover-label">
                    <p class="discover-name" style="text-align: center;">{{ loc.name }}</p>
                    <p style="font-size:12px;color:var(--ion-color-medium)">
                      {{ loc.location_types?.name }}
                    </p>
                  </ion-label>
                </ion-card>
              </div>
            </div>
          </ion-card-content>
        </ion-card>

        <!-- Nearby Locations (Tag-based matching to Partner Slug) -->
        <ion-card
            v-if="(body.partner_type === 'campus') && (loadingNearby || nearbyLocations.length)"
        >
          <ion-card-header>
            <div class="card-header-row">
              <ion-card-title>Nearby Locations</ion-card-title>
              <ion-button
                  fill="clear"
                  size="small"
                  color="carrot"
                  @click="viewAllNearbyLocations"
              >
                {{ $t('home.viewMore') }}
              </ion-button>
            </div>
          </ion-card-header>

          <ion-card-content>
            <!-- Skeleton -->
            <template v-if="loadingNearby">
              <ion-skeleton-text animated style="width:100%;height:140px;border-radius:12px;" />
              <ion-skeleton-text animated style="width:80%;height:14px;margin-top:8px;" />
            </template>

            <!-- Locations -->
            <!-- Locations (Horizontal Scroll) -->
            <div v-else class="discover-scroll">
              <div class="discover-track">
                <ion-card
                    v-for="loc in nearbyLocations"
                    :key="loc.id"
                    :class="[
                      'discover-item', 
                      'discover-item--scroll',
                      loc.partner?.partner_tier ? 'tier-card-' + loc.partner.partner_tier.toLowerCase() : ''
                    ]"
                    button
                    @click="openNearbyLocation(loc)"
                >
                  <!-- Tier Badge -->
                  <ion-badge
                      v-if="loc.partner?.partner_tier"
                      :class="['tier-badge', loc.partner.partner_tier.toLowerCase()]"
                  >
                    <ion-icon :icon="sparkles" />
                    <span>{{ $t('home.partnerTier', { tier: (loc.partner.partner_tier || '').toUpperCase() }) }}</span>
                  </ion-badge>

                  <!-- Premium Flare -->
                  <div v-if="['gold', 'silver'].includes(String(loc.partner?.partner_tier || '').toLowerCase())" class="premium-flare"></div>

                  <img
                      :src="loc.image || 'https://placehold.co/200x200'"
                      :alt="$t('home.altLocation')"
                      class="discover-img"
                      @error="(e) => (e.target as any).src = `https://placehold.co/200x200?text=${encodeURIComponent(loc.name)}`"
                  />
                  <ion-label class="discover-label">
                    <div class="name-row">
                      <h3 class="discover-name">{{ loc.name }}</h3>
                      <div v-if="loc.partner?.partner_tier" class="home-partner-verified">
                        <ion-icon :icon="shieldCheckmarkOutline" />
                      </div>
                    </div>
                    <!-- Distance label -->
                    <p v-if="loc.distance" class="distance-label">
                      <ion-icon :icon="locationOutline" />
                      {{ loc.distance }} km from {{ body.slug === 'ntu' ? 'NTU' : body.name }}
                    </p>
                    <p class="added-label">{{ $t('home.added') }} {{ fromNowToTaipei(loc.created_at) }}</p>
                  </ion-label>
                </ion-card>
              </div>
            </div>
          </ion-card-content>
        </ion-card>

        <!-- Trips (Gold Partner only) -->
        <ion-card
            v-if="body.partner_tier === 'gold' && (loadingTrips || partnerTrips.length)"
        >
          <ion-card-header>
            <ion-card-title>
              Partner Trips
            </ion-card-title>
          </ion-card-header>

          <ion-card-content>

            <!-- Skeleton -->
            <template v-if="loadingTrips">
              <ion-skeleton-text animated style="width:100%;height:140px;border-radius:12px;" />
              <ion-skeleton-text animated style="width:80%;height:14px;margin-top:8px;" />
            </template>

            <!-- Trips (Horizontal Scroll) -->
            <div v-else class="discover-scroll">
              <div class="discover-track">
                <ion-card
                    v-for="trip in partnerTrips"
                    :key="trip.id"
                    class="discover-item discover-item--scroll"
                    button
                    @click="openTrip(trip)"
                >
                  <img
                      :src="trip.cover_url || 'https://placehold.co/200x200'"
                      class="discover-img"
                      @error="(e) => (e.target as any).src = `https://placehold.co/200x200?text=${encodeURIComponent($i18n.locale === 'zh-tw' ? (trip.title_zh || trip.title) : trip.title)}`"
                  />

                  <ion-label class="discover-label">
                    <p class="discover-name" style="text-align: center;">
                      {{ $i18n.locale === 'zh-tw'
                        ? (trip.title_zh || trip.title)
                        : trip.title }}
                    </p>

                    <p style="font-size:12px;color:var(--ion-color-medium); margin-top: 4px;">
                      🕒 {{ trip.duration }}
                    </p>
                  </ion-label>
                </ion-card>
              </div>
            </div>

          </ion-card-content>
        </ion-card>



        <!-- Contact -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>
              {{ $t('partner.contact') }}
            </ion-card-title>
          </ion-card-header>

          <ion-card-content>
            <template v-if="loading">
              <ion-skeleton-text animated style="width:80%;height:14px;margin-bottom:8px;" />
              <ion-skeleton-text animated style="width:60%;height:14px;margin-bottom:8px;" />
              <ion-skeleton-text animated style="width:70%;height:14px;" />
            </template>

            <template v-else>
              <p v-if="body.address">📍 {{ body.address }}</p>
              <p v-if="body.phone">📞 {{ body.phone }}</p>
              <p v-if="body.email">✉️ {{ body.email }}</p>

              <a
                  v-if="body.website"
                  href="#"
                  @click.prevent="openWebsite"
                  class="external-link"
              >
              🌐 {{ body.website }}
              </a>
            </template>
          </ion-card-content>
        </ion-card>


      </div>

    </ion-content>

    <ion-modal :is-open="showLogoModal" @didDismiss="closeLogoPreview">
      <ion-content fullscreen>

        <!-- Close button -->
        <ion-button
            fill="solid"
            color="carrot"
            class="image-modal-close-btn"
            @click="closeLogoPreview"
        >
          ✕
        </ion-button>

        <!-- Fullscreen Swiper -->
        <Swiper
            :modules="[Zoom]"
            :zoom="true"
            :slides-per-view="1"
            class="fullscreen-swiper"
        >
          <SwiperSlide>
            <div class="swiper-zoom-container">
              <img
                  :src="body.logo"
                  :alt="body.name"
                  @error="(e) => (e.target as any).src = `https://placehold.co/400x400?text=${encodeURIComponent(body.name)}`"
              />
            </div>
          </SwiperSlide>
        </Swiper>

      </ion-content>
    </ion-modal>

  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  IonPage,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonChip,
  IonBadge,
  IonModal,
  IonHeader,
    IonSkeletonText,
    IonLabel,
    IonButton,
    IonIcon
} from '@ionic/vue'
import AppHeader from '@/components/AppHeader.vue'
import { supabase } from '@/plugins/supabaseClient'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Zoom } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/zoom'
import {Browser} from "@capacitor/browser";
import {ActivityLogService} from "@/services/ActivityLogService";
import router from "@/router";
import { sparkles, shieldCheckmarkOutline, locationOutline } from 'ionicons/icons'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(relativeTime)
dayjs.extend(utc)
dayjs.extend(timezone)

const fromNowToTaipei = (date: string | undefined) => {
  if (!date) return ''
  return dayjs(date).tz('Asia/Taipei').fromNow()
}

/**
 * Haversine formula to calculate straight-line distance in km
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(1);
}

const PARTNER_COORDS: Record<string, { lat: number; lng: number }> = {
  'ntu': { lat: 25.01737, lng: 121.5398 } // NTU Main Campus center
}


const route = useRoute()
const id = route.params.id as string

const loading = ref(true)
const showLogoModal = ref(false)

function openLogoPreview() {
  ActivityLogService.log('partner_logo_preview', {
    partner_id: body.value.id,
    partner_name: body.value.name,
    partner_tier: body.value.partner_tier
  })

  showLogoModal.value = true
}


function closeLogoPreview() {
  showLogoModal.value = false
}
/* ---------------- State ---------------- */
type Partner = {
  id: string
  name: string
  slug: string
  logo: string
  verified: boolean
  partner_tier?: 'gold' | 'silver' | 'bronze' | null
  partner_type?: 'campus' | 'halal_body' | 'vendor' | 'merchant' | 'organization' | null
  scopes: string[]
  about: string
  programs: string[]
  address: string
  phone: string
  email: string
  website: string
}


const body = ref<Partner>({
  id: '',
  name: '',
  slug: '',
  logo: '',
  verified: false,
  partner_tier: null,
  partner_type: null,
  scopes: [],
  about: '',
  programs: [],
  address: '',
  phone: '',
  email: '',
  website: ''
})



/* ---------------- Fetch ---------------- */
async function fetchPartner(id: string) {
  const { data, error } = await supabase
      .from('partners')
      .select(`
    id,
    name,
    slug,
    logo_url,
    verified,
    partner_tier,
    partner_type,
    about,
    address,
    phone,
    email,
    website,

    partners_scopes (
      partner_scopes (
        id,
        name,
        icon,
        color
      )
    ),

    partner_programs (
      id,
      name
    )
  `)
      .eq('id', id)
      .single()



  if (error) {
    console.error('[Partner]', error)
    return
  }

  body.value = {
    id: data.id,
    name: data.name,
    slug: data.slug,
    logo: data.logo_url,
    verified: data.verified,
    partner_tier: data.partner_tier,
    partner_type: data.partner_type,
    about: data.about ?? '',
    address: data.address ?? '',
    phone: data.phone ?? '',
    email: data.email ?? '',
    website: data.website ?? '',
    scopes: data.partners_scopes?.map(
        (bs: any) => bs.partner_scopes.name
    ) ?? [],
    programs: data.partner_programs?.map(
        (p: any) => p.name
    ) ?? []
  }
}

const certifiedProducts = ref<any[]>([])
const loadingProducts = ref(false)

async function fetchCertifiedProducts() {
  if (body.value.partner_tier !== 'gold') return

  loadingProducts.value = true

  const { data, error } = await supabase
      .from('product_certifications')
      .select(`
      id,
      certified_at,
      products (
        id,
        barcode,
        name,
        status,
        photo_front_url
      )
    `)
      .eq('partner_id', body.value.id)
      .eq('status', 'active')

  if (!error && data) {
    certifiedProducts.value = data
        .filter(d => d.products)
        .map(d => ({
          ...d.products,
          certified_at: d.certified_at
        }))
  }

  loadingProducts.value = false
}

const certifiedLocations = ref<any[]>([])
const loadingLocations = ref(false)

async function fetchCertifiedLocations() {
  if (body.value.partner_tier !== 'gold') return

  loadingLocations.value = true

  const { data, error } = await supabase
      .from('location_certifications')
      .select(`
      certified_at,
      locations (
        id,
        name,
        image,
        address,
        location_types ( name )
      )
    `)
      .eq('partner_id', body.value.id)
      .eq('status', 'active')

  if (!error && data) {
    certifiedLocations.value = data
        .filter(d => d.locations)
        .map(d => ({
          ...d.locations,
          certified_at: d.certified_at
        }))
  }

  loadingLocations.value = false
}

const nearbyLocations = ref<any[]>([])
const loadingNearby = ref(false)

async function fetchNearbyLocations() {
  if (!body.value.slug) return

  loadingNearby.value = true

  const { data, error } = await supabase
      .from('locations')
      .select(`
        id,
        name,
        image,
        address,
        location_types ( name ),
        created_at,
        partner:partners(partner_tier),
        lat,
        lng
      `)
      .contains('tags', [body.value.slug])
      .eq('approved', true)

  if (!error && data) {
    const partnerPos = PARTNER_COORDS[body.value.slug]
    
    const mapped = data.map(loc => {
      const d = (partnerPos && loc.lat && loc.lng) 
        ? Number(haversineDistance(partnerPos.lat, partnerPos.lng, loc.lat, loc.lng))
        : null
        
      return {
        ...loc,
        distance: d !== null ? d.toFixed(1) : null,
        _dist: d
      }
    })

    // Sort by distance (asc)
    mapped.sort((a, b) => {
      if (a._dist === null) return 1
      if (b._dist === null) return -1
      return a._dist - b._dist
    })

    nearbyLocations.value = mapped
  }

  loadingNearby.value = false
}

const partnerTrips = ref<any[]>([])
const loadingTrips = ref(false)

async function fetchPartnerTrips() {
  if (body.value.partner_tier !== 'gold') return

  loadingTrips.value = true

  const { data, error } = await supabase
      .from('trips')
      .select(`
      id,
      title,
      title_zh,
      cover_url,
      duration,
      external_url
    `)
      .eq('provider_id', body.value.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

  if (!error && data) {
    partnerTrips.value = data
  }

  loadingTrips.value = false
}

async function openWebsite() {
  ActivityLogService.log('partner_website_click', {
    partner_id: body.value.id,
    partner_name: body.value.name,
    partner_tier: body.value.partner_tier,
    website: body.value.website
  })

  await Browser.open({
    url: body.value.website,
    windowName: '_self',
    toolbarColor: '#e67e22',
    presentationStyle: 'fullscreen',
  })
}


async function openTrip(trip: any) {

  ActivityLogService.log('partner_trip_click', {
    partner_id: body.value.id,
    partner_name: body.value.name,
    partner_tier: body.value.partner_tier,
    trip_id: trip.id,
    trip_title: trip.title
  })

  await supabase.rpc('increment_trip_view', {
    p_trip_id: trip.id
  })

  await Browser.open({
    url: trip.external_url,
    windowName: '_self',
    toolbarColor: '#e67e22',
    presentationStyle: 'fullscreen',
  })
}


function openCertifiedProduct(p: any) {
  ActivityLogService.log('partner_certified_product_click', {
    partner_id: body.value.id,
    partner_name: body.value.name,
    partner_tier: body.value.partner_tier,
    product_id: p.id,
    product_barcode: p.barcode,
    product_name: p.name
  })

  router.push(`/item/${p.barcode}`)
}

function openCertifiedLocation(loc: any) {
  ActivityLogService.log('partner_certified_location_click', {
    partner_id: body.value.id,
    partner_name: body.value.name,
    partner_tier: body.value.partner_tier,
    location_id: loc.id,
    location_name: loc.name
  })

  router.push(`/place/${loc.id}`)
}

function openNearbyLocation(loc: any) {
  ActivityLogService.log('partner_nearby_location_click', {
    partner_id: body.value.id,
    partner_name: body.value.name,
    partner_tier: body.value.partner_tier,
    location_id: loc.id,
    location_name: loc.name
  })

  router.push(`/place/${loc.id}`)
}

function viewAllNearbyLocations() {
  ActivityLogService.log('partner_nearby_view_more_click', {
    partner_id: body.value.id,
    partner_name: body.value.name,
    partner_slug: body.value.slug
  })
  
  // Hard navigation to break out of any locked Ionic tab contexts
  window.location.href = `/explore?tag=${body.value.slug}`
}


/* ---------------- Lifecycle ---------------- */
onMounted(async () => {
  if (!id) return

  loading.value = true
  await fetchPartner(id)
  loading.value = false

  // 🔥 Log partner detail open
  ActivityLogService.log('partner_detail_open', {
    partner_id: body.value.id,
    partner_name: body.value.name,
    partner_tier: body.value.partner_tier,
    verified: body.value.verified
  })

  if (body.value.partner_tier === 'gold') {
    fetchCertifiedProducts()
    fetchCertifiedLocations()
    fetchPartnerTrips()
  }
  
  if (body.value.partner_type === 'campus') {
    fetchNearbyLocations()
  }
})


</script>


<style scoped>
.header-block {
  text-align: center;
  margin-bottom: 16px;
}

.body-logo {
  width: 120px;
  height: 120px;
  object-fit: contain;
  margin-bottom: 8px;
}

.body-name {
  margin: 4px 0;
  font-size: 1.3rem;
  font-weight: 600;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  margin-bottom: 12px;
}

.scope-inline {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center; /* 👈 inline, not centered */
  margin-bottom: 12px;
}

@media (max-width: 480px) {
  .scope-inline {
    flex-wrap: nowrap;        /* ⛔ no wrap */
    overflow-x: auto;         /* 👉 horizontal scroll */
    justify-content: flex-start;

    padding-bottom: 4px;
    -webkit-overflow-scrolling: touch;
  }

  .scope-inline::-webkit-scrollbar {
    display: none;            /* clean */
  }
}


.scope-chip {
  width: auto;          /* 👈 prevents full width */
  max-width: 100%;
  font-size: 13px;
  padding-inline: 10px; /* tighter */
  white-space: nowrap; /* keeps it compact */
  flex-shrink: 0;             /* 👈 important */
}


.body-description {
  font-size: 0.95rem;
  line-height: 1.6;
}

.program-list {
  padding-left: 16px;
}

.external-link {
  display: inline-block;
  margin-top: 6px;
  color: var(--ion-color-primary);
}

/* =========================
   Full Bleed Hero Cover
   ========================= */

.hero-cover {
  position: relative;
  height: 240px;

  /* FULL WIDTH */
  width: 100vw;
  margin-left: calc(-50vw + 50%);
  margin-right: calc(-50vw + 50%);

  /* Remove card feel */
  border-radius: 0;
  overflow: hidden;

  margin-bottom: 16px;
}


/* Blurred background */
.hero-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;

  filter: blur(22px);
  transform: scale(1.2);
  opacity: 0.35;
}


/* Foreground content */
.hero-content {
  position: relative;
  z-index: 2;
  height: 100%;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  text-align: center;
  padding: 16px;
}

/* Center logo */
.hero-logo {
  width: 96px;
  height: 96px;
  object-fit: contain;
  background: #fff;
  border-radius: 12px;
  padding: 8px;


  box-shadow: 0 8px 24px rgba(0,0,0,0.25);
  margin-bottom: 8px;
}

/* Name */
.body-name {
  margin: 4px 0;
  font-size: 1.2rem;
  font-weight: 600;
}

/* Badge */
.verified-badge {
  margin-top: 4px;
}
/* Fullscreen swiper */
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

/* Floating close button */
.image-modal-close-btn {
  position: absolute;
  top: calc(env(safe-area-inset-top, 0px) + 16px);
  right: 16px;
  z-index: 9999;
}


.loading-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;

  display: flex;
  align-items: center;
  justify-content: center;

  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(2px);
}

.partner-detail-badge {
  position: relative;
  margin-top: 8px;
  top: 0;
  left: 0;
  padding: 6px 14px;        /* ⬅ gives presence */
  border-radius: 999px;
}


.hero-logo-wrap {
  position: relative;
  border-radius: 14px;
}

.gold-glow-wrap::before {
  content: '';
  position: absolute;
  inset: -12px;
  border-radius: 22px;

  background:
      radial-gradient(
          circle at 30% 30%,
          rgba(255, 215, 0, 0.9),
          transparent 60%
      ),
      radial-gradient(
          circle at 70% 70%,
          rgba(255, 193, 7, 0.6),
          transparent 65%
      );

  filter: blur(8px);
  z-index: 0;
}

.hero-logo {
  position: relative;
  z-index: 1;
}

/* ===============================
   Discover Grid & Item Styles
   =============================== */
.card-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
}

.discover-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 4px 0;
}

/* Horizontal Scroll Styles */
.discover-scroll {
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  -ms-overflow-style: none;
  margin: 0 -8px; /* Slight bleed */
  padding: 8px;
}

.discover-scroll::-webkit-scrollbar {
  display: none;
}

.discover-track {
  display: flex;
  gap: 14px;
}

.discover-item {
  margin: 0;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.06);
  position: relative;
  transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.discover-item--scroll {
  flex: 0 0 240px; /* Fixed width for scrolling cards */
  scroll-snap-align: center;
}


.discover-item:active {
  transform: scale(0.97);
}

.discover-img {
  width: 100%;
  height: 130px;
  object-fit: cover;
  border-radius: 0;
}

.discover-label {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.name-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
}

.discover-name {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--ion-color-dark);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

.discover-label p {
  margin: 2px 0 0;
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}

.distance-label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  color: var(--ion-color-primary) !important;
  font-weight: 600;
  margin-top: 6px !important;
  width: 100%;
}

.distance-label ion-icon {
  font-size: 14px;
}

.added-label {
  opacity: 0.8;
  font-size: 0.7rem !important;
  display: block;
  width: 100%;
  text-align: center;
}

.home-partner-verified {
  color: var(--ion-color-primary);
  font-size: 16px;
  flex-shrink: 0;
  display: flex;
}

/* Tier Badges */
.tier-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 2;
  padding: 4px 8px;
  border-radius: 8px;
  font-size: 0.65rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 3px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
  text-transform: uppercase;
}

.tier-badge.gold {
  background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
  color: #fff;
}

.tier-badge.silver {
  background: linear-gradient(135deg, #64748b 0%, #94a3b8 100%);
  color: #fff;
}

.tier-badge.bronze {
  background: linear-gradient(135deg, #92400e 0%, #b45309 100%);
  color: #fff;
}

/* Tier Cards Glow & Border */
.tier-card-gold { border: 1.5px solid #fbbf24; }
.tier-card-silver { border: 1.5px solid #94a3b8; }

/* Premium Flare */
.premium-flare {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 1;
}

.premium-flare::after {
  content: '';
  position: absolute;
  top: -100%;
  left: -100%;
  width: 300%;
  height: 300%;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0) 45%,
    rgba(255, 255, 255, 0.4) 50%,
    rgba(255, 255, 255, 0) 55%,
    rgba(255, 255, 255, 0) 100%
  );
  animation: flare-slide 4s infinite linear;
}

@keyframes flare-slide {
  0% { transform: translate(-10%, -10%); }
  100% { transform: translate(10%, 10%); }
}
</style>
