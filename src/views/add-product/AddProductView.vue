<template>
  <ion-page>
    <ion-header>
      <app-header
          :title="props.editProduct ? $t('addProduct.editTitle') : $t('addProduct.title')"
          :icon="addOutline"
          :showProfile="true"
          show-back
          :useRouterBack="false"
          @back="handleBack"
      />
    </ion-header>

    <ion-content class="ion-padding" >
      <ion-modal :is-open="showCropper" @didDismiss="closeCropper">
        <ion-header>
          <ion-toolbar>
            <ion-title>{{ $t('addProduct.cropIngredients') }}</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="confirmCrop">{{ $t('addProduct.done') }}</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>

        <ion-content>
          <cropper
              ref="cropperRef"
              class="cropper"
              :src="cropperSrc"
              :stencil-props="{ aspectRatio: null }"
          />
          <div v-if="ocrLoading" class="ion-text-center ion-padding">
            <ion-spinner name="crescent" color="primary"></ion-spinner>
            <p>{{ $t('addProduct.processingOcr') }}</p>
          </div>
        </ion-content>
      </ion-modal>
      <form @submit.prevent="handleSubmit">
        <div class="form-container">
          <ion-item-group>
            <ion-item :class="{ 'barcode-valid': barcodeValid === true, 'barcode-invalid': barcodeValid === false }">
              <ion-input
                  ref="barcodeInput"
                  v-model="form.barcode"
                  required
                  type="tel"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  :maxlength="14"
                  :minlength="8"
                  clear-input
                  label-placement="floating"
                  :placeholder="$t('addProduct.barcodePlaceholder')"
              >
                <div slot="label">
                  {{ $t('addProduct.barcode') }} <ion-text color="danger">*</ion-text>
                </div>
              </ion-input>

              <ion-icon
                  v-if="barcodeValid !== null"
                  :icon="barcodeValid ? checkmarkCircle : closeCircle"
                  :color="barcodeValid ? 'success' : 'danger'"
                  slot="end"
                  style="font-size: 20px;"
              />
              <ion-button
                  color="carrot"
                  slot="end"
                  size="default"
                  @click="startBarcodeScan"
              >
                <ion-icon :icon="scanning ? stopCircle : barcodeOutline" />
              </ion-button>
            </ion-item>

            <!-- 🟢 message shown here -->
            <ion-note v-if="barcodeMessage" :color="barcodeValid ? 'success' : 'danger'" class="ion-padding-start">
              {{ barcodeMessage }}
            </ion-note>

            <!-- 🟣 Detected Product Preview -->
            <ion-item
                v-if="detectedProduct"
                lines="none"
                class="detected-product"
            >
              <ion-thumbnail slot="start">
                <ion-img
                    :src="detectedProduct.photo_front_url || '/placeholder-product.png'"
                />
              </ion-thumbnail>

              <ion-label>
                <h3>{{ detectedProduct.name }}</h3>
                <ion-chip
                    size="small"
                    :class="`chip-${statusChipColor(detectedProduct.status)}`"
                >
                  {{ detectedProduct.status }}
                </ion-chip>



              </ion-label>
            </ion-item>


            <div v-if="scanning && cameras.length > 1" class="ion-padding">
              <ion-item>
                <ion-label>Camera</ion-label>
                <ion-select v-model="selectedCameraId" @ionChange="switchCamera($event.detail.value)">
                  <ion-select-option v-for="cam in cameras" :key="cam.id" :value="cam.id">
                    {{ cam.label }}
                  </ion-select-option>
                </ion-select>
              </ion-item>
            </div>


            <div v-if="scanning && !Capacitor.isNativePlatform()" id="reader"></div>

            <ion-item>
              <ion-input
                  v-model="form.name"
                  required
                  clear-input
                  label-placement="floating"
                  :placeholder="$t('addProduct.productNamePlaceholder')"
                  @input="onProductNameInput"
              >
                <div slot="label">
                  {{ $t('addProduct.productName') }} <ion-text color="danger">*</ion-text>
                </div>
              </ion-input>
            </ion-item>

            <ion-item>
              <ion-select v-model="form.status" interface="popover" required>
                <div slot="label">{{ $t('addProduct.status') }} <ion-text color="danger">*</ion-text></div>
                <ion-select-option value="Halal">{{ $t('addProduct.halal') }}</ion-select-option>
                <ion-select-option value="Muslim-friendly">{{ $t('addProduct.muslimFriendly') }}</ion-select-option>
                <ion-select-option value="Syubhah">{{ $t('addProduct.syubhah') }}</ion-select-option>
                <ion-select-option value="Haram">{{ $t('addProduct.haram') }}</ion-select-option>
              </ion-select>
            </ion-item>

            <ion-item>
              <ion-select v-model.number="form.product_category_id" interface="alert" required>
                <div slot="label">{{ $t('addProduct.category') }} <ion-text color="danger">*</ion-text></div>
                <ion-select-option v-for="cat in categories" :key="cat.id" :value="cat.id">
                  {{ cat.name }}
                </ion-select-option>
              </ion-select>
            </ion-item>

            <ion-item>
              <ion-textarea
                  v-model="form.ingredients"
                  label-placement="floating"
                  :placeholder="$t('addProduct.ingredientsPlaceholder')"
                  :auto-grow="true"
                  @input="handleIngredientsInput"
                  @blur="recheckHighlights"
                  required
              >
                <div slot="label">
                  {{ $t('addProduct.ingredients') }} <ion-text color="danger">*</ion-text>
                </div>
              </ion-textarea>
              <ion-buttons slot="end">
                <ion-button @click="scanIngredientsWithCamera" :disabled="ocrLoading">
                  <ion-icon :icon="cameraOutline" />
                </ion-button>
                <ion-button @click="scanIngredientsFromGallery" :disabled="ocrLoading">
                  <ion-icon :icon="cloudUploadOutline" />
                </ion-button>
              </ion-buttons>
            </ion-item>

            <ion-accordion-group v-if="rawChineseOcr" class="ion-margin-top ion-margin-horizontal">
              <ion-accordion value="rawOcr">
                <ion-item slot="header" style="background-color: transparent">
                  <ion-label>{{ $t('addProduct.detectedText') }}</ion-label>
                </ion-item>
                <div slot="content">
                  <ion-textarea
                      v-model="rawChineseOcr"
                      readonly
                      style="width: 100%; background: var(--ion-background-color-step-50); border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; padding: 8px; --padding: 8px; min-height: 100px;"
                  ></ion-textarea>
                </div>
              </ion-accordion>
            </ion-accordion-group>

            <ion-progress-bar
                v-if="ocrLoading"
                type="indeterminate"
                color="primary"
                style="margin-top: 10px;"
            ></ion-progress-bar>

            <ion-progress-bar
                v-if="checkingIngredients"
                type="indeterminate"
                color="primary"
            />

            <!-- ⭐ Highlighted Ingredients (excluding Muslim-friendly by default) -->
            <div v-if="ingredientHighlights.length" class="ion-padding-horizontal ion-margin-top">

              <!-- 🔥 Show Halal-sensitive highlights (warning/danger) -->
              <ion-chip
                  v-for="(h, idx) in ingredientHighlights.filter(h => extractIonColor(h.color) !== 'primary')"
                  :key="idx"
                  class="ion-margin-end ion-margin-bottom"
                  :class="['chip-' + extractIonColor(h.color)]"
              >
                {{ h.keyword }}
                <template v-if="h.matchedVariant">({{ h.matchedVariant }})</template>
                — {{ colorMeaning(extractIonColor(h.color)) }}
              </ion-chip>

              <!-- 🌿 Toggle Muslim-friendly -->
              <div v-if="ingredientHighlights.some(h => extractIonColor(h.color) === 'primary')" class="ion-margin-top">

                <ion-button
                    fill="outline"
                    expand="block"
                    size="small"
                    color="primary"
                    @click="showMuslimFriendly = !showMuslimFriendly"
                >
                  {{ showMuslimFriendly ? 'Hide Muslim-Friendly Ingredients' : 'Show Muslim-Friendly Ingredients' }}
                </ion-button>

                <!-- 🌿 Muslim-friendly ingredients appear only when toggled -->
                <div v-if="showMuslimFriendly" class="ion-padding-top">
                  <ion-chip
                      v-for="(h, idx) in ingredientHighlights.filter(h => extractIonColor(h.color) === 'primary')"
                      :key="idx"
                      class="ion-margin-end ion-margin-bottom"
                      :class="['chip-' + extractIonColor(h.color)]"
                  >
                    {{ h.keyword }}
                    <template v-if="h.matchedVariant">({{ h.matchedVariant }})</template>
                    — {{ colorMeaning(extractIonColor(h.color)) }}
                  </ion-chip>
                </div>

              </div>

            </div>

            <ion-item lines="none">
              <ion-label position="stacked">{{ $t('addProduct.stores') }} <ion-text color="danger">*</ion-text></ion-label>
              <StoreLogoBar
                  :stores="stores"
                  mode="select"
                  v-model:modelValue="form.store_ids"
              />
            </ion-item>

            <!-- 📝 Description with Quick Insert -->
            <ion-item>
              <ion-textarea
                  v-model="form.description"
                  label-placement="floating"
                  :placeholder="$t('addProduct.descriptionPlaceholder')"
                  :auto-grow="true"
                  required
              >
                <div slot="label">
                  {{ $t('addProduct.description') }} <ion-text color="danger">*</ion-text>
                </div>
              </ion-textarea>
            </ion-item>

            <!-- ⚡ Quick Description Buttons (Horizontal Scroll) -->
            <div class="quick-scroll-container ion-margin-horizontal">
              <ion-button
                  size="small"
                  fill="outline"
                  color="success"
                  @click="applyQuickDescription(quickDescriptions.halal)"
              >
                Halal by
              </ion-button>

              <ion-button
                  size="small"
                  fill="outline"
                  color="primary"
                  @click="applyQuickDescription(quickDescriptions.muslimFriendly)"
              >
                Muslim-friendly OK
              </ion-button>

              <ion-button
                  size="small"
                  fill="outline"
                  color="warning"
                  @click="applyQuickDescription(quickDescriptions.syubhah)"
              >
                Syubhah found
              </ion-button>

              <ion-button
                  size="small"
                  fill="outline"
                  color="danger"
                  @click="applyQuickDescription(quickDescriptions.haram)"
              >
                Haram found
              </ion-button>
            </div>



            <ion-item>
              <ion-label>{{ $t('addProduct.frontImage') }} <ion-text color="danger">*</ion-text></ion-label>
              <ion-buttons slot="end">
                <ion-button @click="takeFrontPicture" fill="clear">
                  <ion-icon :icon="cameraOutline" />
                </ion-button>
                <ion-button @click="uploadFrontFromGallery" fill="clear">
                  <ion-icon :icon="cloudUploadOutline" />
                </ion-button>
              </ion-buttons>
            </ion-item>

            <div v-if="frontPreview" style="padding: 0 16px 16px;">
              <img :src="frontPreview" alt="Front Preview" style="max-width: 100%; border-radius: 8px;" />
            </div>

            <ion-item style="--inner-border-width: 0">
              <ion-label>{{ $t('addProduct.backImage') }} <ion-text color="danger">*</ion-text></ion-label>
              <ion-buttons slot="end">
                <ion-button @click="takeBackPicture" fill="clear">
                  <ion-icon :icon="cameraOutline" />
                </ion-button>
                <ion-button @click="uploadBackFromGallery" fill="clear">
                  <ion-icon :icon="cloudUploadOutline" />
                </ion-button>
              </ion-buttons>
            </ion-item>

            <div v-if="backPreview" style="padding: 0 16px 16px;">
              <img :src="backPreview" alt="Back Preview" style="max-width: 100%; border-radius: 8px;" />
            </div>
          </ion-item-group>
        </div>

        <ion-button expand="block" type="submit" class="ion-margin-top" color="carrot" :disabled="loading">
          {{ loading
            ? $t('addProduct.submitting')
            : (props.editProduct ? $t('addProduct.update') : $t('addProduct.submit')) }}
        </ion-button>

        <ion-spinner id="spinner" name="dots" v-if="loading" class="ion-text-center ion-margin-top"></ion-spinner>

        <!-- Toast for success -->
        <ion-toast
            :is-open="showToast"
            :message="$t('addProduct.submitSuccess')"
            :duration="1500"
            color="success"
            position="bottom"
            @did-dismiss="showToast = false"
            style="margin-bottom: 100px"
        ></ion-toast>

        <!-- OCR Success Toast -->
        <ion-toast
            :is-open="showOcrToast"
            :message="$t('addProduct.ocrSuccess')"
            :duration="2000"
            color="success"
            position="bottom"
            @did-dismiss="showOcrToast = false"
        />

        <!-- Error Toast -->
        <ion-toast
            :is-open="!!errorMsg"
            :message="errorMsg"
            color="danger"
            position="bottom"
            :duration="2500"
            @did-dismiss="errorMsg = ''"
        />
      </form>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonItemGroup,
  IonLabel,
  IonModal,
  IonPage,
  IonProgressBar,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTextarea,
  IonTitle,
  IonToast,
  IonToolbar,
  IonAccordion,
  IonAccordionGroup, IonNote, IonImg, IonThumbnail
} from '@ionic/vue';
import {
  addOutline,
  barcodeOutline,
  cameraOutline,
  cloudUploadOutline,
  checkmarkCircle,
  closeCircle,
  stopCircle,
} from 'ionicons/icons';
import { nextTick, onMounted, onUnmounted, ref, watch} from 'vue'
import {supabase} from '@/plugins/supabaseClient'

