// src/lib/admob.ts
import { AdMob, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob'
import { Capacitor } from '@capacitor/core'

let initialized = false
let jobId = 0 // increments to cancel in-flight updates

export async function initAdMob() {
    if (!Capacitor.isNativePlatform() || initialized) return
    try { await AdMob.initialize(); initialized = true } catch (e) { console.debug('AdMob init skip', e) }
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

    await AdMob.showBanner({
        adId,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.TOP_CENTER,
        margin: topOffset,
        isTesting: isTesting === true || isTesting === 'true',
    })
}
