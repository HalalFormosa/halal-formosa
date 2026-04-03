<template>
  <ion-page>
    <ion-header>
      <!-- Native (mobile) AdMob banner -->
      <div v-if="isNative && !isDonor" id="ad-space-search" style="height:65px;"></div>

      <app-header
          :title="
  activeStores.length === 1
    ? `${$t('search.title')} : ${activeStores[0].name}`
    : activeStores.length > 1
      ? `${$t('search.title')} (${activeStores.length})`
      : $t('search.title')
"
          :icon="gridOutline"
          :showProfile="true"
      />

      <ion-toolbar class="actions-toolbar">
        <div class="header-main-actions">
          <!-- 🎚️ Sort Button (Left Side) -->
          <ion-button fill="clear" class="classic-action-btn sort-btn-wrapper" id="sort-trigger">
            <ion-icon :icon="sortIcon" />
            <span class="btn-label">{{ sortLabel }}</span>
          </ion-button>

          <ion-popover trigger="sort-trigger" trigger-action="click" :dismiss-on-select="true" class="width-190">
            <ion-list lines="none">
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

              <ion-item button @click="sortBy = 'views'">
                <ion-icon :icon="flameOutline" slot="start" />
                <ion-label>{{ $t('search.sortViews') }}</ion-label>
                <ion-icon v-if="sortBy === 'views'" :icon="checkmarkCircle" slot="end" color="success" style="font-size: 14px;" />
              </ion-item>

              <ion-item v-if="canShowForYouSort" button @click="sortBy = 'for_you'">
                <ion-icon :icon="sparklesOutline" slot="start" />
                <ion-label>{{ $t('search.sortForYou') }}</ion-label>
                <ion-icon v-if="sortBy === 'for_you'" :icon="checkmarkCircle" slot="end" color="success" style="font-size: 14px;" />
              </ion-item>
            </ion-list>
          </ion-popover>


          <div class="right-actions-group">
            <!-- 🔍 Search Toggle Button -->
            <ion-button
                fill="clear"
                @click="showSearchbar = !showSearchbar"
                :color="showSearchbar ? 'carrot' : 'dark'"
                class="classic-action-btn"
            >
              <ion-icon :icon="showSearchbar ? closeCircle : searchOutline" />
            </ion-button>

            <!-- 📱 Grid/List Toggle -->
            <ion-button
                fill="clear"
                @click="toggleViewMode"
                class="classic-action-btn"
            >
              <ion-icon :icon="viewMode === 'grid' ? listOutline : gridOutline" />
            </ion-button>

            <!-- 📷 Scan Button (Classic Style) -->
            <ion-button
                @click="startScan"
                v-if="!scanning"
                color="carrot"
                class="classic-scan-btn"
            >
              <ion-icon :icon="barcodeOutline" />
            </ion-button>

            <!-- 🌪️ Filter Toggle -->
            <ion-button fill="clear" @click="toggleFilters" class="classic-action-btn">
              <ion-icon :icon="funnelOutline" />
              <div v-if="hasActiveFilters" class="badge-dot"></div>
            </ion-button>
          </div>
        </div>
      </ion-toolbar>

      <transition name="fade-down">
        <ion-toolbar v-if="showSearchbar" class="search-row-toolbar">
          <div class="search-container">
            <ion-searchbar
                :placeholder="$t('search.placeholder')"
                :debounce="1000"
                @ionInput="handleSearchInput($event)"
                :value="searchQuery"
                class="compact-searchbar"
                :animated="true"
            ></ion-searchbar>
          </div>
        </ion-toolbar>
      </transition>
      <!-- Filter Section (Still inside header, below search if open) -->
      <transition name="collapse">
        <ion-toolbar v-show="showFilters" class="filter-toolbar">
          <div class="filter-section">
            <!-- Stores -->
            <div class="filter-group">
              <div class="filter-title">
                <ion-icon :icon="storefrontOutline"/>
                {{ $t('search.filters.stores') }}
              </div>
              <div class="store-scroll">
                <template v-if="loadingStores">
                  <ion-skeleton-text
                      v-for="n in 10"
                      :key="'store-skeleton-' + n"
                      animated
                      class="skeleton-store"
                  />
                </template>
                <template v-else>
                  <StoreLogoBar
                      :stores="stores"
                      mode="filter"
                      v-model:activeStores="activeStores"
                  />
                </template>
              </div>
            </div>

            <!-- Categories -->
            <div class="filter-group">
              <div class="filter-title">
                <ion-icon :icon="pricetagsOutline"/>
                {{ $t('search.filters.categories') }}
              </div>
              <div class="category-bar">
                <template v-if="loadingCategories">
                  <ion-skeleton-text
                      v-for="n in 4"
                      :key="'cat-skeleton-' + n"
                      animated
                      style="width: 100px; height: 28px; border-radius: 100px; margin-right: 8px;"
                  />
                </template>
                <template v-else>
                  <ion-chip
                      v-for="cat in categories"
                      :key="cat.id"
                      class="modern-category-chip"
                      :class="{ active: activeCategories.some(c => c.id === cat.id) }"
                      :style="{ 
                        '--cat-color': 'var(--ion-color-carrot)',
                        '--cat-contrast': 'var(--ion-color-carrot-contrast)',
                        '--cat-bg': activeCategories.some(c => c.id === cat.id) ? 'var(--ion-color-carrot)' : 'transparent'
                      }"
                      @click="toggleCategory(cat)"
                  >
                    <span class="category-emoji">{{ categoryIcons[cat.name] || '📦' }}</span>
                    <ion-label>{{ $te('search.categoriesList.' + cat.name) ? $t('search.categoriesList.' + cat.name) : cat.name }}</ion-label>
                  </ion-chip>
                </template>
              </div>
            </div>

            <!-- Status Filter -->
            <div class="filter-group">
              <div class="filter-title">
                <ion-icon :icon="shieldCheckmarkOutline"/>
                {{ $t('search.filters.statuses') }}
              </div>
              <div class="category-bar">
                <ion-chip
                    v-for="status in statuses"
                    :key="status.key"
                    class="modern-category-chip"
                    :class="{ active: activeStatuses.includes(status.key) }"
                    :style="{ 
                      '--cat-color': `var(--ion-color-${STATUS_COLOR_MAP[status.key]})`,
                      '--cat-contrast': `var(--ion-color-${STATUS_COLOR_MAP[status.key]}-contrast)`,
                      '--cat-bg': activeStatuses.includes(status.key) ? `var(--ion-color-${STATUS_COLOR_MAP[status.key]})` : 'transparent'
                    }"
                    @click="toggleStatus(status.key)"
                >
                  <span class="category-emoji">{{ status.emoji }}</span>
                  <ion-label>
                    {{ $t(`search.status.${status.key}`) }}
                  </ion-label>
                </ion-chip>
              </div>
            </div>

            <!-- 🔥 Clear Filters -->
            <div class="filter-clear-row">
              <ion-chip
                  v-if="hasActiveFilters"
                  class="clear-chip"
                  @click="clearAllFilters"
              >
                {{ $t('search.clear') }}
              </ion-chip>
            </div>
          </div>
        </ion-toolbar>
      </transition>

    </ion-header>
    <ion-content ref="contentRef">
      <ion-refresher style="margin-top: 15px;" slot="fixed" @ionRefresh="refreshList">
        <ion-refresher-content
            :pulling-icon="chevronDownCircleOutline"
            :pullingText="$t('search.pullToRefresh')"
            refreshingSpinner="circles"
        >
        </ion-refresher-content>
      </ion-refresher>

      <!-- ✅ Scanner Modal (WEB ONLY) -->
      <ion-modal
          v-if="!isNative"
          ref="scannerModal"
          :is-open="scanning"
          @didPresent="onScannerModalPresented"
          @didDismiss="handleDismiss"
      >
        <ion-content>
          <div id="reader">
            <div class="scan-line"></div>
          </div>
        </ion-content>
      </ion-modal>

      <div>
        <div v-if="!scanning" class="ion-padding" style="padding-top: 5px;">

          <!-- Skeleton loader -->
          <template v-if="loadingProducts && results.length === 0 && !showForYouGate">
            <div :class="['product-grid', viewMode + '-mode']">
              <template v-if="viewMode === 'list'">
                <ion-card v-for="n in 12" :key="'skeleton-' + n" class="product-card" style="margin: 0;">
                  <div style="display: flex; align-items: center; padding: 12px;">
                    <!-- Skeleton Image -->
                    <ion-skeleton-text
                        animated
                        style="width: 115px; height: 110px; border-radius: 10px; flex-shrink: 0;"
                    ></ion-skeleton-text>
    
                    <!-- Skeleton Text & Chip -->
                    <div
                        style="flex: 1; margin-left: 12px; display: flex; flex-direction: column; justify-content: space-between;">
                      <div>
                        <ion-skeleton-text
                            animated
                            style="width: 70%; height: 20px; margin-bottom: 8px;"
                        ></ion-skeleton-text>
                        <ion-skeleton-text
                            animated
                            style="width: 50%; height: 14px;"
                        ></ion-skeleton-text>
                      </div>
    
                      <!-- Skeleton Chip -->
                      <ion-skeleton-text
                          animated
                          style="width: 80px; height: 24px; border-radius: 100px; margin-top: 12px;"
                      ></ion-skeleton-text>
                    </div>
                  </div>
                </ion-card>
              </template>
              <template v-else>
                <div v-for="n in 12" :key="'skeleton-grid-' + n" class="grid-product-card">
                  <ion-skeleton-text animated style="width: 100%; height: 100%; margin: 0;"></ion-skeleton-text>
                </div>
              </template>
            </div>
          </template>

          <!-- 🔒 For You (Non-Pro Gate MUST COME FIRST) -->
          <template v-else-if="showForYouGate">
            <ion-card class="for-you-info">
              <ion-card-content>
                <div class="for-you-row">
                  <ion-icon name="sparkles-outline" class="for-you-icon"/>
                  <div>
                    <strong>{{ $t('search.forYou.title') }}</strong>
                    <p>
                      {{ $t('search.forYou.gateDesc') }}
                    </p>
                  </div>
                </div>

                <ion-button
                    color="carrot"
                    size="small"
                    expand="block"
                    @click="presentPaywall"
                >
                  {{ $t('search.forYou.upgrade') }}
                </ion-button>
              </ion-card-content>
            </ion-card>
          </template>


          <!-- 🧾 Empty state (ONLY for normal modes) -->
          <template v-else-if="!loadingProducts && results.length === 0">
            <ion-card>
              <ion-card-content>
                <p>😔 {{ $t('search.noProductFound') }}</p>
              </ion-card-content>
            </ion-card>
          </template>

          <!-- Actual product results -->
          <template v-else>
            <!-- ✨ For You Explanation -->
            <ion-card
                v-if="showForYouInfo && !hideForYouInfo"
                class="for-you-info"
            >
              <ion-card-content>
                <div class="for-you-row">
                  <ion-icon name="sparkles-outline" class="for-you-icon"/>
                  <div>
                    <strong>{{ $t('search.forYou.title') }}</strong>
                    <p>
                      {{ $t('search.forYou.infoDesc') }}
                    </p>

                    <p
                        v-if="forYouReason"
                        style="margin-top:6px; font-size:12px; color:var(--ion-color-medium);"
                    >
                      {{ $t('search.forYou.reasonMsg', { reason: forYouReason }) }}
                    </p>

                    <p
                        v-else
                        style="margin-top:6px; font-size:12px; color:var(--ion-color-medium);"
                    >
                      {{ $t('search.forYou.learningMsg') }}
                    </p>
                  </div>
                </div>

                <ion-button fill="clear" size="small" @click="dismissForYouInfo">
                  {{ $t('search.gotIt') }}
                </ion-button>
              </ion-card-content>
            </ion-card>

            <div :class="['product-grid', viewMode + '-mode']">
              <template v-for="product in results" :key="product.barcode">
                <!-- LIST MODE -->
                <div
                    v-if="viewMode === 'list'"
                    :class="[
                      'modern-product-card', 
                      getStatusClass(product.status),
                      product.partner_tier ? 'tier-card-' + product.partner_tier.toLowerCase() : ''
                    ]"
                    @click="openDetails(product)"
                >
                  <div class="card-inner">
                    <!-- Left: Full Height Image -->
                    <div class="card-image-section">
                      <img
                          loading="lazy"
                          :src="product.photo_front_url || 'https://via.placeholder.com/150x150.webp?text=No+Photo'"
                          :alt="product.name"
                      />
                      <!-- Floating Status Pill on Image (Bottom Left) -->
                      <div :class="['floating-status-pill bottom-left', product.status.toLowerCase().replace(' ', '-')]">
                        <ion-icon :icon="getStatusIcon(product.status)" />
                        <span>{{ $t('search.status.' + product.status) }}</span>
                      </div>
                      <!-- Vertical Separator Strip -->
                      <div :class="['status-strip', product.status.toLowerCase().replace(' ', '-')]"></div>
                    </div>
    
                    <!-- Right: Information -->
                    <div class="card-info-section">
                      <!-- TOP: Tier badge + Name -->
                      <div class="info-top">
                        <!-- Tier Badge (Gold, Silver, Bronze) -->
                        <div v-if="product.partner_tier" class="tier-header">
                          <div :class="['tier-badge', product.partner_tier.toLowerCase()]">
                            <ion-icon :icon="sparkles" />
                            <span>{{ $t('home.partnerTier', { tier: (product.partner_tier || '').toUpperCase() }) }}</span>
                          </div>
                        </div>
                        <h3 class="name">{{ product.name }}</h3>
                        <div class="metas" :class="{ 'metas-indent': product.partner_tier }">
                          <span v-if="product.product_categories?.name" class="meta">
                            {{ $te('search.categoriesList.' + product.product_categories.name) ? $t('search.categoriesList.' + product.product_categories.name) : product.product_categories.name }}
                          </span>
                          <span v-if="product.product_categories?.name" class="meta-dot">•</span>
                          <span class="meta">
                            <ion-icon :icon="eyeOutline" class="meta-icon" />
                            {{ product.view_count || 0 }}
                          </span>
                          <span class="meta-dot">•</span>
                          <span class="meta">
                            <ion-icon :icon="timeOutline" class="meta-icon" />
                            {{ fromNowToTaipei(product.created_at) }}
                          </span>
                        </div>
                      </div>
    
                      <!-- BOTTOM: Official partner (if any) + metas, always at the bottom -->
                      <div class="info-bottom">
                        <div v-if="product.partner_tier" class="premium-verified-tag">
                          <ion-icon :icon="shieldCheckmarkOutline" />
                          <span class="verified-label">{{ $t('search.officialPartner') }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Premium Flare for Gold/Silver -->
                  <div v-if="['gold', 'silver'].includes(String(product.partner_tier || '').toLowerCase())" class="premium-flare"></div>
                </div>

                <!-- GRID MODE -->
                <div
                    v-else
                    :class="['grid-product-card', getStatusClass(product.status)]"
                    @click="openDetails(product)"
                >
                  <div class="grid-card-image">
                    <img
                        loading="lazy"
                        :src="product.photo_front_url || 'https://via.placeholder.com/150x150.webp?text=No+Photo'"
                        :alt="product.name"
                    />
                    <!-- Small Status Label -->
                    <div :class="['grid-status-label', product.status.toLowerCase().replace(' ', '-')]">
                      <ion-icon :icon="getStatusIcon(product.status)" />
                      <span>{{ $t('search.status.' + product.status) }}</span>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </template>
        </div>
      </div>

      <!-- When there are results but we’ve loaded them all -->
      <ion-text v-if="allLoaded && results.length > 0" class="end-of-list">
        {{ $t('search.endOfList') }}
      </ion-text>

      <!-- bind the ref so we can disable/enable it -->
      <ion-infinite-scroll
          v-if="!showForYouGate"
          ref="infiniteScroll"
          @ionInfinite="loadMore"
          threshold="100px"
          :disabled="infiniteDisabled"
      >
        <ion-infinite-scroll-content
            loading-spinner="bubbles"
            :loading-text="$t('search.loadingMoreProduct')"
        />
      </ion-infinite-scroll>

      <ion-text color="danger" v-if="errorMsg" class="ion-padding">
        ❌ {{ errorMsg }}
      </ion-text>

      <!-- 🟠 FAB Add Product (only for admins) -->
      <ion-fab v-if="isAuthenticated" vertical="bottom" horizontal="end" slot="fixed">
        <ion-fab-button color="carrot" @click="goToAddProduct">
          <ion-icon :icon="addOutline"/>
        </ion-fab-button>
      </ion-fab>
    </ion-content>

    <ion-footer>
      <div class="footer-count">
        <small>
          {{ $t('search.showingResults', {count: results.length, total: totalProductsCount}) }}
        </small>
      </div>
    </ion-footer>

  </ion-page>
</template>

<script setup lang="ts">

/* ---------------- Imports ---------------- */
import {
  IonPage, IonHeader, IonContent, IonSearchbar, IonText, IonModal, IonPopover, IonToolbar, IonButton, IonIcon, IonFooter, IonChip,
  IonInfiniteScroll, IonInfiniteScrollContent, IonRefresher, IonRefresherContent,
  IonSkeletonText, IonThumbnail, IonCard, IonCardContent,
  onIonViewDidEnter, IonLabel, IonFab, IonFabButton, onIonViewWillEnter, IonList, IonItem,
  toastController
} from '@ionic/vue'
import { ref, onMounted, nextTick, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import {supabase} from '@/plugins/supabaseClient'
import {
  barcodeOutline,
  chevronDownCircleOutline,
  gridOutline,
  addOutline,
  chevronUpOutline,
  chevronDownOutline,
  funnelOutline,
  pricetagsOutline, storefrontOutline, shieldCheckmarkOutline,
  checkmarkCircle, warning, closeCircle, alertCircle, sparkles,
  swapVerticalOutline,
  searchOutline,
  eyeOutline,
  timeOutline,
  flameOutline,
  sparklesOutline,
  trendingUpOutline,
  listOutline
} from 'ionicons/icons'
import {Capacitor} from '@capacitor/core'
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import {Haptics, ImpactStyle} from '@capacitor/haptics'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import relativeTime from 'dayjs/plugin/relativeTime'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import AppHeader from '@/components/AppHeader.vue'

import StoreLogoBar from "@/components/StoreLogoBar.vue";
import {ActivityLogService} from "@/services/ActivityLogService";
import {isDonor, refreshSubscriptionStatus} from "@/composables/useSubscriptionStatus";
import {Purchases} from "@revenuecat/purchases-capacitor";
import {PAYWALL_RESULT, RevenueCatUI} from "@revenuecat/purchases-capacitor-ui";


/* ---------------- Day.js ---------------- */
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(relativeTime)

/* ---------------- Types ---------------- */
interface Product {
  barcode: string
  name: string
  status: string
  category_id?: number
  product_categories?: { name: string }
  ingredients?: string
  description?: string
  photo_front_url?: string
  photo_back_url?: string
  created_at?: string
  view_count?: number
  partner_tier?: 'Gold' | 'Silver' | 'Bronze'
}

const STATUS_COLOR_MAP: Record<string, string> = {
  'Halal': 'success',
  'Muslim-friendly': 'primary',
  'Syubhah': 'warning',
  'Haram': 'danger'
}


/* ---------------- State ---------------- */
const router = useRouter()
const route = useRoute()
const infiniteDisabled = ref(false)
const isAuthenticated = ref(false)

const totalProductsCount = ref(0)
const allProducts = ref<Product[]>([])
const results = ref<Product[]>([])
const errorMsg = ref('')
const scanning = ref(false)
const isScanning = ref(false)
const searchQuery = ref('')
const categories = ref<{ id: number; name: string }[]>([])
const activeCategories = ref<{ id: number; name: string }[]>([])

const loadingProducts = ref(true)
const loadingCategories = ref(true)
const loadingCount = ref(true)

const allLoaded = ref(false)
const isFetching = ref(false)
const shouldResetSearch = ref(false)

const pageSize = 20
const currentPage = ref(0)
const ingredientDictionary = ref<Record<string, string>>({})
const infiniteScroll = ref<HTMLIonInfiniteScrollElement | null>(null)
const suppressSortWatcher = ref(false)
const html5QrCodeInstance = ref<Html5Qrcode | null>(null)
const isNative = ref(Capacitor.isNativePlatform())

const categoryIcons: Record<string, string> = {
  "Snacks": "🍿",
  "Confectionery": "🍬",
  "Sauces & Seasonings": "🧂",
  "Dairy & Ice Cream": "🍦",
  "Cereal & Grains": "🌾",
  "Instant Noodles": "🍜",
  "Beverages": "🥤",
  "Spices & Condiments": "🌶️",
  "Vegetarian & Tofu": "🥗",
  "Fresh Meat": "🥩",
  "Bread & Bakery": "🍞",
  "Health & Beauty": "💄",
  "Ready-to-Eat": "🍱",
  "Spreads & Jams": "🍯",
  "Fresh Meat & Seafood": "🐟",
  "Frozen Food": "❄️",
  "Canned Food": "🥫",
  "Cooking Oil": "🧴",
  "Rice & Noodles": "🍚",
  "Supplements": "💊",
  "Household Products": "🧹",
  "Gifts & Hampers": "🎁",
  "Others": "📦"
}

const stores = ref<{ id: string; name: string; logo_url?: string }[]>([])
const activeStores = ref<{ id: string; name: string }[]>([])
const loadingStores = ref(true)
const showFilters = ref(false)
const showSearchbar = ref(false)


const statuses = [
  {key: 'Halal', emoji: '✅'},
  {key: 'Muslim-friendly', emoji: '🤝'},
  {key: 'Syubhah', emoji: '⚠️'},
  {key: 'Haram', emoji: '⛔'}
]

const sortBy = ref<'recent' | 'views' | 'trending' | 'for_you'>('recent')
const forYouReason = ref<string | null>(null)


const activeStatuses = ref<string[]>([])

const viewMode = ref<'grid' | 'list'>((localStorage.getItem('searchViewMode') as 'grid' | 'list') || 'list')

function toggleViewMode() {
  viewMode.value = viewMode.value === 'grid' ? 'list' : 'grid'
  localStorage.setItem('searchViewMode', viewMode.value)
  Haptics.impact({ style: ImpactStyle.Light })
}

function toggleFilters() {
  showFilters.value = !showFilters.value
}

type HTMLIonContentElement = HTMLElement & {
  getScrollElement: () => Promise<HTMLElement>
}

const contentRef = ref<any>(null)
const savedScrollTop = ref<number | null>(null)

const getIonContentEl = (): HTMLIonContentElement | null => {
  if (!contentRef.value) return null

  // Vue component → underlying web component
  const el = contentRef.value.$el ?? contentRef.value
  return el as HTMLIonContentElement
}

async function ensureRevenueCatLoggedIn() {
  if (!Capacitor.isNativePlatform()) return

  const {data} = await supabase.auth.getUser()
  if (!data?.user) return

  await Purchases.logIn({
    appUserID: data.user.id
  })

  console.log("🔐 RevenueCat logged in as:", data.user.id)
}

async function presentPaywall(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    console.warn("[RC] Paywall can only run on native (Android/iOS).");
    return false;
  }

  try {
    console.log("[RC] Presenting Paywall...");

    const {result} = await RevenueCatUI.presentPaywall();

    console.log("[RC] Paywall Result:", result);

    switch (result) {
      case PAYWALL_RESULT.PURCHASED:
        console.log("[RC] 🎉 User purchased subscription!");
        return true;

      case PAYWALL_RESULT.RESTORED:
        console.log("[RC] 🔄 Subscription restored!");
        return true;

      case PAYWALL_RESULT.CANCELLED:
        console.log("[RC] User cancelled paywall.");
        return false;

      case PAYWALL_RESULT.ERROR:
        console.log("[RC] Paywall error.");
        return false;

      case PAYWALL_RESULT.NOT_PRESENTED:
      default:
        console.log("[RC] Paywall not presented.");
        return false;
    }

  } catch (e) {
    console.error("[RC] Paywall failed:", e);
    return false;
  }
}

async function loadForYouReason() {
  const user = (await supabase.auth.getUser()).data.user
  if (!user) return

  const {data} = await supabase.rpc(
      'get_user_product_preferences',
      {p_user_id: user.id}
  )

  if (!data || data.length === 0) {
    forYouReason.value = null
    return
  }

  const labels = data.map((d: any) => d.label)

  if (labels.length === 1) {
    forYouReason.value = labels[0]
  } else if (labels.length === 2) {
    forYouReason.value = `${labels[0]} and ${labels[1]}`
  } else {
    forYouReason.value = `${labels[0]}, ${labels[1]}, and ${labels[2]}`
  }
}


/* ---------------- Filters ---------------- */

watch([activeStores, activeCategories, activeStatuses, searchQuery, sortBy], () => {
  savedScrollTop.value = null; // reset scroll restore

  if (activeStores.value.length > 0) {
    ActivityLogService.log("search_filter_store", {
      store_ids: activeStores.value.map(s => s.id),
      store_names: activeStores.value.map(s => s.name),
    });
  }

  if (activeCategories.value.length > 0) {
    ActivityLogService.log("search_filter_category", {
      category_ids: activeCategories.value.map(c => c.id),
      category_names: activeCategories.value.map(c => c.name),
    });
  }

  if (activeStatuses.value.length > 0) {
    ActivityLogService.log("search_filter_status", {
      statuses: activeStatuses.value,
    });
  }


  allLoaded.value = false
  currentPage.value = 0
  infiniteDisabled.value = false   // 👈 reset infinite scroll
  fetchProducts(true)
})

watch(isDonor, (val) => {
  console.log("👀 [Watcher] isDonor changed:", val);
});

watch([sortBy, isDonor], async () => {
  if (sortBy.value === 'for_you' && isDonor.value) {
    await loadForYouReason()
  }
})

watch(sortBy, async (val) => {
  if (val !== 'for_you') {
    forYouReason.value = null
  }
})

watch(isAuthenticated, (loggedIn) => {
  if (!loggedIn && sortBy.value === 'for_you') {
    sortBy.value = 'recent'
  }
})

watch(sortBy, async (val) => {
  if (suppressSortWatcher.value) return
  if (val !== 'for_you') return

  // Non-Pro user
  if (!isDonor.value) {
    // ⛔ Web guard
    if (!Capacitor.isNativePlatform()) {
      const toast = await toastController.create({
        message: t('search.forYou.nativeOnly'),
        duration: 2000,
        color: "medium",
        position: "bottom",
      })
      await toast.present()
      return
    }

    ActivityLogService.log("search_sort_change", {
      sort: val
    })

    ActivityLogService.log("pro_paywall_trigger", {
      source: "search_sort_for_you"
    })

    await ensureRevenueCatLoggedIn()
    const purchased = await presentPaywall()

    if (purchased) {
      await refreshSubscriptionStatus({syncToServer: true})
    }

    // 🔑 IMPORTANT:
    // Do NOT revert sortBy
    return
  }
})

const showForYouInfo = computed(() => {
  return sortBy.value === 'for_you' && isDonor.value
})

const showForYouGate = computed(() => {
  return sortBy.value === 'for_you' && !isDonor.value
})

const canShowForYouSort = computed(() => {
  return isAuthenticated.value
})


const hasActiveFilters = computed(() => {
  return (
      activeStores.value.length > 0 ||
      activeCategories.value.length > 0 ||
      activeStatuses.value.length > 0 ||
      searchQuery.value.length > 0
  )
})

function clearAllFilters() {
  activeStores.value = []
  activeCategories.value = []
  activeStatuses.value = []
  searchQuery.value = ''
}



const hideForYouInfo = ref(
    localStorage.getItem('hide_for_you_info') === '1'
)

function dismissForYouInfo() {
  hideForYouInfo.value = true
  localStorage.setItem('hide_for_you_info', '1')
}

const { t } = useI18n()

const sortLabel = computed(() => {
  if (sortBy.value === 'for_you') return 'For You'
  if (sortBy.value === 'views') return 'Hot'
  if (sortBy.value === 'trending') return 'Trending'
  return 'New'
})

const sortIcon = computed(() => {
  if (sortBy.value === 'for_you') return sparklesOutline
  if (sortBy.value === 'views') return flameOutline
  if (sortBy.value === 'trending') return trendingUpOutline
  return timeOutline
})

function toggleCategory(cat: { id: number; name: string }) {
  const index = activeCategories.value.findIndex(c => c.id === cat.id)

  if (index > -1) {
    activeCategories.value = activeCategories.value.filter(c => c.id !== cat.id)
  } else {
    activeCategories.value = [...activeCategories.value, cat]

  }
}

function toggleStatus(status: string) {
  if (activeStatuses.value.includes(status)) {
    activeStatuses.value = activeStatuses.value.filter(s => s !== status)
  } else {
    activeStatuses.value = [...activeStatuses.value, status]
  }
}



/* ---------------- Scanner ---------------- */
function handleDismiss() {
  scanning.value = false
  stopScan()
}

async function stopScan() {
  if (html5QrCodeInstance.value) {
    try {
      if (html5QrCodeInstance.value.isScanning) {
        await html5QrCodeInstance.value.stop()
      }
      const reader = document.getElementById('reader')
      if (reader) reader.innerHTML = ''
    } catch (err) {
      console.warn('Error stopping scanner:', err)
    } finally {
      html5QrCodeInstance.value = null
    }
  }
}


async function startScan() {
  await ActivityLogService.log("barcode_scan_start");

  if (scanning.value) return
  scanning.value = true

  if (isNative.value) {
    try {
      // 📱 Native → ML Kit
      const { camera } = await BarcodeScanner.checkPermissions();
      if (camera !== 'granted') {
        const { camera: newStatus } = await BarcodeScanner.requestPermissions();
        if (newStatus !== 'granted') {
           scanning.value = false;
           return;
        }
      }

      const { barcodes } = await BarcodeScanner.scan();

      if (barcodes.length > 0) {
        const barcode = barcodes[0].rawValue;
        if (barcode) {
          await Haptics.impact({ style: ImpactStyle.Medium });
          activeStores.value = [];
          activeCategories.value = [];
          activeStatuses.value = [];
          isScanning.value = true;
          searchQuery.value = barcode;

          await ActivityLogService.log("barcode_scan_success", {
            barcode: barcode
          });
        }
      }
    } catch (err) {
      console.error('❌ Native scan failed:', err)
      await ActivityLogService.log("barcode_scan_error", { error: err || "unknown" });
    } finally {
      scanning.value = false
      if (route.query.scan === 'true') {
        router.replace({path: '/search'})
      }
    }
  }
}

async function onScannerModalPresented() {
  // 🌐 Web init logic here
  try {
    let readerEl = null
    // Retry finding element for up to 2 seconds
    for (let i = 0; i < 20; i++) {
      readerEl = document.getElementById('reader')
      if (readerEl) break
      await new Promise(r => setTimeout(r, 100))
    }

    if (!readerEl) {
      console.error("❌ #reader container not found after modal present")
      scanning.value = false
      return
    }

    const html5QrCode = new Html5Qrcode('reader')
    html5QrCodeInstance.value = html5QrCode

    const config = {
      fps: 15,
      qrbox: { width: 250, height: 250 },
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.QR_CODE
      ]
    }

    await html5QrCode.start(
        { facingMode: 'environment' },
        config,
        async (decodedText) => {
          console.log('✅ Web barcode detected:', decodedText)
          await Haptics.impact({style: ImpactStyle.Medium})
          
          activeStores.value = []
          activeCategories.value = []
          activeStatuses.value = []
          isScanning.value = true
          searchQuery.value = decodedText
          
          await ActivityLogService.log("barcode_scan_success", { barcode: decodedText });

          await stopScan()
          scanning.value = false
        },
        () => { /* Silent failure for each frame */ }
    )
  } catch (err) {
    console.error('❌ Web scanner start failed:', err)
    scanning.value = false
  }
}