import { Capacitor } from '@capacitor/core'
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { extractIonColor, colorMeaning } from '@/utils/ingredientHelpers'

// Import Camera plugin and types
import {Camera, CameraDirection, CameraResultType, CameraSource} from '@capacitor/camera'
import {Cropper} from 'vue-advanced-cropper';
import 'vue-advanced-cropper/dist/style.css';
import AppHeader from "@/components/AppHeader.vue";

import useHighlightCache from '@/composables/useHighlightCache'
import useError from '@/composables/useError'
import { userRole, setUserRole } from '@/composables/userProfile'
import { usePoints } from "@/composables/usePoints";
import { useNotifier } from "@/composables/useNotifier"
import { useImageResizer } from "@/composables/useImageResizer";
import { useCropperOcr } from "@/composables/useCropperOcr"
import type { Product } from '@/types/Product'
import router from "@/router";
import StoreLogoBar from "@/components/StoreLogoBar.vue";
import { BarcodeValidator } from "@/utils/barcodeValidator";
import { ActivityLogService } from "@/services/ActivityLogService";

const { notifyEvent } = useNotifier();
const { awardAndCelebrate } = usePoints();
const { errorMsg, setError } = useError()
const stores = ref<{ id: string; name: string; logo_url?: string }[]>([])
const checkingIngredients = ref(false)
const { resizeImage } = useImageResizer();
const barcodeInput = ref<any>(null)
const showMuslimFriendly = ref(false)
const quickDescriptions = {
  halal: "Halal certified by ",
  muslimFriendly: "Muslim-friendly ingredients, OK.",
  syubhah: "Syubhah ingredients found.",
  haram: "Haram ingredients found."
}

