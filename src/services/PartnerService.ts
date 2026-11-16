import { supabase } from '@/plugins/supabaseClient'
import { ActivityLogService } from '@/services/ActivityLogService'

/** A partner page the signed-in user owns (e.g. Mr. Mo BBQ). */
export interface OwnedPartner {
  id: string
  name: string
  slug: string
  logo_url: string | null
}

/** The public text an owner may edit. Name, logo, tier, type and badges stay admin-only. */
export interface PartnerPageText {
  name: string
  about: string
  address: string
  phone: string
  email: string
  website: string
}

export type PartnerEditErrorCode =
  | 'not_allowed' | 'partner_not_found' | 'invalid_about' | 'invalid_address'
  | 'invalid_phone' | 'invalid_email' | 'invalid_website' | 'unknown'

export class PartnerEditError extends Error {
  constructor(public code: PartnerEditErrorCode) { super(code) }
}

function toError(error: { message?: string } | null): PartnerEditError {
  const msg = error?.message ?? ''
  const known: PartnerEditErrorCode[] = [
    'not_allowed', 'partner_not_found', 'invalid_about', 'invalid_address',
    'invalid_phone', 'invalid_email', 'invalid_website',
  ]
  return new PartnerEditError(known.find(k => msg.includes(k)) ?? 'unknown')
}

/**
 * Partner page ownership. Ownership and every write are checked on the server
 * (is_partner_owner / update_my_partner); the app only decides what to show.
 */
export class PartnerService {
  /** True when the signed-in user owns this partner page (admins count as owners). */
  static async isOwner(partnerId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    const { data, error } = await supabase.rpc('is_partner_owner', { p_partner_id: partnerId })
    if (error) return false
    return data === true
  }

  /** Partner pages the signed-in user owns. */
  static async getMyPartners(): Promise<OwnedPartner[]> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data, error } = await supabase
      .from('partner_owners')
      .select('partners(id, name, slug, logo_url)')
      .eq('user_id', user.id)
    if (error) {
      console.warn('[PartnerService] getMyPartners', error)
      return []
    }
    return (data ?? [])
      .map((r: any) => (Array.isArray(r.partners) ? r.partners[0] : r.partners))
      .filter(Boolean) as OwnedPartner[]
  }

  /** The current text of a partner page, for the edit form. */
  static async getPageText(partnerId: string): Promise<PartnerPageText | null> {
    const { data, error } = await supabase
      .from('partners')
      .select('name, about, address, phone, email, website')
      .eq('id', partnerId)
      .maybeSingle()
    if (error || !data) return null
    return {
      name: data.name ?? '', about: data.about ?? '', address: data.address ?? '',
      phone: data.phone ?? '', email: data.email ?? '', website: data.website ?? '',
    }
  }

  /** Save the editable text of a partner page (server checks ownership and validates). */
  static async updatePageText(partnerId: string, t: Omit<PartnerPageText, 'name'>): Promise<void> {
    const { error } = await supabase.rpc('update_my_partner', {
      p_partner_id: partnerId,
      p_about: t.about, p_address: t.address, p_phone: t.phone, p_email: t.email, p_website: t.website,
    })
    if (error) throw toError(error)
    ActivityLogService.log('partner_page_edit', { partner_id: partnerId })
  }
}
