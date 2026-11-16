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
  valid_from: string | null
  valid_until: string | null
}

export interface OfferCode {
  code: string
  issued_at: string
  expires_at: string
  is_new: boolean
}

export type FollowPlatform = 'instagram' | 'tiktok' | 'facebook'

/** A social account the user must visit before a code is issued. */
export interface FollowStep {
  platform: FollowPlatform
  /** Instagram/TikTok handle (no @) or, for Facebook, the page URL. */
  account: string
  done: boolean
}

export interface OfferStatus {
  is_pro: boolean
  free_uses: number
  redeemed_count: number
  has_open_code: boolean
  can_get_code: boolean
  follow: FollowStep[]
  /** The offer's stock is used up (and this user has no open code). */
  sold_out: boolean
}

/** An offer as the store's owner sees it (includes inactive ones and usage counts). */
export interface OwnerOffer {
  id: string
  location_id: number
  kind: 'menu' | 'meat' | 'other'
  title: string
  description: string | null
  discount_label: string | null
  free_uses: number
  is_active: boolean
  code_prefix: string
  issued_count: number
  redeemed_count: number
  valid_from: string | null
  valid_until: string | null
  code_ttl_days: number
  max_codes: number | null
  require_follow: boolean
  follow_instagram: string | null
  follow_tiktok: string | null
  follow_facebook: string | null
}

/** Admin-only settings of an offer. */
export interface OfferSettings {
  validFrom: string | null
  validUntil: string | null
  codeTtlDays: number
  maxCodes: number | null
  requireFollow: boolean
  followInstagram: string
  followTiktok: string
  followFacebook: string
}

export interface OfferWording {
  title: string
  description: string
  discount_label: string
  is_active: boolean
}

/** Per-offer results for a store (no customer identity). */
export interface OfferReportRow {
  offer_id: string
  title: string
  code_prefix: string
  is_active: boolean
  days: number
  issued: number
  people: number
  redeemed: number
  open: number
  expired: number
  voided: number
  followed: { instagram: number; tiktok: number; facebook: number }
  last_redeemed_at: string | null
  series: { date: string; issued: number; redeemed: number }[]
}

/** Admin-only: who claimed / redeemed a code. */
export interface AdminOfferCode {
  code: string
  user_id: string
  display_name: string | null
  issued_at: string
  redeemed_at: string | null
  expires_at: string
  followed: string[]
}