const fetchStores = async () => {
  const { data, error } = await supabase
      .from("stores")
      .select("id, name, logo_url, sort_order")
      .order("sort_order", { ascending: true })

  if (!error && data) {
    stores.value = data.map(store => ({
      ...store,
      id: String(store.id)  // ✅ always string
    }))
  }
}

const STATUS_CHIP_CLASS: Record<string, string> = {
  'Halal': 'success',
  'Muslim-friendly': 'primary',
  'Syubhah': 'warning',
  'Haram': 'danger',
}

function statusChipColor(status?: string | null) {
  return STATUS_CHIP_CLASS[status ?? ''] ?? 'medium'
}

// props
const props = defineProps<{
  editProduct?: Product
}>()

// highlight + OCR pipeline
const { allHighlights, blacklistPatterns, fetchHighlightsWithCache, incrementUsageCount } =
    useHighlightCache()

const {
  cropperRef,
  cropperSrc,
  showCropper,
  croppedPreviewUrl,
  ocrLoading,
  openCropper,
  confirmCrop,
  closeCropper,
  ingredientHighlights,
  ingredientsText,
  autoStatus,
  productName,
  recheckHighlightsSmart,
} = useCropperOcr({
  allHighlights,
  blacklistPatterns,
  fetchHighlightsWithCache,
  incrementUsageCount,
  setError,
  setBackFile: (file: File) => {
    backFile.value = file
    if (backPreview.value) {
      URL.revokeObjectURL(backPreview.value)
    }
    backPreview.value = URL.createObjectURL(file) // ✅ show preview
  }
})


