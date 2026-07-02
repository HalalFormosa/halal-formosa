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
      <!-- Limit Reached Block Card -->
      <div v-if="limitReached && !props.editProduct" class="limit-reached-container animate__animated animate__fadeIn" style="display: flex; align-items: center; justify-content: center; height: 100%; min-height: 350px;">
        <ion-card style="margin: 0; box-shadow: none; border: 1px solid var(--ion-color-light); border-radius: 12px; text-align: center; max-width: 400px; width: 100%;" class="ion-padding">
          <div class="lock-icon-wrapper" style="margin: 16px auto;">
            <ion-icon :icon="lockClosedOutline" style="font-size: 56px; color: var(--ion-color-carrot);" />
          </div>
          <h2 style="font-weight: 700; font-size: 1.35rem; margin-top: 0; margin-bottom: 12px;">Daily Limit Reached</h2>
          <p style="color: var(--ion-color-medium); line-height: 1.5; font-size: 0.95rem; margin-bottom: 24px; padding: 0 8px;">
            You have reached your daily limit of 3 contributed products. To maintain database quality, you can submit more products tomorrow. Thank you for helping the community!
          </p>
          <ion-button expand="block" color="carrot" @click="router.back()">
            Go Back
          </ion-button>
        </ion-card>
      </div>

      <div v-else>
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

              <!-- 🔄 Barcode Verification Loading -->
              <div v-if="barcodeLoading" class="ion-text-center ion-padding">
                <ion-spinner name="crescent" color="carrot" />
                <p style="font-size: 13px; color: var(--ion-color-medium); margin-top: 8px;">
                  {{ $t('addProduct.verifyingBarcode') || 'Verifying barcode...' }}
                </p>
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
                   <img :src="backPreview" class="large-preview-img" @load="scrollToBottom" @click="openFullscreenImage(1)" style="cursor: pointer;" />
                   <div class="preview-actions-overlay">
                     <ion-button v-if="isBackCleaned" type="button" size="small" color="warning" fill="solid" @click="restoreOriginalImage('back')" class="preview-action-btn" :title="$t('addProduct.photoActions.restoreOriginal') || 'Original Photo'">
                       <ion-icon :icon="refreshOutline" />
                     </ion-button>
                     <ion-button type="button" size="small" color="primary" fill="solid" @click="rotateImage('back')" :disabled="rotatingBack" class="preview-action-btn" :title="$t('addProduct.photoActions.rotate') || 'Rotate'">
                       <ion-spinner v-if="rotatingBack" name="crescent"></ion-spinner>
                       <ion-icon v-else :icon="syncOutline" />
                     </ion-button>
                     <ion-button type="button" size="small" color="primary" fill="solid" @click="cleanBackgroundImage('back')" :disabled="cleaningBack" class="preview-action-btn" :title="$t('addProduct.photoActions.cleanBg') || 'AI Clean BG'">
                       <ion-spinner v-if="cleaningBack" name="crescent"></ion-spinner>
                       <ion-icon v-else :icon="colorWandOutline" />
                     </ion-button>
                     <ion-button type="button" size="small" color="danger" fill="solid" @click="backPreview = null; backFile = null; originalBackPreview = null; originalBackFile = null" class="preview-action-btn" :title="$t('addProduct.photoActions.remove') || 'Remove'">
                       <ion-icon :icon="closeCircle" />
                     </ion-button>
                   </div>
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
                          v-for="(h, idx) in dangerousHighlights"
                          :key="idx"
                          class="compact-chip"
                          :class="['chip-' + extractIonColor(h.color)]"
                       >
                         {{ h.keyword }}
                       </ion-chip>
                       
                       <div v-if="hasFriendlyHighlights" class="ion-margin-top">
                         <ion-button fill="clear" size="small" @click="showMuslimFriendly = !showMuslimFriendly" class="toggle-friendly-btn">
                           {{ showMuslimFriendly ? 'Hide Friendly' : 'Show Friendly' }}
                         </ion-button>
                         <div v-if="showMuslimFriendly" class="friendly-chips">
                            <ion-chip
                              v-for="(h, idx) in friendlyHighlights"
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

                    <ion-item lines="none" button @click="categoryModalOpen = true">
                      <ion-label>
                        <div style="font-size: 13px; color: var(--ion-color-medium); margin-bottom: 2px;">
                          {{ $t('addProduct.category') }} <ion-text color="danger">*</ion-text>
                        </div>
                        <div style="font-size: 16px; color: var(--ion-color-dark); font-weight: 500;">
                          {{ selectedCategoryName || 'Select a Category...' }}
                        </div>
                      </ion-label>
                      <ion-icon :icon="chevronForwardOutline" slot="end" style="color: var(--ion-color-medium); font-size: 18px;" />
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
                       <ion-label class="photo-title">{{ $t('addProduct.frontImage') }}</ion-label>
                    </div>
                    <div v-if="frontPreview" class="photo-preview-wrap">
                      <img :src="frontPreview" class="thumbnail-img" @click="openFullscreenImage(0)" style="cursor: pointer;" />
                    </div>
                    <div v-if="frontPreview" class="photo-controls">
                      <button type="button" class="control-btn ai-btn" @click.stop="cleanBackgroundImage('front')" :disabled="cleaningFront">
                        <div v-if="cleaningFront" class="ai-progress-container">
                          <span class="ai-progress-text">{{ progressStatus || 'Processing AI...' }}</span>
                          <ion-progress-bar :value="progressPercent / 100" class="ai-bar"></ion-progress-bar>
                        </div>
                        <template v-else>
                          <ion-icon :icon="colorWandOutline" />
                          <span>{{ $t('addProduct.photoActions.cleanBg') || 'AI Clean BG' }}</span>
                        </template>
                      </button>
                      <div class="control-row">
                        <button v-if="isFrontCleaned" type="button" class="control-sub-btn warning" @click.stop="restoreOriginalImage('front')" :title="$t('addProduct.photoActions.restoreOriginal') || 'Original Photo'">
                          <ion-icon :icon="refreshOutline" />
                        </button>
                        <button type="button" class="control-sub-btn" @click.stop="takeFrontPicture" :title="$t('addProduct.photoActions.takePhoto') || 'Retake'">
                          <ion-icon :icon="cameraOutline" />
                        </button>
                        <button type="button" class="control-sub-btn" @click.stop="rotateImage('front')" :disabled="rotatingFront" :title="$t('addProduct.photoActions.rotate') || 'Rotate'">
                          <ion-spinner v-if="rotatingFront" name="crescent" class="btn-spinner"></ion-spinner>
                          <ion-icon v-else :icon="syncOutline" />
                        </button>
                        <button type="button" class="control-sub-btn danger" @click.stop="frontPreview = null; frontFile = null; originalFrontPreview = null; originalFrontFile = null" :title="$t('addProduct.photoActions.remove') || 'Remove'">
                          <ion-icon :icon="trashOutline" />
                        </button>
                      </div>
                    </div>
                    <div v-else class="photo-placeholder">
                      <div class="placeholder-actions">
                        <button type="button" class="placeholder-btn" @click="takeFrontPicture">
                          <ion-icon :icon="cameraOutline" />
                          <span>{{ $t('addProduct.photoActions.takePhoto') || 'Camera' }}</span>
                        </button>
                        <button type="button" class="placeholder-btn" @click="uploadFrontFromGallery">
                          <ion-icon :icon="cloudUploadOutline" />
                          <span>{{ $t('addProduct.photoActions.uploadPhoto') || 'Upload' }}</span>
                        </button>
                      </div>
                    </div>
                  </ion-card>

                  <!-- Back Photo -->
                  <ion-card class="photo-card" :class="{ 'has-photo': backPreview }">
                    <div class="photo-card-header">
                       <ion-label class="photo-title">{{ $t('addProduct.backImage') }}</ion-label>
                    </div>
                    <div v-if="backPreview" class="photo-preview-wrap">
                      <img :src="backPreview" class="thumbnail-img" @click="openFullscreenImage(1)" style="cursor: pointer;" />
                    </div>
                    <div v-if="backPreview" class="photo-controls">
                      <button type="button" class="control-btn ai-btn" @click.stop="cleanBackgroundImage('back')" :disabled="cleaningBack">
                        <div v-if="cleaningBack" class="ai-progress-container">
                          <span class="ai-progress-text">{{ progressStatus || 'Processing AI...' }}</span>
                          <ion-progress-bar :value="progressPercent / 100" class="ai-bar"></ion-progress-bar>
                        </div>
                        <template v-else>
                          <ion-icon :icon="colorWandOutline" />
                          <span>{{ $t('addProduct.photoActions.cleanBg') || 'AI Clean BG' }}</span>
                        </template>
                      </button>
                      <div class="control-row">
                        <button v-if="isBackCleaned" type="button" class="control-sub-btn warning" @click.stop="restoreOriginalImage('back')" :title="$t('addProduct.photoActions.restoreOriginal') || 'Original Photo'">
                          <ion-icon :icon="refreshOutline" />
                        </button>
                        <button type="button" class="control-sub-btn" @click.stop="takeBackPicture" :title="$t('addProduct.photoActions.takePhoto') || 'Retake'">
                          <ion-icon :icon="cameraOutline" />
                        </button>
                        <button type="button" class="control-sub-btn" @click.stop="rotateImage('back')" :disabled="rotatingBack" :title="$t('addProduct.photoActions.rotate') || 'Rotate'">
                          <ion-spinner v-if="rotatingBack" name="crescent" class="btn-spinner"></ion-spinner>
                          <ion-icon v-else :icon="syncOutline" />
                        </button>
                        <button type="button" class="control-sub-btn danger" @click.stop="backPreview = null; backFile = null; originalBackPreview = null; originalBackFile = null" :title="$t('addProduct.photoActions.remove') || 'Remove'">
                          <ion-icon :icon="trashOutline" />
                        </button>
                      </div>
                    </div>
                    <div v-else class="photo-placeholder">
                      <div class="placeholder-actions">
                        <button type="button" class="placeholder-btn" @click="takeBackPicture">
                          <ion-icon :icon="cameraOutline" />
                          <span>{{ $t('addProduct.photoActions.takePhoto') || 'Camera' }}</span>
                        </button>
                        <button type="button" class="placeholder-btn" @click="uploadBackFromGallery">
                          <ion-icon :icon="cloudUploadOutline" />
                          <span>{{ $t('addProduct.photoActions.uploadPhoto') || 'Upload' }}</span>
                        </button>
                      </div>
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
              :modules="swiperModules"
              :zoom="true"
              :slides-per-view="1"
              :pagination="{ clickable: true }"
              :initial-slide="activeImageIndex"
              class="fullscreen-swiper"
          >
            <SwiperSlide v-if="frontPreview">
              <div class="swiper-zoom-container">
                <img :src="frontPreview" :alt="$t('review.frontImageAlt') || 'Front Image'" />
              </div>
            </SwiperSlide>
            <SwiperSlide v-if="backPreview">
              <div class="swiper-zoom-container">
                <img :src="backPreview" :alt="$t('review.backImageAlt') || 'Back Image'" />
              </div>
            </SwiperSlide>
          </Swiper>
        </ion-content>
      </ion-modal>

      <!-- 📂 Category Search & Select Modal -->
      <ion-modal :is-open="categoryModalOpen" @didDismiss="categoryModalOpen = false">
        <ion-header>
          <ion-toolbar color="light">
            <ion-title>{{ $t('addProduct.selectCategory') || 'Select Category' }}</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="categoryModalOpen = false">{{ $t('common.cancel') || 'Cancel' }}</ion-button>
            </ion-buttons>
          </ion-toolbar>
          <ion-toolbar color="light">
            <ion-searchbar
              v-model="categoryQuery"
              :placeholder="$t('addProduct.searchCategoryPlaceholder') || 'Search categories...'"
              animated
            />
          </ion-toolbar>
        </ion-header>
        <ion-content>
          <ion-list lines="full">
            <ion-item 
              v-for="cat in filteredCategories" 
              :key="cat.id" 
              button 
              :detail="false"
              @click="selectCategory(cat)"
              :class="{ 'selected-category-item': form.product_category_id === cat.id }"
            >
              <ion-label style="font-weight: 600;">
                {{ cat.name }}
              </ion-label>
              <ion-icon 
                v-if="form.product_category_id === cat.id" 
                slot="end" 
                :icon="checkmarkCircle" 
                color="success" 
              />
            </ion-item>
            <ion-item v-if="filteredCategories.length === 0" lines="none" class="ion-text-center">
              <ion-label color="medium">No categories found</ion-label>
            </ion-item>
          </ion-list>
        </ion-content>
      </ion-modal>
      </div>
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
  IonSegment, IonSegmentButton, IonCard, IonCardHeader, IonCardContent, IonListHeader, IonFooter,
  IonSearchbar, IonList, onIonViewWillEnter
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
  syncOutline,
  colorWandOutline,
  trashOutline,
  refreshOutline,
  chevronForwardOutline,
  lockClosedOutline
} from 'ionicons/icons';
import { computed, nextTick, onMounted, onUnmounted, ref, watch} from 'vue'
import { useI18n } from 'vue-i18n'
import {supabase, invokeFunction} from '@/plugins/supabaseClient'
import { awardScanBonus, isContributionLimitReached } from '@/composables/useScanQuotaReward';

