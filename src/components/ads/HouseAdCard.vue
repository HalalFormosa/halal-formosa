<template>
  <ion-card
      v-if="item"
      :class="['house-ad-card', item.tier, props.variant]"
      button
      @click="onOpen"
  >
    <div class="house-ad-inner">
      <div class="house-ad-image-section">
        <img
            loading="lazy"
            :src="item.image || `https://placehold.co/300x300?text=${encodeURIComponent(item.title)}`"
            :alt="item.title"
        />
      </div>

      <div class="house-ad-info-section">
        <div class="house-ad-info-top">
          <h3 class="house-ad-title">{{ item.title }}</h3>
          <div class="house-ad-sponsored">
            <ion-icon :icon="starOutline" />
            <span>{{ $t('home.sponsored') }}</span>
          </div>
        </div>
        <div class="house-ad-info-bottom">
          <div :class="['house-ad-tier-badge', item.tier]">
            <ion-icon :icon="checkmarkCircle" v-if="item.tier === 'gold'" />
            <span>{{ item.tier.toUpperCase() }}</span>
          </div>
          <span class="house-ad-kind">
            <ion-icon :icon="kindIcon" />
            {{ providerLabel }}
          </span>
        </div>
      </div>
    </div>

    <!-- Rotation progress: fills over THIS item's tier turn length (gold
         stays up longest, bronze shortest — see turnDurationForTier).
         Driven by progressPercent, a plain reactive width recomputed on a
         setInterval tick — NOT a CSS animation. Ionic's <ion-tabs> keeps
         other tabs' pages alive in the DOM with display:none rather than
         destroying them, and onIonViewDidEnter turned out not to reliably
         re-fire for plain tab-bar switches in this app's single shared
         <ion-router-outlet> setup, which left a CSS animation-delay stuck
         at whatever it was computed as on first mount. A JS timer on a
         mounted-but-hidden component keeps running regardless of
         display:none, so this stays correct with no visibility hook at all. -->
    <div class="house-ad-progress-track">
      <div
          :class="['house-ad-progress-bar', item.tier]"
          :style="{ width: progressPercent + '%' }"
      />
    </div>
  </ion-card>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { IonCard, IonIcon } from '@ionic/vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Browser } from '@capacitor/browser'
import { checkmarkCircle, starOutline, storefront, pricetag, locationSharp, airplane } from 'ionicons/icons'
import {
  useHouseAds,
  getHouseAd,
  startHouseAdRotationTimer,
  turnDurationForTier,
} from '@/composables/useHouseAds'
import { ActivityLogService } from '@/services/ActivityLogService'
import { supabase } from '@/plugins/supabaseClient'

// 'banner': flush edge-to-edge, sized to match the real ad slot exactly
// (used everywhere the real AdMob/LevelPlay banner would otherwise sit).
// 'floating': a smaller, inset, rounded card — for views like Explore's
// map where a full-bleed strip looks intrusive over the map itself.
const props = withDefaults(defineProps<{ variant?: 'banner' | 'floating' }>(), {
  variant: 'banner',
})

const router = useRouter()
const { t } = useI18n()
const { loadHouseAdPool, poolLoaded, rotationIndex, turnStartedAt } = useHouseAds()

// Recompute whenever the shared rotation index or pool changes — every
// HouseAdCard on screen re-rolls together, same as the existing featured
// tier rotation in ExploreView/SearchView.
const item = computed(() => {
  // touch reactive deps so this recomputes on rotation/pool updates
  void rotationIndex.value
  void poolLoaded.value
  return getHouseAd()
})

// Ticks every 500ms so progressPercent stays live without depending on any
// Ionic page-visibility hook (see the progress-bar comment in the template
// for why those turned out to be unreliable here). Runs for as long as
// this component instance is mounted, even while its page is hidden behind
// another tab — that's fine, it's cheap, and it's exactly what keeps the
// bar correct the instant the page becomes visible again.
const nowTick = ref(Date.now())
let tickInterval: ReturnType<typeof setInterval> | null = null

const progressPercent = computed(() => {
  const ad = item.value
  if (!ad) return 0
  const total = turnDurationForTier(ad.tier)
  const elapsed = nowTick.value - turnStartedAt.value
  return Math.min(100, Math.max(0, (elapsed / total) * 100))
})

const KIND_ICONS = {
  partner: storefront,
  product: pricetag,
  location: locationSharp,
  trip: airplane,
} as const

const kindIcon = computed(() => item.value ? KIND_ICONS[item.value.kind] : storefront)

// The relationship this item has to whoever's paying for the placement:
// who sells it, who provides it, who certified it — not just its generic
// kind noun. Partners have no separate provider (they ARE the partner);
// other kinds fall back to the plain kind noun if a provider name is
// somehow missing from the pool data.
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

