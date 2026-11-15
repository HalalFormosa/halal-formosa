import { ref, onMounted } from 'vue'
import { StatusBar, Style } from '@capacitor/status-bar'
import { NavigationBar } from '@capgo/capacitor-navigation-bar'
import { Capacitor } from '@capacitor/core'

export const isDark = ref(false)

export function useTheme() {
    const toggleDarkPalette = async (enabled: boolean) => {
        isDark.value = enabled
        document.documentElement.classList.toggle('ion-palette-dark', enabled)
        localStorage.setItem('preferred-theme', enabled ? 'dark' : 'light')

        if (Capacitor.isNativePlatform()) {
            try {
                if (enabled) {
                    // 🌓 High Contrast: Dark Theme App -> Light System Bar
                    await StatusBar.setStyle({ style: Style.Dark }) // Dark text/icons
                    await StatusBar.setBackgroundColor({ color: '#ffffff' }) // White background
                    await NavigationBar.setNavigationBarColor({
                        color: '#ffffff',
                        darkButtons: true, // Dark icons
                    })
                } else {
                    // 🌓 High Contrast: Light Theme App -> Dark System Bar
                    await StatusBar.setStyle({ style: Style.Light }) // White text/icons
                    await StatusBar.setBackgroundColor({ color: '#1c1c1d' }) // Dark gray
                    await NavigationBar.setNavigationBarColor({
                        color: '#1c1c1d',
                        darkButtons: false, // White icons
                    })
                }
            } catch (e) {
                console.warn('System bar update failed:', e)
            }
        }
    }

    const initTheme = () => {
        const savedTheme = localStorage.getItem('preferred-theme')
        const prefersDarkQuery = window.matchMedia('(prefers-color-scheme: dark)')

        let shouldBeDark = false
        if (savedTheme === 'dark') {
            shouldBeDark = true
        } else if (savedTheme === 'light') {
            shouldBeDark = false
        } else {
            shouldBeDark = prefersDarkQuery.matches
        }

        toggleDarkPalette(shouldBeDark)

        prefersDarkQuery.addEventListener('change', (mediaQuery) => {
            if (!localStorage.getItem('preferred-theme')) {
                toggleDarkPalette(mediaQuery.matches)
            }
        })
    }

    return {
        isDark,
        toggleDarkPalette,
        initTheme
    }
}
