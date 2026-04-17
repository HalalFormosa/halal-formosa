<template>
  <ion-page>
    <ion-header>
      <app-header
          :title="$t('admin.userDetail')"
          :icon="personOutline"
          :showBack="true"
          :contrast="true"
      />
    </ion-header>

    <ion-content class="ion-padding content-background">

      <!-- ================= USER HEADER HERO ================= -->
      <div v-if="user" class="profile-hero">
        <ion-avatar class="hero-avatar">
          <img v-if="user.avatar_url" :src="user.avatar_url" />
          <div v-else class="avatar-placeholder-hero">
            {{ (user.display_name || '?').charAt(0).toUpperCase() }}
          </div>
        </ion-avatar>

        <div class="hero-text">
          <h1 class="hero-name">{{ user.display_name || $t('admin.unknownUser') }}</h1>
          <p class="hero-email">{{ user.email }}</p>
        </div>
      </div>

      <!-- ================= USER STATS GRID ================= -->
      <div v-if="summary" class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ summary.total_activities }}</div>
          <div class="stat-label">{{ $t('admin.activities') }}</div>
        </div>

        <div class="stat-card">
          <div class="stat-value-small">{{ fromNow(summary.last_active) }}</div>
          <div class="stat-label">{{ $t('admin.lastActiveLabel') }}</div>
        </div>

        <div class="stat-card">
          <div class="stat-value">{{ summary.points }}</div>
          <div class="stat-label">{{ $t('admin.points') }}</div>
        </div>

        <div class="stat-card">
          <div class="stat-value-small badge-text">{{ summary.donor_type || 'User' }}</div>
          <div class="stat-label">{{ $t('admin.accountType') }}</div>
        </div>
      </div>

      <!-- ================= USER PROFILE DETAILS ================= -->
      <ion-card v-if="user" class="details-card">
        <ion-card-header>
          <div class="card-title-row">
            <ion-icon :icon="personCircleOutline" class="card-icon" />
            <ion-card-title>{{ $t('admin.profileDetails') }}</ion-card-title>
          </div>
        </ion-card-header>

        <ion-list lines="none" class="details-list">
          <ion-item class="detail-item">
            <ion-label class="item-label">{{ $t('profile.editProfile.dob') }}</ion-label>
            <ion-note slot="end" class="item-value">{{ user.date_of_birth || '—' }}</ion-note>
          </ion-item>

          <ion-item class="detail-item">
            <ion-label class="item-label">{{ $t('profile.editProfile.nationality') }}</ion-label>
            <ion-note slot="end" v-if="getNationality(user.nationality)" class="item-value nationality-value">
              <img
                  :src="getNationality(user.nationality)?.flag"
                  :alt="$t('admin.flag')"
                  class="flag-img"
              />
              <span>{{ getNationality(user.nationality)?.name }}</span>
            </ion-note>
            <ion-note slot="end" v-else class="item-value">—</ion-note>
          </ion-item>

          <ion-item class="detail-item">
            <ion-label class="item-label">{{ $t('profile.editProfile.gender') }}</ion-label>
            <ion-note slot="end" class="item-value">{{ user.gender || '—' }}</ion-note>
          </ion-item>

          <ion-item class="detail-item">
            <div class="bio-section">
              <div class="item-label">{{ $t('profile.editProfile.bio') }}</div>
              <div class="bio-content">{{ user.bio || $t('profile.noBio') }}</div>
            </div>
          </ion-item>

          <div class="details-divider"></div>

          <ion-item class="detail-item">
            <ion-label class="item-label">{{ $t('admin.publicProfile') }}</ion-label>
            <ion-note slot="end" class="item-value" :class="{ 'text-success': user.public_profile }">
              {{ user.public_profile ? $t('common.yes') : $t('common.no') }}
            </ion-note>
          </ion-item>

          <ion-item class="detail-item">
            <ion-label class="item-label">{{ $t('admin.profileCompleted') }}</ion-label>
            <ion-note slot="end" class="item-value" :class="{ 'text-success': user.profile_completed_notified }">
              {{ user.profile_completed_notified ? $t('common.yes') : $t('common.no') }}
            </ion-note>
          </ion-item>
        </ion-list>
      </ion-card>


      <!-- ================= ADMIN METADATA ================= -->
      <ion-card class="details-card">
        <ion-card-header>
          <div class="card-title-row">
            <ion-icon :icon="settingsOutline" class="card-icon" />
            <ion-card-title>{{ $t('admin.technicalDetails') }}</ion-card-title>
          </div>
        </ion-card-header>

        <ion-list lines="none" class="details-list">
          <ion-item class="detail-item">
            <ion-label class="item-label">{{ $t('admin.userId') }}</ion-label>
            <ion-note slot="end" class="item-value mono">{{ userId }}</ion-note>
          </ion-item>

          <ion-item v-if="user?.created_at" class="detail-item">
            <ion-label class="item-label">{{ $t('admin.accountCreated') }}</ion-label>
            <ion-note slot="end" class="item-value">
              {{ new Date(user.created_at).toLocaleDateString() }}
            </ion-note>
          </ion-item>

          <ion-item v-if="user?.created_at" class="detail-item">
            <ion-label class="item-label">{{ $t('admin.memberSince') }}</ion-label>
            <ion-note slot="end" class="item-value">
              {{ sinceUser(user.created_at) }}
            </ion-note>
          </ion-item>


          <ion-item v-if="user?.last_sign_in_at">
            <ion-label>{{ $t('admin.lastSignInAuth') }}</ion-label>
            <ion-note slot="end">
              {{ fromNow(user.last_sign_in_at) }}
            </ion-note>
          </ion-item>

          <ion-item v-if="lastDevice?.last_scan_at">
            <ion-label>{{ $t('admin.lastScanActivity') }}</ion-label>
            <ion-note slot="end">
              {{ fromNow(lastDevice.last_scan_at) }}
            </ion-note>
          </ion-item>

          <ion-item v-if="lastDevice?.platform">
            <ion-label>{{ $t('admin.platform') }}</ion-label>
            <ion-note slot="end">
              {{ lastDevice.platform }}
            </ion-note>
          </ion-item>

          <ion-item v-if="lastDevice?.device_model">
            <ion-label>{{ $t('admin.device') }}</ion-label>
            <ion-note slot="end">
              {{ lastDevice.device_model }}
            </ion-note>
          </ion-item>

          <ion-item v-if="lastDevice?.app_version">
            <ion-label>{{ $t('admin.appVersion') }}</ion-label>
            <ion-note slot="end">
              {{ lastDevice.app_version }}
            </ion-note>
          </ion-item>

        </ion-list>
      </ion-card>

      <!-- 🔎 RECENT SEARCHES -->
      <ion-card class="modern-card">
        <ion-card-header>
          <div class="card-header-flex">
            <div class="title-with-icon">
              <ion-icon :icon="searchOutline" color="carrot" />
              <ion-card-title>{{ $t('admin.recentSearches') || 'Recent Searches' }}</ion-card-title>
            </div>
            <ion-button v-if="recentSearches.length >= 20" fill="clear" size="small" color="carrot" @click="openFullSearchHistory">
               {{ $t('common.viewMore') }}
               <ion-icon slot="end" :icon="chevronForwardOutline" />
            </ion-button>
          </div>
        </ion-card-header>

        <ion-list lines="none" v-if="recentSearches.length">
          <ion-item v-for="(s, i) in recentSearches" :key="i">
            <ion-icon :icon="searchOutline" slot="start" class="small-icon" />
            <ion-label>
              <strong>{{ s.search_text }}</strong>
              <p class="activity-time">{{ fromNow(s.searched_at) }}</p>
            </ion-label>
          </ion-item>
        </ion-list>

        <div v-else class="empty-state-small">
          <p>{{ $t('common.noData') === 'common.noData' ? 'No data found' : $t('common.noData') }}</p>
        </div>
      </ion-card>

      <!-- 📦 RECENT PRODUCTS -->
      <ion-card class="modern-card">
        <ion-card-header>
          <div class="title-with-icon">
            <ion-icon :icon="cubeOutline" color="carrot" />
            <ion-card-title>{{ $t('admin.recentProducts') || 'Recent Products' }}</ion-card-title>
          </div>
        </ion-card-header>

        <ion-list lines="none" v-if="recentProducts.length">
          <ion-item v-for="(p, i) in recentProducts" :key="i">
            <ion-thumbnail slot="start" v-if="p.product_image">
              <img :src="p.product_image" />
            </ion-thumbnail>
            <ion-icon v-else :icon="cubeOutline" slot="start" class="small-icon" />

            <ion-label>
              <strong>{{ p.product_name ?? `Barcode: ${p.product_id}` }}</strong>
              <p class="activity-time">{{ fromNow(p.viewed_at) }}</p>
            </ion-label>
          </ion-item>
        </ion-list>

        <div v-else class="empty-state-small">
          <p>{{ $t('common.noData') === 'common.noData' ? 'No data viewed' : $t('common.noData') }}</p>
        </div>
      </ion-card>

      <!-- 📍 RECENT PLACES -->
      <ion-card class="modern-card">
        <ion-card-header>
          <div class="title-with-icon">
            <ion-icon :icon="locationOutline" color="carrot" />
            <ion-card-title>{{ $t('admin.recentPlaces') || 'Recent Places' }}</ion-card-title>
          </div>
        </ion-card-header>

        <ion-list lines="none" v-if="recentPlaces.length">
          <ion-item v-for="(p, i) in recentPlaces" :key="i">
            <ion-thumbnail slot="start" v-if="p.place_image">
              <img :src="p.place_image" />
            </ion-thumbnail>
            <ion-icon v-else :icon="locationOutline" slot="start" class="small-icon" />

            <ion-label>
              <strong>{{ p.place_name ?? `Place #${p.place_id}` }}</strong>
              <p class="activity-time">{{ fromNow(p.interacted_at) }}</p>
            </ion-label>
          </ion-item>
        </ion-list>

        <div v-else class="empty-state-small">
          <p>{{ $t('common.noData') === 'common.noData' ? 'No places visited' : $t('common.noData') }}</p>
        </div>
      </ion-card>


      <!-- ================= ACTIVITY TIMELINE ================= -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ $t('admin.activityTimeline') }}</ion-card-title>
        </ion-card-header>

        <ion-list lines="none" class="details-list">
          <ion-item
              v-for="log in logs"
              :key="log.id"
              class="activity-item"
          >
            <ion-icon 
              slot="start" 
              :icon="getActivityIcon(log.activity_type)" 
              class="card-icon" 
            />
            <ion-label>
              <h3 class="activity-title">
                {{ describeActivity(log) }}
              </h3>

              <p class="activity-meta">
                {{ log.activity_group || 'general' }}
                <span v-if="log.entity_type">
                  • {{ log.entity_type }} {{ log.entity_id }}
                </span>
              </p>

              <p class="activity-time">
                {{ fromNow(log.created_at) }}
              </p>
            </ion-label>
          </ion-item>
        </ion-list>
      </ion-card>

      <!-- ================= SEARCH HISTORY MODAL ================= -->
      <ion-modal :is-open="showSearchModal" @didDismiss="closeSearchModal">
        <ion-header>
          <app-header
            :title="$t('admin.searchHistory')"
            :icon="searchOutline"
            :showBack="true"
            :useRouterBack="false"
            @back="closeSearchModal"
            :contrast="true"
          />
        </ion-header>
        
        <ion-content class="ion-padding modal-content">
          <ion-list lines="none" v-if="fullSearchHistory.length">
            <ion-item v-for="(s, i) in fullSearchHistory" :key="i" class="history-modal-item">
              <ion-icon :icon="searchOutline" slot="start" class="history-icon" />
              <ion-label>
                <h3 class="history-text">{{ s.search_text }}</h3>
                <p class="activity-time">{{ fromNow(s.searched_at) }}</p>
              </ion-label>
            </ion-item>
          </ion-list>
          
          <div v-else-if="!loadingFullHistory" class="empty-state-modal">
            <ion-icon :icon="searchOutline" />
            <p>{{ $t('common.noData') }}</p>
          </div>

          <ion-infinite-scroll
            @ionInfinite="loadMoreFullHistory"
            :disabled="noMoreFullHistory"
            threshold="100px"
          >
            <ion-infinite-scroll-content
              loading-spinner="bubbles"
              :loading-text="$t('common.loading')"
            />
          </ion-infinite-scroll>
        </ion-content>
      </ion-modal>

      <!-- ================= INFINITE SCROLL ================= -->
      <ion-infinite-scroll
          threshold="100px"
          @ionInfinite="loadMore"
          :disabled="noMoreData"
      >
        <ion-infinite-scroll-content
            loading-spinner="bubbles"
            :loading-text="$t('admin.loadingActivity')"
        />
      </ion-infinite-scroll>

    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '@/plugins/supabaseClient'