function adLogDetail(ad: NonNullable<typeof item.value>) {
  return {
    ad_kind: ad.kind,
    ad_id: ad.id,
    ad_tier: ad.tier,
    ad_title: ad.title,
    provider_name: ad.providerName ?? null,
    placement: 'banner',
    variant: props.variant,
    route: String(router.currentRoute.value.name ?? router.currentRoute.value.path),
  }
}

async function onOpen() {
  const ad = item.value
  if (!ad) return

  ActivityLogService.log('house_ad_click', adLogDetail(ad))

  // Trips don't have an in-app detail page — mirror TripListView.vue's
  // openTrip: log the click, bump the view count, then hand off to the
  // provider's own booking page in an in-app browser tab.
  if (ad.kind === 'trip' && ad.externalUrl) {
    ActivityLogService.log('trip_click', { trip_id: ad.id, trip_title: ad.title, source: 'house_ad' })
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

// Logs one impression each time a genuinely different ad rotates into this
// slot — not on every re-render (progressPercent ticks every 500ms but
// doesn't change `item`, so this watcher stays quiet in between turns).
watch(item, (ad) => {
  if (ad) ActivityLogService.log('house_ad_impression', adLogDetail(ad))
}, { immediate: true })

onMounted(() => {
  loadHouseAdPool()
  startHouseAdRotationTimer()
  tickInterval = setInterval(() => { nowTick.value = Date.now() }, 500)
})

onUnmounted(() => {
  if (tickInterval) clearInterval(tickInterval)
})
</script>

<style scoped>
/* Fixed at 65px to match the real ad slot exactly (every ad-space-* div
   across the app reserves height:65px for the adaptive banner) so the
   layout doesn't jump between a real ad and this fallback. */
.house-ad-card {
  position: relative;
  margin: 0;
  border-radius: 0;
  background: var(--ion-card-background, #fff);
  overflow: hidden;
  cursor: pointer;
  height: 65px;
  /* ExploreView's floating header sets pointer-events:none by default
     (it sits over the map and only becomes interactive in list mode) —
     re-enable clicks on this card specifically regardless of that. */
  pointer-events: auto;
}

/* Floating variant — a smaller, inset, rounded card rather than a flush
   full-width strip, for views like Explore's map where a banner-shaped
   bar looks intrusive sitting directly over the map. Matches the visual
   language of ExploreView's own .modern-location-card (radius/shadow). */
.house-ad-card.floating {
  margin: 8px 12px;
  width: auto;
  border-radius: 12px;
  box-shadow: var(--card-shadow-hover, 0 6px 20px rgba(0, 0, 0, 0.15));
  border: 1px solid var(--card-border, rgba(0, 0, 0, 0.08));
  background: rgba(var(--card-bg-rgb, 255, 255, 255), 0.92);
  backdrop-filter: blur(16px) saturate(180%);
}

.house-ad-progress-track {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  background: rgba(0, 0, 0, 0.08);
}
.house-ad-progress-bar {
  height: 100%;
  /* width is driven reactively by progressPercent (see script) rather than
     a CSS animation — smoothed between the 500ms ticks that update it. */
  transition: width 0.5s linear;
}
.house-ad-progress-bar.gold { background: #d4af37; }
.house-ad-progress-bar.silver { background: #aaaaaa; }
.house-ad-progress-bar.bronze { background: #b07438; }

.house-ad-inner {
  display: flex;
  height: 65px;
}

.house-ad-image-section {
  width: 65px;
  height: 65px;
  flex-shrink: 0;
  background: var(--ion-background-color-step-100, #f2f2f2);
}
.house-ad-image-section img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.house-ad-info-section {
  flex: 1;
  min-width: 0;
  padding: 6px 10px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
}

.house-ad-info-top {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.house-ad-title {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--ion-color-dark);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.house-ad-sponsored {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--ion-color-medium, #92949c);
  text-transform: uppercase;
}
.house-ad-sponsored ion-icon {
  font-size: 9px;
}

.house-ad-info-bottom {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.house-ad-tier-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.03em;
  padding: 1px 5px;
  border-radius: 5px;
  flex-shrink: 0;
}
.house-ad-tier-badge.gold {
  color: #7a5b00;
  background: rgba(212, 175, 55, 0.18);
}
.house-ad-tier-badge.silver {
  color: #555;
  background: rgba(170, 170, 170, 0.2);
}
.house-ad-tier-badge.bronze {
  color: #7a4620;
  background: rgba(176, 116, 56, 0.18);
}

.house-ad-kind {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 0.64rem;
  color: var(--ion-color-medium);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.house-ad-kind ion-icon {
  font-size: 11px;
  flex-shrink: 0;
}
</style>
