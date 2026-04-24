<template>
  <ion-page>
    <ion-header class="ion-no-border immersive-header" :class="{ 'is-scrolled': isScrolled }">
      <app-header 
        :title="$t('search.details.title')" 
        show-back 
        back-route="/search" 
        :icon="bagOutline"
        :transparent="!isScrolled"
        :contrast="!isScrolled"
      >
        <template #actions>
          <ion-item v-if="userId" button @click="openSaveModal" lines="none">
            <ion-icon :icon="isItemSaved ? bookmark : bookmarkOutline" slot="start" />
            <ion-label>{{ $t('search.details.save') }}</ion-label>
          </ion-item>

          <ion-item v-if="canEdit" button @click="editItem" lines="none">
            <ion-icon :icon="createOutline" slot="start" />
            <ion-label>{{ $t('search.details.edit') }}</ion-label>
          </ion-item>

          <ion-item button @click="share" lines="none">
            <ion-icon :icon="shareSocialOutline" slot="start" />
            <ion-label>{{ $t('search.details.share') }}</ion-label>
          </ion-item>

          <ion-item button @click="reportItem" lines="none">
            <ion-icon :icon="alertCircleOutline" slot="start" />
            <ion-label>{{ $t('search.details.report') }}</ion-label>
          </ion-item>
        </template>
      </app-header>
    </ion-header>


    <!-- If this page should show ads, include this slot and set meta.adSpaceId above -->
    <div v-if="isNative && showAds" id="ad-space-item-details" :style="{ height: '60px', paddingTop: 'var(--ion-safe-area-top, 0)' }"></div>

    <ion-content :scroll-events="true" @ionScroll="handleScroll" fullscreen>

      <div v-if="loading">
        <!-- Image carousel skeleton -->
        <ion-skeleton-text
            animated
            style="width: 100%; height: 300px;"
        />

        <div class="ion-padding-horizontal">
          <!-- Title -->
          <ion-skeleton-text
              animated
              style="width: 70%; height: 22px; margin-top: 16px;"
          />
          <!-- Barcode -->
          <ion-skeleton-text
              animated
              style="width: 40%; height: 16px; margin-top: 8px;"
          />

          <!-- Status chip -->
          <ion-skeleton-text
              animated
              style="width: 100%; height: 40px; border-radius: 5px; margin-top: 16px;"
          />

          <!-- Description header + text -->
          <ion-skeleton-text
              animated
              style="width: 50%; height: 16px; margin-top: 20px;"
          />
          <ion-skeleton-text
              animated
              style="width: 90%; height: 14px; margin-top: 8px;"
          />
          <ion-skeleton-text
              animated
              style="width: 85%; height: 14px; margin-top: 4px;"
          />

          <!-- Ingredients header + list -->
          <ion-skeleton-text
              animated
              style="width: 60%; height: 16px; margin-top: 20px;"
          />
          <div style="margin-top: 8px;">
            <ion-skeleton-text
                v-for="n in 4"
                :key="n"
                animated
                style="width: 90%; height: 14px; margin-bottom: 6px;"
            />
          </div>

          <!-- Action buttons -->
          <ion-skeleton-text
              animated
              style="width: 100%; height: 44px; border-radius: 4px; margin-top: 12px;"
          />
        </div>
      </div>

      <div v-else-if="item">
        <!-- Swiper carousel for images -->
        <Swiper
            v-if="item.photo_front_url || item.photo_back_url"
            :modules="modules"
            :scrollbar="true"
            :slides-per-view="1"
            :pagination="{ clickable: true }"
            class="product-swiper"
        >
          <SwiperSlide v-if="item.photo_front_url">
            <img
                :src="item.photo_front_url"
                alt="Front Image"
                style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;"
                @click="openImageModal(0)"
            />
          </SwiperSlide>
          <SwiperSlide v-if="item.photo_back_url">
            <img
                :src="item.photo_back_url"
                alt="Back Image"
                style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;"
                @click="openImageModal(1)"
            />
          </SwiperSlide>
        </Swiper>

        <!-- Details below the slider -->
        <div 
          :class="[
            'details-container', 
            item?.partner_tier ? 'tier-' + item.partner_tier.toLowerCase() : ''
          ]"
        >
          <!-- Premium Flare for Gold/Silver -->
          <div v-if="['gold', 'silver'].includes(String(item?.partner_tier || '').toLowerCase())" class="premium-flare"></div>

          <div class="ion-padding" style="position: relative; z-index: 2;">
            <div class="title-row">
              <h2 class="product-title">{{ item?.name }}</h2>
              <div v-if="item?.partner_tier" class="premium-badge-wrapper">
                <div :class="['premium-badge-pill', item.partner_tier.toLowerCase()]">
                  <ion-icon :icon="sparkles" />
                  <span>{{ $t('home.partnerTier', { tier: item.partner_tier.toUpperCase() }) }}</span>
                </div>
              </div>
            </div>

            <!-- Barcode row -->
            <p class="barcode-row">
              <!-- Left side: barcode -->
              <span class="barcode-wrapper">
                <ion-icon :icon="barcodeOutline" />
                <small>{{ item.barcode }}</small>
              </span>

              <!-- Right side: category -->
              <small class="category-text">{{ $te('search.categoriesList.' + item.product_categories?.name) ? $t('search.categoriesList.' + item.product_categories?.name) : item.product_categories?.name }}</small>
            </p>

            <p v-if="item.author?.public_profile" class="attribution-text">
              {{ $t('home.addedBy', { author: item.author.display_name }) }} - {{ fromNowToTaipei(item.created_at) }}
            </p>
            <p v-else class="attribution-text">
              {{ $t('home.added') }} {{ fromNowToTaipei(item.created_at) }}
            </p>

            <!-- Status & Verified Tag -->
            <div class="status-action-row">
              <ion-chip :class="statusToChipClass(item?.status || '')">
                {{ $t(`search.status.${item?.status}`) }}
              </ion-chip>
              
              <div v-if="item?.partner_tier" class="official-verified-tag">
                <ion-icon :icon="shieldCheckmarkOutline" />
                <span>{{ $t('search.officialPartner') }}</span>
              </div>
            </div>

            <!-- Produced By (Campus Partner) -->
            <div
                v-if="item?.partner?.partner_type === 'campus' && item?.partner?.partner_tier === 'gold'"
                class="ion-margin-top"
            >
              <p class="section-title">
                <strong><small>{{ $t('search.details.producedBy') }}</small></strong>
              </p>

              <div
                  class="gold-cert-card"
                  role="button"
                  tabindex="0"
                  @click="goToPartner(item.partner.id)"
              >
                <!-- Glow layer -->
                <div class="gold-glow"></div>

                <!-- Content -->
                <div class="gold-cert-content">
                  <div class="gold-cert-left">
                    <img
                        v-if="item.partner.logo_url"
                        :src="item.partner.logo_url"
                        alt="logo"
                        class="gold-cert-logo"
                    />

                    <div class="gold-cert-text">
                      <div class="gold-cert-name">
                        {{ item.partner.name }}
                      </div>
                      <div class="premium-verified-tag">
                        {{ $t('home.partnerTier', { tier: (item.partner.partner_tier || '').toUpperCase() }) }} • {{ $t('partner.verifiedLabelShort') || 'Verified' }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Certified By (Gold Partner) -->
            <div
                v-if="!loadingCertifications && certifications.length"
                class="ion-margin-top"
            >
              <p class="section-title">
                <strong><small>{{ $t('search.details.certifiedBy') }}</small></strong>
              </p>

              <div
                  v-for="c in certifications"
                  :key="c.partner.id"
                  class="gold-cert-card"
                  role="button"
                  tabindex="0"
                  @click="goToPartner(c.partner.id)"
              >
                <!-- Glow layer -->
                <div class="gold-glow"></div>

                <!-- Content -->
                <div class="gold-cert-content">
                  <div class="gold-cert-left">
                    <img
                        v-if="c.partner.logo_url"
                        :src="c.partner.logo_url"
                        alt="logo"
                        class="gold-cert-logo"
                    />

                      <div class="gold-cert-text">
                        <div class="gold-cert-name">
                          {{ c.partner.name }}
                        </div>
                        <div class="premium-verified-tag">
                          {{ $t('home.partnerTier', { tier: (c.partner.partner_tier || '').toUpperCase() }) }} • {{ $t('partner.verifiedLabelShort') || 'Verified' }}
                        </div>
                      </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Stores where this product is available -->
            <div v-if="item.stores?.length" class="ion-margin-top">
              <p class="section-title">
                <strong><small>{{ $t('search.details.availableAt') }}</small></strong>
              </p>
              <StoreLogoBar
                  :stores="item.stores"
                  mode="readonly"
              />
            </div>

            <!-- Description -->
            <p class="section-title ion-margin-top">
              <strong><small>{{ $t('search.details.description') }}</small></strong>
            </p>
            <h5
                class="description-text ion-no-margin"
                v-html="highlightedDescription"
            ></h5>

            <!-- Tags -->
            <div v-if="item.tags && item.tags.length > 0" class="ion-margin-top">
              <p class="section-title">
                <strong><small>{{ $t('addPlace.tagsAndCategories', 'Tags') }}</small></strong>
              </p>
              <div class="tag-chips" style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
                <ion-chip v-for="tag in item.tags" :key="tag" style="margin: 0; font-size: 12px; height: 24px; padding: 0 10px;">
                  <ion-label>{{ tag }}</ion-label>
                </ion-chip>
              </div>
            </div>

            <!-- Ingredients -->
            <p class="section-title ion-margin-top">
              <strong><small>{{ $t('search.details.ingredients') }}</small></strong>
            </p>

            <ul class="ingredients-list">
              <li v-for="(ing, idx) in visibleIngredients"
                  :key="idx"
                  v-html="ing.html">
              </li>
            </ul>

            <!-- Toggle button -->
            <div v-if="highlightedIngredients.length > maxVisible" class="ion-margin-top">
              <ion-button
                  fill="clear"
                  size="small"
                  @click="showAllIngredients = !showAllIngredients"
              >
                {{ !showAllIngredients ? $t('search.details.viewMore') : $t('search.details.viewLess') }}
              </ion-button>
            </div>

            <!-- Color Legend -->
            <div v-if="usedColors.length" class="ion-margin-top ingredient-legend">
              <p class="section-title"><strong><small>{{ $t('search.details.colorLegend') }}</small></strong></p>
              <div class="legend-chips">
                <ion-chip
                    v-for="color in usedColors"
                    :key="color"
                    :class="colorToChipClass(color)"
                >
                  {{ $t(colorLabels[color]) }}
                </ion-chip>
              </div>
            </div>

            <!-- Related Products -->
            <div v-if="relatedProducts.length" class="related-section">
              <p class="section-title">
                <strong><small>{{ $t('search.details.relatedProducts') }}</small></strong>
              </p>
              <div class="discover-grid">
                <ion-card
                    v-for="p in relatedProducts"
                    :key="p.barcode"
                    class="discover-item"
                    :class="p.partner_tier ? 'tier-card-' + p.partner_tier.toLowerCase() : ''"
                    button
                    @click="openRelated(p)"
                >
                  <div v-if="p.partner_tier" class="tier-badge" :class="p.partner_tier.toLowerCase()">
                    <ion-icon :icon="sparkles" />
                    {{ $t('home.partnerTier', { tier: p.partner_tier.toUpperCase() }) }}
                  </div>

                  <div v-if="p.partner_tier === 'Gold' || p.partner_tier === 'Silver'" class="premium-flare"></div>

                  <img
                      :src="p.photo_front_url || 'https://placehold.co/200x200'"
                      alt="product"
                      class="discover-img"
                  />
                  <ion-label class="discover-label">
                    <div class="discover-meta-row">
                      <ion-chip
                          :class="statusToChipClass(p.status)"
                          style="margin: 0; height: 20px; font-weight: 700; border-radius: 6px;"
                      >
                        {{ $t('search.status.' + p.status) }}
                      </ion-chip>
                    </div>
                    <h3 :class="p.partner_tier ? 'product-name-' + p.partner_tier.toLowerCase() : ''">
                      {{ p.name }}
                    </h3>
                    <div class="discover-footer">
                      <p>{{ fromNowToTaipei(p.created_at) }}</p>
                      <span v-if="p.partner_tier" class="premium-verified-tag">{{ $t('search.officialPartner') }}</span>
                    </div>
                  </ion-label>
                </ion-card>
              </div>
            </div>
          </div>
        </div>

      </div>
      <p v-else class="ion-text-center ion-margin-top">❌ {{ $t('search.details.no-item') }}</p>
    </ion-content>

    <!-- 🟢 Fullscreen Image Modal -->
    <ion-modal :is-open="showImageModal" @didDismiss="closeImageModal">
      <ion-content fullscreen>
        <!-- Floating Close Button -->
        <ion-button
            fill="solid"
            color="carrot"
            class="image-modal-close-btn"
            @click="closeImageModal"
        >
          ✕
        </ion-button>

        <!-- Swiper Gallery with Zoom -->
        <Swiper
            :modules="[Pagination, Zoom]"
            :zoom="true"
            :slides-per-view="1"
            :pagination="{ clickable: true }"
            :initial-slide="activeImageIndex"
            class="fullscreen-swiper"
        >
          <SwiperSlide v-if="item!.photo_front_url">
            <div class="swiper-zoom-container">
              <img :src="item!.photo_front_url" alt="Front Image" />
            </div>
          </SwiperSlide>
          <SwiperSlide v-if="item!.photo_back_url">
            <div class="swiper-zoom-container">
              <img :src="item!.photo_back_url" alt="Back Image" />
            </div>
          </SwiperSlide>
        </Swiper>
      </ion-content>
    </ion-modal>

    <!-- Save to Folder Modal -->
    <ion-modal :is-open="showSaveModal" @didDismiss="showSaveModal = false" :initial-breakpoint="0.5" :breakpoints="[0, 0.5, 0.75]">
      <ion-content class="ion-padding">
        <h3>{{ $t('search.details.saveToFolder') }}</h3>
        
        <ion-item lines="full">
          <ion-input 
            v-model="newFolderName" 
            :placeholder="$t('search.details.newCollectionPlaceholder')" 
            @keyup.enter="createNewFolder"
          ></ion-input>
          <ion-button fill="clear" slot="end" @click="createNewFolder">
            <ion-icon :icon="addOutline"></ion-icon>
          </ion-button>
        </ion-item>

        <ion-list class="ion-margin-top">
          <ion-list-header>{{ $t('search.details.yourCollections') }}</ion-list-header>
          
          <ion-item v-for="folder in folders" :key="folder.id" button @click="saveToFolder(folder.id)">
            <ion-icon :icon="folderOutline" slot="start"></ion-icon>
            <ion-label>{{ folder.name }}</ion-label>
          </ion-item>
          
          <p v-if="folders.length === 0" class="ion-text-center ion-padding">{{ $t('search.details.noCollections') }}</p>
        </ion-list>
      </ion-content>
    </ion-modal>
    
    <!-- ✏️ Edit Product Modal -->
    <ion-modal :is-open="showEditModal" @didDismiss="closeEditModal">
      <AddProductView
        v-if="item"
        :edit-product="item"
        @updated="handleProductUpdated"
        @close="closeEditModal"
      />
    </ion-modal>

    <!-- Contribution Prompt Modal -->
    <ion-modal :is-open="showContributionPrompt" class="contribution-modal" @didDismiss="showContributionPrompt = false">
      <div class="modal-wrapper ion-padding">
        <div class="modal-header ion-text-center">
           <div class="icon-circle">
             <ion-icon :icon="sparklesOutline" color="carrot" />
           </div>
           <h2 class="modal-title">{{ $t('scanIngredients.scan.contributionPrompt.title') }}</h2>
        </div>

        <div class="modal-body">
          <p class="main-message">
            {{ $t('search.details.no-item') }}: <strong>{{ barcode }}</strong>.
            <br><br>
            {{ $t('scanIngredients.scan.contributionPrompt.message', { name: barcode, status: $t('search.status.Unknown') }) }}
          </p>

          <div class="motivation-box">
             <div class="islamic-ornament">📿</div>
             <p class="religious-text">
               {{ $t('scanIngredients.scan.contributionPrompt.motivation') }}
             </p>
          </div>
        </div>

        <div class="modal-footer">
          <ion-button expand="block" color="carrot" class="action-btn" @click="() => { showContributionPrompt = false; goToAddProduct(); }">
            <ion-icon slot="start" :icon="addOutline" />
            {{ $t('scanIngredients.scan.contributionPrompt.action') }}
          </ion-button>
          <ion-button expand="block" fill="clear" color="medium" @click="showContributionPrompt = false">
            {{ $t('scanIngredients.scan.contributionPrompt.skip') }}
          </ion-button>
        </div>

      </div>
    </ion-modal>

    <!-- Toasts for save actions -->
    <ion-toast
      :is-open="showSuccessToast"
      :message="toastMessage"
      :duration="2000"
      color="success"
      position="bottom"
      @didDismiss="showSuccessToast = false"
    />
    <ion-toast
      :is-open="showWarningToast"
      :message="toastMessage"
      :duration="2000"
      color="warning"
      position="bottom"
      @didDismiss="showWarningToast = false"
    />
    <ion-toast
      :is-open="showErrorToast"
      :message="toastMessage"
      :duration="2000"
      color="danger"
      position="bottom"
      @didDismiss="showErrorToast = false"
    />
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage,
  IonContent, IonSkeletonText, IonChip, IonButton, IonHeader, IonModal,
  IonIcon, IonItem, IonLabel, IonCard, IonInput, IonList, IonListHeader, IonToast,
  popoverController
} from '@ionic/vue'
import { onMounted, ref, nextTick, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useIonRouter } from '@ionic/vue'
import { Capacitor } from '@capacitor/core'
import { supabase } from '@/plugins/supabaseClient'
import {Swiper, SwiperSlide} from "swiper/vue";
import {Pagination, Zoom} from "swiper/modules";
import 'swiper/css'
import 'swiper/css/pagination'
import 'swiper/css/zoom'
import AppHeader from "@/components/AppHeader.vue";
import {
  alertCircleOutline,
  bagOutline,
  barcodeOutline,
  createOutline,
  bookmarkOutline,
  bookmark,
  addOutline,
  folderOutline,
  sparkles,
  star,
  shieldCheckmarkOutline,
  shareSocialOutline,
  sparklesOutline // Added for contribution prompt
} from "ionicons/icons";
import AddProductView from "@/views/add-product/AddProductView.vue";
import { userRole } from '@/composables/userProfile'
import { isDonor, refreshSubscriptionStatus } from '@/composables/useSubscriptionStatus'
import { ActivityLogService } from "@/services/ActivityLogService";
import { RevenueCatUI, PAYWALL_RESULT } from '@revenuecat/purchases-capacitor-ui'
import { useNotifier } from "@/composables/useNotifier";