import { Capacitor } from '@capacitor/core'
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { extractIonColor, colorMeaning } from '@/utils/ingredientHelpers'

// Import Camera plugin and types
import {Camera, CameraDirection, CameraResultType, CameraSource} from '@capacitor/camera'
import {Cropper} from 'vue-advanced-cropper';
import 'vue-advanced-cropper/dist/style.css';
import { Swiper, SwiperSlide } from 'swiper/vue';
import { Pagination, Zoom } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/zoom';
import AppHeader from "@/components/AppHeader.vue";

import useHighlightCache from '@/composables/useHighlightCache'
import useError from '@/composables/useError'
import { userRole, setUserRole } from '@/composables/userProfile'
import { usePoints } from "@/composables/usePoints";
import { useNotifier } from "@/composables/useNotifier";
import { useImageResizer } from "@/composables/useImageResizer";
import { useBackgroundRemoval } from "@/composables/useBackgroundRemoval";
import { useCropperOcr } from "@/composables/useCropperOcr"
import type { Product } from '@/types/Product'
import { useRouter, useRoute } from 'vue-router';
import type { IngredientHighlight } from '@/types/Ingredient'
import StoreLogoBar from "@/components/StoreLogoBar.vue";
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

const limitReached = ref(false)

onIonViewWillEnter(async () => {
  limitReached.value = await isContributionLimitReached()
})

