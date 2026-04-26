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

      <!-- 🟢 Step Indicator -->
      <div id="step-indicator">
        <div class="step-item" :class="{ active: currentStep >= 0 }">
          <div class="step-dot">
            <ion-icon :icon="barcodeOutline" v-if="currentStep <= 0" />
            <ion-icon :icon="checkmarkCircle" v-else />
          </div>
          <span class="step-label">Barcode</span>
        </div>
        <div class="step-line" :class="{ active: currentStep >= 1 }"></div>
        <div class="step-item" :class="{ active: currentStep >= 1 }">
          <div class="step-dot">
            <ion-icon :icon="sparklesOutline" v-if="currentStep <= 1" />
            <ion-icon :icon="checkmarkCircle" v-else />
          </div>
          <span class="step-label">Ingredients</span>
        </div>
        <div class="step-line" :class="{ active: currentStep >= 2 }"></div>
        <div class="step-item" :class="{ active: currentStep >= 2 }">
          <div class="step-dot">
            <ion-icon :icon="checkmarkCircleOutline" />
          </div>
          <span class="step-label">Details</span>
        </div>
      </div>
    </ion-header>

    <ion-content ref="contentRef" class="ion-padding" >
      <!-- 🔹 OCR Loading Overlay (WOW Factor) -->
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

      <ion-modal :is-open="showCropper" @didDismiss="closeCropper">
        <ion-header>
          <app-header
              :title="$t('addProduct.cropIngredients')"
              show-back
              :useRouterBack="false"
              @back="closeCropper"
          />
        </ion-header>

        <ion-content :scroll-y="false" class="modal-no-scroll">
          <cropper
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

        <ion-footer>
          <!-- 🛠️ Ratio Toolbar (Moved to bottom for reachability) -->
          <div class="ratio-toolbar ion-padding-horizontal" style="background: transparent; border: none;">
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
                @click="setAspectRatio(r.value)"
                class="ratio-btn"
            >
              <ion-icon slot="start" :icon="r.icon" style="font-size: 14px;" />
              {{ r.label }}
            </ion-button>
          </div>

          <ion-toolbar class="ion-padding">
            <ion-button expand="block" color="carrot" @click="handleConfirmCrop" style="font-weight: 700; height: 48px;">
               {{ $t('addProduct.done') }}
            </ion-button>
          </ion-toolbar>
        </ion-footer>
      </ion-modal>
      <form @submit.prevent="handleSubmit">
        <div class="form-container">
            <!-- 🔍 STEP 1: Barcode -->
            <div v-show="currentStep === STEP_BARCODE">
              <!-- Hero Header -->
              <div class="ion-padding-vertical ion-text-center">
                <div style="font-size: 48px; margin-bottom: 12px;">🔍</div>
                <h2 style="font-weight: 700; margin-bottom: 8px;">{{ $t('addProduct.scanBarcodeTitle') || 'Find Product' }}</h2>
                <p style="color: var(--ion-color-medium); font-size: 14px; margin-bottom: 24px;">
                  {{ $t('addProduct.scanBarcodeDesc') || 'Scan the barcode on the product packaging to get started.' }}
                </p>

                <ion-button 
                  expand="block" 
                  color="carrot" 
                  class="ion-margin-bottom" 
                  style="height: 56px; font-weight: 700;" 
                  @click="startBarcodeScan"
                  :disabled="scanning"
                >
                  <ion-icon slot="start" :icon="scanning ? stopCircle : barcodeOutline" />
                  {{ scanning ? 'Scanning...' : $t('addProduct.camera') }}
                </ion-button>
              </div>

              <!-- Manual Entry Card -->
              <div class="form-section ion-margin-top">
                <ion-list-header>
                  <ion-label>Manual Entry</ion-label>
                </ion-list-header>

                <ion-card class="input-card">
                  <ion-card-content class="ion-no-padding">
                    <ion-item lines="none" :class="{ 'barcode-valid': barcodeValid === true, 'barcode-invalid': barcodeValid === false }">
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
                          class="ion-margin-vertical"
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
                    </ion-item>
                  </ion-card-content>
                </ion-card>

                <!-- Status Message -->
                <ion-note 
                  v-if="barcodeMessage" 
                  :color="barcodeValid ? 'success' : 'danger'" 
                  class="ion-padding-horizontal"
                  style="font-size: 14px; font-weight: 500;"
                >
                  {{ barcodeMessage }}
                </ion-note>
              </div>

              <!-- 🟣 Detected Product Preview (If exists) -->
              <div v-if="detectedProduct" class="form-section ion-margin-top">
                <ion-list-header>
                   <ion-label>Existing Product Found</ion-label>
                </ion-list-header>
                <ion-card class="input-card">
                   <ion-item lines="none" class="detected-product">
                    <ion-thumbnail slot="start" style="--border-radius: 8px;">
                      <ion-img :src="detectedProduct.photo_front_url || '/placeholder-product.png'" />
                    </ion-thumbnail>

                    <ion-label>
                      <h3 style="font-weight: 600;">{{ detectedProduct.name }}</h3>
                      <ion-chip
                          size="small"
                          :class="`chip-${statusChipColor(detectedProduct.status)}`"
                          style="margin: 4px 0 0 0;"
                      >
                        {{ detectedProduct.status }}
                      </ion-chip>
                    </ion-label>

                    <ion-button slot="end" fill="clear" color="primary" @click="router.push(`/item/${form.barcode}`)">
                      View
                    </ion-button>
                  </ion-item>
                </ion-card>
              </div>

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

              <!-- Manual Next Button (If needed) -->
              <div class="ion-padding-top">
                <ion-button expand="block" @click="nextStep" :disabled="!barcodeValid || !!detectedProduct" fill="outline" color="carrot">
                  {{ $t('addProduct.next') || 'Next' }}
                  <ion-icon slot="end" :icon="arrowForwardOutline" />
                </ion-button>
              </div>
            </div>

            <!-- 🟢 STEP 1: Ingredients OCR -->
            <div v-show="currentStep === STEP_OCR">
              <div class="ion-padding-vertical ion-text-center">
                <div style="font-size: 48px; margin-bottom: 12px;">🥬</div>
                <h2 style="font-weight: 700; margin-bottom: 8px;">{{ $t('addProduct.scanIngredientsTitle') || 'Scan Ingredients' }}</h2>
                <p style="color: var(--ion-color-medium); font-size: 14px; margin-bottom: 24px;">
                  {{ $t('addProduct.scanIngredientsDesc') || 'Scan the ingredients list to automatically fill the form and capture the back photo.' }}
                </p>

                <div style="display: flex; gap: 12px; margin-bottom: 16px;">
                  <ion-button fill="outline" color="carrot" style="flex: 1;" @click="scanIngredientsWithCamera">
                    <ion-icon slot="start" :icon="cameraOutline" />
                    {{ $t('addProduct.camera') || 'Camera' }}
                  </ion-button>
                  <ion-button fill="outline" color="carrot" style="flex: 1;" @click="scanIngredientsFromGallery">
                    <ion-icon slot="start" :icon="cloudUploadOutline" />
                    {{ $t('addProduct.gallery') || 'Gallery' }}
                  </ion-button>
                </div>

              </div>

              <div v-if="backPreview" class="ion-padding-top ion-text-center">
                <ion-label class="preview-label">{{ $t('addProduct.capturedBackPhoto') || 'Captured Back Photo' }}</ion-label>
                <div class="preview-container">
                   <img :src="backPreview" class="large-preview-img" @load="scrollToBottom" />
                   <ion-button size="small" color="danger" fill="clear" class="preview-remove-btn" @click="backPreview = null; backFile = null">
                     <ion-icon :icon="closeCircle" />
                   </ion-button>
                </div>
              </div>

              <!-- 🕌 Section 2: Halal Status (Segmented) -->
              <div v-if="backPreview || form.ingredients" class="form-section ion-margin-top">
                <ion-list-header>
                  <ion-label>{{ $t('addProduct.status') }} <ion-text color="danger">*</ion-text></ion-label>
                </ion-list-header>

                <ion-card class="input-card">
                  <ion-card-content class="ion-no-padding">
                    <ion-item lines="none">
                      <ion-select 
                        v-model="form.status" 
                        interface="popover" 
                        label-placement="floating"
                        class="full-width-select"
                        required
                      >
                        <div slot="label">{{ $t('addProduct.status') }} <ion-text color="danger">*</ion-text></div>
                        <ion-select-option value="Halal">{{ $t('addProduct.halal') }}</ion-select-option>
                        <ion-select-option value="Muslim-friendly">{{ $t('addProduct.muslimFriendly') }}</ion-select-option>
                        <ion-select-option value="Syubhah">{{ $t('addProduct.syubhah') }}</ion-select-option>
                        <ion-select-option value="Haram">{{ $t('addProduct.haram') }}</ion-select-option>
                      </ion-select>
                    </ion-item>
                  </ion-card-content>
                </ion-card>
              </div>

              <!-- 🥬 Section 3: Ingredients & Analysis -->
              <div v-if="backPreview || form.ingredients" class="form-section">
                <ion-list-header>
                  <ion-label>{{ $t('addProduct.sections.ingredients') || 'Ingredients & Analysis' }}</ion-label>
                </ion-list-header>

                <ion-card class="input-card">
                  <ion-card-content class="ion-no-padding">
                    <ion-item lines="none">
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
                    </ion-item>

                    <!-- Analysis Progress -->
                    <div class="analysis-indicators ion-padding-horizontal">
                       <ion-progress-bar v-if="ocrLoading" type="indeterminate" color="primary" class="mini-progress" />
                       <ion-progress-bar v-if="checkingIngredients" type="indeterminate" color="primary" class="mini-progress" />
                    </div>

                    <!-- Highlight Clips -->
                    <div v-if="ingredientHighlights.length" class="highlights-preview ion-padding">
                       <ion-chip
                          v-for="(h, idx) in ingredientHighlights.filter(h => extractIonColor(h.color) !== 'primary')"
                          :key="idx"
                          class="compact-chip"
                          :class="['chip-' + extractIonColor(h.color)]"
                       >
                         {{ h.keyword }}
                       </ion-chip>
                       
                       <div v-if="ingredientHighlights.some(h => extractIonColor(h.color) === 'primary')" class="ion-margin-top">
                         <ion-button fill="clear" size="small" @click="showMuslimFriendly = !showMuslimFriendly" class="toggle-friendly-btn">
                           {{ showMuslimFriendly ? 'Hide Friendly' : 'Show Friendly' }}
                         </ion-button>
                         <div v-if="showMuslimFriendly" class="friendly-chips">
                            <ion-chip
                              v-for="(h, idx) in ingredientHighlights.filter(h => extractIonColor(h.color) === 'primary')"
                              :key="idx"
                              class="compact-chip chip-primary"
                            >
                              {{ h.keyword }}
                            </ion-chip>
                         </div>
                       </div>
                    </div>

                    <!-- Detected Text (Raw) -->
                    <ion-accordion-group v-if="rawChineseOcr">
                      <ion-accordion value="rawOcr">
                        <ion-item slot="header" lines="none" class="accordion-header">
                          <ion-label color="medium">{{ $t('addProduct.detectedText') }}</ion-label>
                        </ion-item>
                        <div slot="content" class="ion-padding-horizontal ion-padding-bottom">
                          <code class="raw-ocr-text">{{ rawChineseOcr }}</code>
                        </div>
                      </ion-accordion>
                    </ion-accordion-group>
                  </ion-card-content>
                </ion-card>
              </div>
            </div>

            <!-- 🟢 STEP 2: Remaining Details -->
            <div v-show="currentStep === STEP_DETAILS" class="details-wizard-step">

              <!-- 🏷️ Section 1: Basic Information -->
              <div class="form-section">
                <ion-list-header>
                  <ion-label>{{ $t('addProduct.sections.identity') || 'Basic Information' }}</ion-label>
                </ion-list-header>
                
                <ion-card class="input-card">
                  <ion-card-content class="ion-no-padding">
                    <ion-item lines="full">
                      <ion-input
                          v-model="form.name"
                          required
                          clear-input
                          label-placement="floating"
                          :placeholder="$t('addProduct.productNamePlaceholder')"
                          @input="onProductNameInput"
                      >
                        <div slot="label" style="display: flex; align-items: center; gap: 8px; width: 100%;">
                          <span>{{ $t('addProduct.productName') }} <ion-text color="danger">*</ion-text></span>
                          <ion-chip :class="`chip-${statusChipColor(form.status)}`" style="margin: 0; font-size: 10px; height: 18px; padding: 0 8px; font-weight: 600;">
                            {{ form.status }}
                          </ion-chip>
                        </div>
                      </ion-input>
                    </ion-item>

                    <ion-item lines="none">
                      <ion-select v-model.number="form.product_category_id" interface="alert" required class="full-width-select">
                        <div slot="label">{{ $t('addProduct.category') }} <ion-text color="danger">*</ion-text></div>
                        <ion-select-option v-for="cat in categories" :key="cat.id" :value="cat.id">
                          {{ cat.name }}
                        </ion-select-option>
                      </ion-select>
                    </ion-item>
                  </ion-card-content>
                </ion-card>
              </div>

              <!-- 🕌 Section 2: Halal Status (Segmented) moved to STEP_OCR -->

              <!-- 🥬 Section 3: Ingredients & Analysis moved to STEP_OCR -->

              <!-- 🏪 Section 4: Retail & Details -->
              <div class="form-section">
                <ion-list-header>
                  <ion-label>{{ $t('addProduct.sections.market') || 'Market & Description' }}</ion-label>
                </ion-list-header>

                <ion-card class="input-card">
                  <ion-card-content class="ion-no-padding">
                    <ion-item lines="full">
                      <ion-label position="stacked">{{ $t('addProduct.stores') }} <ion-text color="danger">*</ion-text></ion-label>
                      <StoreLogoBar
                          :stores="stores"
                          mode="select"
                          v-model:modelValue="form.store_ids"
                          class="ion-margin-vertical"
                      />
                    </ion-item>

                    <ion-item lines="none">
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
                    
                    <!-- Quick Insert Buttons -->
                    <div class="quick-scroll-container ion-padding-horizontal ion-padding-bottom">
                      <ion-button size="small" fill="outline" color="success" @click="applyQuickDescription(quickDescriptions.halal)" class="quick-btn">Halal by</ion-button>
                      <ion-button size="small" fill="outline" color="primary" @click="applyQuickDescription(quickDescriptions.muslimFriendly)" class="quick-btn">Friendly OK</ion-button>
                      <ion-button size="small" fill="outline" color="warning" @click="applyQuickDescription(quickDescriptions.syubhah)" class="quick-btn">Syubhah found</ion-button>
                      <ion-button size="small" fill="outline" color="danger" @click="applyQuickDescription(quickDescriptions.haram)" class="quick-btn">Haram found</ion-button>
                    </div>
                  </ion-card-content>
                </ion-card>
              </div>

              <!-- 💰 Section: Tags -->
              <div class="form-section">
                <ion-list-header><ion-label>{{ $t('addPlace.tagsAndCategories', 'Tags') }}</ion-label></ion-list-header>
                <ion-card class="input-card">
                  <ion-item lines="none">
                    <ion-input
                        v-model="tagInput"
                        :label="$t('addPlace.addTagLabel', 'Add a tag')"
                        label-placement="stacked"
                        :placeholder="$t('addPlace.tagPlaceholder', 'e.g. Snack, Spicy')"
                        @ionInput="handleTagInput"
                        @keyup.enter="addTag"
                    />
                    <ion-button slot="end" fill="clear" @click="addTag" style="margin-top: 14px;">
                      {{ $t('common.add', 'Add') }}
                    </ion-button>
                  </ion-item>
                  <div v-if="form.tags.length > 0" class="tag-chips ion-padding-horizontal ion-padding-bottom" style="display: flex; flex-wrap: wrap; gap: 8px;">
                    <ion-chip v-for="tag in form.tags" :key="tag" color="primary" outline class="tag-chip" style="margin: 0;">
                      <ion-label>{{ tag }}</ion-label>
                      <ion-icon :icon="closeCircle" @click="removeTag(tag)" />
                    </ion-chip>
                  </div>
                </ion-card>
              </div>

              <!-- 📸 Section 5: Photos -->
              <div class="form-section">
                <ion-list-header>
                  <ion-label>{{ $t('addProduct.sections.photos') || 'Product Photos' }}</ion-label>
                </ion-list-header>

                <div class="photo-grid">
                  <!-- Front Photo -->
                  <ion-card class="photo-card" :class="{ 'has-photo': frontPreview }">
                    <div class="photo-card-header">
                       <ion-label>{{ $t('addProduct.frontImage') }}</ion-label>
                       <ion-buttons>
                          <ion-button @click="takeFrontPicture"><ion-icon :icon="cameraOutline" /></ion-button>
                          <ion-button @click="uploadFrontFromGallery"><ion-icon :icon="cloudUploadOutline" /></ion-button>
                       </ion-buttons>
                    </div>
                    <div v-if="frontPreview" class="photo-preview-wrap">
                      <img :src="frontPreview" class="thumbnail-img" />
                    </div>
                    <div v-else class="photo-placeholder">
                      <ion-icon :icon="cloudUploadOutline" />
                    </div>
                  </ion-card>

                  <!-- Back Photo -->
                  <ion-card class="photo-card" :class="{ 'has-photo': backPreview }">
                    <div class="photo-card-header">
                       <ion-label>{{ $t('addProduct.backImage') }}</ion-label>
                       <ion-buttons>
                          <ion-button @click="takeBackPicture"><ion-icon :icon="cameraOutline" /></ion-button>
                          <ion-button @click="uploadBackFromGallery"><ion-icon :icon="cloudUploadOutline" /></ion-button>
                       </ion-buttons>
                    </div>
                    <div v-if="backPreview" class="photo-preview-wrap">
                      <img :src="backPreview" class="thumbnail-img" />
                    </div>
                    <div v-else class="photo-placeholder">
                      <ion-icon :icon="cloudUploadOutline" />
                    </div>
                  </ion-card>
                </div>
              </div>

            </div>
        </div>

        <div v-if="currentStep === STEP_DETAILS">
          <ion-button expand="block" type="submit" class="ion-margin-top" color="carrot" :disabled="loading">
            {{ loading
              ? $t('addProduct.submitting')
              : (props.editProduct ? $t('addProduct.update') : $t('addProduct.submit')) }}
          </ion-button>
        </div>
        
        <!-- Navigation Buttons at the bottom for steps -->
        <div v-if="currentStep > 0 && !loading" style="display: flex; gap: 8px; margin-top: 16px;">
           <ion-button fill="outline" color="medium" style="flex: 1;" @click="prevStep">
             <ion-icon slot="start" :icon="arrowBackOutline" />
             {{ $t('addProduct.back') || 'Back' }}
           </ion-button>
           <ion-button 
             v-if="currentStep < STEP_DETAILS" 
             fill="solid" 
             color="carrot" 
             style="flex: 1;" 
             @click="nextStep"
             :disabled="currentStep === STEP_OCR && !backPreview"
            >
             {{ $t('addProduct.next') || 'Next' }}
             <ion-icon slot="end" :icon="arrowForwardOutline" />
           </ion-button>
        </div>

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
  IonAccordionGroup, IonNote, IonImg, IonThumbnail,
  IonSegment, IonSegmentButton, IonCard, IonCardHeader, IonCardContent, IonListHeader, IonFooter
} from '@ionic/vue';
import {
  addOutline,
  barcodeOutline,
  cameraOutline,
  cloudUploadOutline,
  checkmarkCircle,
  closeCircle,
  stopCircle,
  arrowForwardOutline,
  arrowBackOutline,
  sparklesOutline,
  checkmarkCircleOutline,
  expandOutline,
  squareOutline,
  phonePortraitOutline,
  tabletLandscapeOutline,
} from 'ionicons/icons';
import { computed, nextTick, onMounted, onUnmounted, ref, watch} from 'vue'
import { useI18n } from 'vue-i18n'
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
import { Geolocation } from '@capacitor/geolocation';
import googleMapsLoader from '@/plugins/googleMapsLoader'
import { useImageResizer } from "@/composables/useImageResizer";
import { useCropperOcr } from "@/composables/useCropperOcr"
import type { Product } from '@/types/Product'
import { useRouter, useRoute } from 'vue-router';
import StoreLogoBar from "@/components/StoreLogoBar.vue";
import { BarcodeValidator } from "@/utils/barcodeValidator";
import { ActivityLogService } from "@/services/ActivityLogService";

