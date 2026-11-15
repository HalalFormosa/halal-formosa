import { supabase } from '@/plugins/supabaseClient'
import { ActivityLogService } from '@/services/ActivityLogService'

export interface LocationOffer {
  id: string
  location_id: number
  kind: 'menu' | 'meat' | 'other'
  title: string
  description: string | null
  discount_label: string | null
  free_uses: number
  valid_until: string | null
}

export interface OfferCode {
  code: string
  issued_at: string
  expires_at: string
  is_new: boolean
}

export interface OfferStatus {
  is_pro: boolean
  free_uses: number
  redeemed_count: number
  has_open_code: boolean
  can_get_code: boolean
}

export interface RedeemResult {
  code: string
  offer_title: string
  discount_label: string | null
  redeemed_at: string
}

export interface RedemptionRow {
  code: string
  offer_title: string
  issued_at: string
  redeemed_at: string
}

/** Error codes raised by the offer RPCs (see migration 20261115010000_offer_codes). */
export type OfferErrorCode =
  | 'not_authenticated'
  | 'pro_required'
  | 'free_limit_reached'
  | 'offer_not_found'
  | 'offer_not_started'
  | 'offer_ended'
  | 'invalid_code'
  | 'already_used'
  | 'expired'
  | 'offer_not_active'
  | 'not_allowed'
  | 'unknown'

export class OfferError extends Error {
  constructor(public code: OfferErrorCode, public detail?: string) {
    super(code)
  }
}

function toOfferError(error: { message?: string } | null): OfferError {
  const msg = error?.message ?? ''
  // RPC raises e.g. "already_used:2026-11-15 22:00" — split off the detail.
  const [head, ...rest] = msg.split(':')
  const known: OfferErrorCode[] = [
    'not_authenticated', 'pro_required', 'free_limit_reached', 'offer_not_found', 'offer_not_started', 'offer_ended',
    'invalid_code', 'already_used', 'expired', 'offer_not_active', 'not_allowed',
  ]
  const code = known.find(k => k === head.trim()) ?? 'unknown'
  return new OfferError(code, rest.join(':').trim() || undefined)
}

/**
 * Partner-store discount codes. Codes are issued and redeemed only through
 * SECURITY DEFINER RPCs (Pro check / store-ownership check happen server-side),
 * never by reading the offer_codes table.
 */
export class OfferService {
  /** Active offers for a place (public marketing info, no codes). */
  static async getOffersForLocation(locationId: number): Promise<LocationOffer[]> {
    const { data, error } = await supabase
      .from('location_offers')
      .select('id, location_id, kind, title, description, discount_label, free_uses, valid_until')
      .eq('location_id', locationId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
    if (error) {
      console.warn('[OfferService] getOffersForLocation', error)
      return []
    }
    return (data ?? []) as LocationOffer[]
  }

  /** Whether the signed-in user can still get a code (free uses left, or Pro). */
  static async getMyStatus(offerId: string): Promise<OfferStatus | null> {
    const { data, error } = await supabase.rpc('get_my_offer_status', { p_offer_id: offerId })
    if (error) {
      console.warn('[OfferService] getMyStatus', error)
      return null
    }
    return data as OfferStatus
  }

  /** The caller's open code for an offer (same code until it is redeemed). */
  static async getMyCode(offer: LocationOffer): Promise<OfferCode> {
    const { data, error } = await supabase.rpc('get_my_offer_code', { p_offer_id: offer.id })
    if (error) throw toOfferError(error)
    ActivityLogService.log('offer_code_show', {
      offer_id: offer.id, location_id: offer.location_id, is_new: (data as OfferCode).is_new,
    })
    return data as OfferCode
  }

  /** Store side: redeem a typed/scanned code. Owner/manager of the store or admin only. */
  static async redeem(code: string): Promise<RedeemResult> {
    const { data, error } = await supabase.rpc('redeem_offer_code', { p_code: code })
    if (error) throw toOfferError(error)
    ActivityLogService.log('offer_code_redeem', { code_prefix: code.split('-')[0]?.toUpperCase() })
    return data as RedeemResult
  }

  /** Store side: recent redemptions (codes and times only, no customer identity). */
  static async listRedemptions(locationId: number, limit = 50): Promise<RedemptionRow[]> {
    const { data, error } = await supabase.rpc('list_offer_redemptions', {
      p_location_id: locationId, p_limit: limit,
    })
    if (error) throw toOfferError(error)
    return (data ?? []) as RedemptionRow[]
  }
}
