import { describe, it, expect, beforeEach } from 'vitest'
import { loadCountries, loadCountriesFromCache, countries } from '@/composables/useCountries'
import fallbackCountries from '@/composables/countries.json'

describe('useCountries', () => {
    beforeEach(() => {
        countries.value = fallbackCountries
    })

    it('should return fallback countries list', async () => {
        const res = await loadCountries()
        expect(res).toBe(countries.value)
        expect(res.length).toBeGreaterThan(0)
    })

    it('should fallback to countries list if cached state is empty', () => {
        countries.value = []
        loadCountriesFromCache()
        expect(countries.value.length).toBe(fallbackCountries.length)
    })
})
