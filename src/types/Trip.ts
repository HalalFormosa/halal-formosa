export type HalalTier = 'verified' | 'silver' | 'gold'
export type KlookIntegrationMode = 'affiliate' | 'b2b_reseller'
export type BookingMode = 'in_app' | 'external_link' | 'klook_affiliate' | 'klook_b2b'
export type StockStatus = 'available' | 'low' | 'sold_out'
/** Who curated the trip — independent of `BookingMode`, which only decides CTA behavior. */
export type TripSource = 'internal' | 'partner' | 'klook'

export interface TripCategory {
  id: number
  slug: string
  name: string
  name_zh: string
  emoji: string
  sort_order: number
}

export interface TripCity {
  slug: string
  name: string
  name_zh: string
  emoji: string
}

export interface HalalTripMetadata {
  halal_tier: HalalTier
  halal_lunch_included: boolean
  prayer_room_onsite: boolean
  mosque_stop_nearby: boolean
  alcohol_pork_free_environment: boolean
}

export interface KlookProductBinding {
  binding_id: string | null
  klook_activity_id: string | null
  klook_package_id: string | null
  integration_mode: KlookIntegrationMode | null
  affiliate_id: string | null
  affiliate_deep_link: string | null
}

export interface MuslimPin {
  id: string
  name: string
  lat: number
  lng: number
  distance_m: number
}

export interface TripProvider {
  id: string
  name: string
  partner_tier: string | null
}

export interface TripItem {
  id: string
  title: string
  title_zh?: string
  duration: string
  cover: string
  external_url: string
  source: TripSource
  booking_mode: BookingMode
  min_price: number | null
  currency: string
  view_count?: number
  created_at?: string
  updated_at?: string
  provider: TripProvider | null
  category: TripCategory | null
  trip_cities: TripCity[]
  halal: HalalTripMetadata | null
  klook: KlookProductBinding | null
  live_price: number | null
  live_stock_status: StockStatus | null
  nearest_mosque: MuslimPin | null
  nearest_halal_restaurant: MuslimPin | null
}

export interface TripFilters {
  region: string | null
  categoryId: number | null
  halalTier: HalalTier | null
  source: TripSource | null
  search: string
  sortBy: 'recent' | 'views'
}

/** Matches the `region` slugs backfilled onto `cities` in the Klook trip module migration. */
export const TRIP_REGIONS = [
  { value: 'taipei', i18nKey: 'trip.regionTaipei' },
  { value: 'taichung', i18nKey: 'trip.regionTaichung' },
  { value: 'kaohsiung', i18nKey: 'trip.regionKaohsiung' },
  { value: 'east_coast', i18nKey: 'trip.regionEastCoast' }
] as const
export type TripRegion = typeof TRIP_REGIONS[number]['value']