/** ---------- State Variables Consistently Defined at Top ---------- */
const barcodeValid = ref<null | boolean>(null)
const barcodeMessage = ref<string>('') // feedback below input
const scanning = ref(false)
const scannedOnce = ref(false);
const loading = ref(false)
const showToast = ref(false)
const showOcrToast = ref(false);
const showErrorToast = ref(false)
const toastMessage = ref('')
const rawChineseOcr = ref('')
const originalFile = ref<File | null>(null)
const loadingReflection = ref<any>(null)
const isResettingForm = ref(false)
const autoStatusApplied = ref(false)
const userTouchedDescription = ref(false)
const programmaticDescUpdate = ref(false)
const frontFile = ref < File | null > (null)
const backFile = ref < File | null > (null)
const frontPreview = ref < string | null > (null)
const backPreview = ref < string | null > (null)
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
const { removeAndAddWhiteBg, preloadAIModel, progressPercent, progressStatus } = useBackgroundRemoval()

async function cleanBackgroundImage(type: 'front' | 'back') {
  const previewRef = type === 'front' ? frontPreview : backPreview;
  const fileRef = type === 'front' ? frontFile : backFile;
  const cleaningProp = type === 'front' ? cleaningFront : cleaningBack;

  const currentSrc = fileRef.value || previewRef.value;
  if (!currentSrc || (typeof currentSrc === 'string' && currentSrc.includes('placehold.co'))) return;

  cleaningProp.value = true;

  try {
    const { file, previewUrl } = await removeAndAddWhiteBg(currentSrc, `${type}_clean.jpg`);
    fileRef.value = file;
    previewRef.value = previewUrl;
  } catch (err) {
    console.error(`❌ Failed to remove background for ${type}:`, err);
    alert(t('common.error') || 'Failed to remove background. Please try again.');
  } finally {
    cleaningProp.value = false;
  }
}

