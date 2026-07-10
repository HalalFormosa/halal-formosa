<template>
  <ion-page>
    <ion-header>
      <app-header :title="$t('home.title')" :showProfile="true" />
    </ion-header>

    <ion-content class="ion-padding">
      <!-- === Prayer Times Horizontal === -->
      <ion-card>
        <ion-card-header>
          <div class="prayer-header-row">
            <ion-card-title>
              <template v-if="nextPrayer && userLocation">
                <div class="prayer-title-main">
                  {{ $t('home.prayerNotification', { label: nextPrayer.label, time: upcomingCountdown }) }}
                </div>
                <div class="prayer-title-location">
                  <ion-icon :icon="locationOutline" slot="start" /> {{ userLocation.city || $t('home.currentLocation') }}
                </div>
              </template>
              <template v-else>
                {{ $t('home.prayerTimes') }}
              </template>
            </ion-card-title>

            <!-- 🧭 Find Qibla (header action) -->
            <div class="prayer-header-actions">
              <ion-button
                  size="small"
                  fill="clear"
                  color="carrot"
                  class="qibla-header-btn"
                  @click="handleRefreshLocation"
                  :disabled="loadingPrayerTimes"
              >
                <ion-icon :icon="locateOutline" />
              </ion-button>

              <ion-button
                  size="small"
                  fill="clear"
                  color="carrot"
                  class="qibla-header-btn"
                  @click="goQibla"
              >
                <ion-icon :icon="compassOutline" slot="start" />
                {{ $t('home.qibla') }}
              </ion-button>
            </div>
          </div>
        </ion-card-header>



        <ion-card-content>
          <!-- 🔹 Skeleton: Prayer pills -->
          <div
              v-if="loadingPrayerTimes"
              class="prayer-horizontal"
          >
            <div
                v-for="n in 5"
                :key="'prayer-skel-' + n"
                class="prayer-pill skeleton"
            >
              <ion-skeleton-text
                  animated
                  style="width: 50%; height: 12px; border-radius: 6px;"
              />
              <ion-skeleton-text
                  animated
                  style="width: 70%; height: 22px; margin-top: 6px; border-radius: 6px;"
              />
            </div>
          </div>

          <!-- 🔹 Skeleton: Qibla button -->
          <div
              v-if="loadingPrayerTimes"
              class="qibla-row"
          >
            <ion-skeleton-text
                animated
                style="width: 110px; height: 28px; border-radius: 999px;"
            />
          </div>

          <!-- 🔹 Real content -->
          <template v-else>
            <div
                class="prayer-horizontal"
                ref="prayerScroll"
            >
              <div class="prayer-track">
                <div
                    v-for="p in prayerList"
                    :key="p.key"
                    :data-key="p.key"
                    :class="[
  'prayer-pill',
  p.key === currentPrayerKey ? 'active' : ''
]"
                >
                  <span class="label">{{ p.label }}</span>
                  <span class="time">{{ p.time }}</span>
                </div>
              </div>
            </div>

          </template>
        </ion-card-content>

      </ion-card>



      <!-- === Main Feature: Scan === -->
      <ion-card class="main-feature-section clear-card">
        <div class="main-features-grid">
          <button class="feature-card feature-primary" @click="goScan">
            <div class="feature-icon-wrapper">
              <ion-icon :icon="scanOutline" />
            </div>
            <div class="feature-text">
              <h3>{{ $t('home.scan') }}</h3>
              <p>{{ $t('home.scanDesc') }}</p>
            </div>
            <div class="feature-bg-icon">
              <ion-icon :icon="scanOutline" />
            </div>
          </button>
          
          <button class="feature-card feature-secondary" @click="goToSearchAndScan">
            <div class="feature-icon-wrapper">
              <ion-icon :icon="barcodeOutline" />
            </div>
            <div class="feature-text">
              <h3>{{ $t('home.scanBarcode') }}</h3>
              <p>{{ $t('home.scanBarcodeDesc') }}</p>
            </div>
            <div class="feature-bg-icon">
              <ion-icon :icon="barcodeOutline" />
            </div>
          </button>
        </div>
      </ion-card>


      <!-- === Our Partner=== -->
      <ion-card>
        <ion-card-header>
          <div class="card-header-row">
            <ion-card-title>
              {{ $t('home.ourPartners') }}
            </ion-card-title>

            <ion-button
                fill="clear"
                size="small"
                color="carrot"
                @click="viewMorePartners"
            >
              {{ $t('home.viewMore') }}
            </ion-button>
          </div>
        </ion-card-header>

        <ion-card-content>
          <div v-if="loadingPartners" class="discover-grid compact-grid">
            <ion-card
                v-for="n in 5"
                :key="'partner-skel-' + n"
                class="discover-item discover-item--compact"
            >
              <ion-skeleton-text animated style="width:100%;height:120px;border-radius:12px;" />
              <ion-skeleton-text animated style="width:80%;height:14px;margin:6px auto;" />
            </ion-card>
          </div>

          <transition-group v-else name="partner-list" tag="div" class="discover-grid compact-grid">
            <ion-card
                v-for="partner in halalPartners"
                :key="partner.id"
                :class="[
  'discover-item',
  'discover-item--compact',
  partner.partner_tier ? 'tier-card-' + partner.partner_tier.toLowerCase() : ''
]"

                button
                @click="openPartner(partner)"
            >
              <ion-badge
                  v-if="partner.partner_tier"
                  :class="['tier-badge', partner.partner_tier.toLowerCase()]"
              >
              <ion-icon :icon="sparkles" />
              {{ $t('home.partnerTier', { tier: (partner.partner_tier || '').toUpperCase() }) }}
              </ion-badge>


              <img
                  :src="partner.logo"
                  :alt="partner.name"
                  class="discover-img discover-img--compact"
              />

              <ion-label class="discover-label discover-label--compact">
                <p class="discover-name">
                  {{ partner.name }}
                </p>
              </ion-label>
              <!-- Premium Flare for Gold/Silver -->
              <div v-if="['gold', 'silver'].includes(String(partner.partner_tier || '').toLowerCase())" class="premium-flare"></div>
            </ion-card>

          </transition-group>
        </ion-card-content>

      </ion-card>

      <!-- === Daily Missions === -->
      <LazySection placeholderHeight="120px" @load="isAuthenticated && fetchProgress()">
        <DailyMissions v-if="isAuthenticated" />
      </LazySection>


      <!-- === Discover Products === -->
      <ion-card>
        <ion-card-header>
          <div class="card-header-row">
            <ion-card-title>{{ $t('home.discoverProducts') }}</ion-card-title>
            <ion-button
                fill="clear"
                size="small"
                color="carrot"
                @click="viewMoreProducts"
            >
              {{ $t('home.viewMore') }}
            </ion-button>
          </div>
        </ion-card-header>

        <ion-card-content>
          <!-- 🔹 Skeleton loader -->
          <div v-if="loadingProducts" class="discover-grid">
            <ion-card v-for="n in 5" :key="'skeleton-p-' + n" class="discover-item">
              <ion-skeleton-text animated style="width: 100%; height: 140px; border-radius: 12px;" />
              <ion-skeleton-text animated style="width: 95%; height: 30px; margin: 6px auto;" />
              <ion-skeleton-text animated style="width: 40%; height: 12px; margin: 0 auto;" />
            </ion-card>
          </div>

          <!-- 🔹 Real content -->
          <div v-else class="discover-grid">
            <ion-card
                v-for="p in recentProducts"
                :key="p.barcode"
                :class="[
                  'discover-item', 
                  p.partner_tier ? 'tier-card-' + p.partner_tier.toLowerCase() : ''
                ]"
                button
                @click="openProduct(p)"
            >
              <!-- Tier Badge -->
              <ion-badge
                  v-if="p.partner_tier"
                  :class="['tier-badge', p.partner_tier.toLowerCase()]"
              >
                <ion-icon :icon="sparkles" />
                <span>{{ $t('home.partnerTier', { tier: (p.partner_tier || '').toUpperCase() }) }}</span>
              </ion-badge>

              <!-- Shine Effect (Gold ONLY) -->
              <div v-if="['gold', 'silver'].includes(String(p.partner_tier || '').toLowerCase())" class="premium-flare"></div>

              <img :src="p.image || 'https://placehold.co/200x200'" :alt="$t('home.altProduct')" class="discover-img" loading="lazy" />
              <ion-label class="discover-label">
                <div class="status-row">
                  <ion-chip
                      :class="p.status === 'Halal' ? 'chip-success'
                : p.status === 'Muslim-friendly' ? 'chip-primary'
                : p.status === 'Syubhah' ? 'chip-warning'
                : p.status === 'Haram' ? 'chip-danger'
                : 'chip-medium'"
                      style="font-size: 14px; margin-bottom: 4px;"
                  >
                    {{ $t('search.status.' + p.status) }}
                  </ion-chip>

                  <!-- Official Partner Tag -->
                  <div v-if="p.partner_tier" class="home-partner-verified">
                    <ion-icon :icon="shieldCheckmarkOutline" />
                  </div>
                </div>
                <p>{{ $t('home.added') }} {{ fromNowToTaipei(p.created_at) }}</p>
              </ion-label>
            </ion-card>
          </div>
        </ion-card-content>
      </ion-card>


      <!-- === Discover Locations === -->
      <LazySection placeholderHeight="200px" @load="fetchRecentLocations">
        <ion-card>
          <ion-card-header>
            <div class="card-header-row">
              <ion-card-title>{{ $t('home.discoverLocations') }}</ion-card-title>
              <ion-button
                  fill="clear"
                  size="small"
                  color="carrot"
                  @click="viewMoreLocations"
              >
                {{ $t('home.viewMore') }}
              </ion-button>
            </div>
          </ion-card-header>
          <ion-card-content>
            <div v-if="loadingLocations" class="discover-grid">
              <ion-card v-for="n in 5" :key="'skeleton-l-' + n" class="discover-item">
                <ion-skeleton-text animated style="width: 100%; height: 140px; border-radius: 12px;" />
                <ion-skeleton-text animated style="width: 90%; height: 12px; margin: 6px auto;" />
                <ion-skeleton-text animated style="width: 80%; height: 12px; margin: 6px auto;" />
                <ion-skeleton-text animated style="width: 40%; height: 12px; margin: 0 auto;" />
              </ion-card>
            </div>

          <div v-else class="discover-grid">
            <ion-card
                v-for="loc in recentLocations"
                :key="loc.id"
                :class="[
                  'discover-item', 
                  loc.partner_tier ? 'tier-card-' + loc.partner_tier.toLowerCase() : ''
                ]"
                button
                @click="openLocation(loc)"
            >
              <!-- Tier Badge -->
              <ion-badge
                  v-if="loc.partner_tier"
                  :class="['tier-badge', loc.partner_tier.toLowerCase()]"
              >
                <ion-icon :icon="sparkles" />
                <span>{{ $t('home.partnerTier', { tier: (loc.partner_tier || '').toUpperCase() }) }}</span>
              </ion-badge>

              <!-- Premium Flare for Gold/Silver -->
              <div v-if="['gold', 'silver'].includes(String(loc.partner_tier || '').toLowerCase())" class="premium-flare"></div>

              <img
                  :src="loc.image || 'https://placehold.co/200x200'"
                  :alt="$t('home.altLocation')"
                  class="discover-img"
                  loading="lazy"
              />
              <ion-label class="discover-label">
                <div class="name-row">
                  <h3>{{ loc.name }}</h3>
                  <!-- Official Partner Tag -->
                  <div v-if="loc.partner_tier" class="home-partner-verified">
                    <ion-icon :icon="shieldCheckmarkOutline" />
                  </div>
                </div>
                <p>{{ $t('home.added') }} {{ fromNowToTaipei(loc.created_at) }}</p>
              </ion-label>
            </ion-card>
          </div>
        </ion-card-content>
      </ion-card>
      </LazySection>

      <!-- === Discover Trips === -->
      <LazySection placeholderHeight="200px" @load="fetchTrips">
      <ion-card>
        <ion-card-header>
          <div class="card-header-row">
            <ion-card-title>{{ $t('home.discoverTrips') }}</ion-card-title>
            <ion-button
                fill="clear"
                size="small"
                color="carrot"
                @click="viewMoreTrips"
            >
              {{ $t('home.viewMore') }}
            </ion-button>
          </div>
        </ion-card-header>
        <ion-card-content>
          <div v-if="loadingTrips" class="discover-grid">
            <ion-card v-for="n in 5" :key="'skeleton-t-' + n" class="discover-item">
              <ion-skeleton-text animated style="width: 100%; height: 140px; border-radius: 12px;" />
              <ion-skeleton-text animated style="width: 90%; height: 12px; margin: 6px auto;" />
              <ion-skeleton-text animated style="width: 40%; height: 12px; margin: 0 auto;" />
            </ion-card>
          </div>

          <div v-else class="discover-grid">
            <ion-card
                v-for="trip in recentTrips"
                :key="trip.id"
                :class="[
                  'discover-item', 
                  trip.provider?.partner_tier ? 'tier-card-' + trip.provider.partner_tier.toLowerCase() : ''
                ]"
                button
                @click="openTrip(trip)"
            >
              <!-- Tier Badge -->
              <div v-if="trip.provider?.partner_tier" :class="['tier-badge', trip.provider.partner_tier.toLowerCase()]">
                <ion-icon :icon="sparkles" />
                <span>{{ $t('home.partnerTier', { tier: (trip.provider.partner_tier || '').toUpperCase() }) }}</span>
              </div>
              <div v-if="['gold', 'silver'].includes(String(trip.provider?.partner_tier || '').toLowerCase())" class="premium-flare"></div>

              <img :src="trip.cover_url || 'https://placehold.co/400x250?text=Trip'" class="discover-img" alt="trip" loading="lazy" />
              <ion-label class="discover-label">
                <h3 class="discover-name">{{ localized(trip.title_zh, trip.title) }}</h3>
                <p>{{ trip.duration }} • {{ trip.provider?.name }}</p>
              </ion-label>
            </ion-card>
          </div>
        </ion-card-content>
      </ion-card>
      </LazySection>

      <!-- === Store === -->
      <LazySection placeholderHeight="200px" @load="fetchMarketplaceProducts">
      <ion-card style="position: relative;">
        <div v-if="isUnderConstruction" class="test-phase-banner" style="margin: 12px 16px 0;">
          <ion-icon :icon="warningOutline" class="test-phase-icon" />
          <span style="font-size: 0.82rem;">{{ $t('store.testPhaseDisclaimer') }}</span>
        </div>
        <ion-card-header>
          <div class="card-header-row">
            <ion-card-title>{{ $t('home.marketplace') }}</ion-card-title>
            <ion-button
                fill="clear"
                size="small"
                color="carrot"
                @click="viewMoreMarketplace"
            >
              {{ $t('home.viewMore') }}
            </ion-button>
          </div>
        </ion-card-header>
        <ion-card-content>
          <div v-if="loadingMarketplace" class="discover-grid">
            <ion-card v-for="n in 5" :key="'skeleton-m-' + n" class="discover-item">
              <ion-skeleton-text animated style="width: 100%; height: 140px; border-radius: 12px;" />
              <ion-skeleton-text animated style="width: 80%; height: 12px; margin: 6px auto;" />
              <ion-skeleton-text animated style="width: 40%; height: 12px; margin: 0 auto;" />
            </ion-card>
          </div>

          <div v-else class="discover-grid">
            <ion-card
                v-for="p in marketplaceProducts"
                :key="p.id"
                class="discover-item"
                button
                @click="openMarketplaceProduct(p)"
            >
              <img :src="(p.images && p.images[0]) || 'https://placehold.co/200x200?text=Product'" class="discover-img" alt="product" loading="lazy" />
              <ion-label class="discover-label">
                <h3 class="discover-name">{{ localized(p.name_zh, p.name) }}</h3>
                <p class="marketplace-price">{{ $t('store.twd') }}{{ p.price?.toLocaleString() }}</p>
              </ion-label>
            </ion-card>
          </div>
        </ion-card-content>
      </ion-card>
      </LazySection>

      <!-- === Community Buzz (Instagram & TikTok) === -->
      <LazySection placeholderHeight="250px" @load="fetchCommunityReels">
      <ion-card class="reels-section">
        <ion-card-header>
          <div class="card-header-row">
            <ion-card-title class="section-title">{{ $t('home.whatsNew') || "What's New" }}</ion-card-title>
            <ion-button 
              fill="clear" 
              size="small" 
              color="carrot" 
              @click="handleViewMoreReels"
            >
              {{ $t('home.viewMore') }}
            </ion-button>
          </div>
          
        </ion-card-header>

        <CommunityReels 
          :reels="communityReels" 
          :loading="loadingReels" 
          mode="home" 
          @refresh-needed="handleReelsRefreshNeeded"
        />
      </ion-card>
      </LazySection>

      <!-- === Latest News === -->
      <LazySection placeholderHeight="200px" @load="fetchRecentNews">
      <ion-card>
        <ion-card-header>
          <div class="card-header-row">
            <ion-card-title>
              {{ $t('home.latestNews') }}
            </ion-card-title>

            <ion-button
                fill="clear"
                size="small"
                color="carrot"
                @click="viewMoreNews"
            >
              {{ $t('home.viewMore') }}
            </ion-button>
          </div>
        </ion-card-header>

        <ion-card-content>
          <!-- 🔹 Skeleton -->
          <div v-if="loadingNews" class="discover-grid">
            <ion-card
                v-for="n in 5"
                :key="'news-skeleton-' + n"
                class="discover-item"
            >
              <ion-skeleton-text animated style="width:100%;height:140px;border-radius:12px;" />
              <ion-skeleton-text animated style="width:90%;height:14px;margin:6px auto;" />
              <ion-skeleton-text animated style="width:60%;height:12px;margin:0 auto;" />
            </ion-card>
          </div>

          <!-- 🔹 Real News -->
          <div v-else class="discover-grid">
            <ion-card
                v-for="news in recentNews"
                :key="news.id"
                class="discover-item"
                button
                @click="openNews(news)"
            >
              <img
                  :src="news.cover || 'https://placehold.co/400x250?text=News'"
                  class="discover-img"
                  :alt="$t('home.altNews')"
                  loading="lazy"
              />

              <ion-label class="discover-label">
                <h3 class="discover-name">
                  {{ news.title }}
                </h3>

                <p style="font-size:12px;color:var(--ion-color-medium);">
                  {{ fromNowToTaipei(news.created_at) }}
                </p>
              </ion-label>
            </ion-card>
          </div>
        </ion-card-content>
      </ion-card>
      </LazySection>

      <!-- === Halal Card Feature === -->
      <ion-card>
        <ion-card-header>
          <div class="card-header-row">
            <ion-card-title>Halalify</ion-card-title>

            <ion-button
                fill="clear"
                size="small"
                color="carrot"
                @click="viewMorePhrases"
            >
              {{ $t('home.viewMore') }}
            </ion-button>
          </div>
        </ion-card-header>

        <ion-card-content>
          <div class="halal-phrases-scroller">
            <div
                v-for="(p, index) in displayedHomePhrases"
                :key="'phrase-' + index"
                :class="['phrase-card', 'animate__animated', 'animate__fadeIn', { 'locked-card': isPhrasePremium(p) && !isDonor }]"
                style="width: 100%; min-width: 100%; box-sizing: border-box;"
            >
              <div class="phrase-header">
                <span class="phrase-tag">Phrase {{ index + 1 }}</span>
                <div class="phrase-actions">
                  <ion-button
                      fill="clear"
                      size="small"
                      color="carrot"
                      class="phrase-action-btn"
                      @click="isPhrasePremium(p) && !isDonor ? presentRcPaywall() : toggleFavorite(p)"
                  >
                    <ion-icon slot="icon-only" :icon="isPhrasePremium(p) && !isDonor ? lockClosed : (isFavorite(p.chinese) ? star : starOutline)" />
                  </ion-button>
                  <ion-button
                      fill="clear"
                      size="small"
                      color="carrot"
                      class="phrase-action-btn"
                      @click="isPhrasePremium(p) && !isDonor ? presentRcPaywall() : copyPhrase(p.chinese)"
                  >
                    <ion-icon slot="icon-only" :icon="copyOutline" />
                  </ion-button>
                </div>
              </div>

              <div class="phrase-body">
                <h4 class="phrase-english">{{ getLocalizedExplanation(p) }}</h4>
                <template v-if="isPhrasePremium(p) && !isDonor">
                  <div class="locked-content-placeholder" @click="presentRcPaywall">
                    <ion-icon :icon="lockClosed" class="lock-placeholder-icon" />
                    <span class="lock-placeholder-text">Unlock Pro to see translation & pronunciation</span>
                  </div>
                </template>
                <template v-else>
                  <div class="phrase-chinese-row">
                    <div class="phrase-chinese-box">
                      <div class="phrase-chinese-segments">
                        <div
                            v-for="(seg, segIdx) in segmentPhrase(p)"
                            :key="segIdx"
                            class="chinese-segment"
                        >
                          <div class="chinese-segment-chars">
                            <span
                                v-for="(char, charIdx) in seg.text.split('')"
                                :key="charIdx"
                                :class="{ 'highlight-active': isCharHighlighted(p, seg.start + charIdx) }"
                                class="align-char"
                            >{{ char }}</span>
                          </div>
                          <span v-if="seg.gloss" class="segment-gloss">{{ seg.gloss }}</span>
                        </div>
                      </div>
                    </div>
                    <ion-button
                        fill="solid"
                        color="carrot"
                        class="play-btn"
                        :class="{ 'speaking': activeSpeechText === p.chinese }"
                        @click="playPhrase(p.chinese)"
                    >
                      <ion-icon slot="icon-only" :icon="activeSpeechText === p.chinese ? pauseCircleOutline : playCircleOutline" />
                    </ion-button>
                  </div>
                  <p class="phrase-pinyin">
                    <span class="label">Pinyin:</span>
                    <span
                        v-for="(word, wordIdx) in p.pinyin.split(' ')"
                        :key="wordIdx"
                        :class="{ 'highlight-active': isPinyinWordHighlighted(p, wordIdx) }"
                        style="margin-right: 4px;"
                    >{{ word.replace(/-/g, '') }}</span>
                  </p>
                  <p class="phrase-pronunciation">
                    <span class="label">Pronounce:</span> "{{ p.pronunciation }}"
                  </p>
                </template>
              </div>
            </div>
            <!-- Spacer to prevent the last card from being cropped -->
            <div class="scroller-spacer"></div>
          </div>
        </ion-card-content>
      </ion-card>


      <!-- === Insights Horizontal Scroll === -->
      <LazySection placeholderHeight="120px" @load="() => { fetchStats(); fetchLocationCategoryStats(); }">
      <div class="insights-container">
        <div class="insights-scroll">
          <!-- Card 1: Total Products -->
          <div class="insight-card stat-card" @click="router.push('/analytics/products')">
            <div class="stat-icon-wrapper products">
              <ion-icon :icon="sparkles" />
            </div>
            <div class="stat-content">
              <span class="stat-label">{{ $t('home.totalProducts') }}</span>
              <h2 class="stat-value">{{ totalProductCount }}</h2>
            </div>
            <ion-icon :icon="chevronForwardOutline" class="forward-icon" />
          </div>

          <!-- Card 2: Total Locations -->
          <div class="insight-card stat-card" @click="router.push('/analytics/locations')">
            <div class="stat-icon-wrapper locations">
              <ion-icon :icon="locationOutline" />
            </div>
            <div class="stat-content">
              <span class="stat-label">{{ $t('home.totalLocations') }}</span>
              <h2 class="stat-value">{{ totalLocationCount }}</h2>
            </div>
            <ion-icon :icon="chevronForwardOutline" class="forward-icon" />
          </div>
        </div>
      </div>
      </LazySection>

      <!-- === Leaderboard === -->
      <LazySection placeholderHeight="300px" @load="fetchLeaderboard(leaderboardType, 10)">
      <ion-card >
        <ion-card-header>
          <div class="card-header-row">
            <ion-card-title>{{ $t('home.leaderboard') }}</ion-card-title>
            <ion-button
                fill="clear"
                size="small"
                color="carrot"
                @click="router.push('/leaderboard')"
            >
              {{ $t('home.viewMore') }}
            </ion-button>
          </div>
        </ion-card-header>

        <ion-card-content>
          <!-- Segment control to toggle Daily / Weekly / Monthly / All Time -->
          <ion-segment :value="leaderboardType" @ionChange="changeLeaderboardType($event)" @click.stop mode="ios" class="ion-margin-bottom" style="margin: 0 auto 16px; width: fit-content; display: flex;">
            <ion-segment-button value="daily">
              <ion-label>{{ $t('home.leaderboardDaily') }}</ion-label>
            </ion-segment-button>
            <ion-segment-button value="weekly">
              <ion-label>{{ $t('home.leaderboardWeekly') }}</ion-label>
            </ion-segment-button>
            <ion-segment-button value="monthly">
              <ion-label>{{ $t('home.leaderboardMonthly') }}</ion-label>
            </ion-segment-button>
            <ion-segment-button value="all_time">
              <ion-label>{{ $t('home.leaderboardAllTime') }}</ion-label>
            </ion-segment-button>
          </ion-segment>
          <!-- 💡 Public Profile Hint Banner -->
          <div v-if="!isPublicProfile" class="leaderboard-hint-banner" @click="router.push('/settings')">
            <ion-icon :icon="sparkles" class="hint-icon" />
            <div class="hint-text">
              {{ $t('home.leaderboard_privacy_hint') || 'Want your name to be shown in the leaderboard? Go to settings and make your profile public.' }}
            </div>
            <ion-icon :icon="chevronForwardOutline" class="hint-arrow" />
          </div>

          <ion-list v-if="leaderboard.length > 0" class="leaderboard-list" :style="{ opacity: loadingLeaderboard ? 0.5 : 1, transition: 'opacity 0.2s ease', pointerEvents: loadingLeaderboard ? 'none' : 'auto' }">
            <ion-item
                v-for="(user, index) in leaderboard"
                :key="user.id"
                lines="none"
                button
                class="leaderboard-item"
                :style="getLeaderboardRowStyle(user)"
                @click="openUserProfile(user, $event)"
            >
              <!-- Rank -->
              <div slot="start" style="width: 24px; text-align: center; font-weight: 600; display: flex; align-items: center; justify-content: center; color: inherit; margin-right: 8px;">
                <ion-icon v-if="index === 0" :icon="medalOutline" style="color: #FFD700; font-size: 1.2rem;" />
                <ion-icon v-else-if="index === 1" :icon="medalOutline" style="color: #C0C0C0; font-size: 1.2rem;" />
                <ion-icon v-else-if="index === 2" :icon="medalOutline" style="color: #CD7F32; font-size: 1.2rem;" />
                <span v-else>{{ index + 1 }}</span>
              </div>

              <!-- Avatar with Cosmetics -->
              <div slot="start" class="leaderboard-avatar-cell" :style="getLeaderboardGlowStyle(user)" style="margin-right: 12px;">
                <ion-avatar style="width: 40px; height: 40px;" :style="getLeaderboardFrameStyle(user)">
                  <img
                      :src="(user.public_profile || currentUser?.id === user.id) ? (user.public_profile ? (user.avatar_url || 'https://placehold.co/64x64') : (currentUser?.user_metadata?.avatar_url || 'https://placehold.co/64x64')) : `https://placehold.co/64x64?text=${$t('home.unknownAvatar')}`"
                       :alt="$t('home.altAvatar')"
                       loading="lazy"/>
                </ion-avatar>
              </div>

              <!-- Info -->
              <ion-label style="min-width: 0; flex: 1; overflow: hidden; width: 0; margin-right: 8px;">
                <h2 style="margin: 0; font-weight: 600; font-size: 1rem; display: flex; align-items: center; gap: 6px; color: inherit; min-width: 0; overflow: hidden; width: 100%;">
                  <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; color: inherit;">
                    {{ formatDisplayName(currentUser?.id === user.id && !user.public_profile ? (currentUser?.user_metadata?.full_name || currentUser?.user_metadata?.display_name || 'Me') : user.display_name) }}
                  </span>
                  <span v-if="user.donor_type && user.donor_type.toLowerCase().includes('pro')" class="list-pro-badge">
                    <ion-icon :icon="sparkles" style="font-size: 0.7rem; margin-right: 2px;" />
                    PRO
                  </span>
                  <ion-badge v-if="currentUser?.id === user.id && !user.public_profile" color="medium" style="font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; flex-shrink: 0;" @click="showPrivateInfoAlert($event)">Private</ion-badge>
                </h2>
                <p style="margin: 0; font-size: 0.8rem; color: var(--sub-color, var(--ion-color-medium));">
                  {{ $t('profile.level', { level: getLevelFromPoints(user.total_points || user.points) }) }}
                </p>
              </ion-label>

              <!-- Points Badge -->
              <ion-badge
                  slot="end"
                  :color="getLevelColor(user.points)"
                  class="leaderboard-points-badge"
              >
                {{ $t('home.pointsCount', { points: user.points }) }}
              </ion-badge>
            </ion-item>
          </ion-list>

          <!-- 📭 Empty state for Home Leaderboard -->
          <div v-if="!loadingLeaderboard && leaderboard.length === 0" class="home-leaderboard-empty">
            <p class="empty-title">{{ leaderboardType === 'daily' ? $t('home.leaderboardHomeEmptyDaily') : leaderboardType === 'weekly' ? $t('home.leaderboardHomeEmptyWeekly') : $t('search.noResults') }}</p>
            <p class="empty-tip">{{ $t('home.leaderboardEmptyDailyDesc') }}</p>
            
            <div class="empty-actions-grid">
              <ion-button size="small" fill="outline" color="carrot" @click="router.push('/scan')">
                <ion-icon :icon="scanOutline" slot="start" />
                {{ locale.startsWith('zh') ? '掃描' : 'Scan' }}
              </ion-button>
              <ion-button size="small" fill="outline" color="carrot" @click="router.push('/add')">
                <ion-icon :icon="addOutline" slot="start" />
                {{ locale.startsWith('zh') ? '新增產品' : 'Add Product' }}
              </ion-button>
              <ion-button size="small" fill="outline" color="carrot" @click="router.push('/explore/add')">
                <ion-icon :icon="locationOutline" slot="start" />
                {{ locale.startsWith('zh') ? '新增地點' : 'Add Place' }}
              </ion-button>
            </div>
          </div>
        </ion-card-content>
      </ion-card>
      </LazySection>
    </ion-content>

    <!-- 👇 Popover instead of modal -->
    <ion-popover
        :is-open="!!selectedUser"
        :event="popoverEvent"
        class="leaderboard-popover"
        :style="getPopoverCardVariables(selectedUser)"
        @didDismiss="closePopover"
    >
      <ion-content class="ion-padding popover-custom-content" style="text-align:center; min-width: 250px;" :style="getPopoverContentStyle(selectedUser)" :class="{ 'is-light-bg': isBackgroundLight(getCosmeticByCategory(selectedUser, 'background')) }">
        <div v-if="selectedUser" style="position: relative;">
          <!-- Aura backdrop layer -->
          <div v-if="getCosmeticByCategory(selectedUser, 'aura')" class="popover-aura-backdrop" :style="getPopoverAuraStyle(selectedUser)"></div>

          <div style="position: relative; z-index: 1;">
            <!-- ✅ Public profile shown or is current logged-in user -->
            <template v-if="selectedUser.public_profile || currentUser?.id === selectedUser.id">
              <div class="popover-cosmetic-wrapper" :style="getPopoverGlowStyle(selectedUser)">
                <ion-avatar style="width:72px;height:72px;margin:0;" :style="getPopoverFrameStyle(selectedUser)">
                  <img :src="(selectedUser.public_profile ? selectedUser.avatar_url : currentUser?.user_metadata?.avatar_url) || 'https://placehold.co/72px?text=?'"  :alt="$t('home.altAvatar')"/>
                </ion-avatar>
              </div>

            <div v-if="selectedUser.donor_type && selectedUser.donor_type.toLowerCase().includes('pro')" class="mock-popover-pro-badge">
              <ion-icon :icon="sparkles" class="pro-icon" />
              <span>Pro</span>
            </div>

            <div v-if="currentUser?.id === selectedUser.id && !selectedUser.public_profile" style="margin-bottom: 8px;">
              <ion-badge color="medium" style="font-size: 0.7rem; padding: 4px 8px; border-radius: 12px;" @click="showPrivateInfoAlert($event)">
                Private
              </ion-badge>
            </div>

            <h3 class="mock-popover-name">
              <span>
                {{ selectedUser.public_profile ? selectedUser.display_name : (currentUser?.user_metadata?.full_name || currentUser?.user_metadata?.display_name || 'Me') }}
              </span>
            </h3>

            <p class="mock-popover-stats">
              {{ $t('profile.level', { level: getLevelFromPoints(selectedUser.total_points || selectedUser.points) }) }} • 
              <ion-badge
                class="leaderboard-points-badge"
                style="margin-left: 4px; border-radius: 8px; font-weight: bold; font-size: 0.75rem; padding: 4px 8px; display: inline-block; vertical-align: middle;"
              >
                {{ selectedUser.points }} pts
              </ion-badge>
            </p>

            <!-- Stats Grid -->
            <div class="mock-popover-grid">
              <div class="grid-col">
                <div class="grid-label">{{ $t('home.productsCount') }}</div>
                <div class="grid-val">{{ selectedUser.product_count || 0 }}</div>
              </div>
              <div class="grid-col">
                <div class="grid-label">{{ $t('home.locationsCount') }}</div>
                <div class="grid-val">{{ selectedUser.location_count || 0 }}</div>
              </div>
            </div>

            <p v-if="selectedUser.bio" class="mock-popover-bio">
              "{{ selectedUser.bio }}"
            </p>
          </template>

          <!-- ❌ No public profile: only show XP and basic stats -->
          <template v-else>
            <ion-avatar style="width:72px;height:72px;margin:12px auto 8px; border: 2px solid var(--ion-color-step-200);">
               <div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background: var(--ion-color-step-100); color: var(--ion-color-step-400); font-size: 24px; font-weight: 800;">?</div>
            </ion-avatar>

            <h3 class="mock-popover-name" style="color: var(--ion-color-medium);">
              <span>
                {{ selectedUser.display_name }}
              </span>
            </h3>

            <p class="mock-popover-stats">
              {{ $t('profile.level', { level: getLevelFromPoints(selectedUser.total_points || selectedUser.points) }) }} • 
              <ion-badge
                class="leaderboard-points-badge"
                style="margin-left: 4px; border-radius: 8px; font-weight: bold; font-size: 0.75rem; padding: 4px 8px; display: inline-block; vertical-align: middle;"
              >
                {{ selectedUser.points }} pts
              </ion-badge>
            </p>

            <!-- Stats for Anonymous -->
            <div class="mock-popover-grid">
              <div class="grid-col">
                <div class="grid-label">{{ $t('home.productsCount') }}</div>
                <div class="grid-val">{{ selectedUser.product_count || 0 }}</div>
              </div>
              <div class="grid-col">
                <div class="grid-label">{{ $t('home.locationsCount') }}</div>
                <div class="grid-val">{{ selectedUser.location_count || 0 }}</div>
              </div>
            </div>
          </template>
          </div>
        </div>
      </ion-content>
    </ion-popover>

    <!-- 📢 Bottom Sheet Announcement Modal -->
    <ion-modal
      :is-open="showAnnouncement && !!announcement"
      @didDismiss="dismissAnnouncement"
      :initial-breakpoint="0.75"
      :breakpoints="[0, 0.5, 0.75, 0.95]"
      class="announcement-sheet"
    >
      <ion-header>
        <ion-toolbar>
          <ion-title>{{ announcement ? announcement.title : '' }}</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="dismissAnnouncement">
              <ion-icon :icon="closeOutline" />
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <div v-if="announcement && announcement.image_url" class="announcement-hero-wrapper">
          <img :src="announcement.image_url" class="announcement-hero-img" alt="announcement image" />
        </div>
        <div v-if="announcement" class="announcement-html-body" v-html="announcement.content"></div>
        <div class="announcement-actions">
          <ion-button v-if="announcement && announcement.link_url" expand="block" fill="outline" color="carrot" @click="handleBannerClick" class="learn-more-btn ion-margin-bottom">
            {{ $t('home.viewMore') || 'Learn More' }}
          </ion-button>
          <ion-button expand="block" color="carrot" @click="dismissAnnouncement" class="got-it-btn">
            {{ $t('scanIngredients.details.gotIt') || 'Got It' }}
          </ion-button>
        </div>
      </ion-content>
    </ion-modal>

  </ion-page>