type DetectedProduct = {
  id: string
  name: string
  status: string
  photo_front_url: string | null
}

const detectedProduct = ref<DetectedProduct | null>(null)


// 🟢 Keep product-specific syncing into form
watch([autoStatus, productName, ingredientsText], ([newStatus, newName, newIngredients]) => {
  if (newStatus) form.value.status = newStatus
  if (newName && !form.value.name.trim()) form.value.name = newName
  if (newIngredients) form.value.ingredients = newIngredients
})

// ✅ Fetch highlights & blacklist once when component mounts
onMounted(async () => {
  const [highlightsResult, blacklistResult] = await Promise.all([
    supabase.from('ingredient_highlights').select('keyword, keyword_zh, color'),
    supabase.from('ingredient_blacklist').select('pattern').eq('is_active', true)
  ]);

  if (!highlightsResult.error && highlightsResult.data) {
    allHighlights.value = highlightsResult.data;
  }
  if (!blacklistResult.error && blacklistResult.data) {
    blacklistPatterns.value = blacklistResult.data.map((row) => new RegExp(row.pattern, 'i'));
  }

  if (props.editProduct) {
    form.value = {
      barcode: props.editProduct.barcode,
      name: props.editProduct.name,
      status: props.editProduct.status,
      product_category_id: props.editProduct.product_category_id ?? null,
      ingredients: props.editProduct.ingredients ?? '',
      description: props.editProduct.description ?? '',
      store_ids: []
    }

    frontPreview.value = props.editProduct.photo_front_url ?? null
    backPreview.value = props.editProduct.photo_back_url ?? null

    const { data: linkedStores } = await supabase
        .from('product_stores')
        .select('store_id')
        .eq('product_id', props.editProduct.id)

    if (linkedStores) {
      form.value.store_ids = linkedStores.map(s => s.store_id)
    }
  }

  // 🟢 Add this
  await fetchStores()
  await fetchHighlightsWithCache(true)
  await fetchCategoryRules()
  await fetchCategories()
})

interface ProductForm {
  barcode: string
  name: string
  status: string
  product_category_id: number | null
  ingredients: string
  description: string
  store_ids: string[]   // ✅ string IDs
}

const form = ref<ProductForm>({
  barcode: '',
  name: '',
  status: 'Muslim-friendly',
  product_category_id: null,
  ingredients: '',
  description: '',
  store_ids: []        // ✅ start empty
})

// ✅ rules fetched from DB
const categoryRules = ref<Record<string, number>>({})

// central mapping
const statusDescriptions: Record<string, string> = {
  'Halal': "Halal certified.",
  'Muslim-friendly': "Muslim-friendly ingredients, OK.",
  'Syubhah': "Syubhah ingredients found.",
  'Haram': "Haram ingredients found."
}

// Track if user manually edits description
watch(() => form.value.description, (newDesc, oldDesc) => {
  // Only mark as user-typed if not from our own code
  if (!programmaticDescUpdate.value && newDesc !== oldDesc && scannedOnce.value) {
    userTouchedDescription.value = true
  }
})


