import { Capacitor } from '@capacitor/core'
import { RevenueCatUI, PAYWALL_RESULT } from '@revenuecat/purchases-capacitor-ui'
import { ActivityLogService } from '@/services/ActivityLogService'
import { isDonor, refreshSubscriptionStatus } from '@/composables/useSubscriptionStatus'
import { useNotifier } from '@/composables/useNotifier'
import { supabase } from '@/plugins/supabaseClient'
import { logPaywallCancelled, logPaywallFailed, logPaywallRestored } from '@/utils/paywallLogging'
import { canAutoShowPaywall, markAutoPaywallShown, recordPaywallDismissed, resetPaywallDismissals } from '@/utils/paywallCap'

export interface ProPaywallOptions {
    /**
     * The app opens this paywall by itself (limit sheet, milestone, offer) rather than the user
     * tapping an upgrade button or a locked control. Auto paywalls obey the frequency cap and
     * resolve false without showing when it blocks them.
     */
    auto?: boolean
    /** Extra fields logged with pro_paywall_trigger, e.g. { location_id }. */
    meta?: Record<string, unknown>
}

// Tells the team on Discord about a new subscriber. Never blocks or fails the purchase flow.
async function notifyNewPro(source: string) {
    try {
        const { data: { user } } = await supabase.auth.getUser()
        await useNotifier().notifyEvent(
            'pro_purchase_success',
            '💎 New Pro Member!',
            `User ${user?.email ?? 'unknown'} has just subscribed to Halal Formosa Pro!`,
            undefined,
            { source, email: user?.email, user_id: user?.id },
            ['discord']
        )
    } catch (err) {
        console.error('Pro purchase notification failed:', err)
    }
}

/**
 * Shows the Pro paywall for a gated feature. Resolves true when the user is Pro afterwards
 * (already Pro, purchased, or restored), false when they cancelled or the paywall could not run.
 *
 * This is the one place that presents the paywall, so every entry point logs, refreshes the
 * subscription and notifies the same way. Callers only decide what to do with the result.
 */
export async function presentProPaywall(source: string, options: ProPaywallOptions = {}): Promise<boolean> {
    if (isDonor.value) return true

    if (options.auto) {
        if (!canAutoShowPaywall()) return false
        markAutoPaywallShown()
    }

    await ActivityLogService.log('pro_paywall_trigger', { source, ...options.meta })

    if (!Capacitor.isNativePlatform()) {
        console.warn('[RC] Paywall can only run on native.')
        return false
    }

    try {
        const { result } = await RevenueCatUI.presentPaywall()
        if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
            await refreshSubscriptionStatus({ syncToServer: true })
            resetPaywallDismissals()
            if (result === PAYWALL_RESULT.PURCHASED) {
                await ActivityLogService.log('pro_purchase_success', { source })
                void notifyNewPro(source)
            } else {
                logPaywallRestored(source)
            }
            return true
        }
        if (result === PAYWALL_RESULT.CANCELLED) {
            recordPaywallDismissed()
            logPaywallCancelled(source)
        } else {
            logPaywallFailed(source, result)
        }
    } catch (err) {
        console.error('Paywall failed:', err)
        logPaywallFailed(source, err)
    }
    return false
}
