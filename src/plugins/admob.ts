import { Capacitor } from '@capacitor/core'
import { hideBanner, moveBanner } from '@/lib/admob'
import router from '@/router'

export function scheduleBannerUpdate() {
    if (!Capacitor.isNativePlatform()) return

    clearTimeout((window as any).__adT)
    ;(window as any).__adT = setTimeout(async () => {
        const r = router.currentRoute.value
        const noAds = !!r.meta?.noAds
        const spaceId = r.meta?.adSpaceId as string | undefined
        const adId = (r.meta?.adId as string | undefined) || import.meta.env.VITE_ADMOB_BANNER_ID

        if (noAds || !spaceId) {
            await hideBanner().catch(() => {})
            return
        }
        await moveBanner(adId, spaceId, import.meta.env.VITE_ADMOB_TESTING)
    }, 70)
}
