<template>
  <!-- LIST MODE — mirrors SearchView's .modern-product-card layout so it
       sits in the feed as a native-looking row, not a banner. -->
  <div
      v-if="item && mode === 'list'"
      :class="['modern-product-card', 'tier-card-' + item.tier]"
      @click="onOpen"
  >
    <div class="card-inner">
      <div class="card-image-section">
        <img
            loading="lazy"
            decoding="async"
            :src="item.image || `https://placehold.co/300x300?text=${encodeURIComponent(item.title)}`"
            :alt="item.title"
        />
      </div>

      <div class="card-info-section">
        <div class="info-top">
          <div class="tier-header">
            <div :class="['tier-badge', item.tier]">
              <ion-icon :icon="checkmarkCircle" v-if="item.tier === 'gold'" />
              <span>{{ item.tier.toUpperCase() }}</span>
            </div>
            <span class="house-ad-native-sponsored">
              <ion-icon :icon="starOutline" />
              {{ $t('home.sponsored') }}
            </span>
          </div>
          <h3 class="name">{{ item.title }}</h3>
          <div class="metas metas-indent">
            <span class="meta house-ad-native-provider">
              <ion-icon :icon="kindIcon" class="lucide-meta-icon" />
              <span>{{ providerLabel }}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
    <div v-if="item.tier === 'gold' || item.tier === 'silver'" class="premium-flare"></div>
  </div>

  <!-- GRID MODE — mirrors SearchView's .grid-product-card layout. -->
  <div
      v-else-if="item && mode === 'grid'"
      :class="['grid-product-card', 'tier-card-' + item.tier, item.tier === 'gold' ? 'grid-col-span-2' : '']"
      @click="onOpen"
  >
    <div class="grid-card-image">
      <img
          loading="lazy"
          decoding="async"
          :src="item.image || `https://placehold.co/300x300?text=${encodeURIComponent(item.title)}`"
          :alt="item.title"
      />
      <div :class="['grid-tier-badge', item.tier]">
        <ion-icon :icon="checkmarkCircle" v-if="item.tier === 'gold'" />
        <span>{{ item.tier.toUpperCase() }}</span>
      </div>
      <div class="house-ad-native-grid-sponsored">
        <ion-icon :icon="starOutline" />
        <span>{{ $t('home.sponsored') }}</span>
      </div>
      <div class="house-ad-native-grid-title">{{ item.title }}</div>
    </div>
    <div v-if="item.tier === 'gold' || item.tier === 'silver'" class="premium-flare"></div>
  </div>

  <!-- LOCATION MODE — mirrors ExploreView's list-mode .modern-location-card
       layout (that file's CSS is unscoped/global, so no duplication needed
       here, same as Search's list/grid modes). -->
  <div
      v-else-if="item && mode === 'location'"
      :class="['modern-location-card', 'list-mode-card', 'tier-' + item.tier]"
      @click="onOpen"
  >
    <div class="card-inner">
      <div class="card-image-section">
        <img
            loading="lazy"
            :src="item.image || `https://placehold.co/300x300?text=${encodeURIComponent(item.title)}`"
            :alt="item.title"
        />
        <div class="floating-tier-badge">
          <div :class="['tier-pill', item.tier]">
            <ion-icon :icon="checkmarkCircle" v-if="item.tier === 'gold'" />
            <span>{{ item.tier.toUpperCase() }}</span>
          </div>
        </div>
        <div class="house-ad-native-sponsored house-ad-native-sponsored--overlay">
          <ion-icon :icon="starOutline" />
          {{ $t('home.sponsored') }}
        </div>
      </div>
      <div class="card-info-section">
        <div class="info-top">
          <h5 class="title-text">{{ item.title }}</h5>
          <div class="metas">
            <span class="meta house-ad-native-provider">
              <ion-icon :icon="kindIcon" class="lucide-meta-icon" />
              <span>{{ providerLabel }}</span>
            </span>
          </div>
        </div>
      </div>
      <div v-if="item.tier === 'gold' || item.tier === 'silver'" class="premium-flare"></div>
    </div>
  </div>

  <!-- TRIP MODE — mirrors TripListView's .trip-card-v2 layout. -->
  <div
      v-else-if="item && mode === 'trip'"
      :class="['trip-card-v2', 'tier-card-' + item.tier]"
      @click="onOpen"
  >
    <div class="trip-cover-wrap">
      <img
          loading="lazy"
          :src="item.image || `https://placehold.co/600x380?text=${encodeURIComponent(item.title)}`"
          :alt="item.title"
          class="trip-cover"
      />
      <div :class="['trip-tier-badge', item.tier]">
        <ion-icon :icon="checkmarkCircle" v-if="item.tier === 'gold'" />
        <span>{{ item.tier.toUpperCase() }}</span>
      </div>
      <div class="house-ad-native-sponsored house-ad-native-sponsored--overlay">
        <ion-icon :icon="starOutline" />
        {{ $t('home.sponsored') }}
      </div>
      <div class="trip-cover-gradient" />
    </div>

    <div class="trip-card-body">
      <h3 class="trip-card-title">{{ item.title }}</h3>
      <div class="trip-card-provider-row">
        <span class="trip-card-provider house-ad-native-provider">
          <ion-icon :icon="kindIcon" class="lucide-meta-icon" />
          <span>{{ providerLabel }}</span>
        </span>
      </div>
    </div>

    <div v-if="item.tier === 'gold' || item.tier === 'silver'" class="premium-flare"></div>
  </div>

  <!-- STORE MODE — mirrors StoreView's .store-product-card layout. -->
  <div
      v-else-if="item && mode === 'store'"
      :class="['store-product-card', 'tier-card-' + item.tier]"
      @click="onOpen"
  >
    <div class="product-image-wrapper">
      <img
          loading="lazy"
          :src="item.image || `https://placehold.co/300x300?text=${encodeURIComponent(item.title)}`"
          :alt="item.title"
          class="product-image"
      />
      <div :class="['house-ad-native-store-badge', item.tier]">
        <ion-icon :icon="checkmarkCircle" v-if="item.tier === 'gold'" />
        <span>{{ item.tier.toUpperCase() }}</span>
      </div>
      <div class="house-ad-native-sponsored house-ad-native-sponsored--store">
        <ion-icon :icon="starOutline" />
        {{ $t('home.sponsored') }}
      </div>
    </div>
    <div class="product-info">
      <div class="product-category">{{ kindLabel }}</div>
      <h3 class="product-name">{{ item.title }}</h3>
      <div class="product-store-info house-ad-native-provider">
        <ion-icon :icon="kindIcon" class="store-icon" />
        <span class="store-name-text">{{ providerLabel }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { IonIcon } from '@ionic/vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Browser } from '@capacitor/browser'
import { checkmarkCircle, starOutline, storefront, pricetag, locationSharp, airplane } from 'ionicons/icons'
import { useHouseAds, getHouseAdAtOffset, startHouseAdRotationTimer, type HouseAdKind } from '@/composables/useHouseAds'
import { ActivityLogService } from '@/services/ActivityLogService'
import { supabase } from '@/plugins/supabaseClient'

const props = defineProps<{
  mode: 'list' | 'grid' | 'trip' | 'store' | 'location'
  // Which slot occurrence this is (0, 1, 2, ...) — each recurring slot in
  // the feed shows a different item from the rotation, not the same one
  // repeated, by offsetting from the shared rotation index.
  slot: number
}>()

const router = useRouter()
const { t } = useI18n()
const { rotationIndex, poolLoaded, loadHouseAdPool } = useHouseAds()

// Never rotate in the kind that matches what this feed is already about —
// e.g. Search's own gold products are already featured first at the top of
// that list, so a "sponsored product" card here would just be a duplicate.
const EXCLUDE_KIND_BY_MODE: Record<typeof props.mode, HouseAdKind | undefined> = {
  list: 'product',
  grid: 'product',
  trip: 'trip',
  store: 'product',
  location: 'location',
}

const item = computed(() => {
  void rotationIndex.value
  void poolLoaded.value
  return getHouseAdAtOffset(props.slot, EXCLUDE_KIND_BY_MODE[props.mode])
})

onMounted(() => {
  // Unlike HouseAdCard.vue (the banner fallback), nothing else on this
  // page necessarily triggers the pool fetch or rotation timer, since a
  // view using only native in-feed placements never mounts the banner
  // component at all. startHouseAdRotationTimer() is a no-op if some other
  // already-mounted card started it first.
  loadHouseAdPool()
  startHouseAdRotationTimer()
})

const KIND_ICONS = {
  partner: storefront,
  product: pricetag,
  location: locationSharp,
  trip: airplane,
} as const

const kindIcon = computed(() => item.value ? KIND_ICONS[item.value.kind] : storefront)
const kindLabel = computed(() => item.value ? t('home.houseAdKind.' + item.value.kind) : '')

const PROVIDER_KEY_BY_KIND = {
  product: 'soldBy',
  location: 'certifiedBy',
  trip: 'providedBy',
} as const

const providerLabel = computed(() => {
  const ad = item.value
  if (!ad) return ''
  if (ad.kind === 'partner') return t('home.houseAdKind.partner')
  if (!ad.providerName) return t('home.houseAdKind.' + ad.kind)
  return t('home.houseAdProvider.' + PROVIDER_KEY_BY_KIND[ad.kind], { name: ad.providerName })
})

async function onOpen() {
  const ad = item.value
  if (!ad) return

  if (ad.kind === 'trip' && ad.externalUrl) {
    ActivityLogService.log('trip_click', { trip_id: ad.id, trip_title: ad.title, source: 'house_ad_native' })
    try { await supabase.rpc('increment_trip_view', { p_trip_id: ad.id }) } catch { /* non-critical */ }
    await Browser.open({
      url: ad.externalUrl,
      windowName: '_self',
      toolbarColor: '#e67e22',
      presentationStyle: 'fullscreen',
    })
    return
  }

  router.push(ad.to)
}
</script>

<style scoped>
/* Trip/Store mode layout — duplicated (not imported) from
   TripListView.vue/StoreView.vue's own `<style scoped>` blocks. Vue's
   scoped CSS is per-component (it adds a unique data-v-* attribute
   selector), so reusing those class NAMES from here doesn't pick up their
   styling at all — hence the copies below, kept in sync by hand if those
   views' card layouts change. (Search's list/grid modes don't need this:
   SearchView.vue's card styles are in an unscoped <style> block, so those
   really are global and apply here for free.) */
.trip-card-v2 {
  margin: 0;
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--card-shadow);
  border: 1px solid var(--card-border);
  cursor: pointer;
  position: relative;
}
.trip-cover-wrap {
  position: relative;
  width: 100%;
  height: 190px;
  overflow: hidden;
  background: var(--ion-background-color-step-100, #f0f0f0);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}
.trip-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.trip-cover-gradient {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: linear-gradient(to bottom, transparent, rgba(0, 0, 0, 0.35));
}
.trip-tier-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.35);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
}
.trip-tier-badge ion-icon { font-size: 12px; }
.trip-tier-badge.gold { background: rgba(234, 179, 8, 0.85); color: #1a0e00; }
.trip-tier-badge.silver { background: rgba(160, 160, 175, 0.85); color: #1a1a2e; }
.trip-tier-badge.bronze { background: rgba(180, 110, 70, 0.85); color: #fff; }
.trip-card-body {
  padding: 16px 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.trip-card-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--ion-color-dark);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.trip-card-provider-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.store-product-card {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  overflow: hidden;
  cursor: pointer;
  box-shadow: var(--card-shadow);
  border: 1px solid var(--card-border);
  height: 100%;
  display: flex;
  flex-direction: column;
}
.product-image-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  background: var(--ion-color-step-50, #f4f5f8);
  flex-shrink: 0;
}
.product-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.product-info {
  padding: 12px 12px 14px;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  justify-content: space-between;
  gap: 3px;
  border-top: 1px solid var(--card-border);
}
.product-category {
  font-size: 0.62rem;
  color: var(--ion-color-medium);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;
}
.product-name {
  margin: 2px 0;
  font-size: 0.88rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.3;
  color: var(--ion-text-color);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.product-store-info {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}
.store-icon {
  font-size: 0.72rem;
  color: var(--ion-color-carrot);
}
.store-name-text {
  font-size: 0.72rem;
  color: var(--ion-color-step-600, #666);
  font-weight: 500;
}

.house-ad-native-sponsored {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--ion-color-medium);
  text-transform: uppercase;
}
.house-ad-native-sponsored ion-icon {
  font-size: 10px;
}

/* Trip mode: sponsored tag sits over the cover photo (top-right), so it
   needs its own contrast treatment instead of the plain inline version. */
.house-ad-native-sponsored--overlay {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 3;
  padding: 3px 8px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  color: #fff;
}

/* Store mode: sponsored tag over the square product image (top-right),
   mirroring .featured-chip's top-left placement for the real "featured" tag. */
.house-ad-native-sponsored--store {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 3;
  padding: 3px 7px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  color: #fff;
}

.house-ad-native-store-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 8px;
  border-radius: 10px;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}
.house-ad-native-store-badge.gold {
  background: linear-gradient(135deg, #facc15 0%, #ca8a04 100%);
  color: #422006;
}
.house-ad-native-store-badge.silver {
  background: linear-gradient(135deg, #cbd5e1 0%, #64748b 100%);
  color: #0f172a;
}
.house-ad-native-store-badge.bronze {
  background: linear-gradient(135deg, #d97706 0%, #78350f 100%);
  color: #fff;
}

.tier-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

/* Provider names ("By Islamic Commercial Development, Ltd.") can run long
   — let this one meta wrap onto two lines instead of the global .meta
   rule's single-line ellipsis truncation. */
.house-ad-native-provider {
  display: flex !important;
  align-items: flex-start !important;
  gap: 4px;
  white-space: normal !important;
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}
.house-ad-native-provider .lucide-meta-icon,
.house-ad-native-provider .store-icon {
  margin-top: 1px;
  flex-shrink: 0;
}
.house-ad-native-provider > span {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
  font-size: inherit;
  color: inherit;
}

.house-ad-native-grid-sponsored {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  gap: 3px;
  height: 22px;
  padding: 0 7px;
  border-radius: 11px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  color: #fff;
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  z-index: 2;
}
.house-ad-native-grid-sponsored ion-icon {
  font-size: 11px;
}

.house-ad-native-grid-title {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 18px 8px 8px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.75), transparent);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  z-index: 1;
}
</style>
