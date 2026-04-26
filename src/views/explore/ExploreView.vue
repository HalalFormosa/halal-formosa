<template>
  <ion-page>
    <ion-header class="explore-header" :class="{ 'is-native': isNative && !isDonor, 'solid-bg': viewMode === 'list' }">
      <!-- Native AdMob banner -->
      <div v-if="isNative && !isDonor" id="ad-space-explore" style="height:65px;"></div>

      <ion-toolbar class="header-search-toolbar">
        <!-- Search & Add Row -->
        <div class="search-row-container">
          <div class="search-bar-wrapper">
            <ion-searchbar
                class="compact-searchbar"
                :debounce="1000"
                v-model="searchQuery"
                @ionInput="onSearchInput"
                @ionSearch="onSearchCommit"
                @keyup.enter.capture="onSearchCommit"
                :placeholder="$t('explore.placeholder')"
                :disabled="isGeocoding"
            />
          </div>

          <div class="header-actions">
            <!-- Filter Button (Mobile only) -->
            <ion-button
                v-if="isSmallScreen"
                @click="isFilterModalOpen = true"
                class="header-btn filter-toggle-btn"
                color="carrot"
            >
              <ion-icon :icon="funnelOutline"/>
              <div v-if="activeFiltersCount > 0" class="badge-count">{{ activeFiltersCount }}</div>
            </ion-button>

            <ion-button
                @click="viewMode = viewMode === 'map' ? 'list' : 'map'"
                class="header-btn"
                color="carrot"
            >
              <ion-icon :icon="viewMode === 'map' ? listOutline : mapOutline"/>
            </ion-button>

          </div>
        </div>

        <!-- Quick Filters Bar (Mobile Only) -->
        <div
          v-if="isSmallScreen && !loadingCategories && categories.length > 0"
          class="quick-filters-bar"
        >
          <div class="quick-filters-scroll">
            <ion-chip
              v-for="cat in categories.slice(0, 4)"
              :key="'quick-' + cat.id"
              class="quick-filter-chip"
              :class="{ active: activeCategoryIds.includes(cat.id) }"
              :style="{
                '--cat-color': cat.color || 'var(--ion-color-carrot)',
                '--cat-bg': activeCategoryIds.includes(cat.id) ? (cat.color || 'var(--ion-color-carrot)') : hexToRgba(cat.color || 'var(--ion-color-carrot)', 0.15)
              }"
              @click="toggleCategory(cat)"
            >
              <span v-if="typeof categoryIconMap[cat.name] === 'string' && categoryIconMap[cat.name].length === 2" class="category-emoji">
                {{ categoryIconMap[cat.name] }}
              </span>
              <ion-icon v-else-if="categoryIconMap[cat.name]" :icon="categoryIconMap[cat.name]" class="category-icon" />
              <ion-label>{{ cat.name }}</ion-label>
            </ion-chip>
            <ion-chip
              class="quick-filter-chip more-chip"
              @click="isFilterModalOpen = true"
            >
              <ion-label>{{ $t('explore.moreFilters') }}</ion-label>
            </ion-chip>
          </div>
        </div>

        <!-- Desktop Filters (Inline) -->
        <template v-if="!isSmallScreen">
          <!-- Category bar row -->
          <div class="category-bar-row">
            <div v-show="!loadingCategories" class="category-bar scrollable" ref="desktopCategoryBar">
              
              <ion-chip
                  v-if="activeTag && !isCampusTagSelected"
                  class="modern-category-chip active"
                  style="--cat-color: var(--ion-color-tertiary); --cat-bg: var(--ion-color-tertiary);"
                  @click="activeTag = null; focusedPlaceId = null"
              >
                <ion-icon :icon="pricetagOutline" class="category-icon" />
                <ion-label style="text-transform: capitalize">{{ activeTag }}</ion-label>
                <ion-icon :icon="closeCircleOutline" style="margin-left: 4px; font-size: 16px;" />
              </ion-chip>

              <ion-chip
                  v-for="cat in categories"
                  :key="cat.id"
                  class="modern-category-chip"
                  :class="{ active: activeCategoryIds.includes(cat.id) }"
                  :style="{ 
                    '--cat-color': cat.color || 'var(--ion-color-carrot)',
                    '--cat-bg': activeCategoryIds.includes(cat.id) ? (cat.color || 'var(--ion-color-carrot)') : 'transparent'
                  }"
                  @click="toggleCategory(cat)"
              >
                <span v-if="typeof categoryIconMap[cat.name] === 'string' && categoryIconMap[cat.name].length === 2" class="category-emoji">
                  {{ categoryIconMap[cat.name] }}
                </span>
                <ion-icon v-else-if="categoryIconMap[cat.name]" :icon="categoryIconMap[cat.name]" class="category-icon" />
                <ion-label>{{ cat.name }}</ion-label>
              </ion-chip>
            </div>

            <ion-chip
                v-if="activeCategoryIds.length || activeTag"
                class="clear-chip floating-clear"
                @click="activeCategoryIds = []; activeTag = null; focusedPlaceId = null"
            >
              <ion-icon :icon="closeCircleOutline" style="margin-right: 4px; font-size: 16px;" />
              {{ $t('common.clear') }}
            </ion-chip>

            <!-- Skeleton placeholder -->
            <div v-if="loadingCategories" class="category-skeletons" style="display: flex; gap: 10px;">
              <ion-skeleton-text animated style="width:110px; height:36px; border-radius:100px; margin: 0;"/>
              <ion-skeleton-text animated style="width:85px; height:36px; border-radius:100px; margin: 0;"/>
              <ion-skeleton-text animated style="width:120px; height:36px; border-radius:100px; margin: 0;"/>
              <ion-skeleton-text animated style="width:90px; height:36px; border-radius:100px; margin: 0;"/>
            </div>
          </div>

          <!-- Campus row (new) -->
          <div v-if="campusPartners.length > 0" class="campus-bar-row">
            <div class="category-bar">
              <!-- Campus Filter Buttons -->
              <div
                  v-for="campus in campusPartners"
                  :key="campus.id"
                  class="campus-filter-wrapper"
              >
                <div class="special-promo-tag">{{ $t('explore.specialPromo') }}</div>
                <ion-chip
                    class="modern-category-chip campus-chip"
                    :class="{ active: activeTag === campus.slug }"
                    style="--cat-color: var(--ion-color-tertiary); --cat-bg: var(--ion-color-tertiary);"
                    @click="activeTag = (activeTag === campus.slug ? null : campus.slug); focusedPlaceId = null"
                >
                  <ion-icon :icon="school" class="category-icon" />
                  <ion-label>{{ $t('explore.campusFilter', { name: campus.slug.toUpperCase() }) }}</ion-label>
                </ion-chip>
              </div>
            </div>
          </div>
        </template>
      </ion-toolbar>
    </ion-header>

    <div
        style="position: absolute; height: 100%; width: 100%; top: 0; left: 0; z-index: 0;"
    >
      <div id="map" :class="{ 'map-dimmed': viewMode === 'list' }" style="height: 100%; width: 100%;"></div>

      <!-- Map is always present, hidden when loading -->
      <ion-skeleton-text
          v-show="loading"
          animated
          class="map-overlay"
      />

      <!-- Skeleton overlay -->
      <ion-skeleton-text
          v-show="loading"
          animated
          style="height:100%;width:100%;border-radius:0;position:absolute;top:0;left:0;z-index:0;"
      />
    </div>

    <!-- 4. List View Overlay -->
    <transition name="fade-slide">
      <div v-if="viewMode === 'list'" class="list-view-overlay" :style="{ paddingTop: listPaddingTop }">
        <div class="list-container">
          <div class="list-header">
            <div class="list-sort-container">
              <ion-button
                  class="sort-btn-simple"
                  fill="clear"
                  id="sort-trigger-explore"
              >
                <ion-icon :icon="sortIcon" slot="start" />
                <ion-label>{{ sortLabel }}</ion-label>
                <ion-icon :icon="chevronDownOutline" slot="end" style="font-size: 12px; margin-left: 4px;" />
              </ion-button>
              
              <ion-popover trigger="sort-trigger-explore" trigger-action="click" :dismiss-on-select="true" class="width-190">
                <ion-list lines="none">
                  <ion-item button @click="sortBy = 'nearest'">
                    <ion-icon :icon="locationOutline" slot="start" />
                    <ion-label>{{ $t('search.sortNearest') }}</ion-label>
                    <ion-icon v-if="sortBy === 'nearest'" :icon="checkmarkCircle" slot="end" color="success" style="font-size: 14px;" />
                  </ion-item>
                  
                  <ion-item button @click="sortBy = 'recent'">
                    <ion-icon :icon="timeOutline" slot="start" />
                    <ion-label>{{ $t('search.sortRecent') }}</ion-label>
                    <ion-icon v-if="sortBy === 'recent'" :icon="checkmarkCircle" slot="end" color="success" style="font-size: 14px;" />
                  </ion-item>
                  
                  <ion-item button @click="sortBy = 'trending'">
                    <ion-icon :icon="trendingUpOutline" slot="start" />
                    <ion-label>{{ $t('search.sortTrending') }}</ion-label>
                    <ion-icon v-if="sortBy === 'trending'" :icon="checkmarkCircle" slot="end" color="success" style="font-size: 14px;" />
                  </ion-item>

                  <ion-item button @click="sortBy = 'popular'">
                    <ion-icon :icon="flameOutline" slot="start" />
                    <ion-label>{{ $t('search.sortViews') }}</ion-label>
                    <ion-icon v-if="sortBy === 'popular'" :icon="checkmarkCircle" slot="end" color="success" style="font-size: 14px;" />
                  </ion-item>

                  <ion-item v-if="canShowForYouSort" button @click="sortBy = 'for_you'">
                    <ion-icon :icon="sparklesOutline" slot="start" />
                    <ion-label>{{ $t('search.sortForYou') }}</ion-label>
                    <ion-icon v-if="sortBy === 'for_you'" :icon="checkmarkCircle" slot="end" color="success" style="font-size: 14px;" />
                  </ion-item>
                </ion-list>
              </ion-popover>
            </div>
          </div>
          
          <div class="vertical-cards-stack">
            <!-- 🔒 For You (Non-Pro Gate) -->
            <template v-if="showForYouGate && viewMode === 'list'">
              <ion-card class="for-you-info">
                <ion-card-content>
                  <div class="for-you-row">
                    <ion-icon :icon="sparklesOutline" size="large" color="carrot" class="for-you-icon" />
                    <div>
                      <strong>{{ $t('explore.forYou.title') }}</strong>
                      <p>{{ $t('explore.forYou.gateDesc') }}</p>
                    </div>
                  </div>
                  <ion-button color="carrot" size="small" expand="block">
                    {{ $t('explore.forYou.upgrade') }}
                  </ion-button>
                </ion-card-content>
              </ion-card>
            </template>

            <!-- ✨ For You Explanation (Pro Users) -->
            <ion-card
                v-if="showForYouInfo && !hideForYouInfo && viewMode === 'list'"
                class="for-you-info"
            >
              <ion-card-content>
                <div class="for-you-row">
                  <ion-icon :icon="sparklesOutline" size="large" color="carrot" class="for-you-icon" />
                  <div>
                    <strong>{{ $t('explore.forYou.title') }}</strong>
                    <p class="for-you-desc">
                      Because you love to find
                      <span v-if="forYouCategories.length > 0" class="factor-values">{{ forYouCategories.join(', ') }}</span>
                      <span v-else>places based on your activity</span>
                    </p>

                    <!-- Learning message when no factors yet -->
                    <p
                        v-if="forYouCategories.length === 0 && forYouSearchTerms.length === 0 && forYouTags.length === 0"
                        style="margin-top:6px; font-size:12px; color:var(--ion-color-medium);"
                    >
                      {{ $t('explore.forYou.learningMsg') }}
                    </p>
                  </div>
                </div>
                <ion-button fill="clear" size="small" @click="dismissForYouInfo">
                  {{ $t('search.gotIt') }}
                </ion-button>
              </ion-card-content>
            </ion-card>

            <!-- Skeleton list while loading -->
            <template v-if="loadingPlaces">
              <div v-for="n in 5" :key="'skeleton-list-' + n" class="modern-location-card list-mode-card">
                <div class="card-inner">
                  <div class="card-image-section">
                    <ion-skeleton-text animated style="width:100%; height:100%; border-radius:10px;" />
                  </div>
                  <div class="card-info-section">
                    <div class="info-top">
                      <ion-skeleton-text animated style="width:75%; height:20px; margin-bottom:12px;" />
                      <div class="metas">
                        <ion-skeleton-text animated style="width:25%; height:14px;" />
                        <ion-skeleton-text animated style="width:20%; height:14px;" />
                        <ion-skeleton-text animated style="width:30%; height:14px;" />
                      </div>
                      <ion-skeleton-text animated style="width:35%; height:14px; margin-top:8px;" />
                      <div class="card-tags-row horizontal-scroll" style="margin-top:8px;">
                        <ion-skeleton-text animated style="width:50px; height:18px; border-radius:6px;" />
                        <ion-skeleton-text animated style="width:60px; height:18px; border-radius:6px;" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <div
              v-for="place in listLocations"
              :key="place.id"
              class="modern-location-card list-mode-card"
              :class="['tier-' + String(place.partner_tier || 'basic').toLowerCase()]"
              @click="goToDetail(place.id)"
            >
              <div class="card-inner">
                <div class="card-image-section">
                  <img 
                    loading="lazy" 
                    :src="place.image || PLACEHOLDER" 
                    :alt="place.name" 
                    @error="onImageError"
                  />
                  <div v-if="place.partner_tier" class="floating-tier-badge">
                    <div :class="['tier-pill', place.partner_tier.toLowerCase()]">
                      <ion-icon :icon="sparkles" />
                      <span>{{ place.partner_tier.toUpperCase() }}</span>
                    </div>
                  </div>
                </div>
                <div class="card-info-section">
                  <div class="info-top">
                    <h5 class="title-text">
                      {{ place.name }}
                      <ion-icon v-if="place.partner_tier" :icon="checkmarkCircle" class="verified-badge" />
                    </h5>
                    <div class="metas">
                      <span class="meta">{{ place.type }}</span>
                      <span class="meta"><ion-icon :icon="eyeOutline" style="vertical-align: middle; margin-top: -2px;" /> {{ place.view_count || 0 }}</span>
                      <span class="meta">
                        <ion-icon :icon="calendarOutline" style="vertical-align: middle; margin-top: -2px;" />
                        {{ fromNowToTaipei(place.created_at) }}
                      </span>
                    </div>
                    <div v-if="userLocation && (place as any).distance !== undefined" class="distance">
                      <ion-icon :icon="locationOutline" style="font-size: 0.85rem; vertical-align: middle; margin-top: -2px;" /> {{ formatKm((place as any).distance) }} km
                    </div>

                    <!-- Tags section (Horizontal Scroll) -->
                    <div v-if="place.tags && place.tags.length > 0" class="card-tags-row horizontal-scroll">
                      <span 
                        v-for="t in place.tags" 
                        :key="t" 
                        class="card-tag"
                        :class="{ highlight: t.toLowerCase() === activeTag?.toLowerCase() }"
                      >
                        #{{ t }}
                      </span>
                    </div>
                  </div>
                </div>
                <div v-if="['gold', 'silver'].includes(String(place.partner_tier || '').toLowerCase())" class="premium-flare"></div>
              </div>
            </div>
            
            <div v-if="displayedLocations.length === 0 && !loading" class="empty-state">
              <ion-icon :icon="informationCircleOutline" />
              <p>{{ $t('explore.noResults') }}</p>
            </div>

            <!-- Infinite Scroll Sentinel -->
            <div 
              v-if="listLocations.length < displayedLocations.length" 
              ref="infiniteSentinel" 
              class="infinite-scroll-sentinel"
            >
              <ion-spinner name="bubbles" color="carrot" />
              <span class="loading-text">{{ $t('explore.loadingMoreLocations') || 'Loading more locations...' }}</span>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- 5. Floating UI (Locate Me & Add) -->
    <div class="map-floating-actions" :class="{ 'list-mode': viewMode === 'list' }">
      <ion-button v-if="isLoggedIn" class="floating-action-btn add-place-btn" color="carrot" @click="goToAddPlace">
        <ion-icon :icon="addOutline" />
      </ion-button>
      
      <ion-button v-if="viewMode === 'map'" class="floating-action-btn locate-me-btn" color="carrot" @click="centerOnUser">
        <ion-icon :icon="navigateCircleOutline" />
      </ion-button>
    </div>

    <!-- 6. Bottom Results Slider (Map Only) -->
    <div 
      v-if="viewMode === 'map' && (displayedLocations.length > 0 || !locationAttemptFinished || loadingPlaces)"
      class="floating-results-bar"
    >
      <!-- Locating Status Badge (Floating above cards) -->
      <div v-if="!locationAttemptFinished" class="locating-status-badge">
        <div class="pulse-dot"></div>
        <span>{{ $t('explore.locating') }}</span>
      </div>

      <div 
        ref="contentRef" 
        class="horizontal-scroll-wrapper"
        @touchstart="isUserScrollingList = true"
        @touchend="isUserScrollingList = false"
        @mousedown="isUserScrollingList = true"
        @mouseup="isUserScrollingList = false"
        @mouseleave="isUserScrollingList = false"
      >
        <div class="cards-track">
          <!-- Skeleton list while locating OR loading data -->
          <template v-if="!locationAttemptFinished || loadingPlaces">
            <div v-for="n in 5" :key="'skeleton-map-' + n" class="modern-location-card">
              <div class="card-inner">
                <div class="card-image-section">
                  <ion-skeleton-text
                      animated
                      style="width:100%; height:100%;"
                  />
                </div>
                <div class="card-info-section">
                  <div class="info-top">
                    <ion-skeleton-text animated style="width:80%; height:20px; margin-bottom:12px;" />
                    <div class="metas">
                      <ion-skeleton-text animated style="width:25%; height:14px;" />
                      <ion-skeleton-text animated style="width:35%; height:14px;" />
                    </div>
                    <ion-skeleton-text animated style="width:40%; height:14px; margin-top:8px;" />
                  </div>
                  <div class="info-actions">
                    <div class="action-row" style="display:flex; gap:8px; margin-top:12px;">
                      <ion-skeleton-text animated style="width:36px; height:36px; border-radius:50%;" />
                      <ion-skeleton-text animated style="width:36px; height:36px; border-radius:50%;" />
                      <ion-skeleton-text animated style="width:36px; height:36px; border-radius:50%;" />
                      <ion-skeleton-text animated style="width:70px; height:32px; border-radius:16px; margin-left:auto;" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- Real data after loaded -->
          <template v-else>
            <div
                v-for="place in displayedLocations"
                :key="place.id"
                :data-id="place.id"
                :ref="setCardRef(place.id)"
                :class="[
                  'modern-location-card', 
                  { 'active-card': selectedPlace?.id === place.id },
                  place.partner_tier ? 'tier-' + place.partner_tier.toLowerCase() : ''
                ]"
                @click="selectPlace(place)"
            >
              <div class="card-inner">
                <div class="card-image-section">
                  <img
                      loading="lazy"
                      :src="place.image || PLACEHOLDER"
                      :alt="place.name"
                      @error="onImageError"
                  />
                  <!-- Floating Tier Badge -->
                  <div v-if="place.partner_tier" class="floating-tier-badge">
                    <div :class="['tier-pill', place.partner_tier.toLowerCase()]">
                      <ion-icon :icon="sparkles" />
                      <span>{{ (place.partner_tier || '').toUpperCase() }}</span>
                    </div>
                  </div>
                </div>

                <div class="card-info-section">
                  <div class="info-top">
                    <h5 class="title-text">
                      {{ place.name }}
                      <ion-icon v-if="place.partner_tier" :icon="checkmarkCircle" class="verified-badge" />
                    </h5>
                    <div class="metas">
                      <span class="meta"><ion-icon :icon="eyeOutline" style="vertical-align: middle; margin-top: -2px;" /> {{ place.view_count || 0 }}</span>
                      <span class="meta">
                        <ion-icon :icon="calendarOutline" style="vertical-align: middle; margin-top: -2px;" />
                        {{ fromNowToTaipei(place.created_at) }}
                      </span>
                    </div>
                    <div v-if="userLocation && (place as any).distance !== undefined" class="distance">
                      <ion-icon :icon="locationOutline" style="font-size: 0.85rem; vertical-align: middle; margin-top: -2px;" /> {{ formatKm((place as any).distance) }} km
                    </div>
                  </div>
                  <div class="info-actions">
                    <div class="action-row">
                      <ion-button 
                        v-if="isLoggedIn" 
                        fill="clear" 
                        size="small" 
                        :color="isLocationSaved(place.id) ? 'carrot' : 'medium'" 
                        @click.stop="openSaveModal(place)"
                      >
                        <ion-icon :icon="isLocationSaved(place.id) ? bookmark : bookmarkOutline" slot="start" />
                      </ion-button>
                      <div class="action-icons">
                        <ion-button 
                          fill="clear" 
                          size="small" 
                          color="carrot" 
                          @click.stop="sharePlace({ name: place.name, type: place.type, imageUrl: place.image || 'https://placehold.co/200x100', lat: place.position.lat, lng: place.position.lng })"
                          class="icon-btn"
                        >
                          <ion-icon :icon="shareSocialOutline" />
                        </ion-button>
                        <ion-button 
                          fill="clear" 
                          size="small" 
                          color="carrot" 
                          @click.stop="openNavigation(place)"
                          class="icon-btn"
                        >
                          <ion-icon :icon="navigateOutline" />
                        </ion-button>
                        <ion-button fill="clear" size="small" color="carrot" @click.stop="goToDetail(place.id)" class="detail-btn">
                          {{ $t('common.details') }}
                        </ion-button>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-if="['gold', 'silver'].includes(String(place.partner_tier || '').toLowerCase())" class="premium-flare"></div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Save Location Modal -->
    <SaveLocationModal
      :is-open="showSaveLocationModal"
      :location-id="selectedLocationForSave?.id || 0"
      :location-name="selectedLocationForSave?.name || ''"
      @close="showSaveLocationModal = false"
      @saved="checkSavedState(selectedLocationForSave?.id || 0)"
    />

    <ion-footer v-if="viewMode === 'list'" style="position: absolute; bottom: 0; left: 0; right: 0; width: 100%; z-index: 1001; background: var(--ion-background-color); border-top: 1px solid rgba(var(--ion-color-dark-rgb), 0.05);">
      <div class="footer-count">
        <small>
          {{ $t('explore.showingResults', {count: listLocations.length, total: displayedLocations.length}) }}
        </small>
      </div>
    </ion-footer>

    <!-- Mobile Filters (Modal Bottom Sheet) -->
    <ion-modal
        :is-open="isFilterModalOpen"
        @didDismiss="isFilterModalOpen = false"
        :initial-breakpoint="0.5"
        :breakpoints="[0, 0.5, 0.8, 1]"
        handle-behavior="cycle"
        class="filter-modal"
    >
      <ion-header class="ion-no-border">
        <ion-toolbar>
          <ion-title>{{ $t('common.filter') || 'Filter' }}</ion-title>
          <ion-buttons slot="end">
            <ion-button v-if="activeFiltersCount > 0" @click="() => { activeCategoryIds = []; activeTag = null; focusedPlaceId = null; }" color="carrot" class="modal-reset-btn">
              {{ $t('common.reset') || 'RESET' }}
            </ion-button>
            <ion-button @click="isFilterModalOpen = false">
              <ion-icon :icon="closeOutline" />
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding filter-modal-content">
        <ExploreFilterContent
            :categories="categories"
            :activeCategoryIds="activeCategoryIds"
            :campusPartners="campusPartners"
            :activeTag="activeTag"
            :loadingCategories="loadingCategories"
            :categoryIconMap="categoryIconMap"
            @toggleCategory="toggleCategory"
            @toggleTag="(slug) => { activeTag = (activeTag === slug ? null : slug); focusedPlaceId = null; }"
            @clearFilters="() => { activeCategoryIds = []; activeTag = null; focusedPlaceId = null; }"
        />
      </ion-content>
    </ion-modal>

    <!-- Tag Overflow Popover -->
    <ion-popover
      :is-open="isTagsPopoverOpen"
      :event="popoverEvent"
      @didDismiss="isTagsPopoverOpen = false"
      class="tags-popover"
    >
      <ion-content>
        <ion-list lines="none">
          <ion-item v-for="tag in currentPopoverTags" :key="tag" class="popover-tag-item">
            <ion-icon :icon="pricetagOutline" slot="start" color="carrot" />
            <ion-label>#{{ tag }}</ion-label>
          </ion-item>
        </ion-list>
      </ion-content>
    </ion-popover>
  </ion-page>
