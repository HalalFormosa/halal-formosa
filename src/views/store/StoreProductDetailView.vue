<template>
  <ion-page>
    <ion-header class="ion-no-border immersive-header" :class="{ 'is-scrolled': isScrolled }">
      <app-header 
          :title="product?.name || $t('store.title')" 
          :showBack="true" 
          icon="none"
          :transparent="!isScrolled"
          :contrast="!isScrolled"
      >
        <template #actions>
          <ion-button @click="handleChat" :disabled="isUnderConstruction" fill="clear">
            <ion-icon :icon="chatbubbleOutline" slot="start" />
            <ion-badge v-if="totalUnreadCount > 0" color="danger" class="header-badge">{{ totalUnreadCount }}</ion-badge>
          </ion-button>
          <ion-button @click="openCart" :disabled="isUnderConstruction" fill="clear">
            <ion-icon :icon="cartOutline" slot="start" />
            <ion-badge v-if="cartCount > 0" color="danger" class="header-badge">{{ cartCount }}</ion-badge>
          </ion-button>
        </template>
      </app-header>
    </ion-header>

    <ion-content :fullscreen="true" :scroll-events="true" @ionScroll="handleScroll">
      <div v-if="isUnderConstruction" slot="fixed" class="under-construction-overlay">
        <div class="construction-card">
          <ion-icon :icon="constructOutline" class="construction-icon" />
          <h2>{{ $t('common.underConstruction') || 'Under Construction' }}</h2>
          <p>This product is currently being prepared. Check back soon!</p>
        </div>
      </div>

      <div class="product-detail-wrapper" style="position: relative; min-height: 100%; background: var(--ion-background-color);">
        <div class="product-container">

        <!-- Skeleton while loading -->
        <div v-if="loading" class="detail-skeleton">
          <ion-skeleton-text animated class="image-skeleton" />
          <div style="padding: 16px;">
            <ion-skeleton-text animated style="width: 40%; height: 14px;" />
            <ion-skeleton-text animated style="width: 80%; height: 22px; margin-top: 8px;" />
            <ion-skeleton-text animated style="width: 30%; height: 28px; margin-top: 12px;" />
            <ion-skeleton-text animated style="width: 100%; height: 60px; margin-top: 16px;" />
          </div>
        </div>

        <!-- Product Content -->
        <div v-if="!loading && product" class="detail-page-container">
          <!-- Image gallery -->
          <div class="gallery-scroll">
            <div v-for="(img, i) in product.images" :key="i" class="gallery-item">
              <img :src="img" :alt="`${product.name} ${Number(i) + 1}`" class="gallery-image" />
            </div>
            <div v-if="!product.images?.length" class="gallery-item gallery-placeholder">
              <ion-icon :icon="imageOutline" />
            </div>
          </div>

          <div class="detail-body">
            <!-- Category badge -->
            <ion-chip v-if="categoryName" size="small" class="category-badge">
              {{ categoryName }}
            </ion-chip>

            <h1 class="detail-name">{{ localized(product.name_zh, product.name) }}</h1>
            <p v-if="product.name_zh && product.name" class="detail-name-sub">{{ product.name }}</p>

            <div class="price-section">
              <span class="detail-price">{{ $t('store.twd') }}{{ formatPrice(product.price) }}</span>
              <div class="meta-badges">
                <span v-if="product.sale_count > 0" class="meta-badge">
                  {{ $t('store.sold', { count: product.sale_count }) }}
                </span>
                <span class="meta-badge">
                  {{ $t('store.views', { count: product.view_count || 0 }) }}
                </span>
              </div>
            </div>

            <!-- Stock -->
            <div class="stock-row" :class="{ 'out-of-stock': product.stock_quantity <= 0 }">
              <ion-icon :icon="product.stock_quantity > 0 ? checkmarkCircleOutline : closeCircleOutline" />
              <span>{{ product.stock_quantity > 0
                ? $t('store.inStock', { count: product.stock_quantity })
                : $t('store.outOfStock')
              }}</span>
            </div>

            <!-- Description -->
            <div v-if="product.description || product.description_zh" class="description-section">
              <h3>{{ $t('store.description') }}</h3>
              <p>{{ localized(product.description_zh, product.description) }}</p>
            </div>

            <!-- Store Info -->
            <div v-if="product.merchant_stores" class="store-info-section">
              <div class="store-header">
                <ion-avatar class="store-avatar">
                  <img :src="product.merchant_stores.logo_url || '/favicon-32x32.png'" />
                </ion-avatar>
                <div class="store-text">
                  <h3 class="store-name">{{ product.merchant_stores.name }}</h3>
                  <p class="store-tagline">{{ $t('store.verifiedSeller') || 'Verified Store' }}</p>
                </div>
                <ion-button fill="outline" size="small" class="visit-store-btn" @click="navigateToMerchant(product.store_id)">
                  {{ $t('store.visitShop') || 'Visit Shop' }}
                </ion-button>
              </div>
            </div>

            <!-- Quantity -->
            <div v-if="product.stock_quantity > 0" class="quantity-section">
              <h3>{{ $t('store.quantity') }}</h3>
              <div class="quantity-controls">
                <ion-button fill="outline" size="small" @click="qty = Math.max(1, qty - 1)" :disabled="qty <= 1">
                  <ion-icon :icon="removeOutline" />
                </ion-button>
                <span class="qty-display">{{ qty }}</span>
                <ion-button fill="outline" size="small" @click="qty++" :disabled="qty >= product.stock_quantity">
                  <ion-icon :icon="addOutline" />
                </ion-button>
              </div>
            </div>

            <!-- Reviews Section -->
            <div class="reviews-section">
              <div class="reviews-header">
                <h3>{{ $t('store.reviews') }}</h3>
                <ion-button v-if="currentUserId" fill="clear" size="small" color="carrot" @click="openReviewModal">
                  {{ $t('store.writeReview') }}
                </ion-button>
                <ion-button v-else fill="clear" size="small" color="medium" disabled>
                  {{ $t('store.loginToReview') }}
                </ion-button>
              </div>

              <!-- Rating Summary -->
              <div v-if="product.avg_rating > 0" class="rating-summary">
                <div class="rating-big">
                  <span class="big-number">{{ product.avg_rating }}</span>
                  <div class="big-stars" v-html="renderStars(product.avg_rating)"></div>
                  <span class="total-reviews">{{ $t('store.ratingCount', { count: product.review_count }) }}</span>
                </div>
              </div>

              <!-- Review List -->
              <div v-if="reviews.length > 0" class="review-list">
                <div v-for="review in reviews" :key="review.id" class="review-card">
                  <div class="review-header">
                    <ion-avatar class="reviewer-avatar">
                      <img :src="review.user_profiles?.avatar_url || '/favicon-32x32.png'" />
                    </ion-avatar>
                    <div class="reviewer-info">
                      <span class="reviewer-name">{{ review.user_profiles?.display_name || 'User' }}</span>
                      <span class="review-date">{{ formatDate(review.created_at) }}</span>
                    </div>
                  </div>
                  <div class="review-stars" v-html="renderStars(review.rating)"></div>
                  <p v-if="review.comment" class="review-comment">{{ review.comment }}</p>
                </div>
              </div>
              <div v-else class="no-reviews">
                <p>{{ $t('store.noReviews') }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Not found -->
        <div v-if="!loading && !product" class="empty-state">
          <ion-icon :icon="bagHandleOutline" class="empty-icon" />
          <p>{{ $t('store.noProducts') }}</p>
        </div>
      </div>
    </div>
  </ion-content>

    <!-- Action bar -->
    <ion-footer v-if="product && !isUnderConstruction">
      <ion-toolbar class="action-toolbar">
        <!-- Owner Actions -->
        <div v-if="isOwner" class="action-buttons">
          <ion-button fill="solid" color="primary" class="action-btn" @click="navigateToEdit">
            <ion-icon :icon="createOutline" slot="start" />
            {{ $t('common.edit') }}
          </ion-button>
        </div>
        
        <!-- Customer Actions -->
        <div v-else class="action-buttons">
          <ion-button fill="clear" color="medium" class="chat-btn" @click="handleChat">
            <ion-icon :icon="chatbubbleOutline" />
          </ion-button>
          <ion-button v-if="product.stock_quantity > 0" fill="outline" color="carrot" class="action-btn" @click="handleAddToCart">
            <ion-icon :icon="cartOutline" slot="start" />
            {{ $t('store.addToCart') }}
          </ion-button>
          <ion-button v-if="product.stock_quantity > 0" fill="solid" color="carrot" class="action-btn" @click="handleBuyNow">
            {{ $t('store.buyNow') }}
          </ion-button>
        </div>
      </ion-toolbar>
    </ion-footer>
    <ion-footer v-else-if="isUnderConstruction">
      <ion-toolbar class="action-toolbar">
        <div class="action-buttons">
          <ion-button disabled fill="clear" color="medium" class="chat-btn">
            <ion-icon :icon="chatbubbleOutline" />
          </ion-button>
          <ion-button disabled fill="outline" color="carrot" class="action-btn">
            <ion-icon :icon="cartOutline" slot="start" />
            {{ $t('store.addToCart') }}
          </ion-button>
          <ion-button disabled fill="solid" color="carrot" class="action-btn">
            {{ $t('store.buyNow') }}
          </ion-button>
        </div>
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
              <ion-button @click="updateQtyInCart(item.productId, item.quantity - 1)" fill="clear" size="small">
                <ion-icon :icon="removeCircleOutline" />
              </ion-button>
              <span class="qty-label">{{ item.quantity }}</span>
              <ion-button @click="updateQtyInCart(item.productId, item.quantity + 1)" fill="clear" size="small">
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

    <!-- Write Review Modal -->
    <ion-modal :is-open="reviewModalOpen" @didDismiss="reviewModalOpen = false" :initial-breakpoint="0.55" :breakpoints="[0, 0.55, 0.8]">
      <ion-header class="ion-no-border">
        <ion-toolbar>
          <ion-title>{{ $t('store.writeReview') }}</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="reviewModalOpen = false">
              <ion-icon :icon="closeOutline" />
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding review-modal-content">
        <div class="star-selector">
          <h3>{{ $t('store.yourRating') }}</h3>
          <div class="star-buttons">
            <button
              v-for="star in 5"
              :key="star"
              class="star-btn"
              :class="{ 'star-active': star <= selectedRating }"
              @click="selectedRating = star"
            >
              ★
            </button>
          </div>
        </div>
        <div class="comment-section">
          <h3>{{ $t('store.yourComment') }}</h3>
          <ion-textarea
            v-model="reviewComment"
            :placeholder="$t('store.yourComment')"
            :rows="4"
            class="review-textarea"
          />
        </div>
        <ion-button
          expand="block"
          color="carrot"
          class="submit-review-btn"
          :disabled="selectedRating === 0 || submittingReview"
          @click="submitReview"
        >
          {{ submittingReview ? '...' : $t('store.submitReview') }}
        </ion-button>
      </ion-content>
    </ion-modal>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IonPage, IonHeader, IonContent, IonFooter, IonToolbar, IonButton, IonIcon,
  IonChip, IonSkeletonText, toastController, IonAvatar, IonModal, IonTitle,
  IonList, IonItem, IonLabel, IonButtons, IonThumbnail, IonTextarea, IonBadge
} from '@ionic/vue'
import {
  imageOutline, cartOutline, bagHandleOutline, removeOutline, addOutline,
  checkmarkCircleOutline, closeCircleOutline, chatbubbleOutline, constructOutline,
  storefrontOutline, createOutline, closeOutline, removeCircleOutline, addCircleOutline
} from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import { supabase } from '@/plugins/supabaseClient'
import { useStoreCart } from '@/composables/useStoreCart'
import { useStoreChat } from '@/composables/useStoreChat'
import { ActivityLogService } from '@/services/ActivityLogService'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const { addItem, items: cartItems, cartCount, cartTotal } = useStoreCart()
const { getOrCreateConversation, totalUnreadCount, initGlobalUnreadSubscription } = useStoreChat()