const swiperModules = [Pagination, Zoom]
const showImageModal = ref(false)
const activeImageIndex = ref(0)

function openFullscreenImage(index: number) {
  activeImageIndex.value = index
  showImageModal.value = true
}

async function rotateImage(type: 'front' | 'back') {
  const previewRef = type === 'front' ? frontPreview : backPreview;
  const fileRef = type === 'front' ? frontFile : backFile;
  const rotatingProp = type === 'front' ? rotatingFront : rotatingBack;

  const src = previewRef.value;
  if (!src || src.includes('placehold.co')) return;

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
    previewRef.value = dataUrl;

    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], `${type}.jpg`, { type: 'image/jpeg' });
    fileRef.value = file;
  } catch (err) {
    console.error(`❌ Error rotating ${type} image:`, err);
  } finally {
    rotatingProp.value = false;
  }
}
const tagInput = ref('')
const categories = ref<{ id: number; name: string }[]>([])
const categoryModalOpen = ref(false)
const categoryQuery = ref('')

const filteredCategories = computed(() => {
  const q = categoryQuery.value.trim().toLowerCase()
  if (!q) return categories.value
  return categories.value.filter(cat => cat.name.toLowerCase().includes(q))
})

const selectedCategoryName = computed(() => {
  const matched = categories.value.find(cat => cat.id === form.value.product_category_id)
  return matched ? matched.name : ''
})