</template>

<script setup lang="ts">
/* ---------------- Imports ---------------- */
import {ref, nextTick, computed, onBeforeUnmount, watch, onMounted} from 'vue'
import { useI18n } from 'vue-i18n'
import {
  IonPage, IonContent, IonCard, IonCardHeader, IonCardTitle,
  IonCardContent, IonButton, IonIcon, IonHeader, onIonViewWillEnter, IonLabel, IonChip, IonSkeletonText,
  IonList, IonBadge, IonAvatar, IonItem, IonPopover, IonModal, IonToolbar, IonTitle, IonButtons,
  IonSegment, IonSegmentButton, alertController, toastController, IonSelect, IonSelectOption
} from '@ionic/vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/plugins/supabaseClient'
import AppHeader from "@/components/AppHeader.vue"
import relativeTime from 'dayjs/plugin/relativeTime'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import {
  barcodeOutline,
  locationOutline,
  scanOutline,
  compassOutline,
  medalOutline,
  sparkles,
  closeOutline,
  shieldCheckmarkOutline,
  locateOutline,
  cartOutline,
  constructOutline,
  chevronForwardOutline,
  warningOutline,
  addOutline,
  copyOutline,
  bookOutline,
  volumeMediumOutline,
  star,
  starOutline,
  playCircleOutline,
  pauseCircleOutline,
  lockClosed
} from "ionicons/icons"
import { useLeaderboard } from "@/composables/useLeaderboard";
import {getLevelColor} from "@/composables/useLevels";
import {getLevelFromPoints} from "@/utils/xp";
import {formatDisplayName} from "@/utils/nameHelpers";
import { isPublicProfile, currentUser } from '@/composables/userProfile';
import {ActivityLogService} from "@/services/ActivityLogService";
import {SocialMediaService} from "@/services/SocialMediaService";
import { isDonor, refreshSubscriptionStatus } from "@/composables/useSubscriptionStatus";
import { RevenueCatUI, PAYWALL_RESULT } from '@revenuecat/purchases-capacitor-ui';
import {Capacitor} from "@capacitor/core";
import { Geolocation } from '@capacitor/geolocation'
import { Browser } from '@capacitor/browser'
import { PrayTime } from 'praytime'
import { useLocation, type LatLng } from '@/composables/useLocation'
import { useHomeData } from '@/composables/useHomeData'
import LazySection from '@/components/LazySection.vue'
import DailyMissions from "@/components/DailyMissions.vue"
import { useDailyMissions } from '@/composables/useDailyMissions'

