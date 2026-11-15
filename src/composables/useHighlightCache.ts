import { ref } from 'vue'
import { supabase } from '@/plugins/supabaseClient'
import type { IngredientHighlight } from '@/types/Ingredient'

interface BlacklistPattern {
    pattern: string
}

export interface HighlightCache {
    highlights: IngredientHighlight[]
    blacklist: BlacklistPattern[]
}

const CACHE_KEY = 'highlightCache'
const COUNT_KEY = 'highlightFetchCount'

/** Local reactive state */
const allHighlights = ref<IngredientHighlight[]>([])
const blacklistPatterns = ref<RegExp[]>([])

/** Load from localStorage */
function loadCachedHighlights(): HighlightCache | null {
    try {
        const raw = localStorage.getItem(CACHE_KEY)
        return raw ? (JSON.parse(raw) as HighlightCache) : null
    } catch {
        return null
    }
}

/** Put a cached copy into the shared state; used on a cache hit and when a refresh fails. */
function applyCache(cached: HighlightCache): HighlightCache {
    allHighlights.value = cached.highlights
    blacklistPatterns.value = cached.blacklist.map(r => new RegExp(r.pattern, 'gi'))
    return cached
}

/** Save to localStorage */
function saveCachedHighlights(data: HighlightCache) {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data))
    localStorage.setItem(COUNT_KEY, '0') // reset usage count
}

/** Increment usage counter */
function incrementUsageCount() {
    let count = parseInt(localStorage.getItem(COUNT_KEY) || '0', 10)
    count++
    localStorage.setItem(COUNT_KEY, count.toString())
    console.log("COUNT_KEY: ", count.toString())
    return count
}

/** Main fetch logic */
async function fetchHighlightsWithCache(force = false): Promise<HighlightCache | null> {
    const count = parseInt(localStorage.getItem(COUNT_KEY) || '0', 10)

    if (!force && count < 5) {
        const cached = loadCachedHighlights()
        if (cached) return applyCache(cached)
    }

    try {
        const [hl, bl] = await Promise.all([
            supabase.from('ingredient_highlights').select('keyword, keyword_zh, color'),
            supabase.from('ingredient_blacklist').select('pattern').eq('is_active', true),
        ])

        if (!hl.error && !bl.error && hl.data && bl.data) {
            const data: HighlightCache = {
                highlights: hl.data,
                blacklist: bl.data,
            }
            saveCachedHighlights(data)

            console.log("Fetching new ingredients data succeed!")

            return applyCache(data)
        } else {
            console.error('❌ Error fetching highlights', hl.error || bl.error)
        }
    } catch (err) {
        console.error('❌ Supabase fetch failed', err)
    }

    // The refresh failed (offline, server error): keep working from the last good copy.
    const fallback = loadCachedHighlights()
    return fallback ? applyCache(fallback) : null
}

export default function useHighlightCache() {
    return {
        allHighlights,
        blacklistPatterns,
        fetchHighlightsWithCache,
        incrementUsageCount,
    }
}
