import { ActivityLogService } from '@/services/ActivityLogService'
import { rcProActive } from '@/composables/useSubscriptionStatus'

// Shared outcome logging for the RevenueCat paywall so every entry point
// (profile, AI summary, save limits, For You sort, encyclopedia) reports the
// non-purchase endings the same way. Purchase success is still logged inline at
// each call site because it also does per-site refresh/notify work.

export function logPaywallCancelled(source: string) {
    ActivityLogService.log('pro_purchase_cancelled', { source })
}

export function logPaywallFailed(source: string, reason?: unknown) {
    const error_message = reason instanceof Error ? reason.message : reason != null ? String(reason) : undefined
    ActivityLogService.log('pro_purchase_failed', { source, ...(error_message ? { error_message } : {}) })
}

// The paywall reports RESTORED even when the store account had nothing to restore
// (RevenueCat then still has no active entitlement). Call this AFTER
// refreshSubscriptionStatus(): it logs pro_restore_success only when RevenueCat
// confirms Pro, and pro_restore_empty when it definitively says it isn't. The
// daily health check treats pro_restore_success as "should be Pro on the server",
// so an empty restore must not look like one.
// `rcProActive === null` (offline / refresh failed) is unknown, so it stays a success.
export function logPaywallRestored(source: string, extra: Record<string, unknown> = {}) {
    const activity = rcProActive.value === false ? 'pro_restore_empty' : 'pro_restore_success'
    ActivityLogService.log(activity, { source, ...extra })
}