function selectCategory(cat: { id: number; name: string }) {
  form.value.product_category_id = cat.id
  categoryModalOpen.value = false
  categoryQuery.value = ''
}
const stores = ref<{ id: string; name: string; logo_url?: string }[]>([])
const checkingIngredients = ref(false)
const selectedCameraId = ref<string | null>(null)
const cameras = ref<{ id: string; label: string }[]>([])
const categoryRules = ref<Record<string, number>>({})
const html5QrCodeInstance = ref<Html5Qrcode | null>(null)
const barcodeLoading = ref(false)
const derivedNameTags = ref<string[]>([]) // 🏷️ Track tags derived from name to update them dynamically
const derivedCategoryTag = ref<string | null>(null) // 🏷️ Track tag derived from category to update dynamically

interface ProductForm {
  barcode: string
  name: string
  status: string
  product_category_id: number | null
  ingredients: string
  description: string
  store_ids: string[]
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

const barcodeInput = ref<any>(null)
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
  console.log("🚶 Moving to next step. Current:", currentStep.value);
  if (currentStep.value < STEP_DETAILS) {
    if (currentStep.value === STEP_BARCODE) {
      stopScanner()
    }
    currentStep.value++
    scrollToTop()
    
    // Default to fallback store if none selected
    if (currentStep.value === STEP_OCR || currentStep.value === STEP_DETAILS) {
      applyOtherStoreFallback()
    }

    // Auto-sync description based on status when entering Step 3
    if (currentStep.value === STEP_DETAILS) {
      if (!userTouchedDescription.value || !form.value.description?.trim()) {
        programmaticDescUpdate.value = true
        form.value.description = statusDescriptions[form.value.status] ?? ""
        nextTick(() => { programmaticDescUpdate.value = false })
      }
      prefillTags() // 🏷️ Pre-fill tags based on name, category, etc.
    }
  }
}
const prevStep = () => {
  if (currentStep.value > STEP_BARCODE) {
    currentStep.value--
    scrollToTop()
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

// refs moved to top
const { resizeImage } = useImageResizer();
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
  t,
  setBackFile: (file: File) => {
    backFile.value = file
    if (backPreview.value) {
      URL.revokeObjectURL(backPreview.value)
    }
    backPreview.value = URL.createObjectURL(file) // ✅ show preview
    originalBackFile.value = file
    originalBackPreview.value = backPreview.value
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

const dangerousHighlights = computed(() => 
  ingredientHighlights.value.filter((h: IngredientHighlight) => extractIonColor(h.color) !== 'primary')
)
const friendlyHighlights = computed(() => 
  ingredientHighlights.value.filter((h: IngredientHighlight) => extractIonColor(h.color) === 'primary')
)
const hasFriendlyHighlights = computed(() => 
  ingredientHighlights.value.some((h: IngredientHighlight) => extractIonColor(h.color) === 'primary')
)


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
    originalFrontPreview.value = frontPreview.value
    originalBackPreview.value = backPreview.value

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
          originalBackFile.value = file
          originalBackPreview.value = blobUrl
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
    applyOtherStoreFallback() // Default to fallback store
  }

  ActivityLogService.log('add_product_start')
  wizardStartTime.value = Date.now() // Start the timer!
})

// refs moved to top

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

// categoryRules moved to top

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