</template>


<script setup lang="ts">

import {
  IonPage, IonContent, IonToolbar, IonSearchbar, IonIcon, IonFab, IonFabButton,
  IonPopover, IonList, IonItem, IonFooter, IonModal, IonTitle, IonButtons, 
  IonHeader, IonLabel, IonChip, IonSkeletonText, IonCard, IonThumbnail, IonFabList,
  IonSpinner, IonCardContent,
  onIonViewWillEnter, onIonViewDidEnter, onIonViewWillLeave, IonButton,
  toastController
} from '@ionic/vue'
import type { InfiniteScrollCustomEvent } from '@ionic/vue'
import { useI18n } from 'vue-i18n'
import {
  navigateCircleOutline,
  addOutline,
  restaurant, informationCircleOutline, chevronUpOutline, chevronDownOutline, restaurantOutline, leaf, home,
  layersOutline, listOutline, gridOutline, mapOutline, sparkles, shieldCheckmarkOutline, checkmarkCircle,
  trendingUpOutline, flameOutline, timeOutline, locationOutline, filterOutline,
  eyeOutline, shareSocialOutline, navigateOutline, closeCircleOutline,
  calendarOutline, pricetagOutline, school, funnelOutline, closeOutline,
  bookmarkOutline, bookmark,
  sparklesOutline
} from 'ionicons/icons'
import { ref, onMounted, onUnmounted, nextTick, watch, computed } from 'vue'
import type {ComponentPublicInstance, VNodeRef} from 'vue'
import {useRouter} from 'vue-router'
import ExploreFilterContent from '@/components/ExploreFilterContent.vue'
import mapsLoader from '@/plugins/googleMapsLoader'
import {Capacitor} from '@capacitor/core'
import {Geolocation} from '@capacitor/geolocation'
import {supabase} from '@/plugins/supabaseClient'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import {MarkerClusterer, SuperClusterAlgorithm} from "@googlemaps/markerclusterer"
import {Cluster, Renderer} from "@googlemaps/markerclusterer"

import { Motion } from '@capacitor/motion'

import useSharePlace from '@/composables/useSharePlace'
import { useLocation } from '@/composables/useLocation'
import {ActivityLogService} from "@/services/ActivityLogService";

import {isDonor} from "@/composables/useSubscriptionStatus";
import { useSavedLocations } from '@/composables/useSavedLocations';
import SaveLocationModal from '@/components/SaveLocationModal.vue';

const ionIconMap: Record<string, any> = {
  restaurant,
  restaurantOutline,
  leaf,
  home,
  listOutline,
  mapOutline
}

/* ---------------- State ---------------- */
const { 
  userLocation, 
  locationAttemptFinished, 
  hasAutoCentered,
  startWatching 
} = useLocation()

