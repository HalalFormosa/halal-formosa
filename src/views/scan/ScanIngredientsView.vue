<template>
  <ion-page>
    <ion-header>
      <app-header
          :title="$t('scanIngredients.title')"
          :icon="scanOutline"
          :showBack="true"
          backRoute="/home"
      >
        <template #actions>
          <ion-item
              button
              lines="none"
              @click="showDetailedDisclaimer = true"
          >
            <ion-icon slot="start" :icon="helpCircleOutline" />
            <ion-label>{{ $t('scanIngredients.help') }}</ion-label>
          </ion-item>
        </template>
      </app-header>
    </ion-header>

    <ion-content ref="contentRef" class="ion-padding">

      <ion-modal :is-open="showSimpleDisclaimer" backdrop-dismiss="false">
        <ion-header>
          <ion-toolbar>
            <ion-title>{{ $t('scanIngredients.disclaimer.title') }}</ion-title>
          </ion-toolbar>
        </ion-header>

        <ion-content class="ion-padding">
          <p style="margin-bottom: 12px;">
            {{ $t('scanIngredients.disclaimer.message') }}
          </p>

          <blockquote style="font-size: 14px; color: var(--ion-color-success); border-left: 4px solid var(--ion-color-success); padding-left: 8px;">
            <em>
              {{ $t('scanIngredients.disclaimer.verse') }}
            </em> <br />
            <small>{{ $t('scanIngredients.disclaimer.verseRef') }}</small>
          </blockquote>

          <div style="margin-top: 20px; display: flex; flex-direction: column; gap: 12px;">
            <!-- First row: Agree + Learn More -->
            <div style="display: flex; gap: 8px; width: 100%;">
              <ion-button style="flex: 1;" color="carrot" @click="acceptDisclaimer">
                {{ $t('scanIngredients.disclaimer.agree') }}
              </ion-button>
              <ion-button style="flex: 1;" fill="outline" color="medium" @click="showDetails">
                {{ $t('scanIngredients.disclaimer.learnMore') }}
              </ion-button>
            </div>

            <!-- Second row: No want to use -->
            <ion-button expand="block" fill="outline" color="medium" @click="declineDisclaimer">
              {{ $t('scanIngredients.disclaimer.decline') }}
            </ion-button>
          </div>
        </ion-content>
      </ion-modal>

      <ion-modal :is-open="showDetailedDisclaimer" backdrop-dismiss="false">
        <ion-header>
          <ion-toolbar>
            <ion-title>{{ $t('scanIngredients.details.title') }}</ion-title>
          </ion-toolbar>
        </ion-header>

        <ion-content class="ion-padding">
          <p>
            {{ $t('scanIngredients.details.intro') }}
          </p>

          <h3>{{ $t('scanIngredients.details.stepsTitle') }}</h3>
          <ol>
            <li>
              {{ $t('scanIngredients.details.steps.ocr') }}
            </li>
            <li>
              {{ $t('scanIngredients.details.steps.translate') }}
            </li>
            <li>
              {{ $t('scanIngredients.details.steps.match') }}
            </li>
            <li>
              {{ $t('scanIngredients.details.steps.display') }}
            </li>
          </ol>

          <h3>{{ $t('scanIngredients.details.categories.title') }}</h3>
          <ion-list lines="none">
            <ion-item>
              <ion-label>
                <h2 style="color: var(--ion-color-success); font-weight: bold;">{{ $t('scanIngredients.details.categories.halal.label') }}</h2>
                <p>{{ $t('scanIngredients.details.categories.halal.desc') }}</p>
                <small>{{ $t('scanIngredients.details.categories.halal.examples') }}</small>
              </ion-label>
            </ion-item>

            <ion-item>
              <ion-label>
                <h2 style="color: var(--ion-color-primary); font-weight: bold;">
                  {{ $t('scanIngredients.details.categories.muslimFriendly.label') }}
                </h2>
                <p>{{ $t('scanIngredients.details.categories.muslimFriendly.desc') }}</p>
                <small>{{ $t('scanIngredients.details.categories.muslimFriendly.examples') }}</small>
              </ion-label>
            </ion-item>

            <ion-item>
              <ion-label>
                <h2 style="color: var(--ion-color-warning); font-weight: bold;">
                  {{ $t('scanIngredients.details.categories.syubhah.label') }}
                </h2>
                <p>{{ $t('scanIngredients.details.categories.syubhah.desc') }}</p>
                <small>{{ $t('scanIngredients.details.categories.syubhah.examples') }}</small>
              </ion-label>
            </ion-item>

            <ion-item>
              <ion-label>
                <h2 style="color: var(--ion-color-danger); font-weight: bold;">
                  {{ $t('scanIngredients.details.categories.haram.label') }}
                </h2>
                <p>{{ $t('scanIngredients.details.categories.haram.desc') }}</p>
                <small>{{ $t('scanIngredients.details.categories.haram.examples') }}</small>
              </ion-label>
            </ion-item>

          </ion-list>

          <p style="margin-top: 16px;">
            {{ $t('scanIngredients.details.disclaimerNote') }}
          </p>

          <ion-button expand="block" color="carrot" @click="closeDetailedDisclaimer">
            {{ $t('scanIngredients.details.gotIt') }}
          </ion-button>
        </ion-content>
      </ion-modal>


      <!-- 🟢 Step Indicator -->
      <div class="step-container ion-margin-bottom">
        <div class="step-item" :class="{ active: currentStep >= 0 }">
           <div class="step-dot">
              <ion-icon :icon="cameraOutline" v-if="currentStep <= 0" />
              <ion-icon :icon="checkmarkCircle" v-else />
           </div>
           <span class="step-label">1. {{ $t('main.scan') }}</span>
        </div>
        <div class="step-line" :class="{ active: currentStep >= 1 }"></div>
        <div class="step-item" :class="{ active: currentStep >= 1 }">
           <div class="step-dot">
              <ion-icon :icon="sparklesOutline" v-if="currentStep <= 1" />
              <ion-icon :icon="checkmarkCircle" v-else />
           </div>
           <span class="step-label">2. {{ $t('scanIngredients.scan.results') }}</span>
        </div>
      </div>

      <!-- 🔍 STEP 1: Capture -->
      <div v-show="currentStep === STEP_CAPTURE" class="step-content">
        <!-- Daily Scan Counter -->
        <div class="ion-margin-bottom" v-if="todayScanCount !== null">
          <ion-chip color="primary" style="width: 100%; justify-content: center; height: 32px;">
            <ion-icon :icon="scanOutline"></ion-icon>
            <ion-label>
              {{ $t('scanIngredients.todayScans', {
              used: todayScanCount,
              total: isDonor ? '∞' : DAILY_SCAN_LIMIT + bonusScans
            }) }}
            </ion-label>
          </ion-chip>

          <ion-button
              v-if="isNative && !isDonor"
              color="warning"
              expand="block"
              size="small"
              class="ion-margin-top"
              @click="watchAdForExtraScans"
          >
            🎁 Watch Ad +5 Scans
          </ion-button>
        </div>

        <!-- Hero Header -->
        <div class="ion-padding-vertical ion-text-center">
          <div class="hero-icon">🥬</div>
          <h2 class="hero-title">{{ $t('scanIngredients.tips.title') || 'Scan Ingredients' }}</h2>
          <p class="hero-desc">
            {{ $t('scanIngredients.tips.content') || 'Capture the ingredients list to see their halal status in seconds.' }}
          </p>
        </div>

        <!-- Tutorial Hint Carousel -->
        <div v-if="showTutorial" style="text-align:center; margin-bottom:24px;">
          <swiper
              :modules="[Autoplay, Pagination]"
              :autoplay="{ delay: 5000 }"
              :loop="false"
              :pagination="{ clickable: true }"
              style="width:100%; max-width:340px; border-radius:16px; overflow:hidden; box-shadow:0 8px 16px rgba(0,0,0,0.1);"
          >
            <swiper-slide v-for="n in 5" :key="n" style="display:flex; align-items:center; justify-content:center; background:var(--ion-color-light);">
              <img
                  :src="`/hints/hints${n}.png`"
                  :alt="`Tutorial hint ${n}`"
                  style="max-width:100%; max-height:220px; object-fit:contain; border-radius:8px;"
              />
            </swiper-slide>
          </swiper>
        </div>

        <!-- Capture Buttons Card -->
        <ion-card class="action-card ion-no-margin">
          <ion-card-content>
            <ion-button expand="block" color="carrot" style="height: 56px; font-weight: 700;" class="ion-margin-bottom" @click="scanFromCamera">
                <ion-icon slot="start" :icon="cameraOutline" />
                {{ $t('scanIngredients.scan.camera') }}
            </ion-button>
            
            <div style="display: flex; gap: 12px;">
                <ion-button fill="outline" color="carrot" style="flex: 1; height: 48px;" @click="scanFromGallery">
                  <ion-icon slot="start" :icon="cloudUploadOutline" />
                  {{ $t('scanIngredients.scan.gallery') }}
                </ion-button>
                <ion-button fill="outline" color="carrot" style="flex: 1; height: 48px;" @click="router.push('/scan/auto')">
                  <ion-icon slot="start" :icon="eyeOutline" />
                  Auto Scan
                </ion-button>
            </div>
          </ion-card-content>
        </ion-card>
      </div>

      <!-- 🔬 STEP 2: Results -->
      <div v-show="currentStep === STEP_RESULTS" class="step-content">
        <div class="form-section">
          <!-- Cropped Image Preview -->
          <div v-if="croppedPreviewUrl" class="ion-margin-bottom ion-text-center">
            <img :src="croppedPreviewUrl" alt="Cropped" class="preview-img-cropped" />
          </div>

          <!-- Status & Identity -->
          <div class="ion-text-center ion-margin-bottom">
            <div class="status-badge-container">
              <ion-chip
                  v-if="autoStatus"
                  :class="`chip-${statusChipColor(autoStatus)} status-large`"
              >
                {{ $t(`search.status.${autoStatus}`, autoStatus) }}
              </ion-chip>
            </div>
            <h2 style="font-weight: 700; margin-top: 12px; font-size: 22px;">{{ productName || 'Scan Results' }}</h2>
          </div>

          <!-- Results Card -->
          <ion-card class="input-card ion-no-margin">
            <ion-card-content class="ion-no-padding">
              <ion-item v-if="detectedLanguage !== 'english' && ingredientsTextZh" lines="full">
                <ion-textarea
                    v-model="ingredientsTextZh"
                    :label="$t('scanIngredients.scan.ingredientsZh')"
                    label-placement="stacked"
                    :auto-grow="true"
                    readonly
                />
              </ion-item>

              <ion-item lines="none">
                <ion-textarea
                    v-model="ingredientsText"
                    :label="$t('scanIngredients.scan.ingredientsEn')"
                    label-placement="stacked"
                    :auto-grow="true"
                    readonly
                    @ionBlur="() => recheckHighlightsSmart()"
                />
              </ion-item>

              <!-- Highlights -->
              <div v-if="ingredientHighlights.length" class="highlights-preview ion-padding">
                <div class="highlights-title">{{ $t('scanIngredients.scan.highlights') || 'Detected Ingredients' }}</div>
                <div class="chip-group">
                  <ion-chip
                      v-for="(h, idx) in ingredientHighlights.filter(h => extractIonColor(h.color) !== 'primary')"
                      :key="idx"
                      class="compact-chip"
                      :class="['chip-' + extractIonColor(h.color)]"
                  >
                    {{ formatHighlight(h) }}
                  </ion-chip>
                </div>

                <!-- Muslim Friendly Toggle -->
                <div v-if="ingredientHighlights.some(h => extractIonColor(h.color) === 'primary')" class="ion-margin-top">
                  <ion-button fill="clear" size="small" @click="showMuslimFriendly = !showMuslimFriendly" style="font-size: 11px; --padding-start: 0;">
                    {{ showMuslimFriendly ? $t('scanIngredients.muslimFriendly.hide') : $t('scanIngredients.muslimFriendly.show') }}
                  </ion-button>
                  <div v-if="showMuslimFriendly" style="display: flex; flex-wrap: wrap; gap: 4px;">
                     <ion-chip
                        v-for="(h, idx) in ingredientHighlights.filter(h => extractIonColor(h.color) === 'primary')"
                        :key="idx"
                        class="compact-chip chip-primary"
                     >
                       {{ formatHighlight(h) }}
                     </ion-chip>
                  </div>
                </div>
              </div>
            </ion-card-content>
          </ion-card>

          <!-- AI Summary -->
          <div v-if="isDonor && (loadingSummary || overallNote || errorSummary)" class="ai-summary-card animate__animated animate__fadeInUp">
            <h3 class="ai-summary-title">🤖 AI Analysis Summary</h3>
            <div class="ai-summary-text" v-html="errorSummary || overallNote"></div>
          </div>

          <ion-button
              v-if="ingredientsTextZh && !summaryUsed"
              expand="block"
              color="carrot"
              :disabled="loadingSummary"
              @click="handleSummaryClick"
              class="ai-button ion-margin-top"
          >
            <ion-icon v-if="!isDonor" slot="start" :icon="lockClosedOutline" />
            <span>{{ loadingSummary ? 'Analyzing…' : 'Unlock AI Explanation' }}</span>
            <span v-if="!isDonor" class="pro-pill">PRO</span>
          </ion-button>

          <!-- Step 2 Actions -->
          <div class="actions-group ion-margin-top">
            <ion-button fill="outline" color="carrot" style="flex: 1; height: 48px;" @click="onShareClick">
              <ion-icon slot="start" :icon="shareSocialOutline" />
              {{ $t('scanIngredients.scan.share') }}
            </ion-button>
            <ion-button fill="solid" color="carrot" style="flex: 1; height: 48px;" @click="clearAll">
              <ion-icon slot="start" :icon="refreshOutline" />
              {{ $t('scanIngredients.scan.clear') || 'Scan Again' }}
            </ion-button>
          </div>

          <ion-button 
            expand="block" 
            fill="clear" 
            color="primary" 
            class="ion-margin-top"
            @click="goToAddProduct"
            style="font-weight: 600;"
          >
            <ion-icon slot="start" :icon="addCircleOutline" />
            {{ $t('scanIngredients.scan.contribute') }}
          </ion-button>
        </div>
      </div>

      <!-- 🎨 Premium Cropper Modal -->
      <ion-modal :is-open="showCropper" @didDismiss="closeCropper">
        <ion-header>
          <app-header
              :title="$t('scanIngredients.scan.cropTitle')"
              show-back
              :useRouterBack="false"
              @back="closeCropper"
          />
        </ion-header>

        <ion-content :scroll-y="false" class="modal-no-scroll">
          <cropper
              :key="cropperSrc"
              ref="cropperRef"
              class="cropper"
              :src="cropperSrc"
              :transitions="true"
              :stencil-props="{
                aspectRatio: stencilProps.aspectRatio,
                resizable: true,
                movable: true
              }"
              @ready="onCropperReady"
          />
          
          <!-- Full-screen loading overlay inside the cropper modal -->
          <div v-if="ocrLoading" class="ocr-overlay">
            <ion-progress-bar :value="progress" color="carrot" class="ocr-progress" />
            <p class="ocr-progress-text">{{ progressLabel }}</p>

            <div v-if="loadingReflection" class="reflection-box">
              <p v-if="loadingReflection.text_ar" class="reflection-ar">{{ loadingReflection.text_ar }}</p>
              <p class="reflection-en">"{{ loadingReflection.text_en }}"</p>
              <small class="reflection-ref">— {{ loadingReflection.reference }}</small>
            </div>
          </div>
        </ion-content>

        <ion-footer>
          <!-- 🛠️ Ratio Toolbar -->
          <div class="ratio-toolbar ion-padding-horizontal">
            <ion-button 
                v-for="r in [
                    { label: 'Free', value: null, icon: expandOutline },
                    { label: '1:1', value: 1, icon: squareOutline },
                    { label: '3:4', value: 3/4, icon: phonePortraitOutline },
                    { label: '2:1', value: 2, icon: tabletLandscapeOutline },
                ]"
                :key="r.label"
                size="small"
                :fill="stencilProps.aspectRatio === r.value ? 'solid' : 'clear'"
                color="dark"
                @click="changeRatio(r.value)"
                class="ratio-btn"
            >
              <ion-icon slot="start" :icon="r.icon" style="font-size: 14px;" />
              {{ r.label }}
            </ion-button>
          </div>

          <ion-toolbar class="ion-padding">
            <ion-button expand="block" color="carrot" @click="handleConfirmCrop" style="font-weight: 700; height: 48px;">
               {{ $t('scanIngredients.scan.done') }}
            </ion-button>
          </ion-toolbar>
        </ion-footer>
      </ion-modal>

      <!-- Toasts -->
      <ion-toast
          :is-open="showOk"
          :message="$t('scanIngredients.toast.ok')"
          :duration="1600"
          color="success"
          position="bottom"
          @did-dismiss="showOk=false"
      />
      <ion-toast
          :is-open="showErr"
          :message="errorMsg"
          :duration="2200"
          color="danger"
          style="transform: translateY(-6%)"
          position="bottom"
          @did-dismiss="clearError()"
      />
      <ion-toast
          :is-open="showCopied"
          message="Copied to clipboard"
          :duration="1200"
          position="bottom"
          @did-dismiss="showCopied=false"
      />
      <ion-toast
          :is-open="showLimitToast"
          :message="`Daily scan limit reached (${DAILY_SCAN_LIMIT}/day)`"
          :duration="2000"
          color="warning"
          position="bottom"
          @did-dismiss="showLimitToast=false"
      />
      
      <!-- Hidden input for Web Gallery selection to avoid garbage collection drop off -->
      <input 
        type="file" 
        accept="image/*" 
        ref="hiddenWebFileInput" 
        @change="onWebFileSelected" 
        style="display: none;" 
      />
      
      <!-- Hidden input for Web Camera capture -->
      <input 
        type="file" 
        accept="image/*" 
        capture="environment"
        ref="hiddenWebCameraInput" 
        @change="onWebCameraSelected" 
        style="display: none;" 
      />

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
            <i18n-t keypath="scanIngredients.scan.contributionPrompt.message" tag="p" class="main-message">
              <template #name>
                <strong style="color: var(--ion-color-dark);">{{ truncatedProductName }}</strong>
              </template>
              <template #status>
                <span :class="'status-text-' + statusChipColor(autoStatus)">
                  {{ $t(`search.status.${autoStatus}`, autoStatus) }}
                </span>
              </template>
            </i18n-t>

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

      <ion-loading
        :is-open="isMovingToResults"
        :message="$t('scanIngredients.scan.preparingResults')"
        duration="3500"
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage, IonContent, IonButton, IonIcon, IonCard, IonCardContent, IonItem,
  IonTextarea, IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonToast,
  IonProgressBar, IonChip, IonLabel, onIonViewWillEnter, IonList,
  IonFooter, IonLoading
} from '@ionic/vue'
import {
  cameraOutline,
  cloudUploadOutline, 
  helpCircleOutline, 
  lockClosedOutline,
  refreshOutline,
  scanOutline,
  shareSocialOutline,
  barcodeOutline,
  sparklesOutline,
  addOutline,
  checkmarkCircle,
  closeCircle,
  arrowForwardOutline,
  arrowBackOutline,
  checkmarkCircleOutline,
  expandOutline,
  squareOutline,
  phonePortraitOutline,
  tabletLandscapeOutline,
  stopCircle,
  eyeOutline,
  addCircleOutline
} from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import {ref, onUnmounted, computed, nextTick} from 'vue'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Autoplay, Pagination } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/pagination'

