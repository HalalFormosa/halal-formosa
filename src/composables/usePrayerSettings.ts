import { ref, watch } from 'vue'

export const PRAYER_METHODS = [
  'MWL', 'ISNA', 'Egypt', 'Makkah', 'Karachi', 'Tehran', 'Jafari', 'France', 'Russia', 'Singapore',
] as const
export type PrayerMethod = typeof PRAYER_METHODS[number]
export type AsrSchool = 'Standard' | 'Hanafi'
export const TUNABLE_PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const
export type TunablePrayer = typeof TUNABLE_PRAYERS[number]

export interface PrayerSettings {
  method: PrayerMethod
  asr: AsrSchool
  tune: Record<TunablePrayer, number>
}

const STORAGE_KEY = 'hf_prayer_settings'
const MAX_TUNE_MINUTES = 30

export function defaultPrayerSettings(): PrayerSettings {
  return {
    method: 'MWL',
    asr: 'Standard',
    tune: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
  }
}

function sanitize(raw: unknown): PrayerSettings {
  const out = defaultPrayerSettings()
  if (!raw || typeof raw !== 'object') return out
  const r = raw as Partial<PrayerSettings>
  if (r.method && (PRAYER_METHODS as readonly string[]).includes(r.method)) out.method = r.method
  if (r.asr === 'Hanafi' || r.asr === 'Standard') out.asr = r.asr
  for (const k of TUNABLE_PRAYERS) {
    const v = Number(r.tune?.[k])
    if (Number.isFinite(v)) out.tune[k] = Math.max(-MAX_TUNE_MINUTES, Math.min(MAX_TUNE_MINUTES, Math.round(v)))
  }
  return out
}

function load(): PrayerSettings {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    return sanitize(s ? JSON.parse(s) : null)
  } catch {
    return defaultPrayerSettings()
  }
}

// Shared across components so the Home card and the settings sheet stay in sync.
const settings = ref<PrayerSettings>(load())

watch(settings, (v) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)) } catch { /* storage unavailable */ }
}, { deep: true })

export function usePrayerSettings() {
  function update(next: PrayerSettings) {
    settings.value = sanitize(next)
  }
  function reset() {
    settings.value = defaultPrayerSettings()
  }
  return { settings, update, reset, MAX_TUNE_MINUTES }
}
