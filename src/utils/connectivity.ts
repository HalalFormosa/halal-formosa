import { Capacitor } from '@capacitor/core'
import { Network } from '@capacitor/network'

// navigator.onLine is unreliable inside Android's WebView — it can keep
// reporting `true` after wifi/data is turned off, since it only reflects
// whether *a* network interface exists, not real connectivity. On native
// platforms we track Capacitor's Network plugin instead, which queries the
// OS directly; on web, navigator.onLine is the only signal available.
let cachedOnline = navigator.onLine

if (Capacitor.isNativePlatform()) {
    Network.getStatus()
        .then(status => { cachedOnline = status.connected })
        .catch(() => { /* keep navigator.onLine fallback */ })

    Network.addListener('networkStatusChange', status => {
        cachedOnline = status.connected
    })
} else {
    window.addEventListener('online', () => { cachedOnline = true })
    window.addEventListener('offline', () => { cachedOnline = false })
}

/** Best-effort synchronous connectivity check for guarding offline fallbacks. */
export function isDeviceOnline(): boolean {
    return cachedOnline
}
