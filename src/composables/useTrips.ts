import { ref, computed } from 'vue'
import { supabase } from '@/plugins/supabaseClient'
import type { TripItem, TripCategory, TripFilters } from '@/types/Trip'

const PAGE_SIZE = 20

export function useTrips() {
  const trips = ref<TripItem[]>([])
  const categories = ref<TripCategory[]>([])
  const loading = ref(false)
  const loadingMore = ref(false)
  const error = ref<string | null>(null)
  const totalCount = ref(0)
  const page = ref(1)

  const filters = ref<TripFilters>({
    region: null,
    categoryId: null,
    halalTier: null,
    source: null,
    search: '',
    sortBy: 'recent'
  })

  const hasMore = computed(() => trips.value.length < totalCount.value)
  const isLegacyMode = ref(false)

  function mapRow(row: any): TripItem {
    return {
      id: row.id,
      title: row.title,
      title_zh: row.title_zh,
      duration: row.duration,
      cover: row.cover_url,
      external_url: row.external_url,
      source: row.source,
      booking_mode: row.booking_mode,
      min_price: row.min_price,
      currency: row.currency,
      view_count: row.view_count,
      created_at: row.created_at,
      updated_at: row.updated_at,
      provider: row.provider?.id ? row.provider : null,
      category: row.category?.id ? row.category : null,
      trip_cities: row.trip_cities ?? [],
      halal: row.halal ?? null,
      klook: row.klook?.binding_id ? row.klook : null,
      live_price: row.live_price,
      live_stock_status: row.live_stock_status,
      nearest_mosque: row.nearest_mosque,
      nearest_halal_restaurant: row.nearest_halal_restaurant
    }
  }

  async function fetchCategories() {
    const { data, error: err } = await supabase
        .from('trip_categories')
        .select('id, slug, name, name_zh, emoji, sort_order')
        .order('sort_order', { ascending: true })

    if (!err && data) categories.value = data
  }

  /**
   * Fallback for projects that haven't run the Klook module migration yet
   * (get_curated_trips / trip_categories / halal_trip_metadata don't exist).
   * Mirrors the pre-Klook trip query so existing trips keep showing while
   * the new schema is being rolled out. These pre-existing rows are treated
   * as source='partner' / booking_mode='external_link' (open external_url
   * directly, exactly like before) since that's all the old schema recorded.
   * Region/category/halal-tier filters are no-ops here since the underlying
   * columns don't exist yet; search and source still apply client-side.
   */
  async function fetchLegacyTrips() {
    const { data, error: err } = await supabase
        .from('trips')
        .select(`
          id, title, title_zh, duration, cover_url, external_url,
          created_at, updated_at, view_count,
          provider:partners ( id, name, partner_tier ),
          trip_cities ( cities:city_id ( slug, name, name_zh, emoji ) )
        `)
        .eq('is_active', true)

    if (err || !data) {
      console.error('[useTrips] legacy trips fallback failed', err)
      error.value = err?.message ?? 'Failed to load trips'
      trips.value = []
      totalCount.value = 0
      return
    }

    isLegacyMode.value = true

    const mapped: TripItem[] = (data as any[]).map(t => ({
      id: t.id,
      title: t.title,
      title_zh: t.title_zh,
      duration: t.duration,
      cover: t.cover_url,
      external_url: t.external_url,
      source: 'partner',
      booking_mode: 'external_link',
      min_price: null,
      currency: 'TWD',
      view_count: t.view_count,
      created_at: t.created_at,
      updated_at: t.updated_at,
      provider: Array.isArray(t.provider) ? t.provider[0] : t.provider,
      category: null,
      trip_cities: (t.trip_cities ?? []).map((tc: any) => tc.cities).filter(Boolean),
      halal: null,
      klook: null,
      live_price: null,
      live_stock_status: null,
      nearest_mosque: null,
      nearest_halal_restaurant: null
    }))

    const search = filters.value.search.trim().toLowerCase()
    const filtered = mapped
        .filter(t => !filters.value.source || t.source === filters.value.source)
        .filter(t => !search ||
            t.title.toLowerCase().includes(search) ||
            (t.title_zh ?? '').toLowerCase().includes(search))

    trips.value = filtered
    totalCount.value = filtered.length
  }

  async function fetchPage(targetPage: number, append: boolean) {
    const setLoading = append ? loadingMore : loading
    setLoading.value = true
    error.value = null

    if (isLegacyMode.value) {
      await fetchLegacyTrips()
      setLoading.value = false
      return
    }

    const { data, error: err } = await supabase.rpc('get_curated_trips', {
      p_region: filters.value.region,
      p_category_id: filters.value.categoryId,
      p_halal_tier: filters.value.halalTier,
      p_source: filters.value.source,
      p_search: filters.value.search || null,
      p_page: targetPage,
      p_page_size: PAGE_SIZE
    })

    if (err) {
      // Function/table doesn't exist yet on this project (migration not applied) —
      // fall back to the legacy query instead of showing an empty list.
      if (err.code === 'PGRST202' || err.code === '42883' || err.code === '42P01') {
        console.warn('[useTrips] Klook trip module not migrated yet, falling back to legacy trip query', err)
        await fetchLegacyTrips()
        setLoading.value = false
        return
      }

      console.error('[useTrips] get_curated_trips failed', err)
      error.value = err.message
      setLoading.value = false
      return
    }

    const rows = (data as any[]) ?? []
    totalCount.value = rows[0]?.total_count ?? 0

    const mapped = rows.map(mapRow)
    trips.value = append ? [...trips.value, ...mapped] : mapped
    page.value = targetPage

    setLoading.value = false
  }

  async function fetchTrips() {
    await fetchPage(1, false)
  }

  async function fetchMore() {
    if (loadingMore.value || loading.value || !hasMore.value) return
    await fetchPage(page.value + 1, true)
  }

  function setFilters(patch: Partial<TripFilters>) {
    filters.value = { ...filters.value, ...patch }
    fetchTrips()
  }

  function clearFilters() {
    filters.value = { region: null, categoryId: null, halalTier: null, source: null, search: '', sortBy: filters.value.sortBy }
    fetchTrips()
  }

  function tierRank(t: TripItem): number {
    switch (t.provider?.partner_tier) {
      case 'gold': return 3
      case 'silver': return 2
      case 'bronze': return 1
      default: return 0
    }
  }

  const sortedTrips = computed(() => {
    if (filters.value.sortBy === 'views') {
      // Keep tiered partners ahead of untiered ones even under "views" sort,
      // so this client-side sort can't undo the server's tier-priority order.
      return [...trips.value].sort((a, b) =>
          tierRank(b) - tierRank(a) || (b.view_count ?? 0) - (a.view_count ?? 0))
    }
    return trips.value
  })

  /** Refresh just the live price/stock for currently loaded trips from the Klook sync cache. */
  async function refreshAvailability() {
    const packageIds = trips.value
        .map(t => t.klook?.klook_package_id)
        .filter((id): id is string => !!id)

    if (packageIds.length === 0) return

    const { data, error: err } = await supabase
        .from('klook_availability_cache')
        .select('klook_package_id, price, stock_status')
        .in('klook_package_id', packageIds)

    if (err || !data) return

    const byPackage = new Map(data.map(row => [row.klook_package_id, row]))
    trips.value = trips.value.map(t => {
      const live = t.klook?.klook_package_id ? byPackage.get(t.klook.klook_package_id) : null
      if (!live) return t
      return { ...t, live_price: live.price, live_stock_status: live.stock_status }
    })
  }

  return {
    trips: sortedTrips,
    categories,
    loading,
    loadingMore,
    error,
    hasMore,
    totalCount,
    isLegacyMode,
    filters,
    fetchTrips,
    fetchMore,
    fetchCategories,
    setFilters,
    clearFilters,
    refreshAvailability
  }
}
