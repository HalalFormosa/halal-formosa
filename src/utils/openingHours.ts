// Opening hours with several shifts per day (e.g. 11:00-14:00 and 17:00-19:00).
//
// Storage format is the Google-style `periods` list that most places already use and that the Explore / Place
// details readers already understand:
//   { periods: [{ open: { day: 0-6 (0 = Sunday), time: "1100" }, close: { day, time: "1400" } }, ...] }
// A day with two shifts is simply two periods with the same open day. A shift whose close time is not after its
// open time is overnight, so its close day is the next day.
//
// The older app format ({ mon: { active, open, close }, ... }) is still read, and converted to shifts when edited.

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export interface Shift { open: string; close: string }
export interface DayShifts { active: boolean; shifts: Shift[] }
export type WeekShifts = Record<DayKey, DayShifts>

export const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
export const MAX_SHIFTS_PER_DAY = 3
const DAY_NUM: Record<DayKey, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }
const NUM_DAY: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const DEFAULT_SHIFT: Shift = { open: '09:00', close: '18:00' }

export const newShift = (): Shift => ({ ...DEFAULT_SHIFT })

export function emptyWeek(active = false): WeekShifts {
  const week = {} as WeekShifts
  for (const k of DAY_KEYS) week[k] = { active, shifts: [newShift()] }
  return week
}

const toHHmm = (t: unknown): string => {
  const s = String(t ?? '').replace(':', '')
  return /^\d{4}$/.test(s) ? `${s.slice(0, 2)}:${s.slice(2)}` : ''
}
const toCompact = (t: string): string => t.replace(':', '')

// DB value (periods or older day-key format, or null) -> editable shifts. `defaultActive` is used when there is no data.
export function weekFromDb(db: any, defaultActive = false): WeekShifts {
  const week = emptyWeek(defaultActive)
  if (!db || typeof db !== 'object') return week

  if (Array.isArray(db.periods)) {
    for (const k of DAY_KEYS) { week[k].active = false; week[k].shifts = [] }
    const periods = [...db.periods].filter((p: any) => typeof p?.open?.day === 'number' && NUM_DAY[p.open.day])
    for (const p of periods) {
      const key = NUM_DAY[p.open.day]
      const open = toHHmm(p.open.time) || '00:00'
      // A period with no close time means "open all day" in the source data.
      const close = toHHmm(p.close?.time) || '23:59'
      week[key].active = true
      week[key].shifts.push({ open, close })
    }
    for (const k of DAY_KEYS) {
      if (week[k].shifts.length === 0) week[k].shifts = [newShift()]
      else week[k].shifts.sort((a, b) => a.open.localeCompare(b.open))
    }
    return week
  }

  if (DAY_KEYS.some((k) => db[k])) {
    for (const k of DAY_KEYS) {
      const d = db[k]
      if (!d) continue
      week[k] = { active: !!d.active, shifts: [{ open: d.open || DEFAULT_SHIFT.open, close: d.close || DEFAULT_SHIFT.close }] }
    }
  }
  return week
}

// Editable shifts -> DB value. Returns null when no day has a complete shift.
export function weekToDb(week: WeekShifts): { periods: any[] } | null {
  const periods: any[] = []
  for (const k of DAY_KEYS) {
    const day = week[k]
    if (!day?.active) continue
    const valid = (day.shifts ?? []).filter((s) => s.open && s.close && s.open !== s.close)
    valid.sort((a, b) => a.open.localeCompare(b.open))
    for (const s of valid) {
      const overnight = s.close < s.open
      periods.push({
        open: { day: DAY_NUM[k], time: toCompact(s.open) },
        close: { day: overnight ? (DAY_NUM[k] + 1) % 7 : DAY_NUM[k], time: toCompact(s.close) },
      })
    }
  }
  return periods.length ? { periods } : null
}

// Google Places API (web) opening hours -> editable shifts, keeping every shift of a day.
export function weekFromGooglePeriods(periods: any[] | undefined): WeekShifts {
  const raw = (periods ?? [])
    .filter((p: any) => p?.open && typeof p.open.day === 'number')
    .map((p: any) => {
      const pad = (n: unknown) => String(n ?? 0).padStart(2, '0')
      return {
        open: { day: p.open.day, time: `${pad(p.open.hour)}${pad(p.open.minute)}` },
        close: p.close ? { day: p.close.day, time: `${pad(p.close.hour)}${pad(p.close.minute)}` } : undefined,
      }
    })
  return weekFromDb({ periods: raw }, false)
}

// Read-only text for display: one line per day, shifts joined with ", ".
export function formatDayShifts(shifts: Shift[]): string {
  return shifts.map((s) => `${s.open} - ${s.close}`).join(', ')
}
