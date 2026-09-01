<template>
  <ion-page>

    <!-- ================= HEADER ================= -->
    <ion-header>

      <!-- Native (mobile) AdMob banner -->
      <div v-if="isNative && !isDonor" id="ad-space-trip" :style="{ height: '65px', paddingTop: 'var(--ion-safe-area-top, 0)' }"></div>

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
              <ion-item button :detail="false" @click="sortBy = 'recent'">
                <ion-icon :icon="timeOutline" slot="start" />
                <ion-label>{{ $t('trip.sortRecentShort') }}</ion-label>
                <ion-icon v-if="sortBy === 'recent'" :icon="checkmarkCircle" slot="end" color="success" style="font-size: 14px;" />
              </ion-item>
              
              <ion-item button :detail="false" @click="sortBy = 'views'">
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
                :activeRegion="filters.region"
                :activeHalalTier="filters.halalTier"
                :activeSource="filters.source"
                :hasActiveFilters="hasActiveFilters"
                @toggleCategory="toggleCategory"
                @toggleCity="toggleCity"
                @setRegion="setRegion"
                @setHalalTier="setHalalTier"
                @setSource="setSource"
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
              :activeRegion="filters.region"
              :activeHalalTier="filters.halalTier"
              :activeSource="filters.source"
              :hasActiveFilters="hasActiveFilters"
              @toggleCategory="toggleCategory"
              @toggleCity="toggleCity"
              @setRegion="setRegion"
              @setHalalTier="setHalalTier"
              @setSource="setSource"
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
              @click="book(trip)"
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

              <!-- Halal tier badge (top-right overlay) -->
              <div v-if="trip.halal?.halal_tier" :class="['halal-tier-badge', trip.halal.halal_tier]">
                <span>{{ trip.halal.halal_tier === 'gold' ? '🥇' : trip.halal.halal_tier === 'silver' ? '🥈' : '✅' }}</span>
                <span>{{ $t('trip.tier' + trip.halal.halal_tier.charAt(0).toUpperCase() + trip.halal.halal_tier.slice(1)) }}</span>
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

              <!-- Provider + Official tag / Klook source tag -->
              <div class="trip-card-provider-row">
                <span v-if="trip.provider?.name" class="trip-card-provider">
                  {{ $t('trip.providedBy') }} <strong>{{ trip.provider.name }}</strong>
                </span>
                <span v-else-if="trip.source === 'klook'" class="trip-klook-tag">
                  🧳 {{ $t('trip.poweredByKlook') }}
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
                      .map(tc => $i18n.locale === 'zh-tw' ? tc.name_zh : tc.name)
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

              <!-- Halal facility badges -->
              <div v-if="trip.halal" class="halal-facility-row">
                <span v-if="trip.halal.halal_lunch_included" class="halal-facility-chip">
                  🍽️ {{ $t('trip.halalLunchIncluded') }}
                </span>
                <span v-if="trip.halal.prayer_room_onsite" class="halal-facility-chip">
                  🕌 {{ $t('trip.prayerRoomOnsite') }}
                </span>
                <span v-if="trip.halal.mosque_stop_nearby" class="halal-facility-chip">
                  🧭 {{ $t('trip.mosqueStopNearby') }}
                </span>
                <span v-if="trip.halal.alcohol_pork_free_environment" class="halal-facility-chip">
                  🚫🍺 {{ $t('trip.alcoholPorkFree') }}
                </span>
              </div>

              <!-- Price + CTA -->
              <div class="trip-cta-row">
                <span v-if="trip.live_price ?? trip.min_price" class="trip-price">
                  {{ trip.currency }} {{ (trip.live_price ?? trip.min_price)!.toLocaleString() }}
                </span>
                <span v-else class="trip-price-placeholder" />
                <ion-button
                    size="small"
                    fill="solid"
                    color="carrot"
                    :disabled="trip.live_stock_status === 'sold_out'"
                    class="trip-cta-btn"
                    @click.stop="book(trip)"
                >
                  {{ trip.live_stock_status === 'sold_out' ? $t('trip.soldOut') : $t(ctaLabelKey(trip)) }}
                </ion-button>
              </div>
            </div>

            <!-- Premium Flare for Gold/Silver -->
            <div v-if="['gold', 'silver'].includes(String(trip.provider?.partner_tier || '').toLowerCase())" class="premium-flare"></div>
          </div>
        </template>
      </div>

      <ion-infinite-scroll :disabled="!hasMore" @ionInfinite="loadMore">
        <ion-infinite-scroll-content loading-spinner="bubbles" :loading-text="$t('common.loading')" />
      </ion-infinite-scroll>

    </ion-content>


  </ion-page>
