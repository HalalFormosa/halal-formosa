<template>
  <ion-page>
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/store" />
        </ion-buttons>
        <ion-title>{{ store?.name || $t('store.title') }}</ion-title>
        <ion-buttons slot="end">
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
          <div class="store-banner"></div>
          <div class="store-profile-content">
            <ion-avatar class="main-store-avatar">
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
              <div class="product-price-row">
                <span class="product-price">{{ $t('store.twd') }}{{ product.price }}</span>
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
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IonPage, IonHeader, IonContent, IonToolbar, IonButtons, IonBackButton,
  IonTitle, IonAvatar, IonIcon, IonButton, IonSkeletonText
} from '@ionic/vue'
import {
  chatbubbleOutline, checkmarkCircleOutline, imageOutline, bagHandleOutline,
  settingsOutline
} from 'ionicons/icons'
import { supabase } from '@/plugins/supabaseClient'
import { useI18n } from 'vue-i18n'
import { useStoreChat } from '@/composables/useStoreChat'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const { getOrCreateConversation } = useStoreChat()

const store = ref<any>(null)
const products = ref<any[]>([])
const loading = ref(true)
const currentUserId = ref<string | null>(null)

const isOwner = computed(() => {
  if (!store.value || !currentUserId.value) return false
  return store.value.user_id === currentUserId.value
})

function localized(zh: string | null | undefined, en: string | null | undefined): string {
  if (locale.value === 'zh') return zh || en || ''
  return en || zh || ''
}

async function fetchStoreData() {
  loading.value = true
  const storeId = route.params.id as string

  // Fetch store profile
  const { data: storeData } = await supabase
    .from('merchant_stores')
    .select('*')
    .eq('id', storeId)
    .maybeSingle()

  if (storeData) {
    store.value = storeData
    
    // Fetch store products
    const { data: productData } = await supabase
      .from('store_products')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    products.value = productData || []
  }
  loading.value = false
}

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
  height: 120px;
  background: linear-gradient(135deg, var(--ion-color-carrot-shade, #e67e22), var(--ion-color-carrot, #f39c12));
  opacity: 0.15;
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

/* Reuse Store Grid styles */
.store-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
  padding: 0 20px 24px;
}

@media (min-width: 768px) {
  .store-grid {
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
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
}

.product-image-wrapper {
  aspect-ratio: 1;
  width: 100%;
  background: var(--ion-color-step-50, #f8f9fa);
  position: relative;
}

.product-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-info {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.product-name {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ion-text-color);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.3;
}

.product-price {
  font-weight: 700;
  color: var(--ion-color-carrot);
  font-size: 0.95rem;
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
</style>