const isUnderConstruction = computed(() => import.meta.env.VITE_STORE_UNDER_CONSTRUCTION === 'true')
const product = ref<any>(null)
const categoryName = ref('')
const loading = ref(true)
const qty = ref(1)
const cartOpen = ref(false)
const currentUserId = ref<string | null>(null)
const isScrolled = ref(false)
const reviews = ref<any[]>([])
const reviewModalOpen = ref(false)
const selectedRating = ref(0)
const reviewComment = ref('')
const submittingReview = ref(false)
const existingReview = ref<any>(null)

const handleScroll = (ev: any) => {
  isScrolled.value = ev.detail.scrollTop > 50
}

const isOwner = computed(() => {
  if (!product.value || !currentUserId.value) return false
  return product.value.user_id === currentUserId.value
})

function formatPrice(price: number) {
  return Number(price).toLocaleString()
}

function localized(zh: string | null | undefined, en: string | null | undefined): string {
  if (locale.value === 'zh') return zh || en || ''
  return en || zh || ''
}

async function fetchProduct() {
  loading.value = true
  const id = route.params.id as string

  const { data, error } = await supabase
    .from('store_products')
    .select('*, store_product_categories(name, name_zh), merchant_stores(name, logo_url)')
    .eq('id', id)
    .maybeSingle()

  if (!error && data) {
    product.value = data
    categoryName.value = localized(data.store_product_categories?.name_zh, data.store_product_categories?.name) || ''

    // Increment view count
    supabase.rpc('increment_store_product_view', { p_product_id: id })
    
    // Log detail view
    ActivityLogService.log('store_product_detail_open', { product_id: id, name: data.name })
    
    // Fetch reviews
    fetchReviews(id)
  }
  loading.value = false
}