export interface NewOffer {
  locationId: number
  codePrefix: string
  kind: 'menu' | 'meat' | 'other'
  title: string
  description: string
  discountLabel: string
  freeUses: number
  isActive: boolean
  requireFollow: boolean
  followInstagram: string
  followTiktok: string
  followFacebook: string
  validFrom: string | null
  validUntil: string | null
  codeTtlDays: number
  maxCodes: number | null
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
  /** Inside the 10-minute undo window (or the viewer is an admin). */
  can_void: boolean
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
  | 'follow_required'
  | 'offer_sold_out'
  | 'invalid_ttl'
  | 'invalid_max_codes'
  | 'invalid_dates'
  | 'not_redeemed'
  | 'void_window_passed'
  | 'customer_has_open_code'
  | 'invalid_prefix'
  | 'prefix_taken'
  | 'invalid_kind'
  | 'invalid_free_uses'
  | 'invalid_follow'
  | 'location_not_found'
  | 'invalid_title'
  | 'invalid_description'
  | 'invalid_label'
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
    'invalid_title', 'invalid_description', 'invalid_label', 'follow_required',
    'offer_sold_out', 'invalid_ttl', 'invalid_max_codes', 'invalid_dates',
    'not_redeemed', 'void_window_passed', 'customer_has_open_code',
    'invalid_prefix', 'prefix_taken', 'invalid_kind', 'invalid_free_uses', 'invalid_follow', 'location_not_found',
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
      .select('id, location_id, kind, title, description, discount_label, free_uses, valid_from, valid_until')
      .eq('location_id', locationId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
    if (error) {
      console.warn('[OfferService] getOffersForLocation', error)
      return []
    }
    // An offer past its end date is no longer shown at all.
    const now = Date.now()
    return ((data ?? []) as LocationOffer[]).filter(o => !o.valid_until || new Date(o.valid_until).getTime() > now)
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

  /** Records that the user tapped through to an account (the server requires this before issuing a code). */
  static async recordFollow(offer: LocationOffer, platform: FollowPlatform): Promise<void> {
    const { error } = await supabase.rpc('record_offer_follow', { p_offer_id: offer.id, p_platform: platform })
    if (error) throw toOfferError(error)
    ActivityLogService.log('offer_follow_tap', { offer_id: offer.id, location_id: offer.location_id, platform })
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
  static async redeem(code: string, locationId?: number): Promise<RedeemResult> {
    const { data, error } = await supabase.rpc('redeem_offer_code', { p_code: code })
    if (error) throw toOfferError(error)
    ActivityLogService.log('offer_code_redeem', { location_id: locationId, code_prefix: code.split('-')[0]?.toUpperCase() })
    return data as RedeemResult
  }

  /** Store side: undo a mistaken redemption (10 minutes for owners, any time for admins). */
  static async voidRedemption(code: string, locationId?: number): Promise<void> {
    const { error } = await supabase.rpc('void_offer_redemption', { p_code: code })
    if (error) throw toOfferError(error)
    ActivityLogService.log('offer_code_void', { location_id: locationId, code_prefix: code.split('-')[0]?.toUpperCase() })
  }

  /** Store side: recent redemptions (codes and times only, no customer identity). */
  static async listRedemptions(locationId: number, limit = 50): Promise<RedemptionRow[]> {
    const { data, error } = await supabase.rpc('list_offer_redemptions', {
      p_location_id: locationId, p_limit: limit,
    })
    if (error) throw toOfferError(error)
    return (data ?? []) as RedemptionRow[]
  }

  /** Owner/admin: every offer at the store, including paused ones. */
  static async listMyOffers(locationId: number): Promise<OwnerOffer[]> {
    const { data, error } = await supabase.rpc('list_my_offers', { p_location_id: locationId })
    if (error) throw toOfferError(error)
    return (data ?? []) as OwnerOffer[]
  }

  /** Owner/admin: change wording and the on/off switch only (the server enforces this). */
  static async updateMyOffer(offerId: string, w: OfferWording, locationId?: number): Promise<void> {
    const { error } = await supabase.rpc('update_my_offer', {
      p_offer_id: offerId,
      p_title: w.title,
      p_description: w.description,
      p_discount_label: w.discount_label,
      p_is_active: w.is_active,
    })
    if (error) throw toOfferError(error)
    ActivityLogService.log('offer_edit', { offer_id: offerId, location_id: locationId })
  }

  /** Admin only: create an offer for a store (the server checks admin and validates everything). */
  static async adminCreateOffer(o: NewOffer): Promise<void> {
    const { error } = await supabase.rpc('admin_create_offer', {
      p_location_id: o.locationId,
      p_code_prefix: o.codePrefix,
      p_kind: o.kind,
      p_title: o.title,
      p_description: o.description,
      p_discount_label: o.discountLabel,
      p_free_uses: o.freeUses,
      p_is_active: o.isActive,
      p_require_follow: o.requireFollow,
      p_follow_instagram: o.followInstagram,
      p_follow_tiktok: o.followTiktok,
      p_follow_facebook: o.followFacebook,
      p_valid_from: o.validFrom,
      p_valid_until: o.validUntil,
      p_code_ttl_days: o.codeTtlDays,
      p_max_codes: o.maxCodes,
    })
    if (error) throw toOfferError(error)
    ActivityLogService.log('offer_create', { location_id: o.locationId, code_prefix: o.codePrefix.toUpperCase() })
  }

  /** Owner/admin: how the store's offers are performing. */
  static async getOfferReport(locationId: number, days = 30): Promise<OfferReportRow[]> {
    const { data, error } = await supabase.rpc('get_offer_report', { p_location_id: locationId, p_days: days })
    if (error) throw toOfferError(error)
    return (data ?? []) as OfferReportRow[]
  }

  /** Admin only: customer-level list for one offer. */
  static async adminOfferCodes(offerId: string, limit = 100): Promise<AdminOfferCode[]> {
    const { data, error } = await supabase.rpc('admin_offer_codes', { p_offer_id: offerId, p_limit: limit })
    if (error) throw toOfferError(error)
    return (data ?? []) as AdminOfferCode[]
  }

  /** Ids of places that currently have an active discount code (public marketing info). */
  static async getLocationIdsWithActiveOffers(): Promise<Set<number>> {
    const { data, error } = await supabase
      .from('location_offers')
      .select('location_id')
      .eq('is_active', true)
    if (error) {
      console.warn('[OfferService] getLocationIdsWithActiveOffers', error)
      return new Set()
    }
    return new Set((data ?? []).map(r => Number(r.location_id)))
  }

  /** Admin only: change dates, code validity, stock and follow settings of an existing offer. */
  static async adminUpdateSettings(offerId: string, o: OfferSettings, locationId?: number): Promise<void> {
    const { error } = await supabase.rpc('admin_update_offer_settings', {
      p_offer_id: offerId,
      p_valid_from: o.validFrom,
      p_valid_until: o.validUntil,
      p_code_ttl_days: o.codeTtlDays,
      p_max_codes: o.maxCodes,
      p_require_follow: o.requireFollow,
      p_follow_instagram: o.followInstagram,
      p_follow_tiktok: o.followTiktok,
      p_follow_facebook: o.followFacebook,
    })
    if (error) throw toOfferError(error)
    ActivityLogService.log('offer_edit', { offer_id: offerId, location_id: locationId, settings: true })
  }
}
