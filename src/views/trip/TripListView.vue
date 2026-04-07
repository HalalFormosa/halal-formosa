<template>
  <ion-page>

    <!-- ================= HEADER ================= -->
    <ion-header>

      <!-- Top App Header -->
      <app-header
          :title="$t('trip.title')"
          :icon="compassOutline"
          :showProfile="true"
      />

      <ion-toolbar class="actions-toolbar">
        <div class="header-main-actions">
          <!-- Sort Button (Left Side) -->
          <ion-button fill="clear" class="classic-action-btn sort-btn-wrapper" id="sort-trigger-trip">
            <ion-icon :icon="sortIcon" />
            <span class="btn-label">{{ sortLabel }}</span>
          </ion-button>

          <ion-popover trigger="sort-trigger-trip" trigger-action="click" :dismiss-on-select="true" class="width-190">
            <ion-list lines="none">
              <ion-item button @click="sortBy = 'recent'">
                <ion-icon :icon="timeOutline" slot="start" />
                <ion-label>{{ $t('trip.sortRecentShort') }}</ion-label>
                <ion-icon v-if="sortBy === 'recent'" :icon="checkmarkCircle" slot="end" color="success" style="font-size: 14px;" />
              </ion-item>
              
              <ion-item button @click="sortBy = 'views'">
                <ion-icon :icon="flameOutline" slot="start" />
                <ion-label>{{ $t('trip.sortViewsShort') }}</ion-label>
                <ion-icon v-if="sortBy === 'views'" :icon="checkmarkCircle" slot="end" color="success" style="font-size: 14px;" />
              </ion-item>
            </ion-list>
          </ion-popover>



          <div class="right-actions-group">
            <!-- Search Toggle Button -->
            <ion-button
                fill="clear"
                @click="showSearchbar = !showSearchbar"
                :color="showSearchbar ? 'carrot' : 'dark'"
                class="classic-action-btn"
            >
              <ion-icon :icon="showSearchbar ? closeCircle : searchOutline" />
            </ion-button>

            <!-- Filter Toggle -->
            <ion-button fill="clear" @click="toggleFilters" class="classic-action-btn">
              <ion-icon :icon="funnelOutline" />
              <div v-if="activeFiltersCount > 0" class="badge-count">{{ activeFiltersCount }}</div>
            </ion-button>
          </div>
        </div>
      </ion-toolbar>

      <transition name="fade-down">
        <ion-toolbar v-if="showSearchbar" class="search-row-toolbar">
          <div class="search-container">
            <ion-searchbar
                v-model="searchQuery"
                :placeholder="$t('trip.searchPlaceholder')"
                :debounce="500"
                @ionInput="handleSearchInput"
                class="compact-searchbar"
                :animated="true"
            ></ion-searchbar>
          </div>
        </ion-toolbar>
      </transition>

      <!-- Desktop Filters (Toggleable Toolbar) -->
      <transition name="collapse">
        <ion-toolbar v-if="!isSmallScreen && showFilters" class="filter-toolbar">
          <div class="filter-section">
            <TripFilterContent
                :categories="categories"
                :activeCategoryIds="activeCategoryIds"
                :cities="cities"
                :activeCityIds="activeCityIds"
                :hasActiveFilters="hasActiveFilters"
                @toggleCategory="toggleCategory"
                @toggleCity="toggleCity"
                @clearFilters="clearFilters"
            />
          </div>
        </ion-toolbar>
      </transition>

      <!-- Mobile Filters (Modal Bottom Sheet) -->
      <ion-modal
          :is-open="isFilterModalOpen"
          @didDismiss="isFilterModalOpen = false"
          :initial-breakpoint="0.5"
          :breakpoints="[0, 0.5, 0.8, 1]"
          handle-behavior="cycle"
          class="filter-modal"
      >
        <ion-header class="ion-no-border">
          <ion-toolbar>
            <ion-title>{{ $t('common.filter') || 'Filter' }}</ion-title>
            <ion-buttons slot="end">
              <ion-button v-if="hasActiveFilters" @click="clearFilters" color="carrot" class="modal-reset-btn">
                {{ $t('common.reset') || 'RESET' }}
              </ion-button>
              <ion-button @click="isFilterModalOpen = false">
                <ion-icon :icon="closeOutline" />
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding filter-modal-content">
          <TripFilterContent
              :categories="categories"
              :activeCategoryIds="activeCategoryIds"
              :cities="cities"
              :activeCityIds="activeCityIds"
              :hasActiveFilters="hasActiveFilters"
              @toggleCategory="toggleCategory"
              @toggleCity="toggleCity"
              @clearFilters="clearFilters"
          />
        </ion-content>
      </ion-modal>

    </ion-header>

    <!-- ================= CONTENT ================= -->
    <ion-content class="ion-padding">

      <!-- Trip Grid Container -->
      <div class="trip-grid">
        <!-- Loading Skeleton -->
        <template v-if="loading">
          <ion-card v-for="n in 6" :key="'skeleton-' + n" style="margin: 0;">
            <ion-skeleton-text
                animated
                style="width:100%;height:140px;border-radius:12px;"
            />
            <ion-skeleton-text
                animated
                style="width:70%;height:16px;margin:10px;"
            />
          </ion-card>
        </template>

        <!-- No Trips -->
        <template v-else-if="filteredTrips.length === 0">
          <ion-card style="margin: 0; grid-column: 1 / -1;">
            <ion-card-content>
              🧭 {{ $t('trip.noTripsFound') }}
            </ion-card-content>
          </ion-card>
        </template>

        <!-- Trip List -->
        <template v-else>
          <div
              v-for="trip in filteredTrips"
              :key="trip.id"
              :class="[
                'trip-card-v2', 
                trip.provider?.partner_tier ? 'tier-card-' + trip.provider.partner_tier.toLowerCase() : ''
              ]"
              @click="openTrip(trip)"
          >
            <!-- Cover Image + Overlaid Badges -->
            <div class="trip-cover-wrap">
              <img
                  loading="lazy"
                  :src="trip.cover"
                  :alt="trip.title"
                  class="trip-cover"
              />

              <!-- Tier badge (top-left overlay) -->
              <div v-if="trip.provider?.partner_tier" :class="['trip-tier-badge', trip.provider.partner_tier.toLowerCase()]">
                <ion-icon :icon="sparkles" />
                <span>{{ $t('home.partnerTier', { tier: (trip.provider.partner_tier || '').toUpperCase() }) }}</span>
              </div>

              <!-- Gradient overlay for readability -->
              <div class="trip-cover-gradient" />
            </div>

            <!-- Info Section -->
            <div class="trip-card-body">

              <!-- Title -->
              <h3 class="trip-card-title">
                {{
                  $i18n.locale === 'zh-tw'
                      ? (trip.title_zh || trip.title)
                      : trip.title
                }}
              </h3>

              <!-- Provider + Official tag -->
              <div class="trip-card-provider-row">
                <span class="trip-card-provider">
                  {{ $t('trip.providedBy') }} <strong>{{ trip.provider?.name }}</strong>
                </span>
                <span v-if="trip.provider?.partner_tier" class="trip-official-tag">
                  <ion-icon :icon="shieldCheckmarkOutline" />
                  {{ $t('search.officialPartner') }}
                </span>
              </div>

              <!-- Meta Grid -->
              <div class="trip-meta-grid">
                <div class="trip-meta-chip">
                  <ion-icon :icon="locationOutline" class="trip-meta-icon" />
                  <span>{{ 
                    (trip.trip_cities ?? [])
                      .filter(tc => tc.cities)
                      .map(tc => $i18n.locale === 'zh-tw' ? tc.cities.name_zh : tc.cities.name)
                      .join(' · ') || 'N/A'
                  }}</span>
                </div>
                <div class="trip-meta-chip">
                  <ion-icon :icon="timeOutline" class="trip-meta-icon" />
                  <span>{{ trip.duration }}</span>
                </div>
                <div class="trip-meta-chip">
                  <ion-icon :icon="eyeOutline" class="trip-meta-icon" />
                  <span>{{ trip.view_count || 0 }}</span>
                </div>
                <div v-if="trip.updated_at" class="trip-meta-chip">
                  <ion-icon :icon="calendarOutline" class="trip-meta-icon" />
                  <span>{{ fromNow(trip.updated_at) }}</span>
                </div>
              </div>
            </div>

            <!-- Premium Flare for Gold/Silver -->
            <div v-if="['gold', 'silver'].includes(String(trip.provider?.partner_tier || '').toLowerCase())" class="premium-flare"></div>
          </div>
        </template>
      </div>

    </ion-content>

  </ion-page>