import { Cropper } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'

import {Camera, CameraDirection, CameraResultType, CameraSource} from '@capacitor/camera'
import type { PluginListenerHandle } from '@capacitor/core'

import useDisclaimer from "@/composables/useDisclaimer";
import useShareCard from "@/composables/useShareCard";
import useError from '@/composables/useError'
import useHighlightCache from '@/composables/useHighlightCache'
import { extractIonColor, colorMeaning } from '@/utils/ingredientHelpers'
import {BlacklistPattern} from "@/types/Ingredient";
import useAISummary from '@/composables/useAISummary'
import { isDonor } from "@/composables/useSubscriptionStatus";
import { useCropperOcr } from "@/composables/useCropperOcr"
import { Device } from '@capacitor/device'
import { supabase } from '@/plugins/supabaseClient'
import { watch } from 'vue'

import { showRewardedAd } from '@/lib/admobReward'
import { Capacitor } from '@capacitor/core'
import { ActivityLogService } from "@/services/ActivityLogService";

import { RevenueCatUI, PAYWALL_RESULT } from '@revenuecat/purchases-capacitor-ui'
import { refreshSubscriptionStatus } from '@/composables/useSubscriptionStatus'
import { useRouter } from 'vue-router'
import { useAutoScanStore } from '@/composables/useAutoScanStore'
import { useNotifier } from "@/composables/useNotifier"