const { notifyEvent } = useNotifier();
const { awardAndCelebrate } = usePoints();
const { errorMsg, setError } = useError()
const { t } = useI18n()
const router = useRouter()
const route = useRoute()

/** ---------- Wizard Steps ---------- */
const STEP_BARCODE = 0
const STEP_OCR = 1
const STEP_DETAILS = 2
const currentStep = ref(STEP_BARCODE)
const wizardStartTime = ref<number>(Date.now())

const contentRef = ref<any>(null)

const scrollToTop = () => {
  nextTick(() => {
    contentRef.value?.$el.scrollToTop(300);
  });
}

const scrollToBottom = () => {
  nextTick(() => {
    contentRef.value?.$el.scrollToBottom(300);
  });
}

const nextStep = () => {
  if (currentStep.value < STEP_DETAILS) {
    if (currentStep.value === STEP_BARCODE) {
      stopScanner()
    }
    currentStep.value++
    scrollToTop()
    
    // Start detecting store early in background (Step 2)
    // to have it ready by Step 3
    if (currentStep.value === STEP_OCR || currentStep.value === STEP_DETAILS) {
      detectNearbyStore()
    }

    // Auto-sync description based on status when entering Step 3
    if (currentStep.value === STEP_DETAILS) {
      if (!userTouchedDescription.value || !form.value.description?.trim()) {
        programmaticDescUpdate.value = true
        form.value.description = statusDescriptions[form.value.status] ?? ""
        nextTick(() => { programmaticDescUpdate.value = false })
      }
    }
  }
}
const prevStep = () => {
  if (currentStep.value > STEP_BARCODE) {
    currentStep.value--
    scrollToTop()
  }
}

