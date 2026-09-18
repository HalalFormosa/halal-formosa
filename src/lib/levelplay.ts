// src/lib/levelplay.ts
import { LevelPlayAds, AdEvent } from 'capacitor-levelplay-ads'
import { Capacitor } from '@capacitor/core'

let initialized = false
// Memoized so concurrent/early callers (e.g. a fast navigation to a screen
// with a banner right after app launch) await the SAME in-flight init
// instead of racing it and silently no-op'ing like the pre-fix AdMob code did.
let initPromise: Promise<void> | null = null

export function initLevelPlay(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return Promise.resolve()
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
            }
        })()
    }
    return initPromise
}

export async function showLevelPlayBanner(adUnitId: string) {
    if (!Capacitor.isNativePlatform()) return
    await initLevelPlay()
    if (!initialized) return
    try {
        await LevelPlayAds.createBanner({
            adUnitId,
            adSize: 'ADAPTIVE',
            position: 'TOP',
            isOverlap: false, // Android: pushes the WebView down instead of overlaying it
        })
        console.log('[LevelPlay] Banner shown:', adUnitId)
    } catch (e) {
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
    try {
        await LevelPlayAds.destroyBanner()
        console.log('[LevelPlay] Banner destroyed')
    } catch (e) {
        console.debug('[LevelPlay] destroy skip', e)
    }
}

export async function showLevelPlayRewardedAd(adUnitId: string, onReward: () => void): Promise<void> {
    if (!Capacitor.isNativePlatform()) return
    await initLevelPlay()
    if (!initialized) {
        console.warn('[LevelPlay] not ready — rewarded ad skipped')
        return
    }

    return new Promise<void>(async (resolve, reject) => {
        const listeners: any[] = []
        const cleanup = async () => {
            for (const handle of listeners) {
                try { await handle.remove() } catch (e) { console.debug('[LevelPlay] listener remove skip', e) }
            }
        }

        try {
            listeners.push(await LevelPlayAds.addListener(AdEvent.RewardedRewarded, async (reward) => {
                console.log('[LevelPlay] reward earned:', reward)
                try { await onReward() } catch (e) { console.error('[LevelPlay] error in onReward callback:', e) }
            }))

            listeners.push(await LevelPlayAds.addListener(AdEvent.RewardedClosed, async () => {
                await cleanup()
                resolve()
            }))

            await LevelPlayAds.loadRewarded({ adUnitId })
            const { isReady } = await LevelPlayAds.isRewardedReady()
            if (!isReady) {
                console.debug('[LevelPlay] rewarded ad not ready:', adUnitId)
                await cleanup()
                reject(new Error('Rewarded ad not ready'))
                return
            }
            console.log('[LevelPlay] Rewarded ad shown:', adUnitId)
            await LevelPlayAds.showRewarded()
        } catch (err) {
            console.debug('[LevelPlay] rewarded skip', err)
            await cleanup()
            reject(err)
        }
    })
}