/** ---------- Constants ---------- */
const DAILY_SCAN_LIMIT = 10

/** ---------- Wizard Steps ---------- */
const STEP_CAPTURE = 0
const STEP_RESULTS = 1
const currentStep = ref(STEP_CAPTURE)
const contentRef = ref<any>(null)

const scrollToTop = () => {
  nextTick(() => {
    contentRef.value?.$el.scrollToTop(300);
  });
}

const nextStep = () => {
  if (currentStep.value < STEP_RESULTS) {
    currentStep.value++
    scrollToTop()
  }
}

const prevStep = () => {
  if (currentStep.value > STEP_CAPTURE) {
    currentStep.value--
    scrollToTop()
  }
}

/** ---------- State ---------- */
const showCopied = ref(false)
const { errorMsg, showErr, setError, clearError } = useError()
const { notifyEvent } = useNotifier()
const showTutorial = ref(true)
const showMuslimFriendly = ref(false)
const showLimitToast = ref(false);
const bonusScans = ref(0)
const isNative = ref(Capacitor.isNativePlatform())
const dailyAdUses = ref(0);

const originalFile = ref<File | null>(null)
const croppedFile = ref<File | null>(null)

const originalPreviewUrl = ref<string | null>(null) // original file preview
const hiddenWebFileInput = ref<HTMLInputElement | null>(null)
const hiddenWebCameraInput = ref<HTMLInputElement | null>(null)