</template>


<script setup lang="ts">
import {ref, computed, onMounted, onUnmounted, watch} from 'vue'
import { useI18n } from 'vue-i18n'
import {
  IonPage, IonContent, IonSearchbar, IonToolbar,
  IonButton, IonIcon, IonText,
  IonCard, IonCardContent, IonChip, IonSkeletonText, IonLabel, IonHeader, IonBadge, IonSelect,IonSelectOption,
  IonPopover, IonList, IonItem, IonModal, IonTitle, IonButtons
} from '@ionic/vue'

import {
  funnelOutline, chevronUpOutline, chevronDownOutline, mapOutline, compassOutline, locationOutline,
  searchOutline, closeCircle, timeOutline, checkmarkCircle, sparkles, shieldCheckmarkOutline, eyeOutline, flameOutline, calendarOutline, closeOutline
} from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import TripFilterContent from '@/components/TripFilterContent.vue'
import { ActivityLogService } from '@/services/ActivityLogService'
import { supabase } from '@/plugins/supabaseClient'
import { Browser } from '@capacitor/browser'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(relativeTime)


const loading = ref(true)
const searchQuery = ref('')
const showSearchbar = ref(false)
const showFilters = ref(false)
const isFilterModalOpen = ref(false)
const activeCategoryIds = ref<number[]>([])
const sortBy = ref<'recent' | 'views'>('recent')