/* ---------------- Data Fetch ---------------- */
const fetchStores = async () => {
  loadingStores.value = true
  const {data, error} = await supabase
      .from("stores")
      .select("id, name, logo_url")
      .order("sort_order", {ascending: true})
  if (!error && data) stores.value = data
  loadingStores.value = false
}

const fetchCategories = async () => {
  loadingCategories.value = true
  const {data, error} = await supabase
      .from("product_categories")
      .select("id, name")
      .order("name", {ascending: true})

  if (!error && data) {
    categories.value = data
  }
  loadingCategories.value = false
}


const fetchProducts = async (reset = false) => {
  // 🔒 Non-Pro For You Gate
  if (sortBy.value === 'for_you' && !isDonor.value) {
    results.value = []
    loadingProducts.value = false
    allLoaded.value = true
    return
  }

  if (isFetching.value || (allLoaded.value && !reset)) return
  isFetching.value = true

  if (reset) {
    currentPage.value = 0
    allLoaded.value = false
    allProducts.value = []
    infiniteDisabled.value = false
    results.value = []
  }

  loadingProducts.value = reset

  try {
    const from = currentPage.value * pageSize

    let baseSelect = "barcode, name, status, view_count, created_at, updated_at, photo_front_url, product_category_id, product_categories(name), partner:partners(partner_tier)"
    if (activeStores.value.length > 0) {
      baseSelect += ", product_stores!inner(store_id)"
    }

    /* =========================================================
       🔎 SEARCH MODE
    ========================================================= */
    if (searchQuery.value && searchQuery.value.length > 1) {
      const q = searchQuery.value.trim()
      const isNumeric = /^\d+$/.test(q);

      // 1️⃣ PRIORITIZE EXACT BARCODE MATCH (FAST)
      if (isNumeric && q.length >= 8) {
        const { data: barcodeMatch } = await supabase
          .from("products")
          .select(baseSelect)
          .eq("barcode", q) // exact match
          .single() as { data: Product | null }

        if (barcodeMatch) {
          if (isScanning.value) {
            isScanning.value = false;
            shouldResetSearch.value = true;
            router.push({path: `/item/${barcodeMatch.barcode}`});
            return;
          }
          results.value = [barcodeMatch]
          allLoaded.value = true
          isFetching.value = false
          loadingProducts.value = false
          return
        }
      }

      // 2️⃣ FALLBACK TO RPC FUZZY SEARCH
      const { data, error } = await supabase.rpc("search_products", {
        p_query: q,
        p_limit: pageSize,
        p_offset: from,
        p_sort: sortBy.value,
        p_store_ids: activeStores.value.length > 0 ? activeStores.value.map(s => s.id) : null,
        p_category_ids: activeCategories.value.length > 0 ? activeCategories.value.map(c => c.id) : null,
        p_statuses: activeStatuses.value.length > 0 ? activeStatuses.value : null
      })

      if (error) {
        errorMsg.value = error.message
      } else {
        if (!data || data.length < pageSize) {
          allLoaded.value = true
        }

        const processedData = (data || []).map((p: any) => ({
          ...p,
          partner_tier: Array.isArray(p.partner) ? p.partner[0]?.partner_tier : p.partner?.partner_tier
        }))

        results.value = reset
            ? processedData
            : [...results.value, ...processedData]

        currentPage.value++
      }

      return
    }

    /* =========================================================
       📈 TRENDING MODE (NEW)
    ========================================================= */
    if (sortBy.value === 'trending') {
      const oneDayAgo = dayjs().subtract(1, 'day').toISOString()
      
      // 1. Fetch activities from last 24h
      // We group by entity_id to find most popular items
      const { data: trendingLogs } = await supabase
        .from('activity_log')
        .select('entity_id')
        .eq('entity_type', 'product')
        .gte('created_at', oneDayAgo)
        .limit(2000)

      if (trendingLogs && trendingLogs.length > 0) {
        const counts: Record<string, number> = {}
        trendingLogs.forEach(log => {
          if (log.entity_id) counts[log.entity_id] = (counts[log.entity_id] || 0) + 1
        })

        const sortedBarcodes = Object.keys(counts)
          .sort((a, b) => counts[b] - counts[a])
          .slice(from, from + pageSize)

        if (sortedBarcodes.length > 0) {
          let trendingQuery = supabase
            .from("products")
            .select(baseSelect)
            .eq("approved", true)
            .in("barcode", sortedBarcodes)

          if (activeStores.value.length > 0) {
             trendingQuery = trendingQuery.in("product_stores.store_id", activeStores.value.map(s => s.id))
          }
          if (activeCategories.value.length > 0) {
             trendingQuery = trendingQuery.in("product_category_id", activeCategories.value.map(c => c.id))
          }
          if (activeStatuses.value.length > 0) {
             trendingQuery = trendingQuery.in("status", activeStatuses.value)
          }

          const { data: trendingProducts } = await trendingQuery.returns<Product[]>()

          if (trendingProducts) {
            // Sort by popularity again since .in() is unordered
            const ordered = trendingProducts.sort((a,b) => (counts[b.barcode] || 0) - (counts[a.barcode] || 0))
            
            results.value = reset ? ordered : [...results.value, ...ordered]
            if (sortedBarcodes.length < pageSize) allLoaded.value = true
            
            currentPage.value++
            isFetching.value = false
            loadingProducts.value = false
            return
          }
        }
      }
      
      // Fallback if no logs 
      if (reset) results.value = []
      allLoaded.value = true
      isFetching.value = false
      loadingProducts.value = false
      return
    }

    /* =========================================================
       ✨ FOR YOU MODE (Pro)
    ========================================================= */
    if (sortBy.value === 'for_you' && isDonor.value) {
      const { data, error } = await supabase.rpc(
          'get_for_you_products',
          {
            p_user_id: (await supabase.auth.getUser()).data.user?.id,
            p_limit: pageSize,
            p_offset: from,
          }
      )

      if (error) {
        errorMsg.value = error.message
      } else {
        if (!data || data.length < pageSize) {
          allLoaded.value = true
        }

        const processedData = (data || []).map((p: any) => ({
          ...p,
          partner_tier: Array.isArray(p.partner) ? p.partner[0]?.partner_tier : p.partner?.partner_tier
        }))

        results.value = reset
            ? processedData
            : [...results.value, ...processedData]

        currentPage.value++
      }

      return
    }


    /* =========================================================
       📦 NORMAL BROWSING MODE
    ========================================================= */

    let query = supabase
        .from("products")
        .select(baseSelect)
        .eq("approved", true)

    // 🏬 Store filter
    if (activeStores.value.length > 0) {
      const storeIds = activeStores.value.map(s => s.id)
      query = query.in("product_stores.store_id", storeIds)
    }

    // 🏷 Category filter
    if (activeCategories.value.length > 0) {
      const categoryIds = activeCategories.value.map(c => c.id)
      query = query.in("product_category_id", categoryIds)
    }

    // 🛡 Status filter
    if (activeStatuses.value.length > 0) {
      query = query.in("status", activeStatuses.value)
    }

    // Sorting
    if (sortBy.value === 'views') {
      query = query.order('view_count', { ascending: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    query = query.range(from, from + pageSize - 1)

    const { data, error } = await query.returns<Product[]>()

    if (error) {
      errorMsg.value = error.message
    } else {
      if (!data || data.length < pageSize) {
        allLoaded.value = true
      }

      const processedData = data || []
      
      // 🏎️ Special Sort for "Recent" mode: Gold/Silver < 7 days old go to the top
      if (sortBy.value === 'recent' && processedData.length > 0) {
        const sevenDaysAgo = dayjs().subtract(7, 'day');
        // Sort the ENTIRE current results plus new data to ensure pinning works
        const allResults = reset ? processedData : [...results.value, ...processedData];
        
        allResults.sort((a: any, b: any) => {
          const getWeight = (p: any) => {
            const t = Array.isArray(p.partner) ? p.partner[0]?.partner_tier : p.partner?.partner_tier;
            const tier = String(t || '').toLowerCase();
            const isNew = dayjs(p.created_at).isAfter(sevenDaysAgo) || (p.updated_at && dayjs(p.updated_at).isAfter(sevenDaysAgo));
            
            if (tier === 'gold' && isNew) return 3; // Absolute priority
            if (tier === 'gold') return 2;          // Regular Gold
            if (tier === 'silver' && isNew) return 1;
            return 0;
          };
          
          const weightA = getWeight(a);
          const weightB = getWeight(b);

          if (weightA !== weightB) return weightB - weightA;
          return dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf();
        });

        results.value = allResults.map((p: any) => ({
          ...p,
          partner_tier: Array.isArray(p.partner) ? p.partner[0]?.partner_tier : p.partner?.partner_tier
        }));
      } else {
        const mapped = processedData.map((p: any) => ({
          ...p,
          partner_tier: Array.isArray(p.partner) ? p.partner[0]?.partner_tier : p.partner?.partner_tier
        }));
        results.value = reset
            ? mapped
            : [...results.value, ...mapped]
      }

      currentPage.value++
    }

  } finally {
    isFetching.value = false
    loadingProducts.value = false
    isScanning.value = false
  }
}

const fetchTotalCount = async () => {
  loadingCount.value = true
  const {count, error} = await supabase
      .from('products')
      .select('barcode', {count: 'exact', head: true})
  if (error) {
    errorMsg.value = error.message
  } else {
    totalProductsCount.value = count || 0
  }
  loadingCount.value = false
}

/* ---------------- Search ---------------- */
const handleSearchInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const q = target.value.trim();
  searchQuery.value = q;

  if (q.length > 1) {   // only log if at least 2 chars
    ActivityLogService.log("search_query", {query: q});
  }
};

/* ---------------- UI helpers ---------------- */
function fromNowToTaipei(dateString?: string) {
  if (!dateString) return ''
  return dayjs.utc(dateString).tz('Asia/Taipei').fromNow()
}

const openDetails = async (product: Product) => {

  // ✅ safely read scroll position
  const ionContent = getIonContentEl()
  if (ionContent) {
    const scrollEl = await ionContent.getScrollElement()
    savedScrollTop.value = scrollEl.scrollTop
  }

  ActivityLogService.log("search_product_click", {
    barcode: product.barcode,
    product_name: product.name,
    status: product.status,
    store: activeStores.value.map(s => s.name),
    category: activeCategories.value.map(c => c.name),
    status_filters: activeStatuses.value,
    query_used: searchQuery.value || null
  });

  router.push({path: `/item/${product.barcode}`})
}

function goToAddProduct() {
  router.push('/add')
}

function getStatusClass(status: string) {
  switch (status) {
    case 'Halal':
      return 'status-halal'
    case 'Muslim-friendly':
      return 'status-muslim'
    case 'Syubhah':
      return 'status-syubhah'
    case 'Haram':
      return 'status-haram'
    default:
      return ''
  }
}


/* ---------------- Infinite Scroll ---------------- */
const loadMore = async (event: Event) => {
  await fetchProducts()
  ;(event.target as HTMLIonInfiniteScrollElement).complete()
}


async function refreshList(event: CustomEvent) {
  try {
    await nextTick()
    infiniteDisabled.value = false   // ✅ reactive instead of mutating prop

    await Promise.all([
      fetchProducts(true),
      fetchTotalCount(),
    ])
  } finally {
    event.detail.complete()
  }
}


/* ---------------- Lifecycle ---------------- */
onMounted(async () => {
  // 🔹 Auth/session setup
  const {data: {session}} = await supabase.auth.getSession()
  isAuthenticated.value = !!session
  supabase.auth.onAuthStateChange((_event, session) => {
    isAuthenticated.value = !!session
  })

  // 🔹 Ingredient dictionary preload
  const {data, error} = await supabase.from('ingredient_highlights').select('keyword, color')
  if (!isNative.value) {
    await nextTick()
  }
  if (!error && data) {
    ingredientDictionary.value = data.reduce((acc, item) => {
      acc[item.keyword] = item.color
      return acc
    }, {} as Record<string, string>)
  }

  // 🔹 Initial data load
  await Promise.all([
    fetchProducts(true),
    fetchTotalCount(),
    fetchCategories(),
    fetchStores(),
  ])
})

onIonViewWillEnter(async () => {
  if (Capacitor.isNativePlatform()) refreshSubscriptionStatus();

  if (shouldResetSearch.value) {
    clearAllFilters();
    shouldResetSearch.value = false;
  }
})


onIonViewDidEnter(async () => {
  await ActivityLogService.log("search_page_open");
  // --- 🔥 Refresh view_count in one batch ---
  if (results.value.length > 0) {
    const barcodes = results.value.map(p => p.barcode);

    const {data: updatedCounts, error} = await supabase
        .from("products")
        .select("barcode, view_count")
        .in("barcode", barcodes);

    if (!error && updatedCounts) {
      for (const updated of updatedCounts) {
        const product = results.value.find(p => p.barcode === updated.barcode);
        if (product) product.view_count = updated.view_count;
      }
    }
  }

  // 🧭 RESTORE SCROLL POSITION
  if (savedScrollTop.value !== null) {
    await nextTick()
    const ionContent = getIonContentEl()
    if (ionContent) {
      const scrollEl = await ionContent.getScrollElement()
      scrollEl.scrollTo({
        top: savedScrollTop.value,
        behavior: 'auto'
      })
    }
  }

  // Refresh AdMob if needed
  (window as any).scheduleBannerUpdate?.();

  // Auto trigger scanner if route has scan=true
  if (route.query.scan === "true") {
    setTimeout(async () => {
      await startScan();
      router.replace({path: "/search"});
    }, 300);
  }
});


const getStatusIcon = (status: string) => {
  switch (status.toLowerCase()) {
    case 'halal': return checkmarkCircle
    case 'muslim-friendly': return shieldCheckmarkOutline
    case 'syubhah': return alertCircle
    case 'haram': return closeCircle
    default: return warning
  }
}

</script>


<style>
.footer-count {
  text-align: center;
  padding: 3px 0;
  font-size: 14px;
  color: var(--ion-color-medium);
  background: transparent;
}


#reader {
  width: 100%;
  max-height: 100%;
  border-radius: 8px;
  overflow: hidden;
  margin: 0 auto; /* center horizontally */
}

/* For larger screens */
@media (min-width: 768px) {
  #reader {
    width: 400px; /* fixed width for better control */
    height: 300px; /* fixed height */
    border-radius: 8px; /* maybe larger radius for desktop */
  }
}

