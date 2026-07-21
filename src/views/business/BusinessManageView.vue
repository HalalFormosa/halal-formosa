<template>
  <ion-page>
    <ion-header class="ion-no-border">
      <app-header :title="locationName || $t('business.manage')" show-back back-route="/business" icon="none" />
    </ion-header>

    <ion-content>
      <div v-if="loading" class="ion-text-center ion-padding">
        <ion-spinner name="crescent" color="carrot" />
      </div>

      <template v-else>
        <!-- Plan banner. The tier is account-level, so owners manage/upgrade it from
             the Business overview — here it's read-only (admins keep per-location tools). -->
        <div class="plan-banner" :class="tier">
          <div>
            <span class="plan-label">{{ $t('business.plan.current') }}</span>
            <span class="plan-tier">{{ tier }}</span>
            <span class="plan-accountwide">{{ $t('business.plan.accountWide') }}</span>
          </div>
          <!-- Admins can assign a plan tier + preview the paywall -->
          <div v-if="isAdmin" class="admin-plan-controls">
            <ion-button fill="clear" size="small" color="carrot" @click="openUpgrade(true)">
              {{ $t('business.plan.previewPaywall') }}
            </ion-button>
            <ion-select
              :value="tier"
              interface="popover"
              class="admin-tier-select"
              @ionChange="assignTier($event.detail.value)"
            >
              <ion-select-option value="free">free</ion-select-option>
              <ion-select-option value="bronze">bronze</ion-select-option>
              <ion-select-option value="silver">silver</ion-select-option>
              <ion-select-option value="gold">gold</ion-select-option>
            </ion-select>
          </div>
        </div>

        <!-- Segment tabs -->
        <div class="seg-scroll">
          <ion-segment v-model="tab" scrollable mode="md" color="carrot">
            <ion-segment-button value="info"><ion-label>{{ $t('business.tabs.info') }}</ion-label></ion-segment-button>
            <ion-segment-button value="photos"><ion-label>{{ $t('business.tabs.photos') }}</ion-label></ion-segment-button>
            <ion-segment-button value="menu"><ion-label>{{ $t('business.tabs.menu') }}</ion-label></ion-segment-button>
            <ion-segment-button value="halal"><ion-label>{{ $t('business.tabs.halal') }}</ion-label></ion-segment-button>
            <ion-segment-button value="promos"><ion-label>{{ $t('business.tabs.promos') }}</ion-label></ion-segment-button>
            <ion-segment-button value="analytics"><ion-label>{{ $t('business.tabs.analytics') }}</ion-label></ion-segment-button>
            <ion-segment-button value="reports"><ion-label>{{ $t('business.tabs.reports') }}</ion-label></ion-segment-button>
            <ion-segment-button value="reviews"><ion-label>{{ $t('business.tabs.reviews') || 'Reviews' }}</ion-label></ion-segment-button>
          </ion-segment>
        </div>

        <div class="ion-padding tab-body">
          <!-- INFO -->
          <section v-if="tab === 'info'" class="fade-in">
            <div v-if="hasUnpublished" class="draft-banner">
              <ion-icon :icon="createOutline" />
              <span>{{ $t('business.draft.unpublished') }}</span>
            </div>
            <div class="review-legend">
              <span class="legend-item"><span class="review-badge"><ion-icon :icon="shieldCheckmarkOutline" />{{ $t('business.info.reviewBadge') }}</span>{{ $t('business.info.legendReview') }}</span>
              <span class="legend-item"><ion-icon :icon="flashOutline" class="instant-icon" />{{ $t('business.info.legendInstant') }}</span>
            </div>
            <ion-list class="edit-list">
              <ion-item>
                <ion-input v-model="info.name" :label="$t('business.info.name')" label-placement="stacked" />
                <span slot="end" class="review-badge field-badge"><ion-icon :icon="shieldCheckmarkOutline" />{{ $t('business.info.reviewBadge') }}</span>
                <ion-note slot="helper">{{ $t('business.info.reviewNeeded') }}</ion-note>
              </ion-item>
              <ion-item>
                <ion-input v-model="info.address" :label="$t('business.info.address')" label-placement="stacked" @ionBlur="onAddressConfirm" />
                <span slot="end" class="review-badge field-badge"><ion-icon :icon="shieldCheckmarkOutline" />{{ $t('business.info.reviewBadge') }}</span>
                <ion-note slot="helper">{{ $t('business.info.reviewNeeded') }}</ion-note>
              </ion-item>
              <div class="biz-map-block">
                <div class="biz-map-hint">{{ $t('business.info.mapHint') }}</div>
                <div class="biz-map-holder">
                  <div id="biz-map" :class="{ 'fade-in': mapReady }"></div>
                  <div v-if="mapLoading" class="biz-map-loading"><ion-spinner name="crescent" color="carrot" /></div>
                </div>
                <div class="biz-coords">
                  <ion-icon :icon="navigateOutline" />
                  <span>{{ $t('business.info.coordinates') }}: {{ coords.lat.toFixed(6) }}, {{ coords.lng.toFixed(6) }}</span>
                </div>
              </div>
              <ion-item>
                <ion-input v-model="info.phone" :label="$t('business.info.phone')" label-placement="stacked" placeholder="02-2321-9445" />
              </ion-item>
              <ion-item>
                <ion-input v-model="info.instagram" :label="$t('business.info.instagram')" label-placement="stacked" placeholder="@yourbusiness" />
              </ion-item>
              <ion-item>
                <ion-input v-model="info.facebook" :label="$t('business.info.facebook')" label-placement="stacked" placeholder="https://facebook.com/yourbusiness" />
              </ion-item>
              <ion-item>
                <ion-input v-model="info.tiktok" :label="$t('business.info.tiktok')" label-placement="stacked" placeholder="@yourbusiness" />
              </ion-item>
              <ion-item>
                <ion-input v-model="info.website" :label="$t('business.info.website')" label-placement="stacked" placeholder="https://yourbusiness.com" />
              </ion-item>
              <ion-item>
                <ion-input v-model="info.line_id" :label="$t('business.info.lineId')" label-placement="stacked" />
              </ion-item>
              <ion-item>
                <ion-input v-model="info.foodpanda_url" :label="$t('business.info.foodpanda')" label-placement="stacked" placeholder="https://foodpanda.go.link/" />
              </ion-item>
              <ion-item>
                <ion-input v-model="info.ubereats_url" :label="$t('business.info.ubereats')" label-placement="stacked" placeholder="https://www.ubereats.com/store-browse-uuid/" />
              </ion-item>
              <ion-item>
                <ion-select v-model="info.price_range" :label="$t('business.info.priceRange')" label-placement="stacked" interface="popover" :placeholder="$t('business.info.priceRangePlaceholder')">
                  <ion-select-option v-for="r in priceRanges" :key="r.value" :value="r.value">{{ r.label }}</ion-select-option>
                </ion-select>
              </ion-item>
              <ion-item>
                <ion-textarea v-model="info.description" :label="$t('business.info.description')" label-placement="stacked" :rows="4" />
              </ion-item>
            </ion-list>

            <!-- Opening hours -->
            <div class="edit-block">
              <p class="block-title">{{ $t('business.info.openingHours') }}</p>
              <div v-for="d in DAYS" :key="d" class="hours-row">
                <ion-toggle :checked="hours[d].active" @ionChange="hours[d].active = $event.detail.checked" />
                <span class="day-label">{{ $t('business.days.' + d) }}</span>
                <template v-if="hours[d].active">
                  <ion-input type="time" v-model="hours[d].open" class="time-in" />
                  <span class="time-dash">–</span>
                  <ion-input type="time" v-model="hours[d].close" class="time-in" />
                </template>
                <span v-else class="closed-lbl">{{ $t('business.info.closed') }}</span>
              </div>
            </div>

            <!-- Tags -->
            <div class="edit-block">
              <p class="block-title">{{ $t('business.info.tags') }}</p>
              <div v-if="tagsList.length" class="tags-wrap">
                <span v-for="(tag, i) in tagsList" :key="i" class="tag-chip">
                  #{{ tag }}<ion-icon :icon="closeCircle" @click="tagsList.splice(i, 1)" />
                </span>
              </div>
              <div class="tag-add">
                <ion-input v-model="newTag" :placeholder="$t('business.info.addTag')" @keyup.enter="addTag" />
                <ion-button size="small" color="carrot" :disabled="!newTag.trim()" @click="addTag">{{ $t('common.add') }}</ion-button>
              </div>
            </div>
          </section>

          <!-- PHOTOS -->
          <section v-else-if="tab === 'photos'" class="fade-in">
            <p class="section-hint">{{ $t('business.photos.hint', { max: features.maxPhotos === -1 ? '∞' : features.maxPhotos }) }}</p>
            <div class="photo-grid">
              <div v-if="heroImage" class="photo-thumb main-thumb">
                <img :src="heroImage" />
                <span class="main-badge">{{ $t('business.photos.main') }}</span>
              </div>
              <div v-for="p in photos" :key="p.id" class="photo-thumb">
                <img :src="p.url" />
                <ion-icon :icon="trashOutline" class="photo-remove" @click="deletePhoto(p.id)" />
              </div>
              <label v-if="canAddPhoto" class="photo-add">
                <ion-icon :icon="cameraOutline" />
                <input type="file" accept="image/*" hidden @change="onPhotoSelected" />
              </label>
            </div>
            <div v-if="!canAddPhoto" class="locked-note">
              <ion-icon :icon="lockClosedOutline" />
              <span>{{ $t('business.photos.limitReached') }}</span>
            </div>
          </section>

          <!-- MENU -->
          <section v-else-if="tab === 'menu'" class="fade-in">
            <div v-if="!features.menu" class="upgrade-lock">
              <ion-icon :icon="lockClosedOutline" />
              <h3>{{ $t('business.locked.title') }}</h3>
              <p>{{ $t('business.menu.locked') }}</p>
            </div>
            <template v-else>
              <div v-for="m in menu" :key="m.id" class="menu-row">
                <img v-if="m.photo_url" :src="m.photo_url" class="menu-photo" />
                <div class="menu-info">
                  <strong>{{ m.name }}</strong>
                  <span v-if="m.price != null" class="menu-price">${{ m.price }}</span>
                  <p v-if="m.description">{{ m.description }}</p>
                </div>
                <ion-icon :icon="trashOutline" @click="deleteMenuItem(m.id)" />
              </div>

              <!-- Add item -->
              <div class="menu-add-card">
                <label class="menu-photo-picker">
                  <img v-if="newMenu.photoPreview" :src="newMenu.photoPreview" />
                  <template v-else>
                    <ion-icon :icon="cameraOutline" />
                    <span>{{ $t('business.menu.addPhoto') }}</span>
                  </template>
                  <input type="file" accept="image/*" hidden @change="onMenuPhotoSelected" />
                </label>
                <div class="menu-add-fields">
                  <div class="add-inline">
                    <ion-input v-model="newMenu.name" :placeholder="$t('business.menu.itemName')" />
                    <ion-input v-model.number="newMenu.price" type="number" :placeholder="$t('business.menu.price')" class="price-in" />
                  </div>
                  <ion-textarea v-model="newMenu.description" :rows="2" :placeholder="$t('business.menu.itemDescription')" />
                  <ion-button expand="block" color="carrot" size="small" :disabled="!newMenu.name || addingMenu" @click="addMenu">
                    <ion-spinner v-if="addingMenu" name="crescent" slot="start" />
                    {{ $t('common.add') }}
                  </ion-button>
                </div>
              </div>
            </template>
          </section>

          <!-- HALAL -->
          <section v-else-if="tab === 'halal'" class="fade-in">
            <div v-if="hasUnpublished" class="draft-banner">
              <ion-icon :icon="createOutline" />
              <span>{{ $t('business.draft.unpublished') }}</span>
            </div>
            <div class="review-legend">
              <span class="legend-item"><span class="review-badge"><ion-icon :icon="shieldCheckmarkOutline" />{{ $t('business.info.reviewBadge') }}</span>{{ $t('business.info.legendReview') }}</span>
              <span class="legend-item"><ion-icon :icon="flashOutline" class="instant-icon" />{{ $t('business.info.legendInstant') }}</span>
            </div>
            <ion-list class="edit-list">
              <ion-item>
                <ion-select v-model="halal.halal_status" :label="$t('business.halal.status')" label-placement="stacked" interface="popover">
                  <ion-select-option value="certified">{{ $t('business.halal.certified') }}</ion-select-option>
                  <ion-select-option value="self_reported">{{ $t('business.halal.selfReported') }}</ion-select-option>
                  <ion-select-option value="muslim_friendly">{{ $t('business.halal.muslimFriendly') }}</ion-select-option>
                </ion-select>
                <span slot="end" class="review-badge field-badge"><ion-icon :icon="shieldCheckmarkOutline" />{{ $t('business.info.reviewBadge') }}</span>
                <ion-note slot="helper">{{ $t('business.info.reviewNeeded') }}</ion-note>
              </ion-item>

              <!-- Certified → certificate proof (single) -->
              <div v-if="halal.halal_status === 'certified'" class="proof-block">
                <p class="proof-title">{{ $t('business.halal.certProofTitle') }}</p>
                <p class="proof-sub">{{ $t('business.halal.certProofHint') }}</p>
                <div class="photo-grid">
                  <div v-if="halalCertUrl" class="photo-thumb">
                    <img :src="halalCertUrl" />
                    <ion-icon :icon="trashOutline" class="photo-remove" @click="halalCertUrl = ''" />
                  </div>
                  <label v-else class="photo-add">
                    <ion-spinner v-if="uploadingHalal" name="crescent" />
                    <ion-icon v-else :icon="cameraOutline" />
                    <input type="file" accept="image/*" hidden @change="onCertSelected" />
                  </label>
                </div>
              </div>

              <!-- Self-reported / Muslim-friendly → raw material photos (multiple) -->
              <div v-else-if="halal.halal_status === 'self_reported' || halal.halal_status === 'muslim_friendly'" class="proof-block">
                <p class="proof-title">{{ $t('business.halal.materialsTitle') }}</p>
                <p class="proof-sub">{{ $t('business.halal.materialsHint') }}</p>
                <div class="photo-grid">
                  <div v-for="(url, i) in halalMaterials" :key="i" class="photo-thumb">
                    <img :src="url" />
                    <ion-icon :icon="trashOutline" class="photo-remove" @click="halalMaterials.splice(i, 1)" />
                  </div>
                  <label class="photo-add">
                    <ion-spinner v-if="uploadingHalal" name="crescent" />
                    <ion-icon v-else :icon="cameraOutline" />
                    <input type="file" accept="image/*" multiple hidden @change="onMaterialsSelected" />
                  </label>
                </div>
              </div>

              <ion-item>
                <ion-toggle v-model="halal.has_prayer_room">{{ $t('facilityReview.facilities.prayerRoom') }}</ion-toggle>
              </ion-item>
              <ion-item>
                <ion-toggle v-model="halal.has_wudu">{{ $t('facilityReview.facilities.wudu') }}</ion-toggle>
              </ion-item>
              <ion-item>
                <ion-toggle v-model="halal.has_bidet">{{ $t('facilityReview.facilities.bidet') }}</ion-toggle>
              </ion-item>
              <ion-item>
                <ion-toggle v-model="halal.has_space_to_pray">{{ $t('facilityReview.facilities.spaceToPray') }}</ion-toggle>
              </ion-item>
              <ion-item>
                <ion-toggle v-model="halal.is_pork_free">{{ $t('facilityReview.facilities.porkFree') }}</ion-toggle>
              </ion-item>
              <ion-item>
                <ion-toggle v-model="halal.is_cash_only">{{ $t('facilityReview.facilities.cashOnly') }}</ion-toggle>
              </ion-item>
              <ion-item>
                <ion-toggle v-model="halal.has_halal_food">{{ $t('facilityReview.facilities.halalFood') }}</ion-toggle>
              </ion-item>
              <ion-item>
                <ion-toggle v-model="halal.has_vegan_option">{{ $t('facilityReview.facilities.veganOption') }}</ion-toggle>
              </ion-item>
              <ion-item>
                <ion-toggle v-model="halal.is_muslim_owned">{{ $t('facilityReview.facilities.muslimOwned') }}</ion-toggle>
              </ion-item>
              <ion-item>
                <ion-toggle v-model="halal.is_muslim_staff">{{ $t('facilityReview.facilities.muslimStaff') }}</ion-toggle>
              </ion-item>
              <ion-item>
                <ion-toggle v-model="halal.is_alcohol_free">{{ $t('facilityReview.facilities.alcoholFree') }}</ion-toggle>
              </ion-item>
              <ion-item>
                <ion-toggle v-model="halal.has_free_wifi">{{ $t('facilityReview.facilities.freeWifi') }}</ion-toggle>
              </ion-item>
              <ion-item>
                <ion-toggle v-model="halal.has_qibla_direction">{{ $t('facilityReview.facilities.qiblaDirection') }}</ion-toggle>
              </ion-item>
            </ion-list>
          </section>

          <!-- PROMOTIONS -->
          <section v-else-if="tab === 'promos'" class="fade-in">
            <div v-if="features.maxPromotions === 0" class="upgrade-lock">
              <ion-icon :icon="lockClosedOutline" />
              <h3>{{ $t('business.locked.title') }}</h3>
              <p>{{ $t('business.promos.locked') }}</p>
            </div>
            <template v-else>
              <div v-for="promo in promotions" :key="promo.id" class="promo-row">
                <div>
                  <strong>{{ promo.title }}</strong>
                  <p v-if="promo.body">{{ promo.body }}</p>
                </div>
                <div class="promo-actions">
                  <ion-toggle :checked="promo.is_active" @ionChange="togglePromo(promo)" />
                  <ion-icon :icon="trashOutline" @click="deletePromo(promo.id)" />
                </div>
              </div>
              <div class="add-inline column">
                <ion-input v-model="newPromo.title" :placeholder="$t('business.promos.titleField')" />
                <ion-textarea v-model="newPromo.body" :placeholder="$t('business.promos.bodyField')" :rows="2" />
                <ion-button color="carrot" size="small" :disabled="!newPromo.title" @click="addPromo">{{ $t('common.add') }}</ion-button>
              </div>
            </template>
          </section>

          <!-- ANALYTICS -->
          <section v-else-if="tab === 'analytics'" class="fade-in">
            <div v-if="analytics.level === 'pro'" class="export-row">
              <span class="digest-note">📧 {{ $t('business.analytics.digestOn') }}</span>
              <ion-button fill="outline" size="small" color="carrot" @click="exportCsv">
                <ion-icon :icon="downloadOutline" slot="start" />
                {{ $t('business.analytics.exportCsv') }}
              </ion-button>
            </div>

            <!-- Overview (all tiers) -->
            <div class="stat-grid">
              <div class="stat-card"><span class="stat-num">{{ analytics.total_views }}</span><span class="stat-label">{{ $t('business.analytics.views') }}</span></div>
              <div class="stat-card"><span class="stat-num">{{ analytics.detail_opens_30d }}</span><span class="stat-label">{{ $t('business.analytics.opens30') }}</span></div>
              <div class="stat-card"><span class="stat-num">{{ analytics.unique_viewers_30d }}</span><span class="stat-label">{{ $t('business.analytics.uniqueViewers') }}</span></div>
              <div class="stat-card"><span class="stat-num">{{ analytics.card_clicks_30d + analytics.marker_clicks_30d }}</span><span class="stat-label">{{ $t('business.analytics.impressions') }}</span></div>
            </div>

            <!-- Gold/Premium Stats (Visits & Reviews) -->
            <template v-if="analytics.level === 'pro'">
              <p class="an-section-title">✨ {{ $t('business.analytics.premiumInsights') || 'Visitor & Review Insights (Gold Plan)' }}</p>
              <div class="stat-grid gold-grid">
                <div class="stat-card gold-card">
                  <span class="stat-num">{{ analytics.total_visits_30d ?? 0 }}</span>
                  <span class="stat-label">👥 {{ $t('business.analytics.visits30d') || 'Visits (Last 30 Days)' }}</span>
                </div>
                <div class="stat-card gold-card">
                  <span class="stat-num">{{ analytics.total_reviews_30d ?? 0 }}</span>
                  <span class="stat-label">✍️ {{ $t('business.analytics.reviews30d') || 'Reviews (Last 30 Days)' }}</span>
                </div>
              </div>
            </template>
            <template v-else>
              <p class="an-section-title locked-title">✨ {{ $t('business.analytics.premiumInsights') || 'Visitor & Review Insights' }}</p>
              <div class="stat-grid locked-grid" @click="openUpgrade(true)">
                <div class="stat-card locked-card">
                  <span class="stat-num"><ion-icon :icon="lockClosedOutline" size="small" /></span>
                  <span class="stat-label">{{ $t('business.analytics.visits30d') || 'Visits (Last 30 Days)' }}</span>
                </div>
                <div class="stat-card locked-card">
                  <span class="stat-num"><ion-icon :icon="lockClosedOutline" size="small" /></span>
                  <span class="stat-label">{{ $t('business.analytics.reviews30d') || 'Reviews (Last 30 Days)' }}</span>
                </div>
              </div>
            </template>

            <!-- Intent actions (standard+) -->
            <template v-if="analytics.intents">
              <p class="an-section-title">{{ $t('business.analytics.actions30') }}</p>
              <div class="intent-grid">
                <div v-for="r in intentRows" :key="r.key" class="intent-cell">
                  <span class="intent-val">{{ r.value }}</span>
                  <span class="intent-lbl">{{ r.label }}</span>
                </div>
                <div class="intent-cell"><span class="intent-val">{{ analytics.saves ?? 0 }}</span><span class="intent-lbl">{{ $t('business.analytics.saves') }}</span></div>
              </div>
            </template>

            <!-- Audience (advanced) -->
            <template v-if="analytics.nationalities">
              <p class="an-section-title">{{ $t('business.analytics.audience') }}</p>
              <div v-if="analytics.nationalities.length" class="nat-list">
                <div v-for="n in analytics.nationalities" :key="n.code" class="nat-row">
                  <span class="nat-flag">{{ countryFlag(n.code) }}</span>
                  <span class="nat-name">{{ countryName(n.code) }}</span>
                  <div class="nat-bar-track"><div class="nat-bar" :style="{ width: barPct(n.count, audienceMax) }"></div></div>
                  <span class="nat-count">{{ n.count }}</span>
                </div>
              </div>
              <p v-else class="an-empty">{{ $t('business.analytics.noAudience') }}</p>

              <div v-if="analytics.gender?.length" class="gender-row">
                <span v-for="g in analytics.gender" :key="g.gender" class="gender-chip">{{ g.gender }}: {{ g.count }}</span>
              </div>

              <!-- Peak days -->
              <p class="an-section-title">{{ $t('business.analytics.peakDays') }}</p>
              <div class="peak-bars">
                <div v-for="d in dowBars" :key="d.label" class="peak-col">
                  <div class="peak-bar" :style="{ height: barPct(d.count, maxDow) }"></div>
                  <span class="peak-lbl">{{ d.label }}</span>
                </div>
              </div>

              <!-- Peak hours -->
              <p class="an-section-title">{{ $t('business.analytics.peakHours') }}</p>
              <div class="peak-bars hours">
                <div v-for="h in hourBars" :key="h.h" class="peak-col">
                  <div class="peak-bar" :style="{ height: barPct(h.count, maxHour) }" :title="`${h.h}:00 — ${h.count}`"></div>
                  <span v-if="h.h % 6 === 0" class="peak-lbl">{{ h.h }}</span>
                </div>
              </div>

              <!-- Views trend -->
              <template v-if="analytics.timeseries?.length">
                <p class="an-section-title">{{ $t('business.analytics.viewsTrend') }}</p>
                <div class="spark">
                  <div v-for="d in analytics.timeseries" :key="d.date" class="spark-bar"
                       :style="{ height: sparkHeight(d.count) }" :title="`${d.date}: ${d.count}`"></div>
                </div>
              </template>
            </template>

            <!-- PRO (Gold): funnel + benchmark + search terms -->
            <template v-if="analytics.funnel">
              <p class="an-section-title">{{ $t('business.analytics.funnel') }}</p>
              <div class="funnel">
                <div class="funnel-step"><span class="funnel-num">{{ analytics.funnel.impressions }}</span><span class="funnel-lbl">{{ $t('business.analytics.fImpressions') }}</span></div>
                <div class="funnel-arrow"><small>{{ analytics.funnel.open_rate }}%</small>→</div>
                <div class="funnel-step"><span class="funnel-num">{{ analytics.funnel.opens }}</span><span class="funnel-lbl">{{ $t('business.analytics.fOpens') }}</span></div>
                <div class="funnel-arrow"><small>{{ analytics.funnel.action_rate }}%</small>→</div>
                <div class="funnel-step"><span class="funnel-num">{{ analytics.funnel.actions }}</span><span class="funnel-lbl">{{ $t('business.analytics.fActions') }}</span></div>
              </div>
            </template>

            <template v-if="analytics.benchmark && analytics.benchmark.category_total > 1">
              <p class="an-section-title">{{ $t('business.analytics.benchmark') }}</p>
              <div class="bench-card">
                <div class="bench-rank">
                  <span class="bench-hash">#{{ analytics.benchmark.rank }}</span>
                  <span class="bench-of">{{ $t('business.analytics.ofCategory', { total: analytics.benchmark.category_total, category: analytics.benchmark.category }) }}</span>
                </div>
                <div class="bench-pct">{{ $t('business.analytics.topPercent', { pct: 100 - analytics.benchmark.percentile }) }}</div>
                <div class="bench-compare">
                  <span>{{ $t('business.analytics.yourOpens', { n: analytics.benchmark.my_opens_30d }) }}</span>
                  <span class="bench-vs">{{ $t('business.analytics.categoryAvg', { n: analytics.benchmark.category_avg_30d }) }}</span>
                </div>
              </div>
            </template>

            <template v-if="analytics.search_terms">
              <p class="an-section-title">{{ $t('business.analytics.searchTerms') }}</p>
              <div v-if="analytics.search_terms.length" class="term-wrap">
                <span v-for="s in analytics.search_terms" :key="s.q" class="term-chip">{{ s.q }} <b>{{ s.count }}</b></span>
              </div>
              <p v-else class="an-empty">{{ $t('business.analytics.noTerms') }}</p>
            </template>

            <!-- Upgrade prompt -->
            <div v-if="analytics.level !== 'pro'" class="locked-note">
              <ion-icon :icon="lockClosedOutline" />
              <span>{{ upgradeMsg }}</span>
            </div>
          </section>

          <!-- REPORTS -->
          <section v-else-if="tab === 'reports'" class="fade-in">
            <div v-if="reports.length === 0" class="empty-inline">
              <ion-icon :icon="checkmarkCircleOutline" color="success" />
              <p>{{ $t('business.reports.none') }}</p>
            </div>
            <div v-for="r in reports" :key="r.id" class="report-row">
              <ion-badge :color="r.status === 'pending' ? 'warning' : 'medium'">{{ r.status }}</ion-badge>
              <p>{{ r.description }}</p>
              <span class="report-date">{{ formatDate(r.created_at) }}</span>
            </div>
          </section>

          <!-- REVIEWS -->
          <section v-else-if="tab === 'reviews'" class="fade-in">
            <div v-if="loadingReviews" class="ion-text-center ion-padding">
              <ion-spinner name="crescent" color="carrot" />
            </div>
            <template v-else>
              <!-- Filter & Sort controls -->
              <div class="reviews-filter-bar">
                <ion-item lines="none" class="filter-item">
                  <ion-select v-model="reviewsFilter" interface="popover" :label="$t('common.filter') || 'Filter'" label-placement="fixed" class="carrot-select">
                    <ion-select-option value="all">All Reviews</ion-select-option>
                    <ion-select-option value="unreplied">Unreplied Only</ion-select-option>
                  </ion-select>
                </ion-item>
                <ion-item lines="none" class="filter-item">
                  <ion-select v-model="reviewsSort" interface="popover" :label="$t('common.sort') || 'Sort'" label-placement="fixed" class="carrot-select">
                    <ion-select-option value="recent">Recent Reviews</ion-select-option>
                    <ion-select-option value="unreplied_first">Not Replied First</ion-select-option>
                  </ion-select>
                </ion-item>
              </div>

              <div v-if="processedReviews.length === 0" class="empty-inline">
                <ion-icon :icon="chatbubbleOutline" color="medium" />
                <p>No matching reviews found.</p>
              </div>
              <div v-else class="review-manager-list">
                <div v-for="rev in processedReviews" :key="rev.id" class="review-manage-card">
                  <div class="rev-manage-header">
                    <ion-avatar class="rev-avatar">
                      <img :src="rev.user_profiles?.public_profile ? rev.user_profiles?.avatar_url || '/favicon-32x32.png' : '/favicon-32x32.png'" />
                    </ion-avatar>
                    <div class="rev-info">
                      <h4 class="rev-username">{{ rev.user_profiles?.public_profile ? rev.user_profiles?.display_name || 'User' : ($t('profile.anonymous') || 'Anonymous') }}</h4>
                      <span class="rev-date">{{ formatDate(rev.created_at) }}</span>
                    </div>
                    <div class="rev-stars" v-if="rev.rating">
                      <ion-icon v-for="starIndex in 5" :key="starIndex" :icon="starIndex <= rev.rating ? star : starOutline" :color="starIndex <= rev.rating ? 'warning' : 'medium'" />
                    </div>
                  </div>

                  <p class="rev-comment-text" v-if="rev.comment">"{{ rev.comment }}"</p>

                  <div class="rev-facilities-checked" v-if="hasFacilities(rev.facilities)">
                    <span v-for="fac in getReviewFacilities(rev.facilities)" :key="fac.code" class="rev-fac-badge" :class="fac.val">
                      {{ fac.icon }} {{ getShortLabel(fac.code) }}: {{ fac.val.toUpperCase() }}
                    </span>
                  </div>

                  <!-- Response Section -->
                  <div class="reply-container">
                    <div v-if="replyingToId === rev.id" class="reply-editor-box">
                      <ion-textarea 
                        v-model="activeReplyText" 
                        :placeholder="$t('business.reviews.replyPlaceholder') || 'Write your response to this customer...'"
                        class="reply-textarea"
                        :rows="3"
                        :maxlength="500"
                      />
                      <div class="reply-editor-actions">
                        <ion-button fill="clear" color="medium" size="small" @click="cancelReply">
                          {{ $t('common.cancel') }}
                        </ion-button>
                        <ion-button color="carrot" size="small" :disabled="submittingReply || !activeReplyText.trim()" @click="submitReply(rev.id)">
                          <ion-spinner name="crescent" v-if="submittingReply" slot="start" />
                          {{ $t('common.submit') }}
                        </ion-button>
                      </div>
                    </div>
                    <div v-else-if="rev.owner_response" class="existing-reply-box">
                      <div class="reply-box-header">
                        <span class="reply-by-label">🏪 {{ $t('business.reviews.yourResponse') || 'Your Response' }}</span>
                        <span class="reply-date-label" v-if="rev.owner_responded_at">{{ formatDate(rev.owner_responded_at) }}</span>
                      </div>
                      <p class="reply-content-text">{{ rev.owner_response }}</p>
                      <div class="reply-box-footer">
                        <ion-button fill="clear" color="carrot" size="small" class="reply-edit-btn" @click="startReply(rev)">
                          <ion-icon :icon="createOutline" slot="start" />
                          {{ $t('common.edit') }}
                        </ion-button>
                      </div>
                    </div>
                    <div v-else class="no-reply-yet">
                      <ion-button fill="outline" color="carrot" size="small" @click="startReply(rev)">
                        <ion-icon :icon="chatbubbleEllipsesOutline" slot="start" />
                        {{ $t('business.reviews.replyAction') || 'Reply to Review' }}
                      </ion-button>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </section>
        </div>
      </template>
    </ion-content>

    <!-- Draft / Preview / Publish action bar (listing-info tabs only) -->
    <ion-footer v-if="!loading && (tab === 'info' || tab === 'halal')" class="ion-no-border action-footer">
      <div class="action-bar">
        <ion-button fill="clear" color="medium" class="act-preview" @click="openPreview">
          <ion-icon :icon="eyeOutline" slot="start" />
          {{ $t('business.draft.preview') }}
        </ion-button>
        <ion-button fill="outline" color="carrot" class="act-draft" :disabled="saving" @click="saveDraft">
          {{ $t('business.draft.save') }}
        </ion-button>
        <ion-button color="carrot" class="act-publish" :disabled="saving" @click="publish">
          <ion-spinner v-if="saving" name="crescent" slot="start" />
          {{ $t('business.draft.publish') }}
        </ion-button>
      </div>
    </ion-footer>

    <!-- Public preview -->
    <ion-modal :is-open="showPreview" @didDismiss="showPreview = false">
      <ion-header class="ion-no-border">
        <ion-toolbar>
          <ion-title>{{ $t('business.draft.previewTitle') }}</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="showPreview = false">{{ $t('common.close') }}</ion-button>
          </ion-buttons>
        </ion-toolbar>
        <div class="preview-hint">{{ $t('business.draft.previewHint') }}</div>
      </ion-header>
      <ion-content>
        <div class="pv-hero">
          <img :src="heroImage || 'https://placehold.co/600x300?text=No+Image'" />
        </div>
        <div class="pv-body">
          <h1 class="pv-name">{{ info.name || '—' }}</h1>
          <div class="pv-chips">
            <span class="pv-type">{{ typeName }}</span>
            <span v-if="halal.halal_status" class="pv-halal" :class="halal.halal_status">{{ halalLabel }}</span>
          </div>
          <div class="pv-attrs" v-if="halal.has_prayer_room || halal.has_wudu || halal.is_alcohol_free || halal.has_bidet || halal.has_space_to_pray || halal.is_pork_free || halal.is_cash_only || halal.has_halal_food || halal.has_vegan_option || halal.is_muslim_owned || halal.is_muslim_staff || halal.has_free_wifi || halal.has_qibla_direction">
            <span v-if="halal.has_prayer_room">🕌 {{ $t('facilityReview.facilities.prayerRoom') }}</span>
            <span v-if="halal.has_wudu">🚰 {{ $t('facilityReview.facilities.wudu') }}</span>
            <span v-if="halal.has_bidet">🚿 {{ $t('facilityReview.facilities.bidet') }}</span>
            <span v-if="halal.has_space_to_pray">🧎 {{ $t('facilityReview.facilities.spaceToPray') }}</span>
            <span v-if="halal.is_pork_free">🚫🐷 {{ $t('facilityReview.facilities.porkFree') }}</span>
            <span v-if="halal.is_cash_only">💵 {{ $t('facilityReview.facilities.cashOnly') }}</span>
            <span v-if="halal.has_halal_food">🍽️ {{ $t('facilityReview.facilities.halalFood') }}</span>
            <span v-if="halal.has_vegan_option">🌱 {{ $t('facilityReview.facilities.veganOption') }}</span>
            <span v-if="halal.is_muslim_owned">👤 {{ $t('facilityReview.facilities.muslimOwned') }}</span>
            <span v-if="halal.is_muslim_staff">👥 {{ $t('facilityReview.facilities.muslimStaff') }}</span>
            <span v-if="halal.is_alcohol_free">🚫🍺 {{ $t('facilityReview.facilities.alcoholFree') }}</span>
            <span v-if="halal.has_free_wifi">📶 {{ $t('facilityReview.facilities.freeWifi') }}</span>
            <span v-if="halal.has_qibla_direction">🧭 {{ $t('facilityReview.facilities.qiblaDirection') }}</span>
          </div>
          <div v-if="halalCertUrl || halalMaterials.length" class="pv-proof">
            <p class="pv-proof-label">{{ halal.halal_status === 'certified' ? $t('business.halal.certProofTitle') : $t('business.halal.materialsTitle') }}</p>
            <div class="pv-proof-imgs">
              <img v-if="halalCertUrl" :src="halalCertUrl" />
              <img v-for="(u, i) in halalMaterials" :key="i" :src="u" />
            </div>
          </div>
          <p v-if="info.description" class="pv-desc">{{ info.description }}</p>
          <div class="pv-rows">
            <div v-if="info.address" class="pv-row"><ion-icon :icon="navigateOutline" /><span>{{ info.address }}</span></div>
            <div v-if="info.phone" class="pv-row"><ion-icon :icon="callOutline" /><span>{{ info.phone }}</span></div>
            <div v-if="info.instagram" class="pv-row"><ion-icon :icon="logoInstagram" /><span>@{{ info.instagram.replace('@','') }}</span></div>
            <div v-if="info.price_range" class="pv-row"><ion-icon :icon="pricetagOutline" /><span>{{ info.price_range }}</span></div>
          </div>
        </div>
      </ion-content>
    </ion-modal>

    <!-- Business plan paywall (admin preview only; owners upgrade from the overview) -->
    <BusinessUpgradeModal v-model:open="showUpgrade" :current-tier="tier" :preview="previewMode" @purchased="onUpgraded" />
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import mapsLoader from '@/plugins/googleMapsLoader'
import {
  IonPage, IonHeader, IonContent, IonSpinner, IonSegment, IonSegmentButton,
  IonLabel, IonList, IonItem, IonInput, IonTextarea, IonButton, IonIcon,
  IonSelect, IonSelectOption, IonToggle, IonNote, IonBadge, IonFooter,
  IonModal, IonToolbar, IonTitle, IonButtons, IonAvatar,
  toastController, onIonViewWillEnter
} from '@ionic/vue'
import {
  trashOutline, cameraOutline, lockClosedOutline, checkmarkCircleOutline,
  createOutline, eyeOutline, navigateOutline, callOutline, logoInstagram, pricetagOutline,
  closeCircle, downloadOutline, shieldCheckmarkOutline, flashOutline,
  chatbubbleOutline, chatbubbleEllipsesOutline, star, starOutline
} from 'ionicons/icons'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import AppHeader from '@/components/AppHeader.vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { supabase } from '@/plugins/supabaseClient'
import { useBusinessListings } from '@/composables/useBusinessListings'
import { useLocationEntitlements } from '@/composables/useLocationEntitlements'
import { useLocationAnalytics, type BusinessAnalytics } from '@/composables/useLocationAnalytics'
import { isAdmin } from '@/composables/userProfile'
import { ActivityLogService } from '@/services/ActivityLogService'
import BusinessUpgradeModal from '@/components/BusinessUpgradeModal.vue'
import type { PlanFeatures, PlanTier, LocationPhoto, LocationMenuItem, LocationPromotion } from '@/types/Business'
import { MUSLIM_FACILITIES } from '@/constants/muslimFacilities'