function onWebCameraSelected(e: Event) {
  ActivityLogService.log("scan_ingredients_start", {source: "camera"});
  if (!canScan.value) {
    showLimitToast.value = true;
    return;
  }
  currentSource.value = 'camera'

  const target = e.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const file = target.files[0]
    originalFile.value = file
    if (originalPreviewUrl.value) URL.revokeObjectURL(originalPreviewUrl.value)
    originalPreviewUrl.value = URL.createObjectURL(file)
    showTutorial.value = false
    openCropper(file)
  }
  target.value = '' // Reset
}

function onWebFileSelected(e: Event) {
  ActivityLogService.log("scan_ingredients_start", {source: "gallery"});
  if (!canScan.value) {
    showLimitToast.value = true;
    return;
  }
  currentSource.value = 'gallery'

  const target = e.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const file = target.files[0]
    originalFile.value = file
    if (originalPreviewUrl.value) URL.revokeObjectURL(originalPreviewUrl.value)
    originalPreviewUrl.value = URL.createObjectURL(file)
    showTutorial.value = false
    openCropper(file)
  }
  target.value = '' // Reset so the same file can be picked again
}
const currentSource = ref<'camera' | 'gallery' | null>(null)
const ocrStartTime = ref<number | null>(null)
// @ts-expect-error – injected global
const appVersion = __APP_VERSION__;
const todayScanCount = ref(0)
const loadingReflection = ref<any>(null)
const scanMode = ref<'manual' | 'auto'>('manual')

