<template>
  <ion-page>
    <ion-header>
      <app-header :title="$t('store.title')" :icon="bagHandleOutline" :showProfile="true" />

      <!-- Actions toolbar: search input + chats + cart -->
      <ion-toolbar class="actions-toolbar" :disabled="isUnderConstruction">
        <ion-searchbar
          v-if="!isUnderConstruction"
          v-model="searchQuery"
          :placeholder="$t('store.searchPlaceholder')"
          :debounce="400"
          show-clear-button="focus"
          class="modern-searchbar"
        />
        <div v-else class="search-skeleton-placeholder" style="padding: 0 8px;">
          <ion-skeleton-text animated style="width: 100%; height: 38px; border-radius: 12px; margin: 0;" />
        </div>

        <ion-buttons slot="end">
          <ion-button @click="openChats" class="header-action-button" :disabled="isUnderConstruction">
            <ion-icon :icon="chatbubblesOutline" />
            <ion-badge v-if="unreadChatCount > 0" color="danger" class="cart-badge">{{ unreadChatCount }}</ion-badge>
          </ion-button>
          <ion-button @click="openCart" class="header-action-button cart-button" :disabled="isUnderConstruction">
            <ion-icon :icon="cartOutline" />
            <ion-badge v-if="cartCount > 0" color="danger" class="cart-badge">{{ cartCount }}</ion-badge>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div v-if="isUnderConstruction" slot="fixed" class="under-construction-overlay">
        <div class="construction-card">
          <ion-icon :icon="constructOutline" class="construction-icon" />
          <h2>{{ $t('common.underConstruction') || 'Under Construction' }}</h2>
          <p>We're brewing something amazing! The Halal Formosa store will be available soon.</p>
        </div>
      </div>

      <div class="store-view-wrapper" style="position: relative; min-height: 100%;">
        <div class="store-container">
          <ion-refresher slot="fixed" @ionRefresh="doRefresh($event)">
            <ion-refresher-content />
          </ion-refresher>

          <!-- Promo Banners -->
          <div v-if="promoBanners.length > 0" class="promo-section">
            <div ref="promoScroll" class="promo-scroll">
              <div v-for="banner in promoBanners" :key="banner.id" class="promo-card" @click="handleBannerClick(banner)">
                <img :src="banner.image_url" :alt="banner.title" class="promo-image" />
                <div class="promo-overlay">
                  <h3>{{ localized(banner.title_zh, banner.title) }}</h3>
                  <p v-if="banner.subtitle">{{ banner.subtitle }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Category chips -->
          <div class="category-scroll">
            <button
              v-for="cat in allCategories"
              :key="cat.id ?? 'all'"
              :class="['cat-chip', { 'cat-chip-active': selectedCategory === cat.id }]"
              @click="selectedCategory = selectedCategory === cat.id ? null : cat.id"
            >
              <span v-if="cat.emoji" class="chip-emoji">{{ cat.emoji }}</span>
              {{ localized(cat.name_zh, cat.name) }}
            </button>
          </div>

          <!-- Sort & Filter Row -->
          <div class="filter-row" v-if="products.length > 0 || !loading">
            <!-- Sort Left -->
            <ion-button id="store-sort-trigger" fill="clear" size="small" class="modern-sort-button">
              {{ currentSortLabel }}
              <ion-icon :icon="chevronDownOutline" slot="end" size="small" />
            </ion-button>

            <ion-popover trigger="store-sort-trigger" size="auto" dismiss-on-select class="width-190">
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

            <!-- Filter Right -->
            <ion-button fill="clear" size="small" class="modern-filter-button" @click="openFilter">
              <ion-icon :icon="filterOutline" slot="start" />
              {{ $t('common.filter') || 'Filter' }}
              <ion-badge v-if="minPrice || maxPrice || stockOnly" color="carrot" class="filter-count-badge">·</ion-badge>
            </ion-button>
          </div>

          <!-- Product Grid -->
          <div class="store-grid" v-if="!loading && products.length > 0">
            <div
              v-for="product in products"
              :key="product.id"
              class="store-product-card"
              @click="navigateToProduct(product.id)"
            >
              <div class="product-image-wrapper">
                <img
                  v-if="product.images && product.images.length > 0"
                  :src="product.images[0]"
                  :alt="product.name"
                  class="product-image"
                  loading="lazy"
                />
                <div v-else class="product-image-placeholder">
                  <ion-icon :icon="imageOutline" />
                </div>
                <ion-chip v-if="product.is_featured" color="carrot" class="featured-chip">⭐</ion-chip>
                <ion-chip v-if="product.stock_quantity <= 0" color="danger" class="stock-chip">
                  {{ $t('store.outOfStock') }}
                </ion-chip>
              </div>

              <div class="product-info">
                <p class="product-category">{{ getCategoryName(product.category_id) }}</p>
                <h4 class="product-name">{{ localized(product.name_zh, product.name) }}</h4>
                <div v-if="product.merchant_stores" class="product-store-info" @click.stop="navigateToMerchant(product.store_id)">
                  <ion-icon :icon="storefrontOutline" class="store-icon" size="small" />
                  <span class="store-name-text">{{ product.merchant_stores.name }}</span>
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

          <!-- Skeleton loader -->
          <div class="store-grid" v-if="loading">
            <div v-for="n in 6" :key="n" class="store-product-card skeleton-card">
              <ion-skeleton-text animated class="product-image-skeleton" />
              <div class="product-info">
                <ion-skeleton-text animated style="width: 40%; height: 12px;" />
                <ion-skeleton-text animated style="width: 80%; height: 16px; margin-top: 6px;" />
                <ion-skeleton-text animated style="width: 50%; height: 14px; margin-top: 6px;" />
              </div>
            </div>
          </div>

          <!-- Empty state -->
          <div v-if="!loading && products.length === 0" class="empty-state">
            <ion-icon :icon="bagHandleOutline" class="empty-icon" />
            <p>{{ $t('store.noProducts') }}</p>
          </div>

          <!-- Infinite scroll -->
          <ion-infinite-scroll @ionInfinite="loadMore($event)" :disabled="noMore">
            <ion-infinite-scroll-content :loading-text="$t('store.loadingMore')" />
          </ion-infinite-scroll>

          <!-- Admin FAB -->
          <ion-fab v-if="isAdmin" vertical="bottom" horizontal="end" slot="fixed">
            <ion-fab-button color="carrot" @click="navigateToAdminAdd">
              <ion-icon :icon="addOutline" />
            </ion-fab-button>
          </ion-fab>
        </div>
      </div>
    </ion-content>

    <!-- Footer result count -->
    <ion-footer v-if="totalCount > 0" class="result-footer">
      <ion-toolbar>
        <ion-title size="small" class="result-count">
          {{ $t('store.showingResults', { count: products.length, total: totalCount }) }}
        </ion-title>
      </ion-toolbar>
    </ion-footer>

    <!-- Cart Modal -->
    <ion-modal :is-open="cartOpen" @didDismiss="cartOpen = false" :initial-breakpoint="0.5" :breakpoints="[0, 0.5, 0.85]">
      <ion-header>
        <ion-toolbar>
          <ion-title>{{ $t('store.cart') }} ({{ cartCount }})</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="cartOpen = false">
              <ion-icon :icon="closeOutline" />
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="cart-content">
        <div v-if="cartItems.length === 0" class="empty-state">
          <ion-icon :icon="cartOutline" class="empty-icon" />
          <p>{{ $t('store.cartEmpty') }}</p>
        </div>
        <ion-list v-else>
          <ion-item v-for="item in cartItems" :key="item.productId" class="cart-item">
            <ion-thumbnail slot="start">
              <img :src="item.image || '/favicon-32x32.png'" :alt="item.name" />
            </ion-thumbnail>
            <ion-label>
              <h3>{{ item.name }}</h3>
              <p>{{ $t('store.twd') }}{{ formatPrice(item.price) }} × {{ item.quantity }}</p>
            </ion-label>
            <ion-buttons slot="end">
              <ion-button @click="updateQty(item.productId, item.quantity - 1)" fill="clear" size="small">
                <ion-icon :icon="removeCircleOutline" />
              </ion-button>
              <span class="qty-label">{{ item.quantity }}</span>
              <ion-button @click="updateQty(item.productId, item.quantity + 1)" fill="clear" size="small">
                <ion-icon :icon="addCircleOutline" />
              </ion-button>
            </ion-buttons>
          </ion-item>
        </ion-list>

        <div v-if="cartItems.length > 0" class="cart-footer-section">
          <div class="cart-total-row">
            <span>{{ $t('store.cartTotal') }}</span>
            <span class="cart-total-price">{{ $t('store.twd') }}{{ formatPrice(cartTotal) }}</span>
          </div>
          <ion-button expand="block" color="carrot" class="checkout-button" @click="goCheckout">
            {{ $t('store.checkout') }}
          </ion-button>
        </div>
      </ion-content>
    </ion-modal>

    <!-- Advanced Filter Modal -->
    <ion-modal :is-open="filterOpen" @didDismiss="filterOpen = false" :initial-breakpoint="0.4" :breakpoints="[0, 0.4, 0.6]">
      <ion-header>
        <ion-toolbar>
          <ion-title>{{ $t('common.filter') || 'Filter' }}</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="resetFilters" color="medium">{{ $t('common.reset') || 'Reset' }}</ion-button>
            <ion-button @click="filterOpen = false">
              <ion-icon :icon="closeOutline" />
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <ion-list lines="none">
          <ion-item>
            <ion-label position="stacked">{{ $t('store.priceRange') || 'Price Range (TWD)' }}</ion-label>
            <div class="price-input-row">
              <ion-input type="number" v-model="tempMinPrice" placeholder="Min" class="price-input" />
              <span class="price-separator">-</span>
              <ion-input type="number" v-model="tempMaxPrice" placeholder="Max" class="price-input" />
            </div>
          </ion-item>

          <ion-item class="stock-toggle-item">
            <ion-label>{{ $t('store.inStockOnly') || 'In Stock Only' }}</ion-label>
            <ion-toggle v-model="tempStockOnly" color="carrot" />
          </ion-item>
        </ion-list>

        <ion-button expand="block" color="carrot" class="apply-filter-button" @click="applyFilters">
          {{ $t('common.apply') || 'Apply' }}
        </ion-button>
      </ion-content>
    </ion-modal>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  IonPage, IonHeader, IonContent, IonToolbar, IonButtons, IonButton, IonIcon,
  IonSearchbar, IonChip, IonSkeletonText, IonInfiniteScroll, IonInfiniteScrollContent,
  IonFab, IonFabButton, IonRefresher, IonRefresherContent, IonFooter, IonTitle,
  IonPopover, IonList, IonItem, IonLabel, IonModal, IonThumbnail, IonBadge,
  IonInput, IonToggle
} from '@ionic/vue'
import {
  bagHandleOutline, chatbubblesOutline, cartOutline, constructOutline,
  chevronDownOutline, checkmarkOutline, filterOutline, imageOutline,
  closeOutline, storefrontOutline, addOutline, removeCircleOutline, addCircleOutline
} from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import { supabase } from '@/plugins/supabaseClient'
import { isAdmin } from '@/composables/userProfile'
import { useStoreCart } from '@/composables/useStoreCart'
import { ActivityLogService } from '@/services/ActivityLogService'

