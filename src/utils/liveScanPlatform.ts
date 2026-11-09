import { Capacitor } from '@capacitor/core'

/**
 * Live Verdict needs the native LiveText camera plugin, which exists on Android
 * (ML Kit) and iOS (Apple Vision). The web build has no such plugin.
 */
export function isLiveVerdictSupported(): boolean {
    const platform = Capacitor.getPlatform()
    return platform === 'android' || platform === 'ios'
}
