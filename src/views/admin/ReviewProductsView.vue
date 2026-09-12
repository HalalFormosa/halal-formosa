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
          <ion-segment v-model="viewMode" mode="ios" class="view-segment">
            <ion-segment-button value="pending">
              <ion-label>Review</ion-label>
            </ion-segment-button>
            <ion-segment-button value="archived">
              <ion-label>Archive</ion-label>
            </ion-segment-button>
          </ion-segment>

          <ion-button fill="clear" class="sort-icon-btn" id="sort-trigger" :title="sortLabel">
            <ion-icon :icon="sortIcon" slot="icon-only" />
          </ion-button>

          <ion-popover trigger="sort-trigger" trigger-action="click" :dismiss-on-select="true" class="sort-popover">
            <ion-list lines="none" class="sort-popover-list">
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
              class="product-row"
              @click="openProductModal(product)"
          >
            <ion-thumbnail slot="start" class="product-thumb">
              <img :src="product.photo_front_url" :alt="$t('review.imageAlt')" />
            </ion-thumbnail>
            <ion-label>
              <div class="product-title-row">
                <h2 class="product-name">{{ product.name }}</h2>
                <ion-badge v-if="product.is_rejected" color="danger" class="rejected-badge">Rejected</ion-badge>
              </div>
              <div class="product-meta-row">
                <p class="product-barcode">{{ product.barcode }}</p>
                <ion-badge :color="statusColor(product.status)" class="status-badge">{{ product.status }}</ion-badge>
              </div>
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
            <ion-item-option color="danger" @click="deleteProduct(product, $event)">
              <ion-icon slot="start" :icon="trashBinOutline" />
              Delete
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
      <ion-modal ref="reviewModalRef" :is-open="showModal" @didDismiss="closeModal" class="review-modal">
        <ion-header>
          <app-header
              :title="$t('review.modalTitle')"
              icon="none"
              :showBack="true"
              :useRouterBack="false"
              :showProfile="false"
              :showNotifications="false"
              @back="closeModal"
          />
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
            <div class="section-heading section-heading-first">
              <div class="section-heading-title">
                <ion-icon :icon="personOutline" />
                <span>{{ $t('review.uploadedBy') }}</span>
              </div>
            </div>
            <ion-item lines="none" class="uploader-info ion-margin-bottom">
              <ion-avatar slot="start">
                <img :src="selectedProduct.uploader?.avatar_url || 'https://placehold.co/100x100?text=👤'" @error="handleImgError" />
              </ion-avatar>
              <ion-label>
                <h3 style="font-weight: 600;">{{ selectedProduct.uploader?.display_name || $t('admin.anonymousUser') }}</h3>
              </ion-label>
              <ion-badge v-if="selectedProduct.uploaderRole === 'contributor'" slot="end" color="warning" style="margin-right: 6px;">Dedicated Contributor</ion-badge>
              <ion-badge slot="end" color="medium">{{ selectedProduct.uploader?.donor_type || $t('profile.donors.Free') }}</ion-badge>
            </ion-item>

            <ion-item-group>
              <!-- Product Details — barcode, name, status and category all in
                   one card right after the uploader info, so reviewing
                   doesn't take a long scroll through separate boxes. -->
              <div class="review-card">
                <!-- Barcode (now editable, re-checked against the live catalogue) -->
                <div class="pill-row">
                  <ion-input
                    v-model="selectedProduct.barcode"
                    fill="outline"
                    label-placement="stacked"
                    :label="$t('review.barcode')"
                    class="pill-input"
                  >
                    <ion-icon
                      v-if="barcodeCheck && !barcodeChecking"
                      slot="end"
                      :icon="barcodeCheckIcon"
                      :color="barcodeCheckColor"
                      class="barcode-check-icon"
                      :title="barcodeCheck.message"
                      @click="showBarcodeCheckInfo"
                    />
                  </ion-input>
                  <ion-button
                    fill="clear"
                    size="small"
                    title="Re-check"
                    :disabled="barcodeChecking || similarChecking"
                    @click="runProductChecks"
                  >
                    <ion-spinner v-if="barcodeChecking || similarChecking" name="dots" style="width: 20px;" />
                    <ion-icon v-else slot="icon-only" :icon="refreshOutline" />
                  </ion-button>
                </div>

                <!-- Fuzzy near-duplicates: same product under a different barcode,
                     or a mistyped digit. Advisory — these are judgement calls.
                     Opens in its own modal so there's room to actually compare. -->
                <button
                  v-if="similarProducts.length"
                  type="button"
                  class="duplicates-banner ion-margin-top"
                  @click="showDuplicatesModal = true"
                >
                  <div class="duplicates-banner-header">
                    <ion-icon :icon="closeCircle" />
                    <span>{{ similarProducts.length }} possible duplicate{{ similarProducts.length > 1 ? 's' : '' }} — tap to review</span>
                    <ion-icon :icon="chevronForwardOutline" class="duplicates-banner-chevron" />
                  </div>
                  <div class="duplicates-banner-thumbs">
                    <div v-for="match in similarProducts.slice(0, 3)" :key="match.id" class="duplicates-banner-thumb">
                      <img :src="match.photo_front_url || 'https://placehold.co/64x64?text=%20'" :alt="match.name" />
                      <span>{{ match.name }}</span>
                    </div>
                    <div v-if="similarProducts.length > 3" class="duplicates-banner-more">
                      +{{ similarProducts.length - 3 }}
                    </div>
                  </div>
                </button>

                <!-- Product Name -->
                <ion-input
                  v-model="selectedProduct.name"
                  fill="outline"
                  label-placement="stacked"
                  :label="$t('review.name')"
                  class="pill-input"
                ></ion-input>
                <button type="button" class="fix-case-under" title="Title-case the product name" @click="fixNameCasing">
                  <ion-icon :icon="sparklesOutline" />
                  Fix capitalization
                </button>

                <!-- Status -->
                <ion-select
                  v-model="selectedProduct.status"
                  interface="popover"
                  fill="outline"
                  label-placement="stacked"
                  :label="$t('review.status')"
                  class="pill-input"
                >
                  <ion-select-option value="Halal">{{ $t('review.statusHalal') }}</ion-select-option>
                  <ion-select-option value="Muslim-friendly">{{ $t('review.statusMuslimFriendly') }}</ion-select-option>
                  <ion-select-option value="Syubhah">{{ $t('review.statusSyubhah') }}</ion-select-option>
                  <ion-select-option value="Haram">{{ $t('review.statusHaram') }}</ion-select-option>
                </ion-select>

                <!-- Category -->
                <button type="button" class="pill-input pill-category-btn" @click="categoryModalOpen = true">
                  <span class="pill-category-label">{{ $t('review.category') }} <ion-text color="danger">*</ion-text></span>
                  <span class="pill-category-value">{{ selectedCategoryName || 'Select a Category...' }}</span>
                </button>

                <!-- Ingredients — kept in the same card as Category so there's
                     no gap between the two closely-related fields. -->
                <ion-textarea
                  v-model="selectedProduct.ingredients"
                  fill="outline"
                  label-placement="stacked"
                  :label="$t('review.ingredients')"
                  auto-grow
                  class="pill-input pill-textarea"
                ></ion-textarea>
                <button type="button" class="fix-case-under" title="Title-case each ingredient" @click="fixIngredientsCasing">
                  <ion-icon :icon="sparklesOutline" />
                  Fix capitalization
                </button>

                <!-- Ingredients Highlights (Visual aid only) — haram (red) first,
                     then syubhah (yellow), then muslim-friendly (blue). -->
                <div class="ion-margin-top ion-padding-horizontal">
                  <ul class="ingredient-highlight-list">
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
              </div>

              <!-- Stores + Description -->
              <div class="review-card">
                <ion-item lines="none" class="store-picker-item">
                  <StoreLogoBar
                      :stores="sortedStores"
                      mode="select"
                      v-model:modelValue="selectedProduct.store_ids"
                  />
                </ion-item>

                <!-- Description -->
                <ion-textarea
                  v-model="selectedProduct.description"
                  fill="outline"
                  label-placement="stacked"
                  :label="$t('review.description')"
                  auto-grow
                  class="pill-input pill-textarea"
                ></ion-textarea>

                <!-- Quick Insert Buttons -->
                <div class="quick-scroll-container ion-padding-horizontal ion-padding-bottom">
                  <ion-button size="small" fill="outline" color="success" @click="applyQuickDescription(quickDescriptions.halal)" class="quick-btn">Halal by</ion-button>
                  <ion-button size="small" fill="outline" color="primary" @click="applyQuickDescription(quickDescriptions.muslimFriendly)" class="quick-btn">Friendly OK</ion-button>
                  <ion-button size="small" fill="outline" color="warning" @click="applyQuickDescription(quickDescriptions.syubhah)" class="quick-btn">Syubhah found</ion-button>
                  <ion-button size="small" fill="outline" color="danger" @click="applyQuickDescription(quickDescriptions.haram)" class="quick-btn">Haram found</ion-button>
                </div>
              </div>

              <!-- Tags — Enter (or a trailing comma) adds the tag, no
                   separate Add button needed. -->
              <div class="review-card">
                <ion-input
                    v-model="tagInput"
                    fill="outline"
                    :label="$t('addPlace.addTagLabel', 'Add a tag')"
                    label-placement="stacked"
                    :placeholder="$t('addPlace.tagPlaceholder', 'e.g. Snack, Spicy')"
                    class="pill-input"
                    @ionInput="handleTagInput"
                    @keyup.enter="addTag"
                />
                <div v-if="selectedProduct.tags && selectedProduct.tags.length > 0" class="tag-chips ion-padding-horizontal ion-padding-bottom" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px;">
                  <ion-chip v-for="tag in selectedProduct.tags" :key="tag" color="primary" outline class="tag-chip" style="margin: 0;">
                    <ion-label>{{ tag }}</ion-label>
                    <ion-icon :icon="closeCircle" @click="removeTag(tag)" />
                  </ion-chip>
                </div>
              </div>

              <!-- Images Preview -->
              <div class="section-heading">
                <div class="section-heading-title">
                  <ion-icon :icon="imagesOutline" />
                  <span>{{ $t('review.images') }}</span>
                </div>
              </div>
              <div class="review-card ion-padding-horizontal ion-padding-bottom">
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

              <ion-button
                @click="deleteProduct(selectedProduct)"
                :disabled="publishing"
                color="danger"
                fill="clear"
                size="small"
              >
                <ion-icon slot="start" :icon="trashBinOutline" />
                Delete permanently (incl. photos)
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

        <!-- 🔍 Possible Duplicates Modal — a full window rather than a bottom
             sheet, so there's no partial/dragged-down state cutting off the
             comparison. -->
        <ion-modal
          :is-open="showDuplicatesModal"
          @didDismiss="showDuplicatesModal = false"
        >
          <ion-header>
            <app-header
                title="Possible Duplicates"
                icon="none"
                :showBack="true"
                :useRouterBack="false"
                :showProfile="false"
                :showNotifications="false"
                @back="showDuplicatesModal = false"
            />
          </ion-header>

          <ion-content class="ion-padding">
            <div
              v-for="match in similarProducts"
              :key="match.id"
              class="duplicate-card"
            >
              <div class="duplicate-compare-row">
                <!-- This submission -->
                <div class="duplicate-compare-col">
                  <img
                    class="duplicate-compare-thumb"
                    :src="frontPreview || selectedProduct?.photo_front_url || 'https://placehold.co/200x200?text=No+Image'"
                    :alt="selectedProduct?.name"
                    @click="openFullscreenImage(frontPreview || selectedProduct?.photo_front_url)"
                  />
                  <span class="duplicate-compare-tag">This submission</span>
                  <ion-badge :color="statusColor(selectedProduct?.status)" class="duplicate-status-badge">{{ selectedProduct?.status }}</ion-badge>
                  <p class="duplicate-compare-name">{{ selectedProduct?.name }}</p>
                  <p
                    v-if="canDiffBarcode(match)"
                    class="duplicate-compare-meta"
                    v-html="diffBarcodeHtml(selectedProduct?.barcode || '', match.barcode)"
                  ></p>
                  <p v-else class="duplicate-compare-meta">{{ selectedProduct?.barcode }}</p>
                </div>

                <ion-icon :icon="swapHorizontalOutline" class="duplicate-compare-vs" />

                <!-- Candidate match -->
                <div class="duplicate-compare-col">
                  <img
                    class="duplicate-compare-thumb"
                    :src="match.photo_front_url || 'https://placehold.co/200x200?text=No+Image'"
                    :alt="match.name"
                    @click="openFullscreenImage(match.photo_front_url)"
                  />
                  <span class="duplicate-compare-tag">{{ match.approved ? 'Published' : 'Pending' }}</span>
                  <ion-badge :color="statusColor(match.status)" class="duplicate-status-badge">{{ match.status }}</ion-badge>
                  <p class="duplicate-compare-name">{{ match.name }}</p>
                  <p
                    v-if="canDiffBarcode(match)"
                    class="duplicate-compare-meta"
                    v-html="diffBarcodeHtml(match.barcode, selectedProduct?.barcode || '')"
                  ></p>
                  <p v-else class="duplicate-compare-meta">{{ match.barcode }}</p>
                </div>
              </div>

              <p class="duplicate-reason">
                <ion-icon :icon="closeCircle" />
                {{ similarReason(match) }}
              </p>

              <div class="duplicate-actions">
                <ion-button fill="outline" size="small" @click="openSimilar(match); showDuplicatesModal = false">
                  <ion-icon slot="start" :icon="eyeOutline" />
                  View
                </ion-button>
                <ion-button fill="solid" color="carrot" size="small" @click="mergeIntoSimilar(match); showDuplicatesModal = false">
                  <ion-icon slot="start" :icon="gitMergeOutline" />
                  Merge
                </ion-button>
              </div>
            </div>
          </ion-content>
        </ion-modal>

        <!-- 🔎 Fullscreen viewer for a single duplicate-comparison photo -->
        <ion-modal :is-open="!!fullscreenImageUrl" @didDismiss="closeFullscreenImage">
          <ion-content fullscreen style="--background: black">
            <ion-button
                fill="solid"
                color="carrot"
                style="position: absolute; top: calc(env(safe-area-inset-top, 0px) + 16px); right: 16px; z-index: 9999;"
                @click="closeFullscreenImage"
            >
              ✕
            </ion-button>
            <div class="fullscreen-single-image">
              <img v-if="fullscreenImageUrl" :src="fullscreenImageUrl" />
            </div>
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
  closeCircle,
  listOutline,
  trashOutline,
  trashBinOutline,
  cameraOutline,
  cloudUploadOutline,
  timeOutline,
  checkmarkCircle,
  helpCircleOutline,
  swapVerticalOutline,
  syncOutline,
  colorWandOutline,
  refreshOutline,
  sparklesOutline,
  imagesOutline,
  personOutline,
  eyeOutline,
  gitMergeOutline,
  chevronForwardOutline,
  swapHorizontalOutline
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
import { isValidBarcodeFormat, normalizeBarcode } from "@/utils/barcodeValidator";
import { computeImageHash, computeImageHashFromUrl } from "@/utils/useImageHash";
import { useNotifier } from "@/composables/useNotifier";