/** ---------- Nearby Store Detection ---------- */
const BRAND_ALIASES: Record<string, string[]> = {
  'Family Mart': ['Family Mart', 'FamilyMart', '全家'],
  'PX Mart': ['PX Mart', 'PXMart', '全聯'],
  '7-11': ['7-11', '7-Eleven', '7Eleven', '統一超商'],
  'Poya': ['Poya', '寶雅'],
  'Carrefour': ['Carrefour', '家樂福'],
  'Mia C\'bon': ['Mia C\'bon', 'Jasons'],
  'OK Mart': ['OK Mart', 'OKMart', 'OK超商'],
  'Hi-Life': ['Hi-Life', 'HiLife', '萊爾富'],
  'Simple Mart': ['Simple Mart', '美廉社'],
  'RT Mart': ['RT Mart', '大潤發'],
  'Watsons': ['Watsons', '屈臣氏'],
  'Costco': ['Costco', '好市多'],
  'Don Don Donki': ['Don Don Donki', '唐吉訶德'],
}

const detectNearbyStore = async () => {
  try {
    const perm = await Geolocation.checkPermissions()
    if (perm.location !== 'granted') {
      const req = await Geolocation.requestPermissions()
      if (req.location !== 'granted') return
    }

    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true
    })
    const { coords } = pos

    // 1. Try Google Maps Places (New API)
    try {
      await googleMapsLoader.load()
      const { Place } = await google.maps.importLibrary("places") as google.maps.PlacesLibrary;

      const { places } = await Place.searchNearby({
        fields: ['displayName', 'location'],
        locationRestriction: {
          center: { lat: coords.latitude, lng: coords.longitude },
          radius: 50,
        },
        includedPrimaryTypes: ['convenience_store', 'supermarket', 'store', 'department_store'],
        maxResultCount: 20
      });

      if (places && places.length > 0) {
        console.log('📍 Google Places (New) found:', places.map(r => r.displayName))
        
        for (const place of places) {
          const placeName = place.displayName || ''
          
          // Match place name against our brand aliases
          const brandName = Object.keys(BRAND_ALIASES).find(brand => 
            BRAND_ALIASES[brand].some(alias => 
              placeName.toLowerCase().includes(alias.toLowerCase())
            )
          )

          if (brandName) {
            const match = stores.value.find(s => s.name === brandName)
            if (match && !form.value.store_ids.includes(match.id)) {
              form.value.store_ids.push(match.id)
              return // Found!
            }
          }
        }
      }
    } catch (googleErr) {
      console.warn('Google Places search failed, falling back to DB', googleErr)
    }

    // 2. Fallback to local DB if Google found nothing or failed
    const range = 0.01; // Approx 1.1km
    const { data: nearLoc, error: locError } = await supabase
        .from('locations')
        .select('name, lat, lng')
        .gt('lat', coords.latitude - range)
        .lt('lat', coords.latitude + range)
        .gt('lng', coords.longitude - range)
        .lt('lng', coords.longitude + range)
        .limit(20)

    if (locError || !nearLoc) {
      applyOtherStoreFallback()
      return
    }

    const getDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371e3; 
      const dLat = (lat2-lat1) * Math.PI/180;
      const dLon = (lon2-lon1) * Math.PI/180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
      return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
    };

    let closest = null;
    let minDist = 150; // Use a more generous radius for DB fallback

    for (const loc of nearLoc) {
      const d = getDist(coords.latitude, coords.longitude, loc.lat, loc.lng);
      if (d < minDist) {
        minDist = d;
        closest = loc;
      }
    }

    if (closest) {
      const match = stores.value.find(s => 
        closest.name.toLowerCase().includes(s.name.toLowerCase()) ||
        s.name.toLowerCase().includes(closest.name.toLowerCase())
      );

      if (match && !form.value.store_ids.includes(match.id)) {
        form.value.store_ids.push(match.id);
      }
    }

    applyOtherStoreFallback()

  } catch (e) {
    console.warn('Geolocation failed', e);
    applyOtherStoreFallback()
  }
}