/** 🏷️ Pre-fill tags based on Name (2 words), Category (1 word), and Smart Choice */
function prefillTags() {
  // Only prefill if tags are empty (avoid overwriting user input or during edit)
  if (form.value.tags.length > 0 || props.editProduct) return;

  const newTags: string[] = [];

  // 1. 2 words from name
  if (form.value.name) {
    // Split by non-alphanumeric/spaces, filter out very short words
    const words = form.value.name.split(/[^\w\u4e00-\u9fa5]+/).filter(w => w.length >= 1);
    if (words.length > 0) newTags.push(words[0]);
    if (words.length > 1) newTags.push(words[1]);
  }

  // 2. 1 word from category
  if (form.value.product_category_id) {
    const cat = categories.value.find(c => c.id === form.value.product_category_id);
    if (cat && cat.name) {
      const catWord = cat.name.split(/\s+/)[0];
      if (!newTags.includes(catWord)) {
        newTags.push(catWord);
        derivedCategoryTag.value = catWord; // 🏷️ Store for dynamic syncing
      }
    }
  }

  // 3. Smart choice
  let smartTag = '';
  if (ingredientHighlights.value.length > 0) {
    // Pick the first interesting highlight keyword
    smartTag = ingredientHighlights.value[0].keyword;
  } else if (form.value.name) {
    const words = form.value.name.split(/[^\w\u4e00-\u9fa5]+/).filter(w => w.length >= 1);
    if (words.length > 2) smartTag = words[2];
  }

  if (smartTag && !newTags.includes(smartTag)) {
    newTags.push(smartTag);
  }

  form.value.tags = [...new Set(newTags)].filter(t => !!t);
  derivedNameTags.value = newTags.slice(0, 2); // 🏷️ Store the name-based ones
  console.log("🏷️ Tags pre-filled:", form.value.tags);
}

/** 🏷️ Update only the tags derived from the name when the name changes */
function syncNameTags(newName: string) {
  if (props.editProduct || !newName) return;

  // 1. Extract new candidate tags from name
  const words = newName.split(/[^\w\u4e00-\u9fa5]+/).filter(w => w.length >= 1);
  const newNameTags = words.slice(0, 2);

  // 2. Remove tags that were previously derived from name (if they are still in form.tags)
  const filteredTags = form.value.tags.filter(t => !derivedNameTags.value.includes(t));

  // 3. Add new name-derived tags
  const updatedTags = [...filteredTags];
  newNameTags.forEach(nt => {
    if (!updatedTags.includes(nt)) {
      updatedTags.push(nt);
    }
  });

  // 4. Update state
  form.value.tags = updatedTags;
  derivedNameTags.value = newNameTags;
  console.log("🏷️ Tags synced with new name:", form.value.tags);
}

/** 🏷️ Update the tag derived from the category when it changes */
function syncCategoryTag(newCatId: number | null) {
  if (props.editProduct) return;

  // 1. Get new candidate tag from category
  const cat = categories.value.find(c => c.id === newCatId);
  const newCatWord = cat?.name ? cat.name.split(/\s+/)[0] : null;

  // 2. Remove old category-derived tag
  let updatedTags = [...form.value.tags];
  if (derivedCategoryTag.value) {
    updatedTags = updatedTags.filter(t => t !== derivedCategoryTag.value);
  }

  // 3. Add new category tag
  if (newCatWord && !updatedTags.includes(newCatWord)) {
    updatedTags.push(newCatWord);
  }

  // 4. Update state
  form.value.tags = updatedTags;
  derivedCategoryTag.value = newCatWord;
  console.log("🏷️ Tags synced with new category:", form.value.tags);
}

// Watch for manual name changes to update tags
watch(() => form.value.name, (newName) => {
  if (currentStep.value === STEP_DETAILS) {
    syncNameTags(newName);
  }
});

