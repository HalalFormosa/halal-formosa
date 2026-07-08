import { supabase } from '@/plugins/supabaseClient'

export interface BusinessAnalytics {
  level: 'basic' | 'standard' | 'advanced' | 'pro'
  total_views: number
  detail_opens_30d: number
  unique_viewers_30d: number
  card_clicks_30d: number
  marker_clicks_30d: number
  // standard+
  saves?: number
  intents?: {
    directions: number; call: number; instagram: number;
    foodpanda: number; ubereats: number; share: number; photo_views: number
  }
  // advanced+
  nationalities?: { code: string; count: number }[]
  gender?: { gender: string; count: number }[]
  peak_dow?: Record<string, number>
  peak_hour?: Record<string, number>
  timeseries?: { date: string; count: number }[]
  // pro (gold)
  funnel?: { impressions: number; opens: number; actions: number; open_rate: number; action_rate: number }
  search_terms?: { q: string; count: number }[]
  benchmark?: { category: string; my_opens_30d: number; category_total: number; category_avg_30d: number; percentile: number; rank: number }
}

const EMPTY: BusinessAnalytics = {
  level: 'basic', total_views: 0, detail_opens_30d: 0,
  unique_viewers_30d: 0, card_clicks_30d: 0, marker_clicks_30d: 0,
}

export function useLocationAnalytics() {
  /** All analytics for a location in one call; the RPC gates sections by plan level. */
  async function getAnalytics(locationId: number): Promise<BusinessAnalytics> {
    const { data, error } = await supabase.rpc('get_business_analytics', { p_location_id: locationId })
    if (error || !data) {
      console.error('[useLocationAnalytics] getAnalytics', error)
      return EMPTY
    }
    return data as BusinessAnalytics
  }

  return { getAnalytics }
}