/** 🏪 Fallback to "Other Stores" if none detected */
function applyOtherStoreFallback() {
  if (form.value.store_ids.length === 0) {
    const OTHER_STORES_ID = '2a013308-190c-4684-a607-3bc3d7817115'
    const found = stores.value.find(s => s.id === OTHER_STORES_ID)
    if (found) {
      form.value.store_ids = [OTHER_STORES_ID]
      console.log("🏪 No nearby store found. Defaulted to Other Stores.")
    }
  }
}

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
  stencilProps,
  openCropper,
  onCropperReady,
  confirmCrop,
  closeCropper,
  ingredientsTextZh,
  ingredientsText,
  ingredientHighlights,
  autoStatus,
  productName,
  progress,
  progressLabel,
  setAspectRatio,
  recheckHighlightsSmart
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
    scrollToBottom() // 📜 Scroll immediately when preview starts appearing
  },
  onSuccess: () => {
    // Stay on Step 2 but scroll down to show the extracted ingredients & results
    scrollToBottom()
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
  if (blacklistResult.error || !blacklistResult.data) {
    console.warn('Blacklist fetch failed or empty');
  } else {
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
      store_ids: [],
      tags: props.editProduct.tags ?? []
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
  } else {
    // ⚡ Handle pre-filled barcode from query params (e.g. from ItemDetails lookup fail)
    if (route.query.barcode) {
      form.value.barcode = String(route.query.barcode)
      console.log("📥 Pre-filled barcode detected:", form.value.barcode)
    }

    // ⚡ Logic for "Contribute to Database" from ScanIngredientsView
    // ⚡ Auto-start barcode scanner for new products ONLY if barcode is empty
    setTimeout(() => {
        if (currentStep.value === STEP_BARCODE && !scanning.value && !form.value.barcode) {
            startBarcodeScan();
        }
    }, 800);
  }

  await fetchStores()
  await fetchHighlightsWithCache(true)
  await fetchCategoryRules()
  await fetchCategories()

  // 📥 Move pre-population AFTER rules are loaded so auto-category works!
  if (route.query.fromScan === 'true') {
    console.log("📥 Pre-populating from scan data:", route.query)
    if (route.query.name) form.value.name = String(route.query.name)
    if (route.query.ingredients) form.value.ingredients = String(route.query.ingredients)
    if (route.query.status) form.value.status = String(route.query.status)
    
    // 🖼️ Retrieve image if passed as Blob URL
    if (route.query.image) {
      try {
        const blobUrl = String(route.query.image)
        fetch(blobUrl).then(res => res.blob()).then(blob => {
          const file = new File([blob], "scanned-back.jpg", { type: blob.type })
          backFile.value = file
          backPreview.value = blobUrl
          console.log("✅ Scanned image recovered as Back Photo")
        })
      } catch (err) {
        console.warn("❌ Failed to recover scanned image:", err)
      }
    }

    // 🔬 Pre-populate Ingredient Analysis (Chips)
    if (route.query.analysis) {
       try {
         ingredientHighlights.value = JSON.parse(String(route.query.analysis))
         console.log("🔬 Analysis chips recovered:", ingredientHighlights.value.length)
       } catch (e) {
         console.warn("❌ Failed to parse analysis data:", e)
       }
    }

    // 📄 Pre-populate Raw OCR text
    if (route.query.rawOcr) {
      rawChineseOcr.value = String(route.query.rawOcr)
    }

    scannedOnce.value = true // Enable post-scan logic
    applyAutoCategory()      // Match category based on name (now rules are loaded!)
    detectNearbyStore()     // Detect closest store
  }

  ActivityLogService.log('add_product_start')
  wizardStartTime.value = Date.now() // Start the timer!
})

