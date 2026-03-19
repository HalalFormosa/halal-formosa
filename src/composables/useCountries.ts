import { ref } from "vue"

interface Country {
    cca2: string
    name: { common: string }
    flags: { png: string; svg: string }
}

export const countries = ref<Country[]>([])
export const countriesLoadedAt = ref<number | null>(null)

export async function loadCountries(force = false): Promise<Country[]> {
    if (!force && countries.value.length && countriesLoadedAt.value && Date.now() - countriesLoadedAt.value < 86400000) {
        return countries.value
    }

    const response = await fetch("https://restcountries.com/v3.1/all?fields=name,cca2,flags")
    const data = await response.json() as Country[]

    countries.value = data.sort((a, b) => a.name.common.localeCompare(b.name.common))
    countriesLoadedAt.value = Date.now()
    localStorage.setItem("countries", JSON.stringify(countries.value))
    localStorage.setItem("countries_cached_at", countriesLoadedAt.value.toString())

    return countries.value
}

export function loadCountriesFromCache() {
    const cached = localStorage.getItem("countries")
    const cachedAt = localStorage.getItem("countries_cached_at")

    if (cached && cachedAt && Date.now() - parseInt(cachedAt) < 86400000) {
        countries.value = JSON.parse(cached)
        countriesLoadedAt.value = parseInt(cachedAt)
    }
}