// Watch for category changes to update tags
watch(() => form.value.product_category_id, (newCatId) => {
  if (currentStep.value === STEP_DETAILS) {
    syncCategoryTag(newCatId);
  }
});

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
  console.log("🔍 Barcode watcher triggered with:", newBarcode);
  if (!newBarcode) {
    barcodeValid.value = null;
    barcodeMessage.value = "";
    detectedProduct.value = null;
    return;
  }

  try {
    // 🕊️ Safety: Wait a bit for the app to fully resume and auth state to settle
    // especially when coming back from the native camera.
    await new Promise(resolve => setTimeout(resolve, 500));
    
    barcodeLoading.value = true;

    // 🚫 Check duplicates in our own DB first (when creating)
    if (!props.editProduct) {
      console.log("📡 Checking for existing product in DB...");
      const existingProduct = await checkBarcodeExists(newBarcode);

      if (existingProduct) {
        console.log("⚠️ Product already exists:", existingProduct.name);
        barcodeValid.value = false;
        barcodeMessage.value = "⚠️ Product already exists";
        detectedProduct.value = {
          id: existingProduct.id,
          name: existingProduct.name,
          status: existingProduct.status,
          photo_front_url: existingProduct.photo_front_url,
        };
        barcodeLoading.value = false;
        return;
      }
      detectedProduct.value = null;
    }

    // 🌐 Call Edge Function → Open Food Facts
    console.log("🌐 Calling verify-barcode edge function...");
    const { data, error } = await invokeFunction('verify-barcode', {
      body: { barcode: newBarcode },
    });

    if (error) {
      console.error("❌ Edge function error:", error);
      // Fallback: accept numeric barcodes
      if (/^\d{8,15}$/.test(newBarcode.trim())) {
        barcodeValid.value = true;
        barcodeMessage.value = "✅ Barcode accepted";
      } else {
        barcodeValid.value = false;
        barcodeMessage.value = "❌ Could not verify barcode";
      }
      barcodeLoading.value = false;
      return;
    }

    console.log("🔬 Edge function result:", data);

    if (data.valid) {
      barcodeValid.value = true;
      barcodeMessage.value = data.message;

      // Just use the message as feedback — no auto-fill
      if (data.source === 'openfoodfacts' && data.product) {
        console.log("📦 Product found on Open Food Facts:", data.product.name);
      }

      // Auto-advance to next step
      if (currentStep.value === STEP_BARCODE) {
        console.log("🚀 Auto-advancing to next step...");
        setTimeout(() => { nextStep(); }, 500);
      }
    } else {
      barcodeValid.value = false;
      barcodeMessage.value = data.message;
    }
  } catch (err) {
    console.error("❌ Barcode validation error:", err);
    if (newBarcode && /^\d{8,15}$/.test(String(newBarcode).trim())) {
      barcodeValid.value = true;
      barcodeMessage.value = "✅ Barcode accepted";
    } else {
      barcodeValid.value = false;
      barcodeMessage.value = "❌ Validation failed";
    }
  } finally {
    barcodeLoading.value = false;
  }
});



// refs moved to top

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

// refs moved to top
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
  try {
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
  } catch (err: any) {
    if (err?.message?.includes('cancel') || String(err).includes('cancel') || String(err).includes('cancelled')) {
      console.log('📷 Camera capture was cancelled by the user.');
      return;
    }
    console.error('❌ Camera capture failed:', err);
    setError(t('addProduct.cameraError') || 'Failed to capture image.');
  }
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

