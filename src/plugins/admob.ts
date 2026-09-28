import { Capacitor } from '@capacitor/core'
import { showLevelPlayBanner, destroyLevelPlayBanner } from '@/lib/levelplay'
import { isDonor } from '@/composables/useSubscriptionStatus'
import router from '@/router'

// Banners are now served through LevelPlay mediation (ironSource, with AdMob
// wired in as one of its mediated networks) instead of the old AdMob-direct
// plugin — verified first on the Search placement, now rolled out everywhere
// via this same route-driven scheduler. See src/lib/levelplay.ts.
export function scheduleBannerUpdate() {
    if (!Capacitor.isNativePlatform()) return

    clearTimeout((window as any).__adT)
        ; (window as any).__adT = setTimeout(async () => {
            const r = router.currentRoute.value
            const noAds = !!r.meta?.noAds || isDonor.value
            const spaceId = r.meta?.adSpaceId as string | undefined
            const levelPlayAdId = r.meta?.levelPlayAdId as string | undefined

            if (noAds || !spaceId || !levelPlayAdId) {
                await destroyLevelPlayBanner().catch(() => { })
                return
            }
            await showLevelPlayBanner(levelPlayAdId, spaceId)
        }, 70)
}
