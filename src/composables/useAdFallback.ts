// Tracks which ad space (by its `adSpaceId`, e.g. "ad-space-explore") most
// recently failed to fill so views can swap in a HouseAdCard instead of a
// blank ad slot. Shared by both ad SDKs (AdMob in lib/admob.ts, LevelPlay in
// lib/levelplay.ts) so either one reports into the same signal.
import { computed, ref, type Ref } from 'vue'
import { Capacitor } from '@capacitor/core'

export const failedAdSpaceId = ref<string | null>(null)

// The ad space whose real banner has confirmed it loaded (BannerLoaded).
// Pages without a house-ad fallback at the top use this to keep the reserved
// slot ONLY while a real banner is actually there.
export const loadedAdSpaceId = ref<string | null>(null)

// True on native when the real banner for `spaceId` failed to fill and a
// HouseAdCard is showing in its place. Views use it to collapse the reserved
// banner slot down to the status-bar inset and to drop the toolbar's own
// status-bar padding (see `ion-header.house-ad-top` in theme/variables.css),
// otherwise the status bar is cleared twice and a big empty gap shows up
// around the house ad.
export function useHouseAdAtTop(spaceId: string, isDonor: Ref<boolean>) {
    const native = Capacitor.isNativePlatform()
    return computed(() => native && !isDonor.value && failedAdSpaceId.value === spaceId)
}

// For pages with no house-ad fallback at the top (detail pages): the reserved
// 65px slot is only worth keeping while a real banner has confirmed it loaded.
// Anything else — failed, kill-switched, never reported, still loading —
// leaves it collapsed so there's no empty strip above the hero image.
export function useAdSlotCollapsed(spaceId: string, isDonor: Ref<boolean>) {
    const native = Capacitor.isNativePlatform()
    return computed(() => native && !isDonor.value && loadedAdSpaceId.value !== spaceId)
}

// Style for the reserved ad-space div: the usual 65px slot (plus status-bar
// padding) for the real banner, or just the status-bar inset when a house ad
// has taken over.
export function adSpaceStyle(houseAdAtTop: boolean) {
    return houseAdAtTop
        ? { height: 'var(--ion-safe-area-top, 0px)' }
        : { height: '65px', paddingTop: 'var(--ion-safe-area-top, 0)' }
}

export function markAdFailed(spaceId: string | null | undefined) {
    if (!spaceId) return
    failedAdSpaceId.value = spaceId
    if (loadedAdSpaceId.value === spaceId) loadedAdSpaceId.value = null
}

export function markAdLoaded(spaceId: string | null | undefined) {
    if (!spaceId) return
    loadedAdSpaceId.value = spaceId
}

// Clears the fallback for a specific space (on a successful load), or
// unconditionally when called with no id (e.g. banner hidden/torn down).
export function clearAdFailed(spaceId?: string) {
    if (!spaceId || failedAdSpaceId.value === spaceId) {
        failedAdSpaceId.value = null
    }
}

export function clearAdLoaded(spaceId?: string) {
    if (!spaceId || loadedAdSpaceId.value === spaceId) {
        loadedAdSpaceId.value = null
    }
}