import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const { t } = useI18n()
const { notifyEvent } = useNotifier()
const router = useRouter()

const categories = ref<{ id:number; name:string }[]>([])
const modules = [Pagination, Zoom]
const pendingProducts = ref<any[]>([])
const showModal = ref(false)
const reviewModalRef = ref<any>(null)
const selectedProduct = ref<any | null>(null)
const showImageModal = ref(false)

/* ---------------- Barcode re-check ---------------- */
type BarcodeCheckState = 'empty' | 'invalid' | 'duplicate' | 'ok'

const barcodeChecking = ref(false)
const barcodeCheck = ref<{
  state: BarcodeCheckState
  message: string
  match?: { id: string; name: string; status: string; approved: boolean; barcode: string }
} | null>(null)
let barcodeCheckToken = 0
let barcodeDebounce: ReturnType<typeof setTimeout> | null = null

// Re-validates the barcode on the submission being reviewed: checksum first,
// then a live lookup for another product already using it.
//
// Two things make this worth doing at review time. The barcode field is
// editable here, so an admin can fix a typo into a value that is itself
// malformed or already taken. And `products.barcode` carries a UNIQUE index, so
// a collision is not a soft warning — publishing would fail outright on a
// constraint violation. Better to surface it before they hit Publish.
//
// The submission's own row is excluded: pending products live in `products`
// with approved = false, so it would otherwise always match itself.
async function checkBarcode() {
  const product = selectedProduct.value
  if (!product) return

  const raw = String(product.barcode ?? '')
  const clean = normalizeBarcode(raw)
  const token = ++barcodeCheckToken

  if (!clean) {
    barcodeCheck.value = { state: 'empty', message: 'No barcode entered.' }
    return
  }

  if (!isValidBarcodeFormat(clean)) {
    barcodeCheck.value = {
      state: 'invalid',
      message: 'Invalid barcode — fails the checksum for every supported format.'
    }
    return
  }

  barcodeChecking.value = true
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, status, approved, barcode')
      .eq('barcode', clean)
      .neq('id', product.id)
      .order('approved', { ascending: false })
      .limit(1)

    // A newer check started while this one was in flight — drop this result
    if (token !== barcodeCheckToken) return

    if (error) {
      barcodeCheck.value = { state: 'invalid', message: `Lookup failed: ${error.message}` }
      return
    }

    const match = data?.[0]
    if (match) {
      barcodeCheck.value = {
        state: 'duplicate',
        message: match.approved
          ? `Taken — already published as "${match.name}" (${match.status}). Publishing will fail.`
          : `Taken by another pending submission, "${match.name}". Publishing will fail.`,
        match
      }
      return
    }

    // Not a live products.barcode collision — but it may be an alias that was
    // already merged into another product. products.barcode's UNIQUE
    // constraint won't catch this (the barcode no longer lives there), so
    // this app-level check is the only guard against re-fragmenting a merge.
    const { data: aliasData } = await supabase
      .from('product_barcodes')
      .select('products (id, name, status, approved, barcode)')
      .eq('barcode', clean)
      .maybeSingle() as { data: any }
    const aliasMatch = Array.isArray(aliasData?.products) ? aliasData?.products[0] : aliasData?.products

    if (token !== barcodeCheckToken) return

    if (aliasMatch && aliasMatch.id !== product.id) {
      barcodeCheck.value = {
        state: 'duplicate',
        message: `Already merged into "${aliasMatch.name}" (${aliasMatch.status}) under a different barcode. Publishing this as a new product would re-fragment it.`,
        match: aliasMatch
      }
      return
    }

    barcodeCheck.value = { state: 'ok', message: 'Valid checksum, and free to use.' }
  } finally {
    if (token === barcodeCheckToken) barcodeChecking.value = false
  }
}

