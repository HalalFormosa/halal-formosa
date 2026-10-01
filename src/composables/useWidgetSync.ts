import { Capacitor, registerPlugin } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

interface WidgetSyncPlugin {
  refresh(): Promise<void>
}

const WidgetSync = registerPlugin<WidgetSyncPlugin>('WidgetSync')

interface ScanWidgetState {
  loggedIn: boolean
  remaining?: number | null
  unlimited?: boolean
}

// Pushes scan-quota state to the Android home screen widgets (light/dark, all sizes).
// No-op on iOS/web — the widgets and native plugin only exist on Android.
export async function syncScanWidget(state: ScanWidgetState) {
  if (Capacitor.getPlatform() !== 'android') return

  try {
    await Preferences.set({ key: 'widget_logged_in', value: state.loggedIn ? '1' : '0' })

    let remainingValue = ''
    if (state.loggedIn) {
      remainingValue = state.unlimited
        ? '∞'
        : (state.remaining != null ? String(Math.max(0, state.remaining)) : '')
    }
    await Preferences.set({ key: 'widget_scans_remaining', value: remainingValue })

    await WidgetSync.refresh()
  } catch (err) {
    console.warn('[WidgetSync] Failed to sync widget state:', err)
  }
}

interface PrayerWidgetTimes {
  fajr: string
  dhuhr: string
  asr: string
  maghrib: string
  isha: string
}

// Pushes today's prayer times ("HH:mm", 24h) to the Android widgets' prayer strip.
export async function syncPrayerWidget(times: PrayerWidgetTimes) {
  if (Capacitor.getPlatform() !== 'android') return

  try {
    for (const key of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const) {
      await Preferences.set({ key: `widget_prayer_${key}`, value: times[key] })
    }
    await WidgetSync.refresh()
  } catch (err) {
    console.warn('[WidgetSync] Failed to sync prayer times:', err)
  }
}
