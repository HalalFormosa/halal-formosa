// Types for the Business Claim & Dashboard feature.
// Mirrors the Supabase schema created in
// supabase/migrations/20260704120000_business_claim_dashboard.sql

export type ClaimStatus = 'pending' | 'approved' | 'rejected'
export type ClaimantRole = 'owner' | 'manager' | 'staff'
export type PlanTier = 'free' | 'bronze' | 'silver' | 'gold'
export type HalalStatus = 'certified' | 'self_reported' | 'muslim_friendly'

export interface LocationClaim {
  id?: string
  location_id: number
  user_id?: string
  status?: ClaimStatus
  claimant_role: ClaimantRole
  contact_name?: string | null
  contact_phone: string
  contact_email?: string | null
  unified_business_number?: string | null
  proof_urls?: string[]
  note?: string | null
  rejection_reason?: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
  created_at?: string
  updated_at?: string
  // joined for admin/dashboard display
  locations?: { id: number; name: string; address: string | null; image?: string | null } | null
  // populated client-side in the admin view: signed URLs for the private proof objects
  signedProofs?: string[]
}

export interface LocationOwner {
  id: string
  location_id: number
  user_id: string
  role: 'owner' | 'manager'
  created_at: string
}

export interface LocationPlan {
  location_id: number
  tier: PlanTier
  source: 'complimentary' | 'manual' | 'revenuecat'
  status: 'active' | 'expired' | 'canceled'
  expires_at: string | null
  updated_at: string
}

export interface LocationPhoto {
  id: string
  location_id: number
  url: string
  caption: string | null
  sort_order: number
  uploaded_by: string | null
  created_at: string
}

export interface LocationMenuItem {
  id: string
  location_id: number
  name: string
  name_zh: string | null
  price: number | null
  description: string | null
  photo_url: string | null
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface LocationPromotion {
  id: string
  location_id: number
  title: string
  body: string | null
  image_url: string | null
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
}

export interface LocationEditRequest {
  id: string
  location_id: number
  submitted_by: string
  changes: Record<string, unknown>
  status: ClaimStatus
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  created_at: string
  // joined for admin display: current live values to diff against `changes`
  locations?: {
    id: number
    name: string
    address: string | null
    lat: number | null
    lng: number | null
    type_id: number | null
    halal_status: string | null
    location_types?: { name: string } | { name: string }[] | null
  } | null
}

// Resolved feature entitlements for a plan tier (from app_config.business_plan_features)
export interface PlanFeatures {
  maxPhotos: number // -1 = unlimited
  menu: boolean
  maxPromotions: number // -1 = unlimited
  analytics: 'basic' | 'standard' | 'advanced' | 'pro'
}
