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

    // wait until the slot exists
    const el = await waitForEl(spaceId)
    if (!el) {
        // page never produced the slot -> ensure nothing shows
        if (myJob === jobId) { try { await AdMob.removeBanner() } catch (e) { console.debug('AdMob remove skip', e) } }
        return
    }

    // let layout settle so top offset is correct
    await new Promise<void>(r => requestAnimationFrame(() => r()))
    await delay(120) // 120ms to let Ionic header animate in
    const rect = el.getBoundingClientRect()
    const topOffset = Math.max(0, Math.round(rect.top + window.scrollY))

    // hard reset before re-show to avoid carry-over margins
    try { await AdMob.removeBanner() } catch (e) { console.debug('AdMob remove skip', e) }

    // if a newer navigation happened, abort
    if (myJob !== jobId) return

    await AdMob.showBanner({
        adId,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.TOP_CENTER,
        margin: topOffset,
        isTesting: isTesting === true || isTesting === 'true',
    })
}
