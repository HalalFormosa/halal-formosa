import { Capacitor, registerPlugin } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

interface WidgetSyncPlugin {
  refresh(): Promise<void>
  // iOS only: stores values in the shared App Group and reloads the widget timelines.
  update(values: Record<string, string>): Promise<void>
}

const WidgetSync = registerPlugin<WidgetSyncPlugin>('WidgetSync')

interface ScanWidgetState {
  loggedIn: boolean
  remaining?: number | null
  unlimited?: boolean
}

// Pushes scan-quota state to the home screen widgets (Android light/dark, iOS WidgetKit).
// No-op on web — the widgets and native plugin only exist on Android and iOS.
export async function syncScanWidget(state: ScanWidgetState) {
  const platform = Capacitor.getPlatform()
  if (platform !== 'android' && platform !== 'ios') return

  try {
    let remainingValue = ''
    if (state.loggedIn) {
      remainingValue = state.unlimited
        ? '∞'
        : (state.remaining != null ? String(Math.max(0, state.remaining)) : '')
    }

    if (platform === 'ios') {
      await WidgetSync.update({
        loggedIn: state.loggedIn ? '1' : '0',
        scansRemaining: remainingValue,
      })
      return
    }

    await Preferences.set({ key: 'widget_logged_in', value: state.loggedIn ? '1' : '0' })
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

// Pushes today's prayer times ("HH:mm", 24h) to the widgets' prayer strip.
export async function syncPrayerWidget(times: PrayerWidgetTimes) {
  const platform = Capacitor.getPlatform()
  if (platform !== 'android' && platform !== 'ios') return

  try {
    if (platform === 'ios') {
      const { fajr, dhuhr, asr, maghrib, isha } = times
      await WidgetSync.update({ fajr, dhuhr, asr, maghrib, isha })
      return
    }

    for (const key of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const) {
      await Preferences.set({ key: `widget_prayer_${key}`, value: times[key] })
    }
    await WidgetSync.refresh()
  } catch (err) {
    console.warn('[WidgetSync] Failed to sync prayer times:', err)
  }
}
