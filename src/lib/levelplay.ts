// src/lib/levelplay.ts
import { LevelPlayAds, AdEvent } from 'capacitor-levelplay-ads'
import { Capacitor } from '@capacitor/core'
import { markAdFailed, clearAdFailed, markAdLoaded, clearAdLoaded } from '@/composables/useAdFallback'
import { ActivityLogService } from '@/services/ActivityLogService'

// Ad telemetry. Every event carries ad_network 'levelplay' (house ads log
// their own house_ad_* events) plus the placement (space_id / ad_unit_id).
// Banners refresh on their own every ~30-60s, so impressions are throttled
// per placement to keep activity_log volume sane.
const IMPRESSION_THROTTLE_MS = 60_000
const lastImpressionAt = new Map<string, number>()

function adErrorMessage(info: any): string | undefined {
    const m = info?.errorMessage ?? info?.error ?? info?.message
    return m != null ? String(m) : undefined
}

function logAd(activity: string, detail: Record<string, any> = {}) {
    ActivityLogService.log(activity, { ad_network: 'levelplay', platform: Capacitor.getPlatform(), ...detail })
}

let initialized = false
let bannerListenersRegistered = false
let activeBannerSpaceId: string | null = null
// Mirrors admob.ts's settle-timeout safety net — if neither BannerLoaded nor
// BannerLoadFailed fires within this long, treat it as a no-fill.
let bannerSettled = false
const BANNER_SETTLE_TIMEOUT_MS = 4000

function registerBannerListeners() {
    if (bannerListenersRegistered) return
    bannerListenersRegistered = true
    LevelPlayAds.addListener(AdEvent.BannerLoaded, () => {
        bannerSettled = true
        clearAdFailed(activeBannerSpaceId ?? undefined)
        markAdLoaded(activeBannerSpaceId)
    }).catch((e) => console.debug('[LevelPlay] listener register skip', e))
    LevelPlayAds.addListener(AdEvent.BannerLoadFailed, (info: any) => {
        bannerSettled = true
        logAd('ad_load_failed', { ad_format: 'banner', space_id: activeBannerSpaceId, error_code: info?.errorCode, error_message: adErrorMessage(info) })
        markAdFailed(activeBannerSpaceId)
    }).catch((e) => console.debug('[LevelPlay] listener register skip', e))
    // A banner can load fine but then fail to actually render on a later
    // internal refresh (onAdDisplayFailed) — without this, BannerLoaded had
    // already cleared the fallback and nothing ever re-shows it, so the ad
    // slot goes blank and stays blank until the next navigation.
    LevelPlayAds.addListener(AdEvent.BannerDisplayFailed, (info: any) => {
        logAd('ad_display_failed', { ad_format: 'banner', space_id: activeBannerSpaceId, error_code: info?.errorCode, error_message: adErrorMessage(info) })
        markAdFailed(activeBannerSpaceId)
    }).catch((e) => console.debug('[LevelPlay] listener register skip', e))
    LevelPlayAds.addListener(AdEvent.BannerDisplayed, () => {
        const space = activeBannerSpaceId ?? 'unknown'
        const now = Date.now()
        if (now - (lastImpressionAt.get(space) ?? 0) < IMPRESSION_THROTTLE_MS) return
        lastImpressionAt.set(space, now)
        logAd('ad_impression', { ad_format: 'banner', space_id: activeBannerSpaceId })
    }).catch((e) => console.debug('[LevelPlay] listener register skip', e))
    LevelPlayAds.addListener(AdEvent.BannerClicked, () => {
        logAd('ad_click', { ad_format: 'banner', space_id: activeBannerSpaceId })
    }).catch((e) => console.debug('[LevelPlay] listener register skip', e))
}
// Memoized so concurrent/early callers (e.g. a fast navigation to a screen
// with a banner right after app launch) await the SAME in-flight init
// instead of racing it and silently no-op'ing like the pre-fix AdMob code did.
let initPromise: Promise<void> | null = null