/* ---------------- Fuzzy duplicate check (admin only) ---------------- */
interface SimilarProduct {
  id: string
  name: string
  barcode: string
  status: string
  approved: boolean
  name_similarity: number
  barcode_distance: number | null
  match_reason: 'name' | 'barcode' | 'both'
  image_similarity: number | null
  photo_front_url?: string | null
}

const similarChecking = ref(false)
const similarProducts = ref<SimilarProduct[]>([])
let similarToken = 0

// A near-miss image match (dHash Hamming distance) is a strong "this looks
// like the same product" signal independent of name/barcode.
async function getCurrentFrontImageHash(): Promise<string | null> {
  // A newly-picked local file has no server-side hash yet — only the client
  // can compute one for it.
  if (frontFile.value) {
    try {
      return await computeImageHash(frontFile.value)
    } catch (err) {
      console.warn('⚠️ Failed to hash front image file:', err)
      return null
    }
  }

  // Prefer the hash already stored for this exact row over recomputing it
  // client-side. Recomputing from the URL would run the browser's canvas
  // resize, which is a different (and not bit-identical) resampling
  // algorithm than e.g. the sharp-based backfill script used to populate
  // existing rows — so a row's own freshly-recomputed hash can end up not
  // matching its own stored value, silently breaking duplicate detection
  // for anything that hashed through a different code path. Cast to text in
  // the query itself: PostgREST returns bigint as a JSON number, which
  // silently loses precision outside ±2^53.
  const productId = selectedProduct.value?.id
  if (productId) {
    const { data } = await supabase
      .from('products')
      .select('image_hash_text:image_hash::text')
      .eq('id', productId)
      .maybeSingle()
    if (data?.image_hash_text) return data.image_hash_text as string
  }

  // Legacy row with no stored hash yet (predates the image_hash column and
  // wasn't caught by the backfill) — fall back to a fresh client-side hash.
  const url = selectedProduct.value?.photo_front_url
  if (!url) return null
  return computeImageHashFromUrl(url)
}

