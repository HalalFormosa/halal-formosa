<template>
  <ion-page>
    <ion-header>
      <app-header
          :title="$t('admin.reviewProductsTitle')"
          :icon="listOutline"
          :showBack="true"
          backRoute="/search"
      />

      <ion-toolbar class="actions-toolbar">
        <div class="header-main-actions">
          <ion-button fill="clear" class="classic-action-btn sort-btn-wrapper" id="sort-trigger">
            <ion-icon :icon="sortIcon" />
            <span class="btn-label">{{ sortLabel }}</span>
          </ion-button>

          <ion-popover trigger="sort-trigger" trigger-action="click" :dismiss-on-select="true" class="width-190">
            <ion-list lines="none">
              <ion-item button @click="sortBy = 'recent'">
                <ion-icon :icon="timeOutline" slot="start" />
                <ion-label>{{ $t('admin.sortRecent') }}</ion-label>
                <ion-icon v-if="sortBy === 'recent'" :icon="checkmarkCircle" slot="end" color="success" style="font-size: 14px;" />
              </ion-item>
              
              <ion-item button @click="sortBy = 'alpha'">
                <ion-icon :icon="listOutline" slot="start" />
                <ion-label>{{ $t('admin.sortAlpha') }}</ion-label>
                <ion-icon v-if="sortBy === 'alpha'" :icon="checkmarkCircle" slot="end" color="success" style="font-size: 14px;" />
              </ion-item>
            </ion-list>
          </ion-popover>

          <ion-segment v-model="viewMode" mode="ios" style="width: 140px;">
            <ion-segment-button value="pending">
              <ion-label>Review</ion-label>
            </ion-segment-button>
            <ion-segment-button value="archived">
              <ion-label>Archive</ion-label>
            </ion-segment-button>
          </ion-segment>
        </div>
      </ion-toolbar>

      <ion-toolbar class="search-row-toolbar">
        <div class="search-container">
          <ion-searchbar
              v-model="searchQuery"
              :placeholder="$t('admin.searchProductsPlaceholder')"
              :debounce="500"
              class="compact-searchbar"
              :animated="true"
          />
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Skeleton while loading -->
      <div v-if="loadingProducts">
        <ion-list>
          <ion-item v-for="n in 5" :key="n">
            <ion-thumbnail slot="start">
              <ion-skeleton-text animated style="width: 64px; height: 64px; border-radius: 8px;" />
            </ion-thumbnail>
            <ion-label>
              <h2>
                <ion-skeleton-text animated style="width: 60%; height: 16px;" />
              </h2>
              <p>
                <ion-skeleton-text animated style="width: 40%; height: 14px;" />
              </p>
            </ion-label>
          </ion-item>
        </ion-list>
      </div>

      <!-- Product list -->
      <ion-list v-else-if="filteredProducts.length">
        <ion-item
            v-for="product in filteredProducts"
            :key="product.id"
            button
            detail
            @click="openProductModal(product)"
        >
          <ion-thumbnail slot="start">
            <img :src="product.photo_front_url" :alt="$t('review.imageAlt')" />
          </ion-thumbnail>
          <ion-label>
            <h2>{{ product.name }}</h2>
            <p>{{ product.barcode }}</p>
          </ion-label>
        </ion-item>
      </ion-list>

      <!-- No pending products -->
      <div v-else class="ion-text-center ion-padding" style="margin-top: 40px;">
        <ion-icon :icon="listOutline" style="font-size: 64px; opacity: 0.2;" />
        <p style="opacity: 0.5; margin-top: 16px;">
          {{ viewMode === 'pending' ? $t('admin.noPendingProducts') : $t('admin.noArchivedProducts') }}
        </p>
      </div>

      <!-- ✅ Product Detail Modal -->
      <ion-modal :is-open="showModal" @didDismiss="closeModal" class="review-modal">
        <ion-header>
          <ion-toolbar color="carrot">
            <ion-buttons slot="start">
              <ion-button @click="closeModal">
                <ion-icon :icon="closeOutline" />
              </ion-button>
            </ion-buttons>
            <ion-title>{{ $t('review.modalTitle') }}</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="approveProduct(selectedProduct)">
                <ion-icon slot="start" :icon="checkmarkOutline" />
                {{ $t('review.approve') }}
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>

        <ion-content class="ion-padding">
          <div v-if="selectedProduct" class="form-container">
            <!-- 👤 Uploader Attribution -->
            <ion-item lines="none" class="uploader-info ion-margin-bottom">
              <ion-avatar slot="start">
                <img :src="selectedProduct.uploader?.avatar_url || 'https://placehold.co/100x100?text=👤'" />
              </ion-avatar>
              <ion-label>
                <p style="font-size: 12px; margin-bottom: 2px;">{{ $t('review.uploadedBy') }}</p>
                <h3 style="font-weight: 600;">{{ selectedProduct.uploader?.display_name || $t('admin.anonymousUser') }}</h3>
              </ion-label>
              <ion-badge slot="end" color="medium">{{ selectedProduct.uploader?.donor_type || $t('profile.donors.Free') }}</ion-badge>
            </ion-item>

            <ion-item-group>
              <!-- Barcode (now editable) -->
              <ion-item>
                <ion-input
                  v-model="selectedProduct.barcode"
                  label-placement="floating"
                  :label="$t('review.barcode')"
                ></ion-input>
              </ion-item>

              <!-- Product Name -->
              <ion-item>
                <ion-input
                  v-model="selectedProduct.name"
                  label-placement="floating"
                  :label="$t('review.name')"
                ></ion-input>
              </ion-item>

              <!-- Status -->
              <ion-item>
                <ion-select v-model="selectedProduct.status" interface="popover" :label="$t('review.status')" label-placement="floating">
                  <ion-select-option value="Halal">{{ $t('review.statusHalal') }}</ion-select-option>
                  <ion-select-option value="Muslim-friendly">{{ $t('review.statusMuslimFriendly') }}</ion-select-option>
                  <ion-select-option value="Syubhah">{{ $t('review.statusSyubhah') }}</ion-select-option>
                  <ion-select-option value="Haram">{{ $t('review.statusHaram') }}</ion-select-option>
                </ion-select>
              </ion-item>

              <!-- Category -->
              <ion-item>
                <ion-select v-model="selectedProduct.product_category_id" interface="alert" :label="$t('review.category')" label-placement="floating">
                  <ion-select-option v-for="cat in categories" :key="cat.id" :value="cat.id">
                    {{ cat.name }}
                  </ion-select-option>
                </ion-select>
              </ion-item>

              <!-- Ingredients -->
              <ion-item>
                <ion-textarea
                  v-model="selectedProduct.ingredients"
                  label-placement="floating"
                  :label="$t('review.ingredients')"
                  auto-grow
                ></ion-textarea>
              </ion-item>
              
              <!-- Ingredients Highlights (Visual aid only) -->
              <div class="ion-margin-top ion-padding-horizontal">
                <ul style="margin:0; padding-left:1.2rem; font-size: 14px; opacity: 0.8">
                  <li v-for="(ing, idx) in visibleIngredients"
                      :key="idx"
                      v-html="ing.html">
                  </li>
                </ul>
                <div v-if="highlightedIngredients.length > maxVisible" class="ion-margin-top">
                  <ion-button fill="clear" size="small" @click="showAllIngredients = !showAllIngredients">
                    {{ !showAllIngredients ? $t('review.viewMore') : $t('review.viewLess') }}
                  </ion-button>
                </div>
              </div>

              <!-- Stores Selection -->
              <ion-item lines="none" class="ion-margin-top">
                <ion-label position="stacked">{{ $t('addProduct.stores') }}</ion-label>
                <StoreLogoBar
                    :stores="stores"
                    mode="select"
                    v-model:modelValue="selectedProduct.store_ids"
                />
              </ion-item>

              <!-- Description -->
              <ion-item>
                <ion-textarea
                  v-model="selectedProduct.description"
                  label-placement="floating"
                  :label="$t('review.description')"
                  auto-grow
                ></ion-textarea>
              </ion-item>

              <!-- Images Preview -->
              <div class="ion-margin-top ion-padding-horizontal">
                <ion-label class="ion-padding-bottom">
                  <strong>{{ $t('review.images') }}</strong>
                </ion-label>
                <div class="review-image-grid">
                  <!-- Front Image -->
                  <div class="img-preview-container">
                    <div class="img-preview-box" @click="openImageModal(0)">
                      <img :src="frontPreview || selectedProduct.photo_front_url || 'https://placehold.co/300x200?text=No+Front+Image'" />
                      <span class="img-label">{{ $t('review.frontImageAlt') }}</span>
                    </div>
                    <div class="img-controls">
                      <ion-button size="small" fill="clear" @click="takeFrontPicture">
                        <ion-icon slot="icon-only" :icon="cameraOutline" />
                      </ion-button>
                      <ion-button size="small" fill="clear" @click="uploadFrontFromGallery">
                        <ion-icon slot="icon-only" :icon="cloudUploadOutline" />
                      </ion-button>
                    </div>
                  </div>

                  <!-- Back Image -->
                  <div class="img-preview-container">
                    <div class="img-preview-box" @click="openImageModal(1)">
                      <img :src="backPreview || selectedProduct.photo_back_url || 'https://placehold.co/300x200?text=No+Back+Image'" />
                      <span class="img-label">{{ $t('review.backImageAlt') }}</span>
                    </div>
                    <div class="img-controls">
                      <ion-button size="small" fill="clear" @click="takeBackPicture">
                        <ion-icon slot="icon-only" :icon="cameraOutline" />
                      </ion-button>
                      <ion-button size="small" fill="clear" @click="uploadBackFromGallery">
                        <ion-icon slot="icon-only" :icon="cloudUploadOutline" />
                      </ion-button>
                    </div>
                  </div>
                </div>
              </div>
            </ion-item-group>

            <div class="ion-padding-top ion-margin-top" style="border-top: 1px solid var(--ion-color-step-150); display: flex; gap: 8px;">
              <ion-button v-if="!selectedProduct.is_archived" @click="archiveProduct(selectedProduct.id)" color="warning" style="flex: 1;">
                <ion-icon slot="start" :icon="trashOutline" />
                {{ $t('admin.archive') }}
              </ion-button>
              <ion-button v-else @click="restoreProduct(selectedProduct.id)" color="success" style="flex: 1;">
                <ion-icon slot="start" :icon="swapVerticalOutline" />
                {{ $t('admin.restore') }}
              </ion-button>
              <ion-button @click="rejectProduct(selectedProduct)" color="danger" fill="outline" style="flex: 1;">
                <ion-icon slot="start" :icon="trashOutline" />
                {{ $t('review.reject') }}
              </ion-button>
            </div>
          </div>
        </ion-content>

        <!-- ✅ Fullscreen Image Modal -->
        <ion-modal :is-open="showImageModal" @didDismiss="showImageModal = false">
          <ion-content fullscreen style="--background: black">
            <!-- Floating Close Button -->
            <ion-button
                fill="solid"
                color="carrot"
                style="position: absolute; top: 16px; right: 16px; z-index: 9999;"
                @click="showImageModal = false"
            >
              ✕
            </ion-button>

            <!-- Swiper Gallery -->
            <Swiper
                v-if="selectedProduct"
                :modules="modules"
                :zoom="true"
                :slides-per-view="1"
                :pagination="{ clickable: true }"
                :initial-slide="activeImageIndex"
                class="fullscreen-swiper"
            >
              <SwiperSlide v-if="selectedProduct.photo_front_url">
                <div class="swiper-zoom-container">
                  <img :src="selectedProduct.photo_front_url" :alt="$t('review.frontImageAlt')" />
                </div>
              </SwiperSlide>
              <SwiperSlide v-if="selectedProduct.photo_back_url">
                <div class="swiper-zoom-container">
                  <img :src="selectedProduct.photo_back_url" :alt="$t('review.backImageAlt')" />
                </div>
              </SwiperSlide>
            </Swiper>
          </ion-content>
        </ion-modal>

      </ion-modal>
    </ion-content>
  </ion-page>
