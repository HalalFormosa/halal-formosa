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
              <ion-item button :detail="false" @click="sortBy = 'recent'">
                <ion-icon :icon="timeOutline" slot="start" />
                <ion-label>{{ $t('admin.sortRecent') }}</ion-label>
                <ion-icon v-if="sortBy === 'recent'" :icon="checkmarkCircle" slot="end" color="success" style="font-size: 14px;" />
              </ion-item>
              
              <ion-item button :detail="false" @click="sortBy = 'alpha'">
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
        <ion-item-sliding
            v-for="product in filteredProducts"
            :key="product.id"
        >
          <ion-item
              button
              detail
              @click="openProductModal(product)"
          >
            <ion-thumbnail slot="start">
              <img :src="product.photo_front_url" :alt="$t('review.imageAlt')" />
            </ion-thumbnail>
            <ion-label>
              <div style="display: flex; align-items: center; gap: 8px;">
                <h2 style="margin: 0;">{{ product.name }}</h2>
                <ion-badge v-if="product.is_rejected" color="danger" style="font-size: 10px; padding: 3px 6px; border-radius: 4px;">Rejected</ion-badge>
              </div>
              <p>{{ product.barcode }}</p>
            </ion-label>
          </ion-item>

          <ion-item-options side="end">
            <ion-item-option v-if="!product.is_archived" color="warning" @click="archiveProduct(product.id, $event)">
              <ion-icon slot="start" :icon="trashOutline" />
              {{ $t('admin.archive') }}
            </ion-item-option>
            <ion-item-option v-else color="success" @click="restoreProduct(product.id, $event)">
              <ion-icon slot="start" :icon="swapVerticalOutline" />
              {{ $t('admin.restore') }}
            </ion-item-option>
          </ion-item-options>
        </ion-item-sliding>
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
          </ion-toolbar>
        </ion-header>

        <ion-content class="ion-padding">
          <div v-if="selectedProduct" class="form-container">
            <!-- 🚨 Rejection Notice Banner -->
            <div v-if="selectedProduct.is_rejected" class="rejection-banner ion-padding ion-margin-bottom animate__animated animate__fadeIn" style="background: rgba(var(--ion-color-danger-rgb), 0.1); border: 1px solid var(--ion-color-danger); border-radius: 12px; color: var(--ion-color-danger); margin-bottom: 16px;">
              <h4 style="margin: 0 0 6px 0; font-weight: 700; display: flex; align-items: center; gap: 6px; font-size: 15px;">
                <ion-icon :icon="closeCircle" style="font-size: 18px;" />
                Rejected Submission
              </h4>
              <p style="margin: 0; font-size: 13.5px; opacity: 0.95;">
                <strong>Reason:</strong> {{ selectedProduct.rejection_reason || 'No reason provided.' }}
              </p>
            </div>

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
              <ion-item lines="none" button @click="categoryModalOpen = true">
                <ion-label>
                  <h3 style="font-size: 13px; color: var(--ion-color-medium); margin-bottom: 4px;">
                    {{ $t('review.category') }} <ion-text color="danger">*</ion-text>
                  </h3>
                  <p style="font-size: 15px; color: var(--ion-text-color); margin-top: 4px;">
                    {{ selectedCategoryName || 'Select a Category...' }}
                  </p>
                </ion-label>
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
                    :stores="sortedStores"
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

              <!-- Quick Insert Buttons -->
              <div class="quick-scroll-container ion-padding-horizontal ion-padding-bottom">
                <ion-button size="small" fill="outline" color="success" @click="applyQuickDescription(quickDescriptions.halal)" class="quick-btn">Halal by</ion-button>
                <ion-button size="small" fill="outline" color="primary" @click="applyQuickDescription(quickDescriptions.muslimFriendly)" class="quick-btn">Friendly OK</ion-button>
                <ion-button size="small" fill="outline" color="warning" @click="applyQuickDescription(quickDescriptions.syubhah)" class="quick-btn">Syubhah found</ion-button>
                <ion-button size="small" fill="outline" color="danger" @click="applyQuickDescription(quickDescriptions.haram)" class="quick-btn">Haram found</ion-button>
              </div>

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
                      <ion-button v-if="isFrontCleaned" size="small" color="warning" fill="clear" @click="restoreOriginalImage('front')" :title="$t('review.restoreOriginal') || 'Original Photo'">
                        <ion-icon slot="icon-only" :icon="refreshOutline" />
                      </ion-button>
                      <ion-button size="small" fill="clear" @click="takeFrontPicture" :title="$t('review.takePhoto') || 'Camera'">
                        <ion-icon slot="icon-only" :icon="cameraOutline" />
                      </ion-button>
                      <ion-button size="small" fill="clear" @click="uploadFrontFromGallery" :title="$t('review.uploadPhoto') || 'Upload'">
                        <ion-icon slot="icon-only" :icon="cloudUploadOutline" />
                      </ion-button>
                      <ion-button size="small" fill="clear" @click="rotateImage('front')" :disabled="rotatingFront" :title="$t('review.rotatePhoto') || 'Rotate'">
                        <ion-spinner v-if="rotatingFront" name="crescent"></ion-spinner>
                        <ion-icon v-else slot="icon-only" :icon="syncOutline" />
                      </ion-button>
                      <ion-button size="small" fill="clear" @click="cleanBackgroundImage('front')" :disabled="cleaningFront" :title="$t('review.cleanBackground') || 'Remove Background'">
                        <ion-spinner v-if="cleaningFront" name="crescent"></ion-spinner>
                        <ion-icon v-else slot="icon-only" :icon="colorWandOutline" />
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
                      <ion-button v-if="isBackCleaned" size="small" color="warning" fill="clear" @click="restoreOriginalImage('back')" :title="$t('review.restoreOriginal') || 'Original Photo'">
                        <ion-icon slot="icon-only" :icon="refreshOutline" />
                      </ion-button>
                      <ion-button size="small" fill="clear" @click="takeBackPicture" :title="$t('review.takePhoto') || 'Camera'">
                        <ion-icon slot="icon-only" :icon="cameraOutline" />
                      </ion-button>
                      <ion-button size="small" fill="clear" @click="uploadBackFromGallery" :title="$t('review.uploadPhoto') || 'Upload'">
                        <ion-icon slot="icon-only" :icon="cloudUploadOutline" />
                      </ion-button>
                      <ion-button size="small" fill="clear" @click="rotateImage('back')" :disabled="rotatingBack" :title="$t('review.rotatePhoto') || 'Rotate'">
                        <ion-spinner v-if="rotatingBack" name="crescent"></ion-spinner>
                        <ion-icon v-else slot="icon-only" :icon="syncOutline" />
                      </ion-button>
                      <ion-button size="small" fill="clear" @click="cleanBackgroundImage('back')" :disabled="cleaningBack" :title="$t('review.cleanBackground') || 'Remove Background'">
                        <ion-spinner v-if="cleaningBack" name="crescent"></ion-spinner>
                        <ion-icon v-else slot="icon-only" :icon="colorWandOutline" />
                      </ion-button>
                    </div>
                  </div>
                </div>
              </div>
            </ion-item-group>

            <div class="ion-padding-top ion-margin-top" style="border-top: 1px solid var(--ion-color-step-150); display: flex; flex-direction: column; gap: 12px;">
              <ion-button @click="approveProduct(selectedProduct)" :disabled="publishing" color="carrot" expand="block" style="font-weight: 700; height: 48px;">
                <ion-spinner v-if="publishing" slot="start" name="crescent"></ion-spinner>
                <ion-icon v-else slot="start" :icon="checkmarkOutline" />
                {{ publishing ? $t('review.publishing', 'Publishing...') : $t('review.publish', 'Publish') }}
              </ion-button>

              <div style="display: flex; gap: 8px;">
                <ion-button v-if="!selectedProduct.is_archived" @click="archiveProduct(selectedProduct.id)" :disabled="publishing" color="warning" style="flex: 1;">
                  <ion-icon slot="start" :icon="trashOutline" />
                  {{ $t('admin.archive') }}
                </ion-button>
                <ion-button v-else @click="restoreProduct(selectedProduct.id)" :disabled="publishing" color="success" style="flex: 1;">
                  <ion-icon slot="start" :icon="swapVerticalOutline" />
                  {{ $t('admin.restore') }}
                </ion-button>
                <ion-button @click="rejectProduct(selectedProduct)" :disabled="publishing" color="danger" fill="outline" style="flex: 1;">
                  <ion-icon slot="start" :icon="trashOutline" />
                  {{ $t('review.reject') }}
                </ion-button>
              </div>
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
                style="position: absolute; top: calc(env(safe-area-inset-top, 0px) + 16px); right: 16px; z-index: 9999;"
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
              <SwiperSlide v-if="frontPreview || selectedProduct.photo_front_url">
                <div class="swiper-zoom-container">
                  <img :src="frontPreview || selectedProduct.photo_front_url" :alt="$t('review.frontImageAlt')" />
                </div>
              </SwiperSlide>
              <SwiperSlide v-if="backPreview || selectedProduct.photo_back_url">
                <div class="swiper-zoom-container">
                  <img :src="backPreview || selectedProduct.photo_back_url" :alt="$t('review.backImageAlt')" />
                </div>
              </SwiperSlide>
            </Swiper>
          </ion-content>
        </ion-modal>

        <!-- 📂 Category Search & Select Modal -->
        <ion-modal
          :is-open="categoryModalOpen"
          @didDismiss="categoryModalOpen = false"
          :breakpoints="[0, 0.5, 0.9]"
          :initial-breakpoint="0.9"
          :handle="true"
          style="--border-radius: 16px;"
        >
          <ion-header>
            <ion-toolbar color="carrot">
              <ion-title>{{ $t('addProduct.selectCategory') || 'Select Category' }}</ion-title>
              <ion-buttons slot="end">
                <ion-button @click="categoryModalOpen = false">{{ $t('common.cancel') || 'Cancel' }}</ion-button>
              </ion-buttons>
            </ion-toolbar>
            <ion-toolbar>
              <ion-searchbar
                v-model="categoryQuery"
                :placeholder="$t('addProduct.searchCategoryPlaceholder') || 'Search categories...'"
                animated
              ></ion-searchbar>
            </ion-toolbar>
          </ion-header>

          <ion-content>
            <ion-list>
              <ion-item
                v-for="cat in filteredCategories"
                :key="cat.id"
                button
                @click="selectCategory(cat)"
                :class="{ 'selected-category-item': selectedProduct?.product_category_id === cat.id }"
              >
                <ion-label>{{ cat.name }}</ion-label>
                <ion-icon 
                  v-if="selectedProduct?.product_category_id === cat.id" 
                  :icon="checkmarkCircle" 
                  slot="end" 
                  color="success" 
                />
              </ion-item>
            </ion-list>
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
  IonSearchbar, IonSegment, IonSegmentButton, IonPopover, IonIcon, IonAvatar, IonBadge, IonItemGroup, IonSpinner,
  IonItemSliding, IonItemOptions, IonItemOption, alertController, toastController
} from '@ionic/vue'

