// Small versioned localStorage cache for Explore's first paint: the last good
// places / categories are shown instantly on the next open (or offline) while a
// fresh fetch runs in the background. Every access is try/catch'd — storage can
// be full, blocked, or hold corrupt JSON, and none of that may break Explore.

/** Bump when the cached shape changes; older entries are then ignored. */
export const EXPLORE_CACHE_VERSION = 1
export const EXPLORE_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

const PREFIX = 'hf_explore_'

type Entry<T> = { v: number; t: number; area?: string; data: T }

/** Coarse (~5 km) grid cell so cached places are only reused near where they were fetched. */
export function exploreAreaKey(lat: number, lng: number): string {
  const r = (n: number) => (Math.round(n * 20) / 20).toFixed(2)
  return `${r(lat)},${r(lng)}`
}

export function saveExploreCache<T>(name: string, data: T, area?: string): boolean {
  try {
    const entry: Entry<T> = { v: EXPLORE_CACHE_VERSION, t: Date.now(), area, data }
    localStorage.setItem(PREFIX + name, JSON.stringify(entry))
    return true
  } catch {
    return false
  }
}

export function loadExploreCache<T>(
  name: string,
  opts: { area?: string; maxAgeMs?: number; now?: number } = {}
): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + name)
    if (!raw) return null
    const entry = JSON.parse(raw) as Entry<T>
    if (!entry || entry.v !== EXPLORE_CACHE_VERSION || typeof entry.t !== 'number') return null
    const now = opts.now ?? Date.now()
    if (now - entry.t > (opts.maxAgeMs ?? EXPLORE_CACHE_MAX_AGE_MS)) return null
    if (opts.area !== undefined && entry.area !== opts.area) return null
    return entry.data ?? null
  } catch {
    return null
  }
}