const isSmallScreen = ref(window.innerWidth < 768)

const handleResize = () => {
  isSmallScreen.value = window.innerWidth < 768
}

const { t } = useI18n()

const sortLabel = computed(() => {
  if (sortBy.value === 'views') return t('trip.sortViewsShort')
  return t('trip.sortRecentShort')
})

const sortIcon = computed(() => {
  if (sortBy.value === 'views') return flameOutline
  return timeOutline
})

const hasActiveFilters = computed(() => {
  return (
      activeCategoryIds.value.length > 0 ||
      activeCityIds.value.length > 0 ||
      searchQuery.value.length > 0
  )
})

const activeFiltersCount = computed(() => {
  return activeCategoryIds.value.length + activeCityIds.value.length
})

/* Categories using i18n keys */
const categories = ref([
  { id: 1, name: 'trip.catCity', emoji: '🏙️' },
  { id: 2, name: 'trip.catNature', emoji: '🌿' },
  { id: 3, name: 'trip.catFamily', emoji: '👨‍👩‍👧‍👦' },
])

/* Cities using i18n keys */
const cities = ref<any[]>([])

const activeCityIds = ref<string[]>([])

const loadingCities = ref(true)

async function fetchCities() {
  loadingCities.value = true

  const { data, error } = await supabase
      .from('cities')
      .select('id, slug, name, name_zh, emoji')
      .order('sort_order', { ascending: true })

  if (!error && data) {
    cities.value = data
  }

  loadingCities.value = false
}


/* Trips (placeholder → Supabase later) */
interface Trip {
  id: string
  title: string
  title_zh?: string
  cover: string
  duration: string
  categories: string[]
  external_url: string
  provider: any
  view_count?: number
  created_at?: string
  updated_at?: string
  trip_cities?: {
    cities: {
      id: string
      slug: string
      name: string
      name_zh: string
      emoji: string
    }
  }[]

}


// Change your ref to use the interface
const trips = ref<Trip[]>([])