const { withCache } = useHomeData()
const { userLocation: sharedLocation, startWatching } = useLocation()
const { t, te, locale } = useI18n()

/* ---------------- Halal Card Feature ---------------- */
const activeSpeechText = ref<string | null>(null)
const availableVoices = ref<SpeechSynthesisVoice[]>([])
const selectedVoiceName = ref<string>('')

const currentSpeechCharIndex = ref(-1)
const currentSpeechCharLength = ref(0)

function segmentPhrase(phrase: HalalifyPhrase): Array<{ text: string; gloss: string; start: number }> {
  if (!phrase.alignments || phrase.alignments.length === 0) {
    return phrase.chinese.split('').map((char, idx) => ({ text: char, gloss: '', start: idx }))
  }

  const currentLang = (locale.value || 'en').split('-')[0].toLowerCase()
  const segments: Array<{ text: string; gloss: string; start: number }> = []
  const matchedRanges: Array<{ start: number; end: number }> = []
  const sortedAlignments = [...phrase.alignments].sort((a, b) => (b.zh?.length || 0) - (a.zh?.length || 0))
  
  for (const align of sortedAlignments) {
    if (!align.zh) continue
    let pos = phrase.chinese.indexOf(align.zh)
    while (pos !== -1) {
      const end = pos + align.zh.length
      const overlap = matchedRanges.some(r => (pos >= r.start && pos < r.end) || (end > r.start && end <= r.end))
      if (!overlap) {
        matchedRanges.push({ start: pos, end })
        const glossWord = align[currentLang] || align['en'] || ''
        segments.push({
          text: align.zh,
          gloss: glossWord,
          start: pos
        })
      }
      pos = phrase.chinese.indexOf(align.zh, pos + 1)
    }
  }
  
  for (let i = 0; i < phrase.chinese.length; i++) {
    const isMapped = matchedRanges.some(r => i >= r.start && i < r.end)
    if (!isMapped) {
      segments.push({
        text: phrase.chinese[i],
        gloss: '',
        start: i
      })
    }
  }
  
  segments.sort((a, b) => a.start - b.start)
  return segments
}

