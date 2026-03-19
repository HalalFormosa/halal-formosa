<template>
  <ion-page>
    <ion-header>
      <app-header :title="$t('home.title')" :showProfile="true" />
    </ion-header>

    <ion-content class="ion-padding">
      <!-- === Announcement Banner === -->
      <transition name="slide-down">
        <div v-if="showAnnouncement && announcement" class="announcement-banner" :class="[announcement.type || 'info', { 'clickable': announcement.link_url }]">
          <div class="announcement-content" @click="handleBannerClick">
            <template v-if="announcement.image_url">
              <div class="announcement-thumb-wrapper">
                <img :src="announcement.image_url" class="announcement-thumb" alt="announcement" />
              </div>
            </template>
            <ion-icon v-else :icon="sparkles" class="announcement-icon" />
            <div class="announcement-text">
              <span class="announcement-title">{{ announcement.title }}</span>
              <p class="announcement-body">{{ announcement.content }}</p>
            </div>
          </div>
          <ion-button fill="clear" color="dark" class="close-btn" @click.stop="dismissAnnouncement">
            <ion-icon :icon="closeOutline" />
          </ion-button>
        </div>
      </transition>

      <!-- === Prayer Times Horizontal === -->
      <ion-card>
        <ion-card-header>
          <div class="prayer-header-row">
            <ion-card-title>
              <template v-if="nextPrayer && userLocation">
                <div class="prayer-title-main">
                  {{ $t('home.prayerNotification', { label: nextPrayer.label, time: upcomingCountdown }) }}
                </div>
                <div class="prayer-title-location">
                  <ion-icon :icon="locationOutline" slot="start" /> {{ userLocation.city || $t('home.currentLocation') }}
                </div>
              </template>
              <template v-else>
                {{ $t('home.prayerTimes') }}
              </template>
            </ion-card-title>

            <!-- 🧭 Find Qibla (header action) -->
            <div class="prayer-header-actions">
              <ion-button
                  size="small"
                  fill="clear"
                  color="carrot"
                  class="qibla-header-btn"
                  @click="handleRefreshLocation"
                  :disabled="loadingPrayerTimes"
              >
                <ion-icon :icon="locateOutline" />
              </ion-button>

              <ion-button
                  size="small"
                  fill="clear"
                  color="carrot"
                  class="qibla-header-btn"
                  @click="goQibla"
              >
                <ion-icon :icon="compassOutline" slot="start" />
                {{ $t('home.qibla') }}
              </ion-button>
            </div>
          </div>
        </ion-card-header>



        <ion-card-content>
          <!-- 🔹 Skeleton: Prayer pills -->
          <div
              v-if="loadingPrayerTimes"
              class="prayer-horizontal"
          >
            <div
                v-for="n in 5"
                :key="'prayer-skel-' + n"
                class="prayer-pill skeleton"
            >
              <ion-skeleton-text
                  animated
                  style="width: 50%; height: 12px; border-radius: 6px;"
              />
              <ion-skeleton-text
                  animated
                  style="width: 70%; height: 22px; margin-top: 6px; border-radius: 6px;"
              />
            </div>
          </div>

          <!-- 🔹 Skeleton: Qibla button -->
          <div
              v-if="loadingPrayerTimes"
              class="qibla-row"
          >
            <ion-skeleton-text
                animated
                style="width: 110px; height: 28px; border-radius: 999px;"
            />
          </div>

          <!-- 🔹 Real content -->
          <template v-else>
            <div
                class="prayer-horizontal"
                ref="prayerScroll"
            >
              <div class="prayer-track">
                <div
                    v-for="p in prayerList"
                    :key="p.key"
                    :data-key="p.key"
                    :class="[
  'prayer-pill',
  p.key === currentPrayerKey ? 'active' : ''
]"
                >
                  <span class="label">{{ p.label }}</span>
                  <span class="time">{{ p.time }}</span>
                </div>
              </div>
            </div>

          </template>
        </ion-card-content>

      </ion-card>



      <!-- === Main Feature: Scan === -->
      <ion-card class="main-feature-section clear-card">
        <div class="main-features-grid">
          <button class="feature-card feature-primary" @click="goScan">
            <div class="feature-icon-wrapper">
              <ion-icon :icon="scanOutline" />
            </div>
            <div class="feature-text">
              <h3>{{ $t('home.scan') }}</h3>
              <p>{{ $t('home.scanDesc') }}</p>
            </div>
            <div class="feature-bg-icon">
              <ion-icon :icon="scanOutline" />
            </div>
          </button>
          
          <button class="feature-card feature-secondary" @click="goToSearchAndScan">
            <div class="feature-icon-wrapper">
              <ion-icon :icon="barcodeOutline" />
            </div>
            <div class="feature-text">
              <h3>{{ $t('home.scanBarcode') }}</h3>
              <p>{{ $t('home.scanBarcodeDesc') }}</p>
            </div>
            <div class="feature-bg-icon">
              <ion-icon :icon="barcodeOutline" />
            </div>
          </button>
        </div>
      </ion-card>

      <!-- === Our Partner=== -->
      <ion-card>
        <ion-card-header>
          <div class="card-header-row">
            <ion-card-title>
              {{ $t('home.ourPartners') }}
            </ion-card-title>

            <ion-button
                fill="clear"
                size="small"
                color="carrot"
                @click="viewMorePartners"
            >
              {{ $t('home.viewMore') }}
            </ion-button>
          </div>
        </ion-card-header>

        <ion-card-content>
          <div v-if="loadingPartners" class="discover-grid compact-grid">
            <ion-card
                v-for="n in 5"
                :key="'partner-skel-' + n"
                class="discover-item discover-item--compact"
            >
              <ion-skeleton-text animated style="width:100%;height:120px;border-radius:12px;" />
              <ion-skeleton-text animated style="width:80%;height:14px;margin:6px auto;" />
            </ion-card>
          </div>

          <div v-else class="discover-grid compact-grid">
            <ion-card
                v-for="partner in displayedPartners"
                :key="partner.id"
                :class="[
  'discover-item',
  'discover-item--compact',
  partner.partner_tier ? 'tier-card-' + partner.partner_tier.toLowerCase() : ''
]"

                button
                @click="openPartner(partner)"
            >
              <ion-badge
                  v-if="partner.partner_tier"
                  :class="['tier-badge', partner.partner_tier.toLowerCase()]"
              >
              <ion-icon :icon="sparkles" />
              {{ $t('home.partnerTier', { tier: (partner.partner_tier || '').toUpperCase() }) }}
              </ion-badge>


              <img
                  :src="partner.logo"
                  :alt="partner.name"
                  class="discover-img discover-img--compact"
              />

              <ion-label class="discover-label discover-label--compact">
                <p class="discover-name">
                  {{ partner.name }}
                </p>
              </ion-label>
              <!-- Premium Flare for Gold/Silver -->
              <div v-if="['gold', 'silver'].includes(String(partner.partner_tier || '').toLowerCase())" class="premium-flare"></div>
            </ion-card>

          </div>
        </ion-card-content>

      </ion-card>

      <!-- === Daily Missions === -->
      <DailyMissions v-if="isAuthenticated" />


      <!-- === Discover Products === -->
      <ion-card>
        <ion-card-header>
          <div class="card-header-row">
            <ion-card-title>{{ $t('home.discoverProducts') }}</ion-card-title>
            <ion-button
                fill="clear"
                size="small"
                color="carrot"
                @click="viewMoreProducts"
            >
              {{ $t('home.viewMore') }}
            </ion-button>
          </div>
        </ion-card-header>

        <ion-card-content>
          <!-- 🔹 Skeleton loader -->
          <div v-if="loadingProducts" class="discover-grid">
            <ion-card v-for="n in 5" :key="'skeleton-p-' + n" class="discover-item">
              <ion-skeleton-text animated style="width: 100%; height: 140px; border-radius: 12px;" />
              <ion-skeleton-text animated style="width: 95%; height: 30px; margin: 6px auto;" />
              <ion-skeleton-text animated style="width: 40%; height: 12px; margin: 0 auto;" />
            </ion-card>
          </div>

          <!-- 🔹 Real content -->
          <div v-else class="discover-grid">
            <ion-card
                v-for="p in recentProducts"
                :key="p.barcode"
                :class="[
                  'discover-item', 
                  p.partner_tier ? 'tier-card-' + p.partner_tier.toLowerCase() : ''
                ]"
                button
                @click="openProduct(p)"
            >
              <!-- Tier Badge -->
              <ion-badge
                  v-if="p.partner_tier"
                  :class="['tier-badge', p.partner_tier.toLowerCase()]"
              >
                <ion-icon :icon="sparkles" />
                <span>{{ $t('home.partnerTier', { tier: (p.partner_tier || '').toUpperCase() }) }}</span>
              </ion-badge>

              <!-- Shine Effect (Gold ONLY) -->
              <div v-if="['gold', 'silver'].includes(String(p.partner_tier || '').toLowerCase())" class="premium-flare"></div>

              <img :src="p.image || 'https://placehold.co/200x200'" :alt="$t('home.altProduct')" class="discover-img" />
              <ion-label class="discover-label">
                <div class="status-row">
                  <ion-chip
                      :class="p.status === 'Halal' ? 'chip-success'
                : p.status === 'Muslim-friendly' ? 'chip-primary'
                : p.status === 'Syubhah' ? 'chip-warning'
                : p.status === 'Haram' ? 'chip-danger'
                : 'chip-medium'"
                      style="font-size: 14px; margin-bottom: 4px;"
                  >
                    {{ $t('search.status.' + p.status) }}
                  </ion-chip>

                  <!-- Official Partner Tag -->
                  <div v-if="p.partner_tier" class="home-partner-verified">
                    <ion-icon :icon="shieldCheckmarkOutline" />
                  </div>
                </div>
                <p>{{ $t('home.added') }} {{ fromNowToTaipei(p.created_at) }}</p>
              </ion-label>
            </ion-card>
          </div>
        </ion-card-content>
      </ion-card>


      <!-- === Discover Locations === -->
      <ion-card>
        <ion-card-header>
          <div class="card-header-row">
            <ion-card-title>{{ $t('home.discoverLocations') }}</ion-card-title>
            <ion-button
                fill="clear"
                size="small"
                color="carrot"
                @click="viewMoreLocations"
            >
              {{ $t('home.viewMore') }}
            </ion-button>
          </div>
        </ion-card-header>
        <ion-card-content>
          <div v-if="loadingLocations" class="discover-grid">
            <ion-card v-for="n in 5" :key="'skeleton-l-' + n" class="discover-item">
              <ion-skeleton-text animated style="width: 100%; height: 140px; border-radius: 12px;" />
              <ion-skeleton-text animated style="width: 90%; height: 12px; margin: 6px auto;" />
              <ion-skeleton-text animated style="width: 80%; height: 12px; margin: 6px auto;" />
              <ion-skeleton-text animated style="width: 40%; height: 12px; margin: 0 auto;" />
            </ion-card>
          </div>

          <div v-else class="discover-grid">
            <ion-card
                v-for="loc in recentLocations"
                :key="loc.id"
                :class="[
                  'discover-item', 
                  loc.partner_tier ? 'tier-card-' + loc.partner_tier.toLowerCase() : ''
                ]"
                button
                @click="openLocation(loc)"
            >
              <!-- Tier Badge -->
              <ion-badge
                  v-if="loc.partner_tier"
                  :class="['tier-badge', loc.partner_tier.toLowerCase()]"
              >
                <ion-icon :icon="sparkles" />
                <span>{{ $t('home.partnerTier', { tier: (loc.partner_tier || '').toUpperCase() }) }}</span>
              </ion-badge>

              <!-- Premium Flare for Gold/Silver -->
              <div v-if="['gold', 'silver'].includes(String(loc.partner_tier || '').toLowerCase())" class="premium-flare"></div>

              <img
                  :src="loc.image || 'https://placehold.co/200x200'"
                  :alt="$t('home.altLocation')"
                  class="discover-img"
              />
              <ion-label class="discover-label">
                <div class="name-row">
                  <h3>{{ loc.name }}</h3>
                  <!-- Official Partner Tag -->
                  <div v-if="loc.partner_tier" class="home-partner-verified">
                    <ion-icon :icon="shieldCheckmarkOutline" />
                  </div>
                </div>
                <p>{{ $t('home.added') }} {{ fromNowToTaipei(loc.created_at) }}</p>
              </ion-label>
            </ion-card>
          </div>
        </ion-card-content>
      </ion-card>

      <!-- === Latest News === -->
      <ion-card>
        <ion-card-header>
          <div class="card-header-row">
            <ion-card-title>
              {{ $t('home.latestNews') }}
            </ion-card-title>

            <ion-button
                fill="clear"
                size="small"
                color="carrot"
                @click="viewMoreNews"
            >
              {{ $t('home.viewMore') }}
            </ion-button>
          </div>
        </ion-card-header>

        <ion-card-content>
          <!-- 🔹 Skeleton -->
          <div v-if="loadingNews" class="discover-grid">
            <ion-card
                v-for="n in 5"
                :key="'news-skeleton-' + n"
                class="discover-item"
            >
              <ion-skeleton-text animated style="width:100%;height:140px;border-radius:12px;" />
              <ion-skeleton-text animated style="width:90%;height:14px;margin:6px auto;" />
              <ion-skeleton-text animated style="width:60%;height:12px;margin:0 auto;" />
            </ion-card>
          </div>

          <!-- 🔹 Real News -->
          <div v-else class="discover-grid">
            <ion-card
                v-for="news in recentNews"
                :key="news.id"
                class="discover-item"
                button
                @click="openNews(news)"
            >
              <img
                  :src="news.cover || 'https://placehold.co/400x250?text=News'"
                  class="discover-img"
                  :alt="$t('home.altNews')"
              />

              <ion-label class="discover-label">
                <h3 class="discover-name">
                  {{ news.title }}
                </h3>

                <p style="font-size:12px;color:var(--ion-color-medium);">
                  {{ fromNowToTaipei(news.created_at) }}
                </p>
              </ion-label>
            </ion-card>
          </div>
        </ion-card-content>
      </ion-card>


      <!-- === Insights Horizontal Scroll === -->
      <div class="insights-container">
        <div class="insights-scroll">
          <!-- Card 1: Total Products -->
          <div class="insight-card stat-card">
            <div class="stat-icon-wrapper products">
              <ion-icon :icon="sparkles" />
            </div>
            <div class="stat-content">
              <span class="stat-label">{{ $t('home.totalProducts') }}</span>
              <h2 class="stat-value">{{ totalProductCount }}</h2>
            </div>
          </div>

          <!-- Card 2: Total Locations -->
          <div class="insight-card stat-card">
            <div class="stat-icon-wrapper locations">
              <ion-icon :icon="locationOutline" />
            </div>
            <div class="stat-content">
              <span class="stat-label">{{ $t('home.totalLocations') }}</span>
              <h2 class="stat-value">{{ totalLocationCount }}</h2>
            </div>
          </div>

          <!-- Card 3: Product Status Chart -->
          <div class="insight-card chart-card">
            <div class="insight-header">
              <h3>{{ $t('home.productStatus') }}</h3>
            </div>
            <div class="chart-wrapper">
              <DoughnutChart ref="doughnutRef" :data="statusChartData" :options="chartOptions" />
            </div>
          </div>

          <!-- Card 4: Location Categories Chart -->
          <div class="insight-card chart-card">
            <div class="insight-header">
              <h3>{{ $t('home.locationCategories') }}</h3>
            </div>
            <div class="chart-wrapper">
              <DoughnutChart ref="locationChartRef" :data="locationChartData" :options="chartOptions" />
            </div>
          </div>
        </div>
      </div>

      <!-- === Leaderboard === -->
      <ion-card >
        <ion-card-header>
          <ion-card-title>{{ $t('home.leaderboard') }}</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <ion-list v-if="!loadingLeaderboard">
            <ion-item
                v-for="(user, index) in leaderboard"
                :key="user.id"
                lines="none"
                button
                @click="openUserProfile(user, $event)"
            >
              <div style="display: flex; align-items: center; width: 100%;">

                <!-- Rank -->
                <div style="width: 28px; text-align: center; font-weight: 600; display: flex; align-items: center; justify-content: center;">
                  <ion-icon v-if="index === 0" :icon="medalOutline" style="color: #FFD700; font-size: 1.2rem;" />
                  <ion-icon v-else-if="index === 1" :icon="medalOutline" style="color: #C0C0C0; font-size: 1.2rem;" />
                  <ion-icon v-else-if="index === 2" :icon="medalOutline" style="color: #CD7F32; font-size: 1.2rem;" />
                  <span v-else>{{ index + 1 }}</span>
                </div>

                <!-- Avatar -->
                <ion-avatar style="width: 40px; height: 40px; margin: 0 10px;">
                  <img
                      :src="user.public_profile ? (user.avatar_url || 'https://placehold.co/64x64') : `https://placehold.co/64x64?text=${$t('home.unknownAvatar')}`"
                       :alt="$t('home.altAvatar')"/>
                </ion-avatar>

                <!-- Info -->
                <ion-label style="flex: 1; min-width: 0;">
                  <h2 style="margin: 0; font-weight: 600; font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    {{ user.public_profile ? user.display_name : $t('home.anonymousWithIndex', { index: index + 1 }) }}
                  </h2>
                  <p style="margin: 0; font-size: 0.8rem; color: var(--ion-color-medium);">
                    {{ $t('profile.level', { level: getLevelFromPoints(user.points) }) }}
                  </p>
                </ion-label>

                <!-- Points Badge -->
                <ion-badge
                    :color="getLevelColor(user.points)"
                    style="white-space: nowrap; font-size: 0.75rem; min-width: 70px; text-align: center;"
                >
                  {{ $t('home.pointsCount', { points: user.points }) }}
                </ion-badge>

              </div>
            </ion-item>
          </ion-list>


          <ion-skeleton-text
              v-else
              animated
              style="width:100%;height:120px;border-radius:8px;"
          />
        </ion-card-content>
      </ion-card>
    </ion-content>

    <!-- 👇 Popover instead of modal -->
    <ion-popover
        :is-open="!!selectedUser"
        :event="popoverEvent"
        class="leaderboard-popover"
        @didDismiss="closePopover"
    >
      <ion-content class="ion-padding" style="text-align:center; min-width: 250px;">
        <div v-if="selectedUser">

          <!-- ✅ Public profile shown -->
          <template v-if="selectedUser.public_profile">
            <ion-avatar style="width:60px;height:60px;margin:auto;">
              <img :src="selectedUser.avatar_url || 'https://placehold.co/60x60?text=?'"  :alt="$t('home.altAvatar')"/>
            </ion-avatar>

            <h3 style="margin-top:6px; font-size:1rem;">
              {{ selectedUser.display_name }}
            </h3>

            <p style="margin:4px 0; font-size:0.85rem; color:var(--ion-color-medium);">
              {{ $t('profile.level', { level: getLevelFromPoints(selectedUser.points) }) }} ({{ $t('home.pointsCount', { points: selectedUser.points }) }})
            </p>

            <p v-if="selectedUser.bio" style="margin-top:6px; font-size:0.8rem; color:var(--ion-color-dark)">
              {{ selectedUser.bio }}
            </p>
          </template>

          <!-- ❌ No public profile: only show XP -->
          <template v-else>
            <p style="margin:4px 0; font-size:0.9rem; font-weight:600;">
              {{ $t('home.anonymous') }}
            </p>
            <p style="margin:4px 0; font-size:0.85rem; color:var(--ion-color-medium);">
              {{ $t('profile.level', { level: getLevelFromPoints(selectedUser.points) }) }} ({{ $t('home.pointsCount', { points: selectedUser.points }) }})
            </p>
          </template>

        </div>
      </ion-content>
    </ion-popover>

  </ion-page>