import { countries, loadCountries } from '@/composables/useCountries'

import {
  IonPage,
  IonHeader,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonItem,
  IonLabel,
  IonAvatar,
  IonList,
  IonNote,
  IonThumbnail,
  IonCardContent,
  IonModal,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonButton,
  IonIcon
} from '@ionic/vue'

import AppHeader from '@/components/AppHeader.vue'
import { personOutline, personCircleOutline, settingsOutline, timeOutline, personAddOutline, phonePortraitOutline, cubeOutline, locationOutline, barcodeOutline, searchOutline, chevronForwardOutline, homeOutline, pulseOutline } from 'ionicons/icons'
import { useI18n } from 'vue-i18n'

import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
dayjs.extend(relativeTime)

const route = useRoute()
const { t } = useI18n()
const userId = route.params.id as string

const user = ref<any | null>(null)
const summary = ref<any | null>(null)
const logs = ref<any[]>([])

const limit = 20
const noMoreData = ref(false)
const loadingMore = ref(false)
const recentSearches = ref<any[]>([])
const recentProducts = ref<any[]>([])
const recentPlaces = ref<any[]>([])

// Full search history modal state
const showSearchModal = ref(false)
const fullSearchHistory = ref<any[]>([])
const fullSearchHistoryLimit = 20
const noMoreFullHistory = ref(false)
const loadingFullHistory = ref(false)