const showContributionPrompt = ref(false) // Added state

const showEditModal = ref(false)
const route = useRoute()
const ionRouter = useIonRouter()
const router = useRouter()
const barcode = route.params.barcode as string
const { t } = useI18n()
const { notifyEvent } = useNotifier()

const isScrolled = ref(false)
const handleScroll = (ev: any) => {
  isScrolled.value = ev.detail.scrollTop > 80
}

const loading = ref(true)
const isNative = ref(Capacitor.isNativePlatform())
const modules = [Pagination, Zoom];

const showAllIngredients = ref(false)
const maxVisible = 5

const ingredientDictionary = ref<Record<string, string>>({});

const showSaveModal = ref(false);
const folders = ref<{ id: string, name: string }[]>([]);
const isItemSaved = ref(false); 
const newFolderName = ref('');
const totalSavedItems = ref(0);

const showSuccessToast = ref(false);
const showWarningToast = ref(false);
const showErrorToast = ref(false);
const toastMessage = ref('');

import type { Product } from '@/types/Product'
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import relativeTime from "dayjs/plugin/relativeTime";
import StoreLogoBar from "@/components/StoreLogoBar.vue";
import {highlightIngredients} from "@/utils/useIngredientHighlighter";
import { statusToChipClass } from '@/utils/ingredientHelpers'