const route = useRoute()
const { t } = useI18n()
const locationId = Number(route.params.locationId)

const biz = useBusinessListings()
const { getFeatures } = useLocationEntitlements()
const { getAnalytics } = useLocationAnalytics()

const loading = ref(true)
const saving = ref(false)
const tab = ref('info')
const tier = ref<PlanTier>('free')
const features = ref<PlanFeatures>({ maxPhotos: 1, menu: false, maxPromotions: 0, analytics: 'basic' })
const locationName = ref('')

// Draft / preview
const hasUnpublished = ref(false)
const showPreview = ref(false)
const heroImage = ref<string | null>(null)
const typeName = ref('')

const halalLabel = computed(() => {
  const map: Record<string, string> = {
    certified: t('business.halal.certified'),
    self_reported: t('business.halal.selfReported'),
    muslim_friendly: t('business.halal.muslimFriendly'),
  }
  return map[halal.value.halal_status] ?? ''
})

const info = ref({ name: '', address: '', phone: '', instagram: '', facebook: '', tiktok: '', website: '', line_id: '', foodpanda_url: '', ubereats_url: '', price_range: '', description: '' })

// Location coordinates (high-risk, like name/address — edits queue for admin review).
// Fine-tuned via the map below the address field, kept in sync with the address by geocoding.
const DEFAULT_CENTER = { lat: 25.0343, lng: 121.5645 }
const coords = ref<{ lat: number; lng: number }>({ ...DEFAULT_CENTER })
const mapLoading = ref(true)
const mapReady = ref(false)

