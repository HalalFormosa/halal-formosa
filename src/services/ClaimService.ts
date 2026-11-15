import { supabase } from '@/plugins/supabaseClient'
import { ActivityLogService } from '@/services/ActivityLogService'
import type { LocationClaim, LocationEditRequest } from '@/types/Business'

/**
 * Business claim workflow. Mirrors MerchantService: user submits a claim with
 * proof, an admin approves/rejects. Approval is done through the `approve_claim`
 * RPC (SECURITY DEFINER) which grants ownership + flags the location claimed.
 */
export class ClaimService {
  /** Submit a claim for a location. One open (pending) claim per user+location. */
  static async submitClaim(
    claim: Omit<LocationClaim, 'id' | 'user_id' | 'status' | 'created_at' | 'updated_at' | 'reviewed_by' | 'reviewed_at'>
  ) {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('You must be logged in to claim a business')
    }

    const payload = {
      ...claim,
      user_id: user.id,
      status: 'pending' as const,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('location_claims')
      .insert(payload)
      .select()
      .single()

    if (error) {
      console.error('[ClaimService] submitClaim error:', error)
      throw error
    }

    ActivityLogService.log('business_claim_submit', {
      claim_id: data.id,
      location_id: data.location_id,
    })

    return data as LocationClaim
  }

  /** Current user's claims (most recent first). */
  static async getUserClaims() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from('location_claims')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[ClaimService] getUserClaims error:', error)
      return []
    }
    return (data ?? []) as LocationClaim[]
  }

  /** The current user's claim for a specific location, if any. */
  static async getUserClaimForLocation(locationId: number) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('location_claims')
      .select('*')
      .eq('user_id', user.id)
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[ClaimService] getUserClaimForLocation error:', error)
      return null
    }
    return data as LocationClaim | null
  }

  /** The current user's own pending claims, with the location joined for display. */
  static async getMyPendingClaims() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from('location_claims')
      .select('*, locations(id, name, address, image)')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[ClaimService] getMyPendingClaims error:', error)
      return []
    }
    return (data ?? []) as LocationClaim[]
  }

  /** Admin: pending claims with the location joined for display. */
  static async getPendingClaims() {
    const { data, error } = await supabase
      .from('location_claims')
      .select('*, locations(id, name, address)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[ClaimService] getPendingClaims error:', error)
      throw error
    }
    return (data ?? []) as LocationClaim[]
  }

  /** Admin: badge count of pending claims. */
  static async getPendingClaimsCount() {
    const { count, error } = await supabase
      .from('location_claims')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    if (error) {
      console.error('[ClaimService] getPendingClaimsCount error:', error)
      return 0
    }
    return count ?? 0
  }

  /** Admin: approve a claim (grants ownership via RPC). */
  static async approveClaim(claimId: string) {
    const { error } = await supabase.rpc('approve_claim', { p_claim_id: claimId })
    if (error) {
      console.error('[ClaimService] approveClaim error:', error)
      throw error
    }
    ActivityLogService.log('business_claim_approve', { claim_id: claimId })
  }

  /** Admin: reject a claim with a reason. */
  static async rejectClaim(claimId: string, reason: string) {
    const { error } = await supabase.rpc('reject_claim', { p_claim_id: claimId, p_reason: reason })
    if (error) {
      console.error('[ClaimService] rejectClaim error:', error)
      throw error
    }
    ActivityLogService.log('business_claim_reject', { claim_id: claimId, reason })
  }

  // ---------------------------------------------------------------------------
  // High-risk owner edits: queued into location_edit_requests, reviewed by admin
  // via the review_location_edit_request RPC (applies changes to the live row).
  // ---------------------------------------------------------------------------

  /** Admin: pending high-risk edit requests, with current live values joined for diffing. */
  static async getPendingEditRequests() {
    const { data, error } = await supabase
      .from('location_edit_requests')
      .select('*, locations(id, name, address, lat, lng, type_id, halal_status, location_types(name))')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[ClaimService] getPendingEditRequests error:', error)
      throw error
    }
    return (data ?? []) as LocationEditRequest[]
  }

  /** Admin: badge count of pending edit requests. */
  static async getPendingEditRequestsCount() {
    const { count, error } = await supabase
      .from('location_edit_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    if (error) {
      console.error('[ClaimService] getPendingEditRequestsCount error:', error)
      return 0
    }
    return count ?? 0
  }

  /** Admin: approve a queued edit request (applies the changes to the live location). */
  static async approveEditRequest(requestId: string) {
    const { error } = await supabase.rpc('review_location_edit_request', {
      p_request_id: requestId,
      p_approve: true,
    })
    if (error) {
      console.error('[ClaimService] approveEditRequest error:', error)
      throw error
    }
    ActivityLogService.log('business_edit_request_approve', { request_id: requestId })
  }

  /** Admin: reject a queued edit request with a reason. */
  static async rejectEditRequest(requestId: string, reason: string) {
    const { error } = await supabase.rpc('review_location_edit_request', {
      p_request_id: requestId,
      p_approve: false,
      p_reason: reason,
    })
    if (error) {
      console.error('[ClaimService] rejectEditRequest error:', error)
      throw error
    }
    ActivityLogService.log('business_edit_request_reject', { request_id: requestId, reason })
  }
}
