import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useTheme, isDark } from '@/composables/useTheme'
import { StatusBar } from '@capacitor/status-bar'
import { NavigationBar } from '@capgo/capacitor-navigation-bar'

// Mock capacitor plugins
vi.mock('@capacitor/status-bar', () => ({
    StatusBar: {
        setStyle: vi.fn(),
        setBackgroundColor: vi.fn(),
    },
    Style: {
        Dark: 'DARK',
        Light: 'LIGHT',
    }
}))

vi.mock('@capgo/capacitor-navigation-bar', () => ({
    NavigationBar: {
        setNavigationBarColor: vi.fn(),
    }
}))

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: vi.fn().mockReturnValue(true),
    }
}))

describe('useTheme', () => {
    let mockStorage: Record<string, string> = {}

    beforeEach(() => {
        mockStorage = {}
        vi.stubGlobal('localStorage', {
            getItem: vi.fn((key: string) => mockStorage[key] || null),
            setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value }),
        })

        // Mock document.documentElement.classList
        vi.stubGlobal('document', {
            documentElement: {
                classList: {
                    toggle: vi.fn(),
                }
            }
        })
        
        // Mock matchMedia
        vi.stubGlobal('window', {
            matchMedia: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn() })
        })

        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('should toggle dark palette correctly and update styles natively', async () => {
        const { toggleDarkPalette } = useTheme()
        
        await toggleDarkPalette(true)
        
        expect(isDark.value).toBe(true)
        expect(document.documentElement.classList.toggle).toHaveBeenCalledWith('ion-palette-dark', true)
        expect(localStorage.setItem).toHaveBeenCalledWith('preferred-theme', 'dark')
        
        // Because it's "high contrast" for the system bar:
        // When app is dark, system bar gets light background
        expect(StatusBar.setStyle).toHaveBeenCalledWith({ style: 'DARK' }) // Dark icons
        expect(StatusBar.setBackgroundColor).toHaveBeenCalledWith({ color: '#ffffff' })
        expect(NavigationBar.setNavigationBarColor).toHaveBeenCalledWith({
            color: '#ffffff',
            darkButtons: true
        })
    })

    it('should initialize theme based on localStorage preference', () => {
        mockStorage['preferred-theme'] = 'dark'
        const { initTheme } = useTheme()
        
        initTheme()
        
        expect(isDark.value).toBe(true)
    })

    it('should fallback to media query if no preference saved', () => {
        vi.stubGlobal('window', {
            matchMedia: vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn() })
        })

        const { initTheme } = useTheme()
        initTheme()
        
        expect(isDark.value).toBe(true)
    })
})