const router = useRouter()
const { autoScanResult, clearResult } = useAutoScanStore()

const isMovingToResults = ref(false)

const truncatedProductName = computed(() => {
  if (!productName.value) return ''
  const max = 60
  return productName.value.length > max 
    ? productName.value.substring(0, max) + '...' 
    : productName.value
})

const showContributionPrompt = ref(false)
const checkingExistence = ref(false)

async function checkProductExistence(name: string) {
  if (!name || name === 'Unknown' || name === 'Scan Results') return false
  checkingExistence.value = true
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id')
      .ilike('name', `%${name}%`)
      .limit(1)
    
    if (error) throw error
    return data && data.length > 0
  } catch (err) {
    console.error("❌ Failed to check product existence:", err)
    return true // Assume exists on error to avoid false positives
  } finally {
    checkingExistence.value = false
  }
}

// Watch for Auto Scan results returned via the store
watch(autoScanResult, (newResult) => {
  if (newResult) {
    handleAutoDetected(newResult)
    clearResult()
  }
})

// Clear results when switching modes so the camera/buttons show up
watch(scanMode, () => {
  clearAll()
})

const statusChipColor = (status: string) => {
   switch(status) {
     case 'Halal': return 'success'
     case 'Muslim-friendly': return 'primary'
     case 'Syubhah': return 'warning'
     case 'Haram': return 'danger'
     default: return 'medium'
   }
}

/** ---------- Show the Disclaimer of Usage ---------- */

const {
  showSimpleDisclaimer,
  showDetailedDisclaimer,
  maybeShowDisclaimer,
  showDetails,
  acceptDisclaimer,
  closeDetailedDisclaimer,
  declineDisclaimer,
} = useDisclaimer()

/** ---------- Boot: fetch highlight data ---------- */
let resumeHandle: PluginListenerHandle | null = null

const {
  allHighlights,
  blacklistPatterns,
  fetchHighlightsWithCache,
  incrementUsageCount
} = useHighlightCache()

/** ---------- Cropper OCR pipeline ---------- */
const {
  reset,
  cropperRef,
  cropperSrc,
  showCropper,
  croppedPreviewUrl,
  ocrLoading,
  openCropper,
  onCropperReady,
  autoProcess,
  confirmCrop,
  closeCropper,
  recrop,
  showOk,
  ingredientHighlights,
  ingredientsText,
  ingredientsTextZh,
  autoStatus,
  productName,
  ocrRaw,
  recheckHighlightsSmart,
  detectedLanguage,
  progress,
  progressLabel,
  stencilProps,
  setAspectRatio
} = useCropperOcr({
  allHighlights,
  blacklistPatterns,
  fetchHighlightsWithCache,
  incrementUsageCount,
  setError,
})

/** ---------- Log Scan ------------ */
async function logIngredientScan({
                                   source,
                                   errorMessage = null,
                                   startTime = null
                                 }: {
  source: 'camera' | 'gallery'
  errorMessage?: string | null
  startTime?: number | null
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return console.warn('⏩ No user logged in, skipping log');

    const success = !!ingredientsTextZh.value?.trim() || !!ingredientsText.value?.trim();

    const duration = startTime ? Date.now() - startTime : null;
    const info = await Device.getInfo();
    const { model, platform } = info;

    const { error } = await supabase.from('ingredient_scan_logs').insert([
      {
        user_id: user.id,
        product_name: productName.value || 'Unknown Product',
        ingredients_text_zh: ingredientsTextZh.value,
        ingredients_text_en: ingredientsText.value,
        ocr_raw: ocrRaw.value,
        auto_status: autoStatus.value,
        highlight_summary: ingredientHighlights.value,
        source,
        error_message: errorMessage,
        success,
        app_version: appVersion,
        processing_time_ms: duration,
        device_model: model,
        platform
      }
    ]);

    if (error) console.error('❌ Log insert failed:', error);
    else console.log(errorMessage ? '⚠️ Logged failed scan' : '✅ Logged successful scan');
  } catch (err) {
    console.error('Error logging scan:', err);
  }
}

/** ---------- Daily scan ------------*/
async function loadTodayScanCount() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    todayScanCount.value = 0;
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
      .from('ingredient_scan_logs')
      .select('id')
      .eq('user_id', user.id)
      .eq('success', true)       // 👈 ONLY count successful scans
      .gte('created_at', today.toISOString());

  if (error) {
    console.error("Failed to load daily scan count:", error);
    todayScanCount.value = 0;
    return;
  }

  todayScanCount.value = data.length;
}

async function checkDailyScanLimit() {
  // Donors → unlimited scans
  if (isDonor.value) return true;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return true;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
      .from('ingredient_scan_logs')
      .select('id')
      .eq('user_id', user.id)
      .eq('success', true)
      .gte('created_at', today.toISOString());

  if (error) {
    console.error("Daily scan check error:", error);
    return true;   // fail-open instead of blocking users
  }

  return data.length < (DAILY_SCAN_LIMIT + bonusScans.value);
}
// Gallery


function calculateReadingTime(text: string) {
  const words = text.trim().split(/\s+/).length
  const wordsPerSecond = 3.2
  const ms = (words / wordsPerSecond) * 1000
  return Math.min(4000, Math.max(2500, ms))
}

const summaryUsed = ref(false)

/** ---------- AI Summary ---------- */
const {
  overallNote,
  loadingSummary,
  errorSummary,
  generateSummary
} = useAISummary()