</template>



<script setup lang="ts">
import {
  IonPage, IonHeader, IonContent, IonList, IonItem,
  IonThumbnail, IonLabel, IonButton, IonText, IonModal,
  IonToolbar, IonTitle, IonButtons, IonInput, IonSelect,
  IonSelectOption, IonTextarea, IonChip, IonSkeletonText,
  IonSearchbar, IonSegment, IonSegmentButton, IonPopover, IonIcon, IonAvatar, IonBadge
} from '@ionic/vue'

import { ref, onMounted, computed, reactive, onUnmounted } from 'vue'
import { supabase } from '@/plugins/supabaseClient'
import {
  checkmarkOutline,
  closeOutline,
  listOutline,
  trashOutline,
  cameraOutline,
  cloudUploadOutline,
  timeOutline,
  checkmarkCircle,
  swapVerticalOutline
} from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import StoreLogoBar from '@/components/StoreLogoBar.vue'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Pagination, Zoom } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/pagination'
import 'swiper/css/zoom'

import { Camera, CameraDirection, CameraResultType, CameraSource } from '@capacitor/camera'
import { useImageResizer } from "@/composables/useImageResizer";

import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const categories = ref<{ id:number; name:string }[]>([])
const modules = [Pagination, Zoom]
const pendingProducts = ref<any[]>([])
const showModal = ref(false)
const selectedProduct = ref<any | null>(null)
const showImageModal = ref(false)
const activeImageIndex = ref(0)
const ingredientDictionary = ref<Record<string, string>>({})
const showAllIngredients = ref(false)
const maxVisible = 5
const loadingProducts = ref(true)
const isUnmounted = ref(false)
const { resizeImage } = useImageResizer();
const stores = ref<any[]>([])