interface ProductForm {
  barcode: string
  name: string
  status: string
  product_category_id: number | null
  ingredients: string
  description: string
  store_ids: string[]   // ✅ string IDs
  tags: string[]
}

const form = ref<ProductForm>({
  barcode: '',
  name: '',
  status: 'Muslim-friendly',
  product_category_id: null,
  ingredients: '',
  description: '',
  store_ids: [],
  tags: []
})

const tagInput = ref('')

const handleTagInput = (e: any) => {
  const val = e.target.value
  if (val.endsWith(',')) {
    const tag = val.slice(0, -1).trim()
    if (tag && !form.value.tags.includes(tag)) {
      form.value.tags.push(tag)
    }
    tagInput.value = ''
  }
}

const addTag = (e?: any) => {
  if (e) e.preventDefault()
  const val = tagInput.value.trim().replace(/,/g, '')
  if (val && !form.value.tags.includes(val)) {
    form.value.tags.push(val)
  }
  tagInput.value = ''
}

const removeTag = (t: string) => {
  form.value.tags = form.value.tags.filter(tag => tag !== t)
}

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

      applyAutoCategory()
    }
)

function applyAutoCategory() {
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

  // Auto-advance to next step if new valid barcode found
  if (currentStep.value === STEP_BARCODE) {
    setTimeout(() => {
      nextStep()
    }, 500) // Small delay for UX so user sees the "Valid" checkmark
  }
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
const loadingReflection = ref<any>(null)

function calculateReadingTime(text: string) {
  const wordsPerMinute = 200;
  const words = (text || '').trim().split(/\s+/).length;
  const minutes = words / wordsPerMinute;
  const seconds = minutes * 60;
  // Return minimum 3 seconds, or more based on reading speed
  return Math.max(3000, Math.ceil(seconds * 1000));
}

async function fetchRandomReflection() {
  try {
    const { data, error } = await supabase
        .from('loading_reflections')
        .select('*')
        .eq('is_active', true);

    if (error) throw error;
    if (data && data.length > 0) {
      loadingReflection.value = data[Math.floor(Math.random() * data.length)];
    }
  } catch (err) {
    console.error('Error fetching reflections:', err);
  }
}

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
  ActivityLogService.log('add_product_ocr_start', { method: 'camera' })
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
      ActivityLogService.log('add_product_ocr_start', { method: 'gallery' })
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

async function stopScanner() {
  if (html5QrCodeInstance.value) {
    try {
       await html5QrCodeInstance.value.stop()
    } catch (e) {
       console.warn('⚠️ Scanner stop error:', e)
    } finally {
       const reader = document.getElementById('reader')
       if (reader) reader.innerHTML = ''
       html5QrCodeInstance.value = null
       scanning.value = false
    }
  }
}

async function switchCamera(camId: string) {
  if (!html5QrCodeInstance.value) return

  try {
    await stopScanner()
    
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
            // 🤫 Silence 'width is 0' errors that happen during transitions
            if (errorMessage?.includes('IndexSizeError') || errorMessage?.includes('width is 0')) {
              return
            }
            console.log('📡 Scan error:', errorMessage)
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
  stopScanner() // 🛑 Ensure camera is dead when leaving page
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

function applyQuickDescription(text: string) {
  form.value.description = text;
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



async function handleConfirmCrop() {
  try {
    await fetchRandomReflection()
    const reflectionStart = Date.now()

    await confirmCrop()

    // 🕊 Ensure reflection shown minimum time
    const reflectionElapsed = Date.now() - reflectionStart
    const minReflectionTime = calculateReadingTime(loadingReflection.value?.text_en || '')

    if (reflectionElapsed < minReflectionTime) {
      await new Promise(r => setTimeout(r, minReflectionTime - reflectionElapsed))
    }
    
    showOcrToast.value = true
  } catch (err: any) {
    setError(err.message || 'OCR failed')
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
      const userEmail = user?.email || 'Unknown'
      const userName = user?.user_metadata?.name || user?.user_metadata?.full_name || 'Unknown'

      if (autoApprove) {
        const elapsedSeconds = Math.floor((Date.now() - wizardStartTime.value) / 1000)

        // 🟢 Admin/Contributor → public notification
        await notifyEvent(
            "new_product",
            "🆕 New Product Published!",
            `${form.value.name} (${form.value.status})\nBarcode: ${form.value.barcode}\nProcessed in: ${elapsedSeconds} seconds\nAdded by: ${userName} (${userEmail})`,
            frontUrl || backUrl,
            {
              barcode: form.value.barcode,
              status: form.value.status,
              isNative: true,
              processing_time: elapsedSeconds,
              added_by: userEmail,
              user_id: user?.id
            }
        );
      } else {
        // 🔴 Non-admin → notify Discord admins only
        await notifyEvent(
            "product_needs_review",
            "🔍 Product Needs Review",
            `${form.value.name} (${form.value.status})\nBarcode: ${form.value.barcode}\nSubmitted by: ${userName} (${userEmail})\nAwaiting approval.`,
            frontUrl || backUrl,
            {
              barcode: form.value.barcode,
              status: form.value.status,
              isNative: true,
              added_by: userEmail,
              user_id: user?.id
            },
            ['discord']
        );
      }

      // ✅ Log first, reset after
      await ActivityLogService.log("add_product_success", {
        barcode: barcode,
        name: productData.name,
        status: productData.status
      })

      // reset form
      form.value = { barcode: '', name: '', status: 'Muslim-friendly',
        product_category_id: null, ingredients: '', description: '', store_ids: [], tags: [] }
      frontFile.value = null; backFile.value = null
      frontPreview.value = null; backPreview.value = null
      ingredientHighlights.value = []; barcodeValid.value = null; barcodeMessage.value = ''
      
      // Reset wizard state
      detectedProduct.value = null
      scannedOnce.value = false
      rawChineseOcr.value = ''
      autoStatusApplied.value = false
      userTouchedDescription.value = false
      currentStep.value = STEP_BARCODE
      scrollToTop()

      wizardStartTime.value = Date.now() // Reset timer for next product
      await awardAndCelebrate("add_product", 10000)
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

</style>

<style scoped>
.form-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  background-color: var(--ion-background-color); /* Base background for form content */
  padding-bottom: 32px;
}

.details-wizard-step {
  padding-top: 8px;
}

.form-section {
  margin-bottom: 8px;
}

.form-section ion-list-header {
  padding-inline-start: 16px;
  min-height: 32px;
  margin-bottom: 4px;
}

.form-section ion-list-header ion-label {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--ion-color-medium);
}

.input-card {
  margin: 0 12px;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
  background: var(--ion-card-background, white);
  border: 1px solid var(--ion-color-light-shade);
}

.input-card ion-item {
  --background-active: transparent;
  --ripple-color: transparent;
}

.preview-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--ion-color-medium);
}

.preview-container {
  margin-top: 10px;
  position: relative;
  display: inline-block;
}

.large-preview-img {
  max-height: 320px;
  width: auto;
  border-radius: 12px;
  border: 1px solid var(--ion-color-light-shade);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.preview-remove-btn {
  position: absolute;
  top: -10px;
  right: -10px;
  margin: 0;
}



.full-width-select {
  width: 100%;
}

.analysis-indicators {
  margin-top: -8px;
  margin-bottom: 8px;
}

.mini-progress {
  height: 4px;
  border-radius: 2px;
  margin-top: 4px;
}

.highlights-preview {
  background: var(--ion-color-light-tint);
  border-top: 1px solid var(--ion-color-light-shade);
}

.compact-chip {
  height: 24px;
  font-size: 11px;
  font-weight: 600;
  margin: 2px;
}

.toggle-friendly-btn {
  --padding-start: 0;
  font-size: 12px;
  height: 24px;
}

.friendly-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.accordion-header {
  --background: transparent;
  font-size: 14px;
}

.raw-ocr-text {
  display: block;
  font-family: monospace;
  font-size: 12px;
  background: var(--ion-color-light);
  padding: 12px;
  border-radius: 8px;
  word-break: break-all;
  max-height: 120px;
  overflow-y: auto;
  color: var(--ion-color-medium);
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
  font-size: 11px;
  margin: 0;
}

.photo-grid {
  display: flex;
  gap: 12px;
  padding: 0 12px;
}

.photo-card {
  flex: 1;
  margin: 0;
  border-radius: 16px;
  border: 1px dashed var(--ion-color-medium-shade);
  background: var(--ion-color-light-tint);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: all 0.2s ease;
}

.photo-card.has-photo {
  border-style: solid;
  border-color: var(--ion-color-primary-tint);
}

.photo-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(var(--ion-color-light-rgb), 0.5);
}

.photo-card-header ion-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--ion-color-medium);
}