// The exact check above can only catch a barcode that is literally taken, and
// products.barcode is UNIQUE so that can never arrive from a contributor. The
// duplicates that actually reach review are near-misses: same product under a
// different barcode, or a mistyped digit — plus, via image_hash, the same
// photo resubmitted under an unrelated name and barcode entirely.
// find_similar_products scores all three.
async function checkSimilar() {
  const product = selectedProduct.value
  if (!product) return

  const token = ++similarToken
  similarChecking.value = true

  try {
    const imageHash = await getCurrentFrontImageHash()
    if (token !== similarToken) return

    const { data, error } = await supabase.rpc('find_similar_products', {
      p_product_id: product.id,
      p_name: product.name ?? '',
      p_barcode: normalizeBarcode(String(product.barcode ?? '')),
      p_image_hash: imageHash
    })

    if (token !== similarToken) return

    if (error) {
      // Non-admins are rejected by the RPC itself; nothing useful to show.
      console.warn('⚠️ Similar-product lookup failed:', error.message)
      similarProducts.value = []
      return
    }

    const matches = (data ?? []) as SimilarProduct[]
    similarProducts.value = matches

    // The RPC returns only matching/scoring columns — fetch photos separately
    // so admins can eyeball a duplicate instead of chasing the barcode.
    if (matches.length) {
      const { data: photos } = await supabase
        .from('products')
        .select('id, photo_front_url')
        .in('id', matches.map(m => m.id))

      if (token !== similarToken) return

      const photoMap = Object.fromEntries((photos ?? []).map(p => [p.id, p.photo_front_url]))
      similarProducts.value = matches.map(m => ({ ...m, photo_front_url: photoMap[m.id] || null }))
    }
  } finally {
    if (token === similarToken) similarChecking.value = false
  }
}

function similarReason(match: SimilarProduct): string {
  const name = `${Math.round((match.name_similarity ?? 0) * 100)}% name match`
  const barcode =
    match.barcode_distance != null && match.barcode_distance <= 2
      ? `barcode ${match.barcode_distance} digit${match.barcode_distance === 1 ? '' : 's'} off`
      : null
  // Matches the RPC's own p_image_threshold default (0.85) — below that the
  // RPC wouldn't have surfaced this row on image grounds at all.
  const image =
    match.image_similarity != null && match.image_similarity >= 0.85
      ? `${Math.round(match.image_similarity * 100)}% photo match`
      : null

  let text: string
  if (match.match_reason === 'both' && barcode) text = `${name}, ${barcode}`
  else if (match.match_reason === 'barcode' && barcode) text = barcode
  else text = name

  return image ? `${image}, ${text}` : text
}

// Only worth diffing character-by-character when the RPC flagged this as a
// near-miss barcode (distance 1-2) on a same-length pair — a genuine name-only
// match or a length mismatch has no meaningful per-digit alignment to show.
function canDiffBarcode(match: SimilarProduct): boolean {
  const a = selectedProduct.value?.barcode
  const b = match.barcode
  return (
    !!a && !!b &&
    a.length === b.length &&
    match.barcode_distance != null &&
    match.barcode_distance <= 2
  )
}