// Image states
const frontFile = ref<File | null>(null)
const backFile = ref<File | null>(null)
const frontPreview = ref<string | null>(null)
const backPreview = ref<string | null>(null)

onUnmounted(() => {
  isUnmounted.value = true
})

// Ingredient entry type
interface IngredientEntry {
  html: string
  highlighted: boolean
}

const highlightedIngredients = computed<IngredientEntry[]>(() => {
  if (!selectedProduct.value || !selectedProduct.value.ingredients) return []

  // 🚫 If status = Halal → just return plain
  if (selectedProduct.value.status === 'Halal') {
    return selectedProduct.value.ingredients
        .split(',')
        .map((p: string): IngredientEntry => ({ html: p.trim(), highlighted: false }))
        .filter((p: IngredientEntry) => p.html.length > 0)
  }

  const parts: string[] = selectedProduct.value.ingredients
      .split(',')
      .map((p: string) => p.trim())
      .filter((p: string) => p.length > 0)

  const sortedKeys: string[] = Object.keys(ingredientDictionary.value)
      .sort((a: string, b: string) => b.length - a.length)

  const processed: IngredientEntry[] = parts.map((part: string): IngredientEntry => {
    const lower = part.toLowerCase()
    const key = sortedKeys.find((k: string) => lower.includes(k.toLowerCase()))
    if (key) {
      const color = ingredientDictionary.value[key]
      return {
        html: `<span style="font-weight:600;color:var(${color});">${part}</span>`,
        highlighted: true
      }
    }
    return { html: part, highlighted: false }
  })

  // ✅ sort so highlighted ones appear first
  processed.sort((a: IngredientEntry, b: IngredientEntry) => Number(b.highlighted) - Number(a.highlighted))

  return processed
})