async function fetchRecents() {
  const [searchRes, productRes, placeRes] = await Promise.all([
    supabase.rpc('get_user_recent_searches', {
      p_user_id: userId,
      p_limit: 20,
      p_offset: 0
    }),
    supabase.rpc('get_user_recent_products', {
      p_user_id: userId,
      p_limit: 20
    }),
    supabase.rpc('get_user_recent_places', {
      p_user_id: userId,
      p_limit: 20
    }),
  ])


  if (searchRes.error) console.error('❌ Search History RPC Error:', searchRes.error)
  if (productRes.error) console.error('❌ Product History RPC Error:', productRes.error)
  if (placeRes.error) console.error('❌ Place History RPC Error:', placeRes.error)

  if (!searchRes.error) recentSearches.value = searchRes.data ?? []
  if (!productRes.error) recentProducts.value = productRes.data ?? []
  if (!placeRes.error) recentPlaces.value = placeRes.data ?? []

}

async function openFullSearchHistory() {
  showSearchModal.value = true
  await fetchFullSearchHistory(true)
}

function closeSearchModal() {
  showSearchModal.value = false
}

async function fetchFullSearchHistory(reset = false) {
  if (reset) {
    fullSearchHistory.value = []
    noMoreFullHistory.value = false
  }

  const offset = fullSearchHistory.value.length
  loadingFullHistory.value = true

  const { data, error } = await supabase.rpc('get_user_recent_searches', {
    p_user_id: userId,
    p_limit: fullSearchHistoryLimit,
    p_offset: offset
  })

  loadingFullHistory.value = false

  if (error) {
    console.error('❌ Failed to load full search history', error)
    return
  }

  if (!data || data.length < fullSearchHistoryLimit) {
    noMoreFullHistory.value = true
  }

  if (data) {
    fullSearchHistory.value.push(...data)
  }
}

