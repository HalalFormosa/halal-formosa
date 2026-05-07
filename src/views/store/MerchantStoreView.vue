<template>
  <ion-page>
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/store" />
        </ion-buttons>
        <ion-title>{{ store?.name || $t('store.title') }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="toggleDarkPalette(!isDark)">
            <ion-icon :icon="isDark ? sunnyOutline : moonOutline" />
          </ion-button>
          <ion-button v-if="isOwner" @click="navigateToSettings">
            <ion-icon :icon="settingsOutline" />
          </ion-button>
          <ion-button v-else @click="handleChat" :disabled="!store">
            <ion-icon :icon="chatbubbleOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div class="merchant-container">
        <!-- Store Profile Header -->
        <div class="store-profile-card">
          <div 
            class="store-banner clickable" 
            :style="store?.banner_url ? { backgroundImage: `url(${store.banner_url})` } : {}"
            @click="openZoomModal(store?.banner_url)"
          ></div>
          <div class="store-profile-content">
            <ion-avatar class="main-store-avatar clickable" @click="openZoomModal(store?.logo_url || '/favicon-32x32.png')">
              <img :src="store?.logo_url || '/favicon-32x32.png'" />
            </ion-avatar>
            <div class="store-info-text">
              <h1 class="store-display-name">{{ localized(store?.name_zh, store?.name) }}</h1>
              <p class="store-description" v-if="store?.description || store?.description_zh">
                {{ localized(store.description_zh, store.description) }}
              </p>
              <div class="store-stats">
                <span class="stat-item">
                  <strong>{{ products.length }}</strong> {{ $t('store.products') }}
                </span>
                <span class="stat-item">
                  <ion-icon :icon="checkmarkCircleOutline" color="success" />
                  {{ $t('store.verifiedSeller') }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Category pills -->
        <div class="category-scroll">
          <button
            v-for="cat in allCategories"
            :key="cat.id ?? 'all'"
            :class="['premium-cat-pill', { 'pill-active': selectedCategory === cat.id }]"
            :style="{ backgroundImage: `url(${cat.image_url})` }"
            @click="selectedCategory = selectedCategory === cat.id ? null : cat.id"
          >
            <span class="pill-text">{{ localized(cat.name_zh, cat.name) }}</span>
          </button>
        </div>

        <!-- Sort & Filter Row -->
        <div class="filter-row" v-if="products.length > 0 || !loading">
          <ion-button id="merchant-sort-trigger" fill="clear" size="small" class="modern-sort-button">
            {{ currentSortLabel }}
            <ion-icon :icon="chevronDownOutline" slot="end" size="small" />
          </ion-button>

          <ion-popover trigger="merchant-sort-trigger" size="auto" dismiss-on-select class="width-190">
            <ion-content>
              <ion-list lines="none">
                <ion-item v-for="s in sortOptions" :key="s.value" button @click="sortBy = s.value"
                  :class="{ 'active-sort': sortBy === s.value }">
                  <ion-label>{{ s.label }}</ion-label>
                  <ion-icon v-if="sortBy === s.value" :icon="checkmarkOutline" slot="end" color="carrot" />
                </ion-item>
              </ion-list>
            </ion-content>
          </ion-popover>

          <ion-button fill="clear" size="small" class="modern-filter-button" @click="openFilter">
            <ion-icon :icon="filterOutline" slot="start" />
            {{ $t('common.filter') || 'Filter' }}
            <ion-badge v-if="minPrice || maxPrice || stockOnly" color="carrot" class="filter-count-badge">·</ion-badge>
          </ion-button>
        </div>

        <!-- Products Grid -->
        <div class="section-header">
          <h2>{{ $t('store.featuredProducts') || 'Store Products' }}</h2>
        </div>

        <div v-if="loading" class="store-grid">
           <div v-for="n in 4" :key="n" class="store-product-card skeleton-card">
            <ion-skeleton-text animated class="product-image-skeleton" />
            <div class="product-info">
              <ion-skeleton-text animated style="width: 40%; height: 12px;" />
              <ion-skeleton-text animated style="width: 80%; height: 16px; margin-top: 6px;" />
              <ion-skeleton-text animated style="width: 50%; height: 14px; margin-top: 6px;" />
            </div>
          </div>
        </div>

        <div v-else-if="products.length > 0" class="store-grid">
          <div
            v-for="product in products"
            :key="product.id"
            class="store-product-card"
            @click="navigateToProduct(product.id)"
          >
            <div class="product-image-wrapper">
              <img
                v-if="product.images?.length"
                :src="product.images[0]"
                class="product-image"
                loading="lazy"
              />
              <div v-else class="product-image-placeholder">
                <ion-icon :icon="imageOutline" />
              </div>
            </div>
            <div class="product-info">
              <h4 class="product-name">{{ localized(product.name_zh, product.name) }}</h4>
              <div v-if="product.avg_rating > 0" class="product-rating-row">
                <span class="star-icons" v-html="renderStars(product.avg_rating)"></span>
                <span class="rating-count">{{ product.avg_rating }}</span>
                <span class="review-count" v-if="product.review_count > 0">({{ product.review_count }})</span>
              </div>
              <div class="product-price-row">
                <span class="product-price">{{ $t('store.twd') }}{{ formatPrice(product.price) }}</span>
                <span class="product-sold" v-if="product.sale_count > 0">
                  {{ $t('store.sold', { count: product.sale_count }) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="empty-products">
          <ion-icon :icon="bagHandleOutline" class="empty-icon" />
          <p>{{ $t('store.noProducts') }}</p>
        </div>
      </div>
    </ion-content>

    <!-- Advanced Filter Modal -->
    <ion-modal :is-open="filterOpen" @didDismiss="filterOpen = false" :initial-breakpoint="0.45" :breakpoints="[0, 0.45, 0.7]">
      <ion-header class="ion-no-border">
        <ion-toolbar>
          <ion-title>{{ $t('common.filter') || 'Filter' }}</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="resetFilters" color="carrot" class="modal-reset-btn">
              {{ $t('common.reset') || 'RESET' }}
            </ion-button>
            <ion-button @click="filterOpen = false">
              <ion-icon :icon="closeOutline" />
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding filter-modal-content">
        <div class="filter-section">
          <h3 class="filter-section-title">{{ $t('store.priceRange') || 'Price Range (TWD)' }}</h3>
          <div class="price-input-group">
            <div class="price-input-container">
              <span class="price-symbol">$</span>
              <ion-input type="number" v-model="tempMinPrice" placeholder="Min" class="premium-price-input" />
            </div>
            <div class="price-dash"></div>
            <div class="price-input-container">
              <span class="price-symbol">$</span>
              <ion-input type="number" v-model="tempMaxPrice" placeholder="Max" class="premium-price-input" />
            </div>
          </div>
        </div>
        <div class="filter-section">
          <ion-item lines="none" class="stock-toggle-card">
            <ion-label>
              <h3>{{ $t('store.inStockOnly') || 'In Stock Only' }}</h3>
              <p>{{ $t('store.hideOutOfStock') || 'Show only products currently available' }}</p>
            </ion-label>
            <ion-toggle v-model="tempStockOnly" color="carrot" slot="end" />
          </ion-item>
        </div>
        <div class="modal-action-row">
          <ion-button expand="block" color="carrot" class="premium-apply-btn" @click="applyFilters">
            {{ $t('common.apply') || 'Apply Filters' }}
          </ion-button>
        </div>
      </ion-content>
    </ion-modal>

    <!-- Fullscreen Image Modal -->
    <ion-modal :is-open="showImageModal" @didDismiss="closeImageModal" class="image-zoom-modal">
      <ion-content fullscreen class="ion-no-padding">
        <ion-button fill="solid" color="carrot" class="image-modal-close-btn" @click="closeImageModal">
          <ion-icon :icon="closeOutline" />
        </ion-button>

        <Swiper
          v-if="zoomImages.length"
          :modules="[Pagination, Zoom]"
          :zoom="true"
          :slides-per-view="1"
          :pagination="{ clickable: true }"
          class="fullscreen-swiper"
        >
          <SwiperSlide v-for="(img, i) in zoomImages" :key="i">
            <div class="swiper-zoom-container">
              <img :src="img" alt="Zoomed Store Image" />
            </div>
          </SwiperSlide>
        </Swiper>
      </ion-content>
    </ion-modal>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IonPage, IonHeader, IonContent, IonToolbar, IonButtons, IonBackButton,
  IonTitle, IonAvatar, IonIcon, IonButton, IonSkeletonText, IonPopover,
  IonList, IonItem, IonLabel, IonModal, IonBadge, IonInput, IonToggle,
  onIonViewWillEnter
} from '@ionic/vue'
import {
  chatbubbleOutline, checkmarkCircleOutline, imageOutline, bagHandleOutline,
  settingsOutline, chevronDownOutline, checkmarkOutline, filterOutline,
  closeOutline, moonOutline, sunnyOutline
} from 'ionicons/icons'
import { supabase } from '@/plugins/supabaseClient'
import { useI18n } from 'vue-i18n'
import { useStoreChat } from '@/composables/useStoreChat'
import { useTheme } from '@/composables/useTheme'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Pagination, Zoom } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/pagination'
import 'swiper/css/zoom'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const { getOrCreateConversation } = useStoreChat()
const { isDark, toggleDarkPalette } = useTheme()

const store = ref<any>(null)
const products = ref<any[]>([])
const categories = ref<any[]>([])
const loading = ref(true)
const currentUserId = ref<string | null>(null)

// Filtering State
const selectedCategory = ref<number | null>(null)
const sortBy = ref('popular')
const minPrice = ref<number | null>(null)
const maxPrice = ref<number | null>(null)
const stockOnly = ref(false)
const filterOpen = ref(false)
const tempMinPrice = ref<number | null>(null)
const tempMaxPrice = ref<number | null>(null)
const tempStockOnly = ref(false)

// Zoom Logic
const showImageModal = ref(false)
const zoomImages = ref<string[]>([])

function openZoomModal(url: string | null) {
  if (!url) return
  zoomImages.value = [url]
  showImageModal.value = true
}

function closeImageModal() {
  showImageModal.value = false
}

const sortOptions = computed(() => [
  { value: 'popular', label: t('store.sortRelevance') },
  { value: 'recent', label: t('store.sortRecent') },
  { value: 'top_sale', label: t('store.sortTopSale') },
  { value: 'top_rated', label: t('store.sortTopRated') },
  { value: 'price_desc', label: t('store.sortPriceDesc') },
  { value: 'price_asc', label: t('store.sortPriceAsc') }
])

const currentSortLabel = computed(() => {
  const opt = sortOptions.value.find(s => s.value === sortBy.value)
  return opt?.label || t('store.sortRelevance')
})

const allCategories = computed(() => {
  return [
    { 
      id: null, 
      name: t('store.allCategories'), 
      name_zh: null, 
      image_url: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=150&q=80' 
    }, 
    ...categories.value
  ]
})

const isOwner = computed(() => {
  if (!store.value || !currentUserId.value) return false
  return store.value.user_id === currentUserId.value
})

function localized(zh: string | null | undefined, en: string | null | undefined): string {
  if (locale.value === 'zh') return zh || en || ''
  return en || zh || ''
}

function formatPrice(price: number) {
  return Number(price).toLocaleString()
}

function renderStars(rating: number): string {
  const full = Math.floor(rating)
  const half = rating - full >= 0.3 && rating - full < 0.8 ? 1 : 0
  const empty = 5 - full - half
  let html = ''
  for (let i = 0; i < full; i++) html += '★'
  if (half) html += '★'
  for (let i = 0; i < empty; i++) html += '☆'
  return html
}

function openFilter() {
  tempMinPrice.value = minPrice.value
  tempMaxPrice.value = maxPrice.value
  tempStockOnly.value = stockOnly.value
  filterOpen.value = true
}

function applyFilters() {
  minPrice.value = tempMinPrice.value
  maxPrice.value = tempMaxPrice.value
  stockOnly.value = tempStockOnly.value
  filterOpen.value = false
}

function resetFilters() {
  tempMinPrice.value = null
  tempMaxPrice.value = null
  tempStockOnly.value = false
}

async function fetchCategories() {
  if (!store.value) return
  
  // 1. Get distinct category IDs from this merchant's products
  const { data: storeProductCats } = await supabase
    .from('store_products')
    .select('category_id')
    .eq('store_id', store.value.id)
    .eq('is_active', true)
  
  const usedCatIds = [...new Set((storeProductCats || []).map(p => p.category_id).filter(Boolean))]
  
  // 2. Fetch those categories
  const { data } = await supabase
    .from('store_product_categories')
    .select('*')
    .eq('is_active', true)
    .in('id', usedCatIds)
    .order('sort_order')
    
  const seen = new Set<string>()
  categories.value = (data || []).filter((c: any) => {
    if (seen.has(c.name)) return false
    seen.add(c.name)
    return true
  })
}

async function fetchProducts(silent = false) {
  if (!store.value) return
  if (!silent) loading.value = true
  
  let query = supabase
    .from('store_products')
    .select('*')
    .eq('store_id', store.value.id)
    .eq('is_active', true)

  if (selectedCategory.value) {
    query = query.eq('category_id', selectedCategory.value)
  }
  if (minPrice.value !== null) query = query.gte('price', minPrice.value)
  if (maxPrice.value !== null) query = query.lte('price', maxPrice.value)
  if (stockOnly.value) query = query.gt('stock_quantity', 0)

  // Sort
  switch (sortBy.value) {
    case 'recent':
      query = query.order('created_at', { ascending: false })
      break
    case 'price_asc':
      query = query.order('price', { ascending: true })
      break
    case 'price_desc':
      query = query.order('price', { ascending: false })
      break
    case 'top_sale':
      query = query.order('sale_count', { ascending: false })
      break
    case 'top_rated':
      query = query.order('avg_rating', { ascending: false }).order('review_count', { ascending: false })
      break
    case 'popular':
    default:
      query = query.order('sale_count', { ascending: false })
      break
  }

  const { data } = await query
  products.value = data || []
  if (!silent) loading.value = false
}

async function fetchStoreData() {
  const storeId = route.params.id as string
  const { data: storeData } = await supabase
    .from('merchant_stores')
    .select('*')
    .eq('id', storeId)
    .maybeSingle()

  if (storeData) {
    store.value = storeData
    await Promise.all([
      fetchProducts(),
      fetchCategories()
    ])
  }
}

watch([selectedCategory, sortBy, minPrice, maxPrice, stockOnly], () => {
  fetchProducts()
})

async function fetchUser() {
  const { data } = await supabase.auth.getUser()
  currentUserId.value = data?.user?.id || null
}

async function handleChat() {
  if (!store.value) return
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  const convId = await getOrCreateConversation(store.value.user_id)
  if (convId) {
    router.push(`/store/chat/${convId}`)
  }
}

function navigateToProduct(id: string) {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  router.push(`/store/product/${id}`)
}

function navigateToSettings() {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  router.push('/merchant/store/settings')
}

onMounted(() => {
  fetchStoreData()
  fetchUser()
})

onIonViewWillEnter(() => {
  // Silently refresh products to pick up changes like review counts
  if (store.value) {
    fetchProducts(true)
  }
})
</script>

<style scoped>
.merchant-container {
  padding-bottom: 40px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.store-profile-card {
  position: relative;
  background: var(--ion-background-color);
  margin-bottom: 24px;
}

.store-banner {
  height: 140px;
  background: linear-gradient(135deg, var(--ion-color-carrot-shade, #e67e22), var(--ion-color-carrot, #f39c12));
  background-size: cover;
  background-position: center;
  position: relative;
  transition: opacity 0.2s ease;
}

.store-banner.clickable:active {
  opacity: 0.8;
}

.store-banner::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.1);
}

.store-profile-content {
  margin-top: -50px;
  padding: 0 20px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

@media (min-width: 768px) {
  .store-profile-content {
    flex-direction: row;
    text-align: left;
    align-items: flex-end;
    gap: 24px;
    margin-top: -40px;
    padding: 0 40px 32px;
  }
}

.main-store-avatar {
  width: 100px;
  height: 100px;
  border: 4px solid var(--ion-background-color);
  box-shadow: 0 4px 12px rgba(0,0,0,0.12);
  background: var(--ion-color-step-50, #ffffff);
  cursor: pointer;
  transition: transform 0.2s ease;
}

.main-store-avatar:active {
  transform: scale(0.95);
}

.store-info-text {
  margin-top: 12px;
  flex: 1;
}

.store-display-name {
  font-size: 1.5rem;
  font-weight: 800;
  margin: 0;
  color: var(--ion-text-color);
}

.store-description {
  font-size: 0.9rem;
  color: var(--ion-color-medium);
  margin: 8px 0 16px;
  max-width: 400px;
  line-height: 1.5;
}

.store-stats {
  display: flex;
  gap: 20px;
  font-size: 0.85rem;
  color: var(--ion-color-step-600, #666);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.section-header {
  padding: 0 20px;
  margin-bottom: 16px;
}

.section-header h2 {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0;
}

/* Category pills */
.category-scroll {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 16px;
  -webkit-overflow-scrolling: touch;
  background: transparent;
}

.category-scroll::-webkit-scrollbar {
  display: none;
}

.premium-cat-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  height: 42px;
  min-width: 80px;
  border-radius: 21px;
  border: 2px solid transparent;
  background-size: cover;
  background-position: center;
  position: relative;
  overflow: hidden;
  color: #ffffff;
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
  -webkit-tap-highlight-color: transparent;
}

.premium-cat-pill::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  transition: background 0.3s ease;
  z-index: 1;
}

.pill-text {
  position: relative;
  z-index: 2;
  font-size: 0.85rem;
  font-weight: 700;
  white-space: nowrap;
  letter-spacing: 0.02em;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}

.pill-active {
  border-color: var(--ion-color-carrot) !important;
  box-shadow: 0 8px 25px rgba(255, 126, 0, 0.35);
  transform: translateY(-2px) scale(1.02);
}

.pill-active::before {
  background: rgba(var(--ion-color-carrot-rgb), 0.3);
}

/* Filter Row */
.filter-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 20px 16px;
}

.modern-sort-button {
  --border-radius: 20px;
  --padding-start: 12px;
  --padding-end: 12px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: none;
  --color: var(--ion-text-color);
}

.modern-filter-button {
  --border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
  text-transform: none;
  --color: var(--ion-text-color);
  position: relative;
}

.filter-count-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  min-width: 6px;
  height: 6px;
  border-radius: 50%;
  padding: 0;
  margin: 0;
}

/* Filter Modal */
.filter-modal-content {
  --background: var(--ion-background-color);
}

.modal-reset-btn {
  font-weight: 700;
  font-size: 0.8rem;
  letter-spacing: 0.05em;
}

.filter-section {
  margin-bottom: 24px;
}

.filter-section-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--ion-text-color);
  margin-bottom: 12px;
}