const visibleIngredients = computed<IngredientEntry[]>(() => {
  return showAllIngredients.value
      ? highlightedIngredients.value
      : highlightedIngredients.value.slice(0, maxVisible)
})

const usedColors = computed<string[]>(() => {
  const set = new Set<string>()
  highlightedIngredients.value.forEach((ing: IngredientEntry) => {
    if (ing.highlighted) {
      const match = ing.html.match(/var\((--ion-color-[^)]+)\)/)
      if (match) set.add(match[1])
    }
  })
  return Array.from(set)
})

const colorLabels: Record<string, string> = {
  '--ion-color-success': 'Halal',
  '--ion-color-primary': 'Muslim-friendly',
  '--ion-color-warning': 'Syubhah',
  '--ion-color-danger': 'Haram'
}

function colorToChipClass(color: string): string {
  switch (color) {
    case '--ion-color-success': return 'chip-success'
    case '--ion-color-primary': return 'chip-primary'
    case '--ion-color-warning': return 'chip-warning'
    case '--ion-color-danger': return 'chip-danger'
    default: return 'chip-medium'
  }
}


async function loadCategories() {
  const { data, error } = await supabase.from("product_categories").select("id, name")
  if (!error && data) categories.value = data
}

async function fetchStores() {
  const { data, error } = await supabase
      .from("stores")
      .select("id, name, logo_url, sort_order")
      .order("sort_order", { ascending: true })

  if (!error && data) {
    stores.value = data.map(store => ({
      ...store,
      id: String(store.id)
    }))
  }
}