async function fetchReviews(productId: string) {
  const { data } = await supabase
    .from('store_product_reviews')
    .select('*, user_profiles(display_name, avatar_url)')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(20)
  reviews.value = data || []
  
  // Check if current user already has a review
  if (currentUserId.value) {
    existingReview.value = reviews.value.find(r => r.user_id === currentUserId.value) || null
  }
}

function openReviewModal() {
  if (existingReview.value) {
    selectedRating.value = existingReview.value.rating
    reviewComment.value = existingReview.value.comment || ''
  } else {
    selectedRating.value = 0
    reviewComment.value = ''
  }
  reviewModalOpen.value = true
}

async function submitReview() {
  if (!product.value || !currentUserId.value || selectedRating.value === 0) return
  submittingReview.value = true
  
  const reviewData = {
    product_id: product.value.id,
    user_id: currentUserId.value,
    rating: selectedRating.value,
    comment: reviewComment.value.trim() || null
  }

  let isUpdate = false
  if (existingReview.value) {
    // Update existing review
    await supabase
      .from('store_product_reviews')
      .update({ rating: reviewData.rating, comment: reviewData.comment })
      .eq('id', existingReview.value.id)
    isUpdate = true
  } else {
    // Insert new review
    await supabase
      .from('store_product_reviews')
      .insert(reviewData)
  }

  // Mathematically update avg_rating and review_count to preserve seeded dummy data
  let currentCount = product.value.review_count || 0
  let currentAvg = product.value.avg_rating || 0

  let newCount = currentCount
  let newAvg = currentAvg

  if (isUpdate) {
    // Subtract old rating, add new rating
    const oldRating = existingReview.value.rating
    if (currentCount > 0) {
      newAvg = ((currentAvg * currentCount) - oldRating + reviewData.rating) / currentCount
    } else {
      newAvg = reviewData.rating
    }
  } else {
    // Add new rating
    newAvg = ((currentAvg * currentCount) + reviewData.rating) / (currentCount + 1)
    newCount += 1
  }

  const roundedAvg = Math.round(newAvg * 10) / 10

  // Use RPC to bypass RLS, since normal users cannot update store_products
  await supabase.rpc('update_store_product_rating', {
    p_product_id: product.value.id,
    p_avg_rating: roundedAvg,
    p_review_count: newCount
  })
  
  product.value.avg_rating = roundedAvg
  product.value.review_count = newCount

  // Refresh reviews
  await fetchReviews(product.value.id)
  
  reviewModalOpen.value = false
  submittingReview.value = false

  const toast = await toastController.create({
    message: isUpdate ? `✅ ${t('store.reviewUpdated')}` : `✅ ${t('store.reviewSubmitted')}`,
    duration: 1500,
    position: 'bottom',
    color: 'success'
  })
  toast.present()
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(locale.value === 'zh' ? 'zh-TW' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  })
}