.price-input-group {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
}

.price-input-container {
  flex: 1;
  display: flex;
  align-items: center;
  background: var(--ion-color-step-100, #f8f9fa);
  border-radius: 12px;
  padding: 0 12px;
  height: 50px;
  border: 1px solid var(--ion-color-step-200, transparent);
  transition: all 0.2s ease;
}

.price-input-container:focus-within {
  border-color: var(--ion-color-carrot);
}

.price-symbol {
  color: var(--ion-color-medium);
  font-weight: 600;
  margin-right: 4px;
}

.premium-price-input {
  --padding-start: 4px;
  --placeholder-color: var(--ion-color-step-400, #999);
  --placeholder-opacity: 0.6;
  font-weight: 600;
  --color: var(--ion-text-color);
  color: var(--ion-text-color);
}

.price-dash {
  width: 12px;
  height: 2px;
  background: var(--ion-color-step-300, #ccc);
  flex-shrink: 0;
}

.stock-toggle-card {
  --background: var(--ion-color-step-50, #f8f9fa);
  --padding-start: 16px;
  --padding-end: 16px;
  --inner-padding-end: 0;
  border-radius: 16px;
  margin: 0;
  min-height: 80px;
  border: 1px solid var(--ion-color-step-150, transparent);
}

.ion-palette-dark .stock-toggle-card,
.ion-palette-dark .price-input-container {
  background: var(--ion-color-step-150, #1e1e1e) !important;
  --background: var(--ion-color-step-150, #1e1e1e) !important;
  border-color: var(--ion-color-step-200);
}

.stock-toggle-card h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}

.stock-toggle-card p {
  font-size: 0.82rem;
  color: var(--ion-color-medium);
  margin: 4px 0 0;
}

.modal-action-row {
  margin-top: 32px;
}

.premium-apply-btn {
  --border-radius: 14px;
  --box-shadow: 0 4px 12px rgba(255, 126, 0, 0.25);
  font-weight: 700;
  height: 52px;
  font-size: 1rem;
}

.width-190 {
  --width: 190px;
}

.active-sort {
  --color: var(--ion-color-carrot);
  font-weight: 600;
}

/* Reuse Store Grid styles */
.store-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 0 12px 24px;
}

@media (min-width: 768px) {
  .store-grid {
    gap: 24px;
    padding: 0 40px 40px;
  }
}

.store-product-card {
  background: var(--ion-background-color);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  height: 100%;
  transition: transform 0.2s ease;
}

.store-product-card:active {
  transform: scale(0.98);
}

.product-image-wrapper {
  width: 100%;
  aspect-ratio: 1 / 1;
  background: var(--ion-color-step-50, #f8f9fa);
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
}

.product-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.product-info {
  padding: 12px;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  gap: 4px;
  justify-content: space-between;
}

.product-name {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--ion-text-color);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.3;
  margin-bottom: 4px;
}

.product-rating-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 2px 0;
}

.star-icons {
  color: #f5a623;
  font-size: 0.72rem;
  letter-spacing: 0.5px;
  line-height: 1;
}

.rating-count {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--ion-text-color);
}

.review-count {
  font-size: 0.65rem;
  color: var(--ion-color-medium);
}

.product-price-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}

.product-price {
  font-weight: 700;
  color: var(--ion-color-carrot);
  font-size: 1rem;
}

.product-sold {
  font-size: 0.7rem;
  color: var(--ion-color-medium);
}

.empty-products {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px;
  color: var(--ion-color-medium);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.3;
}

/* Dark mode overrides */
.ion-palette-dark .store-product-card {
  background: var(--ion-color-step-100, #1e1e1e);
}

.ion-palette-dark .store-banner {
  opacity: 0.25;
}

.ion-palette-dark .store-profile-card {
  border-bottom: 1px solid var(--ion-color-step-100, rgba(255,255,255,0.05));
}

/* Image Zoom Modal */
.image-zoom-modal {
  --background: #000;
}

.image-modal-close-btn {
  position: fixed;
  top: calc(var(--ion-safe-area-top) + 20px);
  right: 20px;
  z-index: 1000;
  --border-radius: 50%;
  --padding-start: 0;
  --padding-end: 0;
  width: 40px;
  height: 40px;
  --box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.fullscreen-swiper {
  width: 100%;
  height: 100%;
  background: #000;
}

.swiper-zoom-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.swiper-zoom-container img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

:deep(.swiper-pagination-bullet) {
  background: #fff;
  opacity: 0.5;
}

:deep(.swiper-pagination-bullet-active) {
  background: var(--ion-color-carrot);
  opacity: 1;
}
</style>