// Highlights the characters in `barcode` that differ from `other` at the same
// position, so the admin can see exactly which digits were mistyped/misscanned
// instead of just reading "2 digits off".
function diffBarcodeHtml(barcode: string, other: string): string {
  let html = ''
  for (let i = 0; i < barcode.length; i++) {
    const ch = barcode[i]
    html += ch === other[i] ? ch : `<span class="barcode-diff-char">${ch}</span>`
  }
  return html
}

async function openSimilar(match: SimilarProduct) {
  await navigateToProduct(match.id, match.barcode, match.approved)
}

// Merges this submission into an existing product instead of publishing it as
// a separate one: the submission's barcode becomes an alias (via
// merge_products), and the submission row itself is gone — nothing left to
// approve or reject, so the review modal just closes.
async function mergeIntoSimilar(match: SimilarProduct) {
  const product = selectedProduct.value
  if (!product) return

  const alert = await alertController.create({
    header: t('review.confirmMergeHeader', 'Merge into existing product?'),
    message: t(
      'review.confirmMergeMsg',
      `This submission won't be published separately — its barcode becomes an alias of "${match.name}" (${match.barcode}), and this submission is removed. This can't be undone.`
    ),
    buttons: [
      { text: t('common.cancel', 'Cancel'), role: 'cancel' },
      {
        text: t('review.merge', 'Merge'),
        handler: async () => {
          const { error } = await supabase.rpc('merge_products', {
            p_survivor_id: match.id,
            p_loser_id: product.id,
            p_resolved_status: null,
            p_resolved_category_id: null
          })

          if (error) {
            console.error('Merge failed:', error)
            await showToast(`Merge failed: ${error.message}`, 'danger')
            return
          }

          await showToast(`Merged into "${match.name}".`, 'success')
          loadPendingProducts()
          closeModal()
        }
      }
    ]
  })
  await alert.present()
}

/** Both checks, for the Re-check button and whenever a submission is opened. */
function runProductChecks() {
  checkBarcode()
  checkSimilar()
}

// Jump to whatever is already occupying this barcode so the admin can decide
// which submission wins.
async function openDuplicate(productId: string) {
  const match = barcodeCheck.value?.match
  if (!match) return
  await navigateToProduct(productId, match.barcode, match.approved)
}

// Ionic modals are presented at the app root, so they outlive a route change —
// pushing while this one is open leaves it covering the item page. And swapping
// selectedProduct in the same tick sets showModal false->true synchronously,
// which Vue batches into no change at all. Both need the dismissal to finish
// first, so wait for didDismiss rather than just flipping the flag.
async function dismissReviewModal() {
  const el = (reviewModalRef.value as any)?.$el
  if (!el) {
    closeModal()
    return
  }

  // Never await unbounded: dismiss() resolves false when the modal isn't
  // presented, in which case didDismiss never fires.
  const dismissed = new Promise<void>(resolve => {
    el.addEventListener('didDismiss', () => resolve(), { once: true })
    setTimeout(resolve, 600)
  })

  try {
    const wasPresented = await el.dismiss()
    if (wasPresented) await dismissed
  } catch {
    // Ignore — fall through to the explicit close below
  }

  // @didDismiss normally runs this; call it directly for the paths where the
  // modal was already gone.
  if (showModal.value) closeModal()
}

async function navigateToProduct(productId: string, barcode: string, approved: boolean) {
  // Capture before dismissing: closeModal() nulls selectedProduct.
  const pending = approved
    ? null
    : pendingProducts.value.find(p => String(p.id) === String(productId))

  await dismissReviewModal()

  if (approved) {
    router.push(`/item/${barcode}`)
  } else if (pending) {
    openProductModal(pending)
  } else {
    showToast('That submission is no longer in the queue.', 'warning')
  }
}

const barcodeCheckColor = computed(() => {
  switch (barcodeCheck.value?.state) {
    case 'ok': return 'success'
    case 'duplicate': return 'danger'
    case 'invalid': return 'danger'
    default: return 'medium'
  }
})

const barcodeCheckIcon = computed(() => {
  switch (barcodeCheck.value?.state) {
    case 'ok': return checkmarkCircle
    case 'duplicate': return closeCircle
    case 'invalid': return closeCircle
    default: return helpCircleOutline
  }
})

// The barcode check result used to sit as a full text line under the field;
// collapsed to a single status icon so it doesn't add a row, with the actual
// message surfaced on demand instead.
async function showBarcodeCheckInfo() {
  if (!barcodeCheck.value) return
  const buttons: any[] = [{ text: 'OK', role: 'cancel' }]
  const match = barcodeCheck.value.match
  if (match) {
    buttons.unshift({ text: 'View', handler: () => openDuplicate(match.id) })
  }
  const alert = await alertController.create({
    header: 'Barcode Check',
    message: barcodeCheck.value.message,
    buttons
  })
  await alert.present()
}

// Auto re-check as the admin edits the barcode or name (debounced), on top of
// the automatic check when a submission is opened and the manual button.
watch(
  () => [selectedProduct.value?.barcode, selectedProduct.value?.name],
  () => {
    if (!selectedProduct.value) return
    if (barcodeDebounce) clearTimeout(barcodeDebounce)
    barcodeDebounce = setTimeout(() => { runProductChecks() }, 500)
  }
)

const tagInput = ref('')

const handleTagInput = (e: any) => {
  const val = e.target.value
  if (val.endsWith(',')) {
    const tag = val.slice(0, -1).trim()
    if (tag && selectedProduct.value) {
      if (!selectedProduct.value.tags) selectedProduct.value.tags = []
      if (!selectedProduct.value.tags.includes(tag)) {
        selectedProduct.value.tags.push(tag)
      }
    }
    tagInput.value = ''
  }
}

const addTag = (e?: any) => {
  if (e) e.preventDefault()
  if (!selectedProduct.value) return
  const val = tagInput.value.trim().replace(/,/g, '')
  if (val) {
    if (!selectedProduct.value.tags) selectedProduct.value.tags = []
    if (!selectedProduct.value.tags.includes(val)) {
      selectedProduct.value.tags.push(val)
    }
  }
  tagInput.value = ''
}