</template>

<script setup lang="ts">
/* ---------------- Imports ---------------- */
import {ref, nextTick, computed, onBeforeUnmount, watch, onMounted} from 'vue'
import { useI18n } from 'vue-i18n'
import {
  IonPage, IonContent, IonCard, IonCardHeader, IonCardTitle,
  IonCardContent, IonButton, IonIcon, IonHeader, onIonViewWillEnter, IonLabel, IonChip, IonSkeletonText,
    IonList, IonBadge, IonAvatar, IonItem, IonPopover
} from '@ionic/vue'
import { useRouter } from 'vue-router'
import { Chart as ChartJS, Title, Tooltip, Legend, ArcElement, BarElement, CategoryScale, LinearScale } from 'chart.js'
import { Doughnut } from 'vue-chartjs'
import { supabase } from '@/plugins/supabaseClient'
import type { ChartData, ChartOptions } from 'chart.js'
import AppHeader from "@/components/AppHeader.vue"
import relativeTime from 'dayjs/plugin/relativeTime'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import {
  barcodeOutline,
  locationOutline,
  scanOutline,
  compassOutline,
  medalOutline,
  sparkles,
  closeOutline,
  shieldCheckmarkOutline,
  locateOutline
} from "ionicons/icons"
import { useLeaderboard } from "@/composables/useLeaderboard";
import {getLevelColor} from "@/composables/useLevels";
import {getLevelFromPoints} from "@/utils/xp";
import {ActivityLogService} from "@/services/ActivityLogService";
import { refreshSubscriptionStatus} from "@/composables/useSubscriptionStatus";
import {Capacitor} from "@capacitor/core";
import { Geolocation } from '@capacitor/geolocation'
import { PrayTime } from 'praytime'
import DailyMissions from "@/components/DailyMissions.vue"
import { useDailyMissions } from '@/composables/useDailyMissions'

