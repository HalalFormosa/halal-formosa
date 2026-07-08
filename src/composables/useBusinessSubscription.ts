import { Purchases, type PurchasesPackage } from '@revenuecat/purchases-capacitor'
import { Capacitor } from '@capacitor/core'
import type { PlanTier } from '@/types/Business'

// The RevenueCat offering that holds the Bronze/Silver/Gold business products,
// and the per-tier entitlement identifiers. Configure these in the RevenueCat
// dashboard to match.
export const BUSINESS_OFFERING_ID = 'business'
const TIER_ENTITLEMENTS: Record<PlanTier, string> = {
  free: '',
  bronze: 'business_bronze',
  silver: 'business_silver',
  gold: 'business_gold',
}

/**
 * B2B (business) subscription helper. This is account-level: a purchase applies
 * to ALL of the owner's claimed businesses. The authoritative tier is written by
 * the `revenuecat-webhook` edge function; this composable drives the purchase UI
 * and gives an immediate client-side read of the active entitlement.
 */
export function useBusinessSubscription() {
  const isNative = Capacitor.isNativePlatform()

  /** The RevenueCat offering with the business packages (null on web / if unconfigured). */
  async function getBusinessOffering() {
    if (!isNative) return null
    try {
      const offerings = await Purchases.getOfferings()
      return offerings.all[BUSINESS_OFFERING_ID] ?? null
    } catch (e) {
      console.error('[useBusinessSubscription] getOfferings', e)
      return null
    }
  }

  /** Purchase a package; returns the resulting active business tier. */
  async function purchasePackage(pkg: PurchasesPackage): Promise<PlanTier> {
    await Purchases.purchasePackage({ aPackage: pkg })
    return getActiveTier()
  }

  /** Highest active business tier from RevenueCat entitlements (immediate client read). */
  async function getActiveTier(): Promise<PlanTier> {
    if (!isNative) return 'free'
    try {
      const { customerInfo } = await Purchases.getCustomerInfo()
      const active = customerInfo.entitlements.active
      if (active[TIER_ENTITLEMENTS.gold]) return 'gold'
      if (active[TIER_ENTITLEMENTS.silver]) return 'silver'
      if (active[TIER_ENTITLEMENTS.bronze]) return 'bronze'
      return 'free'
    } catch {
      return 'free'
    }
  }

  async function restore(): Promise<PlanTier> {
    if (!isNative) return 'free'
    try { await Purchases.restorePurchases() } catch { /* ignore */ }
    return getActiveTier()
  }

  return { isNative, getBusinessOffering, purchasePackage, getActiveTier, restore }
}