const removeTag = (t: string) => {
  if (!selectedProduct.value?.tags) return
  selectedProduct.value.tags = selectedProduct.value.tags.filter((tag: string) => tag !== t)
}

const handleImgError = (ev: Event) => {
  const target = ev.target as HTMLImageElement | null
  if (target) {
    target.onerror = null
    target.src = 'https://placehold.co/100x100?text=👤'
  }
}
const publishing = ref(false)

const categoryModalOpen = ref(false)
const categoryQuery = ref('')
const showDuplicatesModal = ref(false)

const fullscreenImageUrl = ref<string | null>(null)

function openFullscreenImage(url?: string | null) {
  if (!url) return
  fullscreenImageUrl.value = url
}

function closeFullscreenImage() {
  fullscreenImageUrl.value = null
}

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

// Contributor submissions often arrive as ALL CAPS (scanned off packaging) or
// all lowercase. Title-cases each word while leaving acronyms like "MSG" or
// "E621" alone, so admins don't have to retype them by hand.
function toTitleCase(text: string): string {
  return text.replace(/[A-Za-zÀ-ÖØ-öø-ÿ0-9]+(?:['’][A-Za-z]+)?/g, (word) => {
    if (word.length > 1 && word === word.toUpperCase() && /[A-Z]/.test(word)) {
      return word
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  })
}

function fixNameCasing() {
  if (!selectedProduct.value?.name) return
  selectedProduct.value.name = toTitleCase(selectedProduct.value.name)
}

function fixIngredientsCasing() {
  if (!selectedProduct.value?.ingredients) return
  selectedProduct.value.ingredients = toTitleCase(selectedProduct.value.ingredients)
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

  // Sort by severity so the ingredients most likely to need a second look are
  // seen first: haram (red) at top, then syubhah (yellow), then muslim-friendly
  // (blue); unhighlighted ingredients sink to the bottom.
  return [...processed].sort(
    (a: IngredientEntry, b: IngredientEntry) => ingredientSeverityRank(a) - ingredientSeverityRank(b)
  )
})

const INGREDIENT_COLOR_RANK: Record<string, number> = {
  '--ion-color-danger': 0,
  '--ion-color-warning': 1,
  '--ion-color-primary': 2,
  '--ion-color-success': 3
}

function ingredientSeverityRank(entry: IngredientEntry): number {
  if (!entry.highlighted) return 4
  const match = entry.html.match(/var\((--ion-color-[^)]+)\)/)
  const color = match?.[1]
  return color && color in INGREDIENT_COLOR_RANK ? INGREDIENT_COLOR_RANK[color] : 4
}

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

// Same status → color mapping used by the ingredient highlighter, so the
// review list badge matches what the admin sees inside the review modal.
function statusColor(status: string | null | undefined): string {
  switch (status) {
    case 'Halal': return 'success'
    case 'Muslim-friendly': return 'primary'
    case 'Syubhah': return 'warning'
    case 'Haram': return 'danger'
    default: return 'medium'
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
      const [profilesResult, rolesResult] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('id, display_name, avatar_url, donor_type')
          .in('id', uploaderIds),
        supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', uploaderIds)
      ])
      const profiles = profilesResult.data
      const profError = profilesResult.error
      const roles = rolesResult.data

      if (!profError && profiles) {
        const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]))
        const rolesMap = Object.fromEntries((roles || []).map(r => [r.user_id, r.role]))
        pendingProducts.value = products.map(p => ({
          ...p,
          uploader: profileMap[p.added_by] || null,
          uploaderRole: rolesMap[p.added_by] || 'user'
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
    store_ids: storeIds,
    tags: product.tags || []
  })
  showModal.value = true

  // Contributors can submit a barcode the validator never saw (manual entry,
  // older submissions predating the check), so verify it up front rather than
  // making the admin remember to press the button.
  barcodeCheck.value = null
  similarProducts.value = []
  runProductChecks()
}