async function fetchUser() {
  const { data } = await supabase.auth.getUser()
  currentUserId.value = data?.user?.id || null
}

async function handleAddToCart() {
  if (!product.value) return
  addItem({
    id: product.value.id,
    name: localized(product.value.name_zh, product.value.name),
    price: product.value.price,
    image: product.value.images?.[0]
  }, qty.value)

  const toast = await toastController.create({
    message: `✅ ${t('store.addToCart')}`,
    duration: 1500,
    position: 'bottom',
    color: 'success'
  })
  toast.present()
  ActivityLogService.log('store_add_to_cart', { product_id: product.value.id, qty: qty.value })
}

function handleBuyNow() {
  ActivityLogService.log('store_buy_now', { product_id: product.value.id, qty: qty.value })
  handleAddToCart()
  router.push('/store/checkout')
}

function navigateToEdit() {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  router.push('/merchant/store/products')
}

function navigateToMerchant(id: string) {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  ActivityLogService.log('store_visit_merchant', { store_id: id })
  router.push(`/store/merchant/${id}`)
}

async function handleChat() {
  if (!product.value) return
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  ActivityLogService.log('store_chat_open', { product_id: product.value.id, merchant_id: product.value.user_id })
  const convId = await getOrCreateConversation(product.value.user_id, product.value.id)
  if (convId) {
    router.push(`/store/chat/${convId}`)
  }
}