// Master kill switch for the whole mediation SDK — flip
// VITE_LEVELPLAY_ENABLED=false to turn LevelPlay off (no init, no banners,
// no rewarded ads) without touching house ads, which don't go through here
// at all (HouseAdCard/HouseAdNativeCard read useHouseAds.ts directly).
export function isLevelPlayEnabled(): boolean {
    return import.meta.env.VITE_LEVELPLAY_ENABLED !== 'false'
}

export function initLevelPlay(): Promise<void> {
    if (!Capacitor.isNativePlatform() || !isLevelPlayEnabled()) return Promise.resolve()
    if (!initPromise) {
        initPromise = (async () => {
            try {
                const appKey = Capacitor.getPlatform() === 'ios'
                    ? import.meta.env.VITE_LEVELPLAY_IOS_APP_KEY
                    : import.meta.env.VITE_LEVELPLAY_ANDROID_APP_KEY

                await LevelPlayAds.initialize({
                    appKey,
                    isTesting: import.meta.env.VITE_LEVELPLAY_TESTING === 'true',
                })

                // No `services` config yet — this falls back to a basic permissive
                // consent stub (gdprApplies=0) rather than showing a real CMP modal.
                // Build a proper services.json (see plugin README) before shipping
                // to EU/EEA users.
                await LevelPlayAds.requestConsentInfo({})

                if (Capacitor.getPlatform() === 'ios') {
                    await LevelPlayAds.requestTrackingAuthorization()
                }

                initialized = true
                console.log('[LevelPlay] SDK initialized successfully')
            } catch (e) {
                console.debug('[LevelPlay] init skip', e)
                logAd('ad_init_failed', { error_message: adErrorMessage(e) ?? String(e) })
            }
        })()
    }
    return initPromise
}

export async function showLevelPlayBanner(adUnitId: string, spaceId?: string) {
    if (!Capacitor.isNativePlatform()) return
    if (!isLevelPlayEnabled()) {
        // LevelPlay is switched off — skip mediation entirely and go
        // straight to the house-ad banner fallback (see markAdFailed).
        markAdFailed(spaceId)
        return
    }
    await initLevelPlay()
    if (!initialized) {
        // SDK never came up (bad app key, network, etc) — no load/fail event
        // will ever fire, so mark it failed ourselves rather than leaving
        // the slot silently blank.
        logAd('ad_load_failed', { ad_format: 'banner', space_id: spaceId, error_message: 'sdk_not_initialized' })
        markAdFailed(spaceId)
        return
    }
    registerBannerListeners()
    clearAdFailed(activeBannerSpaceId ?? undefined)
    clearAdLoaded(activeBannerSpaceId ?? undefined)
    activeBannerSpaceId = spaceId ?? null
    bannerSettled = false
    try {
        await LevelPlayAds.createBanner({
            adUnitId,
            adSize: 'ADAPTIVE',
            position: 'TOP',
            isOverlap: true, // Native banner overlays the WebView in the space provided by Web UI
        })
        console.log('[LevelPlay] Banner shown:', adUnitId)
        setTimeout(() => {
            if (activeBannerSpaceId === spaceId && !bannerSettled) {
                bannerSettled = true
                logAd('ad_load_failed', { ad_format: 'banner', space_id: spaceId, error_message: 'settle_timeout' })
                markAdFailed(spaceId)
            }
        }, BANNER_SETTLE_TIMEOUT_MS)
    } catch (e) {
        bannerSettled = true
        logAd('ad_load_failed', { ad_format: 'banner', space_id: spaceId, error_message: adErrorMessage(e) ?? String(e) })
        markAdFailed(spaceId)
        console.debug('[LevelPlay] banner skip', e)
    }
}

export async function hideLevelPlayBanner() {
    if (!Capacitor.isNativePlatform()) return
    await initLevelPlay()
    if (!initialized) return
    try {
        await LevelPlayAds.hideBanner()
        console.log('[LevelPlay] Banner hidden')
    } catch (e) {
        console.debug('[LevelPlay] hide skip', e)
    }
}