// Price range as actual NT$ tiers (value stays the $ symbol for compatibility)
const priceRanges = [
  { value: '$', label: '$ · Under NT$150' },
  { value: '$$', label: '$$ · NT$150–350' },
  { value: '$$$', label: '$$$ · NT$350–650' },
  { value: '$$$$', label: '$$$$ · Over NT$650' },
]
const halal = ref({
  halal_status: '' as string,
  has_prayer_room: false,
  has_wudu: false,
  is_alcohol_free: false,
  has_bidet: false,
  has_space_to_pray: false,
  is_pork_free: false,
  is_cash_only: false,
  has_halal_food: false,
  has_vegan_option: false,
  is_muslim_owned: false,
  is_muslim_staff: false,
  has_free_wifi: false,
  has_qibla_direction: false
})
const halalCertUrl = ref('')
const halalMaterials = ref<string[]>([])
const uploadingHalal = ref(false)

// Opening hours (day-by-day, matches AddPlaceView's custom format) + tags
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
type DayHours = { active: boolean; open: string; close: string }
function defaultHours(): Record<string, DayHours> {
  return Object.fromEntries(DAYS.map(d => [d, { active: d !== 'sun', open: '09:00', close: '18:00' }]))
}
const hours = ref<Record<string, DayHours>>(defaultHours())
const tagsList = ref<string[]>([])
const newTag = ref('')