import { ref, onMounted, computed, reactive, onUnmounted, watch } from 'vue'
import { supabase } from '@/plugins/supabaseClient'
import {
  checkmarkOutline,
  closeOutline,
  closeCircle,
  listOutline,
  trashOutline,
  cameraOutline,
  cloudUploadOutline,
  timeOutline,
  checkmarkCircle,
  swapVerticalOutline,
  syncOutline,
  colorWandOutline,
  refreshOutline
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
import { useBackgroundRemoval } from "@/composables/useBackgroundRemoval";
import { highlightIngredients } from "@/utils/useIngredientHighlighter";
import { useNotifier } from "@/composables/useNotifier";

import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const { notifyEvent } = useNotifier()

const categories = ref<{ id:number; name:string }[]>([])
const modules = [Pagination, Zoom]
const pendingProducts = ref<any[]>([])
const showModal = ref(false)
const selectedProduct = ref<any | null>(null)
const showImageModal = ref(false)
const publishing = ref(false)

const categoryModalOpen = ref(false)
const categoryQuery = ref('')

const filteredCategories = computed(() => {
  const q = categoryQuery.value.trim().toLowerCase()
  if (!q) return categories.value
  return categories.value.filter(cat => cat.name.toLowerCase().includes(q))
})

const selectedCategoryName = computed(() => {
  if (!selectedProduct.value) return ''
  const matched = categories.value.find(cat => cat.id === selectedProduct.value.product_category_id)
  return matched ? matched.name : ''
})

function selectCategory(cat: { id: number; name: string }) {
  if (selectedProduct.value) {
    selectedProduct.value.product_category_id = cat.id
  }
  categoryModalOpen.value = false
  categoryQuery.value = ''
}

const quickDescriptions = {
  halal: "Halal certified by ",
  muslimFriendly: "Muslim-friendly ingredients, OK.",
  syubhah: "Syubhah ingredients found.",
  haram: "Haram ingredients found."
}

function applyQuickDescription(text: string) {
  if (selectedProduct.value) {
    selectedProduct.value.description = text
  }
}
const activeImageIndex = ref(0)
const ingredientDictionary = ref<Record<string, string>>({})
const showAllIngredients = ref(false)
const maxVisible = 5
const loadingProducts = ref(true)
const isUnmounted = ref(false)
const { resizeImage } = useImageResizer();
const { removeAndAddWhiteBg, preloadAIModel } = useBackgroundRemoval();
const stores = ref<any[]>([])

// Image states
const frontFile = ref<File | null>(null)
const backFile = ref<File | null>(null)
const frontPreview = ref<string | null>(null)
const backPreview = ref<string | null>(null)
const originalFrontFile = ref<File | null>(null)
const originalBackFile = ref<File | null>(null)
const originalFrontPreview = ref<string | null>(null)
const originalBackPreview = ref<string | null>(null)
const rotatingFront = ref(false)
const rotatingBack = ref(false)
const cleaningFront = ref(false)
const cleaningBack = ref(false)

const isFrontCleaned = computed(() => !!frontPreview.value && !!originalFrontPreview.value && frontPreview.value !== originalFrontPreview.value)
const isBackCleaned = computed(() => !!backPreview.value && !!originalBackPreview.value && backPreview.value !== originalBackPreview.value)

function restoreOriginalImage(type: 'front' | 'back') {
  if (type === 'front') {
    if (originalFrontPreview.value) frontPreview.value = originalFrontPreview.value
    if (originalFrontFile.value) frontFile.value = originalFrontFile.value
  } else {
    if (originalBackPreview.value) backPreview.value = originalBackPreview.value
    if (originalBackFile.value) backFile.value = originalBackFile.value
  }
}

async function cleanBackgroundImage(type: 'front' | 'back') {
  if (!selectedProduct.value) return;
  const currentSrc = type === 'front' 
    ? (frontFile.value || frontPreview.value || selectedProduct.value.photo_front_url) 
    : (backFile.value || backPreview.value || selectedProduct.value.photo_back_url);

  if (!currentSrc || (typeof currentSrc === 'string' && currentSrc.includes('placehold.co'))) return;

  const cleaningProp = type === 'front' ? cleaningFront : cleaningBack;
  cleaningProp.value = true;

  try {
    const { file, previewUrl } = await removeAndAddWhiteBg(currentSrc, `${type}_clean.jpg`);
    if (type === 'front') {
      frontFile.value = file;
      frontPreview.value = previewUrl;
    } else {
      backFile.value = file;
      backPreview.value = previewUrl;
    }
  } catch (err) {
    console.error(`❌ Failed to remove background for ${type}:`, err);
    alert('Failed to remove background. Please try again.');
  } finally {
    cleaningProp.value = false;
  }
}

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

  // ✅ use standard highlighter (which also handles downgrades automatically)
  const processed = highlightIngredients(
    selectedProduct.value.ingredients,
    ingredientDictionary.value,
    selectedProduct.value.status
  )

  // ✅ sort so highlighted ones appear first
  return [...processed].sort((a: any, b: any) => Number(b.highlighted) - Number(a.highlighted))
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

// Sync and restrict other stores option when regular stores are selected for the product under review
watch(
  () => selectedProduct.value?.store_ids ? [...selectedProduct.value.store_ids] : null,
  (newVal, oldVal) => {
    if (!selectedProduct.value || !newVal) return
    const OTHER_STORES_ID = '2a013308-190c-4684-a607-3bc3d7817115'

    // Case 1: All stores deselected -> default back to Other Stores
    if (newVal.length === 0) {
      selectedProduct.value.store_ids = [OTHER_STORES_ID]
      return
    }

    // Case 2: Other Stores is selected along with specific stores
    if (newVal.includes(OTHER_STORES_ID) && newVal.length > 1) {
      const oldValSafe = oldVal || []
      const added = newVal.filter(id => !oldValSafe.includes(id))

      if (added.includes(OTHER_STORES_ID)) {
        // User explicitly clicked Other Stores -> clear all specific stores
        selectedProduct.value.store_ids = [OTHER_STORES_ID]
      } else {
        // User selected a specific store -> remove Other Stores
        selectedProduct.value.store_ids = newVal.filter(id => id !== OTHER_STORES_ID)
      }
    }
  }
)

// Show selected stores first so they're visible without scrolling right,
// preserving original sort_order within the selected/unselected groups.
const sortedStores = computed(() => {
  const selectedIds: string[] = selectedProduct.value?.store_ids || []
  if (!selectedIds.length) return stores.value
  const selected = stores.value.filter(s => selectedIds.includes(s.id))
  const unselected = stores.value.filter(s => !selectedIds.includes(s.id))
  return [...selected, ...unselected]
})

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
    originalFrontPreview.value = frontPreview.value;
    originalFrontFile.value = frontFile.value;
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
    originalBackPreview.value = backPreview.value;
    originalBackFile.value = backFile.value;
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
        originalFrontPreview.value = frontPreview.value;
        originalFrontFile.value = frontFile.value;
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
        originalBackPreview.value = backPreview.value;
        originalBackFile.value = backFile.value;
      };
      reader.readAsDataURL(file);
    }
  };
  input.click();
}

