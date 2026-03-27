<template>
  <ion-page>
    <ion-header>
      <app-header :title="product?.name || $t('store.title')" :showBack="true" icon="none" />
    </ion-header>

    <ion-content :fullscreen="true">
      <div v-if="isUnderConstruction" class="under-construction-overlay">
        <div class="construction-card">
          <ion-icon :icon="constructOutline" class="construction-icon" />
          <h2>{{ $t('common.underConstruction') || 'Under Construction' }}</h2>
          <p>This product is currently being prepared. Check back soon!</p>
        </div>

        <div class="detail-skeleton">
          <ion-skeleton-text animated class="image-skeleton" />
          <div style="padding: 16px;">
            <ion-skeleton-text animated style="width: 40%; height: 14px;" />
            <ion-skeleton-text animated style="width: 80%; height: 22px; margin-top: 8px;" />
            <ion-skeleton-text animated style="width: 30%; height: 28px; margin-top: 12px;" />
            <ion-skeleton-text animated style="width: 100%; height: 60px; margin-top: 16px;" />
          </div>
        </div>
      </div>

      <!-- Skeleton while loading -->
      <div v-else-if="loading" class="detail-skeleton">
        <ion-skeleton-text animated class="image-skeleton" />
        <div style="padding: 16px;">
          <ion-skeleton-text animated style="width: 40%; height: 14px;" />
          <ion-skeleton-text animated style="width: 80%; height: 22px; margin-top: 8px;" />
          <ion-skeleton-text animated style="width: 30%; height: 28px; margin-top: 12px;" />
          <ion-skeleton-text animated style="width: 100%; height: 60px; margin-top: 16px;" />
        </div>
      </div>

      <div v-if="!loading && product" class="detail-page">
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

          <!-- Quantity -->
          <div class="quantity-section" v-if="product.stock_quantity > 0">
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
        </div>
      </div>

      <!-- Not found -->
      <div v-if="!loading && !product" class="empty-state">
        <ion-icon :icon="bagHandleOutline" class="empty-icon" />
        <p>{{ $t('store.noProducts') }}</p>
      </div>
    </ion-content>

    <!-- Action bar -->
    <ion-footer v-if="product && !isUnderConstruction">
      <ion-toolbar class="action-toolbar">
        <div class="action-buttons">
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
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IonPage, IonHeader, IonContent, IonFooter, IonToolbar, IonButton, IonIcon,
  IonChip, IonSkeletonText, toastController
} from '@ionic/vue'
import {
  imageOutline, cartOutline, bagHandleOutline, removeOutline, addOutline,
  checkmarkCircleOutline, closeCircleOutline, chatbubbleOutline, constructOutline
} from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import { supabase } from '@/plugins/supabaseClient'
import { useStoreCart } from '@/composables/useStoreCart'
import { useStoreChat } from '@/composables/useStoreChat'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const { addItem } = useStoreCart()
const { getOrCreateConversation } = useStoreChat()

const isUnderConstruction = computed(() => import.meta.env.VITE_STORE_UNDER_CONSTRUCTION === 'true')
const product = ref<any>(null)
const categoryName = ref('')
const loading = ref(true)
const qty = ref(1)

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
    .select('*, store_product_categories(name, name_zh)')
    .eq('id', id)
    .single()

  if (!error && data) {
    product.value = data
    categoryName.value = localized(data.store_product_categories?.name_zh, data.store_product_categories?.name) || ''

    // Increment view count
    supabase.rpc('increment_store_product_view', { p_product_id: id })
  }
  loading.value = false
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
}

function handleBuyNow() {
  handleAddToCart()
  router.push('/store/checkout')
}

async function handleChat() {
  if (!product.value) return
  const convId = await getOrCreateConversation(product.value.user_id, product.value.id)
  if (convId) {
    router.push(`/store/chat/${convId}`)
  }
}

onMounted(fetchProduct)
</script>

<style scoped>
.detail-skeleton {
  padding: 0;
}

.image-skeleton {
  width: 100%;
  height: 320px;
  border-radius: 0;
}

.detail-page {
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
  height: 320px;
  object-fit: cover;
  display: block;
}

.gallery-placeholder {
  width: 100%;
  height: 320px;
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

/* Under Construction */
.under-construction-overlay {
  padding-bottom: 24px;
}

.construction-card {
  margin: 16px;
  padding: 24px;
  background: var(--ion-color-step-50, #f8f9fa);
  border-radius: 20px;
  text-align: center;
  border: 1px dashed var(--ion-color-carrot);
}

.construction-icon {
  font-size: 40px;
  color: var(--ion-color-carrot);
  margin-bottom: 12px;
}

.construction-card h2 {
  margin: 0 0 8px;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--ion-text-color);
}

.construction-card p {
  margin: 0;
  font-size: 0.9rem;
  color: var(--ion-color-medium);
  line-height: 1.5;
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
</style>