let timeInterval: number | null = null

const selectedUser = ref<any | null>(null)
const popoverEvent = ref<Event | null>(null)

/* ---------------- Chart Setup ---------------- */
ChartJS.register(Title, Tooltip, Legend, ArcElement, BarElement, CategoryScale, LinearScale)
const DoughnutChart = Doughnut

/* ---------------- State ---------------- */
const router = useRouter()
const { t, te, locale } = useI18n()
const { fetchProgress } = useDailyMissions()
const doughnutRef = ref<any>(null)
const locationChartRef = ref<any>(null)
const RECENT_DISCOVER_LIMIT = 15
const loadingStats = ref(true)
const loadingProducts = ref(true)
const loadingLocations = ref(true)
const recentProducts = ref<any[]>([])
const recentLocations = ref<any[]>([])
const loadingNews = ref(true)
const recentNews = ref<any[]>([])
const totalProductCount = ref(0)
const totalLocationCount = ref(0)

/* ---------------- Announcement logic ---------------- */
const announcement = ref<any | null>(null)
const showAnnouncement = ref(false)

async function fetchLatestAnnouncement() {
  try {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) return

    const dismissedId = localStorage.getItem('last_dismissed_announcement')
    if (dismissedId !== data.id) {
      announcement.value = data
      showAnnouncement.value = true
    }
  } catch (err) {
    console.error("Failed to fetch announcement:", err)
  }
}