const locations = ref<Place[]>([])
const selectedPlace = ref<Place | null>(null)
const focusedPlaceId = ref<number | null>(null)

const viewMode = ref<'map' | 'list'>('map')
const activeTag = ref<string | null>(null)
const activeCategoryIds = ref<number[]>([])
const searchQuery = ref('')
const sortBy = ref<'nearest' | 'recent' | 'popular' | 'trending' | 'for_you'>(userLocation.value ? 'nearest' : 'recent')
const listLimit = ref(20)
// locations moved up
const loadingPlaces = ref(true)
const loadingCategories = ref(true)
const isFetching = ref(false)
const campusCircle = ref<google.maps.Circle | null>(null)
const campusLabel = ref<google.maps.marker.AdvancedMarkerElement | null>(null)
let campusOverlays: (google.maps.Circle | any)[] = []
const CAMPUS_COORDS: Record<string, { lat: number; lng: number }> = {
  'ntu': { lat: 25.01737, lng: 121.5398 }
}

/* ---------------- Types ---------------- */
type LatLng = { lat: number; lng: number }
type LocationType = {
  id: number
  name: string
  color: string | null
  emoji: string | null
  icon: string | null
}


type Place = {
  id: number
  name: string
  address?: string | null
  position: { lat: number; lng: number }
  image?: string | null
  typeId: number | null
  type: string
  view_count?: number
  partner_tier?: 'Gold' | 'Silver' | 'Bronze'
  created_at?: string
  tags?: string[]
  description?: string | null
}


type LocationRow = {
  id: number
  name: string
  address: string
  lat: number
  lng: number
  image?: string | null
  type_id: number | null
  location_types: { name: string } | null
  view_count?: number
  partner_tier?: 'Gold' | 'Silver' | 'Bronze'
  created_at: string
  tags?: string[]
  description?: string | null
}

// Local type for ion-content (no external import needed)
type HTMLIonContentElement = HTMLElement & {
  getScrollElement: () => Promise<HTMLElement>
}

// No longer using viewMode switcher
const isPageActive = ref(false)


/* ---------------- Constants ---------------- */
const MAP_ID = 'a40f1ec0ad0afbbb12694f19'
const DEFAULT_CENTER: LatLng = {lat: 25.0343, lng: 121.5645}
const PLACEHOLDER = 'https://placehold.co/200x100'

/* ---------------- State ---------------- */
const router = useRouter()
const { t } = useI18n()

const isLoggedIn = ref(false)
const isContributor = ref(false)

// Use shared location logic
const cardRefs = ref<Record<number, Element | ComponentPublicInstance | null>>({})
const contentRef = ref<HTMLIonContentElement | null>(null)
const desktopCategoryBar = ref<HTMLElement | null>(null)

const isSmallScreen = ref(window.innerWidth < 768)
// listLimit moved up
const infiniteSentinel = ref<HTMLElement | null>(null)
let infiniteObserver: IntersectionObserver | null = null

const isNative = ref(Capacitor.isNativePlatform())
const loading = ref(true)
const campusPartners = ref<{ id: string; name: string; slug: string }[]>([])
const trendingPlaceIds = ref<number[]>([])
const isFilterModalOpen = ref(false)
const currentZoom = ref(14)
const forYouPlaceIds = ref<number[]>([])
const forYouReason = ref<string | null>(null)
const forYouCategories = ref<string[]>([])
const forYouSearchTerms = ref<string[]>([])
const forYouTags = ref<string[]>([])
const hideForYouInfo = ref(
  localStorage.getItem('hide_explore_for_you_info') === '1'
)
const visitedPlaceIds = ref<number[]>([])

const listPaddingTop = computed(() => {
  let base = 90; // search row
  if (isNative.value && !isDonor.value) base += 65; // Ad space
  if (!isSmallScreen.value) base += 60; // Categories
  if (campusPartners.value.length > 0) base += 50; // Campus bar
  return `${base}px`;
});

const listLocations = computed(() => {
  return displayedLocations.value.slice(0, listLimit.value)
})

const handleInfinite = () => {
  if (isFetching.value) return
  isFetching.value = true
  
  // Artificial delay to show loading animation like SearchView
  setTimeout(() => {
    listLimit.value += 20
    isFetching.value = false
  }, 800)
}

const initInfiniteObserver = () => {
  if (infiniteObserver) infiniteObserver.disconnect()
  
  infiniteObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      handleInfinite()
    }
  }, { threshold: 0.1 })

  nextTick(() => {
    if (infiniteSentinel.value) {
      infiniteObserver?.observe(infiniteSentinel.value)
    }
  })
}

const handleResize = () => {
  isSmallScreen.value = window.innerWidth < 768
}

const activeFiltersCount = computed(() => {
  return activeCategoryIds.value.length + (activeTag.value ? 1 : 0)
})

// For You computed properties
const showForYouGate = computed(() => {
  return sortBy.value === 'for_you' && !isDonor.value
})

const showForYouInfo = computed(() => {
  return sortBy.value === 'for_you' && isDonor.value
})

const canShowForYouSort = computed(() => {
  return isLoggedIn.value
})

// Reset pagination when filters or sort change
watch([activeFiltersCount, sortBy, searchQuery], () => {
  listLimit.value = 20
})

// Load For You data when sort changes to for_you
watch(sortBy, (newSort) => {
  if (newSort === 'for_you') {
    loadForYouReason()
    // Reset hide flag when user re-selects For You
    hideForYouInfo.value = false
  }
})

// Tag Overflow Popover
const isTagsPopoverOpen = ref(false)
const currentPopoverTags = ref<string[]>([])
const popoverEvent = ref<Event | null>(null)

const openTagsPopover = (ev: Event, tags: string[]) => {
  popoverEvent.value = ev
  currentPopoverTags.value = tags
  isTagsPopoverOpen.value = true
}

let cardObserver: IntersectionObserver | null = null
let isProgrammaticScroll = false

/* Google Maps runtime objects */
let mapInstance: google.maps.Map | null = null
let advancedMarkerLib: typeof google.maps.marker | null = null
let infoWindow: google.maps.InfoWindow | null = null
const markerMap = new Map<number, google.maps.marker.AdvancedMarkerElement>()
const userMarker = ref<google.maps.marker.AdvancedMarkerElement | null>(null)
const userArrowEl = ref<HTMLElement | null>(null)
let lastRotationUpdate = 0
const ROTATION_THROTTLE_MS = 66 // ~15fps
const {sharePlace} = useSharePlace()
const locationTypes = ref<LocationType[]>([])
const pendingInfoWindowPlaceId = ref<number | null>(null)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const hasAutoSelected = ref(false)
let clusterer: MarkerClusterer | null = null
let locationWatchId: string | null = null

// Saved Locations State
const { isLocationSaved, checkSavedState } = useSavedLocations()
const showSaveLocationModal = ref(false)
const selectedLocationForSave = ref<{ id: number; name: string } | null>(null)

const lastStableLoc = ref<LatLng | null>(null)
const lastCalcLocation = ref<LatLng | null>(null)

// Interaction States for Map/List Sync
const isUserPanningMap = ref(false)
const isUserScrollingList = ref(false)
let lastPannedId: number | null = null

const distanceInMeters = (a: LatLng, b: LatLng) => {
  const R = 6371000
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180

  const x =
      dLng * Math.cos((a.lat + b.lat) * Math.PI / 360)
  const y = dLat

  return Math.sqrt(x * x + y * y) * R
}

// Sorting logic: if GPS succeeded, default to 'nearest'
watch(locationAttemptFinished, (finished) => {
  if (finished && userLocation.value) {
    sortBy.value = 'nearest'
  } else if (finished) {
    sortBy.value = 'recent'
  }
}, { immediate: true })

// Center map & Update User Marker (Blue Dot) Reactively
watch([userLocation, () => mapInstance], ([newLoc, newMap]) => {
  if (!newLoc || !newMap || !advancedMarkerLib) return

  const userLoc = { lat: newLoc.lat, lng: newLoc.lng }

  // 1. 🔥 CENTER MAP ON FIRST FIX
  if (!hasAutoCentered.value) {
    newMap.panTo(userLoc)
    newMap.setZoom(15)
    hasAutoCentered.value = true
  }

  // 2. 🟦 UPDATE OR CREATE MARKER
  if (userMarker.value) {
    // Smoothly interpolate position (lerp)
    const prevPos = userMarker.value.position
    if (!prevPos) return

    const prevLat = prevPos instanceof google.maps.LatLng ? prevPos.lat() : (prevPos as any).lat
    const prevLng = prevPos instanceof google.maps.LatLng ? prevPos.lng() : (prevPos as any).lng
    
    const prev: LatLng = lastStableLoc.value ?? { lat: prevLat, lng: prevLng }
    const d = distanceInMeters(prev, userLoc)
    if (d < 2) return // Ignore tiny jitters

    const t = d > 30 ? 0.7 : d > 10 ? 0.45 : 0.3
    const next: LatLng = {
      lat: lerp(prev.lat, userLoc.lat, t),
      lng: lerp(prev.lng, userLoc.lng, t),
    }

    userMarker.value.position = next
    lastStableLoc.value = next
  } else {
    // Create new dot (AdvancedMarkerElement)
    const dot = document.createElement('div')
    dot.className = 'user-location-dot'

    const cone = document.createElement('div')
    cone.className = 'user-heading-cone'
    dot.prepend(cone)
    userArrowEl.value = cone

    userMarker.value = new advancedMarkerLib.AdvancedMarkerElement({
      position: userLoc,
      map: newMap,
      content: dot,
      title: t('explore.userLocationTitle')
    })
    
    initHeadingTracking()
  }

  // 3. 🎯 Update lastCalcLocation for distance sorting (Throttled to 20m)
  if (newLoc) {
    const loc: LatLng = { lat: newLoc.lat, lng: newLoc.lng }
    if (!lastCalcLocation.value) {
      lastCalcLocation.value = loc
    } else {
      const dist = distanceInMeters(lastCalcLocation.value, loc)
      if (dist > 20) {
        lastCalcLocation.value = loc
      }
    }
  }
}, { immediate: true })

const initHeadingTracking = async () => {
  if (!userArrowEl.value) return

  // iOS 13+ permission 
  if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
    try {
      const permission = await (DeviceOrientationEvent as any).requestPermission()
      if (permission !== 'granted') return
    } catch (e) {
      console.warn('[Orientation] Permission failed', e)
      return
    }
  }

  try {
    await Motion.addListener('orientation', (event) => {
      const now = Date.now()
      if (now - lastRotationUpdate < ROTATION_THROTTLE_MS) return
      lastRotationUpdate = now

      if (userArrowEl.value) {
        // alpha is heading (0-360)
        const heading = (event as any).webkitCompassHeading || event.alpha || 0
        userArrowEl.value.style.transform = `rotate(${heading}deg)`
      }
    })
  } catch (e) {
    console.warn('[Orientation] Motion listener failed', e)
  }
}

const fetchLocationTypes = async () => {
  loadingCategories.value = true

  const {data, error} = await supabase
      .from('location_types')
      .select('id, name, color, emoji, icon')
      .eq('is_active', true)
      .order('sort_order', {ascending: true})
      .order('name', {ascending: true})

  if (!error && data) locationTypes.value = data

  loadingCategories.value = false
}

const fetchCampusPartners = async () => {
  const { data, error } = await supabase
    .from('partners')
    .select('id, name, slug')
    .eq('partner_type', 'campus')
    .eq('is_active', true)
    
  if (!error && data) {
    campusPartners.value = data
  }
}

const addressMarker = ref<google.maps.marker.AdvancedMarkerElement | null>(null)

const isGeocoding = ref(false)
const lastGeocodeAt = ref(0)
const lastGeocodeQuery = ref<string | null>(null)

const GEOCODE_COOLDOWN_MS = 1500 // 1.5 seconds

const onSearchCommit = async () => {
  if (!mapInstance) return

  const q = searchQuery.value.trim()
  if (!q) return

  // 1️⃣ Local DB match FIRST
  const hasLocalMatch = sortedLocations.value.length > 0
  if (hasLocalMatch) {
    console.log('[SEARCH] Local DB match', {
      query: q,
      count: sortedLocations.value.length,
      firstId: sortedLocations.value[0]?.id
    })

    const first = sortedLocations.value[0]
    if (first) {
      selectPlace(first)
    }
    return
  }

  // 2️⃣ Same-query protection
  if (lastGeocodeQuery.value === q) {
    console.log('[SEARCH] Blocked — duplicate query', q)
    return
  }

  // 3️⃣ Spam / cooldown protection
  const now = Date.now()

  if (isGeocoding.value) {
    console.log('[SEARCH] Blocked — geocode in progress', q)
    return
  }

  if (now - lastGeocodeAt.value < GEOCODE_COOLDOWN_MS) {
    console.log('[SEARCH] Blocked — cooldown', {
      query: q,
      remainingMs: GEOCODE_COOLDOWN_MS - (now - lastGeocodeAt.value)
    })
    return
  }

  isGeocoding.value = true
  lastGeocodeAt.value = now
  lastGeocodeQuery.value = q

  try {
    // 4️⃣ Paid fallback
    console.log('[SEARCH] Geocode fallback', q)
    await geocodeAddress(q)
  } finally {
    isGeocoding.value = false
  }
}



const showAddressToast = async () => {
  const toast = await toastController.create({
    message: isGeocoding.value
        ? t('explore.searchWait')
        : t('explore.searchMap'),
    duration: 1000,
    position: 'top'
  })
  await toast.present()
}