async function rotateImage(type: 'front' | 'back') {
  if (!selectedProduct.value) return;
  const src = type === 'front' 
    ? (frontPreview.value || selectedProduct.value.photo_front_url) 
    : (backPreview.value || selectedProduct.value.photo_back_url);
    
  if (!src || src.includes('placehold.co')) return;

  const rotatingProp = type === 'front' ? rotatingFront : rotatingBack;
  rotatingProp.value = true;

  try {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    const cleanSrc = src.startsWith('data:') ? src : `${src}${src.includes('?') ? '&' : '?'}t=${Date.now()}`;
    img.src = cleanSrc;

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => {
        const fallbackImg = new Image();
        fallbackImg.src = src;
        fallbackImg.onload = () => {
          Object.assign(img, fallbackImg);
          resolve(null);
        };
        fallbackImg.onerror = reject;
      };
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.height;
    canvas.height = img.width;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(90 * Math.PI / 180);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

    if (type === 'front') {
      frontPreview.value = dataUrl;
    } else {
      backPreview.value = dataUrl;
    }

    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], `${type}.jpg`, { type: 'image/jpeg' });

    if (type === 'front') {
      frontFile.value = file;
    } else {
      backFile.value = file;
    }
  } catch (err) {
    console.error(`❌ Error rotating ${type} image:`, err);
  } finally {
    rotatingProp.value = false;
  }
}

