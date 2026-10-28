import { describe, it, expect, vi, beforeEach } from 'vitest'

const fromMock = vi.fn()
vi.mock('@/plugins/supabaseClient', () => ({ supabase: { from: (...args: unknown[]) => fromMock(...args) } }))

const cached = {
    highlights: [{ keyword: 'gelatin', keyword_zh: '明膠', color: '--ion-color-danger' }],
    blacklist: [{ pattern: 'noise' }],
}

/** A supabase query that resolves like `.select(...)` and `.select(...).eq(...)` both do. */
function query(result: { data: unknown; error: unknown }) {
    const q: any = Promise.resolve(result)
    q.select = () => q
    q.eq = () => q
    return q
}

async function freshComposable() {
    vi.resetModules()
    const mod = await import('@/composables/useHighlightCache')
    return mod.default()
}

describe('useHighlightCache offline fallback', () => {
    beforeEach(() => {
        localStorage.clear()
        fromMock.mockReset()
        vi.spyOn(console, 'error').mockImplementation(() => {})
        vi.spyOn(console, 'log').mockImplementation(() => {})
    })

    it('uses the cached copy when the refresh returns an error', async () => {
        localStorage.setItem('highlightCache', JSON.stringify(cached))
        localStorage.setItem('highlightFetchCount', '9') // stale: forces a refresh attempt
        fromMock.mockImplementation(() => query({ data: null, error: new Error('Failed to fetch') }))

        const { allHighlights, fetchHighlightsWithCache } = await freshComposable()
        const result = await fetchHighlightsWithCache()

        expect(result).toEqual(cached)
        expect(allHighlights.value).toEqual(cached.highlights)
    })

    it('uses the cached copy when the refresh throws', async () => {
        localStorage.setItem('highlightCache', JSON.stringify(cached))
        localStorage.setItem('highlightFetchCount', '9')
        fromMock.mockImplementation(() => {
            throw new Error('network down')
        })

        const { allHighlights, fetchHighlightsWithCache } = await freshComposable()
        await fetchHighlightsWithCache()

        expect(allHighlights.value).toEqual(cached.highlights)
    })

    it('returns null and leaves the list empty when offline with no cache', async () => {
        fromMock.mockImplementation(() => query({ data: null, error: new Error('Failed to fetch') }))

        const { allHighlights, fetchHighlightsWithCache } = await freshComposable()

        expect(await fetchHighlightsWithCache()).toBeNull()
        expect(allHighlights.value).toEqual([])
    })

    it('ignores a corrupt cache instead of throwing', async () => {
        localStorage.setItem('highlightCache', '{not json')
        fromMock.mockImplementation(() => query({ data: null, error: new Error('Failed to fetch') }))

        const { fetchHighlightsWithCache } = await freshComposable()

        expect(await fetchHighlightsWithCache()).toBeNull()
    })

    it('stores and uses fresh data when the refresh succeeds', async () => {
        fromMock.mockImplementation((table: string) =>
            table === 'ingredient_highlights'
                ? query({ data: cached.highlights, error: null })
                : query({ data: cached.blacklist, error: null }),
        )

        const { allHighlights, fetchHighlightsWithCache } = await freshComposable()
        await fetchHighlightsWithCache()

        expect(allHighlights.value).toEqual(cached.highlights)
        expect(JSON.parse(localStorage.getItem('highlightCache') as string)).toEqual(cached)
    })
})