// refs moved to top

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
      console.log("📷 Native scan result:", JSON.stringify(barcodes));

      if (barcodes.length > 0) {
        const scannedBarcode = barcodes[0].rawValue;
        console.log("📷 Extracted rawValue:", scannedBarcode);
        if (scannedBarcode) {
          await Haptics.impact({ style: ImpactStyle.Medium })
          
          // Force Vue reactivity: clear first, then set after nextTick
          form.value.barcode = ''
          await nextTick()
          form.value.barcode = scannedBarcode
          scannedOnce.value = true
          console.log("📷 form.value.barcode is now:", form.value.barcode);
          // The watcher handles validation via the edge function
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
             // v-model handles the update

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
    originalFrontPreview.value = frontPreview.value;
    originalFrontFile.value = frontFile.value;

  } catch (error: any) {
    if (error?.message?.includes('cancel') || String(error).includes('cancel') || String(error).includes('cancelled')) {
      console.log('📷 Front photo capture was cancelled by the user.');
      return;
    }
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
    originalBackPreview.value = backPreview.value;
    originalBackFile.value = backFile.value;

  } catch (error: any) {
    if (error?.message?.includes('cancel') || String(error).includes('cancel') || String(error).includes('cancelled')) {
      console.log('📷 Back photo capture was cancelled by the user.');
      return;
    }
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

function applyQuickDescription(text: string) {
  form.value.description = text;
}

/** Simple format check for barcode (used at submit time as a guard) */
function isValidBarcodeFormat(barcode: string): boolean {
  const clean = barcode.trim().replace(/[-\s]/g, "");
  return /^\d{8,15}$/.test(clean);
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

    if (!isValidBarcodeFormat(form.value.barcode)) {
      setError('❌ Invalid barcode format');
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

      frontUrl = `${publicUrl.publicUrl.split('?')[0]}?v=${Date.now()}`
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

      backUrl = `${publicUrl.publicUrl.split('?')[0]}?v=${Date.now()}`
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
        approved: autoApprove ? true : false,
        approved_by: autoApprove ? user.id : null,
        approved_at: autoApprove ? new Date().toISOString() : null,
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

      // 🎁 Award scan bonus quota for contributing a product
      await awardScanBonus(1);

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
      originalFrontFile.value = null; originalBackFile.value = null
      originalFrontPreview.value = null; originalBackPreview.value = null
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

onMounted(() => {
  preloadAIModel();
})
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

.preview-actions-overlay {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 8px;
}

.preview-action-btn {
  --padding-start: 8px;
  --padding-end: 8px;
  --border-radius: 20px;
  height: 32px;
  margin: 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
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
  background: var(--ion-item-background, var(--card-bg, #fff));
  color: var(--ion-text-color, #000);
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
  justify-content: center;
  align-items: center;
  padding: 10px 12px;
  background: var(--ion-background-color, rgba(244, 245, 248, 0.7));
  border-bottom: 1px solid var(--ion-item-border-color, rgba(0, 0, 0, 0.05));
}

.photo-title {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--ion-text-color, var(--ion-color-dark));
  margin: 0;
}

.placeholder-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  padding: 0 16px;
}

.placeholder-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 38px;
  border-radius: 12px;
  border: 1px solid var(--ion-item-border-color, rgba(0, 0, 0, 0.12));
  background: var(--ion-item-background, var(--card-inner-bg, #fff));
  color: var(--ion-text-color, #222);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 6px rgba(0,0,0,0.03);
}

.placeholder-btn:hover {
  background: var(--ion-background-color, #eee);
  border-color: var(--ion-color-carrot);
  color: var(--ion-color-carrot);
  transform: translateY(-1px);
}

.photo-preview-wrap {
  position: relative;
  height: 180px;
  width: 100%;
  overflow: hidden;
}

.photo-controls {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  background: var(--ion-background-color, #f8f9fa);
  border-top: 1px solid var(--ion-item-border-color, rgba(0, 0, 0, 0.05));
}

.control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 34px;
  border-radius: 10px;
  border: none;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ai-progress-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 0 8px;
  gap: 3px;
}

.ai-progress-text {
  font-size: 11px;
  font-weight: 700;
  color: white;
  text-shadow: 0 1px 2px rgba(0,0,0,0.2);
}

.ai-bar {
  --background: rgba(255, 255, 255, 0.3);
  --progress-background: white;
  height: 4px;
  border-radius: 4px;
  width: 100%;
}

.control-btn.ai-btn {
  background: var(--ion-color-carrot, #ff6b00);
  color: white;
  box-shadow: 0 2px 8px rgba(255, 107, 0, 0.3);
}

.control-btn.ai-btn:hover {
  filter: brightness(1.1);
}

.control-row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
}

.control-sub-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--ion-item-border-color, rgba(0, 0, 0, 0.12));
  background: var(--ion-item-background, var(--card-inner-bg, #fff));
  color: var(--ion-text-color, #222);
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.control-sub-btn:hover {
  background: var(--ion-background-color, #eee);
}

.control-sub-btn.danger {
  color: var(--ion-color-danger, #ef4444);
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
}

.control-sub-btn.danger:hover {
  background: var(--ion-color-danger, #ef4444);
  color: white;
}

.control-sub-btn.warning {
  color: var(--ion-color-warning, #f59e0b);
  background: rgba(245, 158, 11, 0.15);
  border-color: rgba(245, 158, 11, 0.3);
}

.control-sub-btn.warning:hover {
  background: var(--ion-color-warning, #f59e0b);
  color: white;
}

.btn-spinner {
  width: 18px;
  height: 18px;
  color: inherit;
}

.thumbnail-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-placeholder {
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
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
</style>

