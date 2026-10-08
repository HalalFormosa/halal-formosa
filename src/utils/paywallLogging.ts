import { ActivityLogService } from '@/services/ActivityLogService'

// Shared outcome logging for the RevenueCat paywall so every entry point
// (profile, AI summary, save limits, For You sort, encyclopedia) reports the
// non-purchase endings the same way. Success is still logged inline at each
// call site because it also does per-site refresh/notify work.

export function logPaywallCancelled(source: string) {
    ActivityLogService.log('pro_purchase_cancelled', { source })
}

export function logPaywallFailed(source: string, reason?: unknown) {
    const error_message = reason instanceof Error ? reason.message : reason != null ? String(reason) : undefined
    ActivityLogService.log('pro_purchase_failed', { source, ...(error_message ? { error_message } : {}) })
}