.photo-card-header ion-button {
  --padding-start: 4px;
  --padding-end: 4px;
  height: 28px;
  font-size: 16px;
}

.photo-preview-wrap {
  height: 140px;
  width: 100%;
}

.thumbnail-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-placeholder {
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  color: var(--ion-color-medium-shade);
  opacity: 0.5;
}

.detected-product {
  --background: var(--ion-color-light);
  margin: 12px 16px;
  border-radius: 12px;
  border: 1px solid var(--ion-color-primary-tint);
}

/* 🟢 Step Indicator */
ion-header {
  overflow: visible;
}

#step-indicator {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 12px 16px 16px;
  background: var(--ion-background-color);
  border-bottom: 1px solid var(--ion-color-light);
}

.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.step-item.active .step-label {
  color: var(--ion-color-carrot);
  font-weight: 600;
}

.step-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--ion-color-light);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: var(--ion-color-medium);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.step-item.active .step-dot {
  background: var(--ion-color-carrot);
  color: white;
  box-shadow: 0 4px 12px rgba(216, 98, 13, 0.3);
  transform: scale(1.1);
}

.step-label {
  font-size: 11px;
  color: var(--ion-color-medium);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.step-line {
  height: 2px;
  width: 32px;
  background: var(--ion-color-light);
  margin: 16px 2px 0;
  transition: background 0.3s ease;
}

.step-line.active {
  background: var(--ion-color-carrot);
}

/* 🔹 OCR Loading Overlay */
.ocr-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(6px);
  z-index: 9999;

  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;

  padding: 24px;
  color: white;
}