function isCharHighlighted(phrase: HalalifyPhrase, charIdx: number): boolean {
  if (activeSpeechText.value !== phrase.chinese) return false
  return charIdx >= currentSpeechCharIndex.value && 
         charIdx < (currentSpeechCharIndex.value + currentSpeechCharLength.value)
}

function getCleanIndex(text: string, rawCharIdx: number): number {
  let cleanIdx = 0
  for (let i = 0; i < rawCharIdx; i++) {
    const char = text[i]
    if (char && !/[，。？、！；：()[\]{}""'',.!?／]/.test(char)) {
      cleanIdx++
    }
  }
  return cleanIdx
}

function isPinyinWordHighlighted(phrase: any, wordIdx: number): boolean {
  if (activeSpeechText.value !== phrase.chinese) return false
  
  const pinyinWords = phrase.pinyin.split(' ')
  let charStart = 0
  for (let i = 0; i < wordIdx; i++) {
    const word = pinyinWords[i]
    const syllableCount = word.split('-').length
    charStart += syllableCount
  }
  
  const currentWord = pinyinWords[wordIdx]
  const syllableCount = currentWord.split('-').length
  const charEnd = charStart + syllableCount
  
  const cleanSpeakStart = getCleanIndex(phrase.chinese, currentSpeechCharIndex.value)
  const cleanSpeakEnd = cleanSpeakStart + currentSpeechCharLength.value
  
  return cleanSpeakStart < charEnd && cleanSpeakEnd > charStart
}


function getLocalizedExplanation(p: any): string {
  const currentLang = (locale.value || 'en').split('-')[0].toLowerCase()
  if (p && p.translations) {
    if (p.translations[locale.value]) return p.translations[locale.value]
    if (p.translations[currentLang]) return p.translations[currentLang]
  }
  return p ? p.english : ''
}

import { useHalalifyFavorites } from '@/composables/useHalalifyFavorites'
import { useHalalifyPhrases } from '@/composables/useHalalifyPhrases'
import type { HalalifyPhrase } from '@/data/halalifyPhrases'

const { phrases, initPhrases } = useHalalifyPhrases()
const { favorites, loadFavorites, toggleFavorite, isFavorite } = useHalalifyFavorites()

const displayedHomePhrases = computed(() => {
  if (favorites.value.length > 0) {
    return favorites.value.map(fav => {
      const latest = phrases.value.find(p => p.chinese === fav.chinese)
      return latest || fav
    })
  }
  return phrases.value.slice(0, 5)
})

function getFriendlyVoiceName(voice: SpeechSynthesisVoice): string {
  const nameLower = voice.name.toLowerCase()
  if (nameLower.includes('meijia') || nameLower.includes('mei-jia')) {
    return 'Meijia (Taiwan Female)'
  }
  if (nameLower.includes('tingting') || nameLower.includes('ting-ting')) {
    return 'Tingting (Mainland Female)'
  }
  if (voice.default) {
    return 'Latest Voice (System Default)'
  }
  return voice.name.split('(')[0].replace('Microsoft', '').replace('Google', '').trim() + ' (' + voice.lang + ')'
}

function loadVoices() {
  if ('speechSynthesis' in window) {
    const voices = window.speechSynthesis.getVoices()
    
    // Filter to retain only Meijia and Tingting
    const rawFiltered = voices.filter(v => {
      const nameLower = v.name.toLowerCase()
      const langLower = v.lang.toLowerCase()
      
      if (!langLower.startsWith('zh')) return false
      
      const isMeijia = nameLower.includes('meijia') || nameLower.includes('mei-jia')
      const isTingting = nameLower.includes('tingting') || nameLower.includes('ting-ting')
      
      return isMeijia || isTingting
    })
    
    // De-duplicate voices by name
    const seen = new Set<string>()
    const uniqueVoices = rawFiltered.filter(v => {
      if (seen.has(v.name)) return false
      seen.add(v.name)
      return true
    })
    
    // Always guarantee we have at least one fallback if somehow the filter was too aggressive
    availableVoices.value = uniqueVoices.length > 0 ? uniqueVoices : voices.filter(v => v.lang.toLowerCase().startsWith('zh'))
    
    if (availableVoices.value.length > 0) {
      if (!selectedVoiceName.value) {
        // Pre-select Meijia, default or first
        const preferred = availableVoices.value.find(v => v.name.toLowerCase().includes('meijia')) 
                       || availableVoices.value.find(v => v.default) 
                       || availableVoices.value[0]
        selectedVoiceName.value = preferred.name
      }
    }
  }
}

function getWordLengthAt(phrase: any, cleanIdx: number): number {
  const pinyinWords = phrase.pinyin.split(' ')
  let charStart = 0
  for (let i = 0; i < pinyinWords.length; i++) {
    const word = pinyinWords[i]
    const syllableCount = word.split('-').length
    const charEnd = charStart + syllableCount
    if (cleanIdx >= charStart && cleanIdx < charEnd) {
      return syllableCount
    }
    charStart = charEnd
  }
  return 1
}

function playPhrase(text: string) {
  if ('speechSynthesis' in window) {
    if (activeSpeechText.value === text) {
      window.speechSynthesis.cancel()
      activeSpeechText.value = null
      currentSpeechCharIndex.value = -1
      currentSpeechCharLength.value = 0
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    
    const chosenVoice = availableVoices.value.find(v => v.name === selectedVoiceName.value)
    if (chosenVoice) {
      utterance.voice = chosenVoice
      utterance.lang = chosenVoice.lang
    } else {
      utterance.lang = 'zh-TW'
    }
    
    utterance.rate = 0.75 // Slightly slower for maximum legibility and clarity
    utterance.onstart = () => {
      activeSpeechText.value = text
      currentSpeechCharIndex.value = -1
      currentSpeechCharLength.value = 0
    }
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        currentSpeechCharIndex.value = event.charIndex
        const phraseObj = phrases.value.find(pr => pr.chinese === text)
        if (phraseObj) {
          const cleanIdx = getCleanIndex(text, event.charIndex)
          currentSpeechCharLength.value = getWordLengthAt(phraseObj, cleanIdx)
        } else {
          currentSpeechCharLength.value = event.charLength || 1
        }
      }
    }
    utterance.onend = () => {
      setTimeout(() => {
        if (activeSpeechText.value === text) {
          activeSpeechText.value = null
          currentSpeechCharIndex.value = -1
          currentSpeechCharLength.value = 0
        }
      }, 500)
    }
    utterance.onerror = () => {
      activeSpeechText.value = null
      currentSpeechCharIndex.value = -1
      currentSpeechCharLength.value = 0
    }
    window.speechSynthesis.speak(utterance)
  }
}

function isCategoryPremium(catId: string): boolean {
  return catId !== 'all' && catId !== 'favorites' && catId !== 'dining'
}

function isPhrasePremium(p: HalalifyPhrase): boolean {
  if (p.catId !== 'dining') return true
  return p.id ? (p.id > 5) : false
}

async function presentRcPaywall() {
  if (!Capacitor.isNativePlatform()) {
    if (import.meta.env.DEV) {
      console.warn("[RC] Paywall can only run on native apps.");
      const alert = await alertController.create({
        header: 'DEV Bypass',
        message: 'Unlock Pro features for local testing?',
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Unlock',
            handler: () => {
              isDonor.value = true
              localStorage.setItem("user_pro_status", "true")
            }
          }
        ]
      })
      await alert.present()
    } else {
      const isZh = (locale.value || '').startsWith('zh')
      const headerText = isZh ? 'Halalify Pro 功能' : 'Halalify Pro Feature'
      const messageText = isZh 
        ? '單字翻譯、拼音發音拆解及語音播放功能僅在行動應用程式中提供。請在 iOS 或 Android 下載 Halal Formosa 以解鎖 Pro 專業版。' 
        : 'Word-by-word translations, pronunciation breakdowns, and audio playback are only available in our mobile app. Please download Halal Formosa on iOS or Android to unlock Pro.'
      
      const alert = await alertController.create({
        header: headerText,
        message: messageText,
        buttons: ['OK']
      })
      await alert.present()
    }
    return;
  }

  try {
    const { result } = await RevenueCatUI.presentPaywall();
    if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
      await refreshSubscriptionStatus({ syncToServer: true });
      ActivityLogService.log('pro_purchase_success', {
        source: 'home_view_halalify'
      });
    }
  } catch (err) {
    console.error("Paywall failed:", err);
  }
}

async function copyPhrase(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    const toast = await toastController.create({
      message: 'Copied Chinese phrase to clipboard!',
      duration: 2000,
      position: 'bottom',
      color: 'success'
    })
    await toast.present()
  } catch (err) {
    console.error('Failed to copy', err)
  }
}

/* ---------------- Community Reels (Instagram & TikTok) ---------------- */
const communityReels = ref<any[]>([])
const loadingReels = ref(true)

const fetchCommunityReels = async () => {
  loadingReels.value = true
  try {
    const data = await withCache('community_reels', async () => {
      // 📸 Fetch Instagram
      const { data: igData, error: igError } = await supabase
        .from('instagram_posts')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(10)

      // 🎵 Fetch TikTok
      const { data: ttData, error: ttError } = await supabase
        .from('tiktok_posts')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(10)

      if (igError) console.error('IG Fetch Error:', igError)
      if (ttError) console.error('TikTok Fetch Error:', ttError)

      // 🔀 Merge and Sort by deduplicating
      return SocialMediaService.mergeSocialPosts(igData, ttData)
    })
    communityReels.value = data
  } catch (err) {
    console.error('Error fetching community reels:', err)
  } finally {
    loadingReels.value = false
  }
}

// 🔄 Auto-Refresh Logic for Instagram
const isRefreshingInstagram = ref(false)
const lastRefreshTime = ref(0)
const REFRESH_THROTTLE = 1000 * 60 * 30 // 30 minutes throttle