async function loadMoreFullHistory(event: any) {
  if (loadingFullHistory.value || noMoreFullHistory.value) {
    event.target.complete()
    return
  }

  await fetchFullSearchHistory()
  event.target.complete()
}

/* Helpers */
const sinceUser = (date: string) => {
  return dayjs(date).fromNow(true) + ' ago'
}

const fromNow = (date?: string) =>
    date ? dayjs(date).fromNow() : t('admin.never')

const lastDevice = ref<any | null>(null)

async function fetchLastDevice() {
  const { data, error } = await supabase.rpc(
      'get_user_last_device',
      { p_user_id: userId }
  )

  if (error) {
    console.error('❌ Failed to load device info', error)
    return
  }

  lastDevice.value = data?.[0] ?? null
}

function getNationality(code?: string) {
  if (!code) return null
  const c = countries.value.find(c => c.cca2 === code)
  if (!c) return null
  return {
    name: c.name.common,
    flag: c.flags.png
  }
}

function parseDetail(detail: any) {
  if (!detail) return {}
  if (typeof detail === 'string') {
    try {
      return JSON.parse(detail)
    } catch {
      return {}
    }
  }
  return detail
}

function getActivityIcon(type: string) {
  if (type.includes('home')) return homeOutline
  if (type.includes('explore') || type.includes('marker') || type.includes('place')) return locationOutline
  if (type.includes('search')) return searchOutline
  if (type.includes('product')) return cubeOutline
  if (type.includes('scan')) return barcodeOutline
  if (type.includes('profile') || type.includes('social')) return personOutline
  return pulseOutline
}