</template>


<script setup lang="ts">
import {ref, computed, onMounted, onUnmounted, watch} from 'vue'
import { useI18n } from 'vue-i18n'
import {
  IonPage, IonContent, IonSearchbar, IonToolbar,
  IonButton, IonIcon, IonText,
  IonCard, IonCardContent, IonChip, IonSkeletonText, IonLabel, IonHeader, IonBadge, IonSelect, IonSelectOption,
  IonPopover, IonList, IonItem, IonModal, IonTitle, IonButtons, IonInfiniteScroll, IonInfiniteScrollContent, onIonViewDidEnter
} from '@ionic/vue'
import { Capacitor } from '@capacitor/core'
import { isDonor } from "@/composables/useSubscriptionStatus"
import { scheduleBannerUpdate } from '@/plugins/admob'

import {
  funnelOutline, chevronUpOutline, chevronDownOutline, mapOutline, compassOutline, locationOutline,
  searchOutline, closeCircle, timeOutline, checkmarkCircle, sparkles, shieldCheckmarkOutline, eyeOutline, flameOutline, calendarOutline, closeOutline
} from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import TripFilterContent from '@/components/TripFilterContent.vue'
import { ActivityLogService } from '@/services/ActivityLogService'
import { supabase } from '@/plugins/supabaseClient'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { flagBot } from '@/utils/botShield'
import { hasOrganicInteraction, delayForHuman } from '@/utils/interactionShield'
import { useRecaptcha } from '@/composables/useRecaptcha'
import { useTrips } from '@/composables/useTrips'
import { useKlookBooking } from '@/composables/useKlookBooking'
import type { HalalTier, TripSource } from '@/types/Trip'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(relativeTime)

const {
  trips, categories, loading, hasMore, filters,
  fetchTrips, fetchMore, fetchCategories, setFilters, clearFilters: clearTripFilters,
  refreshAvailability
} = useTrips()

const { book, ctaLabelKey } = useKlookBooking()

const searchQuery = ref('')
const showSearchbar = ref(false)
const showFilters = ref(false)
const isFilterModalOpen = ref(false)
const activeCategoryIds = ref<number[]>([])
const isNative = ref(Capacitor.isNativePlatform())
const { execute: executeRecaptcha, isCaptchaEnabled } = useRecaptcha()

const sortBy = computed<'recent' | 'views'>({
  get: () => filters.value.sortBy,
  set: (val) => setFilters({ sortBy: val })
})

onIonViewDidEnter(() => {
  scheduleBannerUpdate()
  refreshAvailability()
})

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
      !!filters.value.region ||
      !!filters.value.halalTier ||
      !!filters.value.source ||
      searchQuery.value.length > 0
  )
})

const activeFiltersCount = computed(() => {
  return (
      activeCategoryIds.value.length +
      activeCityIds.value.length +
      (filters.value.region ? 1 : 0) +
      (filters.value.halalTier ? 1 : 0) +
      (filters.value.source ? 1 : 0)
  )
})

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

/* Server-side filters (region/category/halalTier/search) are applied by useTrips;
   city selection stays a client-side refinement over the fetched page. */
const filteredTrips = computed(() => {
  if (activeCityIds.value.length === 0) return trips.value

  return trips.value.filter(trip =>
      trip.trip_cities?.some(tc => activeCityIds.value.includes(tc.slug))
  )
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
    cities: activeCityIds.value,
    region: filters.value.region,
    halal_tier: filters.value.halalTier
  })

  activeCategoryIds.value = []
  activeCityIds.value = []
  clearTripFilters()
}