type RelatedProduct = {
  barcode: string
  name: string
  status: string
  photo_front_url?: string | null
  product_category_id: number | null
  created_at: string
  partner_tier?: string | null
}

type ProductCertification = {
  certified_at: string | null
  partner: {
    id: string
    name: string
    logo_url: string | null
    partner_tier: 'gold' | 'silver' | 'bronze' | null
    verified: boolean
  }
}

const certifications = ref<ProductCertification[]>([])
const loadingCertifications = ref(false)


const item = ref<Product | null>(null)
const showImageModal = ref(false)
const activeImageIndex = ref(0)
const relatedProducts = ref<RelatedProduct[]>([])

const colorPriority: Record<string, number> = {
  "--ion-color-danger": 1,   // haram
  "--ion-color-warning": 2,  // syubhah
  "--ion-color-primary": 3,  // Muslim-friendly
  "--ion-color-success": 4,  // halal (usually not used in highlight)
  "none": 5                  // neutral / unknown
};


// If this page should show ads (set meta accordingly), keep this true and include the slot.
// If you used meta:{noAds:true} you can leave the slot out and keep showAds = false.
const showAds = false // set true only if meta.adSpaceId is configured

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(relativeTime)

function fromNowToTaipei(dateString?: string) {
  if (!dateString) return ''
  return dayjs.utc(dateString).tz('Asia/Taipei').fromNow()
}

