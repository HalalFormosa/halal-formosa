import { supabase } from '@/plugins/supabaseClient'
import { ActivityLogService } from '@/services/ActivityLogService'
import type {
  LocationPhoto, LocationMenuItem, LocationPromotion, LocationPlan
} from '@/types/Business'

export interface OwnedLocation {
  id: number
  name: string
  address: string | null
  image: string | null
  is_claimed: boolean
  role: 'owner' | 'manager'
  tier: string
}

/**
 * Data access for the business dashboard. All privileged writes to `locations`
 * go through the `update_location_as_owner` RPC (which splits low/high-risk
 * fields); child tables (photos/menu/promotions) are written directly and
 * guarded by RLS + tier-limit triggers.
 */
export function useBusinessListings() {
  /** Locations the current user owns or manages. */
  async function getMyLocations(): Promise<OwnedLocation[]> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from('location_owners')
      // location_plans is embedded via locations (there is no FK from
      // location_owners -> location_plans; both only reference locations)
      .select('role, location_id, locations(id, name, address, image, is_claimed, location_plans(tier))')
      .eq('user_id', user.id)

    if (error) { console.error('[useBusinessListings] getMyLocations', error); return [] }

    return (data ?? []).map((row: any) => {
      const loc = Array.isArray(row.locations) ? row.locations[0] : row.locations
      const planRaw = loc?.location_plans
      const plan = Array.isArray(planRaw) ? planRaw[0] : planRaw
      return {
        id: loc?.id ?? row.location_id,
        name: loc?.name ?? '',
        address: loc?.address ?? null,
        image: loc?.image ?? null,
        is_claimed: loc?.is_claimed ?? false,
        role: row.role,
        tier: plan?.tier ?? 'free',
      }
    })
  }

  async function getPlan(locationId: number): Promise<LocationPlan | null> {
    const { data } = await supabase.from('location_plans').select('*').eq('location_id', locationId).maybeSingle()
    return data as LocationPlan | null
  }

  /**
   * Owner edit applied immediately (kept for direct/instant use). Returns
   * { applied, queued } — `queued` fields went to the admin review queue.
   */
  async function updateListing(locationId: number, patch: Record<string, unknown>) {
    const { data, error } = await supabase.rpc('update_location_as_owner', {
      p_location_id: locationId,
      p_patch: patch,
    })
    if (error) throw error
    ActivityLogService.log('business_listing_edit', { location_id: locationId, fields: Object.keys(patch) })
    return data as { applied: Record<string, unknown>; queued: Record<string, unknown> }
  }

  // ---- Draft / publish ----
  /** Current unpublished draft data for a listing (field→value), or {} if none. */
  async function getDraft(locationId: number): Promise<Record<string, unknown>> {
    const { data } = await supabase.from('location_drafts').select('data').eq('location_id', locationId).maybeSingle()
    return (data?.data as Record<string, unknown>) ?? {}
  }

  /** Save edits as a private draft (not visible to the public). */
  async function saveDraft(locationId: number, patch: Record<string, unknown>) {
    const { error } = await supabase.rpc('save_location_draft', { p_location_id: locationId, p_patch: patch })
    if (error) throw error
    ActivityLogService.log('business_listing_draft_save', { location_id: locationId, fields: Object.keys(patch) })
  }

  /**
   * Publish the draft. Low-risk fields go live; high-risk fields queue for admin
   * review. Returns { applied, queued }.
   */
  async function publishDraft(locationId: number, patch?: Record<string, unknown>) {
    // Persist the latest in-form edits first so nothing is lost.
    if (patch) await saveDraft(locationId, patch)
    const { data, error } = await supabase.rpc('publish_location_draft', { p_location_id: locationId })
    if (error) throw error
    ActivityLogService.log('business_listing_publish', { location_id: locationId })
    return data as { applied: Record<string, unknown>; queued: Record<string, unknown> }
  }

  // ---- Photos ----
  async function getPhotos(locationId: number): Promise<LocationPhoto[]> {
    const { data } = await supabase.from('location_photos').select('*').eq('location_id', locationId).order('sort_order')
    return (data ?? []) as LocationPhoto[]
  }
  async function addPhoto(locationId: number, url: string, caption?: string) {
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('location_photos').insert({
      location_id: locationId, url, caption: caption ?? null, uploaded_by: user?.id ?? null,
    })
    if (error) throw error
  }
  async function removePhoto(id: string) {
    const { error } = await supabase.from('location_photos').delete().eq('id', id)
    if (error) throw error
  }

  // ---- Menu ----
  async function getMenu(locationId: number): Promise<LocationMenuItem[]> {
    const { data } = await supabase.from('location_menu_items').select('*').eq('location_id', locationId).order('sort_order')
    return (data ?? []) as LocationMenuItem[]
  }
  async function addMenuItem(item: Partial<LocationMenuItem> & { location_id: number; name: string }) {
    const { error } = await supabase.from('location_menu_items').insert(item)
    if (error) throw error
  }
  async function updateMenuItem(id: string, patch: Partial<LocationMenuItem>) {
    const { error } = await supabase.from('location_menu_items').update(patch).eq('id', id)
    if (error) throw error
  }
  async function removeMenuItem(id: string) {
    const { error } = await supabase.from('location_menu_items').delete().eq('id', id)
    if (error) throw error
  }

  // ---- Promotions ----
  async function getPromotions(locationId: number): Promise<LocationPromotion[]> {
    const { data } = await supabase.from('location_promotions').select('*').eq('location_id', locationId).order('created_at', { ascending: false })
    return (data ?? []) as LocationPromotion[]
  }
  async function addPromotion(promo: Partial<LocationPromotion> & { location_id: number; title: string }) {
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('location_promotions').insert({ ...promo, created_by: user?.id ?? null })
    if (error) throw error
    ActivityLogService.log('business_promo_create', { location_id: promo.location_id })
  }
  async function setPromotionActive(id: string, isActive: boolean) {
    const { error } = await supabase.from('location_promotions').update({ is_active: isActive }).eq('id', id)
    if (error) throw error
  }
  async function removePromotion(id: string) {
    const { error } = await supabase.from('location_promotions').delete().eq('id', id)
    if (error) throw error
  }

  return {
    getMyLocations, getPlan, updateListing,
    getDraft, saveDraft, publishDraft,
    getPhotos, addPhoto, removePhoto,
    getMenu, addMenuItem, updateMenuItem, removeMenuItem,
    getPromotions, addPromotion, setPromotionActive, removePromotion,
  }
}
