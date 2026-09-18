// src/lib/admob.ts
import { AdMob, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob'
import { Capacitor } from '@capacitor/core'

let initialized = false
let jobId = 0 // increments to cancel in-flight updates

// The native AdMob plugin resolves removeBanner()/showBanner() before their
// underlying runOnUiThread work actually finishes, so two overlapping
// moveBanner() calls can race on the plugin's shared mAdView field and crash
// with a NullPointerException (assignIdToAdView on a since-nulled AdView).
// Serializing every native banner call through this queue guarantees one
// call's native work is done before the next one starts.
let bannerQueue: Promise<void> = Promise.resolve()
function enqueueBannerOp(op: () => Promise<void>): Promise<void> {
    bannerQueue = bannerQueue.then(op, op)
    return bannerQueue
}
const NATIVE_SETTLE_MS = 60

export async function initAdMob() {
    if (!Capacitor.isNativePlatform() || initialized) return
    try { 
        // 📱 Request App Tracking Transparency on iOS first
        if (Capacitor.getPlatform() === 'ios') {
            // Wait for app to be active and UI to mount
            await delay(1000)
            try {
                console.log('🔒 Requesting App Tracking Transparency authorization...');
                await AdMob.requestTrackingAuthorization();
            } catch (attError) {
                console.warn('⚠️ ATT tracking request failed or was not accepted:', attError);
            }
        }
        await AdMob.initialize(); 
        initialized = true 
    } catch (e) { 
        console.debug('AdMob init skip', e) 
    }
}

export async function hideBanner() {
    if (!Capacitor.isNativePlatform()) return
    jobId++ // cancel any in-flight move
    await enqueueBannerOp(async () => {
        try { await AdMob.removeBanner() } catch (e) { console.debug('AdMob remove skip', e) }
        // Let the plugin's own runOnUiThread cleanup actually finish before
        // the next queued banner op is allowed to touch the native AdView.
        await delay(NATIVE_SETTLE_MS)
    })
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function waitForEl(id: string, tries = 24, step = 50): Promise<HTMLElement | null> {
    for (let i = 0; i < tries; i++) {
        const el = document.getElementById(id)
        if (el) return el
        await delay(step)
    }
    return null
}

function getSafeAreaTop(): number {
    const div = document.createElement('div')
    div.style.position = 'absolute'
    div.style.top = '0'
    div.style.left = '0'
    div.style.height = 'env(safe-area-inset-top)'
    div.style.visibility = 'hidden'
    document.body.appendChild(div)
    const height = div.offsetHeight
    document.body.removeChild(div)
    return height || 0
}

export async function moveBanner(adId: string, spaceId: string, isTesting: boolean | string = false) {
    if (!Capacitor.isNativePlatform()) return
    const myJob = ++jobId

    // Hard reset immediately to clear any existing banner at the top.
    // Routed through the same queue as showBanner() below so this removal's
    // native runOnUiThread work fully completes before anything else touches
    // the plugin's shared AdView.
    await enqueueBannerOp(async () => {
        try { await AdMob.removeBanner() } catch (e) { console.debug('AdMob remove skip', e) }
        await delay(NATIVE_SETTLE_MS)
    })
    if (myJob !== jobId) return

    // wait until the slot exists
    const el = await waitForEl(spaceId)
    if (!el) return

    // Let the page settle. Ionic transitions can take 400ms+.
    // We wait a bit longer to ensure the "details-container" has moved to its final spot.
    await delay(350)

    if (myJob !== jobId) return

    const rect = el.getBoundingClientRect()
    // The target top position relative to the screen top
    const rectTop = Math.round(rect.top)
    
    // Get actual safe area top in pixels (resolves env(safe-area-inset-top) correctly)
    const safeAreaTop = getSafeAreaTop()

    const testing = isTesting === true || isTesting === 'true'
    let finalAdId = adId
    if (testing) {
        finalAdId = Capacitor.getPlatform() === 'ios'
            ? 'ca-app-pub-3940256099942544/2934735716'  // Google iOS demo banner ID
            : 'ca-app-pub-3940256099942544/6300978111'; // Google Android demo banner ID
    }

    let marginValue = rectTop
    if (Capacitor.getPlatform() === 'ios') {
        // ⚠️ @capacitor-community/admob iOS Layout Bug:
        // The plugin multiplies the passed Margin by -1 internally.
        // It sets: bannerView.top = safeAreaLayoutGuide.top - Margin.
        // To place the banner top exactly at targetY, we need:
        // targetY = safeAreaTop - Margin => Margin = safeAreaTop - targetY.
        // To guarantee ads are never shown in the unsafe area, targetY must be at least safeAreaTop.
        // So targetY = Math.max(safeAreaTop, rectTop).
        // Margin = safeAreaTop - Math.max(safeAreaTop, rectTop) => Margin = Math.min(0, safeAreaTop - rectTop).
        marginValue = Math.min(0, safeAreaTop - rectTop)
    } else {
        // Android / other platforms:
        // Place the banner at rectTop but clamp to at least safeAreaTop to respect the safe area.
        marginValue = Math.max(safeAreaTop, rectTop)
    }

    await enqueueBannerOp(async () => {
        if (myJob !== jobId) return
        await AdMob.showBanner({
            adId: finalAdId,
            adSize: BannerAdSize.ADAPTIVE_BANNER,
            position: BannerAdPosition.TOP_CENTER,
            margin: marginValue,
            isTesting: testing,
        })
    })
}