function goToAddProduct() {
  router.push({
    path: '/add',
    query: { barcode: barcode }
  })
}

function getColorFromHtml(html: string): string {
  const match = html.match(/var\((--ion-color-[^)]+)\)/)
  return match ? match[1] : "none"
}

async function fetchProductCertifications(productId: string) {
  loadingCertifications.value = true

  const { data, error } = await supabase
      .from('product_certifications')
      .select(`
      certified_at,
      partners:partner_id (
        id,
        name,
        logo_url,
        partner_tier,
        verified
      )
    `)
      .eq('product_id', productId)
      .eq('status', 'active')

  if (!error && data) {
    certifications.value = (data as any[])
        .map(c => {
          const body = Array.isArray(c.partners) ? c.partners[0] : c.partners
          return {
            certified_at: c.certified_at,
            partner: body
          }
        })
        .filter(c => c.partner && (c.partner.partner_tier || '').toLowerCase() === 'gold') as ProductCertification[]
  }

  loadingCertifications.value = false
}

async function loadFoldersAndSavedState() {
  if (!userId.value || !item.value) return;

  // 1. Fetch user's folders
  const { data: folderData } = await supabase
    .from('saved_item_folders')
    .select('id, name')
    .eq('user_id', userId.value)
    .order('created_at', { ascending: false });
    
  if (folderData) folders.value = folderData;

  // 2. Check if this product is originally already saved by this user
  const { data: savedData } = await supabase
    .from('saved_items')
    .select('id')
    .eq('user_id', userId.value)
    .eq('product_id', item.value.id);
    
  isItemSaved.value = !!(savedData && savedData.length > 0);

  // 3. Get total saved items count
  const { count } = await supabase
    .from('saved_items')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId.value);
    
  totalSavedItems.value = count || 0;
}