async function presentPaywall(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    console.warn("[RC] Paywall can only run on native.");
    return false;
  }
  try {
    const resultParams = await RevenueCatUI.presentPaywall()
    const paywallResult = resultParams.result || (resultParams as any)
    switch (paywallResult) {
      case PAYWALL_RESULT.PURCHASED:
      case PAYWALL_RESULT.RESTORED:
        await refreshSubscriptionStatus()
        await ActivityLogService.log("pro_purchase_success", { source: "ai_summary" })

        const { data: { user } } = await supabase.auth.getUser();
        await notifyEvent(
          'pro_purchase_success',
          '💎 New Pro Member!',
          `User ${user?.email ?? 'unknown'} has just subscribed to Halal Formosa Pro!`,
          undefined,
          {
            source: 'scan_ingredients_view',
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

async function handleSummaryClick() {
  await ActivityLogService.log("ai_summary_click", {
    is_pro: isDonor.value
  })

  // 🚫 If not Pro → show paywall
  if (!isDonor.value) {
    await ActivityLogService.log("pro_paywall_trigger", {
      source: "ai_summary"
    })
    const purchased = await presentPaywall()
    if (!purchased) return
    // 🔁 Yield small delay for subscription reactive update
    await new Promise(r => setTimeout(r, 300))
  }

  // 🟢 Now user is Pro
  if (summaryUsed.value) return

  await ActivityLogService.log("ai_summary_used", {
    auto_status: autoStatus.value,
    ingredient_count: ingredientHighlights.value?.length ?? 0
  })

  await generateSummary(
      ingredientsTextZh.value,
      ingredientHighlights.value,
      autoStatus.value
  )

  summaryUsed.value = true
}

function toProperCase(str: string) {
  return str.replace(/\w\S*/g, (txt) =>
      txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
  )
}

function clearAll() {
  reset()
  originalFile.value = null
  croppedFile.value = null
  overallNote.value = ''
  summaryUsed.value = false
  showTutorial.value = true
  currentStep.value = STEP_CAPTURE
  scrollToTop()
}

async function watchAdForExtraScans() {
  if (dailyAdUses.value >= 2) {
    showErr.value = true;
    errorMsg.value = "You can only watch 2 ads per day.";
    return;
  }

  await showRewardedAd("ca-app-pub-9588373061537955/8695189722", async () => {
    bonusScans.value += 5;
    dailyAdUses.value += 1;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
          .from("user_scan_bonus")
          .upsert({
            user_id: user.id,
            bonus_scans: bonusScans.value,
            daily_ad_uses: dailyAdUses.value,
            last_updated: new Date().toISOString().split("T")[0]
          });
    }
    await loadTodayScanCount();
  });
}
/** ---------- Share card ------------*/
const { shareResult } = useShareCard(
    productName,
    ingredientsText,
    autoStatus,
    ingredientHighlights, ingredientsTextZh
)

function onShareClick() {
  shareResult(originalFile)
}

async function fetchRandomReflection() {
  const { data, error } = await supabase
      .from('loading_reflections')
      .select('*')
      .eq('is_active', true)

  if (error || !data?.length) return

  loadingReflection.value =
      data[Math.floor(Math.random() * data.length)]
}

async function handleConfirmCrop() {
  try {
    ocrStartTime.value = Date.now()

    await fetchRandomReflection()

    const reflectionStart = Date.now()

    await confirmCrop()
    isMovingToResults.value = true // ⚡ Show transition loader immediately after OCR finishes

    // 🕊 Ensure reflection shown minimum 3 seconds
    const reflectionElapsed = Date.now() - reflectionStart

    const minReflectionTime = calculateReadingTime(
        loadingReflection.value?.text_en || ''
    )

    if (reflectionElapsed < minReflectionTime) {
      showTutorial.value = false

      await new Promise(r =>
          setTimeout(r, minReflectionTime - reflectionElapsed)
      )
    }

    showOk.value = true

    // Only log if ingredients were detected
    if (ingredientsText.value?.trim()) {
      // Logic moved up to handleConfirmCrop level


      await ActivityLogService.log("scan_ingredients_success", {
        product_name: productName.value || "Unknown",
        auto_status: autoStatus.value,
        ingredient_count: ingredientHighlights.value?.length ?? 0,
      });

      await logIngredientScan({
        source: currentSource.value || 'camera',
        startTime: ocrStartTime.value
      })




      await loadTodayScanCount()
      isMovingToResults.value = false
      nextStep()

      // 🔍 Proactively check if product exists in database by name
      if (productName.value) {
        checkProductExistence(productName.value).then(exists => {
          if (!exists) {
            console.log("🕵️‍♂️ Product not found in DB, showing contribution prompt")
            setTimeout(() => {
              showContributionPrompt.value = true
            }, 1000) // Show after result transition
          }
        })
      }

    } else {
      console.warn('🚫 OCR text found but no ingredient section detected, skipping log')
      setError('No ingredients detected. Please try cropping more closely.')
    }

  } catch (err: any) {

    setError(err.message || 'OCR failed')

    await ActivityLogService.log("scan_ingredients_error", {
      error: err.message || "OCR failed",
      source: currentSource.value
    });

    await logIngredientScan({
      source: currentSource.value || 'camera',
      errorMessage: err.message || 'OCR failed',
      startTime: ocrStartTime.value
    })

    await loadTodayScanCount()
  }
}


const canScan = computed(() => {
  if (isDonor.value) return true;
  return todayScanCount.value < (DAILY_SCAN_LIMIT + bonusScans.value);
});

function changeRatio(ratio: number | null) {
  setAspectRatio(ratio)
}

function formatHighlight(h: any) {
  if (h.keyword_zh && h.keyword && h.keyword_zh.trim().toLowerCase() !== h.keyword.trim().toLowerCase()) {
    return `${h.keyword_zh} (${h.keyword})`;
  }
  return h.keyword_zh || h.keyword;
}

function goToAddProduct() {
  const imageUrl = originalFile.value ? URL.createObjectURL(originalFile.value) : null;

  router.push({
    path: '/add',
    query: {
      fromScan: 'true',
      name: productName.value,
      ingredients: ingredientsText.value || ingredientsTextZh.value,
      status: autoStatus.value,
      image: imageUrl,
      analysis: JSON.stringify(ingredientHighlights.value),
      rawOcr: ingredientsTextZh.value
    }
  })
}

/** ---------- UI actions ---------- */
function scanFromCamera() {
  ActivityLogService.log("scan_ingredients_start", {source: "camera"});

  if (!canScan.value) {
    showLimitToast.value = true;
    return;
  }

  currentSource.value = 'camera'
  
  if (Capacitor.isNativePlatform()) {
    Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      direction: CameraDirection.Rear
    }).then(async (image) => {
      if (image.webPath) {
        if (originalPreviewUrl.value) URL.revokeObjectURL(originalPreviewUrl.value)
        originalPreviewUrl.value = image.webPath
        
        const blob = await fetch(image.webPath).then(r => r.blob())
        const file = new File([blob], `ingredients-${Date.now()}.jpg`, { type: 'image/jpeg' })
        originalFile.value = file
        
        showTutorial.value = false
        openCropper(file)
      }
    }).catch((err) => {
      console.warn('Camera failed:', err)
      if (err.message !== 'User cancelled photos app' && !err.message?.includes('cancelled')) {
        setError(err.message || 'Could not access camera')
      }
    });
  } else {
    // Web: Use hidden input attached to template to prevent Safari garbage collection
    hiddenWebCameraInput.value?.click()
  }
}

function scanFromGallery() {
  ActivityLogService.log("scan_ingredients_start", {source: "gallery"});

  if (!canScan.value) {
    showLimitToast.value = true;
    return;
  }

  currentSource.value = 'gallery'

  if (Capacitor.isNativePlatform()) {
    Camera.getPhoto({
      quality: 90,
      resultType: CameraResultType.Uri,
      source: CameraSource.Photos
    }).then(async (image) => {
      if (image.webPath) {
        if (originalPreviewUrl.value) URL.revokeObjectURL(originalPreviewUrl.value)
        originalPreviewUrl.value = image.webPath
        const blob = await fetch(image.webPath).then(r => r.blob())
        const file = new File([blob], `gallery-ingredients-${Date.now()}.jpg`, { type: 'image/jpeg' })
        originalFile.value = file
        showTutorial.value = false
        openCropper(file)
      }
    }).catch(err => console.warn('Gallery failed:', err));
  } else {
    // Web: Use hidden input attached to template to prevent Safari garbage collection
    hiddenWebFileInput.value?.click()
  }
}

/** ---------- Auto Scan Handler ---------- */
async function handleAutoDetected(result: any) {
  console.log('⚡ [ScanIngredients] handleAutoDetected received:', { 
    hasBlob: !!result.blob, 
    hasRoi: !!result.roi,
    roi: result.roi 
  })
  
  const { blob, roi } = result
  scanMode.value = 'manual' // Close the full-screen scanner UI
  
  const allowed = await checkDailyScanLimit()
  if (!allowed) {
    showLimitToast.value = true
    return
  }

  currentSource.value = 'camera'
  const file = new File([blob], `auto-ingredients-${Date.now()}.jpg`, { type: 'image/jpeg' })
  originalFile.value = file
  
  // Set the preview URL for the main view
  if (originalPreviewUrl.value) URL.revokeObjectURL(originalPreviewUrl.value)
  originalPreviewUrl.value = URL.createObjectURL(file)
  
  showTutorial.value = false
  
  // ⚡ Skip the manual cropper modal and process immediately
  ocrStartTime.value = Date.now()
  await fetchRandomReflection()
  const reflectionStart = Date.now()
  
  await ActivityLogService.log("scan_ingredients_start", {source: "auto_scan"});

  try {
      await autoProcess(file, roi)
      isMovingToResults.value = true // ⚡ Show transition loader immediately
      
      const reflectionElapsed = Date.now() - reflectionStart
      const minReflectionTime = calculateReadingTime(loadingReflection.value?.text_en || '')
      if (reflectionElapsed < minReflectionTime) {
         showTutorial.value = false
         await new Promise(r => setTimeout(r, minReflectionTime - reflectionElapsed))
      }
      
      if (ingredientsText.value?.trim() || ingredientsTextZh.value?.trim()) {
          await ActivityLogService.log("scan_ingredients_success", {
            product_name: productName.value || "Unknown",
            auto_status: autoStatus.value,
            ingredient_count: ingredientHighlights.value?.length ?? 0,
            source: "auto_scan"
          });

          await logIngredientScan({
            source: "camera",
            startTime: ocrStartTime.value
          })

          await loadTodayScanCount()
          isMovingToResults.value = false
          nextStep()
      }
  } catch (err: any) {
      isMovingToResults.value = false
      setError(err.message || 'Auto OCR failed')

      await ActivityLogService.log("scan_ingredients_error", {
        error: err.message || "Auto OCR failed",
        source: "auto_scan"
      });

      await logIngredientScan({
        source: "camera",
        errorMessage: err.message || 'Auto OCR failed',
        startTime: ocrStartTime.value
      })

      await loadTodayScanCount()
  }
}

/** ---------- Lifecycle  ---------- */

async function restoreBonusFromSupabase() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
      .from("user_scan_bonus")
      .select("*")
      .eq("user_id", user.id)
      .single();

  if (error || !data) {
    // First time user → create row
    bonusScans.value = 0;
    dailyAdUses.value = 0;

    await supabase.from("user_scan_bonus").insert({
      user_id: user.id,
      bonus_scans: 0,
      daily_ad_uses: 0,
      last_updated: today
    });

    return;
  }

  // If the record is from today → use it
  if (data.last_updated === today) {
    bonusScans.value = data.bonus_scans;
    dailyAdUses.value = data.daily_ad_uses;
    return;
  }

  // If it's from yesterday → reset
  bonusScans.value = 0;
  dailyAdUses.value = 0;

  await supabase
      .from("user_scan_bonus")
      .update({
        bonus_scans: 0,
        daily_ad_uses: 0,
        last_updated: today
      })
      .eq("user_id", user.id);
}