// after your useOcrPipeline call
watch([autoStatus, productName, ingredientsText],
    ([newStatus, newName]) => {

      if (newStatus) {
        form.value.status = newStatus
        autoStatusApplied.value = true
        console.log("⚡ AutoStatus applied:", newStatus)
        scannedOnce.value = true   // ✅ mark scan complete here too
        if (!form.value.description?.trim()) {
          form.value.description = statusDescriptions[newStatus] ?? ""
        }
      }

      if (newName && !form.value.name.trim()) {
        form.value.name = newName
        console.log("🏷 AutoProductName applied:", newName)
      }

      if (form.value.name && !form.value.product_category_id) {
        const lower = form.value.name.toLowerCase()
        for (const keyword in categoryRules.value) {
          if (lower.includes(keyword)) {
            form.value.product_category_id = categoryRules.value[keyword]
            console.log(`📂 AutoCategory applied: "${form.value.product_category_id}" (matched "${keyword}")`)
            break
          }
        }
      }
    }
)

// Manual status change
watch(() => form.value.status, (newStatus) => {
  if (!newStatus) return
  if (isResettingForm.value) return   // 🚫 skip if resetting form
  if (!scannedOnce.value) return      // 🚫 only apply after first scan

  // Only overwrite if user hasn't typed their own description
  if (!userTouchedDescription.value) {
    programmaticDescUpdate.value = true
    form.value.description = statusDescriptions[newStatus] ?? ""
    nextTick(() => { programmaticDescUpdate.value = false })
  }
})


async function checkBarcodeExists(barcode: string) {
  const { data } = await supabase
      .from("products")
      .select("id, name, status, photo_front_url")
      .eq("barcode", barcode)
      .maybeSingle()

  return data || null
}

watch(() => form.value.barcode, async (newBarcode) => {
  if (!newBarcode) {
    barcodeValid.value = null;
    barcodeMessage.value = "";
    detectedProduct.value = null
    return;
  }

  const validation = validateBarcode(newBarcode);
  if (!validation.isValid) {
    barcodeValid.value = false;
    barcodeMessage.value = validation.message;
    return;
  }

  // 🚫 Only check duplicates when creating, not editing
  if (!props.editProduct) {
    const existingProduct = await checkBarcodeExists(newBarcode)

    if (existingProduct) {
      barcodeValid.value = false
      barcodeMessage.value = "⚠️ Product already exists"

      detectedProduct.value = {
        id: existingProduct.id,
        name: existingProduct.name,
        status: existingProduct.status,
        photo_front_url: existingProduct.photo_front_url,
      }

      return
    }

    // clear preview if not exists
    detectedProduct.value = null

  }

  barcodeValid.value = true;
  barcodeMessage.value = validation.message;
});



const autoStatusApplied = ref(false)
const userTouchedDescription = ref(false)
const programmaticDescUpdate = ref(false)

const frontFile = ref < File | null > (null)
const backFile = ref < File | null > (null)
const frontPreview = ref < string | null > (null) // For showing preview
const backPreview = ref < string | null > (null)

const loading = ref(false)
const showToast = ref(false)
const showOcrToast = ref(false);
const showErrorToast = ref(false)
const toastMessage = ref('')
const scanning = ref(false)

const rawChineseOcr = ref('')  // keep original OCR before cleaning
const scannedOnce = ref(false);
const isResettingForm = ref(false)
const originalFile = ref<File | null>(null)

const barcodeValid = ref<null | boolean>(null)
const barcodeMessage = ref<string>('') // feedback below input
const html5QrCodeInstance = ref<Html5Qrcode | null>(null)
const categories = ref<{ id: number; name: string }[]>([])
const emit = defineEmits(['updated', 'close'])

function onProductNameInput(ev: Event) {
  const target = ev.target as HTMLInputElement
  console.log("✏️ Product name typed:", target.value)
}

function handleIngredientsInput(ev: Event) {
  const target = ev.target as HTMLTextAreaElement
  console.log("🥬 Ingredients input:", target.value)
}

async function recheckHighlights() {
  checkingIngredients.value = true
  try {
    await recheckHighlightsSmart()
  } finally {
    checkingIngredients.value = false
  }
}

function handleBack() {
  if (props.editProduct) {
    emit("close")
  } else {
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push("/search")
    }
  }
}

const fetchCategories = async () => {
  const { data, error } = await supabase
      .from("product_categories")
      .select("id, name")
      .order("name")

  if (!error && data) {
    categories.value = data
  }
}

const fetchCategoryRules = async () => {
  const {data, error} = await supabase
      .from("category_rules")
      .select("keyword, category_id")

  if (!error && data) {
    categoryRules.value = data.reduce((acc, row) => {
      acc[row.keyword.toLowerCase()] = row.category_id  // ✅ numeric FK
      return acc
    }, {} as Record<string, number>)
  }
}

function applyQuickDescription(text: string) {
  form.value.description = text
}

async function scanIngredientsWithCamera() {
  const image = await Camera.getPhoto({
    quality: 90,
    allowEditing: false,
    resultType: CameraResultType.Uri,
    source: CameraSource.Camera,
    direction: CameraDirection.Rear,
  })
  const blob = await fetch(image.webPath!).then(r => r.blob())
  const file = new File([blob], `ingredients-${Date.now()}.jpg`, { type: 'image/jpeg' })
  originalFile.value = file
  openCropper(file)
}

