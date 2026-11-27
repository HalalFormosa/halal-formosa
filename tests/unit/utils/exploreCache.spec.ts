import { beforeEach, describe, expect, it } from 'vitest'
import {
  EXPLORE_CACHE_MAX_AGE_MS,
  EXPLORE_CACHE_VERSION,
  exploreAreaKey,
  loadExploreCache,
  saveExploreCache,
} from '@/utils/exploreCache'

describe('exploreCache', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips data', () => {
    expect(saveExploreCache('places', [{ id: 1 }], 'a')).toBe(true)
    expect(loadExploreCache('places', { area: 'a' })).toEqual([{ id: 1 }])
  })

  it('returns null when nothing is stored', () => {
    expect(loadExploreCache('places')).toBeNull()
  })

  it('ignores entries from another area', () => {
    saveExploreCache('places', [1], 'a')
    expect(loadExploreCache('places', { area: 'b' })).toBeNull()
  })

  it('ignores entries older than the max age', () => {
    saveExploreCache('places', [1])
    const later = Date.now() + EXPLORE_CACHE_MAX_AGE_MS + 1000
    expect(loadExploreCache('places', { now: later })).toBeNull()
  })

  it('ignores entries written under a different schema version', () => {
    localStorage.setItem(
      'hf_explore_places',
      JSON.stringify({ v: EXPLORE_CACHE_VERSION + 1, t: Date.now(), data: [1] })
    )
    expect(loadExploreCache('places')).toBeNull()
  })

  it('survives corrupt JSON', () => {
    localStorage.setItem('hf_explore_places', '{not json')
    expect(loadExploreCache('places')).toBeNull()
  })

  it('reports failure instead of throwing when storage is full', () => {
    const orig = Storage.prototype.setItem
    Storage.prototype.setItem = () => { throw new Error('QuotaExceededError') }
    try {
      expect(saveExploreCache('places', [1])).toBe(false)
    } finally {
      Storage.prototype.setItem = orig
    }
  })

  it('buckets nearby coordinates into the same area', () => {
    expect(exploreAreaKey(25.0330, 121.5654)).toBe(exploreAreaKey(25.0410, 121.5700))
    expect(exploreAreaKey(25.0330, 121.5654)).not.toBe(exploreAreaKey(24.15, 120.67))
  })
})