onMounted(() => {
  fetchProduct()
  fetchUser()
  initGlobalUnreadSubscription()
})

function openCart() {
  cartOpen.value = true
}

function goCheckout() {
  cartOpen.value = false
  router.push('/store/checkout')
}

function updateQtyInCart(productId: string, newQty: number) {
  const { updateQty } = useStoreCart()
  updateQty(productId, newQty)
}
</script>

<style scoped>
.immersive-header {
  --background: transparent;
  transition: background 0.3s ease-in-out;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
}

.immersive-header.is-scrolled {
  --background: var(--ion-background-color);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.cart-button {
  position: relative;
}

.header-badge {
  position: absolute;
  top: 8px;
  right: 2px;
  font-size: 9px;
  min-width: 16px;
  height: 16px;
  border-radius: 50%;
  padding: 0;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid white;
  box-shadow: 0 2px 4px rgba(255, 0, 0, 0.3);
  z-index: 10;
}

.product-detail-wrapper {
  background: var(--ion-background-color);
  -webkit-tap-highlight-color: transparent;
}

.detail-skeleton {
  padding: 0;
  background: var(--ion-background-color);
}

.image-skeleton {
  width: 100%;
  height: 420px;
  border-radius: 0;
}

.detail-page-container {
  padding-bottom: 24px;
}

/* Gallery */
.gallery-scroll {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
}

.gallery-scroll::-webkit-scrollbar {
  display: none;
}

.gallery-item {
  min-width: 100%;
  scroll-snap-align: start;
  flex-shrink: 0;
}

.gallery-image {
  width: 100%;
  height: 420px;
  object-fit: cover;
  display: block;
}

.gallery-placeholder {
  width: 100%;
  height: 420px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ion-color-step-50, #f4f5f8);
  font-size: 64px;
  color: var(--ion-color-medium);
}

/* Detail body */
.detail-body {
  padding: 20px 20px 8px;
}

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

.category-badge {
  --background: var(--ion-color-step-100, #f4f5f8);
  --color: var(--ion-color-step-600, #666666);
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  height: 24px;
  margin: 0 0 8px;
}

.detail-name {
  font-size: 1.4rem;
  font-weight: 700;
  line-height: 1.3;
  color: var(--ion-text-color);
  margin: 0 0 4px;
}

.detail-name-sub {
  font-size: 0.9rem;
  color: var(--ion-color-medium);
  margin: 0 0 12px;
}

.price-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 12px 0;
}

.detail-price {
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--ion-color-carrot);
}

.meta-badges {
  display: flex;
  gap: 8px;
}

.meta-badge {
  font-size: 0.72rem;
  color: var(--ion-color-step-600, #666666);
  background: var(--ion-color-step-100, #f4f5f8);
  padding: 4px 8px;
  border-radius: 8px;
}

.stock-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--ion-color-success);
  margin: 8px 0 20px;
  font-weight: 500;
}

.stock-row.out-of-stock {
  color: var(--ion-color-danger);
}

.description-section {
  margin: 16px 0;
}

.description-section h3 {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--ion-text-color);
}