function dismissAnnouncement() {
  if (announcement.value) {
    localStorage.setItem('last_dismissed_announcement', announcement.value.id)
    showAnnouncement.value = false
  }
}

function handleBannerClick() {
  if (announcement.value?.link_url) {
    ActivityLogService.log('announcement_click', {
      id: announcement.value.id,
      url: announcement.value.link_url
    })
    window.open(announcement.value.link_url, '_blank')
  }
}


const userLocation = ref<{
  lat: number
  lng: number
  city?: string
} | null>(null)


const { leaderboard, loading: loadingLeaderboard, fetchLeaderboard } = useLeaderboard();
const isAuthenticated = ref(false)

const isDark = ref(document.documentElement.classList.contains('ion-palette-dark'))

onMounted(() => {
  fetchLatestAnnouncement()
  const observer = new MutationObserver(() => {
    isDark.value = document.documentElement.classList.contains('ion-palette-dark')
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

const chartOptions = computed<ChartOptions<'doughnut'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right',
      align: 'center',
      labels: {
        color: isDark.value ? '#ffffff' : '#1e1e1e',
        boxWidth: 14,
        font: { size: 12 },
        padding: 8
      }
    }
  }
}))

/* ---------------- Product Status Chart ---------------- */
const statusChartData = ref<ChartData<'doughnut'>>({
  labels: [],
  datasets: [{
    backgroundColor: ['#28a745', '#007bff', '#ffc107', '#dc3545'],
    data: []
  }]
})

watch([() => locale.value, isDark], () => {
  // Update status labels if we have data
  if (statusChartData.value && statusChartData.value.labels && statusChartData.value.labels.length > 0) {
    statusChartData.value = {
      ...statusChartData.value,
      labels: [
        t('home.statuses.halal'),
        t('home.statuses.muslimFriendly'),
        t('home.statuses.syubhah'),
        t('home.statuses.haram')
      ]
    }
  }

  // Refresh location category labels because they are translated in the fetcher
  fetchLocationCategoryStats()
  
  // Re-render charts
  nextTick(() => {
    if (doughnutRef.value?.chart) doughnutRef.value.chart.update();
    if (locationChartRef.value?.chart) locationChartRef.value.chart.update();
  })
})

