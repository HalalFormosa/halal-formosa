import { toastController } from '@ionic/vue'
import { i18n } from '@/i18n'
import { isDeviceOnline } from '@/utils/connectivity'

/** Network failures (offline, DNS down, etc.) surface as raw fetch/TypeError
 *  messages from supabase-js — this tells those apart from real API errors. */
export function isNetworkError(err: { message?: string } | null | undefined): boolean {
    if (!isDeviceOnline()) return true
    const msg = err?.message?.toLowerCase() || ''
    return msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('load failed')
}

let lastToastAt = 0

/** Shows a plain-language toast for a failed fetch instead of a raw error
 *  message, throttled so a retry loop can't spam the user with duplicates. */
export async function notifyFetchError(err: { message?: string } | null | undefined) {
    const now = Date.now()
    if (now - lastToastAt < 4000) return
    lastToastAt = now

    const offline = isNetworkError(err)
    const message = offline
        ? i18n.global.t('common.offlineMessage')
        : (err?.message || i18n.global.t('common.error'))

    const toast = await toastController.create({
        message,
        duration: 3000,
        color: offline ? 'medium' : 'danger',
        position: 'bottom',
    })
    await toast.present()
}