async function presentPaywall(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    console.warn("[RC] Paywall can only run on native.");
    return false;
  }

  try {
    const { result } = await RevenueCatUI.presentPaywall();

    switch (result) {
      case PAYWALL_RESULT.PURCHASED:
      case PAYWALL_RESULT.RESTORED:
        // 🔄 Refresh subscription state
        await refreshSubscriptionStatus({ syncToServer: true })

        await ActivityLogService.log("pro_purchase_success", {
          source: "save_item_limit"
        })

        const { data: { user } } = await supabase.auth.getUser();
        await notifyEvent(
          'pro_purchase_success',
          '💎 New Pro Member!',
          `User ${user?.email ?? 'unknown'} has just subscribed to Halal Formosa Pro!`,
          undefined,
          {
            source: 'item_details_view',
            email: user?.email,
            user_id: user?.id
          },
          ['discord']
        ).catch(console.error);

        return true

      case PAYWALL_RESULT.CANCELLED:
        return false

      case PAYWALL_RESULT.ERROR:
      default:
        return false
    }

  } catch (err) {
    console.error("Paywall failed:", err)
    return false
  }
}

async function openSaveModal() {
  await popoverController.dismiss();
  
  if (!isItemSaved.value && !isDonor.value && totalSavedItems.value >= 10) {
    await ActivityLogService.log("pro_paywall_trigger", {
      source: "save_item_limit"
    });

    const purchased = await presentPaywall();

    if (!purchased) return;

    // 🔁 Yield small delay for subscription reactive update
    await new Promise(r => setTimeout(r, 300));
  }
  
  showSaveModal.value = true;
}

async function createNewFolder() {
  if (!newFolderName.value.trim() || !userId.value) return;
  
  const { data, error } = await supabase
    .from('saved_item_folders')
    .insert({ user_id: userId.value, name: newFolderName.value.trim() })
    .select()
    .single();

  if (data && !error) {
    folders.value.unshift(data);
    newFolderName.value = ''; // Reset input
    
    // Auto-save to newly created folder
    await saveToFolder(data.id);
  }
}

async function saveToFolder(folderId: string) {
  if (!userId.value || !item.value) return;

  // 1. Check if the item is already in this specific folder first 
  // to avoid triggering the Postgres `23505` constraint network error.
  const { data: existing } = await supabase
    .from('saved_items')
    .select('id')
    .eq('user_id', userId.value)
    .eq('folder_id', folderId)
    .eq('product_id', item.value.id)
    .maybeSingle();

  if (existing) {
    isItemSaved.value = true;
    showSaveModal.value = false;
    toastMessage.value = t('search.details.itemAlreadySaved');
    showWarningToast.value = true;
    return;
  }

  // 2. If it does not exist, do the insert
  const { error } = await supabase
    .from('saved_items')
    .insert({
      user_id: userId.value,
      folder_id: folderId,
      product_id: item.value.id
    });

  if (!error || error.code === '23505') {
    isItemSaved.value = true;
    showSaveModal.value = false;
    
    if (error?.code === '23505') {
      toastMessage.value = t('search.details.itemAlreadySaved');
      showWarningToast.value = true;
    } else {
      toastMessage.value = t('search.details.itemSavedSuccess');
      showSuccessToast.value = true;
    }
  } else {
    console.error("Failed to save", error);
    toastMessage.value = t('search.details.saveFailed');
    showErrorToast.value = true;
  }
}

async function fetchRelatedProducts() {
  if (!item.value?.product_category_id) return

  const firstWord = item.value.name.split(" ")[0].toLowerCase()

  const { data, error } = await supabase
      .from("products")
      .select("barcode, name, status, photo_front_url, product_category_id, created_at, partner:partners(partner_tier)")
      .eq("approved", true)
      .eq("is_archived", false)
      .eq("product_category_id", item.value.product_category_id)
      .neq("barcode", item.value.barcode)
      .order("created_at", { ascending: false })
      .limit(100)

  if (!error && data) {
    // 🟢 Flatten partner_tier for sorting
    const flattenedData = data.map((p: any) => ({
      ...p,
      partner_tier: Array.isArray(p.partner) ? p.partner[0]?.partner_tier : p.partner?.partner_tier
    }))

    // Define priorities
    const tierPriority: Record<string, number> = {
      'gold': 1,
      'silver': 2,
      'bronze': 3
      // undefined/null -> 4
    }

    const statusPriority: Record<string, number> = {
      'Halal': 1,
      'Muslim-friendly': 2,
      'Syubhah': 3,
      'Haram': 4,
      'Unknown': 5
    }

    // Merge and sort
    const combined = [...flattenedData]
    
    combined.sort((a, b) => {
      // 1. Priority by Partner Tier (Case-insensitive)
      const tierA = (a.partner_tier || '').toLowerCase();
      const tierB = (b.partner_tier || '').toLowerCase();
      const tA = tierPriority[tierA] || 4
      const tB = tierPriority[tierB] || 4
      if (tA !== tB) return tA - tB

      // 2. Priority by status (Normalize for comparison)
      const sA = a.status || 'Unknown'
      const sB = b.status || 'Unknown'
      const pA = statusPriority[sA] || 99
      const pB = statusPriority[sB] || 99
      if (pA !== pB) return pA - pB

      // 3. Priority by similarity (brand match)
      const aSimilar = a.name.toLowerCase().includes(firstWord)
      const bSimilar = b.name.toLowerCase().includes(firstWord)
      if (aSimilar && !bSimilar) return -1
      if (!aSimilar && bSimilar) return 1

      // 4. Newest first
      return dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf()
    })

    // Deduplicate and cap visibility
    const cap = combined.slice(0, 15)
    relatedProducts.value = Array.from(
        new Map(cap.map(p => [p.barcode, p])).values()
    )
  }
}