const geocodeAddress = async (query: string) => {
  await showAddressToast()
  try {
    const geocoder = new google.maps.Geocoder()

    const res = await geocoder.geocode({
      address: query,
      region: 'TW',
      bounds: mapInstance?.getBounds() ?? undefined
    })

    const place = res.results?.[0]
    if (!place) return

    const loc = place.geometry.location
    const latLng = {lat: loc.lat(), lng: loc.lng()}

    // Move map
    mapInstance!.panTo(latLng)
    mapInstance!.setZoom(17)

    // Drop / move temp marker
    if (advancedMarkerLib) {
      if (addressMarker.value) {
        addressMarker.value.position = latLng
        addressMarker.value.map = mapInstance
      } else {
        const dot = document.createElement('div')
        dot.className = 'user-location-dot' // reuse style

        addressMarker.value =
            new advancedMarkerLib.AdvancedMarkerElement({
              position: latLng,
              map: mapInstance!,
              content: dot,
              title: place.formatted_address
            })
      }
    }

    // Optional InfoWindow
    if (infoWindow) {
      infoWindow.setContent(`
        <strong>📍 ${place.formatted_address}</strong>
      `)
      infoWindow.open(mapInstance, addressMarker.value!)
    }

    ActivityLogService.log("explore_address_search", {
      query,
      address: place.formatted_address,
      lat: latLng.lat,
      lng: latLng.lng
    })
  } catch (err) {
    console.warn("Geocode failed", err)
  }

  // Reset DB filters after successful address search
  searchQuery.value = ''
  activeCategoryIds.value = []

  focusedPlaceId.value = null
}


const isCampusTagSelected = computed(() => {
  if (!activeTag.value) return false
  return campusPartners.value.some(c => c.slug === activeTag.value)
})

const categoryIconMap = computed<Record<string, any>>(() => {
  const map: Record<string, any> = {}

  for (const t of locationTypes.value) {
    if (t.emoji) {
      map[t.name] = t.emoji
    } else if (t.icon) {
      map[t.name] = ionIconMap[t.icon] ?? restaurant
    }
  }

  return map
})

const topOffset = computed(() => {
  let offset = 12; // base padding

  if (isNative.value && !isDonor.value) {
    offset += 120; // 👈 your AdMob height
  }

  return `${offset}px`;
});

const sortLabel = computed(() => {
  if (sortBy.value === 'nearest') return 'Nearest'
  if (sortBy.value === 'recent') return 'Recent'
  if (sortBy.value === 'trending') return 'Trending'
  if (sortBy.value === 'popular') return 'Hot'
  if (sortBy.value === 'for_you') return 'For You'
  return 'Sort'
})

const sortIcon = computed(() => {
  if (sortBy.value === 'nearest') return locationOutline
  if (sortBy.value === 'recent') return timeOutline
  if (sortBy.value === 'trending') return trendingUpOutline
  if (sortBy.value === 'popular') return flameOutline
  if (sortBy.value === 'for_you') return sparklesOutline
  return filterOutline
})

// For You functions
async function loadForYouReason() {
  const user = (await supabase.auth.getUser()).data.user
  if (!user) return

  const {data} = await supabase.rpc(
      'get_user_place_preferences',
      {p_user_id: user.id}
  )

  if (data && data.length > 0) {
    forYouReason.value = data[0].reason
    forYouCategories.value = data[0].categories || []
    forYouSearchTerms.value = data[0].search_terms || []
    forYouTags.value = data[0].tags || []
  } else {
    forYouReason.value = null
    forYouCategories.value = []
    forYouSearchTerms.value = []
    forYouTags.value = []
  }
}

function dismissForYouInfo() {
  hideForYouInfo.value = true
  localStorage.setItem('hide_explore_for_you_info', '1')
}

const markerStyles = computed<Record<string, {
  color: string
  emoji?: string
}>>(() => {
  const map: Record<string, any> = {}

  for (const t of locationTypes.value) {
    map[t.name] = {
      color: t.color ?? 'var(--ion-color-carrot)',
      emoji: t.emoji ?? undefined
    }
  }

  return map
})

// No viewMode logic needed

/* ---------------- Utilities ---------------- */

const getDomEl = (node: Element | ComponentPublicInstance | null | undefined) =>
    ((node as ComponentPublicInstance | null)?.$el ?? node) as HTMLElement | null

const formatKm = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : '–')

const getDistanceInKm = (locPos: LatLng) => {
  const refLoc = lastCalcLocation.value
  if (!refLoc) return Number.POSITIVE_INFINITY
  const R = 6371
  const dLat = (locPos.lat - refLoc.lat) * Math.PI / 180
  const dLon = (locPos.lng - refLoc.lng) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(refLoc.lat * Math.PI / 180) *
      Math.cos(locPos.lat * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

// ✅ initialize dayjs
dayjs.extend(relativeTime)
dayjs.extend(utc)
dayjs.extend(timezone)

function fromNowToTaipei(dateString?: string) {
  if (!dateString) return ''
  return dayjs.utc(dateString).tz('Asia/Taipei').fromNow()
}

const displayedLocations = computed(() => {
  // if one place is focused → only show that
  if (focusedPlaceId.value !== null) {
    return sortedLocations.value.filter(l => l.id === focusedPlaceId.value)
  }
  return sortedLocations.value
})


const setCardRef = (id: number): VNodeRef =>
    ((el: Element | ComponentPublicInstance | null) => {
      cardRefs.value[id] = el
    }) as VNodeRef

const onImageError = (e: Event) => {
  const img = e.currentTarget as HTMLImageElement | null
  if (!img) return
  img.onerror = null
  img.src = PLACEHOLDER
}

const carrotRippleClusterRenderer: Renderer = {
  render: ({count, position}: Cluster) => {
    // Color based on count
    let bg = "rgba(255, 159, 64, 1)" // light orange
    if (count > 50) bg = "rgba(255, 87, 34, 1)" // carrot orange
    if (count > 100) bg = "rgba(220, 53, 69, 1)" // red

    const div = document.createElement("div")
    div.style.background = bg
    div.style.color = "white"
    div.style.borderRadius = "50%"
    div.style.display = "flex"
    div.style.alignItems = "center"
    div.style.justifyContent = "center"
    div.style.width = "40px"
    div.style.height = "40px"
    div.style.fontSize = "14px"
    div.style.fontWeight = "bold"
    div.style.boxShadow = "0 3px 6px rgba(0,0,0,0.2)"
    div.style.transition = "transform 0.3s ease"
    div.textContent = String(count)

    return new google.maps.marker.AdvancedMarkerElement({
      position,
      content: div
    })
  },
}

const darkenColor = (color: string, amount = 0.35) => {
  // HEX format
  if (color.startsWith('#')) {
    const hex = color.replace('#', '')
    if (hex.length !== 6) return color

    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)

    const dark = (v: number) => Math.max(0, Math.floor(v * (1 - amount)))

    return `rgb(${dark(r)}, ${dark(g)}, ${dark(b)})`
  }

  // rgb / rgba format
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (match) {
    const r = Number(match[1])
    const g = Number(match[2])
    const b = Number(match[3])

    const dark = (v: number) => Math.max(0, Math.floor(v * (1 - amount)))

    return `rgb(${dark(r)}, ${dark(g)}, ${dark(b)})`
  }

  // fallback (CSS var etc.)
  return color
}


const hexToRgba = (hex: string, alpha: number) => {
  // Handle CSS variables
  if (hex.startsWith('var(')) {
    return `rgba(var(--ion-color-carrot-rgb), ${alpha})`
  }
  // Handle hex colors
  let c = hex.replace('#', '')
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2]
  }
  if (c.length !== 6) return `rgba(255, 159, 64, ${alpha})`
  const r = parseInt(c.substring(0, 2), 16)
  const g = parseInt(c.substring(2, 4), 16)
  const b = parseInt(c.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const buildInfoHtml = (p: Place) => {
  const baseColor =
      markerStyles.value[p.type]?.color ?? 'var(--ion-color-carrot)'

  const textColor = darkenColor(baseColor, 0.45)
  const emoji = markerStyles.value[p.type]?.emoji ?? ''

  // Check dark mode
  const isDark = document.documentElement.classList.contains('ion-palette-dark')
  const textColorStyle = isDark ? 'color: var(--ion-color-light);' : 'color: var(--ion-color-dark);'
  const subTextColor = isDark ? '#a0a0a0' : '#6b7280'

  // Compact info window with small image
  return `
    <div style="max-width: 200px; padding: 4px; ${textColorStyle}">
      <img
        src="${p.image || 'https://placehold.co/120x80'}"
        alt="${p.name}"
        style="
          width: 100%;
          height: 80px;
          object-fit: cover;
          border-radius: 6px;
          margin-bottom: 6px;
        "
        onerror="this.src='https://placehold.co/120x80';"
      />

      <strong style="display:block; font-size:14px; margin-bottom:4px; line-height: 1.3; ${textColorStyle}">
        ${p.name}
      </strong>

      <!-- Category badge -->
      <span
        style="
          display: inline-block;
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 500;
          color: ${textColor};
          border-width: 1px;
          border-style: solid;
          border-color: ${textColor};
          background: rgba(0,0,0,0.03);
        "
      >
        ${emoji ? `${emoji}&nbsp;` : ''}${p.type}
      </span>
    </div>
  `
}
const createPinElement = (place: Place) => {
  const style =
      markerStyles.value[place.type] ?? {
        color: "var(--ion-color-carrot)"
      }

  const wrapper = document.createElement("div")
  wrapper.className = "pin-wrapper"

  wrapper.innerHTML = `
    <div class="pin">
      <div class="pin-head">
        ${style.emoji ?? ""}
      </div>
      <div class="pin-body" style="background:${style.color}"></div>
    </div>
  `

  return wrapper
}


const applyInfoWindowDarkClass = () => {
  const isDark = document.documentElement.classList.contains('ion-palette-dark')
  const iw = document.querySelector('.gm-style-iw-c')
  if (iw) iw.classList.toggle('dark-infowindow', isDark)
}

// Resolve the actual host element from a ref that may be a component or an element
const asEl = (node: unknown): HTMLElement | null => {
  if (!node) return null
  const maybeCmp = node as { $el?: Element }
  return ((maybeCmp && '$el' in maybeCmp && (maybeCmp.$el as unknown)) ? maybeCmp.$el : (node as Element)) as HTMLElement
}

const scrollCardIntoView = async (id: number) => {
  await nextTick()

  const cardRef = cardRefs.value[id]
  const cardEl = getDomEl(cardRef)
  if (!cardEl || !contentRef.value) return

  const containerEl = contentRef.value as HTMLElement
  
  // For horizontal slider, we use scrollLeft
  const containerRect = containerEl.getBoundingClientRect()
  const cardRect = cardEl.getBoundingClientRect()
  
  const scrollOffset = containerEl.scrollLeft + (cardRect.left - containerRect.left) - (containerRect.width / 2) + (cardRect.width / 2)
  
  isProgrammaticScroll = true
  containerEl.scrollTo({
    left: scrollOffset,
    behavior: 'smooth'
  })

  // Reset after scroll likely finishes
  setTimeout(() => {
    isProgrammaticScroll = false
  }, 800)
}

/* ---------------- Roles ---------------- */
const loadRole = async () => {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    isLoggedIn.value = false
    return
  }

  isLoggedIn.value = true

  const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

  if (!error && (data?.role === 'admin' || data?.role === 'contributor')) {
    isContributor.value = true
  }
}

/* ---------------- Data ---------------- */
const fetchLocations = async () => {
  loadingPlaces.value = true

  const { data, error } = await supabase
      .from('locations')
      .select(`
    id,
    name,
    lat,
    lng,
    image,
    type_id,
    address,
    view_count,
    created_at,
    tags,
    description,
    location_types(name),
    partner:partners(partner_tier)
  `)
      .eq('approved', true)
      .eq('is_archived', false)


  if (!error && data) {
    //@ts-expect-error LocationRow
    const typedData = data as LocationRow[]

    locations.value = typedData.map((loc: any) => ({
      id: loc.id,
      name: loc.name,
      address: loc.address ?? null,
      position: {lat: loc.lat, lng: loc.lng},
      image: loc.image,
      typeId: loc.type_id,
      type: loc.location_types?.name ?? '',
      view_count: loc.view_count ?? 0,
      partner_tier: Array.isArray(loc.partner) ? loc.partner[0]?.partner_tier : loc.partner?.partner_tier,
      created_at: loc.created_at,
      tags: loc.tags || [],
      description: loc.description
    }))
  }

  initMarkers()
  loadingPlaces.value = false
}

const fetchTrendingPlaces = async () => {
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
  const yesterday = new Date(oneDayAgo).toISOString();
  
  const { data, error } = await supabase
    .from('activity_log')
    .select('entity_id')
    .eq('entity_type', 'place')
    .in('activity_type', ['explore_place_detail_open', 'explore_place_card_click', 'explore_marker_click'])
    .gte('created_at', yesterday)

  if (!error && data) {
    const counts: Record<string, number> = {}
    data.forEach(log => {
      if (log.entity_id) {
        counts[log.entity_id] = (counts[log.entity_id] || 0) + 1
      }
    })
    
    trendingPlaceIds.value = Object.keys(counts)
      .sort((a, b) => counts[b] - counts[a])
      .map(id => parseInt(id))
  }
}

const categories = computed(() => locationTypes.value)

const toggleCategory = (cat: LocationType) => {
  const index = activeCategoryIds.value.indexOf(cat.id)

  if (index > -1) {
    // remove
    activeCategoryIds.value.splice(index, 1)
  } else {
    // add
    activeCategoryIds.value.push(cat.id)
  }

  ActivityLogService.log("explore_filter_category", {
    category_id: cat.id,
    category_ids: activeCategoryIds.value,
    category_name: cat.name
  })

  focusedPlaceId.value = null
  if (infoWindow) infoWindow.close()
}