/* ---------------- Location Categories Chart ---------------- */
const locationChartData = ref<ChartData<'doughnut'>>({
  labels: [],
  datasets: [{
    backgroundColor: [
      '#3498db', '#2ecc71', '#f1c40f',
      '#e74c3c', '#9b59b6', '#1abc9c', '#e67e22'
    ],
    data: []
  }]
})

const halalPartners = ref<any[]>([])
const loadingPartners = ref(true)

type PrayerTimes = {
  fajr: string
  sunrise: string
  dhuhr: string
  asr: string
  maghrib: string
  isha: string
}

const prayerTimes = ref<PrayerTimes | null>(null)
const loadingPrayerTimes = ref(true)
const prayerScroll = ref<HTMLElement | null>(null)

/* ---------------- Utilities ---------------- */
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(relativeTime)

const userTimezone = ref(dayjs.tz.guess())

function fromNowToTaipei(dateString?: string) {
  if (!dateString) return ''
  return dayjs.utc(dateString).tz(userTimezone.value).fromNow()
}

const nowTime = ref(dayjs().tz(userTimezone.value))

function startClock() {
  timeInterval = window.setInterval(() => {
    nowTime.value = dayjs().tz(userTimezone.value)
  }, 1000)
}

async function fetchRecentNews() {
  loadingNews.value = true

  const { data, error } = await supabase
      .from('news')
      .select('id, title, header_image, created_at') // 👈 FIX HERE
      .order('created_at', { ascending: false })
      .limit(RECENT_DISCOVER_LIMIT)

  if (!error && data) {
    recentNews.value = data.map(n => ({
      id: n.id,
      title: n.title,
      cover: n.header_image || 'https://placehold.co/400x250?text=News', // 👈 FIX
      created_at: n.created_at
    }))
  }

  loadingNews.value = false
}

const TIER_PRIORITY: Record<string, number> = {
  gold: 3,
  silver: 2,
  bronze: 1
}

const displayedPartners = computed(() => {
  return [...halalPartners.value].sort((a, b) => {
    return (TIER_PRIORITY[b.partner_tier] || 0)
        - (TIER_PRIORITY[a.partner_tier] || 0)
  })
})

async function getUserLocation(): Promise<{
  lat: number
  lng: number
  city?: string
}> {
  // 1️⃣ Cached first
  const cached = localStorage.getItem('hf_user_location')
  if (cached) {
    const parsed = JSON.parse(cached) as {
      lat: number
      lng: number
      city?: string
    }

    userLocation.value = parsed
    return parsed
  }

  try {
    let lat: number
    let lng: number

    if (Capacitor.isNativePlatform()) {
      // 📱 Native app
      const permission = await Geolocation.requestPermissions()

      if (permission.location !== 'granted') {
        throw new Error('Location permission denied')
      }

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true
      })

      lat = position.coords.latitude
      lng = position.coords.longitude

    } else {
      // 🌐 Web browser fallback
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject)
      })

      lat = position.coords.latitude
      lng = position.coords.longitude
    }

    let city = t('home.currentLocation')

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

      console.log('Reverse status:', res.status)

      const data = await res.json()

      city =
          data.address?.city ||
          data.address?.town ||
          data.address?.municipality ||
          data.address?.state ||
          t('home.currentLocation')

    } catch (e) {
      console.warn('[Reverse Geocode Failed]', e)
    }

    userLocation.value = { lat, lng, city }


    localStorage.setItem(
        'hf_user_location',
        JSON.stringify(userLocation.value)
    )

    return userLocation.value

  } catch {
    console.warn('[GPS] Using fallback Taipei')

    userLocation.value = {
      lat: 25.0330,
      lng: 121.5654,
      city: t('home.taipei')
    }

    return userLocation.value
  }
}

async function fetchPrayerTimes() {
  loadingPrayerTimes.value = true

  const location = await getUserLocation()

  const praytime = new PrayTime('MWL')

  praytime
      .location([location.lat, location.lng])
      .timezone(userTimezone.value)
      .format('24h')
      .adjust({ highLats: 'AngleBased' })

  const times = praytime.getTimes(new Date())

  prayerTimes.value = {
    fajr: times.fajr,
    sunrise: times.sunrise,
    dhuhr: times.dhuhr,
    asr: times.asr,
    maghrib: times.maghrib,
    isha: times.isha
  }

  loadingPrayerTimes.value = false
}

async function handleRefreshLocation() {
  ActivityLogService.log("home_prayer_refresh_location");
  localStorage.removeItem('hf_user_location'); // 🏁 Clear cache
  await fetchPrayerTimes();
}


const prayerList = computed(() => {
  if (!prayerTimes.value) return []

  return [
    { key: 'fajr', label: t('home.prayers.fajr'), time: prayerTimes.value.fajr },
    { key: 'dhuhr', label: t('home.prayers.dhuhr'), time: prayerTimes.value.dhuhr },
    { key: 'asr', label: t('home.prayers.asr'), time: prayerTimes.value.asr },
    { key: 'maghrib', label: t('home.prayers.maghrib'), time: prayerTimes.value.maghrib },
    { key: 'isha', label: t('home.prayers.isha'), time: prayerTimes.value.isha }
  ]
})

const currentPrayerKey = computed(() => {
  if (!prayerTimes.value) return null

  const now = nowTime.value
  const today = now.format('YYYY-MM-DD')

  const prayers = prayerList.value.map(p => ({
    ...p,
    timeObj: dayjs.tz(
        `${today} ${p.time}`,
        'YYYY-MM-DD HH:mm',
        userTimezone.value
    )
  }))

  for (let i = 0; i < prayers.length; i++) {
    const current = prayers[i]
    const next = prayers[i + 1]

    if (next) {
      if (now.isAfter(current.timeObj) && now.isBefore(next.timeObj)) {
        return current.key
      }
    } else {
      // Last prayer (Isha)
      if (now.isAfter(current.timeObj)) {
        return current.key
      }
    }
  }

  // If before Fajr
  return 'isha'
})



const nextPrayer = computed(() => {
  if (!prayerTimes.value) return null

  const now = nowTime.value

  for (const p of prayerList.value) {
    const prayerTime = dayjs.tz(
        `${now.format('YYYY-MM-DD')} ${p.time}`,
        'YYYY-MM-DD HH:mm',
        userTimezone.value
    )

    if (prayerTime.isAfter(now)) {
      return {
        ...p,
        timeObj: prayerTime
      }
    }
  }

  // All passed → next is Fajr tomorrow
  const fajrTime = dayjs
      .tz(
          `${now.add(1, 'day').format('YYYY-MM-DD')} ${prayerTimes.value.fajr}`,
          'YYYY-MM-DD HH:mm',
          userTimezone.value
      )

  return {
    key: 'fajr',
    label: t('home.prayers.fajr'),
    time: prayerTimes.value.fajr,
    timeObj: fajrTime
  }
})

