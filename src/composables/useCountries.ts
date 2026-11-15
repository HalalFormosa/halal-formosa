import { ref } from "vue"
import fallbackCountries from "./countries.json"

interface Country {
    cca2: string
    name: { common: string }
    flags: { png: string; svg: string }
}

export const countries = ref<Country[]>(fallbackCountries)
export const countriesLoadedAt = ref<number | null>(Date.now())

export async function loadCountries(force = false): Promise<Country[]> {
    // Return static country list directly to avoid network requests, rate limits, and API deprecation.
    return countries.value
}

export function loadCountriesFromCache() {
    if (countries.value.length === 0) {
        countries.value = fallbackCountries
    }
}