/* ---------------- Map ---------------- */
const initMap = async () => {
  if (mapInstance) return   // guard

  await nextTick()          // wait for Vue render

  const el = document.getElementById('map')
  if (!el) {
    console.warn('[Map] #map not ready yet, retrying...')
    requestAnimationFrame(initMap)
    return
  }

  loading.value = true

  const [{Map}, marker] = await Promise.all([
    mapsLoader.importLibrary('maps'),
    mapsLoader.importLibrary('marker')
  ])
  advancedMarkerLib = marker

  // Check for pre-existing fix to provide an "instant" map center
  const initialCenter = userLocation.value ? { lat: userLocation.value.lat, lng: userLocation.value.lng } : DEFAULT_CENTER
  const initialZoom = userLocation.value ? 15 : 14

  mapInstance = new Map(el, {
    center: initialCenter,
    zoom: initialZoom,
    disableDefaultUI: true,
    mapId: MAP_ID,
    clickableIcons: false
  })

  // 🟦 IMMEDIATELY create user marker if loc is ready
  if (userLocation.value) {
    const dot = document.createElement('div')
    dot.className = 'user-location-dot'
    const cone = document.createElement('div')
    cone.className = 'user-heading-cone'
    dot.prepend(cone)
    userArrowEl.value = cone

    userMarker.value = new marker.AdvancedMarkerElement({
      position: initialCenter,
      map: mapInstance,
      content: dot,
      title: t('explore.userLocationTitle')
    })
    
    hasAutoCentered.value = true
    initHeadingTracking()
  }

  infoWindow = new google.maps.InfoWindow()

  window.addEventListener('resize', handleResize)
  
  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
  })
  // ✅ Interaction Tracking: Stop list-to-map sync if user is touching map
  mapInstance.addListener('dragstart', () => {
    isUserPanningMap.value = true
  })
  mapInstance.addListener('zoom_changed', () => {
    isUserPanningMap.value = true
    currentZoom.value = mapInstance?.getZoom() || 14
  })

  // ✅ Debounced idle listener (150ms) to prevent spamming updates
  let idleTimeout: any = null;
  mapInstance.addListener('idle', () => {
    if (idleTimeout) clearTimeout(idleTimeout);
    idleTimeout = setTimeout(() => {
      initMarkers(sortedLocations.value);
      isUserPanningMap.value = false // User finished manual interaction
    }, 300);
  });

  loading.value = false
}

/**
 * Atomic cleanup for all campus-specific map overlays to prevent "zombie" elements
 */
function clearCampusOverlays() {
  campusOverlays.forEach(obj => {
    try {
      if (obj.setMap) obj.setMap(null)
      else if (obj.map !== undefined) obj.map = null
    } catch (e) {
      console.warn('[Map Cleanup] Failed to clear overlay', e)
    }
  })
  campusOverlays = []
  
  if (campusCircle.value) {
    campusCircle.value.setMap(null)
    campusCircle.value = null
  }
  if (campusLabel.value) {
    campusLabel.value.map = null
    campusLabel.value = null
  }
}

/**
 * Draws or removes a radius circle for campus partners
 */
function updateCampusCircle() {
  if (!mapInstance) return

  // 1. Force clear EVERYTHING before drawing anything new
  clearCampusOverlays()

  // 2. Draw ONLY if the ntu tag is active
  if (activeTag.value === 'ntu') {
    const coords = CAMPUS_COORDS['ntu']
    
    const circle = new google.maps.Circle({
      strokeColor: '#FF0000',
      strokeOpacity: 0.25,
      strokeWeight: 2,
      fillColor: '#FF0000',
      fillOpacity: 0.05,
      map: mapInstance,
      center: coords,
      radius: 3000, 
      clickable: false
    })
    
    campusCircle.value = circle
    campusOverlays.push(circle)

    if (advancedMarkerLib) {
      const labelDiv = document.createElement('div')
      labelDiv.className = 'campus-radius-label'
      labelDiv.innerHTML = `
        <div class="walk-label-content">
          <div class="campus-title-small">${t('explore.campusRadiusTitle', { name: 'NTU' })}</div>
          <div class="walk-info-row">
            <span class="walk-icon">🚶</span>
            <span class="walk-text">${t('explore.walkingRadius')}</span>
          </div>
        </div>
      `

      const label = new advancedMarkerLib.AdvancedMarkerElement({
        position: coords,
        content: labelDiv,
        map: mapInstance,
        zIndex: 5
      })
      
      campusLabel.value = label
      campusOverlays.push(label)
    }
  }
}


const markerCache = new Map<number, google.maps.marker.AdvancedMarkerElement>()

const initMarkers = (places: Place[] = sortedLocations.value) => {
  if (!mapInstance || !advancedMarkerLib) return

  // 1. Get Viewport Bounds with Buffer
  const bounds = mapInstance.getBounds();
  let visiblePlaces = places;
  
  if (bounds) {
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const latDiff = Math.abs(ne.lat() - sw.lat());
    const lngDiff = Math.abs(ne.lng() - sw.lng());
    const buffer = 0.25; // 25% buffer

    const extendedBounds = new google.maps.LatLngBounds(
      { lat: sw.lat() - latDiff * buffer, lng: sw.lng() - lngDiff * buffer },
      { lat: ne.lat() + latDiff * buffer, lng: ne.lng() + lngDiff * buffer }
    );

    visiblePlaces = places.filter(p => extendedBounds.contains(p.position));
  }

  // 2. Marker Recycling Logic
  const newMarkerArray: google.maps.marker.AdvancedMarkerElement[] = []
  const visibleIds = new Set(visiblePlaces.map(p => p.id));

  // Remove markers no longer in viewport from the map (but keep in cache)
  const idsToRemove = [] as number[];
  markerMap.forEach((_, id) => {
    if (!visibleIds.has(id)) idsToRemove.push(id);
  });
  
  idsToRemove.forEach(id => {
    const marker = markerMap.get(id);
    if (marker) marker.map = null;
    markerMap.delete(id);
  });

  visiblePlaces.forEach((loc) => {
    let marker = markerCache.get(loc.id);

    if (!marker) {
      // Create only if not in cache
      const iconHTML = createPinElement(loc);
      marker = new advancedMarkerLib!.AdvancedMarkerElement({
        position: loc.position,
        content: iconHTML,
        title: `${loc.type}: ${loc.name}`
      });

      marker.addListener('click', () => {
        ActivityLogService.log("explore_marker_click", {
          id: loc.id,
          name: loc.name,
          type: loc.type,
          lat: loc.position.lat,
          lng: loc.position.lng
        });
        if (searchQuery.value && !loc.name.toLowerCase().includes(searchQuery.value.toLowerCase())) {
          searchQuery.value = '';
        }
        selectPlace(loc);
      });

      markerCache.set(loc.id, marker);
    }

    markerMap.set(loc.id, marker);
    newMarkerArray.push(marker);

    // ✅ CHECK FOR PENDING INFO WINDOW (Reliability fix)
    if (loc.id === pendingInfoWindowPlaceId.value && infoWindow && mapInstance) {
      infoWindow.setContent(buildInfoHtml(loc));
      infoWindow.open(mapInstance, marker);
      setTimeout(applyInfoWindowDarkClass, 50);
      pendingInfoWindowPlaceId.value = null;
    }
  });

  // 3. Update Clusterer - only cluster when zoomed out (zoom <= 12)
  const shouldCluster = currentZoom.value <= 12;

  if (shouldCluster) {
    if (!clusterer) {
      clusterer = new MarkerClusterer({
        map: mapInstance,
        markers: newMarkerArray,
        renderer: carrotRippleClusterRenderer,
        algorithm: new SuperClusterAlgorithm({ radius: 80 })
      });
    } else {
      clusterer.clearMarkers();
      clusterer.addMarkers(newMarkerArray);
    }
  } else {
    // Remove clustering at higher zoom levels - show individual markers
    if (clusterer) {
      clusterer.clearMarkers();
      clusterer.setMap(null);
      clusterer = null;
    }
    // Ensure all markers are directly on the map
    newMarkerArray.forEach(marker => {
      marker.map = mapInstance;
    });
  }

  // 4. Fit bounds ONLY IF specifically filtered by user (tag/category/search)
  const isFiltered = activeCategoryIds.value.length > 0 || !!activeTag.value || !!searchQuery.value.trim()
  if (isFiltered && visiblePlaces.length > 0 && !hasCenteredInitiallyVisible) {
    const fitBounds = new google.maps.LatLngBounds()
    visiblePlaces.forEach(p => fitBounds.extend(p.position))
    if (fitBounds && mapInstance) {
      mapInstance.fitBounds(fitBounds)
    }

    google.maps.event.addListenerOnce(mapInstance, 'idle', () => {
      if (mapInstance!.getZoom()! > 17) mapInstance!.setZoom(17)
    });
    hasCenteredInitiallyVisible = true;
  }
}

let hasCenteredInitiallyVisible = false;

// Final centerOnUser trigger or modal resize logic
// viewMode was removed, so we only need resize logic if general state change occurs, 
// usually IonModal handles its own viewport.

watch(searchQuery, q => {
  if (!q && addressMarker.value) {
    addressMarker.value.map = null
    addressMarker.value = null
  }
})

/* ---------------- Interactions ---------------- */
const selectPlace = (place: Place) => {
  selectedPlace.value = place
  lastPannedId = place.id
  
  // Track this place as visited for For You recommendations
  if (!visitedPlaceIds.value.includes(place.id)) {
    visitedPlaceIds.value.push(place.id)
  }
  
  scrollCardIntoView(place.id)

  if (!mapInstance) return

  const currentZoom = mapInstance.getZoom() || 14
  const targetZoom = currentZoom < 16 ? 17 : currentZoom
  
  // Calculate offset to center info card (~100px North)
  const latOffset = 100 * 360 / (256 * Math.pow(2, targetZoom))
  
  mapInstance.panTo({
    lat: place.position.lat + latOffset,
    lng: place.position.lng
  })
  mapInstance.setZoom(targetZoom)

  const m = markerMap.get(place.id)
  if (m && infoWindow && mapInstance) {
    // SEQUENCE: Pan first, then show InfoWindow
    setTimeout(() => {
      if (selectedPlace.value?.id === place.id && infoWindow && mapInstance) {
        infoWindow.setContent(buildInfoHtml(place))
        infoWindow.open(mapInstance, m)

        // Wait for DOM to render to attach button listeners
        setTimeout(() => {
          if (selectedPlace.value?.id !== place.id) return;
          
          applyInfoWindowDarkClass()

          const shareBtn = document.querySelector('.share-btn')
          if (shareBtn) {
            shareBtn.addEventListener('click', () => {
              ActivityLogService.log("explore_share_place", { id: place.id, name: place.name });
              sharePlace({
                name: place.name,
                type: place.type,
                imageUrl: place.image || 'https://placehold.co/200x100',
                lat: place.position.lat,
                lng: place.position.lng
              })
            })
          }

          const navigateBtn = document.querySelector('.navigate-btn')
          if (navigateBtn) {
            navigateBtn.addEventListener('click', () => {
              ActivityLogService.log("explore_navigate_click", { id: place.id, name: place.name });
            })
          }
        }, 50)
      }
    }, 350)
  } else if (infoWindow) {
    // Marker not in DOM yet (off-screen)? 
    // Set pending and let initMarkers pick it up after the pan
    pendingInfoWindowPlaceId.value = place.id
  }
}

const initCardObserver = () => {
  if (!contentRef.value) {
    // Retry once if Ref is not defined yet (Vue rendering race)
    nextTick(() => {
      if (contentRef.value) initCardObserver()
    })
    return
  }
  
  const currentRoot = (contentRef.value as HTMLElement)
  
  // Proper cleanup if root changes or if we want a fresh start
  if (cardObserver && (cardObserver as any).root !== currentRoot) {
    cardObserver.disconnect()
    cardObserver = null
  }

  if (!cardObserver) {
    cardObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.4) {
          const id = Number(entry.target.getAttribute('data-id'))
          const p = locations.value.find(l => l.id === id)
          
          if (p) {
            // 1. Always update the UI highlight (orange border)
            if (selectedPlace.value?.id !== id) {
              selectedPlace.value = p
            }
            
            // 2. SMART CAMERA CONTROL: Only pan map once per highlighted card
            // - Only if user is manually swiping (isUserScrollingList)
            // - AND not currently dragging the map (isUserPanningMap)
            // - AND we haven't already panned to this specific ID
            if (isUserScrollingList.value && !isUserPanningMap.value && lastPannedId !== p.id) {
              lastPannedId = p.id
              
              requestAnimationFrame(() => {
                if (mapInstance && isUserScrollingList.value) {
                   const currentZoom = mapInstance.getZoom() || 14
                   const latOffset = 100 * 360 / (256 * Math.pow(2, currentZoom))
                   mapInstance.panTo({ lat: p.position.lat + latOffset, lng: p.position.lng });
                   
                   const m = markerMap.get(p.id)
                   if (m && infoWindow && mapInstance) {
                     setTimeout(() => {
                       // Final check: only open if this card is still the selected one
                       if (selectedPlace.value?.id === p.id && infoWindow && mapInstance) {
                         infoWindow.setContent(buildInfoHtml(p))
                         infoWindow.open(mapInstance, m)
                         setTimeout(applyInfoWindowDarkClass, 50)
                       }
                     }, 350)
                   }
                }
              });
            }
          }
        }
      });
    }, {
      root: currentRoot,
      threshold: [0.4] // 40% visibility is enough to trigger highlight
    })
  }

  // Re-observe cards
  nextTick(() => {
    const cards = (contentRef.value as HTMLElement)?.querySelectorAll('.modern-location-card')
    cards?.forEach(c => cardObserver?.observe(c))
  })
}