.description-section p {
  font-size: 0.88rem;
  color: var(--ion-color-medium);
  line-height: 1.6;
  margin: 0;
  white-space: pre-wrap;
}

.quantity-section {
  margin: 20px 0;
}

.quantity-section h3 {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0 0 10px;
  color: var(--ion-text-color);
}

.quantity-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.quantity-controls ion-button {
  --border-radius: 10px;
  --padding-start: 8px;
  --padding-end: 8px;
  width: 36px;
  height: 36px;
}

.qty-display {
  font-size: 1.1rem;
  font-weight: 700;
  min-width: 32px;
  text-align: center;
}

/* Footer action */
.action-toolbar {
  --background: var(--ion-background-color);
  --border-width: 0;
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.06);
}

.action-buttons {
  display: flex;
  gap: 10px;
  padding: 8px 16px;
}

.action-btn {
  flex: 1;
  --border-radius: 14px;
  font-weight: 600;
  height: 48px;
  font-size: 0.92rem;
}

.chat-btn {
  --padding-start: 12px;
  --padding-end: 12px;
  font-size: 22px;
  flex-shrink: 0;
}

/* Empty */
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

.store-info-section {
  margin: 24px 0;
  padding: 16px;
  background: var(--ion-color-step-100, #f8f9fa);
  border-radius: 16px;
  border: 1px solid var(--ion-color-step-200, rgba(0,0,0,0.05));
}

.store-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.store-avatar {
  width: 44px;
  height: 44px;
}

.store-text {
  flex: 1;
}

.store-name {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  color: var(--ion-text-color);
}

.store-tagline {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
  margin: 2px 0 0;
}

.visit-store-btn {
  --border-radius: 8px;
  font-size: 0.75rem;
  height: 32px;
}


/* Dark mode */
.ion-palette-dark .gallery-placeholder {
  background: var(--ion-color-step-100, #2a2a2a);
}

.ion-palette-dark .category-badge {
  --background: var(--ion-color-step-150, #2a2a2a);
  --color: var(--ion-color-step-700, #cccccc);
}

.ion-palette-dark .meta-badge {
  background: var(--ion-color-step-150, #2a2a2a);
  color: var(--ion-color-step-700, #cccccc);
}

.ion-palette-dark .store-info-section {
  background: var(--ion-color-step-150, #1e1e1e);
  border: 1px solid var(--ion-color-step-250, rgba(255,255,255,0.1));
}

/* Responsive Layout */
.product-container {
  max-width: 1000px;
  margin: 0 auto;
  width: 100%;
}

@media (min-width: 768px) {
  .detail-page {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 32px;
    padding: 32px 24px;
    align-items: start;
  }
  
  .gallery-scroll {
    flex-direction: column;
    gap: 16px;
    overflow: visible;
  }
  
  .gallery-item {
    min-width: 100%;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  }
  
  .gallery-image {
    height: auto;
    aspect-ratio: 1;
  }
  
  .detail-body {
    padding: 0;
  }
  
  .detail-name {
    font-size: 2rem;
  }
  
  .detail-price {
    font-size: 2.2rem;
  }
  
  /* Make the action toolbar more like a side section or fixed bar */
  .action-toolbar {
    max-width: 1000px;
    margin: 0 auto;
    border-radius: 16px 16px 0 0;
  }
}

/* Reviews Section */
.reviews-section {
  margin: 28px 0 16px;
  border-top: 1px solid var(--ion-color-step-100, #eee);
  padding-top: 20px;
}

.reviews-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.reviews-header h3 {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0;
  color: var(--ion-text-color);
}

.rating-summary {
  margin-bottom: 20px;
}

.rating-big {
  display: flex;
  align-items: center;
  gap: 10px;
}

.big-number {
  font-size: 2.2rem;
  font-weight: 800;
  color: var(--ion-text-color);
}

.big-stars {
  color: #f5a623;
  font-size: 1.1rem;
  letter-spacing: 2px;
}

.total-reviews {
  font-size: 0.82rem;
  color: var(--ion-color-medium);
}

.review-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.review-card {
  padding: 14px;
  background: var(--ion-color-step-50, #f8f9fa);
  border-radius: 14px;
  border: 1px solid var(--ion-color-step-100, rgba(0,0,0,0.04));
}

.review-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.reviewer-avatar {
  width: 32px;
  height: 32px;
}

.reviewer-info {
  display: flex;
  flex-direction: column;
}

.reviewer-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ion-text-color);
}

.review-date {
  font-size: 0.7rem;
  color: var(--ion-color-medium);
}

.review-stars {
  color: #f5a623;
  font-size: 0.85rem;
  letter-spacing: 1px;
  margin-bottom: 6px;
}

.review-comment {
  font-size: 0.88rem;
  color: var(--ion-color-step-600, #555);
  line-height: 1.5;
  margin: 0;
}

.no-reviews {
  text-align: center;
  padding: 24px;
  color: var(--ion-color-medium);
  font-size: 0.88rem;
}

/* Review Modal */
.review-modal-content {
  --background: var(--ion-background-color);
}

.star-selector {
  margin-bottom: 24px;
}

.star-selector h3,
.comment-section h3 {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0 0 12px;
  color: var(--ion-text-color);
}

.star-buttons {
  display: flex;
  gap: 8px;
}

.star-btn {
  font-size: 2rem;
  background: none;
  border: none;
  color: var(--ion-color-step-200, #ddd);
  cursor: pointer;
  padding: 4px;
  transition: color 0.15s ease, transform 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.star-btn.star-active {
  color: #f5a623;
  transform: scale(1.15);
}

.comment-section {
  margin-bottom: 24px;
}

.review-textarea {
  --background: var(--ion-color-step-50, #f8f9fa);
  --border-radius: 12px;
  --padding-start: 14px;
  --padding-end: 14px;
  --padding-top: 12px;
  border: 1px solid var(--ion-color-step-150, transparent);
  border-radius: 12px;
  font-size: 0.92rem;
}

.review-textarea:focus-within {
  border-color: var(--ion-color-carrot);
}

.submit-review-btn {
  --border-radius: 14px;
  --box-shadow: 0 4px 12px rgba(255, 126, 0, 0.25);
  font-weight: 700;
  height: 50px;
  font-size: 1rem;
}

/* Dark mode overrides for reviews */
.ion-palette-dark .review-card {
  background: var(--ion-color-step-100, #1e1e1e);
  border-color: var(--ion-color-step-200, rgba(255,255,255,0.08));
}

.ion-palette-dark .review-comment {
  color: var(--ion-color-step-700, #ccc);
}

.ion-palette-dark .star-btn {
  color: var(--ion-color-step-300, #444);
}

.ion-palette-dark .star-btn.star-active {
  color: #f5a623;
}

.ion-palette-dark .review-textarea {
  --background: var(--ion-color-step-100, #1e1e1e);
  border-color: var(--ion-color-step-200);
}
</style>
