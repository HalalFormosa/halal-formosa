import { Style, StatusBar } from '@capacitor/status-bar'
import { NavigationBar } from '@capgo/capacitor-navigation-bar'
import { Capacitor } from '@capacitor/core'

/**
 * Legacy init function. 
 * Now dynamic updates are handled in useTheme.ts
 */
export async function initSystemBars(isDark: boolean = false) {
    if (!Capacitor.isNativePlatform()) return

    try {
        if (isDark) {
            await StatusBar.setStyle({ style: Style.Light })
            await StatusBar.setBackgroundColor({ color: '#1c1c1d' })
            await NavigationBar.setNavigationBarColor({
                color: '#1c1c1d',
                darkButtons: false,
            })
        } else {
            await StatusBar.setStyle({ style: Style.Dark })
            await StatusBar.setBackgroundColor({ color: '#ffffff' })
            await NavigationBar.setNavigationBarColor({
                color: '#ffffff',
                darkButtons: true,
            })
        }
    } catch (e) {
        console.warn('System bars init failed:', e)
    }
}