.reflection-box {
  margin-top: 24px;
  max-width: 340px;
  animation: fadeInUp 0.5s ease-out;
}

.reflection-ar {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.6;
  margin-bottom: 12px;
}

.reflection-en {
  font-style: italic;
  font-size: 16px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.9);
}

.reflection-ref {
  display: block;
  margin-top: 12px;
  font-size: 13px;
  opacity: 0.7;
}

.ocr-progress {
  width: 260px;
  height: 8px;
  border-radius: 10px;
  margin-bottom: 12px;
}

.ocr-progress-text {
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.5px;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeInOverlay {
  from { opacity: 0; }
  to { opacity: 1; }
}

.ocr-overlay {
  animation: fadeInOverlay 0.3s ease;
}

.barcode-valid {
  --border-color: var(--ion-color-success) !important;
}

.barcode-invalid {
  --border-color: var(--ion-color-danger) !important;
}

.quick-scroll-container {
  display: flex;
  overflow-x: auto;
  gap: 8px;
  padding-bottom: 8px;
}

.quick-scroll-container::-webkit-scrollbar {
  display: none;
}

ion-toast {
  transform: translateY(-55px);
}

#reader {
  width: 100%;
  height: 260px;
  border-radius: 8px;
  overflow: hidden;
  margin: 12px auto;
  background: #000;
  position: relative;
}