function openImageModal(index: number) {
  if (item.value) {
    ActivityLogService.log("product_image_open", {
      barcode: item.value.barcode,
      product_name: item.value.name,
      image: index === 0 ? "front" : "back"
    });
  }

  activeImageIndex.value = index;
  showImageModal.value = true;
}

function closeImageModal() {
  showImageModal.value = false
}

const userId = ref<string | null>(null)

const canEdit = computed(() => {
  if (!item.value) return false
  const role = userRole.value || ''
  if (['admin', 'contributor'].includes(role)) return true
  return !!(userId.value && item.value.added_by === userId.value)
})

async function editItem() {
  if (item.value) {
    ActivityLogService.log("product_edit_click", {
      barcode: item.value.barcode,
      product_name: item.value.name
    });
    
    await popoverController.dismiss();
    showEditModal.value = true;
  }
}

async function reportItem() {
  if (item.value) {
    if (!userId.value) {
      // If not logged in, we need to dismiss the popover first then redirect
      await popoverController.dismiss();
      router.push({
        path: '/login',
        query: { redirect: route.fullPath }
      });
      return;
    }

    ActivityLogService.log("product_report_click", {
      barcode: item.value.barcode,
      product_name: item.value.name
    });

    try {
      // Safely attempt to dismiss any overlay before navigating
      await popoverController.dismiss();
    } catch (e) {
      // No popover found, which is fine
    }

    router.push(`/report/${item.value!.barcode}`);
  }
}


function closeEditModal() {
  showEditModal.value = false
}

function goToPartner(id: string) {
  ActivityLogService.log("partner_click", {
    partner_id: id,
    source: "product_detail"
  })

  router.push(`/partner/${id}`)
}

async function handleProductUpdated() {
  showEditModal.value = false
  const { data, error } = await supabase
      .from('products')
      .select(`
    *,
    product_categories ( id, name ),
    product_stores (
      store_id,
      stores ( id, name, logo_url )
    )
  `)
      .eq('barcode', barcode)
      .maybeSingle()

  if (!error && data) {
    item.value = {
      ...data,
      author: null,
      stores: data.product_stores?.map((ps: any) => ps.stores) || []
    }

    if (data.added_by) {
      const { data: authorData } = await supabase
        .from('user_profiles')
        .select('display_name, public_profile')
        .eq('id', data.added_by)
        .maybeSingle()
      if (authorData && item.value) {
        item.value.author = authorData
      }
    }
  }
}

const visibleIngredients = computed(() => {
  if (!highlightedIngredients.value) return []
  return showAllIngredients.value
      ? highlightedIngredients.value
      : highlightedIngredients.value.slice(0, maxVisible)
})

type HighlightedIngredient = {
  html: string
  highlighted: boolean
}

const highlightedIngredients = computed(() => {
  if (!item.value || !item.value.ingredients) return []

  // 🚫 If product is Halal → no highlighting
  if (item.value.status === "Halal") {
    return item.value.ingredients
        .split(",")
        .map((p: string) => ({ html: p.trim(), highlighted: false }))
        .filter(p => p.html.length > 0)
  }

  // ✅ use the new helper
  return highlightIngredients(
      item.value.ingredients,
      ingredientDictionary.value,
      item.value.status
  ).sort((a: HighlightedIngredient, b: HighlightedIngredient) => {
    const colorA = getColorFromHtml(a.html)
    const colorB = getColorFromHtml(b.html)

    return colorPriority[colorA] - colorPriority[colorB]
  })
})


const usedColors = computed(() => {
  if (!highlightedIngredients.value) return []
  // 🚫 Skip if Halal
  if (item.value?.status === 'Halal') return []

  const colorSet = new Set<string>()
  highlightedIngredients.value.forEach(ing => {
    if (ing.highlighted) {
      const match = ing.html.match(/var\((--ion-color-[^)]+)\)/)
      if (match) colorSet.add(match[1])
    }
  })
  return Array.from(colorSet)
})

const highlightedDescription = computed(() => {
  if (!item.value?.description) return ""

  // Words to highlight (lowercase check)
  const keywords: Record<string, string> = {
    "halal": "--ion-color-success",
    "muslim-friendly": "--ion-color-primary",
    "vegan": "--ion-color-primary",
    "syubhah": "--ion-color-warning",
  }

  let text = item.value.description

  // Replace each keyword with a span
  for (const [word, color] of Object.entries(keywords)) {
    const regex = new RegExp(`(${word})`, "gi")
    text = text.replace(
        regex,
        `<span style="font-weight:600; color: var(${color});">$1</span>`
    )
  }

  return text
})


// Map CSS colors to translation keys
const colorLabels: Record<string, string> = {
  '--ion-color-success': 'search.details.legend.halal',
  '--ion-color-primary': 'search.details.legend.muslimFriendly',
  '--ion-color-warning': 'search.details.legend.syubhah',
  '--ion-color-danger': 'search.details.legend.haram'
}

function colorToChipClass(color: string): string {
  switch (color) {
    case '--ion-color-success':
      return 'chip-success'
    case '--ion-color-primary':
      return 'chip-primary'
    case '--ion-color-warning':
      return 'chip-warning'
    case '--ion-color-danger':
      return 'chip-danger'
    default:
      return 'chip-medium'
  }
}