const scrollPrayerKey = computed(() => {
  return currentPrayerKey.value
})

watch(
    () => scrollPrayerKey.value,
    async (key) => {
      if (!key) return

      // wait for DOM + Ionic layout
      await nextTick()
      requestAnimationFrame(() => {
        const container = prayerScroll.value
        if (!container) return

        const target = container.querySelector(
            `.prayer-pill[data-key="${key}"]`
        ) as HTMLElement

        if (!target) return

        const offset =
            target.offsetLeft -
            container.clientWidth / 2 +
            target.clientWidth / 2

        container.scrollTo({
          left: offset,
          behavior: 'smooth'
        })
      })
    },
    { immediate: true }
)

const upcomingCountdown = computed(() => {
  if (!nextPrayer.value) return ''

  const totalSeconds = nextPrayer.value.timeObj.diff(nowTime.value, 'second')
  if (totalSeconds <= 0) return '00:00:00'

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return [
    hours,
    minutes,
    seconds
  ]
      .map(v => String(v).padStart(2, '0'))
      .join(':')
})


// Removed updateChartSmoothly as we are using reactive data objects now

function openUserProfile(user: any, ev: Event) {
  ActivityLogService.log("home_leaderboard_profile", {
    user_id: user.id,
    display_name: user.display_name
  });

  selectedUser.value = user
  popoverEvent.value = ev   // 👈 attach the click event for positioning
}

function closePopover() {
  selectedUser.value = null
  popoverEvent.value = null
}

/* ---------------- Data Fetching ---------------- */
async function fetchRecentProducts() {
  loadingProducts.value = true
  const { data, error } = await supabase
      .from("products")
      .select(`
        barcode, 
        name, 
        status, 
        photo_front_url, 
        created_at, 
        updated_at, 
        product_categories(name),
        partner:partners(partner_tier)
      `)
      .eq("approved", true)
      .order("created_at", { ascending: false })
      .limit(100) // 🏁 Fetch more to ensure we catch recent Gold items

  if (!error && data) {
    // 📅 Determine "New Gold" threshold (7 days)
    const sevenDaysAgo = dayjs().subtract(7, 'day');

    // 🏎️ Sort: Gold/Silver < 7 days old go to the top
    const sortedData = [...data].sort((a: any, b: any) => {
      const getWeight = (p: any) => {
        const t = Array.isArray(p.partner) ? p.partner[0]?.partner_tier : p.partner?.partner_tier;
        const tier = String(t || '').toLowerCase();
        // Check both created_at and potentially updated_at if available
        const isNew = dayjs(p.created_at).isAfter(sevenDaysAgo) || (p.updated_at && dayjs(p.updated_at).isAfter(sevenDaysAgo));
        
        if (tier === 'gold' && isNew) return 3; // Absolute priority for fresh Gold
        if (tier === 'gold') return 2;          // Regular Gold
        if (tier === 'silver' && isNew) return 1;
        return 0;
      };

      const weightA = getWeight(a);
      const weightB = getWeight(b);

      if (weightA !== weightB) return weightB - weightA;
      
      return dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf();
    }).slice(0, RECENT_DISCOVER_LIMIT);

    recentProducts.value = sortedData.map(p => ({
      barcode: p.barcode,
      name: p.name,
      status: p.status,
      category: (p.product_categories as any)?.name || "",
      image: p.photo_front_url,
      created_at: p.created_at,
      partner_tier: Array.isArray(p.partner) ? p.partner[0]?.partner_tier : (p.partner as any)?.partner_tier
    }))
  }
  loadingProducts.value = false
}

async function fetchRecentLocations() {
  loadingLocations.value = true
  const { data, error } = await supabase
      .from('locations')
      .select(`
        id, 
        name, 
        image, 
        type_id, 
        location_types(name), 
        created_at, 
        updated_at, 
        partner:partners(partner_tier)
      `)
      .eq('approved', true)
      .order('created_at', { ascending: false })
      .limit(100)

  if (!error && data) {
    const sevenDaysAgo = dayjs().subtract(7, 'day');

    // 🏎️ Sort: Gold/Silver < 7 days old go to the top
    const sortedData = [...data].sort((a: any, b: any) => {
      const getWeight = (p: any) => {
        const t = Array.isArray(p.partner) ? p.partner[0]?.partner_tier : p.partner?.partner_tier;
        const tier = String(t || '').toLowerCase();
        const isNew = dayjs(p.created_at).isAfter(sevenDaysAgo) || (p.updated_at && dayjs(p.updated_at).isAfter(sevenDaysAgo));
        
        if (tier === 'gold' && isNew) return 3;
        if (tier === 'gold') return 2;
        if (tier === 'silver' && isNew) return 1;
        return 0;
      };

      const weightA = getWeight(a);
      const weightB = getWeight(b);

      if (weightA !== weightB) return weightB - weightA;
      
      return dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf();
    }).slice(0, RECENT_DISCOVER_LIMIT);

    recentLocations.value = sortedData.map(l => ({
      id: l.id,
      name: l.name,
      image: l.image,
      type: (l.location_types as any)?.name || '',
      created_at: l.created_at,
      partner_tier: Array.isArray(l.partner) ? l.partner[0]?.partner_tier : (l.partner as any)?.partner_tier
    }))
  }
  loadingLocations.value = false
}

async function fetchStats() {
  loadingStats.value = true
  const { data: products } = await supabase.from('products').select('status')
  if (products) {
    totalProductCount.value = products.length
    const statusCount = { Halal:0,'Muslim-friendly':0,Syubhah:0,Haram:0 }
    
    products.forEach((p) => {
      const s = p.status as keyof typeof statusCount
      if (statusCount[s] !== undefined) {
        statusCount[s]++
      }
    })

    statusChartData.value = {
      labels: [
        t('home.statuses.halal'),
        t('home.statuses.muslimFriendly'),
        t('home.statuses.syubhah'),
        t('home.statuses.haram')
      ],
      datasets: [{
        backgroundColor: ['#28a745', '#007bff', '#ffc107', '#dc3545'],
        data: [statusCount.Halal, statusCount['Muslim-friendly'], statusCount.Syubhah, statusCount.Haram]
      }]
    }
  }

  loadingStats.value = false
}