const centerOnUser = async () => {
  await ActivityLogService.log("explore_center_user")

  if (!userLocation.value || !mapInstance) return

  mapInstance.panTo(userLocation.value)

  // Optional: gentle zoom only if far
  const zoom = mapInstance.getZoom() ?? 14
  if (zoom < 16) {
    mapInstance.setZoom(16)
  }
}


const onSearchInput = (event: CustomEvent) => {
  searchQuery.value = (event.detail?.value ?? '') as string

  ActivityLogService.log("explore_search_query", {
    query: searchQuery.value
  });
}

/* ---------------- Derived ---------------- */
const remoteSearchIds = ref<number[] | null>(null)
let remoteSearchTimeout: ReturnType<typeof setTimeout> | null = null

watch(searchQuery, (q) => {
  if (remoteSearchTimeout) clearTimeout(remoteSearchTimeout)
  if (!q || q.length < 2) {
    remoteSearchIds.value = null
    return
  }
  
  remoteSearchTimeout = setTimeout(async () => {
    const { data } = await supabase
      .from('locations')
      .select('id')
      .textSearch('search_vector', q, { type: 'websearch' })
      
    if (data) {
      remoteSearchIds.value = data.map(d => d.id)
    }
  }, 500) // 500ms debounce
}) // Added the missing }) here

const sortedLocations = computed(() => {
  let base = [...locations.value]

  // filter by strict tag
  if (activeTag.value) {
    const qTag = activeTag.value.toLowerCase()
    base = base.filter(l => l.tags && l.tags.some(t => t.toLowerCase() === qTag))
  }

  // filter by category
  if (activeCategoryIds.value.length > 0) {
    base = base.filter(l =>
        l.typeId && activeCategoryIds.value.includes(l.typeId)
    )
  }

  // search (this already works for all matches)
  const q = searchQuery.value.toLowerCase().trim()

  if (q) {
    if (remoteSearchIds.value !== null) {
      base = base.filter(l => 
        remoteSearchIds.value!.includes(l.id) ||
        l.name.toLowerCase().includes(q) ||
        (l.address && l.address.toLowerCase().includes(q)) ||
        (l.tags && l.tags.some(t => t.toLowerCase().includes(q)))
      )
    } else {
      base = base.filter(l =>
          l.name.toLowerCase().includes(q) ||
          (l.address && l.address.toLowerCase().includes(q)) ||
          (l.tags && l.tags.some(t => t.toLowerCase().includes(q)))
      )
    }
  }


  // Hybrid Sorting Strategy
  const mapped = base.map(p => {
    const distance = lastCalcLocation.value ? getDistanceInKm(p.position) : Number.POSITIVE_INFINITY;
    return { ...p, distance };
  });

  if (sortBy.value === 'nearest') {
    mapped.sort((a, b) => a.distance - b.distance);
  } else if (sortBy.value === 'recent') {
    mapped.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  } else if (sortBy.value === 'popular') {
    mapped.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
  } else if (sortBy.value === 'trending') {
    mapped.sort((a, b) => {
      const aIndex = trendingPlaceIds.value.indexOf(a.id);
      const bIndex = trendingPlaceIds.value.indexOf(b.id);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return (b.view_count || 0) - (a.view_count || 0);
    });
  } else if (sortBy.value === 'for_you') {
    // For You: Random discovery within user's interests (within 10km)
    const MAX_FOR_YOU_DISTANCE = 10; // km
    
    // Filter to only places within 10km
    const withinRange = mapped.filter(p => p.distance <= MAX_FOR_YOU_DISTANCE);
    const outsideRange = mapped.filter(p => p.distance > MAX_FOR_YOU_DISTANCE);
    
    // Shuffle seeded by session so order stays consistent during the session
    const sessionSeed = Date.now().toString().slice(0, -5); // Changes every ~3 hours
    const seededRandom = (id: number) => {
      const str = `${sessionSeed}-${id}`;
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash) / 2147483647;
    };

    // Sort within-range places by For You criteria
    withinRange.sort((a, b) => {
      const aInForYou = forYouPlaceIds.value.includes(a.id);
      const bInForYou = forYouPlaceIds.value.includes(b.id);
      const aVisited = visitedPlaceIds.value.includes(a.id);
      const bVisited = visitedPlaceIds.value.includes(b.id);

      // Priority 1: In forYou list AND not visited → highest priority (random order)
      if (aInForYou && !aVisited && !(bInForYou && !bVisited)) return -1;
      if (bInForYou && !bVisited && !(aInForYou && !aVisited)) return 1;

      // Priority 2: Both are unvisited forYou places → random shuffle
      if (aInForYou && !aVisited && bInForYou && !bVisited) {
        return seededRandom(a.id) - seededRandom(b.id);
      }

      // Priority 3: In forYou list but visited
      if (aInForYou && !bInForYou) return -1;
      if (bInForYou && !aInForYou) return 1;

      // Priority 4: Both in forYou and visited → random shuffle
      if (aInForYou && bInForYou) {
        return seededRandom(a.id) - seededRandom(b.id);
      }

      // Priority 5: Neither in forYou → random discovery within range
      return seededRandom(a.id) - seededRandom(b.id);
    });

    // Sort outside-range by distance
    outsideRange.sort((a, b) => a.distance - b.distance);

    // Combine: within-range first, then outside-range
    return [...withinRange, ...outsideRange];
  }

  return mapped;
})

/* ... */
// Watch for actual changes in the FILTERED set of locations
const filteredIdsHash = computed(() => {
  return sortedLocations.value.map(l => l.id).join(',');
});

watch(filteredIdsHash, () => {
  hasCenteredInitiallyVisible = false; // allow re-fitting if filter changes
  initMarkers(sortedLocations.value)
})

// CONSOLIDATED AUTO-SELECT WATCHER
watch([() => sortedLocations.value.length, userLocation, loading, locationAttemptFinished, sortBy], ([count, loc, isLoading, finished, currentSort]) => {
  if (count > 0 && loc && !isLoading && !hasAutoSelected.value && !selectedPlace.value && finished && currentSort === 'nearest') {
    // Select the first item once everything (Map, GPS, Data, and Sort Order) is ready
    selectPlace(sortedLocations.value[0]);
    hasAutoSelected.value = true;
  }
}, { immediate: true });

watch(activeTag, () => {
  updateCampusCircle()
})

// Only re-init observer if IDs change (ignoring simple re-ordering)
const displayedIdsSet = computed(() => {
  const ids = displayedLocations.value.map(l => l.id);
  ids.sort((a, b) => a - b);
  return ids.join(',');
});

watch(displayedIdsSet, () => {
  if (viewMode.value === 'map') {
    initCardObserver()
  } else {
    if (infiniteObserver) infiniteObserver.disconnect()
    nextTick(() => initInfiniteObserver())
  }
})

/* ---------------- Drag Scroll Logic for Desktop Category Bar ---------------- */
let isDraggingCategoryBar = false
let categoryBarStartX = 0
let categoryBarScrollLeft = 0

const initCategoryBarDrag = () => {
  const bar = desktopCategoryBar.value
  if (!bar) return

  const onMouseDown = (e: MouseEvent) => {
    isDraggingCategoryBar = true
    bar.classList.add('dragging')
    categoryBarStartX = e.pageX - bar.offsetLeft
    categoryBarScrollLeft = bar.scrollLeft
  }

  const onMouseMove = (e: MouseEvent) => {
    if (!isDraggingCategoryBar) return
    e.preventDefault()
    const x = e.pageX - bar.offsetLeft
    const walk = (x - categoryBarStartX) * 1.5 // Scroll speed multiplier
    bar.scrollLeft = categoryBarScrollLeft - walk
  }

  const onMouseUp = () => {
    isDraggingCategoryBar = false
    bar.classList.remove('dragging')
  }

  const onMouseLeave = () => {
    isDraggingCategoryBar = false
    bar.classList.remove('dragging')
  }

  bar.addEventListener('mousedown', onMouseDown)
  bar.addEventListener('mousemove', onMouseMove)
  bar.addEventListener('mouseup', onMouseUp)
  bar.addEventListener('mouseleave', onMouseLeave)

  // Cleanup function
  return () => {
    bar.removeEventListener('mousedown', onMouseDown)
    bar.removeEventListener('mousemove', onMouseMove)
    bar.removeEventListener('mouseup', onMouseUp)
    bar.removeEventListener('mouseleave', onMouseLeave)
  }
}

/* ---------------- Lifecycle ---------------- */
onMounted(async () => {
  isPageActive.value = true

  // START GPS WATCH IMMEDIATELY (Non-blocking)
  startWatching()

  await ActivityLogService.log("explore_page_open")

  // Parallelize basic data and map init
  initMap()
  loadRole()
  fetchLocationTypes()
  
  // These are more critical for the list, but let's fire them 
  fetchCampusPartners()
  
  // Await the heavy locations fetch
  await fetchLocations()
  
  // Await secondary data
  await Promise.allSettled([
    fetchTrendingPlaces(),
    refreshViewCounts()
  ])
  
  if (viewMode.value === 'map') {
    nextTick(() => initCardObserver())
  } else {
    nextTick(() => initInfiniteObserver())
  }

  // Initialize drag scroll for desktop category bar
  nextTick(() => initCategoryBarDrag())

  processUrlParams()
  window.addEventListener('resize', handleResize)
})

const processUrlParams = () => {
  const focusId = Number(router.currentRoute.value.query.focus)
  if (focusId) {
    const p = locations.value.find(l => l.id === focusId)
    if (p) selectPlace(p)

    const query = { ...router.currentRoute.value.query }
    delete query.focus
    router.replace({ query })
  }

  const tagParam = router.currentRoute.value.query.tag as string
  if (tagParam) {
    activeTag.value = tagParam
    const query = { ...router.currentRoute.value.query }
    delete query.tag
    router.replace({ query })
  }
}


onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (cardObserver) cardObserver.disconnect()
  if (infiniteObserver) infiniteObserver.disconnect()
  clearCampusOverlays()
})

let firstEnter = true

onIonViewWillEnter(async () => {
  isPageActive.value = true
  hasAutoSelected.value = false; // allow re-highlighting when returning
  hasCenteredInitiallyVisible = false;
  
  if (firstEnter) {
    firstEnter = false
    return
  }

  await fetchLocations()
  await fetchCampusPartners()
  await nextTick()

  if (mapInstance) {
    google.maps.event.trigger(mapInstance, 'resize')
  }

  processUrlParams()
})


onIonViewDidEnter(async () => {
  await refreshViewCounts();  // refresh again when user returns
});

onIonViewWillLeave(() => {
  isPageActive.value = false
  clearCampusOverlays()
  lastStableLoc.value = null   // REQUIRED
})


async function refreshViewCounts() {
  if (locations.value.length === 0) return;

  const ids = locations.value.map(l => l.id);

  const {data: updated, error} = await supabase
      .from("locations")
      .select("id, view_count")
      .in("id", ids);

  if (!error && updated) {
    for (const u of updated) {
      const loc = locations.value.find(l => l.id === u.id);
      if (loc) loc.view_count = u.view_count;
    }
  }
}


/* dark mode InfoWindow sync */
const observer = new MutationObserver(applyInfoWindowDarkClass)
observer.observe(document.documentElement, {attributes: true, attributeFilter: ['class']})

/* ---------------- Navigation ---------------- */
const goToAddPlace = async () => {
  router.push('/explore/add')
}

const goToDetail = async (id: number) => {

  const place = locations.value.find(p => p.id === id)
  if (place) place.view_count = (place.view_count ?? 0) + 1
  
  // Track this place as visited for For You recommendations
  if (!visitedPlaceIds.value.includes(id)) {
    visitedPlaceIds.value.push(id)
  }

  ActivityLogService.log("explore_place_detail_open", {
    id,
    name: place?.name || null,
    type: place?.type || null
  });

  router.push(`/place/${id}`);
};

const openNavigation = (place: Place) => {
  ActivityLogService.log("explore_navigate_click", { id: place.id, name: place.name });
  const url = `https://www.google.com/maps/dir/?api=1&destination=${place.position.lat},${place.position.lng}`;
  window.open(url, '_blank');
};

const openSaveModal = (place: Place) => {
  if (!isLoggedIn.value) {
    router.push({
      path: '/login',
      query: { redirect: '/explore' }
    });
    return;
  }
  
  selectedLocationForSave.value = { id: place.id, name: place.name };
  showSaveLocationModal.value = true;
  
  ActivityLogService.log("location_save_click", {
    location_id: place.id,
    location_name: place.name,
    source: viewMode.value === 'map' ? 'explore_map' : 'explore_list'
  });
};

</script>


<style>
:root {
  --explore-top-offset: 0px;
  --explore-card-height: 160px;
}

/*********************************************
 * MAP SECTION
 *********************************************/
#map {
  margin: 0;
  width: 100%;
  height: 45vh;
  border-radius: 0;
  overflow: hidden;
  position: relative;
  z-index: 1;
}

.map-overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
}


/*********************************************
 * GOOGLE MAPS UI OVERRIDES
 *********************************************/
.gm-style {
  font: var(--ion-font-family);
}

.gm-style .gm-style-iw-c {
  color: var(--ion-color-dark);
}

.gm-style .gm-style-iw-c.dark-infowindow {
  color: var(--ion-color-light);
}

button.gm-ui-hover-effect {
  width: 24px !important;
  height: 24px !important;
}

button.gm-ui-hover-effect > span {
  position: absolute;
  left: 1px;
  top: 1px;
  background: var(--ion-color-medium) !important;
  width: 24px !important;
  height: 24px !important;
  margin: 0 !important;
}

/*********************************************
 * QUICK FILTERS BAR (Map View Only)
 *********************************************/
.quick-filters-bar {
  padding: 6px 12px;
  background: transparent;
  pointer-events: auto;
  z-index: 1001;
  position: relative;
}

.quick-filters-scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding-bottom: 2px;
}

.quick-filters-scroll::-webkit-scrollbar {
  display: none;
}