function toggleCategory(id: number) {
  const isActive = activeCategoryIds.value.includes(id)
  activeCategoryIds.value = isActive ? [] : [id]

  ActivityLogService.log(isActive ? "trip_filter_category_remove" : "trip_filter_category_add", { category_id: id })
  setFilters({ categoryId: isActive ? null : id })
}

function setRegion(region: string | null) {
  ActivityLogService.log("trip_filter_region_set", { region })
  setFilters({ region })
}

function setHalalTier(tier: HalalTier | null) {
  ActivityLogService.log("trip_filter_halal_tier_set", { halal_tier: tier })
  setFilters({ halalTier: tier })
}

function setSource(source: TripSource | null) {
  ActivityLogService.log("trip_filter_source_set", { source })
  setFilters({ source })
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

  searchTimeout = window.setTimeout(async () => {
    if (q.length > 1) {
      // 🛡️ Level 2 Interaction & hCaptcha Attestation Guard for Trip Search
      if (!hasOrganicInteraction()) {
        flagBot('no_organic_interaction');
        return;
      }

      // Execute reCAPTCHA invisibly
      let captchaToken = 'disabled';
      if (isCaptchaEnabled) {
        try {
          captchaToken = await executeRecaptcha('trip');
        } catch (e) {
          console.error('🚨 reCAPTCHA verification failed in trip:', e);
          flagBot('captcha_challenge_failed');
          return;
        }
      }
      (window as any)._recaptchaToken = captchaToken;

      // Organic randomized human delay
      await delayForHuman();

      ActivityLogService.log("trip_search", { query: q })
    }

    setFilters({ search: q })
  }, 800)
}

function fromNow(dateString?: string) {
  if (!dateString) return ''
  return dayjs.utc(dateString).tz('Asia/Taipei').fromNow()
}

async function loadMore(ev: any) {
  await fetchMore()
  ev.target.complete()
}

watch(sortBy, (val) => {
  ActivityLogService.log("trip_sort_change", {
    sort_by: val
  })
})

onMounted(async () => {
  ActivityLogService.log("trip_page_open", {
    source: "main_navigation"
  })

  fetchCategories()
  fetchCities()
  await fetchTrips()
  refreshAvailability()
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

.premium-flare {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.05) 0%, transparent 50%, rgba(255, 215, 0, 0.05) 100%);
  z-index: 1;
}

.has-ads {
  background: var(--ion-background-color);
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

/* Halal tier badge (top-right overlay) */
.halal-tier-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 10px;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.3);
  background: rgba(16, 122, 84, 0.88);
  color: #ffffff;
}

.halal-tier-badge.gold {
  background: rgba(234, 179, 8, 0.88);
  color: #1a0e00;
}

.halal-tier-badge.silver {
  background: rgba(120, 130, 140, 0.88);
  color: #ffffff;
}

/* Halal facility chips row */
.halal-facility-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.halal-facility-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(16, 122, 84, 0.1);
  color: #0d7a54;
  border: 1px solid rgba(16, 122, 84, 0.25);
  border-radius: 999px;
  padding: 3px 9px;
  font-size: 0.68rem;
  font-weight: 700;
}

.ion-palette-dark .halal-facility-chip {
  background: rgba(52, 211, 153, 0.14);
  color: #6ee7b7;
  border-color: rgba(52, 211, 153, 0.3);
}

/* Price + CTA row */
.trip-cta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 4px;
  padding-top: 10px;
  border-top: 1px solid rgba(var(--ion-color-dark-rgb), 0.08);
}

.trip-price {
  font-size: 1rem;
  font-weight: 800;
  color: var(--ion-color-dark);
}

.trip-price-placeholder {
  flex: 1;
}

.trip-cta-btn {
  margin: 0;
  --border-radius: 12px;
  font-weight: 700;
  text-transform: none;
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

.trip-klook-tag {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--ion-color-medium);
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

