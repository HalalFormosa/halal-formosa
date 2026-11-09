import { Capacitor } from '@capacitor/core'
import { RevenueCatUI, PAYWALL_RESULT } from '@revenuecat/purchases-capacitor-ui'
import { ActivityLogService } from '@/services/ActivityLogService'
import { isDonor, refreshSubscriptionStatus } from '@/composables/useSubscriptionStatus'
import { logPaywallCancelled, logPaywallFailed, logPaywallRestored } from '@/utils/paywallLogging'

/**
 * Shows the Pro paywall for a gated feature. Resolves true when the user is Pro afterwards
 * (already Pro, purchased, or restored), false when they cancelled or the paywall could not run.
 */
export async function presentProPaywall(source: string): Promise<boolean> {
    if (isDonor.value) return true

    await ActivityLogService.log('pro_paywall_trigger', { source })

    if (!Capacitor.isNativePlatform()) {
        console.warn('[RC] Paywall can only run on native.')
        return false
    }

    try {
        const { result } = await RevenueCatUI.presentPaywall()
        if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
            await refreshSubscriptionStatus({ syncToServer: true })
            if (result === PAYWALL_RESULT.PURCHASED) await ActivityLogService.log('pro_purchase_success', { source })
            else logPaywallRestored(source)
            return true
        }
        if (result === PAYWALL_RESULT.CANCELLED) logPaywallCancelled(source)
        else logPaywallFailed(source, result)
    } catch (err) {
        console.error('Paywall failed:', err)
        logPaywallFailed(source, err)
    }
    return false
}