onMounted(async () => {
  loading.value = true

  try {
    const [
      { data: { user } },
      prodRes,
      hlRes
    ] = await Promise.all([
      supabase.auth.getUser(),
      supabase
          .from('products')
          .select(`
          *,
          product_categories ( id, name ),
          product_stores (
            store_id,
            stores ( id, name, logo_url )
          ),
          partner:partners(id, name, partner_tier, partner_type, logo_url, verified)
        `)
          .eq('barcode', barcode)
          .maybeSingle(),
      supabase
          .from('ingredient_highlights')
          .select('keyword, color')
    ])

    // ✅ current user (READ ONLY)
    if (user) {
      userId.value = user.id
    }

    // ✅ product
    if (prodRes.error) {
      console.error('Product load error:', prodRes.error)
    } else if (prodRes.data) {
      const partnerBody = Array.isArray(prodRes.data.partner) ? prodRes.data.partner[0] : prodRes.data.partner
      const product: Product = {
        ...prodRes.data,
        author: null,
        partner: partnerBody,
        partner_tier: partnerBody?.partner_tier,
        stores: prodRes.data.product_stores?.map((ps: any) => ({
          id: ps.stores.id as string,
          name: ps.stores.name,
          logo_url: ps.stores.logo_url ?? undefined,
        })) || []
      }

      // ✅ assign once
      item.value = product

      // Fetch author separately due to missing schema relationship
      if (prodRes.data.added_by) {
        const { data: authorData } = await supabase
          .from('user_profiles')
          .select('display_name, public_profile')
          .eq('id', prodRes.data.added_by)
          .maybeSingle()
        if (authorData && item.value) {
          item.value.author = authorData
        }
      }
      if (product.id) {
        await fetchProductCertifications(product.id)
      }


      // ✅ TS now knows this is non-null
      await ActivityLogService.log("product_details_open", {
        barcode: product.barcode,
        product_name: product.name,
        status: product.status,
        category: product.product_categories?.name || null,
      })

      await fetchRelatedProducts()
      await loadFoldersAndSavedState()
    } else if (!prodRes.data && !prodRes.error) {
      // Product not found in database -> Show contribution prompt
      showContributionPrompt.value = true
    }

    // ✅ ingredient highlights
    if (hlRes.error) {
      console.error('Highlights load error:', hlRes.error)
    } else if (hlRes.data) {
      ingredientDictionary.value = Object.fromEntries(
          hlRes.data.map(h => [h.keyword, h.color])
      )
    }

  } finally {
    loading.value = false
    await nextTick()
    ;(window as any).scheduleBannerUpdate?.()
  }
})


function openRelated(p: RelatedProduct) {
  if (item.value) {
    ActivityLogService.log("related_product_click", {
      from_barcode: item.value.barcode,
      from_name: item.value.name,
      clicked_barcode: p.barcode,
      clicked_name: p.name,
    });
  }

  router.replace(`/item/${p.barcode}`);
}

const share = async () => {
  if (!item.value) return

  await ActivityLogService.log("product_share", {
    barcode: item.value.barcode,
    product_name: item.value.name
  });

  const { Share } = await import('@capacitor/share')
  await Share.share({
    title: item.value.name,
    text: `${item.value.name} (${t('search.status.' + item.value.status)})\n🔗 https://app.halalformosa.com/item/${item.value.barcode}\n\nShared via Halal Formosa 🕌`,
    dialogTitle: t('search.details.share'),
  })
}


</script>

<style scoped>
/* TIERED PAGE STYLES - Inherit from global variables if needed, otherwise clean up redundant local backgrounds */
.tier-gold .official-verified-tag {
  color: #ca8a04;
}
.tier-silver .official-verified-tag {
  color: #64748b;
}

.details-container {
  background: var(--ion-background-color); /* Default theme background */
  margin-top: -24px;
  position: relative;
  border-radius: 24px 24px 0 0;
  min-height: 100vh; /* Ensure background fills to bottom */
  z-index: 10;
  overflow: hidden;
}

/* PREMIUM FLARE */
.premium-flare {
  position: absolute;
  top: 0;
  left: -150%;
  width: 50%;
  height: 100%;
  background: linear-gradient(
    to right,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.4) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  transform: skewX(-25deg);
  z-index: 1;
  pointer-events: none;
  animation: details-shimmer 4s infinite linear;
}

@keyframes details-shimmer {
  0% { left: -150%; }
  30% { left: 150%; }
  100% { left: 150%; }
}

/* TITLES AND TEXT */
.title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 8px;
}

.product-title {
  margin: 0;
  font-weight: 800;
  font-size: 1.6rem;
  line-height: 1.2;
}

.barcode-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 4px 0;
  color: var(--ion-color-medium);
}

.barcode-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
}

.category-text {
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.attribution-text {
  font-size: 12px;
  color: var(--ion-color-medium);
  margin: 2px 0 12px 0;
}

.section-title {
  margin-bottom: 4px;
  color: var(--ion-color-medium);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  font-size: 10px;
}

/* PREMIUM BADGES */
.premium-badge-wrapper {
  flex-shrink: 0;
}

.premium-badge-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 99px;
  font-weight: 800;
  font-size: 11px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.premium-badge-pill.gold {
  background: #facc15;
  color: #854d0e;
}

.premium-badge-pill.silver {
  background: #94a3b8;
  color: #1e293b;
}

.status-action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  gap: 8px;
}

.official-verified-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--ion-color-medium);
  font-weight: 700;
  font-size: 10px;
  letter-spacing: 0.5px;
}

.tier-gold .official-verified-tag {
  color: #ca8a04;
}

/* TEXT CONTENT */
.description-text {
  font-size: 1.1rem;
  line-height: 1.5;
  font-weight: 500;
  margin-top: 4px;
}

.tier-gold .description-text {
  color: var(--ion-color-dark);
}

.ingredients-list {
  margin: 4px 0 0;
  padding-left: 1.2rem;
  line-height: 1.6;
}

.legend-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

/* RELATED SECTION */
.related-section {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid rgba(var(--ion-color-dark-rgb), 0.08);
}

.product-swiper {
  margin: 0 !important;
  padding: 0 !important;
  width: 100%;
  height: 300px; /* adjust as needed */
  border-radius: 0; /* full edge-to-edge */
}

.ingredient-legend {
  line-height: 1.6;
}