async function handleReelsRefreshNeeded() {
  const now = Date.now()
  
  if (isRefreshingInstagram.value || (now - lastRefreshTime.value < REFRESH_THROTTLE)) {
    return
  }

  isRefreshingInstagram.value = true
  console.log('[Home] Social media links expired. Triggering background refresh...')

  try {
    // 🌐 Refresh both in parallel
    await Promise.allSettled([
      supabase.functions.invoke('fetch-instagram'),
      supabase.functions.invoke('fetch-tiktok')
    ])
    
    lastRefreshTime.value = Date.now()
    await fetchCommunityReels()
    console.log('[Home] Social media refresh complete.')
  } catch (err) {
    console.error('[Home] Failed to refresh social media links:', err)
  } finally {
    isRefreshingInstagram.value = false
  }
}

let timeInterval: number | null = null

import CommunityReels from "@/components/CommunityReels.vue"

// ✅ Cosmetic helpers for leaderboard
function getCosmeticByCategory(user: any, category: string) {
  return user?.equipped_cosmetics?.find((c: any) => c.category === category)
}

function getLeaderboardGlowStyle(user: any) {
  const glow = getCosmeticByCategory(user, 'glow')
  const aura = getCosmeticByCategory(user, 'aura')
  const styles: Record<string, string> = { margin: '0 10px', position: 'relative' }
  if (glow?.css_value?.boxShadow) styles.boxShadow = glow.css_value.boxShadow
  if (glow?.css_value?.animation) styles.animation = glow.css_value.animation
  if (aura?.css_value?.background) styles.background = aura.css_value.background
  if (aura?.css_value?.animation && !glow?.css_value?.animation) styles.animation = aura.css_value.animation
  return styles
}

function getLeaderboardFrameStyle(user: any) {
  const frame = getCosmeticByCategory(user, 'frame')
  const outline = getCosmeticByCategory(user, 'outline')
  const styles: Record<string, string> = {}
  if (frame?.css_value?.border) styles.border = frame.css_value.border
  if (frame?.css_value?.boxShadow) styles.boxShadow = frame.css_value.boxShadow
  if (outline?.css_value?.border) styles.border = outline.css_value.border
  return styles
}

function getLeaderboardRowStyle(user: any) {
  const np = getCosmeticByCategory(user, 'background')
  const styles: Record<string, string> = {}
  if (np?.css_value?.background) {
    styles['--background'] = np.css_value.background
    styles.background = np.css_value.background
    
    const isLight = isBackgroundLight(np)
    const textColor = isLight ? '#121212' : '#ffffff'
    const subTextColor = isLight ? '#444444' : 'rgba(255, 255, 255, 0.7)'
    
    styles['--color'] = textColor
    styles.color = textColor
    styles['--sub-color'] = subTextColor
    styles['--ion-text-color'] = textColor
    
    if (np.css_value.animation) styles.animation = np.css_value.animation
    if (np.css_value.backgroundSize) styles.backgroundSize = np.css_value.backgroundSize
  }
  return styles
}

function getPopoverGlowStyle(user: any) {
  if (!user) return {}
  const glow = getCosmeticByCategory(user, 'glow')
  const styles: Record<string, string> = {}
  if (glow?.css_value?.boxShadow) styles.boxShadow = glow.css_value.boxShadow
  if (glow?.css_value?.animation) styles.animation = glow.css_value.animation
  return styles
}

function getPopoverAuraStyle(user: any) {
  if (!user) return {}
  const aura = getCosmeticByCategory(user, 'aura')
  if (!aura?.css_value?.background) return {}
  const styles: Record<string, string> = {
    background: aura.css_value.background
  }
  if (aura.css_value.animation) styles.animation = aura.css_value.animation
  return styles
}

function getPopoverFrameStyle(user: any) {
  const frame = getCosmeticByCategory(user, 'frame')
  const styles: Record<string, string> = { border: '2px solid var(--ion-color-primary-tint)' }
  if (frame?.css_value?.border) styles.border = frame.css_value.border
  if (frame?.css_value?.boxShadow) styles.boxShadow = frame.css_value.boxShadow
  return styles
}

function getPopoverContentStyle(user: any) {
  if (!user) return {}
  const bg = getCosmeticByCategory(user, 'background')
  const styles: Record<string, string> = {}
  
  if (bg?.css_value?.background) {
    if (bg.css_value.color) {
      styles['--color'] = bg.css_value.color
      styles.color = bg.css_value.color
    } else {
      const isLight = isBackgroundLight(bg)
      const textColor = isLight ? '#121212' : '#ffffff'
      styles['--color'] = textColor
      styles.color = textColor
    }
    if (bg.css_value.animation) styles.animation = bg.css_value.animation
    if (bg.css_value.backgroundSize) styles.backgroundSize = bg.css_value.backgroundSize
  }
  return styles
}

function getPopoverCardVariables(user: any) {
  if (!user) return {}
  const bg = getCosmeticByCategory(user, 'background')
  const outline = getCosmeticByCategory(user, 'outline')
  const styles: Record<string, string> = {}
  
  if (bg?.css_value?.background) {
    styles['--leaderboard-popover-bg'] = bg.css_value.background
  }
  if (outline?.css_value) {
    if (outline.css_value.border) {
      styles['--leaderboard-popover-border'] = outline.css_value.border
    }
    if (outline.css_value.borderImage) {
      styles['--leaderboard-popover-border-image'] = outline.css_value.borderImage
    }
    if (outline.css_value.animation) {
      styles['--leaderboard-popover-animation'] = outline.css_value.animation
    }
  }
  return styles
}

function isBackgroundLight(cosmetic?: any | null): boolean {
  if (!cosmetic) return false
  const slug = cosmetic.slug?.toLowerCase() || cosmetic.name?.toLowerCase() || ''
  return slug.includes('sakura') || slug.includes('sunset') || slug.includes('light') || slug.includes('gold')
}

const selectedUser = ref<any | null>(null)
const popoverEvent = ref<Event | null>(null)

/* ---------------- Chart Setup ---------------- */
// Removed ChartJS registration to improve performance


/* ---------------- State ---------------- */
const router = useRouter()
const { fetchProgress } = useDailyMissions()
const RECENT_DISCOVER_LIMIT = 15
const loadingStats = ref(true)

const isUnderConstruction = computed(() => import.meta.env.VITE_STORE_UNDER_CONSTRUCTION === 'true')
const loadingProducts = ref(true)
const loadingLocations = ref(true)
const recentProducts = ref<any[]>([])
const recentLocations = ref<any[]>([])
const loadingNews = ref(true)
const recentNews = ref<any[]>([])
const totalProductCount = ref(0)
const totalLocationCount = ref(0)

const loadingTrips = ref(true)
const recentTrips = ref<any[]>([])
const loadingMarketplace = ref(true)
const marketplaceProducts = ref<any[]>([])

/* ---------------- Announcement logic ---------------- */
const announcement = ref<any | null>(null)
const showAnnouncement = ref(false)

async function fetchLatestAnnouncement() {
  try {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) return

    const dismissedId = localStorage.getItem('last_dismissed_announcement')
    if (dismissedId !== data.id) {
      announcement.value = data
      showAnnouncement.value = true
    }
  } catch (err) {
    console.error("Failed to fetch announcement:", err)
  }
}

function dismissAnnouncement() {
  if (announcement.value) {
    localStorage.setItem('last_dismissed_announcement', announcement.value.id)
    showAnnouncement.value = false
  }
}

function handleBannerClick() {
  if (announcement.value?.link_url) {
    ActivityLogService.log('announcement_click', {
      id: announcement.value.id,
      url: announcement.value.link_url
    })
    window.open(announcement.value.link_url, '_blank')
  }
}


const userLocation = computed(() => sharedLocation.value)


const { leaderboard, loading: loadingLeaderboard, fetchLeaderboard } = useLeaderboard();
const leaderboardType = ref<'daily' | 'weekly' | 'monthly' | 'all_time'>('daily')

function changeLeaderboardType(ev: any) {
  leaderboardType.value = ev.detail.value
  fetchLeaderboard(leaderboardType.value, 10)
}
const isAuthenticated = ref(false)

const isDark = ref(document.documentElement.classList.contains('ion-palette-dark'))