const { t, locale } = useI18n()
const router = useRouter()
const { items: cartItems, cartCount, cartTotal, updateQty } = useStoreCart()

// State
const isUnderConstruction = computed(() => import.meta.env.VITE_STORE_UNDER_CONSTRUCTION === 'true')
const promoScroll = ref<HTMLElement | null>(null)
let autoScrollInterval: any = null
const loading = ref(true)
const products = ref<any[]>([])
const categories = ref<any[]>([])
const promoBanners = ref<any[]>([])
const searchQuery = ref('')
const selectedCategory = ref<number | null>(null)
const sortBy = ref('popular')
const cartOpen = ref(false)
const totalCount = ref(0)
const unreadChatCount = ref(0) // Used for chat badge
const noMore = ref(false)
const PAGE_SIZE = 20

// Advanced Filters
const minPrice = ref<number | null>(null)
const maxPrice = ref<number | null>(null)
const stockOnly = ref(false)
const filterOpen = ref(false)
const tempMinPrice = ref<number | null>(null)
const tempMaxPrice = ref<number | null>(null)
const tempStockOnly = ref(false)

const sortOptions = computed(() => [
  { value: 'popular', label: t('store.sortRelevance') },
  { value: 'recent', label: t('store.sortRecent') },
  { value: 'top_sale', label: t('store.sortTopSale') },
  { value: 'price_desc', label: t('store.sortPriceDesc') },
  { value: 'price_asc', label: t('store.sortPriceAsc') }
])