function describeActivity(log: any) {
  const d = parseDetail(log.activity_detail)

  switch (log.activity_type) {
    /* ---------- HOME ---------- */
    case 'home_page_open':
      return t('admin.activities_desc.home_page_open')
    case 'home_scan_ingredient':
      return t('admin.activities_desc.home_scan_ingredient')
    case 'home_viewmore_products':
      return t('admin.activities_desc.home_viewmore_products')
    case 'home_open_locations':
      return t('admin.activities_desc.home_open_locations')
    case 'home_leaderboard_profile':
      return t('admin.activities_desc.home_leaderboard_profile', { user: d.display_name || '?' })

    /* ---------- EXPLORE ---------- */
    case 'explore_page_open':
      return t('admin.activities_desc.explore_page_open')
    case 'explore_center_user':
      return t('admin.activities_desc.explore_center_user')
    case 'explore_filter_category':
      return t('admin.activities_desc.explore_filter_category', { category: d.category_name || '?' })
    case 'explore_marker_click':
      return t('admin.activities_desc.explore_marker_click', { name: d.name || '?' })
    case 'explore_place_card_click':
      return t('admin.activities_desc.explore_place_card_click', { name: d.name || '?' })
    case 'explore_place_detail_open':
      return t('admin.activities_desc.explore_place_detail_open', { name: d.name || '?' })
    case 'explore_place_detail_view':
      return t('admin.activities_desc.explore_place_detail_view', { name: d.name || '?' })
    case 'explore_detail_open_image':
      return t('admin.activities_desc.explore_detail_open_image', { name: d.name || '?' })

    /* ---------- SEARCH ---------- */
    case 'search_page_open':
      return t('admin.activities_desc.search_page_open')
    case 'search_query':
    case 'explore_search_query':
    case 'store_search':
    case 'explore_address_search':
    case 'trip_search':
      return t('admin.activities_desc.search_performed', { query: d.query || '?' })
    case 'search_product_click':
      return t('admin.activities_desc.search_product_click', { name: d.product_name || '?' })
    case 'search_sort_change':
      return t('admin.activities_desc.search_sort_change', { sort: d.sort || '?' })
    case 'search_filter_status':
      return t('admin.activities_desc.search_filter_status', { status: d.status || '?' })
    case 'search_filter_category':
      return t('admin.activities_desc.search_filter_category', { category: d.category_name || '?' })

    /* ---------- PRODUCT ---------- */
    case 'product_details_open':
      return t('admin.activities_desc.product_details_open', { name: d.product_name || '?' })

    /* ---------- SCAN ---------- */
    case 'scan_ingredients_start':
      return t('admin.activities_desc.scan_ingredients_start', { source: d.source || '?' })
    case 'scan_ingredients_success':
      const prod = d.product_name || '?'
      const status = d.auto_status || '?'
      return t('admin.activities_desc.scan_ingredients_success', { product: prod, status: status })
    case 'scan_ingredients_error':
      return t('admin.activities_desc.scan_ingredients_error', { error: d.error || '?' })

    /* ---------- PROFILE ---------- */
    case 'profile_page_open':
      return t('admin.activities_desc.profile_page_open')
    case 'social_link_click':
      return t('admin.activities_desc.social_link_click', { platform: d.platform || '?' })

    /* ---------- FALLBACK ---------- */
    default:
      return log.activity_type.replace(/_/g, ' ')
  }
}



/* Fetch user profile */
async function fetchUser() {
  const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

  user.value = data
}

/* Fetch summary (reuse admin list logic via RPC) */
async function fetchSummary() {
  const { data } = await supabase.rpc(
      'get_admin_user_summary',
      { p_user_id: userId }
  )


  summary.value = data?.find((u: any) => u.user_id === userId)
}

/* Fetch activity logs */
async function fetchLogs(reset = false) {
  if (reset) {
    logs.value = []
    noMoreData.value = false
  }

  const offset = logs.value.length

  const { data, error } = await supabase.rpc(
      'get_user_activity_logs',
      {
        p_user_id: userId,
        p_limit: limit,
        p_offset: offset
      }
  )


  if (error) {
    console.error('❌ Failed to load activity logs', error)
    return
  }

  if (!data || data.length < limit) {
    noMoreData.value = true
  }

  logs.value.push(...data)
}

async function loadMore(event: any) {
  if (loadingMore.value || noMoreData.value) {
    event.target.complete()
    return
  }

  loadingMore.value = true
  await fetchLogs()
  loadingMore.value = false
  event.target.complete()
}

