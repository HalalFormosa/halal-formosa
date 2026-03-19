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

    <ion-content class="ion-padding">

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


      <ion-card>
        <ion-card-content>
          <!-- Daily Scan Counter -->
          <div class="ion-margin-bottom" v-if="todayScanCount !== null">
            <ion-chip color="primary" style="width: 100%; justify-content: center;">
              <ion-icon :icon="scanOutline"></ion-icon>
              <ion-label>
                {{ $t('scanIngredients.todayScans', {
                used: todayScanCount,
                total: isDonor ? '∞' : 10 + bonusScans
              }) }}
              </ion-label>
            </ion-chip>

            <!-- Watch Ad Button -->
            <ion-button
                v-if="isNative && !isDonor"
                color="warning"
                style="width: 100%; justify-content: center;"
                @click="watchAdForExtraScans"
            >
              🎁 Watch Ad +5 Scans
            </ion-button>
          </div>

          <!-- Tutorial Image Carousel (shows before scanning) -->
          <div v-if="showTutorial" style="text-align:center; margin-bottom:24px;">
            <h2 style="font-size:16px; font-weight:700; color:var(--ion-color-carrot); margin-bottom:12px;">
              🧭 {{ $t('scanIngredients.tips.title') }}
            </h2>

            <swiper
                :modules="[Autoplay, Pagination]"
                :autoplay="{ delay: 5000 }"
                :loop="false"
                :pagination="{ clickable: true }"
                style="width:100%; max-width:340px; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.1);"
            >
              <swiper-slide v-for="n in 5" :key="n" style="display:flex; align-items:center; justify-content:center; background:var(--ion-color-light);">
                <img
                    :src="`/hints/hints${n}.png`"
                    :alt="`Tutorial hint ${n}`"
                    style="max-width:100%; max-height:220px; object-fit:contain; border-radius:8px;"
                />
              </swiper-slide>
            </swiper>

            <div style="margin-top:14px; line-height:1.6;">
              <p>{{ $t('scanIngredients.tips.content') }}</p>
            </div>
          </div>


          <!-- Main Action Buttons -->
          <div v-if="!ingredientsText" style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px;">
            <div style="display: flex; gap: 12px;">
              <!-- Camera Button -->
              <div
                  @click="scanFromCamera"
                  style="flex: 1; background: var(--ion-color-carrot); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer;"
              >
                <ion-icon :icon="cameraOutline" style="font-size: 32px; color: var(--ion-color-light);" />
                <span style="color: var(--ion-color-light); margin-top: 4px; font-size: 14px; font-weight: 500;">{{ $t('scanIngredients.scan.camera') }}</span>
              </div>

              <!-- Gallery Button -->
              <div
                  @click="scanFromGallery"
                  style="flex: 1; background: var(--ion-color-carrot); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer;"
              >
                <ion-icon :icon="cloudUploadOutline" style="font-size: 32px; color: var(--ion-color-light);" />
                <span style="color: var(--ion-color-light); margin-top: 4px; font-size: 14px; font-weight: 500;">{{ $t('scanIngredients.scan.gallery') }}</span>
              </div>
            </div>

            <!-- Auto Scan Button -->
            <div
                @click="router.push('/scan/auto')"
                style="flex: 1; background: var(--ion-color-carrot); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer;"
            >
              <ion-icon :icon="eyeOutline" style="font-size: 32px; color: var(--ion-color-light);" />
              <span style="color: var(--ion-color-light); margin-top: 4px; font-size: 14px; font-weight: 500;">{{ $t('scanIngredients.scan.auto', 'Auto Scan (BETA)') }}</span>
            </div>
          </div>


          <ion-progress-bar
              v-if="ocrLoading"
              type="indeterminate"
              class="ion-margin-top"
          />

          <!-- Original image preview inside Accordion -->
          <ion-accordion-group v-if="originalPreviewUrl">
            <ion-accordion value="original">
              <ion-item slot="header" color="light">
                <ion-label>{{ $t('scanIngredients.scan.originalImage') }}</ion-label>
              </ion-item>
              <div slot="content">
                <img :src="originalPreviewUrl" alt="Original" class="preview-img" />

                <ion-button
                    size="small"
                    class="ion-no-margin"
                    expand="block"
                    @click="recrop"
                >
                  {{ $t('scanIngredients.scan.reCrop') }}
                </ion-button>
              </div>
            </ion-accordion>
          </ion-accordion-group>

          <!-- Cropped image preview -->
          <div v-if="croppedPreviewUrl" class="preview-block ion-margin-top">

            <img :src="croppedPreviewUrl" alt="Cropped" class="preview-img-cropped" />
          </div>

          <!-- Auto status -->
          <ion-chip
              v-if="autoStatus"
              class="ion-margin-top"
              :class="{
    'chip-success': autoStatus === 'Halal',
    'chip-primary': autoStatus === 'Muslim-friendly',
    'chip-warning': autoStatus === 'Syubhah',
    'chip-danger': autoStatus === 'Haram',
    'chip-medium': !['Halal', 'Muslim-friendly', 'Syubhah', 'Haram'].includes(autoStatus)
  }"
          >
            {{ $t(`search.status.${autoStatus}`, autoStatus) }}
          </ion-chip>


          <ion-item class="ion-margin-top">
            <ion-input
                v-model="productName"
                :label="$t('scanIngredients.scan.productName')"
                label-placement="stacked"
                :value="productName || 'Unknown Product'"
                readonly
            />
          </ion-item>

          <div class="ion-margin-top">
            <ion-item
                v-if="detectedLanguage !== 'english' && ingredientsTextZh"
                lines="full"
                class="ion-margin-top"
            >
              <ion-textarea
                  v-model="ingredientsTextZh"
                  :label="$t('scanIngredients.scan.ingredientsZh')"
                  label-placement="stacked"
                  :auto-grow="true"
                  readonly
              />
            </ion-item>

            <ion-item lines="full">
              <ion-textarea
                  v-model="ingredientsText"
                  :label="$t('scanIngredients.scan.ingredientsEn')"
                  label-placement="stacked"
                  :auto-grow="true"
                  readonly
                  @ionBlur="() => recheckHighlightsSmart()"
              />
            </ion-item>

            <!-- Highlights (skip Muslim-Friendly) -->
            <div v-if="ingredientHighlights.some(h => extractIonColor(h.color) !== 'primary')" class="ion-padding-top">
              <ion-chip
                  v-for="(h, idx) in ingredientHighlights.filter(h => extractIonColor(h.color) !== 'primary')"
                  :key="idx"
                  class="ion-margin-end ion-margin-bottom"
                  :class="['chip-' + extractIonColor(h.color)]"
              >
                {{ h.keyword_zh || h.keyword }}
                <template v-if="h.keyword && h.keyword_zh">
                  ({{ toProperCase(h.keyword) }})
                </template>
                — {{ colorMeaning(extractIonColor(h.color)) }}

              </ion-chip>
            </div>

            <!-- Muslim-Friendly Toggle -->
            <div v-if="ingredientHighlights.some(h => extractIonColor(h.color) === 'primary')" class="ion-margin-vertical">
              <ion-button
                  fill="outline"
                  expand="block"
                  size="small"
                  color="primary"
                  @click="showMuslimFriendly = !showMuslimFriendly"
              >
                {{ showMuslimFriendly
                  ? $t('scanIngredients.muslimFriendly.hide')
                  : $t('scanIngredients.muslimFriendly.show')
                }}
              </ion-button>

              <div v-if="showMuslimFriendly" class="ion-padding-top">
                <ion-chip
                    v-for="(h, idx) in ingredientHighlights.filter(h => extractIonColor(h.color) === 'primary')"
                    :key="idx"
                    class="ion-margin-end ion-margin-bottom"
                    :class="['chip-' + extractIonColor(h.color)]"
                >
                  {{ h.keyword_zh || h.keyword }}
                  <template v-if="h.keyword && h.keyword_zh">
                    ({{ toProperCase(h.keyword) }})
                  </template>
                  — {{ colorMeaning(extractIonColor(h.color)) }}
                </ion-chip>
              </div>
            </div>

            <ion-button
                v-if="ingredientsTextZh && !summaryUsed"
                expand="block"
                color="carrot"
                :disabled="loadingSummary"
                @click="handleSummaryClick"
                class="ai-button"
            >
              <ion-icon
                  v-if="!isDonor"
                  slot="start"
                  :icon="lockClosedOutline"
              />

              <span class="ai-label">
    {{ loadingSummary ? 'Analyzing…' : 'AI Explanation' }}
  </span>

              <span
                  v-if="!isDonor"
                  class="pro-pill"
              >
    PRO
  </span>
            </ion-button>



            <p
                v-if="!isDonor && ingredientsTextZh && !summaryUsed"
                style="
    text-align:center;
    font-size:13px;
    margin-top:6px;
    color: var(--ion-color-medium);
  "
            >
              Unlock AI ingredient analysis explanation with Pro ✨
            </p>


            <!-- AI Summary Section -->
            <div v-if="isDonor && (loadingSummary || overallNote || errorSummary)" class="ai-summary-block">
              <h3 class="ai-summary-title">AI Summary</h3>
              <div class="ai-summary-text" v-html="errorSummary || overallNote"></div>
            </div>


            <div v-if="ingredientsText" class="actions">
              <ion-button size="small" fill="outline" @click="onShareClick">
                <ion-icon slot="start" :icon="shareSocialOutline" />
                {{ $t('scanIngredients.scan.share') }}
              </ion-button>
              <ion-button size="small" color="medium" fill="outline" @click="clearAll">
                <ion-icon slot="start" :icon="refreshOutline" /> <!-- optional different icon -->
                {{ $t('scanIngredients.scan.clear') }}
              </ion-button>
            </div>
          </div>
        </ion-card-content>
      </ion-card>

      <!-- Global OCR Loading Overlay (for Auto Scan) -->
      <div v-if="ocrLoading && !showCropper" class="ocr-overlay" style="position: fixed; z-index: 3000;">
        <ion-progress-bar
            :value="progress"
            color="carrot"
            class="ocr-progress"
        />

        <p class="ocr-progress-text">
          {{ progressLabel }}
        </p>

        <div v-if="loadingReflection" class="reflection-box">
          <p v-if="loadingReflection.text_ar" class="reflection-ar">
            {{ loadingReflection.text_ar }}
          </p>

          <p class="reflection-en">
            "{{ loadingReflection.text_en }}"
          </p>

          <small class="reflection-ref">
            — {{ loadingReflection.reference }}
          </small>
        </div>
      </div>

      <!-- Cropper Modal -->
      <ion-modal :is-open="showCropper" @didDismiss="closeCropper">
        <ion-header>
          <ion-toolbar>
            <ion-title>{{ $t('scanIngredients.scan.cropTitle') }}</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="handleConfirmCrop">{{ $t('scanIngredients.scan.done') }}</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>

        <ion-content>
          <cropper
              :key="cropperSrc"
              ref="cropperRef"
              class="cropper"
              :src="cropperSrc"
              :stencil-props="{ aspectRatio: null }"
              @ready="onCropperReady"
          />
          <!-- Full-screen loading overlay inside the cropper modal -->
          <div v-if="ocrLoading" class="ocr-overlay">
            <ion-progress-bar
                :value="progress"
                color="carrot"
                class="ocr-progress"
            />

            <p class="ocr-progress-text">
              {{ progressLabel }}
            </p>

            <div v-if="loadingReflection" class="reflection-box">
              <p v-if="loadingReflection.text_ar" class="reflection-ar">
                {{ loadingReflection.text_ar }}
              </p>

              <p class="reflection-en">
                "{{ loadingReflection.text_en }}"
              </p>

              <small class="reflection-ref">
                — {{ loadingReflection.reference }}
              </small>
            </div>
          </div>
        </ion-content>
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
          message="Daily scan limit reached (10/day)"
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
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage, IonContent, IonButton, IonIcon, IonCard, IonCardContent, IonInput, IonItem,
  IonTextarea, IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonToast,
  IonProgressBar, IonChip, IonLabel, onIonViewWillEnter, IonList, IonAccordionGroup, IonAccordion
} from '@ionic/vue'
import {
  cameraOutline,
  cloudUploadOutline, helpCircleOutline, lockClosedOutline,
  refreshOutline,
  scanOutline,
  shareSocialOutline
} from 'ionicons/icons'
import AppHeader from '@/components/AppHeader.vue'
import {ref, onUnmounted, computed} from 'vue'
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
import { eyeOutline } from 'ionicons/icons'
import { useNotifier } from "@/composables/useNotifier"

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
  progressLabel
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

  return data.length < (10 + bonusScans.value);
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

    } else {
      console.warn('🚫 OCR text found but no ingredient section detected, skipping log')
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
  return todayScanCount.value < (10 + bonusScans.value);
});

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
      }
  } catch (err: any) {
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
ion-card { border-radius: 12px; }
.actions { display: flex; gap: 8px; align-items: center; margin-top: 12px; }

.preview-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.preview-title {
  font-weight: 600;
  opacity: 0.8;
}

.preview-img {
  width: 100%;
  max-height: 320px;
  object-fit: contain;
  margin-bottom: 0;
  box-shadow: 0 1px 6px rgba(0,0,0,0.08);
  background: var(--ion-color-light);
}

.preview-img-cropped {
  width: 100%;
  max-height: 320px;
  object-fit: contain;
  border-radius: 10px;
  box-shadow: 0 1px 6px rgba(0,0,0,0.08);
  background: var(--ion-color-light);
}

.category-item h2 {
  margin: 0 0 4px;
}
.category-item p {
  margin: 0 0 4px;
  font-size: 14px;
}
.category-item small {
  display: block;
  color: var(--ion-color-medium);
  font-size: 13px;
}

.actions {
  display: flex;
  gap: 8px;           /* spacing between buttons */
}

.actions ion-button {
  flex: 1;            /* each button takes equal space */
}

.ai-summary-block {
  margin-top: 10px;
  padding-left: 10px;
  padding-right: 10px;
}

.ai-summary-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
}

