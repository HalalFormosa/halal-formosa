import { Capacitor } from '@capacitor/core'
import { SafeArea } from 'capacitor-plugin-safe-area'
import { App as CapacitorApp } from '@capacitor/app'

type Insets = {
    top: number
    right: number
    bottom: number
    left: number
}

export function initSafeArea() {
    if (Capacitor.isNativePlatform()) {
        console.log('[SafeArea] Native platform detected')

        SafeArea.getSafeAreaInsets().then(({ insets }) => {
            console.log('[SafeArea] Initial insets:', JSON.stringify(insets))
            applyInsets(insets)
        })

        SafeArea.addListener('safeAreaChanged', ({ insets }) => {
            console.log('[SafeArea] Insets changed:', JSON.stringify(insets))
            applyInsets(insets)
        })

        CapacitorApp.addListener('appStateChange', ({ isActive }) => {
            if (isActive) {
                console.log('[SafeArea] App resumed → re-check insets')
                SafeArea.getSafeAreaInsets().then(({ insets }) => applyInsets(insets))
            }
        })
    } else {
        console.log('[SafeArea] Web fallback (using env() vars)')
        applyInsets({
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
        })
    }
}

function applyInsets(insets: Insets) {
    (Object.entries(insets) as [keyof Insets, number][]).forEach(([key, value]) => {
        const cssVar = `--safe-area-inset-${key}`
        document.documentElement.style.setProperty(cssVar, `${value || 0}px`)
    })
}

