import { Capacitor } from '@capacitor/core'
import { Network } from '@capacitor/network'

// navigator.onLine is unreliable inside Android's WebView — it can keep
// reporting `true` after wifi/data is turned off, since it only reflects
// whether *a* network interface exists, not real connectivity. On native
// platforms we track Capacitor's Network plugin instead, which queries the
// OS directly; on web, navigator.onLine is the only signal available.
let cachedOnline = navigator.onLine
let restoredCallbacks: Array<() => void> = []

function setOnline(value: boolean) {
    const wasOffline = !cachedOnline
    cachedOnline = value
    if (value && wasOffline && restoredCallbacks.length) {
        const callbacks = restoredCallbacks
        restoredCallbacks = []
        callbacks.forEach(cb => { try { cb() } catch { /* one callback must not block the rest */ } })
    }
}

if (Capacitor.isNativePlatform()) {
    Network.getStatus()
        .then(status => { cachedOnline = status.connected })
        .catch(() => { /* keep navigator.onLine fallback */ })

    Network.addListener('networkStatusChange', status => setOnline(status.connected))
} else {
    window.addEventListener('online', () => setOnline(true))
    window.addEventListener('offline', () => setOnline(false))
}

/** Run `callback` once, the next time the device goes from offline to online. */
export function onConnectivityRestored(callback: () => void): void {
    restoredCallbacks.push(callback)
}

/** Best-effort synchronous connectivity check for guarding offline fallbacks. */
export function isDeviceOnline(): boolean {
    return cachedOnline
}