function closeModal() {
  if (barcodeDebounce) clearTimeout(barcodeDebounce)
  barcodeCheckToken++
  similarToken++
  barcodeChecking.value = false
  similarChecking.value = false
  barcodeCheck.value = null
  similarProducts.value = []
  selectedProduct.value = null
  frontFile.value = null
  backFile.value = null
  frontPreview.value = null
  backPreview.value = null
  originalFrontFile.value = null
  originalBackFile.value = null
  originalFrontPreview.value = null
  originalBackPreview.value = null
  showDuplicatesModal.value = false
  fullscreenImageUrl.value = null
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

  // Re-hash the front photo at publish time — it may have been replaced,
  // rotated, or background-cleaned since the submission's own hash (if any)
  // was stored, and this published row's hash is what future submissions
  // get compared against.
  const imageHash = await getCurrentFrontImageHash()

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
        image_hash: imageHash,
        tags: product.tags || [],
        approved: true,
        approved_by: user.id,
        // Only stamp approved_at on first publish — re-approving an edit to an
        // already-published (e.g. archived) product shouldn't make it look
        // like a brand new product in the "What's new" notification feed.
        ...(product.approved ? {} : { approved_at: new Date().toISOString() }),
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

/** Pulls the object path out of a Supabase public URL, ignoring any ?v= buster. */
function storagePathFromUrl(url?: string | null): string | null {
  if (!url) return null
  const marker = '/product-images/'
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  const path = decodeURIComponent(url.slice(idx + marker.length).split('?')[0])
  return path || null
}

// Photos live at product-images/<barcode>/{front,back}.jpg, but older rows may
// point elsewhere, so collect paths from both the folder listing and the stored
// URLs before removing.
async function deleteProductPhotos(barcode: string, product: any) {
  const paths = new Set<string>()

  if (barcode) {
    const { data: files, error } = await supabase.storage.from('product-images').list(barcode)
    if (error) {
      console.warn('⚠️ Could not list product photos:', error)
    } else {
      files?.forEach(f => paths.add(`${barcode}/${f.name}`))
    }
  }

  for (const url of [product.photo_front_url, product.photo_back_url]) {
    const path = storagePathFromUrl(url)
    if (path) paths.add(path)
  }

  if (!paths.size) return

  const { error } = await supabase.storage.from('product-images').remove([...paths])
  if (error) console.warn('⚠️ Failed to delete some product photos:', error)
}

// Hard delete. Rows in product_stores, product_reports, product_certifications
// and saved_items are removed by ON DELETE CASCADE; storage objects are not, so
// they're cleared explicitly first.
async function deleteProduct(product: any, ev?: Event) {
  closeSlidingItem(ev)

  // Use the barcode as persisted, not the one in the edit form — an unsaved
  // edit would otherwise point the photo cleanup at the wrong folder.
  const persisted = pendingProducts.value.find(p => String(p.id) === String(product.id))
  const barcode = persisted?.barcode ?? product.barcode

  const alert = await alertController.create({
    header: 'Delete submission?',
    message:
      `"${persisted?.name ?? product.name ?? 'Untitled'}" (${barcode || 'no barcode'}) ` +
      `will be permanently deleted, along with its photos. This cannot be undone.`,
    buttons: [
      { text: t('common.cancel', 'Cancel'), role: 'cancel' },
      {
        text: 'Delete',
        role: 'destructive',
        handler: async () => {
          await deleteProductPhotos(barcode, persisted ?? product)

          const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', product.id)

          if (error) {
            console.error('❌ Error deleting product:', error)
            showToast(t('review.actionFailed'), 'danger')
            return
          }

          closeModal()
          showToast('Submission deleted.', 'success')
          loadPendingProducts()
        }
      }
    ]
  })

  await alert.present()
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
  gap: 10px;
  padding: 8px 16px;
  width: 100%;
}

.view-segment {
  flex: 1;
  min-width: 0;
}

.sort-icon-btn {
  height: 38px;
  width: 38px;
  margin: 0;
  flex-shrink: 0;
  --color: var(--ion-color-dark);
  --background: var(--ion-color-step-100);
  --border-radius: 10px;
  --padding-start: 0;
  --padding-end: 0;
}

.sort-icon-btn ion-icon {
  font-size: 19px;
}

.search-container {
  padding: 0 16px 12px;
}



.sort-popover {
  --width: 200px;
}

.sort-popover-list ion-item {
  --min-height: 44px;
}

.sort-popover-list ion-label {
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Review queue list — the photo is what an admin actually judges a submission
   by, so it's sized up while the (often messy, OCR-derived) name and barcode
   are muted and clamped instead of dominating the row. */
.product-row {
  --min-height: 76px;
  --padding-top: 10px;
  --padding-bottom: 10px;
}

.product-thumb {
  width: 64px;
  height: 64px;
  --border-radius: 10px;
  border-radius: 10px;
  overflow: hidden;
}

.product-title-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.product-name {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.35;
  color: var(--ion-color-medium);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.product-meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
}

.product-barcode {
  margin: 0;
  font-size: 11px;
  opacity: 0.55;
}

.status-badge {
  font-size: 9.5px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.rejected-badge {
  font-size: 10px;
  padding: 3px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

/* Modal and form styles */
.review-image-grid {
  display: grid;
  /* minmax(0, 1fr), not 1fr — a plain 1fr track won't shrink below the
     intrinsic width of its content (the icon-button row below), which is
     what was pushing the Back Image column off the right edge. */
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
  margin-top: 8px;
}

.img-preview-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.img-controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
  padding: 4px;
  background: var(--ion-color-step-100);
  border-radius: 0 0 8px 8px;
  border: 1px solid var(--ion-color-step-150);
  border-top: none;
}

.img-controls ion-button {
  --padding-start: 4px;
  --padding-end: 4px;
  margin: 0;
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

/* Compact banner in the review form — opens the full duplicates modal rather
   than trying to cram photos + names + actions into the narrow form width.
   A row of small photo previews gives a first glance before tapping in. */
.duplicates-banner {
  display: block;
  width: 100%;
  margin-top: 8px;
  padding: 10px 12px;
  border: 1px solid var(--ion-color-warning);
  background: rgba(var(--ion-color-warning-rgb), 0.08);
  border-radius: 12px;
  color: var(--ion-color-warning-shade);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.duplicates-banner-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
}

.duplicates-banner-header span {
  flex: 1 1 auto;
}

.duplicates-banner-chevron {
  font-size: 16px;
  opacity: 0.7;
}

.duplicates-banner-thumbs {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 10px;
  overflow-x: auto;
}

.duplicates-banner-thumb {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 52px;
  flex-shrink: 0;
}

.duplicates-banner-thumb img {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 8px;
  background: var(--ion-color-step-100);
}

.duplicates-banner-thumb span {
  width: 100%;
  font-size: 9.5px;
  font-weight: 500;
  text-align: center;
  color: var(--ion-text-color);
  opacity: 0.75;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.duplicates-banner-more {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 8px;
  background: var(--ion-color-step-100);
  font-size: 12px;
  font-weight: 700;
  color: var(--ion-text-color);
  opacity: 0.75;
}

/* Duplicates modal — this submission and the candidate sit side by side with
   their photos, so an admin can actually tell whether they're the same
   product instead of just reading two names. */
.duplicate-card {
  padding: 16px 0;
  border-bottom: 1px solid var(--ion-color-step-150);
}

.duplicate-card:last-child {
  border-bottom: none;
}

.duplicate-compare-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.duplicate-compare-col {
  flex: 1 1 0;
  min-width: 0;
  text-align: center;
}

.duplicate-compare-thumb {
  width: 100%;
  aspect-ratio: 1;
  max-width: 140px;
  object-fit: cover;
  border-radius: 10px;
  background: var(--ion-color-step-100);
  border: 1px solid var(--ion-color-step-150);
  cursor: pointer;
}

.duplicate-compare-vs {
  font-size: 18px;
  opacity: 0.5;
  flex-shrink: 0;
}

.duplicate-compare-tag {
  display: inline-block;
  margin-top: 8px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--ion-color-medium);
}

.duplicate-status-badge {
  display: block;
  margin: 4px auto 0;
  width: fit-content;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
}

.duplicate-compare-name {
  margin: 2px 0 0;
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.3;
}

.duplicate-compare-meta {
  margin: 2px 0 0;
  font-size: 11.5px;
  color: var(--ion-color-medium);
}

.duplicate-compare-meta :deep(.barcode-diff-char) {
  color: var(--ion-color-danger);
  background: rgba(var(--ion-color-danger-rgb), 0.18);
  border-radius: 2px;
  font-weight: 800;
  padding: 0 1px;
}

.duplicate-reason {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 10px 0 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--ion-color-warning-shade);
}

.duplicate-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
}

/* Section grouping for the review modal — visual structure only, no new
   colors or workflow: each field group gets a small labeled heading with a
   separator line above it, so admins can scan the form instead of reading it
   top to bottom. */
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 20px 16px 8px;
  padding-top: 16px;
  border-top: 1px solid var(--ion-color-step-150);
}

/* The very first heading in the modal already gets its spacing from
   ion-content's own padding — the separator's extra margin/padding/border
   on top of that just doubled up the gap under the header. */
.section-heading-first {
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}

.section-heading-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--ion-color-medium);
}