function openImageModal(index: number) {
  activeImageIndex.value = index
  showImageModal.value = true
}

function closeImageModal() {
  showImageModal.value = false
}

const searchQuery = ref('')
const viewMode = ref<'pending' | 'archived'>('pending')
const sortBy = ref<'recent' | 'alpha'>('recent')

const sortIcon = computed(() => {
  return sortBy.value === 'recent' ? timeOutline : listOutline
})

const sortLabel = computed(() => {
  return sortBy.value === 'recent' ? t('admin.sortRecent') : t('admin.sortAlpha')
})

const filteredProducts = computed(() => {
  let result = [...pendingProducts.value]

  // Filter by view mode
  if (viewMode.value === 'pending') {
    result = result.filter(p => !p.is_archived)
  } else {
    result = result.filter(p => p.is_archived)
  }

  // Filter by search query
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(p => 
      p.name?.toLowerCase().includes(q) || 
      p.barcode?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q)
    )
  }

  // Sort
  if (sortBy.value === 'alpha') {
    result.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  } else {
    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  return result
})

async function loadPendingProducts() {
  loadingProducts.value = true
  // Fetch both pending (approved: false) and archived products
  const { data: products, error: prodError } = await supabase
      .from('products')
      .select('*')
      .eq('approved', false)
      .order('created_at', { ascending: false })

  if (prodError) {
    console.error("❌ Error fetching pending products:", prodError)
    loadingProducts.value = false
    return
  }

  if (products && products.length > 0) {
    const uploaderIds = [...new Set(products.map(p => p.added_by).filter(Boolean))]
    
    if (uploaderIds.length > 0) {
      const { data: profiles, error: profError } = await supabase
          .from('user_profiles')
          .select('id, display_name, avatar_url, donor_type')
          .in('id', uploaderIds)

      if (!profError && profiles) {
        const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]))
        pendingProducts.value = products.map(p => ({
          ...p,
          uploader: profileMap[p.added_by] || null
        }))
      } else {
        pendingProducts.value = products
      }
    } else {
      pendingProducts.value = products
    }
  } else {
    pendingProducts.value = []
  }
  
  loadingProducts.value = false
}

async function takeFrontPicture() {
  if (isUnmounted.value) return;
  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      direction: CameraDirection.Rear
    });
    frontPreview.value = image.webPath || null;
    frontFile.value = await resizeImage(image.webPath || '');
  } catch (error) {
    console.error('Error taking front photo:', error);
  }
}

async function takeBackPicture() {
  if (isUnmounted.value) return;
  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      direction: CameraDirection.Rear
    });
    backPreview.value = image.webPath || null;
    backFile.value = await resizeImage(image.webPath || '');
  } catch (error) {
    console.error('Error taking back photo:', error);
  }
}