onMounted(() => {
  loadFavorites()
  initPhrases()
  startWatching()
  fetchLatestAnnouncement()
  
  loadVoices()
  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = loadVoices
  }
  
  const observer = new MutationObserver(() => {
    isDark.value = document.documentElement.classList.contains('ion-palette-dark')
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})






watch([() => locale.value], () => {
  // Refresh location category stats because they might have changed
  fetchLocationCategoryStats()
})

watch(sharedLocation, (newLoc) => {
  if (newLoc) {
    fetchPrayerTimes()
  }
})



const halalPartners = ref<any[]>([])
const halalPartnersFull = ref<any[]>([])
const rotationTimer = ref<any>(null)
const loadingPartners = ref(true)

type PrayerTimes = {
  fajr: string
  sunrise: string
  dhuhr: string
  asr: string
  maghrib: string
  isha: string
}

const prayerTimes = ref<PrayerTimes | null>(null)
const loadingPrayerTimes = ref(true)
const prayerScroll = ref<HTMLElement | null>(null)

/* ---------------- Utilities ---------------- */
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(relativeTime)

const userTimezone = ref(dayjs.tz.guess())

function fromNowToTaipei(dateString?: string) {
  if (!dateString) return ''
  return dayjs.utc(dateString).tz(userTimezone.value).fromNow()
}

const nowTime = ref(dayjs().tz(userTimezone.value))

function startClock() {
  timeInterval = window.setInterval(() => {
    nowTime.value = dayjs().tz(userTimezone.value)
  }, 1000)
}

async function fetchRecentNews() {
  loadingNews.value = true

  const data = await withCache('recent_news', async () => {
    const { data, error } = await supabase
        .from('news')
        .select('id, title, header_image, created_at')
        .order('created_at', { ascending: false })
        .limit(RECENT_DISCOVER_LIMIT)

    if (error) throw error
    return data.map(n => ({
      id: n.id,
      title: n.title,
      cover: n.header_image || 'https://placehold.co/400x250?text=News',
      created_at: n.created_at
    }))
  })

  if (data) {
    recentNews.value = data
  }

  loadingNews.value = false
}

const TIER_PRIORITY: Record<string, number> = {
  gold: 3,
  silver: 2,
  bronze: 1
}

// Removed displayedPartners computed property to allow direct control over rotation order via halalPartners.value

async function getUserLocation(): Promise<LatLng> {
  // Use shared location if available, otherwise return Taipei fallback
  return sharedLocation.value || {
    lat: 25.0330,
    lng: 121.5654,
    city: t('home.taipei')
  }
}

async function fetchPrayerTimes() {
  loadingPrayerTimes.value = true

  const location = await getUserLocation()

  const praytime = new PrayTime('MWL')

  praytime
      .location([location.lat, location.lng])
      .timezone(userTimezone.value)
      .format('24h')
      .adjust({ highLats: 'AngleBased' })

  const times = praytime.getTimes(new Date())

  prayerTimes.value = {
    fajr: times.fajr,
    sunrise: times.sunrise,
    dhuhr: times.dhuhr,
    asr: times.asr,
    maghrib: times.maghrib,
    isha: times.isha
  }

  loadingPrayerTimes.value = false
}

async function handleRefreshLocation() {
  ActivityLogService.log("home_prayer_refresh_location");
  localStorage.removeItem('hf_user_location'); // 🏁 Clear cache
  await fetchPrayerTimes();
}


const prayerList = computed(() => {
  if (!prayerTimes.value) return []

  return [
    { key: 'fajr', label: t('home.prayers.fajr'), time: prayerTimes.value.fajr },
    { key: 'dhuhr', label: t('home.prayers.dhuhr'), time: prayerTimes.value.dhuhr },
    { key: 'asr', label: t('home.prayers.asr'), time: prayerTimes.value.asr },
    { key: 'maghrib', label: t('home.prayers.maghrib'), time: prayerTimes.value.maghrib },
    { key: 'isha', label: t('home.prayers.isha'), time: prayerTimes.value.isha }
  ]
})

const currentPrayerKey = computed(() => {
  if (!prayerTimes.value) return null

  const now = nowTime.value
  const today = now.format('YYYY-MM-DD')

  const prayers = prayerList.value.map(p => ({
    ...p,
    timeObj: dayjs.tz(
        `${today} ${p.time}`,
        'YYYY-MM-DD HH:mm',
        userTimezone.value
    )
  }))

  for (let i = 0; i < prayers.length; i++) {
    const current = prayers[i]
    const next = prayers[i + 1]

    if (next) {
      if (now.isAfter(current.timeObj) && now.isBefore(next.timeObj)) {
        return current.key
      }
    } else {
      // Last prayer (Isha)
      if (now.isAfter(current.timeObj)) {
        return current.key
      }
    }
  }

  // If before Fajr
  return 'isha'
})



const nextPrayer = computed(() => {
  if (!prayerTimes.value) return null

  const now = nowTime.value

  for (const p of prayerList.value) {
    const prayerTime = dayjs.tz(
        `${now.format('YYYY-MM-DD')} ${p.time}`,
        'YYYY-MM-DD HH:mm',
        userTimezone.value
    )

    if (prayerTime.isAfter(now)) {
      return {
        ...p,
        timeObj: prayerTime
      }
    }
  }

  // All passed → next is Fajr tomorrow
  const fajrTime = dayjs
      .tz(
          `${now.add(1, 'day').format('YYYY-MM-DD')} ${prayerTimes.value.fajr}`,
          'YYYY-MM-DD HH:mm',
          userTimezone.value
      )

  return {
    key: 'fajr',
    label: t('home.prayers.fajr'),
    time: prayerTimes.value.fajr,
    timeObj: fajrTime
  }
})

const scrollPrayerKey = computed(() => {
  return currentPrayerKey.value
})

watch(
    () => scrollPrayerKey.value,
    async (key) => {
      if (!key) return

      // wait for DOM + Ionic layout
      await nextTick()
      requestAnimationFrame(() => {
        const container = prayerScroll.value
        if (!container) return

        const target = container.querySelector(
            `.prayer-pill[data-key="${key}"]`
        ) as HTMLElement

        if (!target) return

        const offset =
            target.offsetLeft -
            container.clientWidth / 2 +
            target.clientWidth / 2

        container.scrollTo({
          left: offset,
          behavior: 'smooth'
        })
      })
    },
    { immediate: true }
)

const upcomingCountdown = computed(() => {
  if (!nextPrayer.value) return ''

  const totalSeconds = nextPrayer.value.timeObj.diff(nowTime.value, 'second')
  if (totalSeconds <= 0) return '00:00:00'

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return [
    hours,
    minutes,
    seconds
  ]
      .map(v => String(v).padStart(2, '0'))
      .join(':')
})


// Removed updateChartSmoothly as we are using reactive data objects now

function openUserProfile(user: any, ev: Event) {
  ActivityLogService.log("home_leaderboard_profile", {
    user_id: user.id,
    display_name: user.display_name
  });

  selectedUser.value = user
  popoverEvent.value = ev   // 👈 attach the click event for positioning
}

function closePopover() {
  selectedUser.value = null
  popoverEvent.value = null
}

async function showPrivateInfoAlert(ev?: Event) {
  if (ev) {
    ev.stopPropagation(); // prevent triggering row click / popover opening
  }
  const isZh = locale.value === 'zh' || locale.value?.startsWith('zh');
  const alert = await alertController.create({
    header: isZh ? '個人檔案已設為不公開' : 'Profile is Private',
    message: isZh 
      ? '您的個人檔案目前設定為不公開。您的姓名與頭像僅對您自己顯示，其他使用者將會看到您顯示為「匿名」。' 
      : 'Your profile is set to private. Your name and details are only visible to you. Other users will see you as Anonymous.',
    buttons: [isZh ? '我知道了' : 'Got It']
  });
  await alert.present();
}

/* ---------------- Data Fetching ---------------- */
async function fetchRecentProducts() {
  loadingProducts.value = true
  const data = await withCache('recent_products', async () => {
    const { data, error } = await supabase
        .from("products")
        .select(`
          barcode, 
          name, 
          status, 
          photo_front_url, 
          created_at, 
          approved_at, 
          updated_at, 
          product_categories(name),
          partner:partners(partner_tier)
        `)
        .eq("approved", true)
        .order("approved_at", { ascending: false })
        .limit(100)

    if (error) throw error
    
    const sevenDaysAgo = dayjs().subtract(7, 'day');
    const sortedData = [...data].sort((a: any, b: any) => {
      const getWeight = (p: any) => {
        const t = Array.isArray(p.partner) ? p.partner[0]?.partner_tier : p.partner?.partner_tier;
        const tier = String(t || '').toLowerCase();
        const isNew = dayjs(p.created_at).isAfter(sevenDaysAgo) || (p.updated_at && dayjs(p.updated_at).isAfter(sevenDaysAgo));
        if (tier === 'gold' && isNew) return 3;
        if (tier === 'gold') return 2;
        if (tier === 'silver' && isNew) return 1;
        return 0;
      };
      const weightA = getWeight(a);
      const weightB = getWeight(b);
      if (weightA !== weightB) return weightB - weightA;
      return dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf();
    }).slice(0, RECENT_DISCOVER_LIMIT);

    return sortedData.map(p => ({
      barcode: p.barcode,
      name: p.name,
      status: p.status,
      category: (p.product_categories as any)?.name || "",
      image: p.photo_front_url,
      created_at: p.created_at,
      partner_tier: Array.isArray(p.partner) ? p.partner[0]?.partner_tier : (p.partner as any)?.partner_tier
    }))
  })

  if (data) {
    recentProducts.value = data
  }
  loadingProducts.value = false
}

async function fetchRecentLocations() {
  loadingLocations.value = true
  const data = await withCache('recent_locations', async () => {
    const { data, error } = await supabase
        .from('locations')
        .select(`
          id, 
          name, 
          image, 
          type_id, 
          location_types(name), 
          created_at, 
          updated_at, 
          partner:partners(partner_tier)
        `)
        .eq('approved', true)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
        .limit(100)

    if (error) throw error
    
    const sevenDaysAgo = dayjs().subtract(7, 'day');
    const sortedData = [...data].sort((a: any, b: any) => {
      const getWeight = (p: any) => {
        const t = Array.isArray(p.partner) ? p.partner[0]?.partner_tier : p.partner?.partner_tier;
        const tier = String(t || '').toLowerCase();
        const isNew = dayjs(p.created_at).isAfter(sevenDaysAgo) || (p.updated_at && dayjs(p.updated_at).isAfter(sevenDaysAgo));
        if (tier === 'gold' && isNew) return 3;
        if (tier === 'gold') return 2;
        if (tier === 'silver' && isNew) return 1;
        return 0;
      };
      const weightA = getWeight(a);
      const weightB = getWeight(b);
      if (weightA !== weightB) return weightB - weightA;
      return dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf();
    }).slice(0, RECENT_DISCOVER_LIMIT);

    return sortedData.map(l => ({
      id: l.id,
      name: l.name,
      image: l.image,
      type: (l.location_types as any)?.name || '',
      created_at: l.created_at,
      partner_tier: Array.isArray(l.partner) ? l.partner[0]?.partner_tier : (l.partner as any)?.partner_tier
    }))
  })

  if (data) {
    recentLocations.value = data
  }
  loadingLocations.value = false
}

async function fetchStats() {
  loadingStats.value = true
  const stats = await withCache('product_total_stats', async () => {
    const { count, error } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_archived', false)
    if (error) throw error
    return { totalCount: count || 0 }
  })
  if (stats) totalProductCount.value = stats.totalCount
  loadingStats.value = false
}

async function fetchLocationCategoryStats() {
  const stats = await withCache('location_total_stats', async () => {
    const { count, error } = await supabase
        .from("locations")
        .select('*', { count: 'exact', head: true })
        .eq('approved', true)
        .eq('is_archived', false)

    if (error) throw error
    return { totalCount: count || 0 }
  })

  if (stats) totalLocationCount.value = stats.totalCount
}

async function fetchHomePartners() {
  loadingPartners.value = true

  const data = await withCache('home_partners', async () => {
    // 1. Fetch more partners (up to 100) to ensure we can rotate fairly
    const { data, error } = await supabase
        .from('partners')
        .select(`
      id,
      name,
      logo_url,
      partner_tier
    `)
        .eq('is_active', true)
        .limit(100)

    if (error || !data) {
      console.error('[Home Partners] fetch error:', error)
      return null
    }
    return data
  })

  if (data) {
    // 2. Define Tier Weights
    const tierWeights: Record<string, number> = {
      'gold': 3,
      'silver': 2,
      'bronze': 1
    }

    // 3. Map to stable format
    halalPartnersFull.value = data.map((b: any) => ({
      id: b.id,
      name: b.name,
      partner_tier: b.partner_tier,
      logo:
          b.logo_url ||
          `https://placehold.co/300x300?text=${encodeURIComponent(b.name)}`,
      _weight: tierWeights[(b.partner_tier || '').toLowerCase()] || 0
    }))

    // 4. Start the first rotation
    updatePartnerRotation()
  }

  loadingPartners.value = false
}

/**
 * Performs a fair (Round-Robin) shift of the partners list
 * and schedules the next rotation based on the top partner's tier.
 */
function updatePartnerRotation() {
  if (rotationTimer.value) clearTimeout(rotationTimer.value)
  if (halalPartnersFull.value.length === 0) return

  // --- "Universal Adil" (Fair) Rotation Logic ---
  // We rotate the ENTIRE list together, so every partner eventually 
  // reaches the front of the line.
  const rotationIndexStr = localStorage.getItem('partner_rotation_index') || '0'
  const rotationIndex = parseInt(rotationIndexStr, 10)

  // 1. Create a stable, tiered base list
  const tierWeights: Record<string, number> = { 'gold': 3, 'silver': 2, 'bronze': 1 }
  const sortedFull = [...halalPartnersFull.value].sort((a, b) => {
    // Sort by tier weight (desc), then by name (asc) for stability
    if (b._weight !== a._weight) return b._weight - a._weight
    return a.name.localeCompare(b.name)
  })

  // 2. Rotate the entire list based on the global index
  const length = sortedFull.length
  const shift = rotationIndex % length
  const rotatedFull = sortedFull.slice(shift).concat(sortedFull.slice(0, shift))

  // 3. Take the first 6 for the Home grid
  const finalSelection = rotatedFull.slice(0, 6)
  halalPartners.value = finalSelection

  // Increment rotation index for the next turn
  localStorage.setItem('partner_rotation_index', (rotationIndex + 1).toString())

  // --- Tiered Autoplay Logic ---
  // The delay before the next turn depends on the current featured partner (#1 spot)
  const featuredTier = (finalSelection[0]?.partner_tier || '').toLowerCase()
  
  let nextRotationDelay = 3500 // Default for Normal/Bronze
  if (featuredTier === 'gold') {
    nextRotationDelay = 10000 // 10s for Gold
  } else if (featuredTier === 'silver') {
    nextRotationDelay = 7000  // 7s for Silver
  } else if (featuredTier === 'bronze') {
    nextRotationDelay = 5000  // 5s for Bronze
  }

  rotationTimer.value = setTimeout(() => {
    updatePartnerRotation()
  }, nextRotationDelay)
}




/* ---------------- Trips & Marketplace ---------------- */

async function fetchTrips() {
  loadingTrips.value = true
  const data = await withCache('recent_trips', async () => {
    const { data, error } = await supabase
      .from('trips')
      .select(`
        id,
        title,
        title_zh,
        duration,
        cover_url,
        external_url,
        created_at,
        provider:partners (
          name,
          partner_tier
        )
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(6)
    
    if (error) throw error
    return (data as any[]).map(t => ({
      ...t,
      provider: Array.isArray(t.provider) ? t.provider[0] : t.provider
    }))
  })

  if (data) {
    recentTrips.value = data
  }
  loadingTrips.value = false
}

async function fetchMarketplaceProducts() {
  loadingMarketplace.value = true
  const data = await withCache('marketplace_products', async () => {
    const { data, error } = await supabase
      .from('store_products')
      .select(`
        id,
        name,
        name_zh,
        price,
        images,
        created_at,
        sale_count
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(6)
    
    if (error) throw error
    return data
  })

  if (data) {
    marketplaceProducts.value = data
  }
  loadingMarketplace.value = false
}

function viewMoreTrips() {
  ActivityLogService.log("home_view_more_trips");
  router.push('/trip')
}

function viewMoreMarketplace() {
  ActivityLogService.log("home_view_more_marketplace");
  router.push('/store')
}

async function openTrip(trip: any) {
  ActivityLogService.log("home_trip_click", {
    trip_id: trip.id,
    trip_title: trip.title
  })
  
  await supabase.rpc('increment_trip_view', {
    p_trip_id: trip.id
  })

  await Browser.open({
    url: trip.external_url,
    windowName: '_self',
    toolbarColor: '#e67e22',
    presentationStyle: 'fullscreen',
  })
}

function openMarketplaceProduct(p: any) {
  ActivityLogService.log("home_marketplace_click", { product_id: p.id, product_name: p.name })
  router.push(`/store/product/${p.id}`)
}

function localized(zh: string | null | undefined, en: string | null | undefined): string {
  if (locale.value === 'zh') return zh || en || ''
  return en || zh || ''
}

/* ---------------- Lifecycle ---------------- */

async function refreshAllData() {
  console.log('🏠 [Home] Refreshing Priority Data...')
  
  // 🚀 PRIORITY: Load top-of-page content immediately
  const priorityTasks = [
    fetchRecentProducts(),
    fetchHomePartners(),
    fetchLeaderboard(leaderboardType.value, 10)
  ]
  
  if (isAuthenticated.value) {
    priorityTasks.push(fetchProgress())
  }

  await Promise.allSettled(priorityTasks)
  
  if (Capacitor.isNativePlatform()) refreshSubscriptionStatus();
}


onIonViewWillEnter(async () => {
  loadFavorites()
  ActivityLogService.log("home_page_open");
  
  const { data } = await supabase.auth.getSession()
  isAuthenticated.value = !!data.session

  refreshAllData()
  fetchPrayerTimes()
  startClock()
})

onMounted(() => {
  // Fallback for initial load if needed
  refreshAllData()
})

onBeforeUnmount(() => {
  if (timeInterval) {
    clearInterval(timeInterval)
    timeInterval = null
  }
  if (rotationTimer.value) {
    clearTimeout(rotationTimer.value)
    rotationTimer.value = null
  }
})


/* ---------------- Navigation ---------------- */
function goScan() {
  ActivityLogService.log("home_scan_ingredient");
  router.push('/scan');
}

function goToSearchAndScan() {
  ActivityLogService.log("home_scan_barcode");
  router.push({ path: '/search', query: { scan: 'true' } });
}

function goQibla() {
  ActivityLogService.log("home_find_qibla_click")
  router.push({ path: '/qibla', query: { from: 'home' } })
}

function viewMorePartners() {
  ActivityLogService.log("home_viewmore_partners")
  router.push('/partners')
}

function viewMoreProducts() {
  ActivityLogService.log("home_viewmore_products");
  router.push('/search');
}


function viewMoreLocations() {
  ActivityLogService.log("home_viewmore_locations");
  router.push('/explore');
}

function viewMoreNews() {
  ActivityLogService.log("home_viewmore_news")
  router.push('/news')
}

function viewMorePhrases() {
  ActivityLogService.log("home_viewmore_phrases")
  router.push('/halalify')
}

function openNews(news: any) {
  ActivityLogService.log("home_news_click", {
    id: news.id,
    title: news.title
  })

  router.push(`/news/${news.id}`)
}



function handleViewMoreReels() {
  ActivityLogService.log("reels_section_view_more");
  router.push('/reels');
}

async function openProduct(p: any) {
  ActivityLogService.log("home_product_click", {
    barcode: p.barcode,
    name: p.name,
    status: p.status
  });

  router.push(`/item/${p.barcode}`);
}


async function openLocation(loc: any) {
  ActivityLogService.log("home_location_click", {
    id: loc.id,
    name: loc.name,
    type: loc.type
  });

  router.push(`/place/${loc.id}`);
}

function openPartner(partner: any) {
  ActivityLogService.log("home_partner_click", {
    id: partner.id,
    name: partner.name
  })

  router.push(`/partner/${partner.id}`)
}




</script>

<style scoped>

/* === Compact Segment === */
ion-segment {
  --background: var(--ion-color-step-100);
  border-radius: 8px;
  min-height: 32px;
}
ion-segment-button {
  --padding-top: 4px;
  --padding-bottom: 4px;
  --margin-top: 2px;
  --margin-bottom: 2px;
  --margin-start: 2px;
  --margin-end: 2px;
  min-height: 28px;
  font-size: 0.82rem;
  letter-spacing: 0;
}

/* === Announcement Banner === */
.announcement-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 12px;
  margin-bottom: 16px;
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(0,0,0,0.05);
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  transition: all 0.2s ease;
}

.announcement-banner.clickable {
  cursor: pointer;
}

.announcement-banner.clickable:active {
  transform: scale(0.98);
  opacity: 0.9;
}

.announcement-banner.info {
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border-color: #bae6fd;
}

.announcement-banner.warning {
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
  border-color: #fde68a;
}

.announcement-banner.success {
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  border-color: #bbf7d0;
}

.announcement-content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.announcement-thumb-wrapper {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid rgba(0,0,0,0.1);
}

.announcement-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.announcement-icon {
  font-size: 20px;
  color: var(--ion-color-carrot);
}

.announcement-text {
  display: flex;
  flex-direction: column;
}

.announcement-title {
  font-weight: 700;
  font-size: 0.9rem;
  color: #1e293b;
}

.announcement-body {
  margin: 2px 0 0;
  font-size: 0.8rem;
  color: #475569;
  line-height: 1.25;
}

.close-btn {
  --padding-start: 4px;
  --padding-end: 4px;
  margin-left: 8px;
  height: 32px;
  width: 32px;
  font-size: 18px;
}

.slide-down-enter-active, .slide-down-leave-active {
  transition: all 0.3s ease;
}
.slide-down-enter-from, .slide-down-leave-to {
  transform: translateY(-20px);
  opacity: 0;
}

.ion-palette-dark .announcement-banner.info { background: linear-gradient(135deg, #0c4a6e 0%, #075985 100%); border-color: #0369a1; }
.ion-palette-dark .announcement-banner.warning { background: linear-gradient(135deg, #78350f 0%, #92400e 100%); border-color: #b45309; }
.ion-palette-dark .announcement-banner.success { background: linear-gradient(135deg, #064e3b 0%, #065f46 100%); border-color: #047857; }
.ion-palette-dark .announcement-title { color: #f1f5f9; }
.ion-palette-dark .announcement-body { color: #cbd5e1; }
.ion-palette-dark .close-btn { --color: #94a3b8; }



/* ===============================
   Prayer Times
   =============================== */

/* 🔥 App Features Redesign */
.clear-card {
  background: transparent;
  --background: transparent;
  box-shadow: none;
  border-radius: 0;
  contain: none;
  overflow: visible;
  border: none;
}

.main-feature-section {
  padding: 0;
  margin-top: 10px;
  margin-bottom: 10px;
}

.main-features-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
}

.feature-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16px;
  border-radius: 16px;
  border: none;
  text-align: left;
  height: 150px;
  width: 100%;
  margin: 0;
  box-sizing: border-box;
  transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.feature-card:active {
  transform: scale(0.96);
}

.feature-primary {
  background: linear-gradient(135deg, var(--ion-color-carrot) 0%, #ff8c3a 100%);
  color: white;
  box-shadow: 0 8px 16px rgba(217, 119, 6, 0.25);
}

.feature-secondary {
  /* Using a contrasting premium color for barcode */
  background: linear-gradient(135deg, var(--ion-color-tertiary, #5260ff) 0%, #7b88ff 100%);
  color: white;
  box-shadow: 0 8px 16px rgba(82, 96, 255, 0.25);
}

.feature-icon-wrapper {
  background: rgba(255, 255, 255, 0.25);
  border-radius: 12px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  backdrop-filter: blur(4px);
  z-index: 2;
}

.feature-text {
  margin-top: 16px;
  z-index: 2;
}

.feature-text h3 {
  margin: 0 0 4px;
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  white-space: normal;
}

.feature-text p {
  margin: 0;
  font-size: 0.75rem;
  opacity: 0.9;
  line-height: 1.3;
  white-space: normal;
  word-wrap: break-word;
}

.feature-bg-icon {
  position: absolute;
  right: -10px;
  bottom: -15px;
  font-size: 90px;
  opacity: 0.15;
  z-index: 1;
  transform: rotate(-10deg);
  pointer-events: none;
}

.prayer-horizontal {
  display: flex;
  gap: 12px;

  overflow-x: auto;
  overflow-y: hidden;

  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;        /* Firefox */
  -ms-overflow-style: none;     /* IE / Edge */

  padding: 4px 4px 12px;
}

.prayer-horizontal::-webkit-scrollbar {
  display: none;                /* Chrome / Safari / iOS */
}

/* Inner track */
.prayer-track {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(80px, 1fr);
  gap: 12px;

  width: 100%;
  padding: 4px 12px 12px;
}

@media (min-width: 1024px) {
  .prayer-track {
    grid-auto-columns: minmax(100px, 1fr);
  }
}

.prayer-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.qibla-header-btn {
  font-weight: 600;
}

.prayer-header-actions {
  display: flex;
  gap: 4px;
  align-items: center;
}


.prayer-pill {
  flex: 0 0 80px;
  scroll-snap-align: center;

  border-radius: 6px;
  padding: 7px 6px;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  transition: all 0.25s ease;
  flex-shrink: 0;
}


.prayer-pill .label {
  font-size: 0.7rem;
  color: var(--ion-color-medium);
}

.prayer-pill .time {
  font-size: 1rem;
  font-weight: 600;
  margin-top: 0;
}

/* 🔥 Active / Nearest Prayer */
.prayer-pill.active {
  background: rgba(217, 119, 6, 0.18);
  color: var(--ion-color-carrot);
  transform: scale(1.05);
  box-shadow: 0 0 0 1px rgba(217, 119, 6, 0.4),
  0 6px 18px rgba(217, 119, 6, 0.25);
}

.prayer-pill.active .label {
  color: var(--ion-color-carrot);
}

.qibla-row {
  display: flex;
  justify-content: center;
  padding: 6px 12px 4px;   /* horizontal padding = card padding feel */
}


.prayer-title-main {
  font-size: 1rem;
  font-weight: 600;
}

.prayer-title-location {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
  margin-top: 2px;
}

/* === Insights Dashboard Section === */
.insights-container {
  margin: 0px; /* Remove side margins here, handled by card margin + scroll padding */
}

.insights-scroll {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  padding: 0px; /* Allow card margins to breathe */
  scrollbar-width: none;
  -ms-overflow-style: none; 
}

/* 🖥️ Desktop: Transform Scroll to Grid */
@media (min-width: 1024px) {
  .insights-scroll {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    overflow-x: visible;
    padding: 8px 16px; /* Match standard page margins */
  }
}

.insights-scroll::-webkit-scrollbar {
  display: none;
}

.insight-card {
  flex: 0 0 240px;
  scroll-snap-align: center;
  margin: 12px 10px;
  background: var(--card-bg);
  border-radius: 16px; /* Match the exact 16px radius from the inspector */
  padding: 16px; /* Match the 16px inner padding */
  box-shadow: var(--card-shadow);
  border: 1px solid var(--card-border);
  display: flex;
  align-items: center;
  height: 90px;
  transition: transform 0.2s ease, background 0.2s ease;
  position: relative;
  cursor: pointer;
}

.insight-card:active {
  transform: scale(0.98);
  background: var(--ion-color-step-50);
}

@media (min-width: 1024px) {
  .insight-card {
    flex: 1; /* Fit width */
    min-width: 0;
  }
}

/* Stat Cards (Centered Icons) */
.stat-card {
  gap: 16px;
  text-align: left;
  justify-content: flex-start;
}

.forward-icon {
  position: absolute;
  right: 16px;
  color: var(--ion-color-medium);
  opacity: 0.5;
  font-size: 1.1rem;
}

.stat-icon-wrapper {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.stat-icon-wrapper.products {
  background: rgba(var(--ion-color-carrot-rgb), 0.1);
  color: var(--ion-color-carrot);
}

.stat-icon-wrapper.locations {
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  color: var(--ion-color-primary);
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ion-color-medium);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  margin: 2px 0 0;
  font-size: 1.6rem;
  font-weight: 850;
  color: var(--ion-color-dark);
}



/* Dark mode handled by global variables */


/* --- Partner List Transition --- */
.partner-list-move {
  transition: transform 0.8s ease;
}
.partner-list-enter-active, .partner-list-leave-active {
  transition: all 0.5s ease;
}
.partner-list-enter-from, .partner-list-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

/* === Community Reels / What's New === */
.reels-section {
  margin: 10px;
}

.card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  font-weight: 700;
  font-size: 1.1rem;
}

.section-subtitle {
  margin: -4px 0 0;
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}

/* === Announcement Bottom Sheet Styles === */
.announcement-sheet {
  --border-radius: 24px 24px 0 0;
  --box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.12);
}

.announcement-hero-wrapper {
  width: 100%;
  max-height: 200px;
  overflow: hidden;
  border-radius: 16px;
  margin-bottom: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.announcement-hero-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.announcement-html-body {
  font-size: 1rem;
  line-height: 1.6;
  color: var(--ion-color-step-800);
}

.announcement-html-body h1,
.announcement-html-body h2,
.announcement-html-body h3 {
  color: var(--ion-color-dark);
  font-weight: 700;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
}

.announcement-html-body p {
  margin-bottom: 1rem;
}

.announcement-html-body strong {
  font-weight: 700;
  color: var(--ion-color-dark);
}

.announcement-html-body a {
  color: var(--ion-color-carrot);
  text-decoration: underline;
  font-weight: 600;
}

.announcement-html-body ul, 
.announcement-html-body ol {
  padding-left: 20px;
  margin-bottom: 1.2rem;
}

.announcement-html-body li {
  margin-bottom: 0.5rem;
}

.announcement-actions {
  margin-top: 32px;
  margin-bottom: 16px;
}

.learn-more-btn {
  --border-width: 2px;
  --border-radius: 12px;
  font-weight: 600;
}

.got-it-btn {
  --border-radius: 12px;
  font-weight: 600;
}

/* === Leaderboard Hint Banner === */
.leaderboard-hint-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: linear-gradient(135deg, rgba(249, 115, 22, 0.08) 0%, rgba(251, 146, 60, 0.08) 100%);
  border: 1px solid rgba(249, 115, 22, 0.15);
  border-radius: 12px;
  margin-bottom: 16px;
  cursor: pointer;
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.leaderboard-hint-banner:active {
  transform: scale(0.98);
  opacity: 0.9;
}

.hint-icon {
  font-size: 20px;
  color: var(--ion-color-carrot);
  flex-shrink: 0;
  animation: pulse 2s infinite;
}

.hint-text {
  font-size: 0.85rem;
  line-height: 1.4;
  color: var(--ion-color-step-800);
  flex: 1;
}

.hint-arrow {
  font-size: 16px;
  color: var(--ion-color-medium);
  flex-shrink: 0;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
}

/* Dark mode adjustment */
.ion-palette-dark .leaderboard-hint-banner {
  background: linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, rgba(251, 146, 60, 0.15) 100%);
  border-color: rgba(249, 115, 22, 0.3);
}

/* ========= Leaderboard Cosmetic Effects ========= */
.leaderboard-list {
  overflow: visible;
}
.leaderboard-item {
  --overflow: visible;
  overflow: visible;
  contain: none;
}
.leaderboard-item::part(native) {
  overflow: visible !important;
}
.leaderboard-item::part(inner) {
  overflow: visible !important;
}

.leaderboard-avatar-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  padding: 2px;
  transition: all 0.3s ease;
}

.leaderboard-points-badge {
  border-radius: 8px;
  transition: all 0.3s ease;
}

.list-pro-badge {
  display: inline-flex;
  align-items: center;
  background: #ffd700;
  color: #111;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
  flex-shrink: 0;
  box-shadow: 0 0 5px rgba(250, 204, 21, 0.4);
}



.popover-cosmetic-wrapper {
  display: flex;
  justify-content: center;
  padding: 4px;
  border-radius: 50%;
  margin: 0 auto;
  width: fit-content;
  transition: all 0.3s ease;
}

.popover-custom-content {
  border-radius: 20px;
  overflow: hidden;
  --border-radius: 20px;
  --padding-start: 20px !important;
  --padding-end: 20px !important;
  --padding-top: 20px !important;
  --padding-bottom: 16px !important;
}

.mock-popover-pro-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #ffd700;
  color: #111;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 750;
  margin: 8px auto 12px;
  width: fit-content;
  box-shadow: 0 0 10px rgba(250, 204, 21, 0.4);
}

.mock-popover-pro-badge .pro-icon {
  font-size: 0.85rem;
}

.mock-popover-name {
  margin: 8px 0 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--ion-text-color);
}

.mock-popover-stats {
  margin: 4px 0 16px;
  font-size: 0.85rem;
  color: var(--ion-color-medium);
  font-weight: 600;
}

.mock-popover-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin: 16px 0;
  padding: 0;
  background: transparent;
  border: none;
}

.grid-col {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.grid-label {
  font-size: 0.7rem;
  color: var(--ion-color-medium);
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
}

.grid-val {
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--ion-color-dark);
}

.ion-palette-dark .grid-val {
  color: #ffffff;
}

.mock-popover-bio {
  margin: 16px 0 0;
  font-size: 0.85rem;
  color: var(--ion-color-step-700);
  font-style: italic;
  line-height: 1.45;
}

.ion-palette-dark .mock-popover-bio {
  color: #e5e5ea;
}

/* Cosmetic Animations */
@keyframes pulse-glow {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.05); }
}

@keyframes shimmer {
  0% { opacity: 0.5; }
  50% { opacity: 1; }
  100% { opacity: 0.5; }
}

@keyframes flame-dance {
  0% { opacity: 0.7; filter: hue-rotate(0deg); }
  100% { opacity: 1; filter: hue-rotate(15deg); }
}

@keyframes neon-rainbow {
  0% { filter: hue-rotate(0deg); }
  100% { filter: hue-rotate(360deg); }
}

@keyframes dragon-shimmer {
  0% { opacity: 0.7; filter: hue-rotate(0deg) brightness(1); }
  100% { opacity: 1; filter: hue-rotate(20deg) brightness(1.2); }
}

@keyframes aurora-wave {
  0%, 100% { opacity: 0.6; filter: hue-rotate(0deg); }
  50% { opacity: 1; filter: hue-rotate(30deg); }
}

@keyframes sparkle-border {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; filter: brightness(1.3); }
}

@keyframes holo-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.home-leaderboard-empty {
  text-align: center;
  padding: 24px 12px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.home-leaderboard-empty .empty-title {
  margin: 0 0 6px;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--ion-color-dark);
}
.home-leaderboard-empty .empty-tip {
  margin: 0 0 16px;
  font-size: 0.78rem;
  color: var(--ion-color-medium);
  line-height: 1.45;
  max-width: 320px;
}
.empty-actions-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  width: 100%;
}
.empty-actions-grid ion-button {
  --border-radius: 20px;
  font-weight: 600;
  margin: 0;
}

/* === Halal Card styling === */

.halal-card-subtitle {
  font-size: 0.85rem;
  color: var(--ion-color-medium);
  margin: 0;
  line-height: 1.4;
}

.halal-phrases-scroller {
  display: flex;
  overflow-x: auto;
  gap: 14px;
  scroll-snap-type: x mandatory;
  padding: 4px 0 12px 0;
  -webkit-overflow-scrolling: touch;
}

.scroller-spacer {
  flex: 0 0 15%;
}

/* Hide scrollbar for Chrome, Safari and Opera */
.halal-phrases-scroller::-webkit-scrollbar {
  display: none;
}

/* Hide scrollbar for IE, Edge and Firefox */
.halal-phrases-scroller {
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
}

.phrase-card {
  width: 100%;
  min-width: 100%;
  flex: 0 0 100%;
  box-sizing: border-box;
  scroll-snap-align: start;
  background: var(--ion-color-step-50, #f8f9fa);
  border: 1px solid var(--ion-color-step-150, #e2e8f0);
  border-radius: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.03);
}

.ion-palette-dark .phrase-card {
  background: var(--ion-color-step-100, #1e1e1e);
  border-color: var(--ion-color-step-200, #2d2d2d);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
}

.phrase-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.phrase-tag {
  font-size: 11px;
  font-weight: 700;
  color: var(--ion-color-carrot);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: rgba(var(--ion-color-carrot-rgb, 255, 159, 64), 0.1);
  padding: 4px 8px;
  border-radius: 6px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.phrase-action-btn {
  --padding-start: 6px;
  --padding-end: 6px;
  height: 32px;
  margin: 0;
}

.phrase-chinese-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.play-btn {
  --background: var(--ion-color-carrot);
  --color: #ffffff;
  --border-radius: 50%;
  --box-shadow: 0 4px 10px rgba(217, 119, 6, 0.3);
  width: 46px;
  height: 46px;
  min-height: 46px;
  min-width: 46px;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  --padding-start: 0;
  --padding-end: 0;
}

.play-btn ion-icon {
  font-size: 24px;
}

.play-btn.speaking {
  --background: var(--ion-color-success, #2dd36f);
  --box-shadow: 0 4px 12px rgba(45, 211, 111, 0.4);
  animation: pulse-speaker 1.5s infinite;
}

@keyframes pulse-speaker {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.15);
    opacity: 0.8;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.phrase-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.phrase-english {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--ion-text-color);
}

.language-sub-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 4px;
}

.language-sub-section.border-top {
  border-top: 1px dashed var(--ion-color-step-200, #e2e8f0);
  padding-top: 12px;
  margin-top: 4px;
}

.sub-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sub-lang-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}

.sub-lang-label.Mandarin {
  color: var(--ion-color-carrot);
}

.sub-lang-label.Taiwanese {
  color: var(--ion-color-success);
}

.sub-actions {
  display: flex;
  gap: 4px;
}

.mini-btn {
  --padding-start: 4px;
  --padding-end: 4px;
  height: 24px;
  margin: 0;
  font-size: 16px;
}

.phrase-chinese-box {
  flex: 1;
  min-width: 0;
  background: rgba(var(--ion-color-carrot-rgb, 255, 159, 64), 0.05);
  border-left: 3px solid var(--ion-color-carrot);
  padding: 8px 12px;
  border-radius: 0 8px 8px 0;
  margin: 4px 0;
}

.phrase-chinese-box.Taiwanese {
  border-left-color: var(--ion-color-success, #2dd36f);
  background: rgba(var(--ion-color-success-rgb, 45, 211, 111), 0.05);
}

.phrase-chinese {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--ion-text-color);
  letter-spacing: 0.5px;
}

.phrase-chinese span {
  transition: background-color 0.1s ease, color 0.1s ease;
  border-radius: 4px;
  padding: 0 1px;
}

.phrase-chinese span.highlight-active {
  background-color: rgba(var(--ion-color-carrot-rgb, 255, 159, 64), 0.25);
  color: var(--ion-color-carrot);
  font-weight: 900;
}

.phrase-pinyin,
.phrase-pronunciation {
  margin: 0;
  font-size: 0.8rem;
  color: var(--ion-color-step-600, #718096);
  line-height: 1.4;
}

.phrase-pinyin span {
  transition: background-color 0.1s ease, color 0.1s ease;
  border-radius: 4px;
  padding: 0 2px;
}

.phrase-pinyin span.highlight-active {
  background-color: rgba(var(--ion-color-carrot-rgb, 255, 159, 64), 0.25);
  color: var(--ion-color-carrot);
  font-weight: 700;
}

.ion-palette-dark .phrase-pinyin,
.ion-palette-dark .phrase-pronunciation {
  color: var(--ion-color-step-400, #a0aec0);
}

.phrase-pinyin .label,
.phrase-pronunciation .label {
  font-weight: 700;
  color: var(--ion-text-color);
  margin-right: 4px;
}

.phrase-pronunciation {
  font-style: italic;
}

.voice-selector-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--ion-color-step-100, #edf2f7);
  padding: 2px 10px;
  border-radius: 20px;
  max-width: 210px;
}

.ion-palette-dark .voice-selector-wrapper {
  background: var(--ion-color-step-150, #2d3748);
}

.voice-icon {
  font-size: 16px;
  color: var(--ion-color-carrot);
  flex-shrink: 0;
}

.voice-select {
  --padding-top: 0;
  --padding-bottom: 0;
  --padding-start: 0;
  --padding-end: 0;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ion-color-carrot, #e67e22);
  --color: var(--ion-color-carrot, #e67e22);
  min-height: 24px;
}

.phrase-card.locked-card {
  opacity: 0.85;
  border: 1px dashed var(--ion-color-medium, #92949c);
  background: var(--ion-color-step-50, #f8f9fa);
}

.ion-palette-dark .phrase-card.locked-card {
  background: var(--ion-color-step-100, #1e1e1e);
}

.play-btn.locked-play {
  --background: var(--ion-color-medium, #92949c);
  --box-shadow: none;
}

.locked-content-placeholder {
  background: var(--ion-color-step-100, #edf2f7);
  border: 1px dashed var(--ion-color-medium, #92949c);
  border-radius: 12px;
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  margin-top: 10px;
  transition: background-color 0.2s ease, transform 0.1s ease;
}

.locked-content-placeholder:active {
  transform: scale(0.98);
  background: var(--ion-color-step-150, #e2e8f0);
}

.lock-placeholder-icon {
  font-size: 28px;
  color: var(--ion-color-carrot, #e67e22);
}

.lock-placeholder-text {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ion-color-step-700, #4a5568);
  text-align: center;
}

.ion-palette-dark .locked-content-placeholder {
  background: var(--ion-color-step-150, #2d3748);
}

.ion-palette-dark .locked-content-placeholder:active {
  background: var(--ion-color-step-200, #4a5568);
}

.ion-palette-dark .lock-placeholder-text {
  color: var(--ion-color-step-400, #cbd5e0);
}

.phrase-chinese-segments {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 8px 12px;
  line-height: 1.2;
}

.chinese-segment {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.chinese-segment-chars {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.chinese-segment .align-char {
  font-size: 1.7rem;
  font-weight: 600;
  color: var(--ion-text-color, #2d3748);
  transition: background-color 0.15s ease, color 0.15s ease;
  border-radius: 4px;
  padding: 0 1px;
}

.chinese-segment .align-char.highlight-active {
  background-color: rgba(var(--ion-color-carrot-rgb, 255, 159, 64), 0.25);
  color: var(--ion-color-carrot);
}

.segment-gloss {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--ion-color-medium, #718096);
  margin-top: 5px;
  text-transform: lowercase;
  opacity: 0.85;
}
</style>