.section-heading-title ion-icon {
  font-size: 15px;
}

.barcode-check-icon {
  font-size: 20px;
  margin: 0 4px;
  cursor: pointer;
  align-self: center;
}

.fix-case-under {
  display: flex;
  align-items: center;
  align-self: flex-end;
  gap: 4px;
  margin-top: -6px;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  color: var(--ion-color-carrot, var(--ion-color-primary));
  cursor: pointer;
}

.fix-case-under ion-icon {
  font-size: 14px;
}

.review-card {
  margin: 20px 16px 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* A card immediately under a heading already gets its gap from the
   heading's own margin — avoid stacking both. */
.section-heading + .review-card {
  margin-top: 0;
}

/* Rounded-rectangle form fields via fill="outline" + --border-radius.
   Deliberately not shape="round": Ionic's own internal stylesheet has
   :host(.input-fill-outline.input-shape-round) { --border-radius: 28px }
   at higher specificity than a single custom class, so shape="round"
   silently overrode our --border-radius and always rendered a near-pill
   regardless of the value set here. */
.pill-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pill-row-top {
  align-items: flex-start;
}

.pill-input {
  flex: 1;
  min-width: 0;
  --border-radius: 16px;
  --border-color: var(--card-border, var(--ion-color-step-150));
  --border-width: 1.5px;
  --box-shadow: none;
  --highlight-color-focused: var(--ion-color-carrot);
  --padding-start: 16px;
  --padding-end: 16px;
  --color: var(--ion-text-color);
  --placeholder-color: var(--ion-color-medium);
  /* --background (not plain `background`) fills the actual shadow-DOM
     outline part Ionic draws the border/radius on — using the host's own
     `background` instead leaves that inner part transparent, so the host's
     box (same color, but not perfectly clipped to the inner shape) shows
     through at the edges as a soft halo/shadow. */
  --background: var(--card-inner-bg, var(--ion-color-step-50));
  border-radius: 16px;
  box-shadow: none;
}

.pill-textarea {
  --border-radius: 16px;
  --box-shadow: none;
  border-radius: 16px;
  box-shadow: none;
}

.pill-category-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 2px;
  width: 100%;
  min-height: 54px;
  padding: 8px 16px;
  /* Without appearance: none, some WebViews render native button chrome
     (a light/white face) on top of the authored background below. */
  appearance: none;
  -webkit-appearance: none;
  border: 1.5px solid var(--card-border, var(--ion-color-step-150));
  background: var(--card-inner-bg, var(--ion-color-step-50));
  border-radius: 16px !important;
  box-shadow: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.pill-category-btn:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(var(--ion-color-carrot-rgb), 0.15);
}

.pill-category-label {
  font-size: 13px;
  color: var(--ion-color-medium);
}

.pill-category-value {
  font-size: 15px;
  color: var(--ion-text-color);
}

/* ion-item defaults to a solid --background, which reads as a boxed panel
   behind the store logos — strip it so the row blends into the card. */
.store-picker-item {
  --background: transparent;
  --padding-start: 0;
  --padding-end: 0;
  --inner-padding-end: 0;
}

/* .store-logo-wrapper/.store-logo are unscoped globals (variables.css) shared
   by every store picker in the app — overridden with :deep() so only this
   review modal gets rounded-rectangle logos, not Add Product/filters/etc. */
.store-picker-item :deep(.store-logo-wrapper),
.store-picker-item :deep(.store-logo) {
  border-radius: 12px;
}

.ingredient-highlight-list {
  margin: 0;
  padding-left: 1.2rem;
  font-size: 14px;
  opacity: 0.85;
}

.ingredient-highlight-list li {
  margin-bottom: 2px;
}

ion-header {
  border-bottom: none !important;
  box-shadow: none !important;
}

.actions-toolbar ion-button,
.actions-toolbar ion-icon {
  color: var(--ion-color-dark);
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
  box-shadow: var(--card-shadow);
  background: var(--ion-card-background, white);
  border: 1px solid var(--ion-color-light-shade);
}
.input-card ion-item {
  --background-active: transparent;
  --ripple-color: transparent;
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
  /* minmax(0, 1fr), not 1fr — a plain 1fr track won't shrink below the
     intrinsic width of its content (the icon-button row below), which is
     what was pushing the Back Image column off the right edge. */
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
  margin-top: 8px;
}

.img-preview-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.img-controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
  padding: 4px;
  background: var(--ion-color-step-100);
  border-radius: 0 0 8px 8px;
  border: 1px solid var(--ion-color-step-150);
  border-top: none;
}

.img-controls ion-button {
  --padding-start: 4px;
  --padding-end: 4px;
  margin: 0;
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

.fullscreen-single-image {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fullscreen-single-image img {
  max-width: 100%;
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

