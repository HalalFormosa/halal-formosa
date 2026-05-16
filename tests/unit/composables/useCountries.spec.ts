import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadCountries, loadCountriesFromCache, countries, countriesLoadedAt } from '@/composables/useCountries'

describe('useCountries', () => {
    let mockStorage: Record<string, string> = {}

    beforeEach(() => {
        mockStorage = {}
        vi.stubGlobal('localStorage', {
            getItem: vi.fn((key) => mockStorage[key] || null),
            setItem: vi.fn((key, val) => { mockStorage[key] = val })
        })
        global.fetch = vi.fn().mockResolvedValue({
            json: vi.fn().mockResolvedValue([
                { name: { common: 'Taiwan' }, cca2: 'TW', flags: { png: '', svg: '' } },
                { name: { common: 'Japan' }, cca2: 'JP', flags: { png: '', svg: '' } }
            ])
        })
        countries.value = []
        countriesLoadedAt.value = null
    })

    it('should fetch and sort countries', async () => {
        const res = await loadCountries(true)
        expect(res).toHaveLength(2)
        expect(res[0].name.common).toBe('Japan')
        expect(res[1].name.common).toBe('Taiwan')
    })

    it('should load from cache if available', () => {
        mockStorage['countries'] = JSON.stringify([{ name: { common: 'Taiwan' }, cca2: 'TW' }])
        mockStorage['countries_cached_at'] = Date.now().toString()
        loadCountriesFromCache()
        expect(countries.value).toHaveLength(1)
    })
})