async function fetchLocationCategoryStats() {
  const { data, error } = await supabase
      .from("locations")
      .select(`
    id,
    location_types ( name )
  `)
      .eq('approved', true)

  if (!error && data) {
    totalLocationCount.value = data.length
    const counts: Record<string, number> = {}

    data?.forEach(loc => {
      // Handle potential array or object response for location_types
      const rawType = Array.isArray(loc.location_types) ? loc.location_types[0] : loc.location_types
      const typeKey = rawType?.name || 'Unknown'
      
      // Try to translate the type, fallback to raw name
      const typeName = te(`explore.types.${typeKey}`) ? t(`explore.types.${typeKey}`) : typeKey
      counts[typeName] = (counts[typeName] || 0) + 1
    })

    const labels = Object.keys(counts)
    const values = Object.values(counts)

    locationChartData.value = {
      labels,
      datasets: [
        {
          backgroundColor: ['#3498db', '#2ecc71', '#e67e22', '#9b59b6', '#f1c40f', '#e74c3c', '#1abc9c'],
          data: values
        }
      ]
    }
  }
}

async function fetchHomePartners() {
  loadingPartners.value = true

  const { data, error } = await supabase
      .from('partners')
      .select(`
    id,
    name,
    logo_url,
    partner_tier
  `)
      .eq('is_active', true)
      .order('partner_tier', { ascending: false }) // tiers still float up
      .limit(6)

  if (error) {
    console.error('[Home Partners]', error)
    loadingPartners.value = false
    return
  }

  halalPartners.value = (data ?? []).map(b => ({
    id: b.id,
    name: b.name,
    partner_tier: b.partner_tier,
    logo:
        b.logo_url ||
        `https://placehold.co/300x300?text=${encodeURIComponent(b.name)}`
  }))

  loadingPartners.value = false
}




/* ---------------- Lifecycle ---------------- */

async function refreshAllData() {
  console.log('🏠 [Home] Refreshing all data...')
  
  // Run these in parallel for speed
  const tasks: Promise<any>[] = [
    fetchStats(),
    fetchLocationCategoryStats(),
    fetchRecentProducts(),
    fetchRecentLocations(),
    fetchRecentNews(),
    fetchLeaderboard(),
    fetchHomePartners(),
  ]

  if (isAuthenticated.value) {
    tasks.push(fetchProgress()) // Also refresh missions if logged in
  }

  await Promise.allSettled(tasks)
  
  if (Capacitor.isNativePlatform()) refreshSubscriptionStatus();
}


onIonViewWillEnter(async () => {
  ActivityLogService.log("home_page_open");
  
  const { data } = await supabase.auth.getSession()
  isAuthenticated.value = !!data.session

  refreshAllData()
  fetchPrayerTimes()
  startClock()
})

onMounted(() => {
  // Fallback for initial load if needed
  refreshAllData()
})

onBeforeUnmount(() => {
  if (timeInterval) {
    clearInterval(timeInterval)
    timeInterval = null
  }
})


/* ---------------- Navigation ---------------- */
function goScan() {
  ActivityLogService.log("home_scan_ingredient");
  router.push('/scan');
}

function goToSearchAndScan() {
  ActivityLogService.log("home_scan_barcode");
  router.push({ path: '/search', query: { scan: 'true' } });
}

function goQibla() {
  ActivityLogService.log("home_find_qibla_click")
  router.push({ path: '/qibla', query: { from: 'home' } })
}

function viewMorePartners() {
  ActivityLogService.log("home_viewmore_partners")
  router.push('/partners')
}

function viewMoreProducts() {
  ActivityLogService.log("home_viewmore_products");
  router.push('/search');
}


function viewMoreLocations() {
  ActivityLogService.log("home_viewmore_locations");
  router.push('/explore');
}

function viewMoreNews() {
  ActivityLogService.log("home_viewmore_news")
  router.push('/news')
}

function openNews(news: any) {
  ActivityLogService.log("home_news_click", {
    id: news.id,
    title: news.title
  })

  router.push(`/news/${news.id}`)
}



async function openProduct(p: any) {
  ActivityLogService.log("home_product_click", {
    barcode: p.barcode,
    name: p.name,
    status: p.status
  });

  router.push(`/item/${p.barcode}`);
}


async function openLocation(loc: any) {
  ActivityLogService.log("home_location_click", {
    id: loc.id,
    name: loc.name,
    type: loc.type
  });

  router.push(`/place/${loc.id}`);
}

function openPartner(partner: any) {
  ActivityLogService.log("home_partner_click", {
    id: partner.id,
    name: partner.name
  })

  router.push(`/partner/${partner.id}`)
}




</script>

<style scoped>

/* === Announcement Banner === */
.announcement-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 12px;
  margin-bottom: 16px;
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(0,0,0,0.05);
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  transition: all 0.2s ease;
}

.announcement-banner.clickable {
  cursor: pointer;
}

.announcement-banner.clickable:active {
  transform: scale(0.98);
  opacity: 0.9;
}

.announcement-banner.info {
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border-color: #bae6fd;
}

.announcement-banner.warning {
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
  border-color: #fde68a;
}

.announcement-banner.success {
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  border-color: #bbf7d0;
}

.announcement-content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.announcement-thumb-wrapper {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid rgba(0,0,0,0.1);
}

.announcement-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.announcement-icon {
  font-size: 20px;
  color: var(--ion-color-carrot);
}

.announcement-text {
  display: flex;
  flex-direction: column;
}

.announcement-title {
  font-weight: 700;
  font-size: 0.9rem;
  color: #1e293b;
}

.announcement-body {
  margin: 2px 0 0;
  font-size: 0.8rem;
  color: #475569;
  line-height: 1.25;
}

.close-btn {
  --padding-start: 4px;
  --padding-end: 4px;
  margin-left: 8px;
  height: 32px;
  width: 32px;
  font-size: 18px;
}

.slide-down-enter-active, .slide-down-leave-active {
  transition: all 0.3s ease;
}
.slide-down-enter-from, .slide-down-leave-to {
  transform: translateY(-20px);
  opacity: 0;
}