const currentSortLabel = computed(() => {
  const opt = sortOptions.value.find(s => s.value === sortBy.value)
  return opt?.label || t('store.sortRelevance')
})

const allCategories = computed(() => {
  return [{ id: null, name: t('store.allCategories'), name_zh: null, emoji: '🏷️' }, ...categories.value]
})

function getCategoryName(catId: number | null) {
  const cat = categories.value.find((c: any) => c.id === catId)
  return cat ? localized(cat.name_zh, cat.name) : ''
}

function localized(zh: string | null | undefined, en: string | null | undefined): string {
  if (locale.value === 'zh') return zh || en || ''
  return en || zh || ''
}

function formatPrice(price: number) {
  return Number(price).toLocaleString()
}

function openCart() {
  cartOpen.value = true
  ActivityLogService.log('store_cart_open')
}

function openChats() {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  if (isAdmin.value) {
    router.push('/admin/store/chat-inbox')
  } else {
    router.push('/store/chat-inbox')
  }
}

function goCheckout() {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  cartOpen.value = false
  ActivityLogService.log('store_checkout_click')
  router.push('/store/checkout')
}

function handleBannerClick(banner: any) {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  ActivityLogService.log('store_banner_click', { banner_id: banner.id, title: banner.title })
  if (banner.link_type === 'product' && banner.link_value) {
    router.push(`/store/product/${banner.link_value}`)
  } else if (banner.link_type === 'category' && banner.link_value) {
    selectedCategory.value = Number(banner.link_value)
  }
}