ion-chip {
  border-radius: 999px !important;
  --border-radius: 999px !important;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

ion-searchbar.rounded {
  --border-radius: 8px;
  --box-shadow: 0 1px 3px rgba(41, 40, 40, 0.1);
}

/* =========================
   Modern Product Card Redesign
   ========================= */

.product-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  padding: 4px 0;
}

/* Laptop & Computer Only: Multiple columns */
@media (min-width: 1024px) {
  .product-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 1440px) {
  .product-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

/* Tablet: 2 columns */
@media (min-width: 768px) and (max-width: 1023px) {
  .product-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.modern-product-card {
  margin: 0; /* Reset margin for grid layout */
  background: var(--ion-card-background, #ffffff);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  border: 1px solid rgba(var(--ion-color-dark-rgb), 0.05);
  transition: transform 0.2s ease, box-shadow 0.3s ease;
  cursor: pointer;
  position: relative;
  height: 140px; /* Fixed height for clean grid rows */
}

/* Mobile: restore bottom margin if grid is 1 column */
@media (max-width: 767px) {
  .modern-product-card {
    margin-bottom: 12px;
  }
}

.modern-product-card:active {
  transform: scale(0.98);
}

.card-inner {
  display: flex;
  height: 140px; /* Slightly taller for better product display */
}

/* Image Section */
.card-image-section {
  width: 140px;
  height: 100%;
  flex-shrink: 0;
  position: relative;
  background: var(--ion-background-color-step-100, #f8fafc);
}

.card-image-section img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Status Strip on Image Side */
.status-strip {
  position: absolute;
  top: 0;
  left: 0;
  width: 5px;
  height: 100%;
}
.status-strip.halal { background: var(--ion-color-success); }
.status-strip.muslim-friendly { background: var(--ion-color-primary); }
.status-strip.syubhah { background: var(--ion-color-warning); }
.status-strip.haram { background: var(--ion-color-danger); }

/* Status Strip Separator */
.status-strip {
  position: absolute;
  top: 0;
  right: 0; /* Move to right of image as separator */
  width: 4px;
  height: 100%;
  opacity: 0.8;
}
.status-strip.halal { background: #00c853; }
.status-strip.muslim-friendly { background: #007bff; }
.status-strip.syubhah { background: #ffc107; }
.status-strip.haram { background: #f44336; }

/* Floating Status Pill on Image */
.floating-status-pill {
  position: absolute;
  padding: 4px 10px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 5px;
  z-index: 2;
  box-shadow: 0 4px 12px rgba(0,0,0,0.25);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.3);
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #fff;
}

.floating-status-pill.bottom-left {
  bottom: 28px;
  left: 8px;
}

.floating-status-pill.top-left {
  top: 8px;
  left: 8px;
}

.floating-status-pill ion-icon {
  font-size: 14px;
}

.floating-status-pill.halal { background: rgba(var(--ion-color-success-rgb), 0.9); }
.floating-status-pill.muslim-friendly { 
  background: rgba(var(--ion-color-primary-rgb), 0.95); 
  font-size: 0.58rem; /* Smaller for longer text */
  padding: 3px 8px;
  gap: 3px;
  letter-spacing: 0.01em;
}
.floating-status-pill.muslim-friendly ion-icon { font-size: 12px; }
.floating-status-pill.syubhah { background: rgba(var(--ion-color-warning-rgb), 0.95); color: var(--ion-color-warning-contrast); }
.floating-status-pill.syubhah ion-icon { color: var(--ion-color-warning-contrast); }
.floating-status-pill.haram { background: rgba(var(--ion-color-danger-rgb), 0.9); }

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
  font-size: 1.15rem; /* Larger */
  font-weight: 850; /* Heavier */
  color: var(--ion-color-dark);
  line-height: 1.25;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* metas is now inside info-top */
.info-top .metas {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 0.78rem;
  color: var(--ion-color-medium);
  margin-top: 4px;
}

.meta-dot { opacity: 0.5; margin: 0 4px; }

.meta {
  display: flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
}

.meta-icon {
  font-size: 0.85rem;
  margin-right: 2px;
  flex-shrink: 0;
}

/* Bottom row: partner badge stacked above metas, both pinned to bottom */
.info-bottom {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  width: 100%;
}

.vibrant-status-tag {
  display: flex;
  align-items: center;
  justify-content: center; /* Center the text */
  gap: 6px;
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 0.75rem; /* Slightly smaller for long text */
  font-weight: 800;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  transition: transform 0.2s ease;
  width: 145px; /* Fixed width to longest text 'Muslim-friendly' */
  flex-shrink: 0;
}

.vibrant-status-tag .tag-icon {
  font-size: 16px;
}

.vibrant-status-tag.halal {
  background: var(--ion-color-success);
  color: var(--ion-color-success-contrast);
}
.vibrant-status-tag.muslim-friendly {
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}
.vibrant-status-tag.syubhah {
  background: var(--ion-color-warning);
  color: var(--ion-color-warning-contrast);
}
.vibrant-status-tag.haram {
  background: var(--ion-color-danger);
  color: var(--ion-color-danger-contrast);
}

.end-of-list {
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--ion-color-medium);
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
  max-height: 300px; /* adjust to fit content */
  opacity: 1;
}

.filter-group {
  margin: 8px 0;
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

/* Consolidated Search Header Styles (3-Row Layout) */
.header-main-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 16px;
  width: 100%;
}

.classic-scan-btn {
  width: 50px;
  height: 50px;
  min-width: 50px;
  --padding-start: 0;
  --padding-end: 0;
  --border-radius: 12px;
  margin: 0;
}

.classic-scan-btn ion-icon {
  font-size: 24px;
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

.right-actions-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-label {
  margin-left: 4px;
  font-size: 13px;
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

.compact-searchbar {
  --border-radius: 100px;
  --background: var(--ion-background-color);
  --color: var(--ion-color-dark);
  --placeholder-color: var(--ion-color-step-600);
  --icon-color: var(--ion-color-carrot);
  --clear-button-color: var(--ion-color-step-600);
  border: 1px solid rgba(var(--ion-color-dark-rgb), 0.1);
  border-radius: 100px;
  padding: 0;
  width: 100%;
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

/* Make seamless with app-header */
ion-header :deep(app-header ion-toolbar) {
  --border-width: 0;
  border-bottom: none !important;
}

ion-header {
  border-bottom: none !important;
  box-shadow: none !important;
}





/* Force neutral text color in toolbar controls */
.actions-toolbar ion-button,
.actions-toolbar ion-icon {
  color: var(--ion-color-dark);
}

.filter-section {
  padding-bottom: 0;
}

.for-you-info {
  border-left: 4px solid var(--ion-color-warning);
  margin-bottom: 12px;
}

.for-you-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.for-you-icon {
  font-size: 20px;
  color: var(--ion-color-warning);
  margin-top: 2px;
}

.for-you-info p {
  font-size: 13px;
  margin: 4px 0 0;
}

/* =========================
   MODERN CATEGORY CHIPS
========================= */
.category-bar {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 0 16px 8px;
}

ion-chip.modern-category-chip {
  --cat-color: var(--ion-color-dark);
  --cat-bg: var(--ion-background-color);
  background: var(--cat-bg);
  color: var(--cat-color);
  height: 38px;
  border-radius: 100px !important;
  --border-radius: 100px !important;
  padding: 0 16px;
  border: 1.5px solid var(--cat-color);
  font-weight: 700;
  font-size: 0.82rem;
  transition: all 0.2s ease;
  margin: 0;
  flex-shrink: 0;
  width: auto;
  overflow: hidden;
}

.ion-palette-dark .modern-category-chip {
  --cat-bg: var(--ion-background-color);
}

.modern-category-chip.active {
  background: var(--cat-color) !important;
  color: var(--cat-contrast, #ffffff);
  border-color: var(--cat-color) !important;
  border-radius: 100px !important;
  --border-radius: 100px !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  transform: translateY(-1px);
}

.category-emoji { margin-right: 6px; font-size: 1.1rem; }
.category-icon { margin-right: 6px; font-size: 1.1rem; }

.filter-clear-row {
  display: flex;
  justify-content: flex-start;
  padding: 4px 12px 4px;
}

/* =========================
   Grid View Styles
   ========================= */

.product-grid.grid-mode {
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 8px;
}

@media (min-width: 768px) {
  .product-grid.grid-mode {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (min-width: 1024px) {
  .product-grid.grid-mode {
    grid-template-columns: repeat(6, 1fr);
  }
}

.grid-product-card {
  aspect-ratio: 1 / 1;
  border-radius: 16px;
  overflow: hidden;
  background: var(--ion-card-background, #ffffff);
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  border: 1px solid rgba(var(--ion-color-dark-rgb), 0.05);
  position: relative;
  transition: transform 0.2s ease;
}

.grid-product-card:active {
  transform: scale(0.95);
}

.grid-card-image {
  width: 100%;
  height: 100%;
  position: relative;
}

.grid-card-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.grid-status-label {
  position: absolute;
  top: 8px;
  right: 8px;
  height: 24px;
  padding: 0 8px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255,255,255,0.3);
  z-index: 2;
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.grid-status-label ion-icon {
  font-size: 16px;
}

.grid-status-label.halal { background: rgba(var(--ion-color-success-rgb), 0.9); }
.grid-status-label.muslim-friendly { background: rgba(var(--ion-color-primary-rgb), 0.95); }
.grid-status-label.syubhah { background: rgba(var(--ion-color-warning-rgb), 0.95); color: var(--ion-color-warning-contrast); }
.grid-status-label.haram { background: rgba(var(--ion-color-danger-rgb), 0.9); }
</style>

<style>
/* Force readable text colors for tiered cards in dark mode */
.ion-palette-dark .modern-product-card[class*="tier-card-"] .name {
  color: #ffffff !important;
}

.ion-palette-dark .meta,
.ion-palette-dark .meta-dot {
  color: #d1d5db !important;
}
</style>