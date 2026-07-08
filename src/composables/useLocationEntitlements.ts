import { supabase } from '@/plugins/supabaseClient'
import type { PlanTier, PlanFeatures } from '@/types/Business'

// Default matrix — mirrors the app_config 'business_plan_features' seed so the UI
// still works if the config row is missing.
const DEFAULT_FEATURES: Record<PlanTier, PlanFeatures> = {
  free:   { maxPhotos: 1,  menu: false, maxPromotions: 0,  analytics: 'basic' },
  bronze: { maxPhotos: 5,  menu: false, maxPromotions: 1,  analytics: 'standard' },
  silver: { maxPhotos: 10, menu: true,  maxPromotions: 3,  analytics: 'advanced' },
  gold:   { maxPhotos: -1, menu: true,  maxPromotions: -1, analytics: 'pro' },
}

let matrixCache: Record<string, PlanFeatures> | null = null

/** Load the tier→features matrix from app_config (cached for the session). */
async function loadMatrix(): Promise<Record<string, PlanFeatures>> {
  if (matrixCache) return matrixCache
  try {
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'business_plan_features')
      .maybeSingle()
    matrixCache = data?.value ? JSON.parse(data.value) : DEFAULT_FEATURES
  } catch {
    matrixCache = DEFAULT_FEATURES
  }
  return matrixCache!
}

export function useLocationEntitlements() {
  /** Resolve the plan tier for a location (defaults to 'free'). */
  async function getTier(locationId: number): Promise<PlanTier> {
    const { data } = await supabase
      .from('location_plans')
      .select('tier')
      .eq('location_id', locationId)
      .maybeSingle()
    return (data?.tier as PlanTier) ?? 'free'
  }

  /** Resolve the effective feature entitlements for a location. */
  async function getFeatures(locationId: number): Promise<{ tier: PlanTier; features: PlanFeatures }> {
    const [tier, matrix] = await Promise.all([getTier(locationId), loadMatrix()])
    const features = matrix[tier] ?? DEFAULT_FEATURES[tier] ?? DEFAULT_FEATURES.free
    return { tier, features }
  }

  return { getTier, getFeatures, DEFAULT_FEATURES }
}