onIonViewWillEnter(async () => {
  if (maybeShowDisclaimer()) return

  await loadTodayScanCount();
  await restoreBonusFromSupabase();

  const data = await fetchHighlightsWithCache()
  if (!data) {
    console.warn('No cache and no internet — highlight system will be empty.')
    return
  }

  allHighlights.value = data.highlights
  blacklistPatterns.value = data.blacklist.map(
      (row: BlacklistPattern) => new RegExp(row.pattern, 'gi')
  )
})

onUnmounted(() => {
  resumeHandle?.remove()
  resumeHandle = null
  if (originalPreviewUrl.value) URL.revokeObjectURL(originalPreviewUrl.value)
  if (croppedPreviewUrl.value) URL.revokeObjectURL(croppedPreviewUrl.value)
})

/** ---------- Utility actions ---------- */


</script>

<style scoped>
/* 🟢 Stepper UI */
.step-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: var(--ion-color-light);
  border-radius: 16px;
  margin-top: 8px;
}

.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex: 1;
  opacity: 0.4;
  transition: all 0.3s ease;
}

.step-item.active {
  opacity: 1;
}

.step-dot {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--ion-color-step-150);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ion-color-step-500);
  font-size: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.active .step-dot {
  background: var(--ion-color-carrot);
  color: white;
}

