import { Purchases, type PurchasesPackage } from '@revenuecat/purchases-capacitor'
import { Capacitor } from '@capacitor/core'
import type { PlanTier } from '@/types/Business'

// Mapping of plan tiers to the corresponding RevenueCat offering IDs.
export const TIER_OFFERINGS: Record<Exclude<PlanTier, 'free'>, string> = {
  bronze: 'business-bronze',
  silver: 'business-silver',
  gold: 'business-gold',
}

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

  /** Fetches and merges packages from all business offerings (bronze, silver, gold) to show live prices. */
  async function getBusinessPackages(): Promise<PurchasesPackage[]> {
    if (!isNative) return []
    try {
      const offerings = await Purchases.getOfferings()
      const packages: PurchasesPackage[] = []

      for (const tier of ['bronze', 'silver', 'gold'] as const) {
        const offeringId = TIER_OFFERINGS[tier]
        const offering = offerings.all[offeringId]
        if (offering?.availablePackages?.[0]) {
          packages.push(offering.availablePackages[0])
        }
      }
      return packages
    } catch (e) {
      console.error('[useBusinessSubscription] getBusinessPackages', e)
      return []
    }
  }

  /** Present the beautiful RevenueCat Paywall UI for a specific tier. */
  async function presentPaywallForTier(tier: Exclude<PlanTier, 'free'>) {
    if (!isNative) return { result: 'ERROR' }
    try {
      const offerings = await Purchases.getOfferings()
      const offering = offerings.all[TIER_OFFERINGS[tier]]
      if (offering) {
        const { RevenueCatUI } = await import('@revenuecat/purchases-capacitor-ui')
        return await RevenueCatUI.presentPaywall({ offering })
      }
      return { result: 'ERROR' }
    } catch (e) {
      console.error('[useBusinessSubscription] presentPaywallForTier', e)
      return { result: 'ERROR' }
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

  return {
    isNative,
    getBusinessPackages,
    presentPaywallForTier,
    purchasePackage,
    getActiveTier,
    restore,
  }
}