async function fetchTrips() {
  loading.value = true

  const { data, error } = await supabase
      .from('trips')
      .select(`
        id,
        title,
        title_zh,
        duration,
        cover_url,
        external_url,
        created_at,
        updated_at,
        view_count,
        provider:partners (
          id,
          name,
          partner_tier
        ),
        trip_cities (
          city_id,
          cities:city_id (
            id,
            slug,
            name,
            name_zh,
            emoji
          )
        )
      `)
      .eq('is_active', true)

  if (error) {
    console.error('[Trips]', error)
    loading.value = false
    return
  }

  // Use a type assertion to help the compiler handle the Supabase join structure
  trips.value = (data as any[] ?? []).map(t => ({
    id: t.id,
    title: t.title,
    title_zh: t.title_zh,
    cover: t.cover_url,
    duration: t.duration,
    categories: [], // Initialized as empty
    external_url: t.external_url,
    provider: Array.isArray(t.provider) ? t.provider[0] : t.provider,
    created_at: t.created_at,
    updated_at: t.updated_at,
    view_count: t.view_count,
    trip_cities: t.trip_cities || []
  }))

  loading.value = false
}

const filteredTrips = computed(() => {
  const list = trips.value.filter(trip => {
    const matchesSearch =
        trip.title.toLowerCase().includes(searchQuery.value.toLowerCase())

    const matchesCategory =
        activeCategoryIds.value.length === 0 ||
        trip.categories.some((cat: string) =>
            categories.value
                .filter(c => activeCategoryIds.value.includes(c.id))
                .map(c => c.name)
                .includes(cat)
        )

    const matchesCity =
        activeCityIds.value.length === 0 ||
        trip.trip_cities?.some(tc =>
            activeCityIds.value.includes(tc.cities.slug)
        )

    return matchesSearch && matchesCategory && matchesCity
  })

  // 🔥 Sort logic (basic UI-level for now)
  if (sortBy.value === 'views') {
    return [...list].sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
  }

  return [...list].sort((a, b) => {
    return new Date(b.created_at ?? '').getTime()
        - new Date(a.created_at ?? '').getTime()
  })
})


function toggleFilters() {
  if (isSmallScreen.value) {
    isFilterModalOpen.value = !isFilterModalOpen.value
  } else {
    showFilters.value = !showFilters.value
  }
}

function clearFilters() {
  ActivityLogService.log("trip_filter_clear", {
    categories: activeCategoryIds.value,
    cities: activeCityIds.value
  })

  activeCategoryIds.value = []
  activeCityIds.value = []
}



function toggleCategory(id: number) {
  const i = activeCategoryIds.value.indexOf(id)

  if (i === -1) {
    activeCategoryIds.value.push(id)
    ActivityLogService.log("trip_filter_category_add", { category_id: id })
  } else {
    activeCategoryIds.value.splice(i, 1)
    ActivityLogService.log("trip_filter_category_remove", { category_id: id })
  }
}


function toggleCity(id: string) {
  const i = activeCityIds.value.indexOf(id)

  if (i === -1) {
    activeCityIds.value.push(id)
    ActivityLogService.log("trip_filter_city_add", { city_slug: id })
  } else {
    activeCityIds.value.splice(i, 1)
    ActivityLogService.log("trip_filter_city_remove", { city_slug: id })
  }
}

let searchTimeout: number | null = null

function handleSearchInput(ev: Event) {
  const q = (ev.target as HTMLInputElement).value.trim()
  searchQuery.value = q

  if (searchTimeout) clearTimeout(searchTimeout)

  if (q.length > 1) {
    searchTimeout = window.setTimeout(() => {
      ActivityLogService.log("trip_search", { query: q })
    }, 800)
  }
}

function fromNow(dateString?: string) {
  if (!dateString) return ''
  return dayjs.utc(dateString).tz('Asia/Taipei').fromNow()
}