function scanIngredientsFromGallery() {
  const input = document.createElement("input")
  input.type = "file"
  input.accept = "image/*"
  input.onchange = (e: Event) => {
    const target = e.target as HTMLInputElement
    if (target.files && target.files[0]) {
      originalFile.value = target.files[0]
      openCropper(target.files[0])
    }
  }
  input.click()
}

const cameras = ref<{ id: string; label: string }[]>([])
const selectedCameraId = ref<string | null>(null)

async function loadCameras() {
  try {
    const devices = await Html5Qrcode.getCameras()
    cameras.value = devices.map(d => ({ id: d.id, label: d.label || `Camera ${d.id}` }))

    // default: pick back camera if possible
    const backCam = devices.find(d => /back|rear|environment/i.test(d.label))
    selectedCameraId.value = backCam ? backCam.id : devices[0]?.id || null
  } catch (err) {
    console.error('❌ Failed to get cameras:', err)
  }
}

async function switchCamera(camId: string) {
  if (!html5QrCodeInstance.value) return

  try {
    await html5QrCodeInstance.value.stop()
    document.getElementById('reader')!.innerHTML = ''

    const config = {
      fps: 15,
      qrbox: { width: 300, height: 150 },
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
      ],
    }

    await html5QrCodeInstance.value.start(
        camId,
        config,
        async (decodedText) => {
          console.log('✅ Web barcode detected:', decodedText)
          form.value.barcode = decodedText
          scannedOnce.value = true   // ✅ mark as scanned
          await Haptics.impact({ style: ImpactStyle.Medium })

          await html5QrCodeInstance.value?.stop()
          document.getElementById('reader')!.innerHTML = ''
          html5QrCodeInstance.value = null
          scanning.value = false
        },
        (errorMessage) => {
          console.log('📡 Scan error:', errorMessage)
        }
    )

    selectedCameraId.value = camId
  } catch (err) {
    console.error('❌ Failed to switch camera:', err)
  }
}


async function startBarcodeScan() {
  if (scanning.value) {
    // 🛑 If already scanning → stop
    if (html5QrCodeInstance.value) {
      await html5QrCodeInstance.value.stop()
      document.getElementById('reader')!.innerHTML = ''
      html5QrCodeInstance.value = null
    }
    scanning.value = false
    return
  }

  scanning.value = true

  try {
    if (Capacitor.isNativePlatform()) {
      // 🟢 Native → MLKit
      const { camera } = await BarcodeScanner.checkPermissions();
      if (camera !== 'granted') {
        const { camera: newStatus } = await BarcodeScanner.requestPermissions();
        if (newStatus !== 'granted') {
           scanning.value = false;
           return;
        }
      }

      const { barcodes } = await BarcodeScanner.scan();

      if (barcodes.length > 0) {
        const barcode = barcodes[0].rawValue;
        if (barcode) {
          await Haptics.impact({ style: ImpactStyle.Medium })
          form.value.barcode = barcode
        }
      }
      scanning.value = false
    } else {
      // 🌐 Web → html5-qrcode
      await nextTick()

      const readerEl = document.getElementById('reader')

      if (!readerEl) {
        console.error("❌ #reader container not found")
        scanning.value = false
        return
      }

      const html5QrCode = new Html5Qrcode('reader', { verbose: false }) // ✅ always inline, never fullscreen
      html5QrCodeInstance.value = html5QrCode

      const config = {
        fps: 15,
        qrbox: { width: 300, height: 150 },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ],
      }

      // 🔍 Get available cameras
      const devices = await Html5Qrcode.getCameras()
      if (!devices || !devices.length) {
        console.error('❌ No cameras found')
        scanning.value = false
        return
      }

      // Pick rear/back/environment camera if available, else fallback to first
      const backCam = devices.find(d => /back|rear|environment/i.test(d.label))
      const camId = backCam ? backCam.id : devices[0].id

      await loadCameras()
      if (!selectedCameraId.value) {
        console.error('❌ No camera available')
        scanning.value = false
        return
      }

      await html5QrCode.start(
          camId, // 👈 use specific camera ID
          config,
          async (decodedText) => {
            console.log('✅ Web barcode detected:', decodedText)
            await Haptics.impact({ style: ImpactStyle.Medium })
            form.value.barcode = decodedText
            scannedOnce.value = true   // ✅ mark as scanned
            // also push into IonInput DOM
            await nextTick()
            if (barcodeInput.value) {
              barcodeInput.value.$el.value = decodedText
            }

            // auto stop after detection
            await html5QrCode.stop()
            document.getElementById('reader')!.innerHTML = ''
            html5QrCodeInstance.value = null
            scanning.value = false
          },
          (errorMessage) => {
            console.log(errorMessage) // gets called often
          }
      )
    }
  } catch (err: any) {
    console.error('❌ Barcode scan failed:', err)
    scanning.value = false
  }
}

