// src/lib/admob.ts
import { AdMob, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob'
import { Capacitor } from '@capacitor/core'

let initialized = false
let jobId = 0 // increments to cancel in-flight updates

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
    try { await AdMob.removeBanner() } catch (e) { console.debug('AdMob remove skip', e) }
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

export async function moveBanner(adId: string, spaceId: string, isTesting: boolean | string = false) {
    if (!Capacitor.isNativePlatform()) return
    const myJob = ++jobId

    // Hard reset immediately to clear any existing banner at the top
    try { await AdMob.removeBanner() } catch (e) { console.debug('AdMob remove skip', e) }

    // wait until the slot exists
    const el = await waitForEl(spaceId)
    if (!el) return

    // Let the page settle. Ionic transitions can take 400ms+.
    // We wait a bit longer to ensure the "details-container" has moved to its final spot.
    await delay(350)
    
    if (myJob !== jobId) return

    const rect = el.getBoundingClientRect()
    // In Ionic, the scroll happens inside ion-content. 
    // We want the position relative to the viewport at this moment.
    const topOffset = Math.max(0, Math.round(rect.top))

    const testing = isTesting === true || isTesting === 'true'
    let finalAdId = adId
    if (testing) {
        finalAdId = Capacitor.getPlatform() === 'ios'
            ? 'ca-app-pub-3940256099942544/2934735716'  // Google iOS demo banner ID
            : 'ca-app-pub-3940256099942544/6300978111'; // Google Android demo banner ID
    }

    let marginValue = topOffset
    if (Capacitor.getPlatform() === 'ios') {
        const safeAreaTop = parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-top') || '0'
        ) || 0
        // ⚠️ @capacitor-community/admob iOS Layout Bug:
        // The plugin multiplies the passed Margin by -1 internally.
        // It sets: bannerView.top = safeAreaLayoutGuide.top - Margin.
        // To place the banner top exactly at rect.top, we need:
        // rect.top = safeAreaTop - Margin => Margin = safeAreaTop - rect.top.
        marginValue = Math.round(safeAreaTop - rect.top)
    }

    await AdMob.showBanner({
        adId: finalAdId,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.TOP_CENTER,
        margin: marginValue,
        isTesting: testing,
    })
}