async function openTrip(trip: any) {

  ActivityLogService.log("trip_click", {
    trip_id: trip.id,
    trip_title: trip.title,
    provider_id: trip.provider?.id,
    provider_name: trip.provider?.name,
    provider_tier: trip.provider?.partner_tier,
    current_sort: sortBy.value,
    active_categories: activeCategoryIds.value,
    active_cities: activeCityIds.value,
    search_query: searchQuery.value || null
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

watch(sortBy, (val) => {
  ActivityLogService.log("trip_sort_change", {
    sort_by: val
  })
})

onMounted(() => {
  ActivityLogService.log("trip_page_open", {
    source: "main_navigation"
  })

  fetchTrips()
  fetchCities()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})



</script>

<style scoped>
/* ===============================
   TRIP CARD V2 (Vertical)
================================= */
.trip-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  padding: 4px 0;
}

/* Tablet: 2 columns */
@media (min-width: 768px) {
  .trip-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Laptop & Computer: 3 columns */
@media (min-width: 1024px) {
  .trip-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.trip-card-v2 {
  margin: 0; /* Reset margin for grid layout */
  background: var(--ion-card-background, #ffffff);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 6px 24px rgba(0,0,0,0.08);
  border: 1px solid rgba(var(--ion-color-dark-rgb), 0.05);
  transition: transform 0.2s ease, box-shadow 0.3s ease;
  cursor: pointer;
  position: relative;
}

/* Mobile: restore bottom margin if grid is 1 column */
@media (max-width: 767px) {
  .trip-card-v2 {
    margin-bottom: 12px;
  }
}

.trip-card-v2:active {
  transform: scale(0.985);
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

/* Cover Image */
.trip-cover-wrap {
  position: relative;
  width: 100%;
  height: 200px;
  overflow: hidden;
  background: var(--ion-background-color-step-100, #f0f0f0);
}

.trip-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.4s ease;
}

.trip-card-v2:active .trip-cover {
  transform: scale(1.02);
}

/* Gradient overlay at bottom of image */
.trip-cover-gradient {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: linear-gradient(to bottom, transparent, rgba(0,0,0,0.35));
}

/* Tier badge overlay */
.trip-tier-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 10px;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.3);
}

.trip-tier-badge ion-icon {
  font-size: 12px;
}

.trip-tier-badge.gold {
  background: rgba(234, 179, 8, 0.85);
  color: #1a0e00;
}

.trip-tier-badge.silver {
  background: rgba(160, 160, 175, 0.85);
  color: #1a1a2e;
}

.trip-tier-badge.bronze {
  background: rgba(180, 110, 70, 0.85);
  color: #fff;
}

/* Card Body */
.trip-card-body {
  padding: 16px 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.trip-card-title {
  margin: 0;
  font-size: 1.18rem;
  font-weight: 800;
  color: var(--ion-color-dark);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Provider Row */
.trip-card-provider-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.trip-card-provider {
  font-size: 0.78rem;
  color: var(--ion-color-medium);
}

.trip-official-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--ion-color-carrot);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.trip-official-tag ion-icon {
  font-size: 12px;
}

/* Meta Grid */
.trip-meta-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.trip-meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: rgba(var(--ion-color-dark-rgb), 0.05);
  border-radius: 8px;
  padding: 5px 10px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ion-color-dark);
}

.ion-palette-dark .trip-meta-chip {
  background: rgba(255,255,255,0.07);
}

.trip-meta-icon {
  font-size: 13px;
  color: var(--ion-color-carrot);
  flex-shrink: 0;
}

/* Info Section */
.card-info-section {
  flex: 1;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
  gap: 8px;
}

.info-top .name {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 850;
  color: var(--ion-color-dark);
  line-height: 1.25;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.info-bottom {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  width: 100%;
}

.metas {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.73rem;
  color: var(--ion-color-medium);
}

.meta-dot { opacity: 0.5; margin: 0 4px; }

.meta {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.meta-icon {
  font-size: 11px;
  flex-shrink: 0;
}

/* ===============================
   MODERN CATEGORY CHIPS
================================= */
.category-bar {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 0 16px 8px;
}

.modern-category-chip {
  --cat-color: var(--ion-color-dark);
  --cat-bg: rgba(var(--ion-color-dark-rgb), 0.04);
  background: var(--cat-bg);
  color: var(--cat-color);
  height: 38px;
  border-radius: 12px;
  padding: 0 16px;
  border: 1.5px solid var(--cat-color);
  font-weight: 700;
  font-size: 0.82rem;
  transition: all 0.2s ease;
  margin: 0;
  flex-shrink: 0;
  width: auto;
}

.ion-palette-dark .modern-category-chip {
  --cat-bg: rgba(var(--ion-color-dark-rgb), 0.1);
}

.modern-category-chip.active {
  background: var(--cat-color) !important;
  color: var(--cat-contrast, #ffffff);
  border-color: var(--cat-color);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  transform: translateY(-1px);
}

.category-emoji { margin-right: 6px; font-size: 1.1rem; }

/* ===============================
   TOOLBAR IMPROVEMENTS
================================= */

/* Container overrides */
.actions-toolbar,
.filter-toolbar {
  --background: var(--ion-background-color);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  --border-width: 0;
}

ion-header {
  border-bottom: none !important;
  box-shadow: none !important;
}

ion-header :deep(app-header ion-toolbar) {
  --border-width: 0;
  border-bottom: none !important;
}

.header-main-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 16px;
  width: 100%;
}

.classic-action-btn {
  height: 50px;
  margin: 0;
  --color: var(--ion-color-dark);
  position: relative;
  font-weight: 700;
  text-transform: none;
}

.classic-action-btn ion-icon {
  font-size: 22px;
}

.sort-btn-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-label {
  margin-left: 4px;
  font-size: 13px;
}

.right-actions-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.badge-dot {
  position: absolute;
  top: 10px;
  right: 8px;
  width: 8px;
  height: 8px;
  background: var(--ion-color-carrot);
  border-radius: 50%;
  border: 2px solid var(--ion-background-color);
}



.search-container {
  padding: 0 16px 12px;
}

.search-row-toolbar {
  --min-height: auto;
}

/* Animation for searchbar row */
.fade-down-enter-active,
.fade-down-leave-active {
  transition: all 0.25s ease-out;
  transform-origin: top;
}

.fade-down-enter-from,
.fade-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.actions-toolbar,
.search-row-toolbar,
.filter-toolbar {
  --background: var(--ion-background-color);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  --border-width: 0;
}

.collapse-enter-active,
.collapse-leave-active {
  transition: max-height 0.3s ease, opacity 0.3s ease;
}

.collapse-enter-active,
.collapse-leave-active {
  transition: max-height 0.3s ease, opacity 0.3s ease;
}

.collapse-enter-from,
.collapse-leave-to {
  max-height: 0;
  opacity: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  max-height: 300px;
  opacity: 1;
}

.filter-section {
  padding-bottom: 16px;
}

.filter-group {
  margin: 16px 0;
}

.filter-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: var(--ion-color-dark);
  padding: 0 16px;
  margin-bottom: 8px;
}

.filter-title ion-icon {
  font-size: 16px;
  color: var(--ion-color-carrot);
}

.filter-clear-row {
  display: flex;
  justify-content: flex-start;
  padding: 4px 12px 8px;
}

.clear-chip {
  --background: rgba(255, 255, 255, 0.08);
  --color: var(--ion-color-medium);
  border: 1px dashed var(--ion-color-medium);
  border-radius: 999px;
  font-weight: 500;
  font-size: 13px;
  padding: 0 10px;
}

/* Badge Count for Filters */
.badge-count {
  position: absolute;
  top: 4px;
  right: 4px;
  background: var(--ion-color-carrot);
  color: white;
  font-size: 10px;
  min-width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-weight: bold;
  border: 1.5px solid var(--ion-background-color);
  pointer-events: none;
}

</style>

<style>
/* Force readable text colors for tiered cards in dark mode */
.ion-palette-dark .modern-product-card[class*="tier-card-"] .name {
  color: #ffffff !important;
}
</style>