function uploadFrontFromGallery() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      const file = target.files[0];
      const reader = new FileReader();
      reader.onload = async () => {
        frontPreview.value = reader.result as string;
        frontFile.value = await resizeImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  input.click();
}

function uploadBackFromGallery() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      const file = target.files[0];
      const reader = new FileReader();
      reader.onload = async () => {
        backPreview.value = reader.result as string;
        backFile.value = await resizeImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  input.click();
}

async function openProductModal(product: any) {
  // Fetch linked stores for this product
  const { data: linkedStores } = await supabase
      .from('product_stores')
      .select('store_id')
      .eq('product_id', product.id)

  const storeIds = linkedStores ? linkedStores.map(s => String(s.store_id)) : []

  // Create a reactive copy
  selectedProduct.value = reactive({
    ...product,
    store_ids: storeIds
  })
  showModal.value = true
}

function closeModal() {
  selectedProduct.value = null
  frontFile.value = null
  backFile.value = null
  frontPreview.value = null
  backPreview.value = null
  showModal.value = false
}


async function approveProduct(product: any) {
  const { data } = await supabase.auth.getUser()
  const user = data?.user
  if (!user) return

  let frontUrl = product.photo_front_url
  let backUrl = product.photo_back_url
  const barcode = product.barcode

  // 1. Upload images if changed
  if (frontFile.value) {
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(`${barcode}/front.jpg`, frontFile.value, { upsert: true })
    
    if (!uploadError) {
      const { data: publicUrl } = supabase.storage
        .from('product-images')
        .getPublicUrl(`${barcode}/front.jpg`)
      frontUrl = publicUrl.publicUrl
    }
  }

  if (backFile.value) {
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(`${barcode}/back.jpg`, backFile.value, { upsert: true })
    
    if (!uploadError) {
      const { data: publicUrl } = supabase.storage
        .from('product-images')
        .getPublicUrl(`${barcode}/back.jpg`)
      backUrl = publicUrl.publicUrl
    }
  }

  // 2. Update product
  const { error } = await supabase
      .from("products")
      .update({
        barcode: product.barcode,
        name: product.name,
        status: product.status,
        product_category_id: product.product_category_id,
        ingredients: product.ingredients,
        description: product.description,
        photo_front_url: frontUrl,
        photo_back_url: backUrl,
        approved: true,
        approved_by: user.id,
        approved_at: new Date().toISOString()
      })
      .eq("id", product.id)

  if (!error) {
    // Sync stores
    await saveProductStores(product.id, product.store_ids || [], user.id)
    loadPendingProducts()
    closeModal()
  }
}

async function saveProductStores(productId: string, storeIds: string[], userId: string) {
  try {
    // Delete existing links
    await supabase.from("product_stores").delete().eq("product_id", productId)

    if (storeIds.length > 0) {
      const links = storeIds.map(storeId => ({
        product_id: productId,
        store_id: storeId,
        added_by: userId,
      }))
      await supabase.from("product_stores").insert(links)
    }
  } catch (err) {
    console.error("❌ Failed to save product_stores:", err)
  }
}

async function rejectProduct(product: any) {
  const barcode = product.barcode
  const productId = product.id

  // 1. Delete images from storage if they exist
  try {
    const filesToDelete = []
    if (product.photo_front_url) filesToDelete.push(`${barcode}/front.jpg`)
    if (product.photo_back_url) filesToDelete.push(`${barcode}/back.jpg`)

    if (filesToDelete.length > 0) {
      const { error: storageError } = await supabase.storage
          .from('product-images')
          .remove(filesToDelete)
      
      if (storageError) {
        console.warn("⚠️ Photo deletion warning (might not exist):", storageError)
      }
    }
  } catch (err) {
    console.error("❌ Storage deletion error:", err)
  }

  // 2. Delete the record (cascading store links should be handled by DB or manually)
  // Since we have a manual saveProductStores, let's be safe and clear links first if needed, 
  // but usually a product delete in our schema handles it.
  const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId)

  if (!error) {
    loadPendingProducts()
    closeModal()
  }
}