function addTag() {
  const v = newTag.value.trim().replace(/^#/, '')
  if (v && !tagsList.value.includes(v)) tagsList.value.push(v)
  newTag.value = ''
}

// Normalize DB opening_hours (custom day keys or Google `periods`) into day format
function normalizeHours(dbHours: any): Record<string, DayHours> {
  const out = defaultHours()
  if (!dbHours) return out
  if (dbHours.mon || dbHours.tue || dbHours.wed || dbHours.thu || dbHours.fri || dbHours.sat || dbHours.sun) {
    for (const d of DAYS) if (dbHours[d]) out[d] = { active: !!dbHours[d].active, open: dbHours[d].open || '09:00', close: dbHours[d].close || '18:00' }
    return out
  }
  if (Array.isArray(dbHours.periods)) {
    const map: Record<number, string> = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' }
    for (const d of DAYS) out[d].active = false
    for (const p of dbHours.periods) {
      const d = map[p?.open?.day]
      if (!d) continue
      const fmt = (t: string) => (t && t.length === 4 ? `${t.slice(0, 2)}:${t.slice(2)}` : t)
      out[d] = { active: true, open: fmt(p.open?.time) || '09:00', close: fmt(p.close?.time) || '18:00' }
    }
    return out
  }
  return out
}

const photos = ref<LocationPhoto[]>([])
const menu = ref<LocationMenuItem[]>([])
const addingMenu = ref(false)
const newMenu = ref<{ name: string; price: number | null; description: string; photoFile: File | null; photoPreview: string }>(
  { name: '', price: null, description: '', photoFile: null, photoPreview: '' }
)
const promotions = ref<LocationPromotion[]>([])
const newPromo = ref({ title: '', body: '' })
const analytics = ref<BusinessAnalytics>({ level: 'basic', total_views: 0, detail_opens_30d: 0, unique_viewers_30d: 0, card_clicks_30d: 0, marker_clicks_30d: 0 })
const reports = ref<any[]>([])
const businessReviews = ref<any[]>([])
const loadingReviews = ref(false)
const replyingToId = ref<number | null>(null)
const activeReplyText = ref('')
const submittingReply = ref(false)

const reviewsFilter = ref<'all' | 'unreplied'>('all')
const reviewsSort = ref<'recent' | 'unreplied_first'>('recent')

const processedReviews = computed(() => {
  let list = [...businessReviews.value]
  
  if (reviewsFilter.value === 'unreplied') {
    list = list.filter(rev => !rev.owner_response)
  }
  
  if (reviewsSort.value === 'recent') {
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  } else if (reviewsSort.value === 'unreplied_first') {
    list.sort((a, b) => {
      const aReplied = !!a.owner_response
      const bReplied = !!b.owner_response
      if (aReplied !== bReplied) {
        return aReplied ? 1 : -1
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }
  
  return list
})

const canAddPhoto = computed(() => features.value.maxPhotos === -1 || photos.value.length < features.value.maxPhotos)

onIonViewWillEnter(async () => {
  loading.value = true
  try {
    const { data: loc } = await supabase
      .from('locations')
      .select('name, address, lat, lng, phone, instagram, facebook, tiktok, website, line_id, foodpanda_url, ubereats_url, price_range, description, image, opening_hours, tags, halal_status, has_prayer_room, has_wudu, is_alcohol_free, has_bidet, has_space_to_pray, is_pork_free, is_cash_only, has_halal_food, has_vegan_option, is_muslim_owned, is_muslim_staff, has_free_wifi, has_qibla_direction, halal_cert_url, halal_material_photos, location_types(name)')
      .eq('id', locationId)
      .maybeSingle()

    if (loc) {
      locationName.value = loc.name
      heroImage.value = loc.image ?? null
      const lt: any = Array.isArray(loc.location_types) ? loc.location_types[0] : loc.location_types
      typeName.value = lt?.name ?? ''
      info.value = {
        name: loc.name ?? '', address: loc.address ?? '', phone: loc.phone ?? '',
        instagram: loc.instagram ?? '', facebook: loc.facebook ?? '', tiktok: loc.tiktok ?? '', website: loc.website ?? '',
        line_id: loc.line_id ?? '', foodpanda_url: loc.foodpanda_url ?? '',
        ubereats_url: loc.ubereats_url ?? '',
        price_range: loc.price_range ?? '', description: loc.description ?? '',
      }
      halal.value = {
        halal_status: loc.halal_status ?? '',
        has_prayer_room: loc.has_prayer_room ?? false,
        has_wudu: loc.has_wudu ?? false,
        is_alcohol_free: loc.is_alcohol_free ?? false,
        has_bidet: loc.has_bidet ?? false,
        has_space_to_pray: loc.has_space_to_pray ?? false,
        is_pork_free: loc.is_pork_free ?? false,
        is_cash_only: loc.is_cash_only ?? false,
        has_halal_food: loc.has_halal_food ?? false,
        has_vegan_option: loc.has_vegan_option ?? false,
        is_muslim_owned: loc.is_muslim_owned ?? false,
        is_muslim_staff: loc.is_muslim_staff ?? false,
        has_free_wifi: loc.has_free_wifi ?? false,
        has_qibla_direction: loc.has_qibla_direction ?? false
      }
      halalCertUrl.value = loc.halal_cert_url ?? ''
      halalMaterials.value = Array.isArray(loc.halal_material_photos) ? (loc.halal_material_photos as string[]) : []
      hours.value = normalizeHours(loc.opening_hours)
      tagsList.value = Array.isArray(loc.tags) ? (loc.tags as string[]) : []
      if (typeof loc.lat === 'number' && typeof loc.lng === 'number') coords.value = { lat: loc.lat, lng: loc.lng }
    }

    // Overlay any unpublished draft on top of the live values so the owner keeps editing their draft
    const draft = await biz.getDraft(locationId)
    hasUnpublished.value = Object.keys(draft).length > 0
    applyDraft(draft)

    const ent = await getFeatures(locationId)
    tier.value = ent.tier
    features.value = ent.features

    await Promise.all([
      loadPhotos().catch(e => console.error('loadPhotos failed:', e)),
      loadMenu().catch(e => console.error('loadMenu failed:', e)),
      loadPromotions().catch(e => console.error('loadPromotions failed:', e)),
      loadAnalytics().catch(e => console.error('loadAnalytics failed:', e)),
      loadReports().catch(e => console.error('loadReports failed:', e)),
      loadReviews().catch(e => console.error('loadReviews failed:', e))
    ])
  } catch (err) {
    console.error('onIonViewWillEnter failed:', err)
  } finally {
    loading.value = false
  }

  // The map lives in the Info tab; init once the DOM for it exists.
  if (tab.value === 'info') nextTick(ensureMap)
})

function applyDraft(draft: Record<string, unknown>) {
  const i = info.value, h = halal.value
  if ('name' in draft) i.name = String(draft.name ?? '')
  if ('address' in draft) i.address = String(draft.address ?? '')
  if (typeof draft.lat === 'number' && typeof draft.lng === 'number') coords.value = { lat: draft.lat as number, lng: draft.lng as number }
  if ('phone' in draft) i.phone = String(draft.phone ?? '')
  if ('instagram' in draft) i.instagram = String(draft.instagram ?? '')
  if ('facebook' in draft) i.facebook = String(draft.facebook ?? '')
  if ('tiktok' in draft) i.tiktok = String(draft.tiktok ?? '')
  if ('website' in draft) i.website = String(draft.website ?? '')
  if ('line_id' in draft) i.line_id = String(draft.line_id ?? '')
  if ('foodpanda_url' in draft) i.foodpanda_url = String(draft.foodpanda_url ?? '')
  if ('ubereats_url' in draft) i.ubereats_url = String(draft.ubereats_url ?? '')
  if ('price_range' in draft) i.price_range = String(draft.price_range ?? '')
  if ('description' in draft) i.description = String(draft.description ?? '')
  if ('halal_status' in draft) h.halal_status = String(draft.halal_status ?? '')
  if ('has_prayer_room' in draft) h.has_prayer_room = !!draft.has_prayer_room
  if ('has_wudu' in draft) h.has_wudu = !!draft.has_wudu
  if ('is_alcohol_free' in draft) h.is_alcohol_free = !!draft.is_alcohol_free
  if ('has_bidet' in draft) h.has_bidet = !!draft.has_bidet
  if ('has_space_to_pray' in draft) h.has_space_to_pray = !!draft.has_space_to_pray
  if ('is_pork_free' in draft) h.is_pork_free = !!draft.is_pork_free
  if ('is_cash_only' in draft) h.is_cash_only = !!draft.is_cash_only
  if ('has_halal_food' in draft) h.has_halal_food = !!draft.has_halal_food
  if ('has_vegan_option' in draft) h.has_vegan_option = !!draft.has_vegan_option
  if ('is_muslim_owned' in draft) h.is_muslim_owned = !!draft.is_muslim_owned
  if ('is_muslim_staff' in draft) h.is_muslim_staff = !!draft.is_muslim_staff
  if ('has_free_wifi' in draft) h.has_free_wifi = !!draft.has_free_wifi
  if ('has_qibla_direction' in draft) h.has_qibla_direction = !!draft.has_qibla_direction
  if ('halal_cert_url' in draft) halalCertUrl.value = String(draft.halal_cert_url ?? '')
  if ('halal_material_photos' in draft) halalMaterials.value = Array.isArray(draft.halal_material_photos) ? draft.halal_material_photos as string[] : []
  if ('opening_hours' in draft) hours.value = normalizeHours(draft.opening_hours)
  if ('tags' in draft) tagsList.value = Array.isArray(draft.tags) ? draft.tags as string[] : []
}

/** All editable listing fields as a patch (info + halal). */
function buildPatch(): Record<string, unknown> {
  return {
    name: info.value.name, address: info.value.address,
    lat: coords.value.lat, lng: coords.value.lng,
    phone: info.value.phone,
    instagram: info.value.instagram, facebook: info.value.facebook,
    tiktok: info.value.tiktok, website: info.value.website, line_id: info.value.line_id,
    foodpanda_url: info.value.foodpanda_url, ubereats_url: info.value.ubereats_url,
    price_range: info.value.price_range,
    description: info.value.description,
    halal_status: halal.value.halal_status || null,
    has_prayer_room: halal.value.has_prayer_room,
    has_wudu: halal.value.has_wudu,
    is_alcohol_free: halal.value.is_alcohol_free,
    has_bidet: halal.value.has_bidet,
    has_space_to_pray: halal.value.has_space_to_pray,
    is_pork_free: halal.value.is_pork_free,
    is_cash_only: halal.value.is_cash_only,
    has_halal_food: halal.value.has_halal_food,
    has_vegan_option: halal.value.has_vegan_option,
    is_muslim_owned: halal.value.is_muslim_owned,
    is_muslim_staff: halal.value.is_muslim_staff,
    has_free_wifi: halal.value.has_free_wifi,
    has_qibla_direction: halal.value.has_qibla_direction,
    halal_cert_url: halalCertUrl.value || null,
    halal_material_photos: halalMaterials.value,
    opening_hours: hours.value,
    tags: tagsList.value,
  }
}

/** Certified requires a certificate; self-reported / muslim-friendly require material photos. */
function halalProofMissing(): string | null {
  if (halal.value.halal_status === 'certified' && !halalCertUrl.value) return t('business.halal.certRequired')
  if ((halal.value.halal_status === 'self_reported' || halal.value.halal_status === 'muslim_friendly') && halalMaterials.value.length === 0) {
    return t('business.halal.materialsRequired')
  }
  return null
}

async function uploadHalalFile(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `halal/${locationId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from('location-image').upload(path, file, { upsert: false })
  if (error) { console.error('[halal proof]', error); return null }
  const { data: pub } = supabase.storage.from('location-image').getPublicUrl(path)
  return pub?.publicUrl ?? null
}

async function onCertSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  uploadingHalal.value = true
  try {
    const url = await uploadHalalFile(file)
    if (url) halalCertUrl.value = url
  } finally { uploadingHalal.value = false }
}

async function onMaterialsSelected(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files) return
  const files = Array.from(input.files)
  input.value = ''
  uploadingHalal.value = true
  try {
    for (const file of files) {
      const url = await uploadHalalFile(file)
      if (url) halalMaterials.value.push(url)
    }
  } finally { uploadingHalal.value = false }
}

function openPreview() { showPreview.value = true }

async function saveDraft() {
  saving.value = true
  try {
    await biz.saveDraft(locationId, buildPatch())
    hasUnpublished.value = true
    await toast(t('business.draft.saved'), 'success')
  } catch (e: any) {
    await toast(e?.message || t('common.error'), 'danger')
  } finally { saving.value = false }
}

async function publish() {
  const missing = halalProofMissing()
  if (missing) { await toast(missing, 'warning'); tab.value = 'halal'; return }
  saving.value = true
  try {
    const res = await biz.publishDraft(locationId, buildPatch())
    hasUnpublished.value = false
    const queued = Object.keys(res?.queued ?? {})
    await toast(queued.length ? t('business.draft.publishedQueued', { fields: queued.join(', ') }) : t('business.draft.published'), 'success')
  } catch (e: any) {
    await toast(e?.message || t('common.error'), 'danger')
  } finally { saving.value = false }
}

// ---------------------------------------------------------------------------
// Address ↔ map geocoding (mirrors AddPlaceView). The map lives in the Info tab
// and is (re)created whenever that tab is shown, since it's behind a v-if.
// ---------------------------------------------------------------------------
let map: google.maps.Map | null = null
let marker: any = null
let pinEl: any = null
let clickListener: google.maps.MapsEventListener | null = null
let geocoder: google.maps.Geocoder | null = null
// Guards against address→coords and coords→address updates fighting each other.
const coordSource = ref<'address' | 'map' | null>(null)

function carrotColor() {
  return getComputedStyle(document.documentElement).getPropertyValue('--ion-color-carrot').trim() || '#d8620d'
}

async function ensureMap() {
  const el = document.getElementById('biz-map')
  if (!el || map) return
  mapLoading.value = true
  const [{ Map }, markerLib] = await Promise.all([
    mapsLoader.importLibrary('maps'),
    mapsLoader.importLibrary('marker'),
  ])
  map = new Map(el as HTMLElement, {
    center: coords.value, zoom: 15, disableDefaultUI: true,
    mapId: 'a40f1ec0ad0afbbb12694f19', gestureHandling: 'greedy',
  })
  pinEl = new markerLib.PinElement({ background: carrotColor(), borderColor: '#fff', glyphColor: '#fff', scale: 1.2 })
  marker = new markerLib.AdvancedMarkerElement({ map, position: coords.value, content: pinEl.element, gmpDraggable: true, zIndex: 10 })

  const onReady = () => { mapReady.value = true; requestAnimationFrame(() => { mapLoading.value = false }) }
  google.maps.event.addListenerOnce(map, 'idle', onReady)
  setTimeout(() => { if (!mapReady.value) onReady() }, 3000)

  // Drag the pin or tap the map to fine-tune the exact spot, then reverse-geocode.
  marker.addListener('dragend', () => {
    const p = marker.position
    if (!p) return
    const lat = typeof p.lat === 'function' ? p.lat() : p.lat
    const lng = typeof p.lng === 'function' ? p.lng() : p.lng
    applyMapPoint(lat, lng)
  })
  clickListener = map.addListener('click', (e: google.maps.MapMouseEvent) => {
    if (e.latLng) applyMapPoint(e.latLng.lat(), e.latLng.lng())
  })
}

function teardownMap() {
  clickListener?.remove(); clickListener = null
  map = null; marker = null; pinEl = null; mapReady.value = false; mapLoading.value = true
}

async function applyMapPoint(lat: number, lng: number) {
  coordSource.value = 'map'
  coords.value = { lat, lng }
  if (marker) marker.position = { lat, lng }
  map?.panTo({ lat, lng })
  const addr = await reverseGeocode(lat, lng)
  if (addr) info.value.address = addr
  coordSource.value = null
}

function ensureGeocoder() {
  if (!geocoder) geocoder = new google.maps.Geocoder()
  return geocoder
}

function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  return new Promise((resolve) => {
    ensureGeocoder().geocode({ location: { lat, lng } }, (res, status) =>
      resolve(status === 'OK' && res?.[0] ? res[0].formatted_address : null))
  })
}

function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    ensureGeocoder().geocode({ address, region: 'TW', componentRestrictions: { country: 'TW' } }, (res, status) => {
      if (status === 'OK' && res?.[0]) {
        const loc = res[0].geometry.location
        resolve({ lat: loc.lat(), lng: loc.lng() })
      } else resolve(null)
    })
  })
}

// Address field blur → geocode → move the pin (skipped if the map just set the address).
async function onAddressConfirm() {
  if (coordSource.value === 'map' || !mapReady.value) return
  const addr = info.value.address?.trim()
  if (!addr || addr.length < 8) return
  coordSource.value = 'address'
  try {
    const point = await geocodeAddress(addr)
    if (point) {
      coords.value = point
      if (marker) marker.position = point
      map?.panTo(point); map?.setZoom(16)
    }
  } finally { coordSource.value = null }
}

// (Re)create the map each time the Info tab is shown; tear it down when leaving.
watch(tab, (val, old) => {
  if (val === 'info') nextTick(ensureMap)
  else if (old === 'info') teardownMap()
})

onBeforeUnmount(teardownMap)

async function loadPhotos() { photos.value = await biz.getPhotos(locationId) }
async function loadMenu() { menu.value = await biz.getMenu(locationId) }
async function loadPromotions() { promotions.value = await biz.getPromotions(locationId) }
async function loadAnalytics() { analytics.value = await getAnalytics(locationId) }
async function loadReports() {
  const { data } = await supabase.from('location_reports').select('*').eq('location_id', locationId).order('created_at', { ascending: false })
  reports.value = data ?? []
}

async function onPhotoSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `gallery/${locationId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('location-image').upload(path, file, { upsert: false })
    if (error) throw error
    const { data: pub } = supabase.storage.from('location-image').getPublicUrl(path)
    await biz.addPhoto(locationId, pub.publicUrl)
    await loadPhotos()
  } catch (e: any) {
    await toast(e?.message || t('common.error'), 'danger')
  }
}

async function deletePhoto(id: string) { try { await biz.removePhoto(id); await loadPhotos() } catch (e: any) { await toast(e?.message || t('common.error'), 'danger') } }

function onMenuPhotoSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  newMenu.value.photoFile = file
  newMenu.value.photoPreview = URL.createObjectURL(file)
}

async function uploadMenuPhoto(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `menu/${locationId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from('location-image').upload(path, file, { upsert: false })
  if (error) { console.error('[menu photo]', error); return null }
  const { data: pub } = supabase.storage.from('location-image').getPublicUrl(path)
  return pub?.publicUrl ?? null
}

async function addMenu() {
  addingMenu.value = true
  try {
    let photoUrl: string | null = null
    if (newMenu.value.photoFile) photoUrl = await uploadMenuPhoto(newMenu.value.photoFile)
    await biz.addMenuItem({
      location_id: locationId,
      name: newMenu.value.name,
      price: newMenu.value.price,
      description: newMenu.value.description || null,
      photo_url: photoUrl,
    })
    newMenu.value = { name: '', price: null, description: '', photoFile: null, photoPreview: '' }
    await loadMenu()
  } catch (e: any) { await toast(e?.message || t('common.error'), 'danger') }
  finally { addingMenu.value = false }
}
async function deleteMenuItem(id: string) { try { await biz.removeMenuItem(id); await loadMenu() } catch (e: any) { await toast(e?.message || t('common.error'), 'danger') } }

async function addPromo() {
  try {
    await biz.addPromotion({ location_id: locationId, title: newPromo.value.title, body: newPromo.value.body || null })
    newPromo.value = { title: '', body: '' }
    await loadPromotions()
  } catch (e: any) { await toast(e?.message || t('common.error'), 'danger') }
}
async function togglePromo(promo: LocationPromotion) { try { await biz.setPromotionActive(promo.id, !promo.is_active); await loadPromotions() } catch (e: any) { await toast(e?.message || t('common.error'), 'danger') } }
async function deletePromo(id: string) { try { await biz.removePromotion(id); await loadPromotions() } catch (e: any) { await toast(e?.message || t('common.error'), 'danger') } }

// Admin: set the tier for this location's owner — fans out to ALL their businesses.
async function assignTier(newTier: PlanTier) {
  if (newTier === tier.value) return
  try {
    const { error } = await supabase.rpc('admin_set_business_tier_for_location', { p_location_id: locationId, p_tier: newTier })
    if (error) throw error
    const ent = await getFeatures(locationId)
    tier.value = ent.tier
    features.value = ent.features
    await loadAnalytics()
    await toast(t('business.plan.tierUpdated', { tier: newTier }), 'success')
  } catch (e: any) {
    await toast(e?.message || t('common.error'), 'danger')
  }
}

// Business plan paywall. The tier is account-level, so owners upgrade from the
// Business overview; here the modal is used only for the admin "Preview paywall".
const showUpgrade = ref(false)
const previewMode = ref(false)

function openUpgrade(preview = false) {
  previewMode.value = preview
  showUpgrade.value = true
}

// After a purchase completes in the modal, refresh this location's tier/features.
async function onUpgraded() {
  const ent = await getFeatures(locationId)
  tier.value = ent.tier
  features.value = ent.features
  await loadAnalytics()
}

function sparkHeight(count: number): string {
  const max = Math.max(1, ...(analytics.value.timeseries ?? []).map(d => d.count))
  return `${Math.round((count / max) * 100)}%`
}
function formatDate(d: string) { return new Date(d).toLocaleDateString() }

// ---- Analytics display helpers ----
const COUNTRY_NAMES: Record<string, string> = {
  ID: 'Indonesia', MY: 'Malaysia', TW: 'Taiwan', PK: 'Pakistan', SG: 'Singapore',
  IN: 'India', BD: 'Bangladesh', BN: 'Brunei', TR: 'Türkiye', TH: 'Thailand',
  PH: 'Philippines', VN: 'Vietnam', US: 'United States', JP: 'Japan', KR: 'South Korea',
  SA: 'Saudi Arabia', EG: 'Egypt', FR: 'France', GB: 'United Kingdom', AU: 'Australia',
  HK: 'Hong Kong', CN: 'China', AE: 'UAE', NG: 'Nigeria', DE: 'Germany',
}
function countryFlag(code: string): string {
  if (!code || code.length !== 2) return '🏳️'
  return code.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)))
}
function countryName(code: string): string { return COUNTRY_NAMES[code?.toUpperCase()] ?? code }

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const dowBars = computed(() => DOW_LABELS.map((label, i) => ({ label, count: analytics.value.peak_dow?.[String(i)] ?? 0 })))
const hourBars = computed(() => Array.from({ length: 24 }, (_, h) => ({ h, count: analytics.value.peak_hour?.[String(h)] ?? 0 })))

const intentRows = computed(() => {
  const it = analytics.value.intents
  if (!it) return []
  return [
    { key: 'directions', label: t('business.analytics.directions'), value: it.directions },
    { key: 'call', label: t('business.analytics.callTaps'), value: it.call },
    { key: 'foodpanda', label: 'Foodpanda', value: it.foodpanda },
    { key: 'ubereats', label: 'Uber Eats', value: it.ubereats },
    { key: 'instagram', label: 'Instagram', value: it.instagram },
    { key: 'share', label: t('business.analytics.shares'), value: it.share },
    { key: 'photo_views', label: t('business.analytics.photoViews'), value: it.photo_views },
  ]
})
const audienceMax = computed(() => Math.max(1, ...(analytics.value.nationalities ?? []).map(n => n.count)))
function barPct(count: number, max: number): string { return `${Math.round((count / max) * 100)}%` }
const maxDow = computed(() => Math.max(1, ...dowBars.value.map(d => d.count)))
const maxHour = computed(() => Math.max(1, ...hourBars.value.map(d => d.count)))

// ---- CSV export (Gold) ----
function csvCell(v: unknown): string {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
function buildCsv(): string {
  const a = analytics.value
  const rows: (string | number)[][] = [['Section', 'Metric', 'Value']]
  rows.push(['Overview', 'Total views', a.total_views])
  rows.push(['Overview', 'Opens (30d)', a.detail_opens_30d])
  rows.push(['Overview', 'Unique viewers (30d)', a.unique_viewers_30d])
  rows.push(['Overview', 'Impressions (30d)', a.card_clicks_30d + a.marker_clicks_30d])
  if (a.saves != null) rows.push(['Overview', 'Saves', a.saves])
  if (a.intents) {
    for (const [k, v] of Object.entries(a.intents)) rows.push(['Actions (30d)', k, v])
  }
  a.nationalities?.forEach(n => rows.push(['Audience nationality', countryName(n.code), n.count]))
  a.gender?.forEach(g => rows.push(['Audience gender', g.gender, g.count]))
  a.timeseries?.forEach(d => rows.push(['Views by day', d.date, d.count]))
  if (a.funnel) {
    rows.push(['Funnel', 'Impressions', a.funnel.impressions])
    rows.push(['Funnel', 'Opens', a.funnel.opens])
    rows.push(['Funnel', 'Actions', a.funnel.actions])
    rows.push(['Funnel', 'Open rate %', a.funnel.open_rate])
    rows.push(['Funnel', 'Action rate %', a.funnel.action_rate])
  }
  if (a.benchmark) {
    rows.push(['Benchmark', 'Category', a.benchmark.category])
    rows.push(['Benchmark', 'Rank', `${a.benchmark.rank} of ${a.benchmark.category_total}`])
    rows.push(['Benchmark', 'Your opens (30d)', a.benchmark.my_opens_30d])
    rows.push(['Benchmark', 'Category avg (30d)', a.benchmark.category_avg_30d])
  }
  a.search_terms?.forEach(s => rows.push(['Search terms', s.q, s.count]))
  return rows.map(r => r.map(csvCell).join(',')).join('\n')
}
async function exportCsv() {
  const csv = buildCsv()
  const filename = `${(locationName.value || 'business').replace(/[^\w]+/g, '_')}_analytics_${new Date().toISOString().slice(0, 10)}.csv`
  try {
    if (Capacitor.isNativePlatform()) {
      const res = await Filesystem.writeFile({ path: filename, data: csv, directory: Directory.Cache, encoding: Encoding.UTF8 })
      await Share.share({ title: filename, url: res.uri })
    } else {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
    }
    ActivityLogService.log('business_analytics_export', { location_id: locationId })
  } catch (e: any) {
    await toast(e?.message || t('common.error'), 'danger')
  }
}

const upgradeMsg = computed(() => {
  switch (analytics.value.level) {
    case 'basic': return t('business.analytics.upgradeStandard')
    case 'standard': return t('business.analytics.upgradeAdvanced')
    default: return t('business.analytics.upgradePro') // 'advanced' → gold
  }
})

async function toast(message: string, color: string) {
  const t = await toastController.create({ message, duration: 2500, color, position: 'bottom' })
  await t.present()
}

// Reviews Management Logic
async function loadReviews() {
  loadingReviews.value = true
  try {
    const { data, error } = await supabase
      .from('location_reviews')
      .select(`
        id,
        rating,
        comment,
        facilities,
        owner_response,
        owner_responded_at,
        created_at,
        user_profiles (
          display_name,
          avatar_url,
          public_profile
        )
      `)
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })

    if (!error && data) {
      businessReviews.value = data
    }
  } catch (err) {
    console.error('Failed to load reviews:', err)
  } finally {
    loadingReviews.value = false
  }
}

function startReply(review: any) {
  replyingToId.value = review.id
  activeReplyText.value = review.owner_response || ''
}

function cancelReply() {
  replyingToId.value = null
  activeReplyText.value = ''
}

async function submitReply(reviewId: number) {
  submittingReply.value = true
  try {
    const { error } = await supabase
      .from('location_reviews')
      .update({
        owner_response: activeReplyText.value.trim(),
        owner_responded_at: new Date().toISOString()
      })
      .eq('id', reviewId)

    if (error) throw error

    const toastInstance = await toastController.create({
      message: '✅ Response submitted successfully',
      duration: 2000,
      color: 'success'
    })
    toastInstance.present()

    await loadReviews()
    cancelReply()
  } catch (err: any) {
    console.error('Failed to submit response:', err)
    const toastInstance = await toastController.create({
      message: `❌ Failed to submit reply: ${err.message}`,
      duration: 3000,
      color: 'danger'
    })
    toastInstance.present()
  } finally {
    submittingReply.value = false
  }
}

const hasFacilities = (facilities: any) => {
  return facilities && Object.keys(facilities).length > 0
}

const getReviewFacilities = (facilities: any) => {
  return MUSLIM_FACILITIES.map((fac: any) => {
    const val = facilities[fac.code]
    if (val && val !== 'unsure') {
      return { ...fac, val }
    }
    return null
  }).filter((f: any) => f !== null)
}

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
</script>

<style scoped>
.plan-banner {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; background: var(--ion-color-light);
}
.plan-banner.bronze { background: rgba(205,127,50,.12); }
.plan-banner.silver { background: rgba(148,163,184,.16); }
.plan-banner.gold { background: rgba(202,138,4,.14); }
.plan-label { font-size: .65rem; text-transform: uppercase; letter-spacing: 1px; font-weight: 800; color: var(--ion-color-medium); margin-right: 8px; }
.plan-tier { font-size: 1rem; font-weight: 800; text-transform: uppercase; color: var(--ion-color-dark); }
.plan-upgrade { font-size: .75rem; font-weight: 700; color: var(--ion-color-carrot); }
.admin-tier-select { --padding-start: 8px; border: 1px solid var(--ion-color-medium); border-radius: 10px; font-weight: 800; text-transform: uppercase; font-size: .8rem; min-width: 110px; }
.plan-upgrade-btn { --border-radius: 10px; font-weight: 800; text-transform: none; }

.admin-plan-controls { display: flex; align-items: center; gap: 6px; }
.plan-accountwide { display: block; font-size: .68rem; color: var(--ion-color-medium); margin-top: 2px; }

.seg-scroll { border-bottom: 1px solid var(--ion-color-light-shade); }
.tab-body { max-width: 720px; margin: 0 auto; }

.edit-list { background: transparent; }
.edit-list ion-item { --background: transparent; --padding-start: 0; margin-bottom: 4px; }

.edit-block { margin-top: 22px; }
.block-title { font-size: .75rem; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; color: var(--ion-color-medium); margin: 0 0 12px; }
.hours-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; }
.hours-row .day-label { width: 40px; font-weight: 700; font-size: .85rem; color: var(--ion-color-dark); }
.hours-row .time-in { max-width: 108px; --padding-start: 8px; border: 1px solid var(--ion-color-light-shade); border-radius: 8px; }
.hours-row .time-dash { color: var(--ion-color-medium); }
.hours-row .closed-lbl { color: var(--ion-color-medium); font-size: .82rem; font-style: italic; }
.tags-wrap { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.tag-chip { display: inline-flex; align-items: center; gap: 4px; background: rgba(var(--ion-color-carrot-rgb), .1); color: var(--ion-color-carrot); font-weight: 700; font-size: .82rem; padding: 4px 10px; border-radius: 999px; }
.tag-chip ion-icon { font-size: 15px; cursor: pointer; }
.tag-add { display: flex; align-items: center; gap: 8px; }
.tag-add ion-input { border: 1px solid var(--ion-color-light-shade); border-radius: 10px; --padding-start: 10px; }
.save-btn { --border-radius: 14px; height: 52px; font-weight: 700; margin-top: 20px; }

.section-hint { font-size: .85rem; color: var(--ion-color-medium); margin: 0 0 14px; }

/* Legend explaining which edits are reviewed vs. instant */
.review-legend { display: flex; flex-direction: column; gap: 8px; background: var(--ion-color-light); border-radius: 12px; padding: 12px 14px; margin-bottom: 16px; }
.legend-item { display: flex; align-items: center; gap: 8px; font-size: .8rem; color: var(--ion-color-medium-shade); line-height: 1.3; }
.legend-item .instant-icon { color: var(--ion-color-success); font-size: 1.1rem; flex-shrink: 0; }
.review-badge {
  display: inline-flex; align-items: center; gap: 3px; flex-shrink: 0;
  background: rgba(var(--ion-color-warning-rgb), .16); color: var(--ion-color-warning-shade);
  font-size: .68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .02em;
  padding: 3px 8px; border-radius: 999px;
}
.review-badge ion-icon { font-size: .85rem; }
.field-badge { align-self: center; }

/* Address geocoding map */
.biz-map-block { margin: 4px 4px 14px; }
.biz-map-hint { font-size: .78rem; color: var(--ion-color-medium); margin: 0 0 8px; }
.biz-map-holder { position: relative; height: 30vh; min-height: 200px; border-radius: 14px; overflow: hidden; border: 1px solid var(--ion-color-light-shade); }
#biz-map { position: absolute; inset: 0; opacity: 0; transition: opacity 180ms ease-out; cursor: crosshair; }
#biz-map.fade-in { opacity: 1; }
.biz-map-loading { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
.biz-coords { display: flex; align-items: center; gap: 6px; margin-top: 8px; font-size: .72rem; color: var(--ion-color-medium); font-variant-numeric: tabular-nums; }
.biz-coords ion-icon { font-size: .9rem; flex-shrink: 0; }
.photo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.photo-thumb { position: relative; aspect-ratio: 1; border-radius: 14px; overflow: hidden; }
.photo-thumb img { width: 100%; height: 100%; object-fit: cover; }
.photo-remove { position: absolute; top: 6px; right: 6px; font-size: 22px; color: #fff; background: rgba(0,0,0,.55); border-radius: 50%; padding: 3px; }
.main-thumb { border: 2px solid var(--ion-color-carrot); }
.main-badge { position: absolute; bottom: 6px; left: 6px; background: var(--ion-color-carrot); color: #fff; font-size: .6rem; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; padding: 2px 7px; border-radius: 999px; }
.photo-add { aspect-ratio: 1; border: 2px dashed var(--ion-color-medium); border-radius: 14px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.photo-add ion-icon { font-size: 30px; color: var(--ion-color-carrot); }

.proof-block { padding: 14px 0 4px; }
.proof-title { font-size: .8rem; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; color: var(--ion-color-dark); margin: 0 0 2px; }
.proof-sub { font-size: .8rem; color: var(--ion-color-medium); margin: 0 0 12px; line-height: 1.35; }

.pv-proof { margin: 16px 0 4px; }
.pv-proof-label { font-size: .7rem; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; color: var(--ion-color-medium); margin: 0 0 8px; }
.pv-proof-imgs { display: flex; gap: 8px; flex-wrap: wrap; }
.pv-proof-imgs img { width: 72px; height: 72px; object-fit: cover; border-radius: 10px; border: 1px solid var(--ion-color-light-shade); }

.locked-note { display: flex; align-items: center; gap: 8px; margin-top: 16px; padding: 12px; border-radius: 12px; background: var(--ion-color-light); color: var(--ion-color-medium); font-size: .85rem; font-weight: 600; }
.upgrade-lock { text-align: center; padding: 50px 20px; }
.upgrade-lock ion-icon { font-size: 52px; color: var(--ion-color-medium); }
.upgrade-lock h3 { font-weight: 800; margin: 14px 0 6px; }
.upgrade-lock p { color: var(--ion-color-medium); margin: 0; }

.menu-row, .promo-row, .report-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--ion-color-light-shade); }
.menu-info { flex: 1; min-width: 0; }
.menu-info p { margin: 2px 0 0; font-size: .82rem; color: var(--ion-color-medium); }
.menu-price { margin-left: 8px; color: var(--ion-color-carrot); font-weight: 700; }
.menu-photo { width: 52px; height: 52px; border-radius: 10px; object-fit: cover; flex-shrink: 0; }

.menu-add-card { display: flex; gap: 12px; margin-top: 18px; padding-top: 16px; border-top: 1px dashed var(--ion-color-light-shade); }
.menu-photo-picker {
  width: 84px; height: 84px; flex-shrink: 0; border: 2px dashed var(--ion-color-medium);
  border-radius: 14px; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4px; cursor: pointer; overflow: hidden; color: var(--ion-color-medium); font-size: .68rem; font-weight: 700; text-align: center;
}
.menu-photo-picker img { width: 100%; height: 100%; object-fit: cover; }
.menu-photo-picker ion-icon { font-size: 24px; color: var(--ion-color-carrot); }
.menu-add-fields { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.add-inline { display: flex; align-items: center; gap: 8px; margin-top: 16px; }
.add-inline.column { flex-direction: column; align-items: stretch; }
.price-in { max-width: 90px; }
.promo-actions { display: flex; align-items: center; gap: 12px; }
.promo-actions ion-icon, .menu-row ion-icon { font-size: 20px; color: var(--ion-color-danger); }

.stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.stat-card { background: var(--ion-color-light); border-radius: 16px; padding: 18px; text-align: center; }
.stat-num { display: block; font-size: 1.8rem; font-weight: 900; color: var(--ion-color-dark); }
.stat-label { font-size: .75rem; color: var(--ion-color-medium); font-weight: 700; }
.spark { display: flex; align-items: flex-end; gap: 3px; height: 80px; margin-top: 12px; }
.spark-bar { flex: 1; background: var(--ion-color-carrot); border-radius: 3px 3px 0 0; min-height: 2px; }

.an-section-title { font-size: .78rem; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; color: var(--ion-color-medium); margin: 26px 0 12px; }
.an-empty { color: var(--ion-color-medium); font-size: .85rem; }

.intent-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.intent-cell { background: var(--ion-color-light); border-radius: 12px; padding: 12px 6px; text-align: center; }
.intent-val { display: block; font-size: 1.25rem; font-weight: 900; color: var(--ion-color-dark); }
.intent-lbl { font-size: .66rem; color: var(--ion-color-medium); font-weight: 600; }

.nat-list { display: flex; flex-direction: column; gap: 10px; }
.nat-row { display: flex; align-items: center; gap: 10px; }
.nat-flag { font-size: 1.2rem; width: 24px; text-align: center; }
.nat-name { width: 96px; font-size: .82rem; font-weight: 600; color: var(--ion-color-dark); flex-shrink: 0; }
.nat-bar-track { flex: 1; height: 8px; background: var(--ion-color-light); border-radius: 999px; overflow: hidden; }
.nat-bar { height: 100%; background: var(--ion-color-carrot); border-radius: 999px; }
.nat-count { width: 32px; text-align: right; font-weight: 800; font-size: .82rem; color: var(--ion-color-dark); }

.gender-row { display: flex; gap: 8px; margin-top: 12px; }
.gender-chip { background: var(--ion-color-light); border-radius: 999px; padding: 4px 12px; font-size: .78rem; font-weight: 700; color: var(--ion-color-medium); }

.peak-bars { display: flex; align-items: flex-end; gap: 4px; height: 90px; }
.peak-bars.hours { gap: 2px; }
.peak-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; gap: 4px; }
.peak-bar { width: 100%; background: var(--ion-color-carrot); border-radius: 3px 3px 0 0; min-height: 2px; }
.peak-lbl { font-size: .6rem; color: var(--ion-color-medium); font-weight: 700; }

.funnel { display: flex; align-items: stretch; gap: 4px; }
.funnel-step { flex: 1; background: var(--ion-color-light); border-radius: 12px; padding: 12px 4px; text-align: center; }
.funnel-num { display: block; font-size: 1.3rem; font-weight: 900; color: var(--ion-color-dark); }
.funnel-lbl { font-size: .62rem; color: var(--ion-color-medium); font-weight: 700; }
.funnel-arrow { display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--ion-color-medium); font-weight: 800; }
.funnel-arrow small { font-size: .6rem; color: var(--ion-color-carrot); }

.bench-card { background: rgba(var(--ion-color-carrot-rgb), .07); border: 1px solid rgba(var(--ion-color-carrot-rgb), .25); border-radius: 16px; padding: 16px; }
.bench-rank { display: flex; align-items: baseline; gap: 8px; }
.bench-hash { font-size: 1.7rem; font-weight: 900; color: var(--ion-color-carrot); }
.bench-of { font-size: .85rem; color: var(--ion-color-dark); font-weight: 600; }
.bench-pct { font-size: .95rem; font-weight: 800; color: var(--ion-color-dark); margin-top: 4px; }
.bench-compare { display: flex; justify-content: space-between; margin-top: 10px; font-size: .8rem; color: var(--ion-color-medium); font-weight: 600; }
.bench-vs { color: var(--ion-color-medium); }

.term-wrap { display: flex; flex-wrap: wrap; gap: 8px; }
.term-chip { background: var(--ion-color-light); border-radius: 999px; padding: 5px 12px; font-size: .82rem; font-weight: 600; color: var(--ion-color-dark); }
.term-chip b { color: var(--ion-color-carrot); margin-left: 4px; }

.export-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
.digest-note { font-size: .72rem; color: var(--ion-color-medium); font-weight: 600; }

.empty-inline { text-align: center; padding: 40px 20px; color: var(--ion-color-medium); }
.empty-inline ion-icon { font-size: 44px; }
.report-row { flex-direction: column; align-items: flex-start; gap: 6px; }
.report-row p { margin: 0; }
.report-date { font-size: .72rem; color: var(--ion-color-medium); }

/* Draft / publish */
.draft-banner {
  display: flex; align-items: center; gap: 8px;
  background: rgba(var(--ion-color-warning-rgb), .14);
  border: 1px solid rgba(var(--ion-color-warning-rgb), .35);
  color: var(--ion-color-dark);
  border-radius: 12px; padding: 10px 12px; margin-bottom: 16px;
  font-size: .82rem; font-weight: 600; line-height: 1.3;
}
.draft-banner ion-icon { font-size: 18px; color: var(--ion-color-warning-shade); flex-shrink: 0; }

.action-footer { background: var(--ion-background-color); border-top: 1px solid var(--ion-color-light-shade); }
.action-bar { display: flex; align-items: center; gap: 8px; padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px)); max-width: 720px; margin: 0 auto; }
.act-preview { --padding-start: 6px; --padding-end: 6px; font-weight: 700; }
.act-draft { flex: 1; --border-radius: 12px; font-weight: 700; }
.act-publish { flex: 1; --border-radius: 12px; font-weight: 800; }

/* Public preview modal */
.preview-hint { padding: 0 16px 10px; font-size: .8rem; color: var(--ion-color-medium); }
.pv-hero { width: 100%; height: 200px; overflow: hidden; }
.pv-hero img { width: 100%; height: 100%; object-fit: cover; }
.pv-body { padding: 18px 16px 40px; max-width: 620px; margin: 0 auto; }
.pv-name { font-size: 1.6rem; font-weight: 900; margin: 0 0 10px; color: var(--ion-color-dark); }
.pv-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.pv-type { background: rgba(var(--ion-color-carrot-rgb), .12); color: var(--ion-color-carrot); font-weight: 700; font-size: .8rem; padding: 4px 12px; border-radius: 999px; }
.pv-halal { font-weight: 800; font-size: .8rem; padding: 4px 12px; border-radius: 999px; }
.pv-halal.certified { background: rgba(var(--ion-color-success-rgb), .15); color: var(--ion-color-success); }
.pv-halal.self_reported { background: rgba(var(--ion-color-warning-rgb), .18); color: var(--ion-color-warning-shade); }
.pv-halal.muslim_friendly { background: var(--ion-color-light); color: var(--ion-color-medium); }
.pv-attrs { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; font-size: .82rem; color: var(--ion-color-medium); font-weight: 600; }
.pv-desc { font-size: .95rem; line-height: 1.5; color: var(--ion-color-dark); margin: 0 0 18px; white-space: pre-wrap; }
.pv-rows { display: flex; flex-direction: column; gap: 12px; }
.pv-row { display: flex; align-items: center; gap: 12px; font-size: .92rem; color: var(--ion-color-dark); }
.pv-row ion-icon { font-size: 20px; color: var(--ion-color-carrot); flex-shrink: 0; }

.fade-in { animation: fadeIn .3s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

/* Reviews Manager style */
.reviews-filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  background: rgba(var(--ion-text-color-rgb, 0, 0, 0), 0.04);
  border-radius: 8px;
  padding: 4px;
}
.reviews-filter-bar .filter-item {
  flex: 1;
  --background: transparent;
  --padding-start: 8px;
  --min-height: 44px;
  font-size: 0.9rem;
}
.reviews-filter-bar .carrot-select {
  width: 100%;
}
.review-manager-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.review-manage-card {
  background: var(--ion-color-light, #f4f5f8);
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.rev-manage-header {
  display: flex;
  align-items: center;
  gap: 12px;
}
.rev-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
}
.rev-info {
  flex-grow: 1;
}
.rev-username {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--ion-text-color);
}
.rev-date {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}
.rev-stars {
  display: flex;
  gap: 2px;
}
.rev-stars ion-icon {
  font-size: 1.1rem;
}
.rev-comment-text {
  margin: 0;
  font-size: 0.92rem;
  font-style: italic;
  line-height: 1.4;
  color: var(--ion-text-color);
}
.rev-facilities-checked {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.rev-fac-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.68rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
}
.rev-fac-badge.yes {
  background: rgba(var(--ion-color-success-rgb, 16, 185, 129), 0.12);
  color: var(--ion-color-success, #10b981);
}
.rev-fac-badge.no {
  background: rgba(var(--ion-color-danger-rgb, 239, 68, 68), 0.12);
  color: var(--ion-color-danger, #ef4444);
}
.reply-container {
  margin-top: 6px;
  border-top: 1px dashed var(--ion-color-light-shade);
  padding-top: 10px;
}
.reply-editor-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.reply-textarea {
  background: var(--ion-color-step-50, #fff);
  border: 1px solid var(--ion-color-light-shade);
  border-radius: 10px;
  padding: 8px;
  font-size: 0.88rem;
  --placeholder-color: var(--ion-color-medium);
}
.reply-editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.existing-reply-box {
  background: rgba(var(--ion-color-carrot-rgb, 255, 152, 0), 0.04);
  border-left: 3px solid var(--ion-color-carrot, #ff9800);
  border-radius: 4px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.reply-box-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.reply-by-label {
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--ion-color-carrot, #ff9800);
  text-transform: uppercase;
}
.reply-date-label {
  font-size: 0.7rem;
  color: var(--ion-color-medium);
}
.reply-content-text {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.4;
  color: var(--ion-text-color);
}
.reply-box-footer {
  display: flex;
  justify-content: flex-end;
}
.reply-edit-btn {
  --padding-start: 0;
  --padding-end: 0;
  margin: 0;
  font-size: 0.75rem;
  font-weight: 700;
}
.gold-grid {
  margin-bottom: 20px;
}
.gold-card {
  background: rgba(var(--ion-color-warning-rgb, 202, 138, 4), 0.08);
  border: 1.5px solid rgba(var(--ion-color-warning-rgb, 202, 138, 4), 0.25);
  box-shadow: 0 4px 12px rgba(202, 138, 4, 0.05);
}
.locked-grid {
  opacity: 0.7;
  cursor: pointer;
}
.locked-card {
  background: var(--ion-color-light);
  border: 1px dashed var(--ion-color-medium-shade);
}
.locked-title {
  color: var(--ion-color-medium-shade);
}
</style>