async function openProductModal(product: any) {
  // Fetch linked stores for this product
  const { data: linkedStores } = await supabase
      .from('product_stores')
      .select('store_id')
      .eq('product_id', product.id)

  const storeIds = linkedStores ? linkedStores.map(s => String(s.store_id)) : []

  // Create a reactive copy
  frontPreview.value = product.photo_front_url || null
  backPreview.value = product.photo_back_url || null
  originalFrontPreview.value = product.photo_front_url || null
  originalBackPreview.value = product.photo_back_url || null

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
  originalFrontFile.value = null
  originalBackFile.value = null
  originalFrontPreview.value = null
  originalBackPreview.value = null
  showModal.value = false
}

async function showToast(message: string, color: string) {
  const toast = await toastController.create({ message, duration: 2000, color, position: 'bottom' })
  await toast.present()
}


async function approveProduct(product: any) {
  if (publishing.value) return
  publishing.value = true
  try {
  const { data } = await supabase.auth.getUser()
  const user = data?.user
  if (!user) {
    showToast(t('common.sessionExpired'), 'danger')
    return
  }

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
      frontUrl = `${publicUrl.publicUrl.split('?')[0]}?v=${Date.now()}`
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
      backUrl = `${publicUrl.publicUrl.split('?')[0]}?v=${Date.now()}`
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
        approved_at: new Date().toISOString(),
        is_rejected: false,
        rejection_reason: null
      })
      .eq("id", product.id)

  if (!error) {
    // Sync stores
    await saveProductStores(product.id, product.store_ids || [], user.id)

    // 🔔 Announce the published product (shared cooldown with new_product adds)
    await notifyEvent(
        "new_product",
        "🆕 New Product Published!",
        `${product.name} (${product.status})\nBarcode: ${product.barcode}\nAdded by: ${product.uploader?.display_name || t('admin.anonymousUser')}`,
        frontUrl || backUrl,
        {
          barcode: product.barcode,
          status: product.status,
          isNative: true,
          user_id: product.added_by
        }
    )

    closeModal()
    showToast(t('review.publishSuccess'), 'success')
    loadPendingProducts()
  } else {
    console.error("❌ Error approving product:", error)
    showToast(t('review.approveFailed'), 'danger')
  }
  } finally {
    publishing.value = false
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
  const alert = await alertController.create({
    header: t('review.confirmRejectHeader', 'Reject Submission'),
    message: t('review.confirmRejectMsg', 'Please provide a reason for rejecting this submission:'),
    inputs: [
      {
        name: 'reason',
        type: 'textarea',
        placeholder: t('review.reasonPlaceholder', 'e.g. Blurry photo, incorrect barcode, incomplete ingredients...')
      }
    ],
    buttons: [
      { text: t('common.cancel', 'Cancel'), role: 'cancel' },
      {
        text: t('review.reject', 'Reject'),
        handler: async (data) => {
          if (!data.reason || !data.reason.trim()) {
            alert.message = t('review.reasonRequired', 'A reason is required to reject the submission.');
            return false // Keep alert open
          }

          const productId = product.id

          const { error } = await supabase
              .from('products')
              .update({
                is_rejected: true,
                rejection_reason: data.reason.trim()
              })
              .eq('id', productId)

          if (!error) {
            loadPendingProducts()
            closeModal()
          } else {
            console.error("Error rejecting product:", error)
          }
        }
      }
    ]
  })
  await alert.present()
}