export async function destroyLevelPlayBanner() {
    if (!Capacitor.isNativePlatform()) return
    await initLevelPlay()
    if (!initialized) return
    clearAdFailed(activeBannerSpaceId ?? undefined)
    clearAdLoaded(activeBannerSpaceId ?? undefined)
    activeBannerSpaceId = null
    try {
        await LevelPlayAds.destroyBanner()
        console.log('[LevelPlay] Banner destroyed')
    } catch (e) {
        console.debug('[LevelPlay] destroy skip', e)
    }
}

export async function showLevelPlayRewardedAd(adUnitId: string, onReward: () => void): Promise<void> {
    if (!Capacitor.isNativePlatform()) return
    if (!isLevelPlayEnabled()) {
        // No house-ad equivalent for rewarded — surface a clear failure so
        // callers (e.g. ScanIngredientsView's "watch ad" flow) show their
        // existing "ad failed" error state instead of hanging.
        logAd('ad_rewarded_failed', { ad_format: 'rewarded', ad_unit_id: adUnitId, error_message: 'levelplay_disabled' })
        throw new Error('LevelPlay is disabled')
    }
    await initLevelPlay()
    if (!initialized) {
        console.warn('[LevelPlay] not ready — rewarded ad skipped')
        logAd('ad_rewarded_failed', { ad_format: 'rewarded', ad_unit_id: adUnitId, error_message: 'sdk_not_initialized' })
        return
    }

    logAd('ad_rewarded_requested', { ad_format: 'rewarded', ad_unit_id: adUnitId })

    return new Promise<void>(async (resolve, reject) => {
        let rewarded = false
        const listeners: any[] = []
        const cleanup = async () => {
            for (const handle of listeners) {
                try { await handle.remove() } catch (e) { console.debug('[LevelPlay] listener remove skip', e) }
            }
        }

        try {
            listeners.push(await LevelPlayAds.addListener(AdEvent.RewardedRewarded, async (reward) => {
                console.log('[LevelPlay] reward earned:', reward)
                rewarded = true
                logAd('ad_reward_earned', { ad_format: 'rewarded', ad_unit_id: adUnitId })
                try { await onReward() } catch (e) { console.error('[LevelPlay] error in onReward callback:', e) }
            }))

            listeners.push(await LevelPlayAds.addListener(AdEvent.RewardedClicked, () => {
                logAd('ad_click', { ad_format: 'rewarded', ad_unit_id: adUnitId })
            }))

            listeners.push(await LevelPlayAds.addListener(AdEvent.RewardedDisplayed, () => {
                logAd('ad_impression', { ad_format: 'rewarded', ad_unit_id: adUnitId })
            }))

            listeners.push(await LevelPlayAds.addListener(AdEvent.RewardedClosed, async () => {
                if (!rewarded) logAd('ad_rewarded_closed_no_reward', { ad_format: 'rewarded', ad_unit_id: adUnitId })
                await cleanup()
                resolve()
            }))

            await LevelPlayAds.loadRewarded({ adUnitId })
            const { isReady } = await LevelPlayAds.isRewardedReady()
            if (!isReady) {
                console.debug('[LevelPlay] rewarded ad not ready:', adUnitId)
                logAd('ad_rewarded_failed', { ad_format: 'rewarded', ad_unit_id: adUnitId, error_message: 'not_ready' })
                await cleanup()
                reject(new Error('Rewarded ad not ready'))
                return
            }
            console.log('[LevelPlay] Rewarded ad shown:', adUnitId)
            await LevelPlayAds.showRewarded()
        } catch (err) {
            console.debug('[LevelPlay] rewarded skip', err)
            logAd('ad_rewarded_failed', { ad_format: 'rewarded', ad_unit_id: adUnitId, error_message: adErrorMessage(err) ?? String(err) })
            await cleanup()
            reject(err)
        }
    })
}