const isUnmounted = false
onUnmounted(() => {
  if (cropperSrc.value) URL.revokeObjectURL(cropperSrc.value)
  if (croppedPreviewUrl.value) URL.revokeObjectURL(croppedPreviewUrl.value)
})

async function takeFrontPicture() {
  if (isUnmounted) return;
  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      direction: CameraDirection.Rear   // 👈 force front camera
    });

    if (isUnmounted) return;
    frontPreview.value = image.webPath || null;
    frontFile.value = await resizeImage(image.webPath || '');

  } catch (error) {
    console.error('Error taking front photo:', error);
    setError('❌ Failed to capture front image.');
  }
}

async function takeBackPicture() {
  if (isUnmounted) return;
  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      direction: CameraDirection.Rear   // 👈 force back camera
    });

    if (isUnmounted) return;
    backPreview.value = image.webPath || null;
    backFile.value = await resizeImage(image.webPath || '');

  } catch (error) {
    console.error('Error taking back photo:', error);
    setError('❌ Failed to capture back image.');
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

function validateBarcode(barcode: string) {
  const clean = barcode.replace(/-/g, "");

  if (
      BarcodeValidator.isValidEAN8(clean) ||
      BarcodeValidator.isValidEAN13(clean) ||
      BarcodeValidator.isValidEAN14(clean) ||
      BarcodeValidator.isValidUPCA(clean) ||
      BarcodeValidator.isValidUPCE(clean) ||
      BarcodeValidator.isValidISBN(clean) ||
      BarcodeValidator.isValidIMEI(clean) ||
      BarcodeValidator.isValidGSIN(clean) ||
      BarcodeValidator.isValidSSCC(clean) ||
      BarcodeValidator.isValidGLN(clean) ||
      BarcodeValidator.isValidASIN(clean)
  ) {
    return { isValid: true, message: "✅ Valid barcode" };
  }

  return { isValid: false, message: "❌ Invalid barcode" };
}

async function saveProductStores(
    productId: string,
    storeIds: string[],
    userId: string
) {
  try {
    if (storeIds.length > 0) {
      const links = storeIds.map(storeId => ({
        product_id: productId,
        store_id: storeId,   // already string
        added_by: userId,
      }))

      const { error: upsertError } = await supabase
          .from("product_stores")
          .upsert(links, { onConflict: "product_id,store_id" })

      if (upsertError) throw upsertError

      const { error: deleteError } = await supabase
          .from("product_stores")
          .delete()
          .eq("product_id", productId)
          .not("store_id", "in", `(${storeIds.join(",")})`)

      if (deleteError) throw deleteError
    } else {
      await supabase
          .from("product_stores")
          .delete()
          .eq("product_id", productId)
    }

    console.log("✅ Stores synced safely:", storeIds)
  } catch (err) {
    console.error("❌ Failed to save product_stores:", err)
    throw err
  }
}



async function handleSubmit() {

  const autoApprove = ['admin', 'contributor'].includes(userRole.value || 'user')
  loading.value = true
  errorMsg.value = ''
  showErrorToast.value = false

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('You must be logged in to submit a product.')
      loading.value = false
      return
    }

    // fetch role from profiles table
    const { data: profile } = await supabase
        .from('user_roles')  // or 'profiles'
        .select('role')
        .eq('user_id', user.id)
        .single()

    setUserRole(user.id, profile?.role || 'user')

    const {
      barcode
    } = form.value

    const barcodeValidation = validateBarcode(form.value.barcode);
    if (!barcodeValidation.isValid) {
      setError(barcodeValidation.message);
      loading.value = false;
      return;
    }

    if (!form.value.name.trim()) return setError('Product name is required.')
    if (!form.value.status) return setError('Product status is required.')
    if (!form.value.ingredients.trim()) return setError('Ingredients are required.')
    if (!form.value.product_category_id) return setError('Product category is required.')
    if (!form.value.description.trim()) return setError('Description is required.')

    if (!props.editProduct && !frontFile.value) return setError('Front image is required.')
    if (!props.editProduct && !backFile.value) return setError('Back image is required.')

    const { store_ids, ...productData } = form.value

    let frontUrl = props.editProduct?.photo_front_url || ''
    let backUrl  = props.editProduct?.photo_back_url || ''

    if (frontFile.value) {
      const {
        error
      } = await supabase.storage
          .from('product-images')
          .upload(`${barcode}/front.jpg`, frontFile.value, {
            upsert: true
          })

      if (error) {
        console.log(error);
        setError('❌ Failed to upload front image.');
        return;
      }

      const {
        data: publicUrl
      } = supabase.storage
          .from('product-images')
          .getPublicUrl(`${barcode}/front.jpg`)

      frontUrl = publicUrl.publicUrl
      console.log('Front image uploaded:', frontUrl)
    }

    if (backFile.value) {
      const {
        error
      } = await supabase.storage
          .from('product-images')
          .upload(`${barcode}/back.jpg`, backFile.value, {
            upsert: true
          })

      if (error) {
        console.log(error);
        setError('❌ Failed to upload back image.');
        return;
      }

      const {
        data: publicUrl
      } = supabase.storage
          .from('product-images')
          .getPublicUrl(`${barcode}/back.jpg`)

      backUrl = publicUrl.publicUrl
      console.log('Back image uploaded:', backUrl)
    }

    // --- 🔹 Update vs. Create ---
    if (props.editProduct) {
      // UPDATE product
      await supabase.from("products").update({
        ...productData,
        photo_front_url: frontUrl,
        photo_back_url: backUrl,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
        approved: autoApprove ? true : props.editProduct.approved,
        approved_by: autoApprove ? user.id : props.editProduct.approved_by,
        approved_at: autoApprove ? new Date().toISOString() : props.editProduct.approved_at,
      }).eq("id", props.editProduct.id)

      // 🟢 Always replace stores
      await saveProductStores(
          props.editProduct.id,
          store_ids,  // 👈 convert string[] → number[]
          user.id
      )

      toastMessage.value = "✅ Product updated successfully!"

      await notifyEvent(
          "update_product",
          "✏️ Product Updated",
          `${form.value.name} (${form.value.status})\nBarcode: ${form.value.barcode}`,
          frontUrl || backUrl,
          {
            barcode: form.value.barcode,
            status: form.value.status,
            isNative: true, // 👈 important for mobile deep link
          }
      );

      emit("updated")
    } else {
      // CREATE
      const { data: newProduct, error: insertError } = await supabase
          .from("products")
          .insert([{
            ...productData,
            barcode,
            photo_front_url: frontUrl,
            photo_back_url: backUrl,
            added_by: user.id,
            approved: autoApprove,
            approved_by: autoApprove ? user.id : null,
            approved_at: autoApprove ? new Date().toISOString() : null,
            created_at: new Date().toISOString(),
          }])
          .select("id")
          .single()

      if (insertError || !newProduct) {
        throw insertError || new Error("❌ Failed to create product, no data returned")
      }

      // 🟢 Insert stores fresh
      await saveProductStores(newProduct.id, store_ids, user.id)

      // ✅ Toast logic (already correct)
      toastMessage.value = autoApprove
          ? "✅ Product published successfully!"
          : "✅ Product submitted and awaiting approval."

      // 🔔 Notify differently depending on role
      if (autoApprove) {
        // 🟢 Admin/Contributor → public notification
        await notifyEvent(
            "new_product",
            "🆕 New Product Published!",
            `${form.value.name} (${form.value.status})\nBarcode: ${form.value.barcode}`,
            frontUrl || backUrl,
            {
              barcode: form.value.barcode,
              status: form.value.status,
              isNative: true,
            }
        );
      }

      // reset form
      form.value = { barcode: '', name: '', status: 'Muslim-friendly',
        product_category_id: null, ingredients: '', description: '', store_ids: [] }
      frontFile.value = null; backFile.value = null
      frontPreview.value = null; backPreview.value = null
      ingredientHighlights.value = []; barcodeValid.value = null; barcodeMessage.value = ''
      await awardAndCelebrate("add_product", 10000)
      
      await ActivityLogService.log("add_product_success", {
        barcode: barcode,
        name: form.value.name,
        status: form.value.status
      })
    }

    showToast.value = true

  } catch (err: any) {
    console.error('Submission error:', err)
    setError(err.message || 'An unexpected error occurred.')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
ion-toast {
  transform: translateY(-55px);
}

#reader {
  width: 100%;
  height: 260px;       /* 🔹 fixed height so library doesn't auto-popup */
  border-radius: 8px;
  overflow: hidden;
  margin: 12px auto;
  background: #000;    /* black background behind video */
  position: relative;  /* ensures inline placement */
}