onMounted(async () => {
  if (!countries.value.length) {
    await loadCountries()
  }

  await fetchUser()
  await fetchSummary()
  await fetchLastDevice()
  await fetchRecents()
  await fetchLogs(true)
})


</script>

<style scoped>
.content-background {
  --background: var(--ion-background-color);
}

/* Hero Section */
.profile-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 16px;
  text-align: center;
  background: var(--ion-background-color);
  margin-bottom: 8px;
}

.hero-avatar {
  width: 90px;
  height: 90px;
  margin-bottom: 16px;
  border: 3px solid var(--ion-color-carrot);
  padding: 3px;
  background: var(--ion-background-color);
}

.avatar-placeholder-hero {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: var(--ion-color-step-150);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.5rem;
  font-weight: 800;
  color: var(--ion-color-carrot);
}

.hero-name {
  margin: 0 0 4px 0;
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--ion-text-color);
}

.hero-email {
  margin: 0;
  font-size: 0.95rem;
  color: var(--ion-color-medium);
  font-weight: 500;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 24px;
}

.stat-card {
  background: var(--ion-color-step-50);
  padding: 16px 12px;
  border-radius: 16px;
  text-align: center;
  border: 1px solid var(--ion-color-step-100);
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 90px;
}

.stat-value {
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--ion-color-carrot);
  margin-bottom: 2px;
}

.stat-value-small {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--ion-color-carrot);
  margin-bottom: 4px;
}

.stat-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ion-color-medium);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.badge-text {
  background: rgba(var(--ion-color-carrot-rgb), 0.15);
  padding: 4px 12px;
  border-radius: 99px;
  display: inline-block;
  align-self: center;
}

/* Information Cards */
.details-card {
  margin: 0 0 24px 0;
  background: var(--ion-background-color);
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--ion-color-step-100);
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-icon {
  font-size: 20px;
  color: var(--ion-color-carrot);
}

.details-list {
  background: transparent;
  padding-bottom: 8px;
}

.detail-item {
  --padding-start: 16px;
  --padding-end: 16px;
  --min-height: 54px;
}

.item-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ion-color-step-600);
}

.item-value {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--ion-text-color);
}

.nationality-value {
  display: flex;
  align-items: center;
  gap: 8px;
}

.flag-img {
  width: 20px;
  height: 14px;
  border-radius: 2px;
  object-fit: cover;
}

.bio-section {
  padding: 8px 0;
  width: 100%;
}

.bio-content {
  margin-top: 6px;
  font-size: 0.95rem;
  color: var(--ion-text-color);
  line-height: 1.5;
  font-weight: 500;
}

.details-divider {
  height: 1px;
  background: var(--ion-color-step-100);
  margin: 8px 16px;
}

.text-success {
  color: var(--ion-color-success);
}

.mono {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.8rem;
  letter-spacing: -0.5px;
}

/* Activity Feed */
.activity-item {
  --padding-start: 16px;
  --padding-bottom: 12px;
  --padding-top: 12px;
}

.activity-title {
  font-weight: 700;
  font-size: 1rem;
  color: var(--ion-text-color);
  margin-bottom: 4px;
}

.activity-meta {
  font-size: 0.85rem;
  color: var(--ion-color-medium);
  margin-bottom: 4px;
}

.activity-time {
  font-size: 0.75rem;
  color: var(--ion-color-step-400);
  font-weight: 600;
}

/* Dark Mode Adjustments */
.ion-palette-dark .stat-card,
.ion-palette-dark .details-card {
  background: var(--ion-color-step-50);
  border-color: var(--ion-color-step-150);
}

.ion-palette-dark .avatar-placeholder-hero {
  background: var(--ion-color-step-150);
}

.card-footer-action {
  padding: 0 16px 12px;
  display: flex;
  justify-content: flex-end;
}

.history-modal-item {
  --padding-top: 12px;
  --padding-bottom: 12px;
}

.history-icon {
  color: var(--ion-color-medium);
  font-size: 1.2rem;
  margin-right: 12px;
}

.history-text {
  font-weight: 600;
  margin-bottom: 4px;
}

.empty-state-modal {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--ion-color-medium);
  text-align: center;
}

.empty-state-modal ion-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.3;
}

.empty-state-small {
  padding: 16px;
  text-align: center;
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}

.card-header-flex {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.title-with-icon {
  display: flex;
  align-items: center;
  gap: 10px;
}

.small-icon {
  font-size: 16px;
  color: var(--ion-color-medium);
  min-width: 24px;
}
</style>