.ingredient-legend .legend-text {
  margin-left: 8px;
  color: var(--ion-color-medium);
}

.fullscreen-swiper,
.fullscreen-swiper .swiper-slide,
.fullscreen-swiper .swiper-zoom-container {
  width: 100%;
  height: 100%;
}

.fullscreen-swiper .swiper-slide {
  display: flex;
  justify-content: center;
  align-items: center;
  background: black;
}

.fullscreen-swiper .swiper-zoom-container {
  display: flex;
  justify-content: center;
  align-items: center;
}

.fullscreen-swiper img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

ion-skeleton-text {
  --background: linear-gradient(90deg, #e0e0e0 25%, #f2f2f2 50%, #e0e0e0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.image-modal-close-btn {
  position: absolute;
  /* account for safe area + header */
  top: calc(env(safe-area-inset-top, 0px) + var(--ion-safe-area-top, 0px) + 56px);
  right: 16px;
  z-index: 9999;
}
/* === Related Items Tier Styling === */
.discover-item {
  border: 1px solid rgba(var(--ion-color-dark-rgb), 0.1);
  transition: all 0.3s ease;
  position: relative;
  --background: var(--ion-card-background, #ffffff);
}

/* GOLD THEME */
.discover-item.tier-gold {
  --border-color: #facc15;
  border: 1.5px solid #facc15;
  --background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
  box-shadow: 0 10px 30px rgba(250, 204, 21, 0.25);
}

/* SILVER THEME */
.discover-item.tier-silver {
  --border-color: #94a3b8;
  border: 1.5px solid #94a3b8;
  --background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  box-shadow: 0 8px 25px rgba(148, 163, 184, 0.15);
}

/* BRONZE THEME */
.discover-item.tier-bronze {
  --border-color: #d97706;
  border: 1.5px solid #d97706;
  --background: linear-gradient(135deg, #fffafb 0%, #fff7ed 100%);
}
@keyframes premium-shine {
  0% { transform: translateX(0); }
  25% { transform: translateX(250%); }
  100% { transform: translateX(250%); }
}

.product-swiper {
  margin: 0 !important;
  padding: 0 !important;
  width: 100%;
  height: 350px;
  border-radius: 0 0 24px 24px;
  overflow: hidden;
  --ion-safe-area-top: 0px; /* Force image to ignore safe area */
}

.product-swiper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.discover-label h3 {
  font-size: 0.95rem;
  font-weight: 700;
  white-space: normal;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 4px 0;
  color: var(--ion-color-dark); /* default: theme-based */
}

/* === GOLD CERTIFICATION BADGE === */
.gold-cert-card {
  position: relative;
  background: linear-gradient(135deg, #fef9c3 0%, #fef3c7 100%);
  border: 1px solid #facc15;
  border-radius: 16px;
  padding: 12px;
  margin-top: 12px;
  box-shadow: 0 4px 12px rgba(250, 204, 21, 0.15);
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  cursor: pointer;
}

.gold-cert-card:active {
  transform: scale(0.98);
}

.gold-cert-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  z-index: 2;
}

.gold-cert-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.gold-cert-logo {
  width: 48px;
  height: 48px;
  object-fit: contain;
  background: white;
  padding: 4px;
  border-radius: 10px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.05);
}

.gold-cert-name {
  font-weight: 700;
  font-size: 1rem;
  color: #854d0e;
}

.premium-verified-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #a16207;
  margin-top: 2px;
}

/* Dark mode overrides */
.ion-palette-dark .gold-cert-card {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%);
  border-color: rgba(250, 204, 21, 0.4);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3), 0 0 10px rgba(250, 204, 21, 0.1);
}

.ion-palette-dark .gold-cert-name {
  color: #fbbf24;
}

.ion-palette-dark .premium-verified-tag {
  color: #fcd34d;
  opacity: 0.9;
}

.ion-palette-dark .gold-cert-logo {
  background: white; /* Keep logo readable */
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

/* Tier-specific product name colors in related list */
.product-name-gold   { color: #ca8a04 !important; }
.product-name-silver { color: #475569 !important; }
.product-name-bronze { color: #b45309 !important; }

/* 🎁 Contribution Modal Styles */
.contribution-modal {
  --height: auto;
  --border-radius: 28px 28px 0 0;
  align-items: flex-end;
}

.contribution-modal .modal-wrapper {
  background: var(--ion-background-color);
  padding: 32px 24px;
  border-radius: 28px 28px 0 0;
}

.contribution-modal .modal-header {
  margin-bottom: 24px;
}

.contribution-modal .icon-circle {
  width: 64px;
  height: 64px;
  background: rgba(var(--ion-color-carrot-rgb), 0.1);
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0 auto 16px;
  font-size: 32px;
  box-shadow: 0 4px 12px rgba(var(--ion-color-carrot-rgb), 0.1);
}

.contribution-modal .modal-title {
  font-weight: 800;
  font-size: 24px;
  margin: 0;
  color: var(--ion-color-step-900);
}

.contribution-modal .main-message {
  font-size: 16px;
  line-height: 1.5;
  color: var(--ion-color-step-700);
  text-align: center;
  margin-bottom: 24px;
}

.contribution-modal .motivation-box {
  background: var(--ion-color-step-50);
  border-radius: 20px;
  padding: 20px;
  text-align: center;
  margin-bottom: 32px;
  border: 1px dashed rgba(var(--ion-color-carrot-rgb), 0.3);
}

.contribution-modal .islamic-ornament {
  font-size: 24px;
  margin-bottom: 8px;
}

.contribution-modal .religious-text {
  font-size: 14px;
  font-style: italic;
  line-height: 1.6;
  color: var(--ion-color-step-600);
  margin: 0;
}

.contribution-modal .modal-footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.contribution-modal .action-btn {
  height: 54px;
  font-weight: 700;
  font-size: 16px;
  --border-radius: 14px;
}
</style>