.quick-filter-chip {
  background: var(--ion-background-color) !important;
  --color: var(--cat-color, var(--ion-color-carrot));
  border: 1px solid var(--cat-color, var(--ion-color-carrot));
  border-radius: 16px;
  padding: 4px 12px;
  margin: 0;
  height: 32px;
  font-size: 13px;
  font-weight: 500;
  flex-shrink: 0;
  transition: all 0.2s ease;
  pointer-events: auto;
  cursor: pointer;
}

.quick-filter-chip.active {
  --background: var(--cat-bg, var(--ion-color-carrot));
  --color: white;
  border-color: var(--cat-bg, var(--ion-color-carrot));
}

.quick-filter-chip .category-icon {
  font-size: 14px;
  margin-right: 4px;
}

.quick-filter-chip .category-emoji {
  font-size: 12px;
  margin-right: 4px;
}

.quick-filter-chip ion-label {
  font-size: 13px;
}

/* Dark mode support for unselected quick filter chips */
.ion-palette-dark .quick-filter-chip:not(.active) {
  --background: rgba(var(--ion-color-carrot-rgb), 0.12) !important;
  opacity: 0.9;
}

.quick-filter-chip.more-chip {
  --background: rgba(var(--ion-color-medium-rgb), 0.15);
  color: var(--ion-color-medium);
  border-color: rgba(var(--ion-color-medium-rgb), 0.3);
  font-style: italic;
}

.quick-filter-chip.more-chip:hover {
  --background: rgba(var(--ion-color-medium-rgb), 0.25);
}

/* Dark mode for more chip */
.ion-palette-dark .quick-filter-chip.more-chip {
  --background: rgba(var(--ion-color-medium-rgb), 0.25);
  --color: var(--ion-color-light);
  border-color: rgba(var(--ion-color-light-rgb), 0.2);
}

/*********************************************
 * MAP PINS
 *********************************************/
.pin-wrapper {
  position: relative;
  width: 34px;
  height: 46px;
  cursor: pointer;
  will-change: transform;
  contain: layout paint;
}

.pin {
  position: relative;
  width: 34px;
  height: 46px;
}

.pin-head {
  width: 25px;
  height: 25px;
  background: rgba(255, 255, 255, 0.85); /* Slightly more opaque head */
  border-radius: 50%;
  position: absolute;
  top: 5px;
  left: 4.5px;

  display: flex;
  align-items: center;
  justify-content: center;

  font-size: 14px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  z-index: 2;
}

.pin-body {
  width: 35px;
  height: 35px;
  position: absolute;
  top: 1px;

  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);

  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.ion-palette-dark .pin-head {
  background: rgba(40, 40, 40, 0.9);
  color: #fff;
}

/*********************************************
 * USER LOCATION DOT
 *********************************************/
.user-location-dot {
  position: relative;
  width: 18px;
  height: 18px;
  background: var(--ion-color-carrot);
  border-radius: 50%;
  border: 4px solid white;
  z-index: 10;
  will-change: transform;
  contain: layout paint;
}

.user-location-dot::after {
  content: '';
  position: absolute;
  inset: -4px;
  background: var(--ion-color-carrot);
  border-radius: 50%;
  z-index: -1;
  opacity: 0.4;
  animation: pulse-gpu 2s infinite ease-out;
  will-change: transform, opacity;
}

.user-heading-cone {
  position: absolute;
  bottom: 5px; /* Pinned to the center of the dot */
  left: 50%;
  width: 80px;
  height: 80px;
  margin-left: -40px; /* Center horizontally */
  
  /* Soft gradient beam */
  background: radial-gradient(
    circle at 50% 100%, 
    rgba(var(--ion-color-carrot-rgb), 0.6) 0%, 
    rgba(var(--ion-color-carrot-rgb), 0.2) 50%, 
    transparent 80%
  );
  
  /* Wide cone shape */
  clip-path: polygon(50% 100%, 15% 0%, 85% 0%);
  
  transform-origin: 50% 100%;
  transition: transform 0.2s cubic-bezier(0.1, 0, 0.3, 1);
  pointer-events: none;
  z-index: -1;
  opacity: 0.8;
}

.user-heading-cone::after {
  content: '';
  position: absolute;
  top: 0;
  left: -2px;
  width: 4px;
  height: 4px;
  background: white;
  border-radius: 50%;
  box-shadow: 0 0 6px white;
  display: none; /* Keep it clean for now */
}

@keyframes pulse-gpu {
  0% {
    transform: scale(1);
    opacity: 0.6;
  }
  100% {
    transform: scale(2.5);
    opacity: 0;
  }
}

/* =========================
   EXPLORE HEADER & SEARCH
   (Floating Glassmorphism Design)
========================= */
.explore-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  pointer-events: none;
  background: transparent !important;
  box-shadow: none !important;
  transition: background 0.2s ease, border-bottom 0.2s ease;
}

.explore-header.solid-bg {
  background: var(--ion-background-color) !important;
  pointer-events: auto;
}

.header-search-toolbar {
  --background: transparent !important;
  --border-width: 0 !important;
  
  background: transparent !important;
  min-height: 70px;
}

.search-row-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 16px 4px;
  pointer-events: auto;
  width: 100%;
}

.search-bar-wrapper {
  flex: 1;
  min-width: 140px; /* Prevent search from disappearing */
  display: flex;
  align-items: center;
}

.compact-searchbar {
  --background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  --border-radius: 24px;
  --box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  --padding-start: 12px;
  --padding-end: 12px;
  padding: 0;
  height: 48px;
}

.ion-palette-dark .compact-searchbar {
  --background: rgba(45, 45, 45, 0.85);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.header-btn {
  --border-radius: 50%;
  height: 44px; /* Slightly smaller for better fit */
  width: 44px;
  margin: 0;
  --padding-start: 0;
  --padding-end: 0;
  --color: #fff;
  --background: var(--ion-color-carrot);
  --box-shadow: 0 4px 12px rgba(var(--ion-color-carrot-rgb), 0.3);
  flex-shrink: 0;
}

.campus-bar-row {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  padding: 0px 16px 12px; /* Increased top padding for tags */
  pointer-events: auto;
}

.campus-filter-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 14px; /* Space for the tag */
}

.special-promo-tag {
  position: absolute;
  top: 0;
  font-size: 0.55rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: linear-gradient(135deg, #facc15 0%, #ca8a04 100%);
  color: #422006;
  padding: 1px 6px;
  border-radius: 4px;
  box-shadow: 0 2px 6px rgba(250, 204, 21, 0.4);
  z-index: 10;
  white-space: nowrap;
  transform: translateY(8px);
}

.category-bar-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px 8px;
  pointer-events: auto;
}

.category-bar {
  flex: 1;
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.category-bar::-webkit-scrollbar {
  display: none;
}

/* Draggable scrollable category bar for desktop */
.category-bar.scrollable {
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  scroll-behavior: auto;
}

.category-bar.scrollable:active {
  cursor: grabbing;
}

.category-bar.scrollable.dragging {
  scroll-behavior: auto;
}

.modern-category-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--ion-background-color) !important;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: var(--cat-color);
  height: 36px;
  border-radius: 100px;
  padding: 0 14px;
  border: 1px solid rgba(var(--ion-color-dark-rgb), 0.18);
  font-weight: 600;
  font-size: 0.8rem;
  transition: all 0.2s ease;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.modern-category-chip ion-label {
  margin: 0;
}

.modern-category-chip.active {
  background: var(--cat-color) !important;
  color: #ffffff;
  border-color: var(--cat-color);
  box-shadow: 0 4px 12px rgba(6, 182, 212, 0.2);
}

.category-emoji, .category-icon { margin-right: 6px; }