function navigateToProduct(id: string) {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  ActivityLogService.log('store_product_click', { product_id: id })
  router.push(`/store/product/${id}`)
}

function navigateToMerchant(id: string) {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  router.push(`/store/merchant/${id}`)
}

function navigateToAdminAdd() {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  router.push('/admin/store/add-product')
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
  const { data } = await supabase
    .from('store_product_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  // Deduplicate by name (in case seed ran multiple times)
  const seen = new Set<string>()
  categories.value = (data || []).filter((c: any) => {
    if (seen.has(c.name)) return false
    seen.add(c.name)
    return true
  })
}

async function fetchBanners() {
  const now = new Date().toISOString()
  const { data } = await supabase
    .from('store_promo_banners')
    .select('*')
    .eq('is_active', true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order('sort_order')
  promoBanners.value = data || []
}

function buildQuery(from: number, to: number) {
  let query = supabase
    .from('store_products')
    .select('*, merchant_stores(name)', { count: 'exact' })
    .eq('is_active', true)

  if (selectedCategory.value) {
    query = query.eq('category_id', selectedCategory.value)
  }

  if (searchQuery.value.trim()) {
    const q = `%${searchQuery.value.trim()}%`
    query = query.or(`name.ilike.${q},name_zh.ilike.${q},tags.cs.{${searchQuery.value.trim()}}`)
  }

  if (minPrice.value !== null) {
    query = query.gte('price', minPrice.value)
  }
  if (maxPrice.value !== null) {
    query = query.lte('price', maxPrice.value)
  }
  if (stockOnly.value) {
    query = query.gt('stock_quantity', 0)
  }

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
      query = query.order('sale_count', { ascending: false }).order('view_count', { ascending: false })
      break
    case 'trending':
      // Fallback to view_count desc for now; proper trending via RPC later
      query = query.order('view_count', { ascending: false })
      break
    case 'popular':
    default:
      query = query.order('sale_count', { ascending: false })
      break
  }

  query = query.range(from, to)
  return query
}

async function fetchProducts(reset = true) {
  loading.value = true
  if (reset) {
    products.value = []
    noMore.value = false
  }

  const from = reset ? 0 : products.value.length
  const to = from + PAGE_SIZE - 1

  const { data, count, error } = await buildQuery(from, to)

  if (!error && data) {
    if (reset) {
      products.value = data
    } else {
      products.value.push(...data)
    }
    totalCount.value = count || 0
    if (products.value.length >= totalCount.value) {
      noMore.value = true
    }
  }
  loading.value = false
}

async function loadMore(event: any) {
  await fetchProducts(false)
  event.target.complete()
}

async function doRefresh(event: any) {
  stopAutoScroll()
  await Promise.all([fetchProducts(), fetchCategories(), fetchBanners()])
  startAutoScroll()
  event.target.complete()
}

function startAutoScroll() {
  if (autoScrollInterval) stopAutoScroll()
  if (promoBanners.value.length <= 1) return

  autoScrollInterval = setInterval(() => {
    if (!promoScroll.value) return
    const el = promoScroll.value
    const maxScroll = el.scrollWidth - el.clientWidth
    
    // If we're at or very near the end, loop back to start
    if (el.scrollLeft >= maxScroll - 5) {
      el.scrollTo({ left: 0, behavior: 'smooth' })
    } else {
      // Find the card width + gap. Each card is min 280px + 12px gap. 
      // Using clientWidth of first child for accuracy.
      const firstChild = el.children[0] as HTMLElement
      const step = firstChild ? (firstChild.offsetWidth + 12) : 300
      el.scrollTo({ left: el.scrollLeft + step, behavior: 'smooth' })
    }
  }, 5000)
}

function stopAutoScroll() {
  if (autoScrollInterval) {
    clearInterval(autoScrollInterval)
    autoScrollInterval = null
  }
}

// Watch filters
watch(searchQuery, (newVal) => {
  if (newVal.trim()) {
    ActivityLogService.log('store_search', { query: newVal })
  }
  fetchProducts()
})

watch(selectedCategory, (newVal) => {
  if (newVal) {
    ActivityLogService.log('store_filter_category', { category_id: newVal })
  }
  fetchProducts()
})

watch([sortBy, minPrice, maxPrice, stockOnly], () => {
  fetchProducts()
})

onMounted(async () => {
  ActivityLogService.log('store_page_open')
  await Promise.all([fetchCategories(), fetchBanners(), fetchProducts()])
  startAutoScroll()
})

onBeforeUnmount(() => {
  stopAutoScroll()
})
</script>

<style scoped>
/* Actions toolbar */
.actions-toolbar {
  --background: var(--ion-background-color);
  --border-width: 0;
  --padding-start: 4px;
  --padding-end: 4px;
}


.cat-chip-skeleton {
  padding: 8px 0;
}

.cat-chip-skeleton {
  padding: 8px 0;
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

.header-action-button {
  --color: var(--ion-text-color);
}

.cart-button {
  position: relative;
}

.cart-badge {
  position: absolute;
  top: 2px;
  right: 0;
  font-size: 10px;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  padding: 0 4px;
  font-weight: 700;
}

/* Search */
.modern-searchbar {
  --border-radius: 12px;
  --background: var(--ion-color-step-50, #f4f5f8);
  --box-shadow: none;
  --padding-start: 0;
  --padding-end: 0;
  --color: var(--ion-text-color);
  --placeholder-color: var(--ion-color-step-400, #999);
  --icon-color: var(--ion-color-step-600, #666);
  --clear-button-color: var(--ion-color-step-600, #666);
  font-size: 0.9rem;
  border-radius: 12px;
  transition: all 0.2s ease;
}

.ion-palette-dark .modern-searchbar {
  --background: var(--ion-color-step-100, #1e1e1e) !important;
  border-color: var(--ion-color-step-200, #333) !important;
  --placeholder-color: var(--ion-color-step-500, #888);
  --icon-color: var(--ion-color-step-400, #bbb);
}

/* Promo Banners */
.promo-section {
  padding: 12px 0 4px;
}

.promo-scroll {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 0 16px;
  scroll-snap-type: x mandatory;
  scroll-padding: 0 16px;
  -webkit-overflow-scrolling: touch;
}

.promo-scroll::-webkit-scrollbar {
  display: none;
}

.promo-card {
  position: relative;
  min-width: 280px;
  max-width: 320px;
  border-radius: 16px;
  overflow: hidden;
  scroll-snap-align: start;
  flex-shrink: 0;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.promo-image {
  width: 100%;
  height: 140px;
  object-fit: cover;
  display: block;
}

.promo-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 12px 16px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  color: #fff;
}

.promo-overlay h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}

.promo-overlay p {
  margin: 4px 0 0;
  font-size: 0.8rem;
  opacity: 0.9;
}

/* Category chips */
.category-scroll {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 10px 16px;
  -webkit-overflow-scrolling: touch;
}

.category-scroll::-webkit-scrollbar {
  display: none;
}

.cat-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  border-radius: 20px;
  border: 1.5px solid var(--ion-color-step-200, #e0e0e0);
  background: transparent;
  color: var(--ion-text-color);
  font-size: 0.82rem;
  font-weight: 500;
  font-family: inherit;
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.cat-chip-active {
  background: var(--ion-color-carrot) !important;
  color: #fff !important;
  border-color: var(--ion-color-carrot) !important;
  font-weight: 600;
}

.chip-emoji {
  margin-right: 4px;
}

/* Filter Row */
.filter-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 16px 8px;
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

.price-input-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  width: 100%;
}

.price-input {
  --background: var(--ion-color-step-50, #f4f5f8);
  --padding-start: 12px;
  --border-radius: 8px;
  border: 1px solid var(--ion-color-step-100, #e0e0e0);
  border-radius: 8px;
  text-align: center;
}

.price-separator {
  color: var(--ion-color-medium);
  font-weight: bold;
}

.stock-toggle-item {
  margin-top: 16px;
  --padding-start: 0;
}

.apply-filter-button {
  margin-top: 24px;
  --border-radius: 12px;
  font-weight: 600;
}

/* Product Grid */
.store-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
  padding: 8px 16px 24px;
}

@media (min-width: 768px) {
  .store-grid {
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 24px;
    padding: 16px 24px 40px;
  }
}

.store-product-card {
  background: #ffffff;
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid var(--ion-color-step-50, transparent);
}

.store-product-card:active {
  transform: scale(0.97);
}

.product-image-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  background: var(--ion-color-step-50, #f4f5f8);
}

.product-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.product-image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  color: var(--ion-color-medium);
}

.featured-chip {
  position: absolute;
  top: 8px;
  left: 8px;
  font-size: 0.7rem;
  --padding-start: 6px;
  --padding-end: 6px;
  height: 24px;
}

.stock-chip {
  position: absolute;
  bottom: 8px;
  right: 8px;
  font-size: 0.65rem;
  --padding-start: 6px;
  --padding-end: 6px;
  height: 22px;
}

.product-info {
  padding: 10px 12px 14px;
}

.product-category {
  font-size: 0.65rem;
  color: var(--ion-color-medium);
  margin-bottom: 2px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}

.product-store-info {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}

.store-icon {
  font-size: 0.72rem;
  color: var(--ion-color-carrot);
}

.store-name-text {
  font-size: 0.72rem;
  color: var(--ion-color-step-600, #666);
  font-weight: 500;
}

.product-name {
  margin: 4px 0;
  font-size: 0.88rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--ion-text-color);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.product-price-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.product-price {
  font-size: 1rem;
  font-weight: 700;
  color: var(--ion-color-carrot);
}

.product-sold {
  font-size: 0.7rem;
  color: var(--ion-color-medium);
}

/* Skeleton */
.skeleton-card {
  pointer-events: none;
}

.product-image-skeleton {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 0;
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--ion-color-medium);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

/* Footer */
.result-footer ion-toolbar {
  --background: var(--ion-background-color);
  --border-width: 0;
  --min-height: 24px;
}

.result-count {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
  text-align: center;
}

/* Active sort */
.active-sort {
  --color: var(--ion-color-carrot);
  font-weight: 600;
}

/* Cart Modal */
.cart-content {
  --background: var(--ion-background-color);
}

.cart-item {
  --padding-start: 8px;
}

.cart-item ion-thumbnail {
  --size: 56px;
  --border-radius: 12px;
}

.qty-label {
  font-weight: 600;
  min-width: 24px;
  text-align: center;
  font-size: 0.95rem;
}

.cart-footer-section {
  padding: 16px;
}

.cart-total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0 16px;
  font-size: 1rem;
  font-weight: 600;
}

.cart-total-price {
  color: var(--ion-color-carrot);
  font-size: 1.2rem;
  font-weight: 700;
}

.checkout-button {
  --border-radius: 14px;
  font-weight: 600;
  font-size: 1rem;
  height: 50px;
}

/* Dark mode */
.ion-palette-dark .store-product-card {
  background: var(--ion-color-step-100, #1e1e1e);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  border-color: rgba(255, 255, 255, 0.05);
}

.ion-palette-dark .promo-card {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.ion-palette-dark .product-image-wrapper {
  background: var(--ion-color-step-150, #2a2a2a);
}

/* Responsive Container */
.store-container {
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

/* Responsive Searchbar */
@media (min-width: 768px) {
  .actions-toolbar {
    --padding-start: 24px;
    --padding-end: 24px;
  }
  
  .modern-searchbar {
    max-width: 600px;
    margin: 0 auto;
  }
  
  .promo-section {
    padding: 24px 0 12px;
  }
  
  .promo-card {
    min-width: 350px;
    max-width: 450px;
  }
  
  .promo-image {
    height: 200px;
  }
  
  .category-scroll {
    padding: 16px 24px;
    justify-content: center;
  }
  
  .filter-row {
    padding: 8px 24px 16px;
  }
}
</style>