.step-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--ion-color-step-600);
}

.active .step-label {
  color: var(--ion-color-carrot);
}

.step-line {
  flex: 0.5;
  height: 2px;
  background: var(--ion-color-step-300);
  margin-bottom: 20px; /* Offset for labels */
}

.step-line.active {
  background: var(--ion-color-carrot);
}

/* 🔍 Content Layout */
.step-content {
  padding-top: 8px;
  animation: fadeInStep 0.3s ease;
}

@keyframes fadeInStep {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

.hero-icon { font-size: 48px; margin-bottom: 12px; }
.hero-title { font-weight: 800; font-size: 24px; margin-bottom: 8px; }
.hero-desc { color: var(--ion-color-step-600); line-height: 1.5; margin-bottom: 16px; }

.action-card {
  border-radius: 20px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
  border: 1px solid var(--ion-color-step-100);
}

/* 🔬 Results UI */
.status-badge-container {
  display: flex;
  justify-content: center;
  margin-top: 8px;
}

.status-large {
  font-size: 16px;
  font-weight: 800;
  height: 36px;
  padding: 0 20px;
  border-radius: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.input-card {
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}

.highlights-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--ion-color-step-600);
  margin-bottom: 12px;
}

.chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.compact-chip {
  font-weight: 600;
  font-size: 13px;
  height: 28px;
}

/* 🤖 AI Summary Card */
.ai-summary-card {
  margin-top: 20px;
  background: linear-gradient(135deg, #fef9e7 0%, #fdf2d0 100%);
  border-radius: 16px;
  padding: 16px;
  border: 1px solid #f9e79f;
}

.ai-summary-title {
  font-size: 16px;
  font-weight: 700;
  color: #7d6608;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.ai-summary-text {
  font-size: 15px;
  line-height: 1.6;
  color: #4d452d;
  white-space: pre-wrap;
}

.actions-group {
  display: flex;
  gap: 12px;
}

.preview-img-cropped {
  width: 100%;
  max-height: 300px;
  object-fit: contain;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  background: #f4f4f4;
}

/* 🔹 OCR Loading Overlay */
.ocr-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 30px;
  color: white;
  text-align: center;
}

.ocr-progress {
  width: 100%;
  max-width: 260px;
  height: 8px;
  border-radius: 10px;
}

.ocr-progress-text {
  margin-top: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.reflection-box {
  margin-top: 24px;
  max-width: 300px;
}

.reflection-ar {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 12px;
  line-height: 1.4;
}

.reflection-en {
  font-size: 15px;
  font-style: italic;
  line-height: 1.5;
  opacity: 0.9;
}

.reflection-ref {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  opacity: 0.6;
}

.pro-pill {
  font-size: 10px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 6px;
  background: #ffd54f;
  color: #000;
  margin-left: 8px;
}

.ai-button {
  height: 52px;
  font-weight: 700;
  --border-radius: 12px;
}

/* ⚙️ Ratio Toolbar */
.ratio-toolbar {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  background: var(--ion-color-step-50);
  border-top: 1px solid var(--ion-color-step-150);
  padding: 8px 4px;
}

.ratio-btn {
  margin: 0;
  --padding-start: 8px;
  --padding-end: 8px;
  font-size: 11px;
  font-weight: 700;
  height: 32px;
}

.modal-no-scroll {
  --overflow: hidden;
}

.cropper {
  height: 100%;
  background: black;
}

/* 🎁 Contribution Modal Styles */
.contribution-modal {
  --height: auto;
  --border-radius: 28px 28px 0 0;
  align-items: flex-end;
}

.modal-wrapper {
  background: white;
  padding: 32px 24px;
}

.modal-header {
  margin-bottom: 24px;
}

.icon-circle {
  width: 64px;
  height: 64px;
  background: #fff8f1;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0 auto 16px;
  font-size: 32px;
  box-shadow: 0 4px 12px rgba(237, 133, 41, 0.1);
}

.modal-title {
  font-weight: 800;
  font-size: 24px;
  margin: 0;
  color: var(--ion-color-step-900);
}

.main-message {
  font-size: 16px;
  line-height: 1.5;
  color: var(--ion-color-step-700);
  text-align: center;
  margin-bottom: 24px;
}

.motivation-box {
  background: linear-gradient(135deg, #fdfcfb 0%, #e2d1c3 100%);
  border-radius: 20px;
  padding: 20px;
  text-align: center;
  margin-bottom: 32px;
  border: 1px dashed rgba(237, 133, 41, 0.3);
}

.islamic-ornament {
  font-size: 24px;
  margin-bottom: 8px;
}

.religious-text {
  font-size: 14px;
  font-style: italic;
  line-height: 1.6;
  color: #5d4037;
  margin: 0;
}

.modal-footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-btn {
  height: 54px;
  font-weight: 700;
  font-size: 16px;
  --border-radius: 14px;
}

/* 🎨 Status Text Colors for Modal */
.status-text-success { color: var(--ion-color-success); font-weight: 700; }
.status-text-primary { color: var(--ion-color-primary); font-weight: 700; }
.status-text-warning { color: var(--ion-color-warning); font-weight: 700; }
.status-text-danger  { color: var(--ion-color-danger);  font-weight: 700; }
.status-text-medium  { color: var(--ion-color-medium);  font-weight: 700; }
</style>