.ai-summary-text {
  white-space: pre-wrap;     /* ✅ keeps line breaks from AI response */
  font-size: 16px;
  color: var(--ion-color-dark);
  line-height: 1.5;          /* ✅ improves readability */
  border-radius: 8px;
}

.ai-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: 600;
}

.ai-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.pro-pill {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 999px;
  background: #ffd54f;
  color: #000;
}

/* 🔹 OCR Loading Overlay */
.ocr-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  z-index: 9999;

  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;

  padding: 20px;
  color: white;
}

.ocr-spinner {
  transform: scale(1.4);
}

.reflection-box {
  margin-top: 18px;
  max-width: 320px;
}

.reflection-ar {
  font-size: 18px;
  font-weight: 600;
  line-height: 1.6;
}

.reflection-en {
  font-style: italic;
  margin-top: 10px;
  line-height: 1.5;
}

.reflection-ref {
  opacity: 0.75;
}

.ocr-overlay {
  animation: fadeInOverlay 0.3s ease;
}

@keyframes fadeInOverlay {
  from { opacity: 0; }
  to { opacity: 1; }
}

.ocr-progress {
  width: 240px;
  height: 6px;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.ocr-progress-text {
  font-size: 14px;
  opacity: 0.9;
  margin-top: 8px;
}
</style>