async function archiveProduct(id: string) {
  if (!confirm(t('admin.confirmArchive'))) return

  const { error } = await supabase
      .from('products')
      .update({ is_archived: true })
      .eq('id', id)

  if (!error) {
    loadPendingProducts()
    closeModal()
  }
}

async function restoreProduct(id: string) {
  if (!confirm(t('admin.confirmRestore'))) return

  const { error } = await supabase
      .from('products')
      .update({ is_archived: false })
      .eq('id', id)

  if (!error) {
    loadPendingProducts()
    closeModal()
  }
}

onMounted( async () => {
  const { data, error } = await supabase
      .from('ingredient_highlights')
      .select('keyword, color')

  if (!error && data) {
    ingredientDictionary.value = Object.fromEntries(
        data.map(h => [h.keyword, h.color])
    )
  }

  await loadPendingProducts()
  await loadCategories()
  await fetchStores()
})
</script>

<style scoped>
/* Consolidated Search Header Styles */
.actions-toolbar,
.search-row-toolbar {
  --background: var(--ion-background-color);
  --border-width: 0;
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

.width-190 {
  --width: 190px;
}

/* Modal and form styles */
.review-image-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 8px;
}

.img-preview-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.img-controls {
  display: flex;
  justify-content: center;
  gap: 8px;
  background: var(--ion-color-step-100);
  border-radius: 0 0 8px 8px;
  border: 1px solid var(--ion-color-step-150);
  border-top: none;
}

.img-preview-box {
  position: relative;
  aspect-ratio: 4/3;
  background: var(--ion-color-step-100);
  border-radius: 8px 8px 0 0;
  overflow: hidden;
  border: 1px solid var(--ion-color-step-150);
}

.img-preview-box img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.img-label {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0,0,0,0.5);
  color: white;
  font-size: 10px;
  padding: 4px;
  text-align: center;
}

.fullscreen-swiper {
  width: 100%;
  height: 100%;
  background: black;
}

.fullscreen-swiper img {
  width: 100%;
  height: auto;
  max-height: 100%;
  object-fit: contain;
}

.form-container {
  border-radius: 12px;
  background: var(--ion-card-background, var(--ion-item-background));
  padding-bottom: 24px;
}

.uploader-info {
  --background: var(--ion-color-step-50);
  border-radius: 12px;
}

ion-header {
  border-bottom: none !important;
  box-shadow: none !important;
}

.actions-toolbar ion-button,
.actions-toolbar ion-icon {
  color: var(--ion-color-dark);
}
</style>

<style>
.preview-swiper {
  margin-top: 5px;
  width: 100%;
  height: 180px; 
}

.preview-swiper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.review-image-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 8px;
}

.img-preview-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.img-controls {
  display: flex;
  justify-content: center;
  gap: 8px;
  background: var(--ion-color-step-100);
  border-radius: 0 0 8px 8px;
  border: 1px solid var(--ion-color-step-150);
  border-top: none;
}

.img-preview-box {
  position: relative;
  aspect-ratio: 4/3;
  background: var(--ion-color-step-100);
  border-radius: 8px 8px 0 0;
  overflow: hidden;
  border: 1px solid var(--ion-color-step-150);
}

.img-preview-box img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.img-label {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0,0,0,0.5);
  color: white;
  font-size: 10px;
  padding: 4px;
  text-align: center;
}

.fullscreen-swiper {
  width: 100%;
  height: 100%;
  background: black;
}

.fullscreen-swiper img {
  width: 100%;
  height: auto;
  max-height: 100%;
  object-fit: contain;
}

.form-container {
  border-radius: 12px;
  background: var(--ion-card-background, var(--ion-item-background));
  padding-bottom: 24px;
}

.uploader-info {
  --background: var(--ion-color-step-50);
  border-radius: 12px;
  margin-bottom: 20px;
}

.review-modal {
  --border-radius: 16px;
}
</style>