/* kill any unwanted modal overlay injected by html5-qrcode */
#reader__scan_region,
#reader__dashboard_section_csr {
  position: relative !important;
  inset: auto !important;
  max-width: 100% !important;
}

/* For larger screens */
@media (min-width: 768px) {
  #reader {
    width: 400px;       /* fixed width for better control */
    height: 300px;      /* fixed height */
    border-radius: 8px; /* maybe larger radius for desktop */
  }
}

ion-item {
  --background: transparent;
}

.form-container {
  border-radius: 10px;
  background-color: var(--ion-color-light); /* optional background */
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05); /* optional elevation */
}

ion-content::part(scroll) {
  padding-bottom: 100px; /* leave space for keyboard */
}

.keyboard-open ion-footer {
  margin-bottom: 300px; /* adjust to keyboard height */
}

.barcode-valid {
  --highlight-color-focused: var(--ion-color-success);
  --border-color: var(--ion-color-success);
}

.barcode-invalid {
  --highlight-color-focused: var(--ion-color-danger);
  --border-color: var(--ion-color-danger);
}

.quick-scroll-container {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 4px 0;
  scrollbar-width: none;       /* Firefox */
}

.quick-scroll-container::-webkit-scrollbar {
  display: none;               /* Chrome/Safari */
}

.quick-scroll-container ion-button {
  flex-shrink: 0;              /* prevent buttons from shrinking */
}

.detected-product {
  border-radius: 8px;
  background: var(--ion-color-light);
  padding: 6px;
}

.detected-product h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}
</style>