/* kill any unwanted modal overlay injected by html5-qrcode */
#reader__scan_region,
#reader__dashboard_section_csr {
  position: relative !important;
  inset: auto !important;
  max-width: 100% !important;
  border: none !important;
}

/* For larger screens */
@media (min-width: 768px) {
  #reader {
    width: 400px;
    height: 300px;
    border-radius: 8px;
  }
}

ion-item {
  --background: transparent;
}

ion-content::part(scroll) {
  padding-bottom: 100px;
}

.keyboard-open ion-footer {
  margin-bottom: 300px;
}

/* 🛠️ Smart Cropping Ratios */
.ratio-toolbar {
  display: flex;
  justify-content: center; /* 🎯 Center buttons */
  gap: 8px;
  overflow-x: auto;
  padding-top: 12px;
  padding-bottom: 8px;
  scrollbar-width: none;
  background: var(--ion-background-color);
}
.ratio-toolbar::-webkit-scrollbar {
  display: none;
}
.ratio-btn {
  --padding-start: 12px;
  --padding-end: 12px;
  --border-radius: 20px;
  height: 32px;
  font-size: 13px;
  margin: 0;
  flex-shrink: 0;
  text-transform: none;
}

/* Mandatory height for vue-advanced-cropper to function */
.cropper {
  height: 60vh;
  width: 100%;
  background: #000;
  touch-action: none; /* 🚫 Prevent browser scroll interference */
}

/* 🔒 Lock scrolling when cropper is open */
.modal-no-scroll {
  --overflow: hidden;
}
</style>