function closeSlidingItem(ev?: Event) {
  const el = (ev?.target as HTMLElement | undefined)?.closest('ion-item-sliding') as any
  el?.close?.()
}

async function archiveProduct(id: string, ev?: Event) {
  closeSlidingItem(ev)
  if (!confirm(t('admin.confirmArchive'))) return

  const { error } = await supabase
      .from('products')
      .update({ is_archived: true })
      .eq('id', id)

  if (!error) {
    loadPendingProducts()
    closeModal()
  } else {
    console.error("❌ Error archiving product:", error)
    showToast(t('review.actionFailed'), 'danger')
  }
}

async function restoreProduct(id: string, ev?: Event) {
  closeSlidingItem(ev)
  if (!confirm(t('admin.confirmRestore'))) return

  const { error } = await supabase
      .from('products')
      .update({ is_archived: false })
      .eq('id', id)

  if (!error) {
    loadPendingProducts()
    closeModal()
  } else {
    console.error("❌ Error restoring product:", error)
    showToast(t('review.actionFailed'), 'danger')
  }
}

onMounted( async () => {
  preloadAIModel(); // Non-blocking async preload
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
  --background: var(--background-step-50, var(--ion-color-step-50));
  border-radius: 12px;
  margin-bottom: 20px;
}

.review-modal {
  --border-radius: 16px;
}

.quick-scroll-container {
  display: flex;
  overflow-x: auto;
  gap: 8px;
  padding-bottom: 8px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none; /* Firefox */
}

.quick-scroll-container::-webkit-scrollbar {
  display: none; /* Chrome/Safari */
}

.quick-btn {
  flex-shrink: 0;
  --border-radius: 8px;
}
</style>