.ion-palette-dark .announcement-banner.info { background: linear-gradient(135deg, #0c4a6e 0%, #075985 100%); border-color: #0369a1; }
.ion-palette-dark .announcement-banner.warning { background: linear-gradient(135deg, #78350f 0%, #92400e 100%); border-color: #b45309; }
.ion-palette-dark .announcement-banner.success { background: linear-gradient(135deg, #064e3b 0%, #065f46 100%); border-color: #047857; }
.ion-palette-dark .announcement-title { color: #f1f5f9; }
.ion-palette-dark .announcement-body { color: #cbd5e1; }
.ion-palette-dark .close-btn { --color: #94a3b8; }



/* ===============================
   Prayer Times
   =============================== */

/* 🔥 App Features Redesign */
.clear-card {
  background: transparent;
  --background: transparent;
  box-shadow: none;
  border-radius: 0;
  contain: none;
  overflow: visible;
  border: none;
}

.main-feature-section {
  padding: 0;
  margin-top: 10px;
  margin-bottom: 10px;
}

.main-features-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
}

.feature-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16px;
  border-radius: 16px;
  border: none;
  text-align: left;
  height: 150px;
  width: 100%;
  margin: 0;
  box-sizing: border-box;
  transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.feature-card:active {
  transform: scale(0.96);
}

.feature-primary {
  background: linear-gradient(135deg, var(--ion-color-carrot) 0%, #ff8c3a 100%);
  color: white;
  box-shadow: 0 8px 16px rgba(217, 119, 6, 0.25);
}

.feature-secondary {
  /* Using a contrasting premium color for barcode */
  background: linear-gradient(135deg, var(--ion-color-tertiary, #5260ff) 0%, #7b88ff 100%);
  color: white;
  box-shadow: 0 8px 16px rgba(82, 96, 255, 0.25);
}

.feature-icon-wrapper {
  background: rgba(255, 255, 255, 0.25);
  border-radius: 12px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  backdrop-filter: blur(4px);
  z-index: 2;
}

.feature-text {
  margin-top: 16px;
  z-index: 2;
}

.feature-text h3 {
  margin: 0 0 4px;
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  white-space: normal;
}

.feature-text p {
  margin: 0;
  font-size: 0.75rem;
  opacity: 0.9;
  line-height: 1.3;
  white-space: normal;
  word-wrap: break-word;
}

.feature-bg-icon {
  position: absolute;
  right: -10px;
  bottom: -15px;
  font-size: 90px;
  opacity: 0.15;
  z-index: 1;
  transform: rotate(-10deg);
  pointer-events: none;
}

.prayer-horizontal {
  display: flex;
  gap: 12px;

  overflow-x: auto;
  overflow-y: hidden;

  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;        /* Firefox */
  -ms-overflow-style: none;     /* IE / Edge */

  padding: 4px 4px 12px;
}

.prayer-horizontal::-webkit-scrollbar {
  display: none;                /* Chrome / Safari / iOS */
}

/* Inner track */
.prayer-track {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(80px, 1fr);
  gap: 12px;

  width: 100%;
  padding: 4px 12px 12px;
}

@media (min-width: 1024px) {
  .prayer-track {
    grid-auto-columns: minmax(100px, 1fr);
  }
}

.prayer-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.qibla-header-btn {
  font-weight: 600;
}

.prayer-header-actions {
  display: flex;
  gap: 4px;
  align-items: center;
}


.prayer-pill {
  flex: 0 0 80px;
  scroll-snap-align: center;

  border-radius: 6px;
  padding: 7px 6px;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  transition: all 0.25s ease;
  flex-shrink: 0;
}


.prayer-pill .label {
  font-size: 0.7rem;
  color: var(--ion-color-medium);
}

.prayer-pill .time {
  font-size: 1rem;
  font-weight: 600;
  margin-top: 0;
}

/* 🔥 Active / Nearest Prayer */
.prayer-pill.active {
  background: rgba(217, 119, 6, 0.18);
  color: var(--ion-color-carrot);
  transform: scale(1.05);
  box-shadow: 0 0 0 1px rgba(217, 119, 6, 0.4),
  0 6px 18px rgba(217, 119, 6, 0.25);
}

.prayer-pill.active .label {
  color: var(--ion-color-carrot);
}

.qibla-row {
  display: flex;
  justify-content: center;
  padding: 6px 12px 4px;   /* horizontal padding = card padding feel */
}


.prayer-title-main {
  font-size: 1rem;
  font-weight: 600;
}

.prayer-title-location {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
  margin-top: 2px;
}

/* === Insights Dashboard Section === */
.insights-container {
  margin: 0px; /* Remove side margins here, handled by card margin + scroll padding */
}

.insights-scroll {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  padding: 0px; /* Allow card margins to breathe */
  scrollbar-width: none;
  -ms-overflow-style: none; 
}

/* 🖥️ Desktop: Transform Scroll to Grid */
@media (min-width: 1024px) {
  .insights-scroll {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    overflow-x: visible;
    padding: 8px 16px; /* Match standard page margins */
  }
}

.insights-scroll::-webkit-scrollbar {
  display: none;
}

.insight-card {
  flex: 0 0 280px;
  scroll-snap-align: center;
  margin: 8px; /* Match the exact 8px margin from the inspector */
  background: var(--card-bg);
  border-radius: 16px; /* Match the exact 16px radius from the inspector */
  padding: 16px; /* Match the 16px inner padding */
  box-shadow: var(--card-shadow);
  border: 1px solid var(--card-border);
  display: flex;
  flex-direction: column;
  height: 220px;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

@media (min-width: 1024px) {
  .insight-card {
    flex: 1; /* Fit width */
    min-width: 0;
  }
}

/* Stat Cards (Centered Icons) */
.stat-card {
  flex: 0 0 220px;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 16px;
}

.stat-icon-wrapper {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.stat-icon-wrapper.products {
  background: rgba(var(--ion-color-carrot-rgb), 0.1);
  color: var(--ion-color-carrot);
}

.stat-icon-wrapper.locations {
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  color: var(--ion-color-primary);
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ion-color-medium);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  margin: 2px 0 0;
  font-size: 1.6rem;
  font-weight: 850;
  color: var(--ion-color-dark);
}

/* Chart Cards */
.chart-card {
  flex: 0 0 320px;
}

.insight-header h3 {
  margin: 0 0 12px;
  font-size: 1rem;
  font-weight: 700;
  color: var(--ion-color-dark);
}

.chart-wrapper {
  flex: 1;
  width: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Dark mode handled by global variables */


</style>
