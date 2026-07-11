<template>
  <ion-page>
    <ion-header class="ion-no-border immersive-header" :class="{ 'is-scrolled': isScrolled, 'has-ads': isNative && showAds }">
       <!-- Native (mobile) AdMob banner -->
       <div v-if="isNative && showAds" id="ad-space-place-detail" :style="{ height: '65px', paddingTop: 'var(--ion-safe-area-top, 0)' }"></div>
       <app-header
           :title="$t('explore.details.title')"
           show-back
           :useRouterBack="true"
           :backRoute="'/explore'"
           :icon="mapOutline"
           :transparent="!isScrolled"
           :contrast="!isScrolled"
       >
         <template #actions>
           <ion-item v-if="canEdit" button :detail="false" @click="editItem" lines="none">
             <ion-icon :icon="createOutline" slot="start"/>
             <ion-label>{{ $t('search.details.edit') }}</ion-label>
           </ion-item>

           <ion-item v-if="isOwner" button :detail="false" @click="manageBusiness" lines="none">
             <ion-icon :icon="briefcaseOutline" slot="start"/>
             <ion-label>{{ $t('business.manage') }}</ion-label>
           </ion-item>

           <ion-item v-else-if="isLoggedIn && !place?.is_claimed && claimStatus !== 'pending'" button :detail="false" @click="claimBusiness" lines="none">
             <ion-icon :icon="ribbonOutline" slot="start"/>
             <ion-label>{{ $t('business.claim.action') }}</ion-label>
           </ion-item>

           <ion-item button :detail="false" @click="reportItem" lines="none">
             <ion-icon :icon="alertCircleOutline" slot="start"/>
             <ion-label>{{ $t('search.details.report') }}</ion-label>
           </ion-item>

           <ion-item button :detail="false" @click="share" lines="none">
             <ion-icon :icon="shareSocialOutline" slot="start"/>
             <ion-label>{{ $t('search.details.share') }}</ion-label>
           </ion-item>

           <ion-item v-if="isLoggedIn" button :detail="false" @click="openSaveModal" lines="none">
             <ion-icon :icon="isLocationSaved(place?.id || 0) ? bookmark : bookmarkOutline" slot="start" :color="isLocationSaved(place?.id || 0) ? 'carrot' : ''" />
             <ion-label>{{ isLocationSaved(place?.id || 0) ? $t('savedLocations.saved') || 'Saved' : $t('savedLocations.save') || 'Save Location' }}</ion-label>
           </ion-item>
         </template>
       </app-header>
     </ion-header>

    <ion-content :scroll-events="true" @ionScroll="handleScroll" fullscreen>
      <div v-if="!loading && place">
        <!-- 🖼️ Image carousel (Swiper) -->
        <Swiper
            :modules="modules"
            :zoom="true"
            :slides-per-view="1"
            :pagination="{ clickable: true }"
            class="place-swiper"
        >
          <SwiperSlide v-if="place?.image">
            <img
                :src="place.image"
                alt="Place image"
                style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;"
                @click="openImageModal(0)"
            />
          </SwiperSlide>
          <SwiperSlide v-for="(photo, index) in locationPhotos" :key="photo.id">
            <img
                :src="photo.url"
                alt="Place image"
                style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;"
                @click="openImageModal(place?.image ? index + 1 : index)"
            />
          </SwiperSlide>
          <SwiperSlide v-if="!place?.image && locationPhotos.length === 0">
            <img
                src="https://placehold.co/600x300?text=No+Image"
                alt="Place image"
                style="width: 100%; height: 100%; object-fit: cover;"
            />
          </SwiperSlide>
        </Swiper>

        <!-- 📍 Location Info Section -->
        <div 
          :class="[
            'details-container', 
            place?.partner_tier ? 'tier-' + place.partner_tier.toLowerCase() : ''
          ]"
        >
          <!-- Premium Flare for Gold/Silver -->
          <div v-if="['gold', 'silver'].includes(String(place?.partner_tier || '').toLowerCase())" class="premium-flare"></div>

          <div class="ion-padding" style="position: relative; z-index: 2;">
            <div class="title-row">
              <h2 class="product-title">{{ place?.name }}</h2>
              <div v-if="place?.partner_tier" class="premium-badge-wrapper">
                <div :class="['premium-badge-pill', place.partner_tier.toLowerCase()]">
                  <ion-icon :icon="sparkles" />
                  <span>{{ place.partner_tier.toUpperCase() }}</span>
                </div>
              </div>
            </div>

            <div class="status-action-row">
              <ion-chip color="carrot" class="capitalize">{{ place?.type }}</ion-chip>
              <div v-if="place?.partner_tier" class="official-verified-tag">
                <ion-icon :icon="shieldCheckmarkOutline" />
                <span>{{ $t('explore.details.officialPartner') }}</span>
              </div>
              <div v-else-if="place?.is_claimed" class="claimed-verified-tag">
                <ion-icon :icon="checkmarkCircle" />
                <span>{{ $t('business.claimedBadge') }}</span>
              </div>
            </div>

            <!-- ⭐ Ratings Header Row -->
            <div v-if="place?.review_count && place.review_count > 0" class="rating-header-row ion-margin-top ion-margin-bottom" @click="scrollToReviews">
              <span class="rating-stars" v-html="renderStars(place.avg_rating || 0)"></span>
              <span class="rating-value">{{ (place.avg_rating || 0).toFixed(1) }}</span>
              <span class="rating-count">{{ $t('store.ratingCount', { count: place.review_count }) }}</span>
            </div>
            <div v-else-if="isReviewableType" class="rating-header-row ion-margin-top ion-margin-bottom no-ratings" :class="{ 'disabled-click': isOwner }" @click="!isOwner && openFacilityReview()">
              <span class="rating-stars">☆☆☆☆☆</span>
              <span class="rating-count">{{ $t('facilityReview.noReviewsYet') || 'No reviews yet' }}</span>
            </div>

            <!-- Verified owner attribution -->
            <p v-if="place?.is_claimed && ownerName" class="owned-by-line">
              <ion-icon :icon="checkmarkCircle" />
              {{ $t('business.ownedBy', { name: ownerName }) }}
            </p>

            <!-- Pending claim banner — only shown to the user who submitted the claim -->
            <div v-if="claimStatus === 'pending'" class="claim-review-banner">
              <ion-icon :icon="informationCircle" />
              <div class="claim-review-text">
                <strong>{{ $t('business.claim.reviewBannerTitle') }}</strong>
                <p>{{ $t('business.claim.reviewBannerText') }}</p>
              </div>
            </div>

            <!-- 🏷️ Location Tags -->
            <div v-if="place.tags?.length" class="hashtag-row">
              <template v-if="showAllTags">
                <span v-for="tag in place.tags" :key="tag" class="location-hashtag">
                  #{{ tag }}
                </span>
                <span class="location-hashtag-more" @click="showAllTags = false">
                  less
                </span>
              </template>
              <template v-else>
                <span v-for="tag in place.tags.slice(0, 3)" :key="tag" class="location-hashtag">
                  #{{ tag }}
                </span>
                <span v-if="place.tags.length > 3" class="location-hashtag-more" @click="showAllTags = true">
                  ... more
                </span>
              </template>
            </div>

            <!-- ⚠️ Combined Muslim-friendly Disclaimer Banner -->
            <div
                v-if="isMuslimFriendly"
                class="muslim-friendly-disclaimer-card animate__animated animate__fadeIn"
                :class="{ 'clickable': !!place.description }"
                @click="place.description ? scrollToDescription() : null"
            >
              <div class="disclaimer-content">
                <ion-icon :icon="alertCircleOutline" class="disclaimer-icon" />
                <div class="disclaimer-text">
                  <strong>If in doubt:</strong> {{ combinedDisclaimer }}
                </div>
              </div>
              <ion-icon v-if="place.description" :icon="chevronDown" class="disclaimer-arrow" />
            </div>

            <!-- 🕌 Muslim Facilities / Features -->
            <div v-if="place && isReviewableType" class="facilities-container ion-margin-top ion-margin-bottom">
              <div class="consensus-squares" v-if="combinedFacilities.length > 0">
                <div 
                  v-for="fac in combinedFacilities" 
                  :key="fac.code"
                  class="consensus-square"
                  :class="[fac.status, fac.source === 'owner' ? 'owner-source' : 'visitor-source']"
                >
                  <span class="square-icon">{{ fac.icon }}</span>
                  <span class="square-label">{{ fac.customLabel || getShortLabel(fac.code) }}</span>
                  <!-- Verified owner badge/label -->
                  <span v-if="fac.source === 'owner'" class="owner-badge-dot">🏪 Verified</span>
                </div>
              </div>
              <p v-else class="no-consensus-text">
                {{ $t('facilityReview.noConsensusYet') || 'No visitor reports yet. Be the first to share!' }}
              </p>
              
              <!-- Rate & Review Button -->
              <div class="ion-text-center ion-margin-top" v-if="!isOwner && !userHasReviewed">
                <ion-button 
                  fill="outline" 
                  color="carrot" 
                  size="small" 
                  class="rate-btn" 
                  @click="openFacilityReview"
                >
                  {{ $t('facilityReview.rateReviewAction') || 'Rate & Review Facilities' }}
                </ion-button>
              </div>
            </div>

            <p v-if="place?.author?.public_profile" class="attribution-text">
              {{ $t('home.addedBy', { author: place.author.display_name }) }} - {{ fromNowToTaipei(place.created_at) }}
            </p>
            <p v-else class="attribution-text">
              {{ $t('home.added') }} {{ fromNowToTaipei(place.created_at) }}
            </p>

            <!-- Order Via delivery apps -->
            <div v-if="place.foodpanda_url || place.ubereats_url" class="ion-margin-top ion-margin-bottom">
              <p class="section-title">
                <strong><small>{{ $t('explore.details.orderVia') }}</small></strong>
              </p>
              <div v-if="place.foodpanda_url" class="foodpanda-card" @click="logFoodpanda">
                <img
                  src="https://ph-test-11.slatic.net/p/9a66c3f38bcbb5940d790d9fd58855ee.png"
                  alt="Foodpanda"
                  class="foodpanda-card-logo"
                />
                <ion-button
                    fill="solid"
                    color="carrot"
                    size="small"
                    :href="place.foodpanda_url"
                    target="_blank">
                  {{ $t('explore.details.orderNow') }}
                </ion-button>
              </div>
              <div v-if="place.ubereats_url" class="ubereats-card" @click="logUberEats">
                <span class="ubereats-logo">Uber<b>Eats</b></span>
                <ion-button
                    fill="solid"
                    color="carrot"
                    size="small"
                    :href="place.ubereats_url"
                    target="_blank">
                  {{ $t('explore.details.orderNow') }}
                </ion-button>
              </div>
            </div>

            <!-- Certified By (Gold Partner) -->
            <div
                v-if="!loadingCertifications && certifications.length"
                class="ion-margin-top"
            >
              <p class="section-title">
                <strong><small>{{ $t('explore.details.certifiedBy') }}</small></strong>
              </p>

              <div
                  v-for="c in certifications"
                  :key="c.partner.id"
                  class="gold-cert-card"
                  role="button"
                  tabindex="0"
                  @click="goToPartner(c.partner.id)"
              >
                <div class="gold-glow"></div>

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
                        <ion-icon :icon="sparkles" />
                        {{ $t('explore.details.verifiedGoldPartner') }}
                      </div>
                    </div>
                  </div>

                  <!-- RIGHT SIDE ACTION -->
                  <ion-button
                      v-if="c.proof_url"
                      fill="clear"
                      size="small"
                      color="carrot"
                      @click.stop
                      :href="c.proof_url"
                      target="_blank"
                      aria-label="View certificate"
                  >
                    <ion-icon slot="icon-only" :icon="documentTextOutline" />
                  </ion-button>
                </div>
              </div>
            </div>


            <!-- 📝 Description -->
            <template v-if="place.description">
              <ion-item lines="none" id="place-description-section">
                <ion-icon :icon="documentTextOutline" slot="start" color="carrot"/>

                <ion-label>
                  <p class="text-sm text-gray-500">
                    {{ isMuslimFriendly ? $t('explore.details.handlingDetails') : $t('search.details.description') }}
                  </p>
                  <p style="white-space: pre-line;">
                   {{ place.description }}
                  </p>
                </ion-label>
              </ion-item>
            </template>




            <!-- 📍 Address -->
            <ion-item lines="none">
              <ion-icon :icon="navigateOutline" slot="start" color="carrot"/>

              <ion-label>
                <p class="text-sm text-gray-500">{{ $t('explore.details.address') }}</p>
                <p>{{ place.address || $t('explore.details.noAddress') }}</p>
              </ion-label>

              <ion-button
                  fill="clear"
                  size="small"
                  color="carrot"
                  @click="logOpenMaps"
                  :href="`https://www.google.com/maps/search/?api=1&query=${mapSearchQuery}&center=${place.lat},${place.lng}&zoom=16`"
                  target="_blank"
              >
                {{ $t('common.open') }}
              </ion-button>
            </ion-item>


            <!-- 🗺️ Interactive Map -->
            <div class="rounded-xl overflow-hidden ion-margin-vertical shadow-md detail-map-container">
              <div ref="detailMapRef" class="detail-map"></div>
            </div>

            <!-- Promotions and Menu Action Buttons -->
            <div v-if="activePromos.length > 0 || menuItems.length > 0" class="biz-actions-row ion-margin-vertical">
              <ion-button v-if="activePromos.length > 0" fill="solid" color="carrot" class="action-sheet-btn" @click="showPromosModal = true">
                <ion-icon :icon="sparkles" slot="start" />
                {{ $t('business.tabs.promos') || 'Promotions & Offers' }}
              </ion-button>
              <ion-button v-if="menuItems.length > 0" fill="outline" color="carrot" class="action-sheet-btn" @click="showMenuModal = true">
                <ion-icon :icon="restaurantOutline" slot="start" />
                {{ $t('business.tabs.menu') || 'View Menu' }}
              </ion-button>
            </div>

            <!-- ⭐ Additional Details -->
            <div class="ion-margin-vertical">
              <!-- 🕒 Opening Hours -->
              <template v-if="place.opening_hours">
                <div class="ion-margin-top ion-margin-bottom">
                  <h3 class="font-bold text-lg">{{ $t('explore.details.openingHours') }}</h3>
                  <div class="open-status-badge" :class="{ open: isOpenNow, closed: !isOpenNow }">
                    {{ isOpenNow ? $t('explore.details.openNow') : $t('explore.details.closedNow') }}
                  </div>
                </div>

                <ion-list>
                  <ion-item v-for="(value, day) in formattedOpeningHours" :key="day" :class="{ 'today-highlight': day === todayDayLabel }">
                    <ion-label class="capitalize">{{ day }}</ion-label>
                    <ion-label slot="end" class="ion-text-right">
            <span v-if="value.active">
              {{ value.open }} – {{ value.close }}
            </span>
                      <span v-else class="text-gray-400">{{ $t('common.closed') }}</span>
                    </ion-label>
                  </ion-item>
                </ion-list>
              </template>

              <!-- 📞 Contact Info & Price Range (Additional Details) -->
              <template v-if="place.phone || place.instagram || place.facebook || place.tiktok || place.website || place.line_id || place.price_range">
                <div class="collapsible-header" @click="showAdditionalDetails = !showAdditionalDetails">
                  <h3 class="font-bold text-lg ion-no-margin">{{ $t('explore.details.additionalDetails') || 'Additional Details' }}</h3>
                  <ion-icon :icon="showAdditionalDetails ? chevronUp : chevronDown" class="collapsible-chevron" />
                </div>

                <div v-show="showAdditionalDetails" class="collapsible-content">
                  <ion-item lines="none" v-if="place.phone">
                    <ion-icon :icon="callOutline" slot="start" color="carrot"/>
                    <ion-label>
                      <p class="text-sm text-gray-500">{{ $t('common.phone') }}</p>
                      <p>{{ place.phone }}</p>
                    </ion-label>

                    <ion-button
                        fill="clear"
                        color="carrot"
                        @click="logCall"
                        :href="`tel:${place.phone}`"
                    >
                      {{ $t('common.call') }}
                    </ion-button>
                  </ion-item>

                  <ion-item lines="none" v-if="place.instagram">
                    <ion-icon :icon="logoInstagram" slot="start" color="carrot"/>
                    <ion-label>
                      <p class="text-sm text-gray-500">{{ $t('common.instagram') }}</p>
                      <p>@{{ place.instagram.replace('@', '') }}</p>
                    </ion-label>
                    <ion-button
                        fill="clear"
                        size="small"
                        @click="logInstagram"
                        :href="`https://instagram.com/${place.instagram.replace('@','')}`"
                        target="_blank">
                      {{ $t('common.open') }}
                    </ion-button>
                  </ion-item>

                  <ion-item lines="none" v-if="place.facebook">
                    <ion-icon :icon="logoFacebook" slot="start" color="carrot"/>
                    <ion-label>
                      <p class="text-sm text-gray-500">{{ $t('business.info.facebook') }}</p>
                      <p>Facebook</p>
                    </ion-label>
                    <ion-button fill="clear" size="small" :href="place.facebook" target="_blank">
                      {{ $t('common.open') }}
                    </ion-button>
                  </ion-item>

                  <ion-item lines="none" v-if="place.tiktok">
                    <ion-icon :icon="logoTiktok" slot="start" color="carrot"/>
                    <ion-label>
                      <p class="text-sm text-gray-500">{{ $t('business.info.tiktok') }}</p>
                      <p>@{{ place.tiktok.replace('@', '') }}</p>
                    </ion-label>
                    <ion-button fill="clear" size="small" :href="`https://tiktok.com/@${place.tiktok.replace('@','')}`" target="_blank">
                      {{ $t('common.open') }}
                    </ion-button>
                  </ion-item>

                  <ion-item lines="none" v-if="place.website">
                    <ion-icon :icon="globeOutline" slot="start" color="carrot"/>
                    <ion-label>
                      <p class="text-sm text-gray-500">{{ $t('business.info.website') }}</p>
                      <p>{{ place.website.replace(/^https?:\/\//, '') }}</p>
                    </ion-label>
                    <ion-button fill="clear" size="small" :href="place.website" target="_blank">
                      {{ $t('common.open') }}
                    </ion-button>
                  </ion-item>

                  <ion-item lines="none" v-if="place.line_id">
                    <ion-icon :icon="chatboxEllipsesOutline" slot="start" color="carrot"/>
                    <ion-label>
                      <p class="text-sm text-gray-500">{{ $t('common.lineId') }}</p>
                      <p>{{ place.line_id }}</p>
                    </ion-label>

                    <ion-button
                        fill="clear"
                        size="small"
                        @click="logLine"
                        :href="`line://ti/p/~${place.line_id}`">
                      {{ $t('common.open') }}
                    </ion-button>
                  </ion-item>

                  <!-- 💰 Price Range -->
                  <template v-if="place.price_range">
                    <ion-item lines="none">
                      <ion-icon :icon="cashOutline" slot="start" color="carrot"/>
                      <ion-label>
                        <p class="text-sm text-gray-500">{{ $t('explore.details.estimatedPrice') }}</p>
                        <p>{{ place.price_range }}</p>
                      </ion-label>
                    </ion-item>
                  </template>
                </div>
              </template>

            </div>

            <!-- ⭐ Visitor Reviews List -->
            <div v-if="place && isReviewableType" class="reviews-section ion-margin-top" id="visitor-reviews-section">
              <h3 class="section-title">
                <strong>{{ $t('facilityReview.reviewsHeader') || 'Visitor Reviews' }}</strong>
              </h3>
              <div v-if="reviews.length > 0" class="review-list">
                <div v-for="review in reviews" :key="review.id" class="review-card">
                  <div class="review-header">
                    <ion-avatar class="reviewer-avatar">
                      <img :src="review.user_profiles?.public_profile ? review.user_profiles?.avatar_url || '/favicon-32x32.png' : '/favicon-32x32.png'" />
                    </ion-avatar>
                    <div class="reviewer-info">
                      <span class="reviewer-name">{{ review.user_profiles?.public_profile ? review.user_profiles?.display_name || 'User' : ($t('profile.anonymous') || 'Anonymous') }}</span>
                      <span class="review-date">{{ fromNowToTaipei(review.created_at) }}</span>
                    </div>
                    <div class="review-stars-badge" v-if="review.rating">
                      <span class="star-badge-icon">★</span>
                      <span class="star-badge-val">{{ review.rating }}</span>
                    </div>
                  </div>

                  <p v-if="review.comment" class="review-comment">{{ review.comment }}</p>

                  <!-- Owner Response (if exists) -->
                  <div class="owner-reply-block" v-if="review.owner_response">
                    <div class="owner-reply-header">
                      <span class="owner-reply-badge">🏪 {{ $t('business.reviews.ownerReplyBadge') || 'Owner Response' }}</span>
                      <span class="owner-reply-date" v-if="review.owner_responded_at">{{ fromNowToTaipei(review.owner_responded_at) }}</span>
                    </div>
                    <p class="owner-reply-text">{{ review.owner_response }}</p>
                  </div>

                  <!-- User's own review actions -->
                  <div class="review-actions-row" v-if="currentUser?.id === review.user_id">
                    <ion-button fill="clear" size="small" color="carrot" class="action-btn" @click="openFacilityReview">
                      <ion-icon :icon="createOutline" slot="start" />
                      {{ $t('common.edit') || 'Edit' }}
                    </ion-button>
                    <ion-button fill="clear" size="small" color="danger" class="action-btn" @click="review.id && confirmDeleteReview(review.id)">
                      <ion-icon :icon="trashOutline" slot="start" />
                      {{ $t('common.delete') || 'Delete' }}
                    </ion-button>
                  </div>
                </div>
              </div>
              <div v-else class="no-reviews">
                <p>{{ $t('facilityReview.noReviewsYet') || 'No reviews yet' }}</p>
              </div>
            </div>

            <!-- Audit History Log -->
            <AuditHistoryLog ref="auditLogRef" entityType="location" :entityId="place.id" :createdAt="place.created_at" />
          </div>
        </div>
      </div>

      <!-- Skeleton while loading -->
      <div v-else>
        <ion-skeleton-text
            animated
            style="width:100%;height:300px;margin-bottom:12px;"
        />
        <ion-skeleton-text animated style="width:80%;height:20px;margin-bottom:8px;"/>
        <ion-skeleton-text animated style="width:60%;height:16px;margin-bottom:8px;"/>
      </div>
    </ion-content>

    <!-- 🟢 Fullscreen image modal -->
    <ion-modal :is-open="showImageModal" @didDismiss="closeImageModal">
      <ion-content fullscreen>
        <ion-button
            fill="solid"
            color="carrot"
            class="image-modal-close-btn"
            @click="closeImageModal"
        >
          ✕
        </ion-button>

        <Swiper
            v-if="showImageModal"
            :modules="[Zoom, Pagination]"
            :zoom="true"
            :slides-per-view="1"
            :pagination="{ clickable: true }"
            :initial-slide="initialPhotoIndex"
            class="fullscreen-swiper"
        >
          <SwiperSlide v-if="place?.image">
            <div class="swiper-zoom-container">
              <img :src="place.image" alt="Place Image"/>
            </div>
          </SwiperSlide>
          <SwiperSlide v-for="photo in locationPhotos" :key="photo.id">
            <div class="swiper-zoom-container">
              <img :src="photo.url" alt="Place Image"/>
            </div>
          </SwiperSlide>
        </Swiper>
      </ion-content>
    </ion-modal>

    <!-- Save Location Modal -->
    <SaveLocationModal
      :is-open="showSaveLocationModal"
      :location-id="place?.id || 0"
      :location-name="place?.name || ''"
      @close="showSaveLocationModal = false"
      @saved="checkSavedState(place?.id || 0)"
    />

    <ion-modal 
      :is-open="showTwoStepGate" 
      @didDismiss="showTwoStepGate = false" 
      class="two-step-gate-modal"
      :initial-breakpoint="0.6"
      :breakpoints="[0, 0.6, 0.95]"
      :handle="true"
    >
      <ion-content class="ion-no-padding">
        <!-- Place Image Banner -->
        <div class="place-banner">
          <img v-if="place?.image" :src="place.image" class="place-img" />
          <div v-else class="place-placeholder-banner">
            <span class="placeholder-icon">🕌</span>
          </div>
          <div class="category-badge-wrapper">
            <span class="category-badge">{{ place?.type || 'Location' }}</span>
          </div>
        </div>

        <div class="ion-padding content-wrapper ion-text-center">
          <h2 class="place-title">{{ place?.name }}</h2>
          <p v-if="place?.address" class="place-address">
            <ion-icon :icon="navigateOutline" class="address-icon" /> {{ place.address }}
          </p>

          <div class="gate-divider"></div>

          <template v-if="gateStep === 1">
            <h3 class="gate-heading">{{ $t('facilityReview.gate.didYouVisitPrompt') || 'Did you visit here?' }}</h3>
            <p class="gate-desc">{{ $t('facilityReview.gate.didYouVisitDesc') }}</p>
            <div class="gate-buttons">
              <ion-button expand="block" color="carrot" class="action-btn" @click="goToStep2">
                {{ $t('facilityReview.gate.yes') }}
              </ion-button>
              <ion-button expand="block" fill="clear" color="medium" class="cancel-btn" @click="dismissGate">
                {{ $t('facilityReview.gate.no') }}
              </ion-button>
            </div>
          </template>

          <template v-else-if="gateStep === 2">
            <h3 class="gate-heading">{{ $t('facilityReview.gate.leaveReview') }}</h3>
            <p class="gate-desc">{{ $t('facilityReview.gate.leaveReviewDesc') }}</p>
            <div class="gate-buttons">
              <ion-button expand="block" color="carrot" class="action-btn" @click="openReviewFromGate">
                {{ $t('facilityReview.gate.writeReview') }}
              </ion-button>
              <ion-button expand="block" fill="clear" color="medium" class="cancel-btn" @click="showTwoStepGate = false">
                {{ $t('facilityReview.gate.maybeLater') }}
              </ion-button>
            </div>
          </template>
        </div>
      </ion-content>
    </ion-modal>

    <!-- Facility Review Modal -->
    <FacilityReviewModal
      :is-open="facilityReviewModalOpen"
      :location-id="place?.id || 0"
      :location-name="place?.name || ''"
      :is-accommodation="isAccommodation"
      @close="facilityReviewModalOpen = false"
      @success="handleReviewSuccess"
    />

    <!-- 🏷️ Promotions Bottom Sheet Modal -->
    <ion-modal 
      :is-open="showPromosModal" 
      @didDismiss="showPromosModal = false" 
      class="bottom-sheet-modal"
      :initial-breakpoint="0.6"
      :breakpoints="[0, 0.6, 0.95]"
      :handle="true"
    >
      <ion-header>
        <ion-toolbar>
          <ion-title>{{ $t('business.tabs.promos') || 'Promotions & Offers' }}</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="showPromosModal = false">{{ $t('common.close') || 'Close' }}</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <div class="promos-modal-list">
          <div v-for="promo in activePromos" :key="promo.id" class="promo-card">
            <div class="promo-badge">
              <ion-icon :icon="sparkles" />
              <span>SPECIAL OFFER</span>
            </div>
            <h4 class="promo-title">{{ promo.title }}</h4>
            <p v-if="promo.body" class="promo-body">{{ promo.body }}</p>
          </div>
        </div>
      </ion-content>
    </ion-modal>

    <!-- 🍽️ Menu Bottom Sheet Modal -->
    <ion-modal 
      :is-open="showMenuModal" 
      @didDismiss="showMenuModal = false" 
      class="bottom-sheet-modal"
      :initial-breakpoint="0.7"
      :breakpoints="[0, 0.7, 0.95]"
      :handle="true"
    >
      <ion-header>
        <ion-toolbar>
          <ion-title>{{ $t('business.tabs.menu') || 'Menu' }}</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="showMenuModal = false">{{ $t('common.close') || 'Close' }}</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <div class="menu-modal-list">
          <div v-for="item in menuItems" :key="item.id" class="menu-item-row">
            <img v-if="item.photo_url" :src="item.photo_url" class="menu-item-photo" />
            <div v-else class="menu-item-photo-placeholder">
              <ion-icon :icon="restaurantOutline" />
            </div>
            <div class="menu-item-info">
              <div class="menu-item-header">
                <span class="menu-item-name">{{ item.name }}</span>
                <span v-if="item.price != null" class="menu-item-price">${{ item.price }}</span>
              </div>
              <p v-if="item.description" class="menu-item-description">{{ item.description }}</p>
            </div>
          </div>
        </div>
      </ion-content>
    </ion-modal>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage,
  IonContent,
  IonSkeletonText,
  IonIcon,
  IonItem,
  IonLabel,
  IonModal,
  IonButton, IonHeader, IonChip,
  IonList,
  IonAvatar,
  IonToolbar, IonTitle, IonButtons,
  popoverController, onIonViewDidEnter,
  alertController, toastController
} from '@ionic/vue'
import { Capacitor } from '@capacitor/core'
import { isDonor } from "@/composables/useSubscriptionStatus"
import { scheduleBannerUpdate } from '@/plugins/admob'
import {ref, onMounted, computed, nextTick, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {onIonViewWillEnter} from '@ionic/vue'
import {useRoute, useRouter} from 'vue-router'
import {supabase} from '@/plugins/supabaseClient'
import {Share} from '@capacitor/share'
import {Swiper, SwiperSlide} from 'swiper/vue'
import {Pagination, Zoom} from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/pagination'
import 'swiper/css/zoom'
import AppHeader from '@/components/AppHeader.vue'
import AuditHistoryLog from '@/components/AuditHistoryLog.vue'
import {
  alertCircle, informationCircle, chevronDown, chevronUp,
  alertCircleOutline, callOutline, cashOutline, chatboxEllipsesOutline,
  createOutline, documentTextOutline, logoInstagram,
  trashOutline,
  mapOutline,
  navigateOutline,
  shareSocialOutline,
  sparkles,
  shieldCheckmarkOutline,
  bookmarkOutline,
  bookmark,
  briefcaseOutline,
  ribbonOutline,
  checkmarkCircle,
  logoFacebook,
  logoTiktok,
  globeOutline,
  restaurantOutline
} from 'ionicons/icons'
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

function fromNowToTaipei(dateString?: string) {
  if (!dateString) return ''
  return dayjs.utc(dateString).tz('Asia/Taipei').fromNow()
}

import {ActivityLogService} from "@/services/ActivityLogService";
import {ClaimService} from "@/services/ClaimService";
import { useSavedLocations } from '@/composables/useSavedLocations';
import SaveLocationModal from '@/components/SaveLocationModal.vue';
import mapsLoader from '@/plugins/googleMapsLoader'
import { useLocation } from '@/composables/useLocation'
import { currentUser } from '@/composables/userProfile'
import { MUSLIM_FACILITIES } from '@/constants/muslimFacilities'
import FacilityReviewModal from '@/components/FacilityReviewModal.vue'
import type { LocationReview, FacilitySummary } from '@/types/LocationReview'

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"

type OpeningHours = {
  [key: string]: {
    active: boolean
    open: string
    close: string
  }
}

type PlaceDetail = {
  id: number
  name: string
  lat: number
  lng: number
  image?: string | null
  address?: string | null
  description?: string | null
  type: string
  location_types: { name: string } | null
  phone?: string | null
  instagram?: string | null
  facebook?: string | null
  tiktok?: string | null
  website?: string | null
  line_id?: string | null
  foodpanda_url?: string | null
  ubereats_url?: string | null
  price_range?: string | null
  opening_hours?: OpeningHours | null
  created_at?: string
  author?: {
    display_name: string | null;
    public_profile: boolean;
  } | null;
  partner_tier?: 'Gold' | 'Silver' | 'Bronze' | null;
  approved?: boolean;
  tags?: string[] | null;
  is_claimed?: boolean;
  typeId?: number | null;
  has_prayer_room?: boolean;
  has_wudu?: boolean;
  is_alcohol_free?: boolean;
  halal_status?: string | null;
  avg_rating?: number;
  review_count?: number;
}

type LocationCertification = {
  certified_at: string | null
  proof_url?: string | null
  partner: {
    id: string
    name: string
    logo_url: string | null
    partner_tier: 'gold' | 'silver' | 'bronze' | null
    verified: boolean
  }
}


const certifications = ref<LocationCertification[]>([])
const loadingCertifications = ref(false)

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const place = ref<PlaceDetail | null>(null)
const auditLogRef = ref<InstanceType<typeof AuditHistoryLog> | null>(null)
const showAllTags = ref(false)
const canEdit = ref(false)
const isOwner = ref(false)
const ownerName = ref<string | null>(null)
const claimStatus = ref<'pending' | 'approved' | 'rejected' | null>(null)
const modules = [Pagination, Zoom]
const isLoggedIn = ref(false)
const isNative = ref(Capacitor.isNativePlatform())

const showAds = computed(() => !isDonor.value)

onIonViewDidEnter(() => {
  scheduleBannerUpdate()
})

// Saved Locations
const { isLocationSaved, checkSavedState } = useSavedLocations()
const showSaveLocationModal = ref(false)

const isScrolled = ref(false)
const handleScroll = (ev: any) => {
  isScrolled.value = ev.detail.scrollTop > 80
}

const showImageModal = ref(false)
const locationPhotos = ref<any[]>([])
const menuItems = ref<any[]>([])
const activePromos = ref<any[]>([])
const showPromosModal = ref(false)
const showMenuModal = ref(false)
const showAdditionalDetails = ref(false)
const initialPhotoIndex = ref(0)

function openImageModal(index = 0) {
  initialPhotoIndex.value = index
  if (place.value) {
    ActivityLogService.log("explore_detail_open_image", {
      id: place.value.id,
      name: place.value.name,
      photo_index: index
    });
  }
  showImageModal.value = true
}

function openSaveModal() {
  if (!place.value) return
  showSaveLocationModal.value = true
  ActivityLogService.log("location_save_click", {
    location_id: place.value.id,
    location_name: place.value.name,
    source: "place_details"
  })
}

function closeImageModal() {
  showImageModal.value = false
}

const loading = ref(true)

/* ---------------- Map State ---------------- */
let mapInstance: google.maps.Map | null = null
let placeMarker: google.maps.marker.AdvancedMarkerElement | null = null
let userMarker: google.maps.marker.AdvancedMarkerElement | null = null
let advancedMarkerLib: typeof google.maps.marker | null = null
const { userLocation } = useLocation()
const detailMapRef = ref<HTMLElement | null>(null)

const MAP_ID = '6d203f1adb514723' // Same as ExploreView

const initMap = async () => {
  const el = detailMapRef.value
  if (!el || !place.value) return
  
  const [{Map}, marker] = await Promise.all([
    mapsLoader.importLibrary('maps'),
    mapsLoader.importLibrary('marker')
  ])
  advancedMarkerLib = marker
  
  const center = { lat: place.value.lat, lng: place.value.lng }
  
  mapInstance = new Map(el, {
    center,
    zoom: 16,
    disableDefaultUI: true,
    mapId: MAP_ID,
    clickableIcons: false,
    gestureHandling: 'greedy'
  })
  
  // Create place marker with custom pin element
  const pinElement = document.createElement('div')
  pinElement.className = 'place-marker-pin'
  pinElement.innerHTML = `
    <svg viewBox="0 0 24 24" width="36" height="36" fill="var(--ion-color-carrot, #ff9800)">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  `
  
  placeMarker = new marker.AdvancedMarkerElement({
    position: center,
    map: mapInstance,
    content: pinElement,
    title: place.value.name
  })
  
  // Add user location marker if available
  if (userLocation.value) {
    const dot = document.createElement('div')
    dot.className = 'user-location-dot'
    
    userMarker = new marker.AdvancedMarkerElement({
      position: { lat: userLocation.value.lat, lng: userLocation.value.lng },
      map: mapInstance,
      content: dot,
      title: 'Your Location'
    })
  }
}

watch([place, detailMapRef], ([newPlace, el]) => {
  if (newPlace && el) {
    initMap()
  }
})

const formattedOpeningHours = computed(() => {
  if (!place.value?.opening_hours) return {}

  // Check if opening_hours is in Google Places format (with periods)
  const hours = place.value.opening_hours as any
  if (hours.periods && Array.isArray(hours.periods)) {
    const dayMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
    const labels = {
      sun: "Sun",
      mon: "Mon",
      tue: "Tue",
      wed: "Wed",
      thu: "Thu",
      fri: "Fri",
      sat: "Sat",
    }

    const result: any = {}
    
    // Initialize all days as closed
    dayMap.forEach(day => {
      result[labels[day as keyof typeof labels]] = { active: false, open: '', close: '' }
    })

    // Process periods
    hours.periods.forEach((period: any) => {
      if (!period?.open) return
      
      const dayKey = dayMap[period.open.day] as keyof typeof labels
      if (!dayKey) return
      
      const openTime = period.open.time ? period.open.time.replace(':', '') : ''
      const closeTime = period.close?.time ? period.close.time.replace(':', '') : (period.open.time === '0000' ? '2400' : '')
      
      // Format time from HHMM to HH:MM
      const formatTime = (time: string) => {
        if (time.length === 4) {
          return `${time.substring(0, 2)}:${time.substring(2, 4)}`
        }
        return time
      }

      result[labels[dayKey]] = {
        active: true,
        open: formatTime(openTime),
        close: closeTime ? formatTime(closeTime) : t('explore.details.open24Hours') || '24h'
      }
    })

    return result
  }

  // Original format (day keys with active/open/close)
  const order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
  const labels = {
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
    sun: "Sun",
  }

  const result: any = {}
  order.forEach(day => {
    const key = day as DayKey
    if (place.value?.opening_hours?.[key]) {
      result[labels[key]] = place.value.opening_hours[key]
    }
  })

  return result
})

const isOpenNow = computed(() => {
  if (!place.value?.opening_hours) return false
  
  const hours = place.value.opening_hours as any
  
  // Check if opening_hours is in Google Places format (with periods)
  if (hours.periods && Array.isArray(hours.periods)) {
    const now = dayjs().tz('Asia/Taipei')
    const currentDay = now.day() // 0 = Sunday, 1 = Monday, etc.
    const currentTime = now.format('HHmm')
    
    for (const period of hours.periods) {
      // Skip malformed periods (same validation as ExploreView)
      if (!period?.open || !period?.close) continue
      if (typeof period.open.day !== 'number' || typeof period.close.day !== 'number') continue
      if (typeof period.open.time !== 'string' || typeof period.close.time !== 'string') continue
      
      const openDay = period.open.day
      const closeDay = period.close.day
      const openTime = period.open.time.replace(':', '')
      const closeTime = period.close.time.replace(':', '')
      
      // Handle same day opening
      if (openDay === currentDay && closeDay === currentDay) {
        if (currentTime >= openTime && currentTime <= closeTime) {
          return true
        }
      }
      // Handle overnight (e.g., opens Monday, closes Tuesday)
      else if (openDay === currentDay && closeDay !== currentDay) {
        if (currentTime >= openTime) {
          return true
        }
      }
      else if (closeDay === currentDay && openDay !== currentDay) {
        if (currentTime <= closeTime) {
          return true
        }
      }
    }
    
    return false
  }
  
  // Original format - check if current day is active and within time range
  const now = dayjs().tz('Asia/Taipei')
  const currentDay = now.day()
  const currentTime = now.format('HH:mm')
  const dayMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
  const currentDayKey = dayMap[currentDay] as DayKey
  
  const todayHours = hours[currentDayKey]
  if (!todayHours || !todayHours.active) return false
  
  return currentTime >= todayHours.open && currentTime <= todayHours.close
})

const todayDayLabel = computed(() => {
  const now = dayjs().tz('Asia/Taipei')
  const currentDay = now.day()
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  return labels[currentDay]
})

const mapSearchQuery = computed(() => {
  if (!place.value) return ''
  const name = place.value.name
  const address = place.value.address || ''
  return encodeURIComponent(`${name} ${address}`.trim())
})


const loadPlace = async () => {
  loading.value = true

  const {data, error} = await supabase
      .from('locations')
      .select(`
    id,
    name,
    lat,
    lng,
    image,
    address,
    description,
    created_by,
    phone,
    instagram,
    facebook,
    tiktok,
    website,
    line_id,
    foodpanda_url,
    ubereats_url,
    price_range,
    opening_hours,
    created_at,
    approved,
    tags,
    is_claimed,
    type_id,
    has_prayer_room,
    has_wudu,
    is_alcohol_free,
    halal_status,
    avg_rating,
    review_count,
    location_types(name),
    partner:partners(partner_tier)
  `)
      .eq('id', route.params.id)
      .maybeSingle()

  if (error) {
    console.error(error)
    return
  }

  if (data) {
    const locationType = Array.isArray(data.location_types)
        ? data.location_types[0]
        : data.location_types

    place.value = {
      id: data.id,
      name: data.name,
      image: data.image,
      type: locationType?.name ?? 'Halal Location',
      lat: data.lat,
      lng: data.lng,
      address: data.address,
      description: data.description,
      phone: data.phone,
      instagram: data.instagram,
      facebook: data.facebook,
      tiktok: data.tiktok,
      website: data.website,
      line_id: data.line_id,
      foodpanda_url: data.foodpanda_url,
      ubereats_url: data.ubereats_url,
      price_range: data.price_range,
      opening_hours: data.opening_hours,
      created_at: data.created_at,
      approved: data.approved,
      is_claimed: data.is_claimed ?? false,
      author: null,
      location_types: locationType ?? null,
      tags: data.tags ?? [],
      partner_tier: Array.isArray(data.partner) ? data.partner[0]?.partner_tier : (data.partner as any)?.partner_tier,
      typeId: data.type_id,
      has_prayer_room: data.has_prayer_room,
      has_wudu: data.has_wudu,
      is_alcohol_free: data.is_alcohol_free,
      halal_status: data.halal_status,
      avg_rating: data.avg_rating,
      review_count: data.review_count
    }

    fetchReviewsAndSummary()

    // 🔹 Fetch author details separately since join is missing in schema
    if (data.created_by) {
      const { data: authorData } = await supabase
        .from('user_profiles')
        .select('display_name, public_profile')
        .eq('id', data.created_by)
        .maybeSingle()
      
      if (authorData && place.value) {
        place.value.author = authorData
      }
    }

    await fetchLocationCertifications(data.id)

    // 🔹 If this listing is claimed, resolve the verified owner's display name
    if (data.is_claimed) {
      const { data: name } = await supabase.rpc('location_owner_name', { p_location_id: data.id })
      ownerName.value = (name as string | null) || null
    }


    // 🔹 Check if the current user can edit
    const {data: {user}} = await supabase.auth.getUser()
    if (user) {
      isLoggedIn.value = true
      // Check if user is the creator or an admin/contributor
      const {data: roleData} = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single()

      // Is the current user a verified owner/manager of this location?
      const { data: ownerRow } = await supabase
          .from('location_owners')
          .select('role')
          .eq('location_id', data.id)
          .eq('user_id', user.id)
          .maybeSingle()
      isOwner.value = !!ownerRow

      if (
          user.id === data.created_by ||
          roleData?.role === 'admin' ||
          roleData?.role === 'contributor' ||
          isOwner.value
      ) {
        canEdit.value = true
      }

      // If not already an owner, look up any existing claim to reflect its status
      if (!isOwner.value) {
        const claim = await ClaimService.getUserClaimForLocation(data.id)
        claimStatus.value = claim?.status ?? null
      }
    }

    await ActivityLogService.log("explore_place_detail_view", {
      id: data.id,
      name: data.name,
      type: locationType?.name ?? null
    });

    // Fetch photos
    try {
      const { data: photosData } = await supabase
        .from('location_photos')
        .select('*')
        .eq('location_id', data.id)
        .order('sort_order', { ascending: true })
      locationPhotos.value = photosData || []
    } catch (err) {
      console.error('Failed to load location photos:', err)
      locationPhotos.value = []
    }

    // Fetch menu items
    try {
      const { data: menuData } = await supabase
        .from('location_menu_items')
        .select('*')
        .eq('location_id', data.id)
        .order('sort_order', { ascending: true })
      menuItems.value = menuData || []
    } catch (err) {
      console.error('Failed to load menu items:', err)
      menuItems.value = []
    }

    // Fetch promotions
    try {
      const { data: promosData } = await supabase
        .from('location_promotions')
        .select('*')
        .eq('location_id', data.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      activePromos.value = promosData || []
    } catch (err) {
      console.error('Failed to load promotions:', err)
      activePromos.value = []
    }
  }

  loading.value = false
}

async function fetchLocationCertifications(locationId: number) {
  loadingCertifications.value = true

  const { data, error } = await supabase
      .from('location_certifications')
      .select(`
    certified_at,
    proof_url,
    partners:partner_id (
      id,
      name,
      logo_url,
      partner_tier,
      verified
    )
  `)
      .eq('location_id', locationId)
      .eq('status', 'active')



  if (!error && data) {
    certifications.value = data
        .map(c => {
          const body = Array.isArray(c.partners)
              ? c.partners[0]
              : c.partners

          if (!body) return null

          return {
            certified_at: c.certified_at ?? null,
            proof_url: c.proof_url ?? null,
            partner: body
          }
        })
        .filter(c => c !== null)
        .filter(c => c.partner.partner_tier === 'gold')
  }

  loadingCertifications.value = false
}

onIonViewWillEnter(async () => {
  await loadPlace()
  auditLogRef.value?.fetchLogs()

  // Honor ?review=1 query parameter
  if (route.query.review === '1') {
    gateStep.value = 1
    showTwoStepGate.value = true
  }
})

const logInstagram = () => {
  if (!place.value) return;
  ActivityLogService.log("explore_detail_instagram", {
    id: place.value.id,
    instagram: place.value.instagram
  });
};

function goToPartner(id: string) {
  ActivityLogService.log("partner_click", {
    partner_id: id,
    source: "location_detail"
  })

  router.push(`/partner/${id}`)
}


const share = async () => {
  if (!place.value) return

  await ActivityLogService.log("explore_detail_share", {
    id: place.value.id,
    name: place.value.name
  });

  await Share.share({
    title: place.value.name,
    text: `${place.value.name} (${place.value.type})\n🔗 https://app.halalformosa.com/place/${place.value.id}\n\nShared via Halal Formosa 🕌`,
    dialogTitle: t('search.details.share'),
  })
}

const logOpenMaps = () => {
  if (!place.value) return;
  ActivityLogService.log("explore_detail_open_maps", {
    id: place.value.id,
    name: place.value.name
  });
};

const logCall = () => {
  if (!place.value) return;
  ActivityLogService.log("explore_detail_call", {
    id: place.value.id,
    phone: place.value.phone
  });
};


const editItem = async () => {
  if (!place.value) return;

  ActivityLogService.log("explore_detail_edit", {
    id: place.value.id,
    name: place.value.name
  });

  try {
    await popoverController.dismiss();
  } catch {
    // Ignore if no popover is open
  }

  router.push(`/place/${place.value.id}/edit`);
};

const claimBusiness = async () => {
  if (!place.value) return;
  try { await popoverController.dismiss(); } catch { /* no popover */ }
  ActivityLogService.log("business_claim_start", { id: place.value.id });
  router.push(`/place/${place.value.id}/claim`);
};

const manageBusiness = async () => {
  if (!place.value) return;
  try { await popoverController.dismiss(); } catch { /* no popover */ }
  router.push(`/business/${place.value.id}`);
};

const reportItem = async () => {
  if (!place.value) return;

  ActivityLogService.log("explore_detail_report", {
    id: place.value.id,
    name: place.value.name
  });

  try {
    await popoverController.dismiss();
  } catch {
    // Ignore if no popover is open
  }

  router.push(`/place/${place.value.id}/report`);
};

const logLine = () => {
  if (!place.value) return;
  ActivityLogService.log("explore_detail_line", {
    id: place.value.id,
    line_id: place.value.line_id
  });
};

const logFoodpanda = () => {
  if (!place.value) return;
  ActivityLogService.log("explore_detail_foodpanda", {
    id: place.value.id,
    foodpanda_url: place.value.foodpanda_url
  });
};

const logUberEats = () => {
  if (!place.value) return;
  ActivityLogService.log("explore_detail_ubereats", {
    id: place.value.id,
    ubereats_url: place.value.ubereats_url
  });
};

// Generate Foodpanda search URL from location data
const generateFoodpandaSearchUrl = (name: string, lat: number, lng: number) => {
  const encodedName = encodeURIComponent(name);
  return `https://www.foodpanda.com.tw/?query=${encodedName}&lat=${lat}&lng=${lng}`;
};

const isMuslimFriendly = computed(() => {
  if (!place.value?.type) return false
  return place.value.type.toLowerCase().includes('muslim-friendly')
})

const combinedDisclaimer = computed(() => {
  if (!place.value?.type) return ''
  const typeLower = place.value.type.toLowerCase()
  let actionText = ''

  if (typeLower.includes('restaurant') || typeLower.includes('stall') || typeLower.includes('bakery') || typeLower.includes('kitchen')) {
    actionText = `ask the staff for a Muslim-friendly menu`
  } else if (typeLower.includes('accomodation') || typeLower.includes('hotel')) {
    actionText = `ask the staff for Muslim-friendly room and dining options`
  } else {
    actionText = `confirm with the staff or store owner`
  }

  if (place.value?.description) {
    return `This is a ${place.value.type}. Please review the handling details below, ${actionText}, or ask for further clarification.`
  }
  return `This is a ${place.value.type}. Please ${actionText}, or ask for further clarification.`
})

const scrollToDescription = () => {
  if (!place.value?.description) return
  const el = document.getElementById('place-description-section')
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

/* ---------------- Reviews & Facility Summary ---------------- */
const reviews = ref<LocationReview[]>([])
const userHasReviewed = computed(() => {
  if (!currentUser.value?.id || !reviews.value.length) return false
  return reviews.value.some(rev => rev.user_id === currentUser.value.id)
})
const facilitySummary = ref<FacilitySummary>({})
const loadingReviews = ref(false)

const showTwoStepGate = ref(false)
const gateStep = ref(1)
const facilityReviewModalOpen = ref(false)

const isAccommodation = computed(() => {
  if (!place.value?.type) return false
  const typeLower = place.value.type.toLowerCase()
  return typeLower.includes('hotel') || typeLower.includes('accommodation') || typeLower.includes('accomodation')
})

const isReviewableType = computed(() => {
  return !!place.value
})

const getFacilityStatus = (code: string): 'yes' | 'no' | null => {
  const counts = facilitySummary.value[code]
  if (!counts) return null
  const yes = counts.yes || 0
  const no = counts.no || 0
  
  if (yes === 0 && no === 0) return null
  
  if (yes > no) {
    return 'yes'
  } else if (no > yes) {
    return 'no'
  }
  return null
}

const hasAnyConsensus = computed(() => {
  return MUSLIM_FACILITIES.some(fac => {
    if (fac.code === 'qibla_direction' && !isAccommodation.value) return false
    return getFacilityStatus(fac.code) !== null
  })
})

const combinedFacilities = computed(() => {
  if (!place.value) return []
  const p = place.value
  const list: any[] = []
  
  const isOfficial = (code: string) => {
    if (code === 'halal_certified') return p.halal_status === 'certified'
    if (code === 'prayer_room') return !!p.has_prayer_room
    if (code === 'wudu') return !!p.has_wudu
    if (code === 'alcohol_free') return !!p.is_alcohol_free
    return false
  }

  MUSLIM_FACILITIES.forEach(fac => {
    if (fac.code === 'qibla_direction' && !isAccommodation.value) return
    const official = isOfficial(fac.code)
    const visitorStatus = getFacilityStatus(fac.code)
    
    if (official || visitorStatus === 'yes') {
      list.push({
        ...fac,
        source: official ? 'owner' : 'visitor',
        status: 'yes'
      })
    } else if (fac.code === 'halal_certified' && (p.halal_status === 'self_reported' || p.halal_status === 'muslim_friendly')) {
      list.push({
        ...fac,
        source: 'owner',
        status: 'yes',
        customLabel: p.halal_status === 'self_reported' ? 'Self-Reported Halal' : 'Muslim-Friendly'
      })
    }
  })

  // Sort: Owner-reported (Official) first, then by code
  list.sort((a, b) => {
    if (a.source !== b.source) {
      return a.source === 'owner' ? -1 : 1
    }
    return a.code.localeCompare(b.code)
  })

  return list
})

const getShortLabel = (code: string): string => {
  const labels: Record<string, string> = {
    halal_certified: 'HALAL CERTIFIED',
    prayer_room: 'PRAYER ROOM',
    wudu: 'WUDU FACILITIES',
    bidet: 'BIDET',
    space_to_pray: 'PRAY SPACE',
    pork_free: 'PORK FREE',
    cash_only: 'CASH ONLY',
    halal_food: 'HALAL FOOD',
    vegan_option: 'VEGAN OPTION',
    muslim_owned: 'MUSLIM OWNED',
    muslim_staff: 'MUSLIM STAFF',
    alcohol_free: 'ALCOHOL FREE',
    free_wifi: 'FREE WIFI',
    qibla_direction: 'QIBLA'
  }
  return labels[code] || code.replace('_', ' ').toUpperCase()
}

const fetchReviewsAndSummary = async () => {
  if (!place.value?.id) return
  loadingReviews.value = true
  try {
    // 1. Fetch reviews
    const { data: revData, error: revError } = await supabase
      .from('location_reviews')
      .select(`
        id,
        user_id,
        rating,
        comment,
        facilities,
        created_at,
        updated_at,
        owner_response,
        owner_responded_at,
        user_profiles (
          display_name,
          avatar_url,
          public_profile
        )
      `)
      .eq('location_id', place.value.id)
      .order('created_at', { ascending: false })

    if (!revError) {
      reviews.value = (revData || []) as any[]
    }

    // 2. Fetch facility summary
    const { data: sumData, error: sumError } = await supabase
      .rpc('get_location_facility_summary', { p_location_id: place.value.id })
    if (!sumError) {
      facilitySummary.value = (sumData || {}) as FacilitySummary
    }
  } catch (err) {
    console.warn('[PlaceDetailsView] Failed to fetch reviews and facility summary', err)
  } finally {
    loadingReviews.value = false
  }
}

const goToStep2 = () => {
  gateStep.value = 2
}

const dismissGate = async () => {
  showTwoStepGate.value = false
  if (currentUser.value?.id && place.value?.id) {
    try {
      await supabase
        .from('location_visits')
        .update({ dismissed: true })
        .eq('user_id', currentUser.value.id)
        .eq('location_id', place.value.id)
    } catch (err) {
      console.warn('[PlaceDetailsView] Failed to dismiss visit in DB', err)
    }
  }
}

const openReviewFromGate = () => {
  showTwoStepGate.value = false
  openFacilityReview()
}

const openFacilityReview = () => {
  facilityReviewModalOpen.value = true
}

const handleReviewSuccess = async () => {
  await loadPlace()
}

const confirmDeleteReview = async (reviewId: number) => {
  const alert = await alertController.create({
    header: t('common.confirm') || 'Confirm',
    message: t('facilityReview.deleteConfirmMsg') || 'Are you sure you want to delete your review?',
    buttons: [
      {
        text: t('common.cancel') || 'Cancel',
        role: 'cancel'
      },
      {
        text: t('common.delete') || 'Delete',
        role: 'destructive',
        handler: async () => {
          await deleteReview(reviewId)
        }
      }
    ]
  })
  await alert.present()
}

const deleteReview = async (reviewId: number) => {
  try {
    const { error } = await supabase
      .from('location_reviews')
      .delete()
      .eq('id', reviewId)

    if (error) throw error

    if (currentUser.value?.id && place.value?.id) {
      try {
        await supabase
          .from('location_visits')
          .update({ reviewed: false })
          .eq('user_id', currentUser.value.id)
          .eq('location_id', place.value.id)
      } catch (visitErr) {
        console.warn('Failed to reset visit reviewed status', visitErr)
      }
    }

    const toast = await toastController.create({
      message: '✅ Review deleted successfully',
      duration: 2000,
      color: 'success'
    })
    toast.present()

    await loadPlace()
  } catch (err: any) {
    console.error('Failed to delete review:', err)
    const toast = await toastController.create({
      message: `❌ Error: ${err.message || 'Failed to delete review'}`,
      duration: 3000,
      color: 'danger'
    })
    toast.present()
  }
}

function renderStars(rating: number): string {
  const full = Math.floor(rating)
  const half = rating - full >= 0.3 && rating - full < 0.8 ? 1 : 0
  const empty = 5 - full - half
  let html = ''
  for (let i = 0; i < full; i++) html += '★'
  if (half) html += '★'
  for (let i = 0; i < empty; i++) html += '☆'
  return html
}

const hasFacilities = (facilities: any) => {
  return facilities && Object.keys(facilities).length > 0
}

const getReviewFacilities = (facilities: any) => {
  return MUSLIM_FACILITIES.map(fac => {
    if (fac.code === 'qibla_direction' && !isAccommodation.value) return null
    const val = facilities[fac.code]
    if (val && val !== 'unsure') {
      return { ...fac, val }
    }
    return null
  }).filter(f => f !== null)
}

const getTriStateLabel = (val: string) => {
  return t(`facilityReview.triState.${val}`)
}

const scrollToReviews = () => {
  const el = document.getElementById('visitor-reviews-section')
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
</script>


<style scoped>
/* MAP STYLES */
.detail-map-container {
  width: 100%;
  height: 200px;
  border-radius: 12px;
  overflow: hidden;
}

.detail-map {
  width: 100%;
  height: 100%;
}

/* Place Marker */
.place-marker-pin {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  filter: drop-shadow(0 3px 6px rgba(0,0,0,0.3));
  transform: translateY(-50%);
}

/* User Location Dot (same as ExploreView) */
.user-location-dot {
  width: 16px;
  height: 16px;
  background: #4285f4;
  border: 2px solid white;
  border-radius: 50%;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
}

/* TIERED PAGE STYLES - Inherit from global variables if needed, otherwise clean up redundant local backgrounds */
.tier-gold .official-verified-tag {
  color: #ca8a04;
}
.tier-silver .official-verified-tag {
  color: #64748b;
}

.foodpanda-logo-wrapper {
  display: flex;
  align-items: center;
  height: 24px;
}

.foodpanda-logo {
  height: 24px;
  width: auto;
  object-fit: contain;
}

.foodpanda-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--ion-card-background, #ffffff);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border: 1px solid var(--ion-color-light, #f0f0f0);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.foodpanda-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.ubereats-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--ion-card-background, #ffffff);
  border-radius: 12px;
  padding: 16px;
  margin-top: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border: 1px solid var(--ion-color-light, #f0f0f0);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.ubereats-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.ubereats-logo {
  font-size: 1.1rem;
  font-weight: 800;
  color: #06c167; /* Uber Eats green */
  letter-spacing: -0.5px;
}

.ubereats-logo b {
  color: var(--ion-color-dark);
  font-weight: 800;
}

.foodpanda-card-logo {
  height: 40px;
  width: auto;
  object-fit: contain;
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

/* DESCRIPTION NOTICE BANNER */
.description-notice-banner {
  background: rgba(234, 88, 12, 0.08); /* carrot light */
  border: 1px solid rgba(234, 88, 12, 0.2);
  border-radius: 12px;
  padding: 12px;
  margin: 16px 0;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.description-notice-banner:active {
  transform: scale(0.98);
  background: rgba(234, 88, 12, 0.15);
}

.description-notice-banner.is-muslim-friendly {
  background: rgba(245, 158, 11, 0.1); /* warning light */
  border-color: rgba(245, 158, 11, 0.4);
}

.description-notice-banner.is-muslim-friendly .notice-icon-wrapper {
  background: #f59e0b;
  color: #fff;
}

.description-notice-banner.is-muslim-friendly .notice-title {
  color: #d97706;
}

.notice-icon-wrapper {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--ion-color-carrot);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.notice-text-content {
  flex: 1;
}

.notice-title {
  font-weight: 700;
  font-size: 13px;
  color: var(--ion-color-carrot);
  margin-bottom: 2px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.notice-message {
  font-size: 12px;
  color: var(--ion-color-step-800);
  line-height: 1.4;
}

.notice-arrow {
  font-size: 20px;
  color: var(--ion-color-medium);
  opacity: 0.5;
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

.open-status-badge {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 13px;
  margin-top: 8px;
}

.open-status-badge.open {
  background: rgba(34, 197, 94, 0.15);
  color: #16a34a;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.open-status-badge.closed {
  background: rgba(239, 68, 68, 0.15);
  color: #dc2626;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.today-highlight {
  background: rgba(234, 88, 12, 0.08);
  border-left: 3px solid var(--ion-color-carrot);
}

.today-highlight ion-label {
  font-weight: 600;
  color: var(--ion-color-carrot);
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

.claimed-verified-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--ion-color-success);
  font-weight: 700;
  font-size: 10px;
  letter-spacing: 0.5px;
}

.claimed-verified-tag ion-icon {
  font-size: 14px;
}

.claim-review-banner {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-top: 14px;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(var(--ion-color-carrot-rgb), 0.08);
  border: 1px solid rgba(var(--ion-color-carrot-rgb), 0.3);
}

.claim-review-banner ion-icon {
  font-size: 22px;
  color: var(--ion-color-carrot);
  flex-shrink: 0;
  margin-top: 1px;
}

.owned-by-line {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 10px 0 0;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--ion-color-dark);
}

.owned-by-line ion-icon {
  font-size: 16px;
  color: var(--ion-color-success);
}

.claim-review-text strong {
  display: block;
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--ion-color-dark);
  margin-bottom: 2px;
}

.claim-review-text p {
  margin: 0;
  font-size: 0.82rem;
  color: var(--ion-color-medium);
  line-height: 1.35;
}

.hashtag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.location-hashtag {
  font-size: 13px;
  font-weight: 600;
  color: var(--ion-color-carrot);
  opacity: 0.8;
  transition: opacity 0.2s ease;
  cursor: pointer;
}

.location-hashtag:hover {
  opacity: 1;
  text-decoration: underline;
}

.tier-gold .official-verified-tag {
  color: #ca8a04;
}

.image-modal-close-btn {
  position: absolute;
  top: calc(env(safe-area-inset-top, 0px) + 16px);
  right: 16px;
  z-index: 9999;
}

.place-swiper {
  margin: 0 !important;
  padding: 0 !important;
  width: 100%;
  height: 350px;
  overflow: hidden;
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

.fullscreen-swiper img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

iframe {
  border-radius: 4px;
}

.text-gray-500 {
  color: var(--ion-color-step-400, #718096) !important;
}

ion-item ion-label p:not(.text-gray-500) {
  color: var(--ion-text-color, #2d3748) !important;
}

.ion-palette-dark .text-gray-500 {
  color: #cbd5e0 !important; /* Whiter light-grey for label headers */
}

.ion-palette-dark ion-item ion-label p:not(.text-gray-500) {
  color: #ffffff !important; /* Pure white for content text */
}

/* ⚠️ Combined Muslim-friendly Disclaimer Card styling */
.muslim-friendly-disclaimer-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: rgba(var(--ion-color-warning-rgb, 255, 196, 9), 0.12);
  border: 1px solid var(--ion-color-warning, #ffc409);
  padding: 12px 16px;
  border-radius: 12px;
  margin: 16px 0;
  transition: all 0.2s ease;
}

.muslim-friendly-disclaimer-card.clickable {
  cursor: pointer;
}

.muslim-friendly-disclaimer-card.clickable:active {
  transform: scale(0.98);
  background: rgba(var(--ion-color-warning-rgb, 255, 196, 9), 0.18);
}

.disclaimer-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex: 1;
}

.disclaimer-icon {
  font-size: 24px;
  color: var(--ion-color-warning, #ffc409);
  flex-shrink: 0;
  margin-top: 1px;
}

.disclaimer-text {
  font-size: 0.85rem;
  line-height: 1.45;
  color: var(--ion-text-color);
}

.disclaimer-arrow {
  font-size: 20px;
  color: var(--ion-color-warning, #ffc409);
  flex-shrink: 0;
}

.location-hashtag-more {
  font-size: 13px;
  font-weight: 700;
  color: var(--ion-color-medium);
  cursor: pointer;
  text-decoration: underline;
  user-select: none;
}

/* Ratings & Reviews Styles */
.rating-header-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
}
.rating-stars {
  color: #ffc409;
}
.rating-value {
  color: var(--ion-text-color);
  font-weight: 700;
}
.rating-count {
  color: var(--ion-color-medium);
}
.no-ratings {
  color: var(--ion-color-medium);
  font-style: italic;
}
.rating-stars-badge {
  display: flex;
  align-items: center;
  gap: 3px;
  background: rgba(255, 196, 9, 0.15);
  color: #ffc409;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 8px;
  font-size: 0.85rem;
}
.facilities-container {
  border-top: 1px solid rgba(var(--ion-text-color-rgb), 0.08);
  padding-top: 12px;
}
.section-subtitle {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ion-color-medium);
  text-transform: uppercase;
  margin-bottom: 8px;
  letter-spacing: 0.3px;
}
.facilities-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.consensus-squares {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.consensus-square {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  box-sizing: border-box;
  transition: transform 0.2s ease;
  min-height: 42px;
  position: relative;
}
.consensus-square:active {
  transform: scale(0.95);
}
.consensus-square.yes {
  background: rgba(var(--ion-color-success-rgb, 16, 185, 129), 0.12);
  color: var(--ion-color-success, #10b981);
  border: 1px solid rgba(var(--ion-color-success-rgb, 16, 185, 129), 0.25);
}
.consensus-square.no {
  background: rgba(var(--ion-color-danger-rgb, 239, 68, 68), 0.12);
  color: var(--ion-color-danger, #ef4444);
  border: 1px solid rgba(var(--ion-color-danger-rgb, 239, 68, 68), 0.25);
}
.square-icon {
  font-size: 1.25rem;
  margin: 0;
  display: flex;
  align-items: center;
}
.square-label {
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  white-space: nowrap;
}

.no-consensus-text {
  font-size: 0.85rem;
  color: var(--ion-color-medium);
  font-style: italic;
  margin: 8px 0 12px;
}
.rate-btn {
  margin: 0;
  --border-radius: 8px;
}
.reviews-section {
  border-top: 1px solid rgba(var(--ion-text-color-rgb), 0.08);
  padding-top: 16px;
}
.review-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}
.review-card {
  background: rgba(var(--ion-text-color-rgb), 0.03);
  border-radius: 12px;
  padding: 12px;
  border: 1px solid rgba(var(--ion-text-color-rgb), 0.05);
}
.review-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.reviewer-avatar {
  width: 32px;
  height: 32px;
}
.reviewer-info {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
}
.reviewer-name {
  font-size: 0.9rem;
  font-weight: 600;
}
.review-date {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}
.review-actions-row {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
  border-top: 1px dashed rgba(var(--ion-text-color-rgb), 0.06);
  padding-top: 4px;
}
.review-actions-row .action-btn {
  font-size: 0.75rem;
  font-weight: 700;
  margin: 0;
  --padding-start: 4px;
  --padding-end: 4px;
}
.review-facilities-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}
.review-fac-chip {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 6px;
  border: 1px solid;
}
.review-fac-chip.yes {
  background: rgba(var(--ion-color-success-rgb), 0.1);
  color: var(--ion-color-success);
  border-color: rgba(var(--ion-color-success-rgb), 0.2);
}
.review-fac-chip.no {
  background: rgba(var(--ion-color-danger-rgb), 0.1);
  color: var(--ion-color-danger);
  border-color: rgba(var(--ion-color-danger-rgb), 0.2);
}
.review-comment {
  margin: 0;
  font-size: 0.9rem;
  color: var(--ion-text-color);
  line-height: 1.4;
}
.owner-reply-block {
  margin-top: 10px;
  padding: 10px;
  background: rgba(var(--ion-color-carrot-rgb, 255, 152, 0), 0.05);
  border-left: 3px solid var(--ion-color-carrot, #ff9800);
  border-radius: 4px;
}
.owner-reply-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.owner-reply-badge {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--ion-color-carrot, #ff9800);
  text-transform: uppercase;
}
.owner-reply-date {
  font-size: 0.7rem;
  color: var(--ion-color-medium);
}
.owner-reply-text {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.35;
  color: var(--ion-text-color);
}
.no-reviews {
  text-align: center;
  color: var(--ion-color-medium);
  font-style: italic;
  padding: 12px;
}
.two-step-gate-modal {
  --border-radius: 16px 16px 0 0;
  --overflow: hidden;
}

.place-banner {
  width: 100%;
  height: 180px;
  position: relative;
  overflow: hidden;
}

.place-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.place-placeholder-banner {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, var(--ion-color-carrot, #ff9800), var(--ion-color-primary, #3880ff));
  display: flex;
  justify-content: center;
  align-items: center;
}

.placeholder-icon {
  font-size: 3rem;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
}

.category-badge-wrapper {
  position: absolute;
  bottom: 12px;
  left: 12px;
}

.category-badge {
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.content-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.place-title {
  font-size: 1.35rem;
  font-weight: 800;
  margin-top: 8px;
  margin-bottom: 6px;
  color: var(--ion-text-color);
}

.place-address {
  font-size: 0.85rem;
  color: var(--ion-color-medium);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: 90%;
  text-align: center;
}

.address-icon {
  font-size: 0.95rem;
  color: var(--ion-color-carrot);
  flex-shrink: 0;
}

.gate-divider {
  width: 40px;
  height: 3px;
  background: rgba(var(--ion-text-color-rgb), 0.1);
  border-radius: 2px;
  margin: 16px 0;
}

.gate-heading {
  font-size: 1.15rem;
  font-weight: 700;
  margin: 0 0 8px 0;
  color: var(--ion-color-carrot);
}

.gate-desc {
  font-size: 0.88rem;
  line-height: 1.45;
  color: var(--ion-color-medium);
  margin: 0 0 20px 0;
}

.gate-buttons {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-btn {
  margin: 0;
  --border-radius: 12px;
  --box-shadow: none;
  font-weight: 700;
  height: 46px;
}

.cancel-btn {
  margin: 0;
  --border-radius: 12px;
  font-weight: 700;
  font-size: 0.88rem;
}

.disabled-click {
  cursor: default !important;
}

/* Combined facilities styles */
.consensus-square.owner-source {
  background: rgba(var(--ion-color-carrot-rgb, 242, 110, 36), 0.08) !important;
  border: 1px dashed var(--ion-color-carrot) !important;
  padding-top: 11px;
  padding-bottom: 5px;
}

.consensus-square.owner-source .square-label {
  color: var(--ion-color-carrot) !important;
  font-weight: 800;
}

.owner-badge-dot {
  position: absolute;
  top: 1px;
  right: 5px;
  font-size: 0.45rem;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--ion-color-carrot);
  letter-spacing: 0.5px;
}

/* Promotions & Offers Styles */
.promo-card {
  background: linear-gradient(135deg, rgba(var(--ion-color-carrot-rgb, 242, 110, 36), 0.08) 0%, rgba(var(--ion-color-carrot-rgb, 242, 110, 36), 0.03) 100%);
  border: 1px dashed var(--ion-color-carrot);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  position: relative;
  overflow: hidden;
}
.promo-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--ion-color-carrot);
  color: white;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
  text-transform: uppercase;
}
.promo-title {
  font-size: 1rem;
  font-weight: 700;
  margin: 0 0 6px 0;
  color: var(--ion-text-color);
}
.promo-body {
  font-size: 0.88rem;
  margin: 0;
  color: var(--ion-color-medium);
  line-height: 1.4;
}

/* Menu Section Styles */
.menu-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.menu-item-row {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 12px;
  background: rgba(var(--ion-text-color-rgb, 0, 0, 0), 0.02);
  border: 1px solid rgba(var(--ion-text-color-rgb, 0, 0, 0), 0.06);
  border-radius: 12px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.menu-item-row:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}
.menu-item-photo,
.menu-item-photo-placeholder {
  width: 70px;
  height: 70px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
}
.menu-item-photo-placeholder {
  background: rgba(var(--ion-color-carrot-rgb, 242, 110, 36), 0.1);
  color: var(--ion-color-carrot);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}
.menu-item-info {
  flex: 1;
  min-width: 0;
}
.menu-item-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
}
.menu-item-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--ion-text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.menu-item-price {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--ion-color-carrot);
}
.menu-item-description {
  font-size: 0.8rem;
  color: var(--ion-color-medium);
  margin: 0;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Modal and Actions Styles */
.biz-actions-row {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  margin-bottom: 16px;
}
.action-sheet-btn {
  flex: 1;
  --border-radius: 10px;
  font-weight: 700;
  height: 44px;
}
.bottom-sheet-modal {
  --border-radius: 16px;
}
.promos-modal-list, .menu-modal-list {
  padding-bottom: 30px;
}
.collapsible-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  margin-top: 16px;
  margin-bottom: 8px;
  cursor: pointer;
}
.collapsible-chevron {
  font-size: 1.4rem;
  color: var(--ion-color-carrot);
}
.collapsible-content {
  animation: slideDown 0.25s ease-out;
}
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