/* =========================
   PREMIUM LOCATION CARDS
========================= */
.modern-location-card {
  margin: 16px 0;
  background: var(--ion-card-background, #ffffff);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0,0,0,0.06);
  border: 1px solid rgba(var(--ion-color-dark-rgb), 0.05);
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
}

.modern-location-card.active-card {
  border: 3px solid var(--ion-color-carrot) !important;
}

.card-inner {
  display: flex;
  height: var(--explore-card-height);
}

.card-image-section {
  width: 110px;
  height: 100%;
  flex-shrink: 0;
  position: relative;
  background: var(--ion-background-color-step-100, #f0f0f0);
}

.card-image-section img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-info-section {
  flex: 1;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 6px;
  min-width: 0;
}

.info-top .title-text {
  margin: 0 0 4px 0;
  font-size: 1rem;
  font-weight: 850;
  line-height: 1.25;
  color: var(--ion-color-dark);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.metas {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--ion-color-medium);
  opacity: 0.8;
}

.meta-dot { font-size: 1rem; opacity: 0.5; }

.info-bottom {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.distance {
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--ion-color-medium);
}

.action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-left: -12px; /* Pull button to align text */
  margin-top: 4px;
}

/* =========================
   PARTNER TIERS (EXPLORE)
========================= */
/* Partner Tiers (Explore) */
.modern-location-card.tier-gold {
  --tier-bg: var(--tier-gold-bg);
  --tier-border: #facc15;
}

.modern-location-card.tier-silver {
  --tier-bg: var(--tier-silver-bg);
  --tier-border: #cbd5e1;
}

.modern-location-card.tier-bronze {
  --tier-bg: var(--tier-bronze-bg);
  --tier-border: #fed7aa;
}

/* Dark Mode Overrides */






/* Tier Badges (below) */

.tier-header { margin-bottom: 6px; display: flex; }

.tier-badge {
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 0.55rem;
  font-weight: 900;
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
  gap: 3px;
  color: #fff;
}

.tier-badge.gold { background: linear-gradient(135deg, #facc15 0%, #ca8a04 100%); color: #422006; }
.tier-badge.silver { background: linear-gradient(135deg, #cbd5e1 0%, #64748b 100%); color: #0f172a; }
.tier-badge.bronze { background: linear-gradient(135deg, #d97706 0%, #78350f 100%); color: #fff; }

.premium-verified {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 0.65rem;
  font-weight: 900;
  width: 130px; /* Fixed width for consistency */
  height: 30px;
  border-radius: 10px;
  letter-spacing: 0.02em;
  background: rgba(var(--ion-color-dark-rgb), 0.05);
  flex-shrink: 0;
}

.tier-gold .premium-verified { color: #ca8a04; background: rgba(202, 138, 4, 0.1); }
.tier-silver .premium-verified { color: #64748b; background: rgba(100, 116, 139, 0.1); }
.tier-bronze .premium-verified { color: #d97706; background: rgba(217, 119, 6, 0.1); }

/* Metallic Flare */
.premium-flare {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    110deg,
    transparent 30%,
    rgba(255, 255, 255, 0) 35%,
    rgba(255, 255, 255, 0.45) 50%,
    rgba(255, 255, 255, 0) 65%,
    transparent 70%
  );
  animation: shine-flare 5s infinite cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
  z-index: 10;
}

@keyframes shine-flare {
  0% { transform: translateX(0); }
  25% { transform: translateX(300%); }
  100% { transform: translateX(300%); }
}

/* FLOATING RESULTS BAR (HORIZONTAL SLIDER) */
.floating-results-bar {
  position: absolute;
  bottom: calc(var(--ion-safe-area-bottom, 0px) + 8px); /* Lowered position */
  left: 0;
  right: 0;
  z-index: 1000;
  pointer-events: none;
}

.horizontal-scroll-wrapper {
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 6px 0 6px;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  pointer-events: auto;
  scrollbar-width: none;
}

.horizontal-scroll-wrapper::-webkit-scrollbar {
  display: none;
}

.cards-track {
  display: flex;
  padding: 0 16px;
  gap: 12px;
}

.modern-location-card {
  flex: 0 0 85vw;
  max-width: 380px;
  margin: 0;
  /* Light Mode Base */
  background: rgba(255, 255, 255, 0.85); 
  backdrop-filter: blur(25px) saturate(200%);
  -webkit-backdrop-filter: blur(25px) saturate(200%);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
  border: 1px solid rgba(255, 255, 255, 0.5);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  position: relative;
  scroll-snap-align: center;
  scroll-snap-stop: always;
}

/* Dark Mode Base Case */
.ion-palette-dark .modern-location-card {
  background: rgba(28, 28, 30, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

@media (min-width: 768px) {
  .modern-location-card {
    flex: 0 0 350px;
  }
}

.card-inner {
  display: flex;
  height: var(--explore-card-height); 
}

.card-image-section {
  width: 110px;
  height: 100%;
  flex-shrink: 0;
  position: relative;
  background: var(--ion-background-color-step-100, #f0f0f0);
}

.card-image-section img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.floating-tier-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 5;
}

.tier-pill {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.65rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 4px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.tier-pill.gold { background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%); color: #451a03; }
.tier-pill.silver { background: linear-gradient(135deg, #94a3b8 0%, #475569 100%); color: #f8fafc; }
.tier-pill.bronze { background: linear-gradient(135deg, #b45309 0%, #78350f 100%); color: #fff; }

.card-info-section {
  flex: 1;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0; 
}

.title-text {
  margin: 0 0 4px 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--ion-color-dark);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.verified-badge {
  color: #3897f0; /* Instagram Blue */
  font-size: 1rem;
  filter: drop-shadow(0 0 2px rgba(56, 151, 240, 0.3));
  flex-shrink: 0;
  vertical-align: middle;
}

.metas {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  margin-bottom: 2px;
}

.meta {
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--ion-color-step-600, #666);
  white-space: nowrap;
  display: flex;
  align-items: center;
  align-self: flex-start;
}

.ion-palette-dark .meta { color: #d1d5db; }

.meta-dot { opacity: 0.5; }

.distance {
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--ion-color-carrot);
  margin-top: 2px;
}

.info-actions {
  margin-top: auto;
}

.action-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.action-icons {
  display: flex;
  align-items: center;
  gap: 4px;
}

.icon-btn {
  --padding-start: 6px;
  --padding-end: 6px;
  height: 32px;
  width: 32px;
  --border-radius: 50%;
  margin: 0;
}

.icon-btn ion-icon {
  font-size: 18px;
}

.tags-popover {
  --width: 200px;
}

.tags-popover ion-content {
  --padding-top: 8px;
  --padding-bottom: 8px;
}

.popover-tag-item {
  --padding-start: 12px;
  --min-height: 40px;
  font-size: 0.9rem;
  font-weight: 600;
}

.detail-btn {
  --padding-start: 12px;
  --padding-end: 12px;
  height: 32px;
  font-size: 0.8rem;
  font-weight: 800;
  background: rgba(var(--ion-color-carrot-rgb), 0.15);
  border-radius: 12px;
  margin: 0;
  letter-spacing: 0.05em;
}

.ion-palette-dark .detail-btn {
  --background: var(--ion-color-carrot);
  --color: #ffffff;
}

/* Tier Specific Overrides - ensure contrast in both modes */
.modern-location-card.tier-gold {
  background: linear-gradient(135deg, rgba(255, 251, 235, 0.9) 0%, rgba(254, 243, 199, 0.9) 100%) !important;
  border-color: rgba(251, 191, 36, 0.45) !important;
}
.modern-location-card.tier-gold .title-text { color: #451a03; }
.modern-location-card.tier-gold .meta { color: #713f12; }

/* Tiered Dark Mode Overrides */
.ion-palette-dark .modern-location-card.tier-gold {
  background: linear-gradient(135deg, rgba(66, 32, 6, 0.5) 0%, rgba(28, 28, 30, 0.8) 100%) !important;
  border-color: rgba(251, 191, 36, 0.3) !important;
}
.ion-palette-dark .modern-location-card.tier-gold .title-text { color: #fef3c7; }
.ion-palette-dark .modern-location-card.tier-gold .meta { color: #fde68a; }

.modern-location-card.tier-silver {
  background: linear-gradient(135deg, rgba(248, 250, 252, 0.9) 0%, rgba(226, 232, 240, 0.9) 100%) !important;
  border-color: rgba(148, 163, 184, 0.4) !important;
}
.modern-location-card.tier-silver .title-text { color: #0f172a; }

.modern-location-card.tier-bronze {
  background: linear-gradient(135deg, rgba(255, 251, 235, 0.9) 0%, rgba(255, 237, 213, 0.9) 100%) !important;
  border-color: rgba(180, 83, 9, 0.4) !important;
}
.modern-location-card.tier-bronze .title-text { color: #431407; }

/* Metallic Flare Animation */
.premium-flare {
  position: absolute;
  top: 0;
  left: -150%;
  width: 150%;
  height: 100%;
  background: linear-gradient(
    110deg,
    transparent 40%,
    rgba(255, 255, 255, 0.6) 50%,
    transparent 60%
  );
  animation: shine-flare 5s infinite cubic-bezier(0.42, 0, 0.58, 1);
  pointer-events: none;
  z-index: 10;
}

@keyframes shine-flare {
  0% { transform: translateX(0); }
  25% { transform: translateX(250%); }
  100% { transform: translateX(250%); }
}

.ion-palette-dark .premium-flare {
  background: linear-gradient(
    110deg,
    transparent 40%,
    rgba(255, 255, 255, 0.25) 50%,
    transparent 60%
  );
}

/* =========================
   NEW UI ELEMENTS (MODE TOGGLE & FAB)
========================= */
.map-floating-actions {
  position: absolute;
  bottom: calc(var(--ion-safe-area-bottom, 0px) + var(--explore-card-height) + 40px);
  right: 20px;
  z-index: 1001;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: bottom 0.3s ease;
}

.map-floating-actions.list-mode {
  bottom: calc(var(--ion-safe-area-bottom, 0px) + 20px);
}

.floating-action-btn {
  --color: var(--ion-color-carrot);
  --background: var(--ion-background-color);
  --border-radius: 50%;
  width: 48px;
  height: 48px;
  --box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  margin: 0;
}

.floating-action-btn ion-icon {
  font-size: 24px;
}

.filter-toggle-btn {
  position: relative;
}

.badge-count {
  position: absolute;
  top: -2px;
  right: -2px;
  background: #ff4d4d; /* More distinct red for the badge */
  color: white;
  font-size: 10px;
  min-width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-weight: 800;
  border: 2px solid white;
  z-index: 10;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  pointer-events: none;
}

/* Locating Status Badge */
.locating-status-badge {
  position: absolute;
  bottom: calc(var(--explore-card-height) + 12px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.9);
  padding: 8px 16px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13.5px;
  font-weight: 600;
  color: #c2410c; /* dark orange */
  box-shadow: 0 4px 15px rgba(0,0,0,0.12);
  z-index: 2000;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  pointer-events: none;
  animation: fadeIn 0.3s ease-out;
}

.ion-palette-dark .locating-status-badge {
  background: rgba(28, 28, 30, 0.85);
  color: #fdba74; /* light orange */
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background: var(--ion-color-carrot);
  border-radius: 50%;
  position: relative;
}

.pulse-dot::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 8px;
  height: 8px;
  background: var(--ion-color-carrot);
  border-radius: 50%;
  animation: pulse-ring 1.5s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite;
}

@keyframes pulse-ring {
  0% { transform: scale(0.7); opacity: 0.8; }
  80%, 100% { transform: scale(2.5); opacity: 0; }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translate(-50%, 10px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}

.list-view-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 800;
  background: var(--ion-background-color);
  padding-top: 140px; /* Default fallback */
  overflow-y: auto;
}

.list-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px 100px;
}

/* Card Tags */
.card-tags-row {
  display: flex;
  gap: 6px;
  margin-top: 6px;
  width: 100%;
}

.card-tags-row.horizontal-scroll {
  overflow-x: auto;
  flex-wrap: nowrap;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE/Edge */
  padding-bottom: 2px; /* Prevent shadow clipping */
}

.card-tags-row.horizontal-scroll::-webkit-scrollbar {
  display: none; /* Chrome/Safari */
}

.card-tag {
  font-size: 0.65rem;
  font-weight: 800;
  color: var(--ion-color-step-850, #1f2937);
  background: rgba(var(--ion-color-dark-rgb), 0.08); /* Darker gray background */
  padding: 3px 8px;
  border-radius: 6px;
  text-transform: lowercase;
  border: 1.5px solid rgba(var(--ion-color-dark-rgb), 0.1);
  letter-spacing: 0.01em;
}

.card-tag.highlight {
  background: rgba(var(--ion-color-carrot-rgb), 0.12);
  color: var(--ion-color-carrot);
  border-color: rgba(var(--ion-color-carrot-rgb), 0.25);
}

.ion-palette-dark .card-tag {
  background: rgba(255, 255, 255, 0.12);
  color: #d1d5db;
  border-color: rgba(255, 255, 255, 0.1);
}

.card-tag.more-tags {
  background: var(--ion-color-carrot);
  color: white;
  border-color: var(--ion-color-carrot);
}

.ion-palette-dark .card-tag.highlight {
  background: rgba(var(--ion-color-carrot-rgb), 0.2);
  color: var(--ion-color-carrot);
}


.list-header {
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(var(--ion-color-dark-rgb), 0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sort-btn-simple {
  --padding-start: 8px;
  --padding-end: 8px;
  height: 32px;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ion-color-medium);
  margin: 0;
}

.sort-btn-simple ion-icon {
  color: var(--ion-color-carrot);
  font-size: 18px;
}

.list-header h3 {
  font-size: 1.4rem;
  font-weight: 800;
  margin: 0;
  color: var(--ion-color-dark);
}

.vertical-cards-stack {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

@media (min-width: 768px) {
  .vertical-cards-stack {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .vertical-cards-stack {
    grid-template-columns: repeat(3, 1fr);
  }
}

.list-mode-card {
  flex: none !important;
  max-width: none !important;
  width: 100% !important;
}

.infinite-scroll-sentinel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px 0 60px;
  width: 100%;
  gap: 12px;
}

.infinite-scroll-sentinel .loading-text {
  font-size: 14px;
  color: var(--ion-color-medium);
  font-weight: 500;
}

.map-dimmed {
  filter: grayscale(0.5) blur(2px);
  opacity: 0.8;
}

/* Transitions */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(30px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(30px);
}

.empty-state {
  padding: 60px 20px;
  text-align: center;
  color: var(--ion-color-medium);
}

.empty-state ion-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.3;
}

/* =========================
   VIEW MODE SWITCH (BASE)
========================= */
.view-mode-switch {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  justify-content: center;

  padding: 6px;
  border-radius: 14px;
  background: var(--ion-background-color);

  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

  /* animation consistency */
  transition: transform 0.25s ease,
  opacity 0.2s ease;
}

/* =========================
   FLOATING (Map / Both)
========================= */
.view-mode-switch.floating {
  position: fixed;
  top: 150px; /* Below the search/category header */
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000; /* Above header */
}

/* =========================
   INLINE (List)
========================= */
.view-mode-switch.inline {
  position: relative;
  display: flex;
  justify-content: center;
  margin-bottom: 8px;

  background: transparent;
  box-shadow: none;
}

.view-mode-switch {
  will-change: transform, opacity;
}

.view-mode-fab {
  bottom: 92px; /* above tab bar */
  left: 12px;
  z-index: 30;
}

/* shrink FAB list spacing */
.view-mode-fab ion-fab-list {
  margin-bottom: 6px;
}

/* shared base */
.fab-right,
.view-mode-fab {
  position: fixed;
  z-index: 30;
  transition: bottom 0.35s cubic-bezier(.25, .8, .25, 1);
}

/* left FAB horizontal offset */
.view-mode-fab {
  left: 12px;
}

/* right FAB offset */
.fab-right {
  right: 20px;
}

/* MAP ONLY */
.fab-right.map,
.view-mode-fab.map {
  bottom: 5vh; /* above tab bar */
}

/* BOTH — panel collapsed */
.fab-right.panel-collapsed,
.view-mode-fab.panel-collapsed {
  bottom: 26vh;
}

/* BOTH — panel open */
.fab-right.panel-open,
.view-mode-fab.panel-open {
  bottom: 62vh;
}

.clear-chip {
  --background: rgba(255,255,255,0.08);
  --color: var(--ion-color-carrot);
  border: 1px dashed var(--ion-color-medium);
  border-radius: 100px;
  font-weight: 700;
  width: auto;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 38px;
  padding: 0 16px;
  margin: 0;
  background: var(--ion-background-color) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.floating-clear {
  border: 1px solid var(--ion-color-carrot) !important;
  color: var(--ion-color-carrot) !important;
  margin-left: 0;
  flex-shrink: 0;
}

.footer-count {
  text-align: center;
  padding: 3px 0;
  font-size: 14px;
  color: var(--ion-color-medium);
  background: transparent;
}


</style>

<style>
/*********************************************
 * CAMPUS RADIUS LABEL
 *********************************************/
.campus-radius-label {
  pointer-events: none;
  transform: translateY(-40px); /* Lift it above the center pin */
}

.walk-label-content {
  background: rgba(255, 255, 255, 0.9);
  padding: 8px 14px;
  border-radius: 18px;
  border: 2px solid #ef4444; /* red-500 equivalent */
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
}

.campus-title-small {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--ion-color-dark);
  opacity: 0.8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.walk-info-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ion-palette-dark .walk-label-content {
  background: rgba(28, 28, 30, 0.9);
  border-color: #f87171; /* red-400 */
  color: #fff;
}

.walk-icon {
  font-size: 1.1rem;
}

.walk-text {
  font-size: 0.8rem;
  font-weight: 800;
  color: #ef4444;
  letter-spacing: 0.02em;
}

.ion-palette-dark .walk-text {
  color: #f87171;
}
</style>

<style>
/* For You Info Card */
.for-you-info {
  margin: 0 16px 16px;
  border-radius: 12px;
  background: var(--ion-background-color);
  border: 1px solid rgba(var(--ion-color-carrot-rgb), 0.3);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.for-you-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.for-you-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.for-you-row > div {
  flex: 1;
  min-width: 0;
}

.for-you-row strong {
  display: block;
  font-size: 16px;
  color: var(--ion-text-color);
  margin-bottom: 4px;
}

.for-you-row p {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--ion-color-medium);
  line-height: 1.4;
}

/* Factor rows */
.for-you-factors {
  margin-top: 8px;
}

.factor-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}

.factor-row ion-icon {
  flex-shrink: 0;
}

.factor-label {
  font-size: 12px;
  color: var(--ion-color-medium);
  flex-shrink: 0;
}

.factor-values {
  font-size: 12px;
  color: var(--ion-text-color);
  font-weight: 500;
}

/* Dark mode support */
.ion-palette-dark .for-you-info {
  background: var(--ion-background-color);
  border-color: rgba(var(--ion-color-carrot-rgb), 0.4);
}

.ion-palette-dark .for-you-row strong {
  color: var(--ion-text-color);
}

.ion-palette-dark .for-you-row p {
  color: var(--ion-color-medium);
}

.ion-palette-dark .factor-values {
  color: var(--ion-text-color);
}

/* Responsive for small devices */
@media (max-width: 480px) {
  .factor-row {
    gap: 4px;
  }
  
  .factor-label,
  .factor-values {
    font-size: 11px;
  }
}
</style>

<style>
/* Force readable text colors for tiered cards in dark mode */

/* Force readable text colors for tiered cards in dark mode */
.ion-palette-dark .modern-location-card.tier-gold .title-text,
.ion-palette-dark .modern-location-card.tier-silver .title-text,
.ion-palette-dark .modern-location-card.tier-bronze .title-text {
  color: #ffffff !important;
}
</style>